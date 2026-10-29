import { test, expect, afterEach } from "bun:test"
import { readFileSync } from "node:fs"

// Test browser lifecycle without importing the application's remote import map.
const source = readFileSync(new URL("../../app/javascript/controllers/jitsi_call_controller.js", import.meta.url), "utf8")
  .replace(/^import .*\n/gm, "").replace("export default class", "return class")
const makeController = new Function("Controller", "cable", "pageIsTurboPreview", source)
const originalFetch = globalThis.fetch
const controllers = []
globalThis.window = { location: { origin: "https://chat.example.com" } }
globalThis.Current = { user: { id: 1 } }

function controller() {
  const calls = []
  const channel = { perform: (...args) => calls.push(args), unsubscribe() {} }
  const Type = makeController(class {}, { subscribeTo: async () => channel }, () => false)
  const c = new Type()
  c.urlValue = "/rooms/1/calls/jitsi"
  c.roomIdValue = 1
  c.errorTextValue = "Call unavailable"
  c.frameTarget = { src: "", removeAttribute() { this.src = "" } }
  c.dialogTarget = { open: false, showModal() { this.open = true }, close() { this.open = false } }
  c.incomingTarget = { hidden: true }
  c.errorTarget = { hidden: true, textContent: "" }
  c.channel = channel
  controllers.push(c)
  return { c, calls }
}

afterEach(() => {
  controllers.splice(0).forEach(c => c.disconnect())
  globalThis.fetch = originalFetch
})

test("voice calls use the authenticated endpoint and notify only after opening", async () => {
  const { c, calls } = controller()
  let requested
  globalThis.fetch = async (url, options) => {
    requested = { url, options }
    return { ok: true, json: async () => ({ embed_url: "https://jitsi.example.com/room?jwt=test" }) }
  }
  await c.open({ params: { media: "audio" } })
  expect(requested.url.searchParams.get("media")).toBe("audio")
  expect(requested.options.cache).toBe("no-store")
  expect(requested.options.credentials).toBe("same-origin")
  expect(c.dialogTarget.open).toBe(true)
  expect(calls).toEqual([["invite", { media: "audio" }]])
  c.close()
  expect(c.frameTarget.src).toBe("")
  expect(c.dialogTarget.open).toBe(false)
})

test("incoming audio requires acceptance and does not rebroadcast the invitation", async () => {
  const { c, calls } = controller()
  let requests = 0
  globalThis.fetch = async url => {
    requests++
    expect(url.searchParams.get("media")).toBe("audio")
    return { ok: true, json: async () => ({ embed_url: "https://jitsi.example.com/room" }) }
  }
  c.received({ type: "invite", media: "audio", from_user_id: 2 })
  expect(requests).toBe(0)
  expect(c.incomingTarget.hidden).toBe(false)
  await c.accept()
  expect(requests).toBe(1)
  expect(calls.length).toBe(0)
})

test("closing during a pending fetch prevents the camera frame reopening", async () => {
  const { c, calls } = controller()
  let finish
  globalThis.fetch = () => new Promise(resolve => { finish = resolve })
  const pending = c.open({ params: { media: "video" } })
  c.close()
  finish({ ok: true, json: async () => ({ embed_url: "https://jitsi.example.com/room" }) })
  await pending
  expect(c.frameTarget.src).toBe("")
  expect(c.dialogTarget.open).toBe(false)
  expect(calls.length).toBe(0)
})

test("failed authorization displays an error and never opens or invites", async () => {
  const { c, calls } = controller()
  globalThis.fetch = async () => ({ ok: false })
  await c.open({ params: {} })
  expect(c.errorTarget.hidden).toBe(false)
  expect(c.errorTarget.textContent).toBe("Call unavailable")
  expect(c.dialogTarget.open).toBe(false)
  expect(calls.length).toBe(0)
})
