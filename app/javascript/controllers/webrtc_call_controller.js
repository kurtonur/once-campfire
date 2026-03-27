import { Controller } from "@hotwired/stimulus"
import { cable } from "@hotwired/turbo-rails"
import { pageIsTurboPreview } from "helpers/turbo_helpers"

export default class extends Controller {
  static targets = [
    "panel", "incomingRow", "activeRow", "status", "localVideo", "remoteVideo",
    "muteButton"
  ]

  static values = {
    roomId: Number,
    iceUrl: String,
    callingText: { type: String, default: "Calling…" },
    incomingText: { type: String, default: "Incoming call…" },
    connectedText: { type: String, default: "Connected" },
    declinedText: { type: String, default: "Call declined." },
    mediaErrorText: { type: String, default: "Could not access microphone or camera." },
    lostText: { type: String, default: "Connection lost." }
  }

  async connect() {
    if (pageIsTurboPreview()) return

    this.pc = null
    this.localStream = null
    this.callId = null
    this.pendingOffer = null
    this.iceQueue = []
    this.state = "idle"

    this.channel = await cable.subscribeTo(
      { channel: "CallSignalingChannel", room_id: this.roomIdValue },
      { received: this.#onSignal.bind(this) }
    )

    this.iceServers = await this.#loadIceServers()
  }

  disconnect() {
    this.#cleanup({ notify: false })
    this.channel?.unsubscribe()
  }

  startAudio = () => this.#placeCall({ video: false })
  startVideo = () => this.#placeCall({ video: true })

  accept = () => this.#acceptIncoming()

  decline = () => {
    if (this.callId) {
      this.#relay({ type: "decline", call_id: this.callId })
    }
    this.#cleanup({ notify: false })
  }

  hangup = () => {
    if (this.callId) {
      this.#relay({ type: "hangup", call_id: this.callId })
    }
    this.#cleanup({ notify: false })
  }

  toggleMute = () => {
    if (!this.localStream) return
    const audio = this.localStream.getAudioTracks()[0]
    if (!audio) return
    audio.enabled = !audio.enabled
    if (this.hasMuteButtonTarget) {
      this.muteButtonTarget.setAttribute("aria-pressed", String(!audio.enabled))
    }
  }

  async #placeCall({ video }) {
    if (this.state !== "idle") return

    try {
      this.callId = crypto.randomUUID()
      this.state = "ringing_out"
      this.#setStatus(this.callingTextValue)
      this.#showPanel()
      this.#showActiveUi()

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { facingMode: "user" } : false
      })
      this.#attachLocalPreview()

      this.pc = new RTCPeerConnection({ iceServers: this.iceServers })
      this.#bindPeerConnection()

      this.localStream.getTracks().forEach((track) => this.pc.addTrack(track, this.localStream))

      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)

      this.#relay({
        type: "offer",
        call_id: this.callId,
        sdp: offer.sdp,
        video: video
      })
    } catch (err) {
      console.error(err)
      this.#setStatus(this.mediaErrorTextValue)
      this.#cleanup({ notify: false })
    }
  }

  async #acceptIncoming() {
    if (!this.pendingOffer) return

    const msg = this.pendingOffer
    this.pendingOffer = null

    try {
      this.incomingRowTarget.hidden = true

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: this.#wantsVideo(msg.video) ? { facingMode: "user" } : false
      })
      this.#attachLocalPreview()

      this.pc = new RTCPeerConnection({ iceServers: this.iceServers })
      this.#bindPeerConnection()

      this.localStream.getTracks().forEach((track) => this.pc.addTrack(track, this.localStream))

      await this.pc.setRemoteDescription({ type: "offer", sdp: msg.sdp })
      await this.#drainIceQueue()

      const answer = await this.pc.createAnswer()
      await this.pc.setLocalDescription(answer)

      this.state = "connected"
      this.#setStatus(this.connectedTextValue)
      this.#showActiveUi()

      this.#relay({
        type: "answer",
        call_id: this.callId,
        sdp: answer.sdp
      })
    } catch (err) {
      console.error(err)
      this.#setStatus(this.mediaErrorTextValue)
      this.#cleanup({ notify: true })
    }
  }

  #bindPeerConnection() {
    this.pc.onicecandidate = (event) => {
      if (!event.candidate || !this.callId) return
      this.#relay({
        type: "ice",
        call_id: this.callId,
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
      })
    }

    this.pc.ontrack = (event) => {
      if (this.hasRemoteVideoTarget) {
        this.remoteVideoTarget.srcObject = event.streams[0]
        this.remoteVideoTarget.play?.().catch(() => {})
      }
    }

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === "failed") {
        this.#setStatus(this.lostTextValue)
        this.hangup()
      }
    }
  }

  async #onSignal(msg) {
    if (msg.from_user_id === Current.user.id) return

    switch (msg.type) {
      case "offer":
        await this.#handleOffer(msg)
        break
      case "answer":
        await this.#handleAnswer(msg)
        break
      case "ice":
        await this.#handleRemoteIce(msg)
        break
      case "hangup":
        if (msg.call_id === this.callId) this.#cleanup({ notify: false })
        break
      case "decline":
        if (msg.call_id === this.callId) {
          this.#setStatus(this.declinedTextValue)
          this.#cleanup({ notify: false })
        }
        break
    }
  }

  async #handleOffer(msg) {
    if (this.state !== "idle") return

    this.callId = msg.call_id
    this.pendingOffer = msg
    this.state = "ringing_in"
    this.#showPanel()
    this.#showIncomingUi()
    this.#setStatus(this.incomingTextValue)
  }

  async #handleAnswer(msg) {
    if (msg.call_id !== this.callId || !this.pc) return

    await this.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp })
    await this.#drainIceQueue()
    this.state = "connected"
    this.#setStatus(this.connectedTextValue)
  }

  async #handleRemoteIce(msg) {
    if (msg.call_id !== this.callId || !this.pc) return

    const init = {
      candidate: msg.candidate,
      sdpMid: msg.sdpMid,
      sdpMLineIndex: msg.sdpMLineIndex
    }

    try {
      if (!this.pc.remoteDescription) {
        this.iceQueue.push(new RTCIceCandidate(init))
        return
      }
      await this.pc.addIceCandidate(new RTCIceCandidate(init))
    } catch (err) {
      console.warn("ICE candidate error", err)
    }
  }

  async #drainIceQueue() {
    while (this.iceQueue.length) {
      const c = this.iceQueue.shift()
      await this.pc.addIceCandidate(c)
    }
  }

  async #loadIceServers() {
    try {
      const res = await fetch(this.iceUrlValue, {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      })
      if (!res.ok) throw new Error("ice config")
      const json = await res.json()
      return json.iceServers
    } catch {
      return [{ urls: "stun:stun.l.google.com:19302" }]
    }
  }

  #relay(payload) {
    this.channel.send(Object.assign({ action: "relay" }, payload))
  }

  #wantsVideo(value) {
    return value === true || value === "true"
  }

  #attachLocalPreview() {
    if (this.hasLocalVideoTarget && this.localStream.getVideoTracks().length) {
      this.localVideoTarget.srcObject = this.localStream
      this.localVideoTarget.muted = true
      this.localVideoTarget.hidden = false
    } else if (this.hasLocalVideoTarget) {
      this.localVideoTarget.hidden = true
      this.localVideoTarget.srcObject = null
    }
  }

  #showPanel() {
    this.panelTarget.hidden = false
  }

  #showIncomingUi() {
    this.incomingRowTarget.hidden = false
    this.activeRowTarget.hidden = true
  }

  #showActiveUi() {
    this.incomingRowTarget.hidden = true
    this.activeRowTarget.hidden = false
  }

  #hideUi() {
    this.panelTarget.hidden = true
    this.incomingRowTarget.hidden = true
    this.activeRowTarget.hidden = true
    if (this.hasLocalVideoTarget) {
      this.localVideoTarget.srcObject = null
      this.localVideoTarget.hidden = true
    }
    if (this.hasRemoteVideoTarget) {
      this.remoteVideoTarget.srcObject = null
    }
  }

  #setStatus(text) {
    if (this.hasStatusTarget) this.statusTarget.textContent = text
  }

  #cleanup({ notify }) {
    if (notify && this.callId) {
      this.#relay({ type: "hangup", call_id: this.callId })
    }

    this.iceQueue = []
    this.pendingOffer = null

    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop())
      this.localStream = null
    }

    this.callId = null
    this.state = "idle"
    this.#hideUi()
    this.#setStatus("")
  }
}
