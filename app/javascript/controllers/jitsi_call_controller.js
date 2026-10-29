import { Controller } from "@hotwired/stimulus"
import { cable } from "@hotwired/turbo-rails"
import { pageIsTurboPreview } from "helpers/turbo_helpers"

export default class extends Controller {
  static targets = [ "dialog", "frame", "incoming", "error" ]
  static values = { url: String, roomId: Number, errorText: String }

  async connect() {
    if (pageIsTurboPreview()) return
    this.connected = true
    const channel = await cable.subscribeTo(
      { channel: "JitsiCallsChannel", room_id: this.roomIdValue },
      { received: this.received.bind(this) }
    )
    if (this.connected) this.channel = channel
    else channel.unsubscribe()
  }

  disconnect() {
    this.connected = false
    this.close()
    this.channel?.unsubscribe()
  }

  open(event) {
    return this.join(event.params?.media === "audio" ? "audio" : "video", true)
  }

  accept() {
    return this.join(this.pendingMedia || "video", false)
  }

  decline() {
    clearTimeout(this.invitationTimeout)
    this.pendingMedia = null
    this.incomingTarget.hidden = true
  }

  received(message) {
    if (message.type !== "invite" || message.from_user_id === Current.user.id) return
    if (this.request || this.dialogTarget.open) return
    this.pendingMedia = message.media === "audio" ? "audio" : "video"
    this.incomingTarget.hidden = false
    clearTimeout(this.invitationTimeout)
    this.invitationTimeout = setTimeout(() => this.decline(), 30000)
  }

  async join(media, notify) {
    if (this.request || this.dialogTarget.open) return
    this.decline()
    this.errorTarget.hidden = true
    const request = new AbortController()
    this.request = request
    try {
      const url = new URL(this.urlValue, window.location.origin)
      url.searchParams.set("media", media)
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin", cache: "no-store", signal: request.signal
      })
      if (!res.ok) throw new Error("Call unavailable")
      const { embed_url: embedUrl } = await res.json()
      if (request.signal.aborted) return
      this.frameTarget.src = embedUrl
      this.dialogTarget.showModal()
      if (notify) this.channel?.perform("invite", { media })
    } catch (error) {
      if (error.name !== "AbortError") {
        this.frameTarget.removeAttribute("src")
        this.errorTarget.textContent = this.errorTextValue
        this.errorTarget.hidden = false
      }
    } finally {
      if (this.request === request) this.request = null
    }
  }

  close() {
    this.request?.abort()
    this.request = null
    this.decline()
    this.frameTarget.removeAttribute("src")
    if (this.dialogTarget.open) this.dialogTarget.close()
  }
}
