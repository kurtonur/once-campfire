import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "dialog" ]

  show() {
    this.dialogTarget.showModal()
  }

  close() {
    this.dialogTarget.close()
  }
}
