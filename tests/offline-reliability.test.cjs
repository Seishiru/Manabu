const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
const { registerOfflineShell } = require("../src/offlineRegistration.ts")
const script = new URL("https://manabu.test/sw.js")
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
function registration(state = "installing") {
  const worker = Object.assign(new EventTarget(), { state })
  const value = Object.assign(new EventTarget(), { installing: state === "activated" ? null : worker, waiting: null, active: state === "activated" ? worker : null })
  return { worker, value }
}

test("offline registration resolves existing or newly activated caches without waiting on ready", async () => {
  const current = registration("activated")
  await registerOfflineShell({ register: async () => current.value }, script, "/", 100)
  const next = registration()
  const result = registerOfflineShell({ register: async () => next.value }, script, "/", 100)
  await tick()
  next.worker.state = "activated"
  next.worker.dispatchEvent(new Event("statechange"))
  await result
})

test("offline failures and stalled registrations reject within a bounded interval", async () => {
  await assert.rejects(registerOfflineShell({ register: async () => { throw new Error("Denied") } }, script, "/", 100), /registration failed/)
  await assert.rejects(registerOfflineShell({ register: () => { throw new Error("Denied synchronously") } }, script, "/", 100), /registration failed/)
  await assert.rejects(registerOfflineShell({ register: () => new Promise(() => {}) }, script, "/", 10), /timed out/)
  const stalled = registration()
  await assert.rejects(registerOfflineShell({ register: async () => stalled.value }, script, "/", 10), /timed out/)
  const failed = registration()
  const result = registerOfflineShell({ register: async () => failed.value }, script, "/", 100)
  const rejection = assert.rejects(result, /installation failed/)
  await tick()
  failed.worker.state = "redundant"
  failed.value.installing = null
  failed.worker.dispatchEvent(new Event("statechange"))
  await rejection
})

test("offline upgrades wait for the installing worker rather than reporting an old cache as current", async () => {
  const next = registration()
  next.value.active = registration("activated").worker
  let finished = false
  const result = registerOfflineShell({ register: async () => next.value }, script, "/", 100).then(() => finished = true)
  await tick()
  assert.equal(finished, false)
  next.worker.state = "activated"
  next.value.active = next.worker
  next.value.installing = null
  next.worker.dispatchEvent(new Event("statechange"))
  await result
  assert.equal(finished, true)
})

function workerHarness() {
  const origin = "https://manabu.test/"
  const stores = new Map()
  let version = "first"
  let offline = false
  let missing = false
  const key = request => typeof request === "string" ? request : request.url
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map())
      const entries = stores.get(name)
      return { put: async (url, response) => entries.set(key(url), response.clone()), match: async request => entries.get(key(request))?.clone() }
    },
    match: async request => {
      for (const entries of stores.values()) if (entries.has(key(request))) return entries.get(key(request)).clone()
    },
  }
  const fetch = async request => {
    if (offline) throw new Error("Offline")
    const url = key(request)
    if (missing && url.endsWith(`/App-${version}.js`)) return new Response("Missing", { status: 503 })
    if (url === origin || !/\.[a-z0-9]+$/i.test(new URL(url).pathname)) return new Response(`<script src="/assets/index-${version}.js"></script>`)
    if (url.endsWith(`/index-${version}.js`)) return new Response(`import(\`./App-${version}.js\`)`)
    return new Response(`${version} asset`)
  }
  const load = name => {
    const events = new Map()
    const source = fs.readFileSync(path.resolve(__dirname, "../public/sw.js"), "utf8").replace('"manabu-app-v0.8"', JSON.stringify(name))
    vm.runInNewContext(source, { URL, Response, fetch, caches, self: { location: { href: origin + "sw.js", origin: origin.slice(0, -1) }, addEventListener: (event, callback) => events.set(event, callback), skipWaiting: async () => {}, clients: { claim: async () => {} } } })
    return {
      lifecycle: async event => {
        let pending
        events.get(event)({ waitUntil: value => pending = value })
        await pending
      },
      request: async (url, mode = "cors") => {
        let response
        const background = []
        events.get("fetch")({ request: { url: origin + url, method: "GET", mode }, respondWith: value => response = value, waitUntil: value => background.push(value) })
        const result = await response
        await Promise.all(background)
        return result
      },
    }
  }
  return { origin, stores, load, setVersion: value => version = value, setOffline: value => offline = value, setMissing: value => missing = value }
}

test("two releases keep offline navigation, lazy imports and previous-tab assets available", async () => {
  const harness = workerHarness()
  const first = harness.load("manabu-app-first")
  await first.lifecycle("install")
  await first.lifecycle("activate")
  harness.setVersion("second")
  const second = harness.load("manabu-app-second")
  await second.lifecycle("install")
  await second.lifecycle("activate")
  harness.setOffline(true)
  assert.match(await (await second.request("dictionary", "navigate")).text(), /index-second/)
  assert.equal(await (await second.request("assets/App-second.js")).text(), "second asset")
  assert.equal(await (await second.request("assets/App-first.js")).text(), "first asset")
  assert.equal(harness.stores.size, 2)
})

test("failed release installation does not replace or retain a partial offline cache", async () => {
  const harness = workerHarness()
  const first = harness.load("manabu-app-first")
  await first.lifecycle("install")
  harness.setVersion("second")
  harness.setMissing(true)
  await assert.rejects(harness.load("manabu-app-second").lifecycle("install"), /asset unavailable/)
  assert.equal(harness.stores.has("manabu-app-second"), false)
  harness.setOffline(true)
  assert.match(await (await first.request("settings", "navigate")).text(), /index-first/)
})

test("online navigation commits a new shell only after all lazy modules have been cached", async () => {
  const harness = workerHarness()
  const worker = harness.load("manabu-app-first")
  await worker.lifecycle("install")
  harness.setVersion("second")
  harness.setMissing(true)
  await worker.request("settings", "navigate")
  harness.setOffline(true)
  assert.match(await (await worker.request("settings", "navigate")).text(), /index-first/)
  harness.setOffline(false)
  harness.setMissing(false)
  await worker.request("settings", "navigate")
  harness.setOffline(true)
  assert.match(await (await worker.request("settings", "navigate")).text(), /index-second/)
  assert.equal(await (await worker.request("assets/App-second.js")).text(), "second asset")
})
