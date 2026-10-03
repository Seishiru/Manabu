const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const { spawnSync } = require("node:child_process")
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
const storage = new Map()
global.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }
const key = "manabu-learning-v1"
function load(value) {
  storage.clear()
  if (value !== undefined) storage.set(key, typeof value === "string" ? value : JSON.stringify(value))
  delete require.cache[require.resolve("../src/learning.ts")]
  return require("../src/learning.ts")
}
function snapshot() { return JSON.parse(storage.get(key)) }
function initial() {
  const engine = load()
  engine.updateState({ onboarded: true })
  return snapshot()
}

test("quitting discards the paused session without losing recorded learning or adding history", () => {
  const engine = load()
  const item = engine.items.find(item => item.kind === "Words") || engine.items[0]
  engine.saveItem(item.id)
  engine.beginSession(engine.defaultConfig, [item.id])
  engine.recordAnswer(item.id, false)
  const before = snapshot()
  engine.quitSession()
  const after = snapshot()
  assert.equal(after.activeSession, null)
  assert.deepEqual(after.progress, before.progress)
  assert.deepEqual(after.history, before.history)
  assert.deepEqual(after.preferences, before.preferences)
  assert.equal(load(after).itemById(item.id).id, item.id)
  assert.equal(snapshot().activeSession, null)
})

test("Shortcuts route is recognized and Control replaces the old hint binding", () => {
  assert.equal(require("../src/navigation.ts").isKnownRoute("/shortcuts"), true)
  const practice = fs.readFileSync("src/Practice.tsx", "utf8")
  assert.ok(practice.includes('event.key === "Control"'))
  assert.ok(practice.includes('event.key === "`"'))
  assert.ok(!practice.includes('key === "v"'))
  const dialog = fs.readFileSync("src/ConfirmationDialog.tsx", "utf8")
  assert.ok(dialog.includes('aria-keyshortcuts="A"'))
  assert.ok(dialog.includes('aria-keyshortcuts="S"'))
})

test("Light/Dark/System resolution, persistence and legacy backup compatibility", () => {
  const { resolveAppearance } = require("../src/appearance.ts")
  assert.equal(resolveAppearance("System", true), "dark")
  assert.equal(resolveAppearance("System", false), "light")
  assert.equal(resolveAppearance("Light", true), "light")
  assert.equal(resolveAppearance("Dark", false), "dark")
  const value = initial()
  delete value.preferences.appearance
  const engine = load(value)
  assert.equal(engine.validateBackup(value).preferences.appearance, "Light")
  assert.equal(initial().preferences.appearance, "Light")
  engine.updateState({ preferences: { ...value.preferences, appearance: "Dark" } })
  assert.equal(snapshot().preferences.appearance, "Dark")
  assert.throws(() => engine.validateBackup({ ...value, preferences: { ...value.preferences, appearance: "unknown" } }))
})

test("tutorial uses existing preferences, keeps legacy backups valid and validates its seen flag", () => {
  const engine = load(initial())
  const backup = snapshot()
  assert.equal(engine.validateBackup(backup).preferences.tutorialSeen, undefined)
  engine.updateState({ preferences: { ...backup.preferences, tutorialSeen: true } })
  assert.equal(engine.validateBackup(snapshot()).preferences.tutorialSeen, true)
  assert.throws(() => engine.validateBackup({ ...backup, preferences: { ...backup.preferences, tutorialSeen: "yes" } }))
  const { tutorialSteps, tutorialShortcut } = require("../src/tutorial.ts")
  assert.equal(tutorialSteps.length, 7)
  assert.equal(new Set(tutorialSteps.map(step => step.path)).size, 7)
  assert.ok(tutorialSteps.every(step => step.target.includes(".sidebar nav button[data-tour-route]")))
  assert.equal(tutorialShortcut("a"), "previous")
  assert.equal(tutorialShortcut("d"), "next")
  assert.equal(tutorialShortcut("Enter"), "next")
  assert.equal(tutorialShortcut("Escape"), "close")
  assert.equal(tutorialShortcut("r"), null)
})

test("appearance has a single active media listener across bootstrap, pages and recovery", () => {
  const { applyAppearance } = require("../src/appearance.ts")
  const listeners = new Set()
  const previousWindow = global.window
  const previousDocument = global.document
  const media = { matches: false, addEventListener: (_, callback) => listeners.add(callback), removeEventListener: (_, callback) => listeners.delete(callback) }
  global.window = { matchMedia: () => media }
  global.document = { documentElement: { dataset: {} } }
  try {
    const initialCleanup = applyAppearance("System")
    const pageCleanup = applyAppearance("Dark")
    assert.equal(listeners.size, 1)
    initialCleanup()
    assert.equal(listeners.size, 1)
    assert.equal(document.documentElement.dataset.theme, "dark")
    const temporaryRecovery = applyAppearance("Light")
    assert.equal(document.documentElement.dataset.theme, "light")
    temporaryRecovery()
    assert.equal(document.documentElement.dataset.theme, "dark")
    assert.equal(listeners.size, 1)
    pageCleanup()
    const recoveryCleanup = applyAppearance("System")
    media.matches = true
    for (const callback of listeners) callback()
    assert.equal(document.documentElement.dataset.theme, "dark")
    recoveryCleanup()
    assert.equal(listeners.size, 0)
  } finally { global.window = previousWindow; global.document = previousDocument }
})

test("first-answer accuracy survives retry; mistakes remain reviewable; Self Check is not correctness", () => {
  let engine = load(initial())
  engine.beginSession(engine.defaultConfig, ["taberu"])
  assert.equal(engine.completeSession(), null)
  engine.nextCard()
  assert.equal(snapshot().activeSession.index, 0)
  assert.ok(engine.recordAnswer("taberu", false))
  assert.ok(engine.recordAnswer("taberu", true, true))
  assert.equal(engine.recordAnswer("taberu", true, true), false)
  assert.equal(snapshot().progress.taberu.incorrect, 1)
  assert.equal(snapshot().progress.taberu.needsReview, true)
  const result = engine.completeSession()
  assert.equal(result.correct, 0)
  assert.equal(result.incorrect, 1)
  assert.deepEqual(result.mistakes, ["taberu"])
  engine.beginSession({ ...engine.defaultConfig, answerType: "Self Check" }, ["taberu"])
  const before = snapshot().progress.taberu
  assert.equal(engine.recordAnswer("taberu", true), false)
  assert.ok(engine.recordUnderstanding("taberu", "Forgotten"))
  const after = snapshot().progress.taberu
  assert.equal(after.correct, before.correct)
  assert.equal(after.incorrect, before.incorrect)
  assert.equal(after.needsReview, before.needsReview)
  const rating = engine.completeSession()
  assert.equal(rating.correct, 0)
  assert.equal(rating.incorrect, 0)
  assert.deepEqual(rating.mistakes, [])
})

test("valid backups restore idempotently, unknown IDs remain and invalid input is atomic", () => {
  const value = initial(), engine = load(value)
  engine.saveItem("taberu", true)
  const backup = snapshot()
  backup.progress.retired_example = { saved: true, correct: 4, incorrect: 2, needsReview: true }
  engine.restoreBackup(backup)
  const restored = storage.get(key)
  engine.restoreBackup(backup)
  assert.equal(storage.get(key), restored)
  for (const invalid of [{}, null, { ...backup, profile: {} }, { ...backup, progress: { invalid: { ...backup.progress.taberu, understanding: "bad" } } }, JSON.parse('{"version":1,"progress":{"__proto__":{}}}')]) {
    assert.throws(() => engine.restoreBackup(invalid))
    assert.equal(storage.get(key), restored)
  }
  assert.equal(snapshot().progress.retired_example.correct, 4)
})

test("unreadable local storage is never overwritten by onboarding or practice", () => {
  const engine = load("{broken")
  engine.updateState({ onboarded: true })
  engine.beginSession(engine.defaultConfig, ["taberu"])
  assert.equal(storage.get(key), "{broken")
  assert.ok(engine.hasStorageError())
  const backup = initial()
  const protectedEngine = load("{broken")
  protectedEngine.restoreBackup(backup)
  assert.equal(snapshot().onboarded, true)
})

test("restore storage failures preserve disk, in-memory progress, sessions and unreadable-data protection", () => {
  const backup = initial()
  const engine = load(backup)
  engine.saveItem("taberu", true)
  engine.beginSession(engine.defaultConfig, ["taberu"])
  const before = storage.get(key)
  const setItem = global.localStorage.setItem
  try {
    global.localStorage.setItem = () => { throw new Error("Quota exceeded") }
    assert.equal(engine.restoreBackup(backup).ok, false)
    assert.equal(storage.get(key), before)
    assert.ok(engine.hasStorageError())
    assert.equal(engine.recordAnswer("taberu", false), true)
    global.localStorage.setItem = setItem
    engine.updateState({})
    assert.equal(snapshot().progress.taberu.saved, true)
    assert.equal(snapshot().progress.taberu.incorrect, 1)
    assert.equal(snapshot().activeSession.answers.taberu, false)
    assert.equal(engine.restoreBackup(backup).ok, true)
    assert.equal(engine.hasStorageError(), false)
    const protectedEngine = load("{broken")
    global.localStorage.setItem = () => { throw new Error("Storage denied") }
    assert.equal(protectedEngine.restoreBackup(backup).ok, false)
    global.localStorage.setItem = setItem
    assert.equal(protectedEngine.updateState({ onboarded: true }), false)
    assert.equal(storage.get(key), "{broken")
  } finally { global.localStorage.setItem = setItem }
})

test("paused sessions survive refresh; invalid and missing entries recover without erasing history", () => {
  let engine = load(initial())
  engine.saveItem("taberu", true)
  engine.beginSession(engine.defaultConfig, ["taberu", "gakkou"])
  engine.recordAnswer("taberu", false)
  engine.nextCard()
  const backup = snapshot()
  engine = load(backup)
  assert.ok(engine.recordAnswer("gakkou", true))
  assert.equal(engine.completeSession().incorrect, 1)
  for (const mutate of [session => session.ids.push("removed_content"), session => session.answers.unknown = true, session => session.index = 2, session => session.answers = {}, session => session.config.direction = "invalid"]) {
    const invalid = structuredClone(backup)
    mutate(invalid.activeSession)
    const recovery = load(invalid)
    assert.ok(recovery.getRecoveryNotice())
    assert.equal(recovery.recordAnswer("gakkou", true), false)
    assert.equal(recovery.validateBackup(invalid).progress.taberu.saved, true)
    assert.deepEqual(JSON.parse(storage.get(key)).progress, backup.progress)
  }
})

test("empty/impossible filters and unusual searches return safely without invented cards", () => {
  const engine = load(initial())
  for (const config of [{ ...engine.defaultConfig, content: [] }, { ...engine.defaultConfig, learnedOnly: true }, { ...engine.defaultConfig, reviewOnly: true }, { ...engine.defaultConfig, levels: [] }, { ...engine.defaultConfig, content: ["Hiragana"], direction: "English → Japanese" }]) assert.equal(engine.beginSession(config), false)
  const { searchContent } = require("../src/content/catalog.ts")
  assert.deepEqual(searchContent("?!"), [])
  assert.deepEqual(searchContent("a".repeat(10000)), [])
  assert.ok(searchContent(" ").length)
  assert.doesNotThrow(() => searchContent("水 English 🌸"))
  assert.doesNotThrow(() => searchContent("\u0000"))
})

test("practice writing filters include each script present in mixed entries", () => {
  const engine = load()
  const all = { ...engine.defaultConfig, content: ["Words"], levels: ["N5", "N4", "N3", "N2", "N1", "Unclassified"], writing: ["Hiragana", "Katakana", "Kanji"] }
  const hiragana = engine.eligibleItems({ ...all, writing: ["Hiragana"] })
  const kanji = engine.eligibleItems({ ...all, writing: ["Kanji"] })
  assert.ok(hiragana.length > 0)
  assert.ok(kanji.length > 0)
  const mixed = engine.items.find(item => item.kind === "Words" && item.japanese === "食べる")
  if (mixed) {
    assert.ok(hiragana.some(item => item.id === mixed.id))
    assert.ok(kanji.some(item => item.id === mixed.id))
  }
})

test("writing-specific word content filters the curated word catalog", () => {
  const engine = load()
  const base = {
    ...engine.defaultConfig,
    levels: ["N5", "N4", "N3", "N2", "N1", "Unclassified"],
    writing: ["Hiragana", "Katakana", "Kanji"],
  }
  const hiraganaWords = engine.eligibleItems({ ...base, content: ["Hiragana word"], writing: ["Hiragana"] })
  const kanjiWords = engine.eligibleItems({ ...base, content: ["Kanji word"], writing: ["Kanji"] })
  assert.ok(hiraganaWords.length > 0)
  assert.ok(kanjiWords.length > 0)
  assert.ok(hiraganaWords.every(item => item.kind === "Words"))
  assert.ok(kanjiWords.every(item => item.kind === "Words"))
})

test("canonical and legacy saves share a record; valid routes do not silently accept unknown URLs", () => {
  const engine = load(initial())
  const entry = require("../src/content/catalog.ts").contentEntryById("taberu")
  engine.saveItem(entry.id, true)
  assert.equal(snapshot().progress.taberu.saved, true)
  assert.equal(snapshot().progress[entry.id], undefined)
  const { isKnownRoute, pagePaths } = require("../src/navigation.ts")
  for (const route of pagePaths) assert.ok(isKnownRoute(route))
  assert.ok(isKnownRoute("/dictionary/"))
  assert.equal(isKnownRoute("/not-found"), false)
})

test("one-card and multi-mistake review decks contain only the mistakes and preserve earlier attempts", () => {
  const engine = load(initial())
  assert.ok(engine.beginSession(engine.defaultConfig, ["taberu", "neko", "gakkou"]))
  engine.recordAnswer("taberu", false)
  engine.nextCard()
  engine.recordAnswer("neko", false)
  engine.nextCard()
  engine.recordAnswer("gakkou", true)
  engine.nextCard()
  assert.equal(snapshot().activeSession.index, 2)
  const result = engine.completeSession()
  assert.deepEqual(result.mistakes, ["taberu", "neko"])
  engine.beginSession(engine.defaultConfig, result.mistakes)
  assert.deepEqual(snapshot().activeSession.ids, result.mistakes)
  engine.recordAnswer("taberu", true)
  engine.nextCard()
  engine.recordAnswer("neko", false)
  const reviewed = engine.completeSession()
  assert.deepEqual(reviewed.mistakes, ["neko"])
  engine.beginSession(engine.defaultConfig, reviewed.mistakes)
  engine.recordAnswer("neko", true)
  assert.equal(engine.completeSession().total, 1)
  assert.equal(snapshot().progress.neko.incorrect, 2)
  assert.equal(snapshot().history.length, 3)
})

test("positional choice palettes and primary text meet 4.5:1 contrast in both appearances", () => {
  const channel = value => { const ratio = value / 255; return ratio <= .04045 ? ratio / 12.92 : ((ratio + .055) / 1.055) ** 2.4 }
  const luminance = hex => .2126 * channel(parseInt(hex.slice(1,3),16)) + .7152 * channel(parseInt(hex.slice(3,5),16)) + .0722 * channel(parseInt(hex.slice(5,7),16))
  const contrast = (first, second) => (Math.max(luminance(first),luminance(second)) + .05) / (Math.min(luminance(first),luminance(second)) + .05)
  const css = fs.readFileSync(require("node:path").resolve(__dirname, "../src/index.css"), "utf8")
  for (const key of ["q","w","a","s"]) {
    const fills = [...css.matchAll(new RegExp(`\\.learn-choice-${key} \\{ --choice-fill: (#[a-f0-9]+);`, "g"))].map(match => match[1])
    assert.equal(fills.length, 2)
    assert.ok(contrast(fills[0], "#263c34") >= 4.5, `light ${key}`)
    assert.ok(contrast(fills[1], "#18261e") >= 4.5, `dark ${key}`)
  }
  const lightTokens = css.match(/:root \{\s*--theme-page:[\s\S]*?\n\}/)[0]
  const darkTokens = css.match(/:root\[data-theme="dark"\] \{[\s\S]*?\n\}/)[0]
  const token = (block, name) => block.match(new RegExp(`--${name}: (#[a-f0-9]+);`))[1]
  for (const block of [lightTokens, darkTokens]) {
    assert.ok(contrast(token(block, "theme-on-primary"), token(block, "theme-primary")) >= 4.5)
    assert.ok(contrast(token(block, "theme-muted"), token(block, "theme-surface")) >= 4.5)
    assert.ok(contrast(token(block, "theme-accent"), token(block, "theme-surface")) >= 4.5)
  }
})

test("all production directions retain normalization and common romaji alternatives", () => {
  const engine = load(initial())
  const word = engine.itemById("taberu")
  for (const [direction, answer] of [["Japanese → English","  TO EAT!  "],["English → Japanese","  たべる  "],["Japanese → Romaji"," TABERU. "],["Romaji → Japanese","食べる"],["Kana → Romaji","taberu"],["Romaji → Kana","たべる"]]) assert.equal(engine.isCorrect(word, { ...engine.defaultConfig, direction }, answer), true, direction)
  for (const [kana, answer] of [["し","si"],["ち","ti"],["つ","tu"],["ふ","hu"],["じゃ","jya"],["ちゃ","cya"]]) {
    const item = engine.items.find(value => value.kind === "Hiragana" && value.japanese === kana)
    assert.ok(item)
    assert.equal(engine.isCorrect(item, { ...engine.defaultConfig, direction: "Kana → Romaji" }, answer), true, answer)
  }
})

test("practice offers the six translation directions and accepts alternate Kanji typing answers", () => {
  const engine = load(initial())
  assert.deepEqual(
    engine.availableDirections(["Kanji"]),
    ["Japanese → Romaji", "Romaji → Japanese", "Japanese → English", "English → Japanese", "English → Romaji", "Romaji → English", "Randomize"],
  )
  const kanji = engine.items.find(item => item.kind === "Kanji")
  assert.ok(kanji)
  const config = { ...engine.defaultConfig, content: ["Kanji"], answerType: "Typing" }
  for (const answer of [kanji.japanese, kanji.reading, kanji.romaji, kanji.meanings[0]]) {
    assert.equal(engine.isCorrect(kanji, config, answer), true, answer)
  }
})

test("Practice randomizes answer type and content before creating a session", () => {
  const engine = load(initial())
  const config = {
    ...engine.defaultConfig,
    content: ["Randomize"],
    answerType: "Randomize",
    limit: 5,
  }
  assert.equal(engine.beginSession(config), true)
  const active = snapshot().activeSession
  assert.notEqual(active, null)
  assert.notEqual(active.config.content[0], "Randomize")
  assert.ok(["All", "Hiragana", "Katakana", "Kanji", "Hiragana word", "Katakana word", "Kanji word"].includes(active.config.content[0]))
  assert.ok(["Typing", "Multiple Choice", "Self Check"].includes(active.config.answerType))
  assert.equal(active.ids.length, 5)
})

test("shared kana normalization remains importable by native maintainer commands", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", "import { normalizeSearch } from './src/content/search.ts'; if(normalizeSearch('ミズ') !== 'みず') process.exit(1)"], { cwd: require("node:path").resolve(__dirname, ".."), encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
})

test("offline installation caches Vite backtick lazy imports and handles circular shared chunks", async () => {
  const vm = require("node:vm")
  const origin = "https://manabu.test/"
  const resources = new Map([
    [origin, '<html><script src="/assets/index.js"></script><link href="/assets/index.css"></html>'],
    [origin + "assets/index.js", 'const app = import(`./App.js`);'],
    [origin + "assets/App.js", 'import { shared } from "./index.js";'],
  ])
  const cached = new Map(), events = new Map(), fetched = []
  const worker = fs.readFileSync(require("node:path").resolve(__dirname, "../public/sw.js"), "utf8")
  vm.runInNewContext(worker, { URL, Response, self: { location: { href: origin + "sw.js", origin: origin.slice(0,-1) }, addEventListener: (type, callback) => events.set(type, callback), skipWaiting: async () => {} }, caches: { keys: async () => [], delete: async () => {}, open: async () => ({ match: async url => cached.get(url)?.clone(), put: async (url, response) => cached.set(url, response) }) }, fetch: async url => { fetched.push(url); return new Response(resources.get(url) || "test asset") } })
  let installing
  events.get("install")({ waitUntil: promise => installing = promise })
  await installing
  assert.ok(cached.has(origin + "assets/App.js"))
  assert.ok(cached.has(origin + "assets/index.css"))
  assert.equal(fetched.filter(url => url === origin + "assets/index.js").length, 1)
})
