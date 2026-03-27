import { Controller } from "@hotwired/stimulus"
import { pageIsTurboPreview } from "helpers/turbo_helpers"

export default class extends Controller {
  static targets = [ "dialog", "frame" ]
  static values = { url: String }

  connect() {
    if (pageIsTurboPreview()) return
  }

  disconnect() {
    this.#teardown()
  }

  async open(event) {
    try {
      const media = event.params?.media || "video"
      const url = this.#withMediaParam(this.urlValue, media)
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      })
      if (!res.ok) return

      const { embed_url: embedUrl } = await res.json()
      this.frameTarget.src = embedUrl
      this.dialogTarget.showModal()
    } catch (err) {
      console.error(err)
    }
  }

  close() {
    this.#teardown()
  }

  #teardown() {
    if (this.hasFrameTarget) {
      this.frameTarget.removeAttribute("src")
    }
    if (this.hasDialogTarget) {
      this.dialogTarget.close?.()
    }
  }

  #withMediaParam(baseUrl, media) {
    try {
      const u = new URL(baseUrl, window.location.origin)
      u.searchParams.set("media", media)
      return u.pathname + u.search
    } catch {
      const sep = baseUrl.includes("?") ? "&" : "?"
      return `${baseUrl}${sep}media=${encodeURIComponent(media)}`
    }
  }
}
