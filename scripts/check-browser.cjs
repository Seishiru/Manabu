const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const os = require("node:os")
const http = require("node:http")
const { spawn } = require("node:child_process")
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "manabu-audit-"))
const routes = ["/", "/practice", "/dictionary", "/japanese-keyboard", "/writing-system", "/progress", "/settings"]
const seed = {
  version: 1, onboarded: true, language: "English",
  profile: { name: "", age: "", currentLevel: "Beginner", targetLevel: "N5" },
  preferences: { appearance: "System", romaji: "Always show", english: true, pronunciation: false, representation: "Kanji" },
  progress: {}, history: [], recent: [],
  practiceConfig: { mode: "Flashcards", content: ["Words"], levels: ["N5"], writing: ["Hiragana", "Katakana", "Kanji"], direction: "Japanese → Romaji", answerType: "Typing", limit: 10, reviewOnly: false, learnedOnly: false },
  activeSession: null,
}
let browser, socket, server
let checks = 0
async function main() {
  assert(fs.existsSync("dist/index.html"), "Run pnpm build before the browser audit")
  server = http.createServer((request, response) => {
    let filename = path.join(process.cwd(), "dist", new URL(request.url, "http://localhost").pathname)
    if (!fs.existsSync(filename) || fs.statSync(filename).isDirectory()) filename = path.resolve("dist/index.html")
    response.setHeader("Content-Type", ({ ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".ttf": "font/ttf", ".txt": "text/plain" })[path.extname(filename)] || "application/octet-stream")
    fs.createReadStream(filename).pipe(response)
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = spawn(process.env.CHROMIUM || "/usr/bin/chromium", ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" })
  const portFile = path.join(profile, "DevToolsActivePort")
  for (let attempt = 0; attempt < 100 && !fs.existsSync(portFile); attempt++) await sleep(100)
  assert(fs.existsSync(portFile), "Chromium did not start; set CHROMIUM to the browser binary")
  const debugPort = fs.readFileSync(portFile, "utf8").split("\n")[0]
  const tab = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json()
  socket = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise(resolve => { socket.onopen = resolve })
  let sequence = 0
  const pending = new Map()
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const identifier = ++sequence
    const timeout = setTimeout(() => { pending.delete(identifier); reject(new Error(`Timed out: ${method}`)) }, 20000)
    pending.set(identifier, result => { clearTimeout(timeout); result.error ? reject(new Error(JSON.stringify(result.error))) : resolve(result.result) })
    socket.send(JSON.stringify({ id: identifier, method, params }))
  })
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id) }
  }
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  const wait = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await sleep(60) }
    throw new Error(`Condition not met: ${expression}`)
  }
  const clickText = async (text, selector = "button") => {
    await wait(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(element => element.innerText.trim() === ${JSON.stringify(text)})?.disabled === false`)
    await evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(element => element.innerText.trim() === ${JSON.stringify(text)}).click()`)
    await sleep(50)
  }
  const press = async (key, code = key) => {
    await call("Input.dispatchKeyEvent", { type: "keyDown", key, code })
    await call("Input.dispatchKeyEvent", { type: "keyUp", key, code })
    await sleep(80)
  }
  const setInput = (selector, value) => evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  const goto = async route => {
    await call("Page.navigate", { url: origin + route })
    await sleep(100)
    await wait("document.readyState === 'complete' && !document.querySelector('.app-bootstrap') && !!document.querySelector('#root > *')")
  }
  const seedData = async value => {
    await evaluate(`localStorage.setItem('manabu-learning-v1', ${JSON.stringify(JSON.stringify(value))})`)
  }
  const state = () => evaluate("JSON.parse(localStorage.getItem('manabu-learning-v1'))")
  const check = (condition, message) => { assert(condition, message); checks++ }
  await call("Page.enable")
  await call("Runtime.enable")
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] })
  await goto("/settings")
  await seedData(seed)
  await goto("/settings")
  check(await evaluate("document.documentElement.dataset.theme === 'dark'"), "System follows dark OS preference")
  await evaluate("document.querySelector('input[name=appearance][value=Light]').click()")
  await wait("document.documentElement.dataset.theme === 'light'")
  await goto("/settings")
  check((await state()).preferences.appearance === "Light", "Explicit Light persists after refresh")
  await evaluate("document.querySelector('input[name=appearance][value=System]').click()")
  await wait("document.documentElement.dataset.theme === 'dark'")
  await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] })
  await wait("document.documentElement.dataset.theme === 'light'")
  check(true, "System responds to OS appearance changes")

  const dimensions = [[1920, 1080], [1440, 900], [1280, 720], [768, 1024], [1024, 768], [320, 740], [390, 844], [430, 932]]
  if (!process.env.AUDIT_INTERACTIONS_ONLY) for (const appearance of ["Light", "Dark"]) {
    await seedData({ ...seed, preferences: { ...seed.preferences, appearance } })
    for (const [width, height] of dimensions) {
      await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 640 })
      for (const route of routes) {
        await goto(route)
        await evaluate("document.querySelector('.home-welcome-card .dict-text-button')?.click()")
        const measurement = await evaluate("({ width: innerWidth, scroll: document.documentElement.scrollWidth, theme: document.documentElement.dataset.theme, background: getComputedStyle(document.documentElement).backgroundColor, error: !!document.querySelector('.recovery-card') })")
        check(measurement.scroll <= measurement.width + 1, `${appearance} ${width}×${height} ${route}: horizontal overflow ${measurement.scroll}`)
        check(!measurement.error, `${route}: unexpected error screen`)
        if (appearance === "Dark") check(measurement.background === "rgb(18, 18, 18)", `${route}: dark background must be #121212`)
      }
    }
  }
  if (!process.env.AUDIT_INTERACTIONS_ONLY) console.log("PASS: all seven routes across Light/Dark and eight desktop/tablet/phone viewports")
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await goto("/something-that-does-not-exist")
  check(await evaluate("document.querySelector('h1').innerText === 'Page not found'"), "Unknown route has a distinct 404")
  await clickText("Go Home")
  await wait("location.pathname === '/' && !!document.querySelector('.app-shell')")
  await goto("/kanji")
  await wait("location.pathname === '/dictionary' && new URLSearchParams(location.search).get('tab') === 'kanji'")
  check(await evaluate("document.querySelector('[role=tab][aria-selected=true]').innerText === 'Kanji'"), "Legacy Kanji redirects to canonical Dictionary tab")
  await goto("/dictionary")
  await setInput(".dict-search-box input", "water")
  await wait("!!document.querySelector('.dict-result')")
  await evaluate("document.querySelector('.dict-result').click()")
  await wait("new URLSearchParams(location.search).has('entry')")
  const detailUrl = await evaluate("location.pathname + location.search")
  await goto(detailUrl)
  check(await evaluate("!!document.querySelector('.dict-detail')"), "Dictionary details refresh directly")
  await evaluate("document.querySelector('.dict-detail .dict-primary').click()")
  await wait("location.pathname === '/practice' && !!document.querySelector('.learn-card')")
  await evaluate("history.back()")
  await wait("location.pathname === '/dictionary' && !!document.querySelector('.dict-detail')")
  await evaluate("history.forward()")
  await wait("location.pathname === '/practice' && !!document.querySelector('.learn-card')")
  check(true, "Dictionary → exact Practice works with Back/Forward")
  for (const [label, route] of [["Home", "/"], ["Practice", "/practice"], ["Dictionary", "/dictionary"], ["Japanese Keyboard", "/japanese-keyboard"], ["Writing System", "/writing-system"], ["Progress", "/progress"], ["Settings", "/settings"]]) {
    await evaluate(`[...document.querySelectorAll('.sidebar .nav-item')].find(button => button.innerText.trim() === ${JSON.stringify(label)}).click()`)
    await wait(`location.pathname === ${JSON.stringify(route)} && document.querySelector('.sidebar [aria-current=page]')?.innerText.trim() === ${JSON.stringify(label)}`)
    await evaluate("document.querySelector('.home-welcome-card .dict-text-button')?.click()")
    check(await evaluate(`document.querySelector('.sidebar [aria-current=page]').innerText.trim() === ${JSON.stringify(label)}`), "Desktop navigation has the correct active section")
  }
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  for (const route of routes) {
    await evaluate(`[...document.querySelectorAll('.mobile-nav button')].find(button => ${JSON.stringify(route)} === (button.innerText.trim() === 'Home' ? '/' : '/' + button.innerText.trim().toLowerCase().replaceAll(' ', '-'))).click()`)
    await wait(`location.pathname === ${JSON.stringify(route)} && !!document.querySelector('.mobile-nav [aria-current=page]')`)
    await evaluate("document.querySelector('.home-welcome-card .dict-text-button')?.click()")
    check(true, "Mobile navigation works")
  }
  console.log("PASS: 404/Home recovery, canonical Kanji redirect, direct details, desktop/mobile navigation and Back/Forward")

  await seedData({ ...seed, preferences: { ...seed.preferences, appearance: "Dark" } })
  await goto("/japanese-keyboard")
  await evaluate("document.querySelector('textarea').focus()")
  for (const character of "mizu") { await call("Input.insertText", { text: character }); await sleep(35) }
  check(await evaluate("document.querySelector('textarea').value === 'みず'"), "Physical romaji composes kana")
  await evaluate("document.querySelector('.keyboard-candidate-actions button').click()")
  await wait("!!document.querySelector('dialog[open]')")
  await evaluate("history.back()")
  await wait("!document.querySelector('dialog[open]')")
  check(await evaluate("document.querySelector('textarea').value === 'みず'"), "Dialog Back preserves composition")
  await evaluate("document.querySelector('.keyboard-candidate-actions button').click()")
  await wait("!!document.querySelector('dialog[open]')")
  await press("Escape")
  await wait("!document.querySelector('dialog[open]')")
  await evaluate("document.querySelector('[aria-label=\"Insert 水\"]').click()")
  await wait("document.querySelector('textarea').value === '水'")
  for (const character of "wonomu") { await call("Input.insertText", { text: character }); await sleep(35) }
  await evaluate("document.querySelector('[aria-label=\"Insert 飲む\"]').click()")
  await wait("document.querySelector('textarea').value === '水を飲む'")
  check(await evaluate("document.querySelector('textarea').value === '水を飲む'"), "Candidate insertion preserves mixed Japanese text")
  await evaluate("document.querySelector('.keyboard-literal-control input').click(); document.querySelector('textarea').focus()")
  await call("Input.insertText", { text: " English" })
  check(await evaluate("document.querySelector('textarea').value === '水を飲む English'"), "Literal mode preserves English")
  await press(" ", "Space")
  check(await evaluate("document.querySelector('textarea').value === '水を飲む English '"), "Space doesn't reconvert literal English")
  await press("Enter")
  check(await evaluate("document.querySelector('textarea').value === '水を飲む English \\n'"), "Enter doesn't reconvert literal English")
  await clickText("Clear", ".keyboard-editor-footer button")
  await evaluate("document.querySelector('.keyboard-literal-control input').click(); document.querySelector('textarea').focus()")
  await call("Input.insertText", { text: "n" })
  await clickText("か", ".keyboard-kana-row button")
  check(await evaluate("document.querySelector('textarea').value === 'んか'"), "Virtual kana commits a pending nasal")
  await call("Input.insertText", { text: "🙂" })
  await evaluate("document.querySelector('[aria-label=Backspace]').click()")
  check(await evaluate("document.querySelector('textarea').value === 'んか'"), "Virtual backspace preserves Unicode text")
  await clickText("Clear", ".keyboard-editor-footer button")
  await call("Input.imeSetComposition", { text: "カナ", selectionStart: 2, selectionEnd: 2 })
  await call("Input.insertText", { text: "カナ" })
  await wait("document.querySelector('textarea').value === 'カナ'")
  check(true, "Native IME composition is not rewritten")
  await goto("/settings")
  await goto("/japanese-keyboard")
  check(await evaluate("document.querySelector('textarea').value === 'カナ'"), "Keyboard draft survives navigation and refresh within the tab")
  console.log("PASS: keyboard composition, candidate insertion, literal input, native dialog Escape/Back")

  await goto("/settings")
  await setInput(".learn-profile-form input[type=number]", "1e2")
  await clickText("Save profile", ".learn-profile-form button")
  check((await state()).profile.age === "100", "Scientific-notation number inputs save a compatible whole-number age")
  const beforeRestore = await evaluate("localStorage.getItem('manabu-learning-v1')")
  const chooseBackup = async (filename, contents) => {
    const fullPath = path.join(profile, filename)
    fs.writeFileSync(fullPath, contents)
    const document = await call("DOM.getDocument")
    const input = await call("DOM.querySelector", { nodeId: document.root.nodeId, selector: ".learn-restore input[type=file]" })
    await call("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [fullPath] })
    await sleep(100)
    await wait("document.querySelector('.learn-restore').getAttribute('aria-busy') === 'false'")
  }
  await chooseBackup("corrupt.json", "broken JSON")
  check(await evaluate("document.querySelector('.learn-restore').innerText.includes('readable JSON')"), "Corrupt backup has a friendly error")
  check(await evaluate("localStorage.getItem('manabu-learning-v1')") === beforeRestore, "Rejected backup preserves local data")
  const empty = structuredClone(seed)
  delete empty.preferences.appearance
  await chooseBackup("old-empty.json", JSON.stringify(empty))
  check(await evaluate("document.querySelector('.learn-restore').innerText.includes('clear existing progress')"), "Empty backup warns before restore")
  await clickText("Cancel", ".learn-restore button")
  check(await evaluate("localStorage.getItem('manabu-learning-v1')") === beforeRestore, "Cancel restore leaves data unchanged")
  console.log("PASS: backup errors, old-format compatibility, empty-backup warning and cancellation")

  const practice = structuredClone(seed)
  practice.preferences.appearance = "Dark"
  practice.activeSession = { id: "audit-typing", date: new Date().toISOString(), config: practice.practiceConfig, ids: ["taberu", "gakkou"], index: 0, answers: {}, newItems: [], retried: [] }
  await seedData(practice)
  await goto("/practice")
  await setInput("#practice-answer", "wrong")
  await clickText("Check", ".learn-answer-area button")
  await wait("!!document.querySelector('.learn-feedback')")
  check(await evaluate("!document.querySelector('.learn-hidden-answer').classList.contains('is-visible')"), "Incorrect answer is initially blurred")
  await evaluate("document.activeElement.blur()")
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "t", code: "KeyT" })
  await wait("document.querySelector('.learn-hidden-answer').classList.contains('is-visible')")
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "t", code: "KeyT" })
  await wait("!document.querySelector('.learn-hidden-answer').classList.contains('is-visible')")
  await press("r", "KeyR")
  await wait("!!document.querySelector('#practice-answer')")
  await setInput("#practice-answer", "taberu")
  await clickText("Check", ".learn-answer-area button")
  await wait("!!document.querySelector('.learn-feedback.correct')")
  check(await evaluate("!document.querySelector('.learn-hold-answer')"), "Correct answer doesn't need hold-to-view")
  await evaluate("document.activeElement.blur()")
  await press(" ", "Space")
  await wait("!!document.querySelector('#practice-answer')")
  await setInput("#practice-answer", "gakkou")
  await clickText("Check", ".learn-answer-area button")
  await evaluate("document.activeElement.blur()")
  await press(" ", "Space")
  await wait("!!document.querySelector('.learn-results')")
  check((await state()).history[0].incorrect === 1, "Retry doesn't rewrite first-answer accuracy")
  await press("t", "KeyT")
  await wait("!!document.querySelector('.learn-card')")
  check(JSON.stringify((await state()).activeSession.ids) === '["taberu"]', "Review mistakes contains only the actual mistake")
  await goto("/practice")
  check(await evaluate("!!document.querySelector('#practice-answer')"), "Paused practice resumes directly after refresh")
  console.log("PASS: Space/R/hold-T shortcuts, real mistake review, first-answer accuracy and refresh resume")

  const selfCheck = structuredClone(practice)
  selfCheck.practiceConfig.answerType = "Self Check"
  selfCheck.activeSession.config = selfCheck.practiceConfig
  selfCheck.activeSession.ids = ["taberu"]
  await seedData(selfCheck)
  await goto("/practice")
  check(await evaluate("document.querySelectorAll('.learn-self-ratings button').length === 4 && !document.querySelector('.learn-hold-answer')"), "Self-check has four position-labelled ratings without answer guide")
  check((await evaluate("[...document.querySelectorAll('.learn-self-ratings button')].map(button => getComputedStyle(button).backgroundColor)")).length === 4, "Self-check positions have filled colors")
  await press("q", "KeyQ")
  await wait("!!document.querySelector('.learn-hold-answer')")
  await press(" ", "Space")
  await wait("!!document.querySelector('.learn-results')")
  check((await state()).history[0].correct === 0 && (await state()).history[0].incorrect === 0, "Self-check doesn't change correctness")
  for (const [key, rating] of [["w", "Hesitated"], ["a", "Aware"], ["s", "Obvious"]]) {
    await seedData(selfCheck)
    await goto("/practice")
    await press(key, `Key${key.toUpperCase()}`)
    await wait(`document.querySelector('.learn-feedback')?.innerText.includes(${JSON.stringify(rating)})`)
    check((await state()).progress.taberu.understanding === rating, `${key.toUpperCase()} records ${rating}`)
  }
  console.log("PASS: Q/W/A/S self-check ratings, positional colors and neutral understanding tracking")

  const identification = structuredClone(selfCheck)
  identification.practiceConfig.mode = "Identification"
  identification.practiceConfig.answerType = "Multiple Choice"
  identification.practiceConfig.direction = "Japanese → English"
  identification.activeSession.config = identification.practiceConfig
  for (const [index, key] of ["q", "w", "a", "s"].entries()) {
    await seedData(identification)
    await goto("/practice")
    const correct = await evaluate(`document.querySelectorAll('.learn-choices button')[${index}].innerText.startsWith('to eat')`)
    await press(key, `Key${key.toUpperCase()}`)
    await wait("!!document.querySelector('.learn-feedback')")
    check((await state()).activeSession.answers.taberu === correct, `${key.toUpperCase()} selects the correct physical position`)
  }
  await evaluate("document.activeElement.blur()")
  await press(" ", "Space")
  await wait("!!document.querySelector('.learn-results')")
  await press("r", "KeyR")
  await wait("!!document.querySelector('.learn-card')")
  check(JSON.stringify((await state()).activeSession.ids) === '["taberu"]', "Practice again preserves the exact one-card deck")
  const sentence = JSON.parse(fs.readFileSync('src/content/bundled.json', 'utf8')).entries.find(entry => entry.kind === 'Sentences' && entry.tokens?.length)
  const formation = structuredClone(seed)
  formation.practiceConfig.mode = "Sentence Formation"
  formation.practiceConfig.content = ["Sentences"]
  formation.practiceConfig.direction = "English → Japanese"
  formation.activeSession = { ...practice.activeSession, config: formation.practiceConfig, ids: [sentence.legacyIds[0] || sentence.id] }
  await seedData(formation)
  await goto("/practice")
  for (const token of sentence.tokens) {
    await evaluate(`[...document.querySelectorAll('.learn-sentence-pieces button')].find(button => !button.disabled && button.innerText === ${JSON.stringify(token)}).click()`)
    await sleep(40)
  }
  await clickText("Check", ".learn-answer-area button")
  await wait("!!document.querySelector('.learn-feedback.correct')")
  check(true, "Sentence Formation validates a real bundled token sequence")
  console.log("PASS: multiple-choice position shortcuts, one-card restart and actual sentence formation")

  await goto("/dictionary")
  const beforeCrash = await evaluate("localStorage.getItem('manabu-learning-v1')")
  await evaluate(`(() => {
    const find = fiber => {
      if (!fiber) return null
      if (fiber.stateNode?.props?.resetKey !== undefined && typeof fiber.stateNode?.forceUpdate === 'function') return fiber.stateNode
      return find(fiber.child) || find(fiber.sibling)
    }
    const container = document.getElementById('root')
    const rootKey = Object.keys(container).find(key => key.startsWith('__reactContainer$'))
    const boundary = find(container[rootKey]?.stateNode?.current)
    if (!boundary) throw new Error('Error boundary not found')
    window.__auditBoundary = boundary
    window.__originalRender = boundary.render
    boundary.render = function() {
      if (this.state.failed) return window.__originalRender.call(this)
      return { $$typeof: Symbol.for('react.transitional.element'), type: function AuditCrash() { throw new Error('Intentional regression-test rendering failure') }, key: null, props: {}, _owner: null }
    }
    boundary.forceUpdate()
  })()`)
  await wait("document.querySelector('.recovery-card h1')?.innerText === 'Something went wrong'")
  check(await evaluate("!document.querySelector('.recovery-card').innerText.includes('Intentional')"), "Rendering failure hides technical details")
  check(await evaluate("localStorage.getItem('manabu-learning-v1')") === beforeCrash, "Rendering failure preserves learner data")
  await evaluate("window.__auditBoundary.render = window.__originalRender")
  await clickText("Try Again")
  await wait("!!document.querySelector('.dict-search-box')")
  await evaluate("window.dispatchEvent(new ErrorEvent('error', { error: new Error('Intentional runtime regression test') }))")
  await wait("document.querySelector('.recovery-card h1')?.innerText === 'Something went wrong'")
  await clickText("Return Home")
  await wait("location.pathname === '/' && !!document.querySelector('.app-shell')")
  console.log("PASS: real child rendering failure, runtime failure, safe retry and Home recovery")

  await seedData({ ...seed, onboarded: false, preferences: { ...seed.preferences, appearance: "Dark" } })
  await goto("/")
  check(await evaluate("document.documentElement.dataset.theme === 'dark' && !!document.querySelector('.onboarding')"), "Onboarding follows persisted appearance")
  await evaluate("document.querySelector('.onboarding-button').click()")
  await wait("!!document.querySelector('.loading-screen')")
  check(await evaluate("getComputedStyle(document.querySelector('.loading-screen')).backgroundColor === 'rgb(18, 18, 18)'"), "Loading screen is themed")
  await wait("!!document.querySelector('.introduction') || document.body.innerText.includes('Get Started')")
  await clickText("Get Started", ".onboarding-button")
  await wait("document.body.innerText.includes('Continue as Guest')")
  await clickText("Continue as Guest", ".onboarding-button")
  await wait("document.body.innerText.includes('Skip')")
  await evaluate("[...document.querySelectorAll('button')].find(button => button.innerText.includes('Skip')).click()")
  await wait("!!document.querySelector('.app-shell')")
  check((await state()).onboarded === true, "Onboarding still completes")
  await goto("/settings")
  await evaluate("navigator.serviceWorker.ready")
  await call("Network.enable")
  await call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
  await goto("/japanese-keyboard")
  check(await evaluate("!!document.querySelector('textarea')"), "Cached app starts offline")
  await clickText("Clear", ".keyboard-editor-footer button")
  await evaluate("document.querySelector('textarea').focus()")
  for (const character of "mizu") { await call("Input.insertText", { text: character }); await sleep(35) }
  check(await evaluate("!!document.querySelector('[aria-label=\"Insert 水\"]')"), "Keyboard lookup works offline")
  console.log(`PASS: onboarding, loading and cached offline keyboard; ${checks} browser assertions total`)
  if (process.env.SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
    const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
    fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR, "manabu-dark-keyboard.png"), Buffer.from(screenshot.data, "base64"))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  socket?.close()
  browser?.kill("SIGTERM")
  if (browser && browser.exitCode === null) await new Promise(resolve => { browser.once("exit", resolve); setTimeout(resolve, 1500) })
  await new Promise(resolve => server ? server.close(resolve) : resolve())
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
})
