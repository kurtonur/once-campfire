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

  async open() {
    try {
      const res = await fetch(this.urlValue, {
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
}
