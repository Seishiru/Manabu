const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
const starter = require("./fixtures/starter-dictionary.json")
const release = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../src/content/bundled.json"), "utf8"))
const { validateDictionary } = require("../src/content/validation.ts")
const { validateDistribution } = require("../src/content/validation.ts")
const { prepareDictionary } = require("../src/content/prepare.ts")
const { kanaToRomaji } = require("../scripts/content/romaji.ts")
const { readJMdict, adaptJMdict } = require("../scripts/content/jmdict.ts")
const { readKANJIDIC, adaptKANJIDIC } = require("../scripts/content/kanjidic.ts")
const { createContentSearch } = require("../src/content/search.ts")

test("distribution requires explicit source licences, redistribution permission and resolved review", () => {
  assert.throws(() => validateDistribution(release), /distribution is blocked/)
  const approved = structuredClone(starter)
  for (const source of approved.sources) { source.license = "Synthetic test permission"; source.redistribution = true }
  assert.equal(validateDistribution(approved), approved)
  approved.sources[0].redistribution = false
  assert.throws(() => validateDistribution(approved), /distribution is blocked/)
  approved.sources[0].redistribution = true
  approved.entries[0].reviewStatus = "needs-review"
  assert.throws(() => validateDistribution(approved), /review records/)
})

test("content update preserves learner data, paused sessions, aliases, backups and removed history", () => {
  const data = new Map()
  global.localStorage = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }
  const load = snapshot => {
    for (const file of ["../src/content/catalog.ts", "../src/learning.ts"]) delete require.cache[require.resolve(file)]
    const filename = require.resolve("../src/content/bundled.json")
    require.cache[filename] = { id: filename, filename, loaded: true, exports: snapshot }
    return require("../src/learning.ts")
  }
  let engine = load(starter)
  engine.updateState({ onboarded: true, profile: { name: "Release regression", age: "", currentLevel: "Beginner", targetLevel: "N5" } })
  engine.saveItem("taberu", true)
  engine.saveItem("neko", true)
  assert(engine.beginSession(engine.defaultConfig, ["taberu", "neko"]))
  assert(engine.recordAnswer("taberu", false))
  engine.nextCard()
  assert(engine.recordAnswer("neko", true))
  engine.completeSession()
  assert(engine.beginSession({ ...engine.defaultConfig, answerType: "Self Check" }, ["taberu"]))
  assert(engine.recordUnderstanding("taberu", "Hesitated"))
  engine.completeSession()
  assert(engine.beginSession(engine.defaultConfig, ["taberu", "gakkou"]))
  assert(engine.recordAnswer("taberu", true))
  engine.nextCard()
  const before = data.get("manabu-learning-v1")
  const next = structuredClone(release)
  const removed = next.entries.find(entry => entry.legacyIds.includes("neko")).id
  next.entries = next.entries.filter(entry => entry.id !== removed)
  next.conflicts = next.conflicts.filter(conflict => conflict.entryId !== removed)
  next.retiredIds.push(removed)
  for (const entry of next.entries) for (const field of ["wordIds", "relatedWordIds"]) if (entry[field]) entry[field] = entry[field].filter(id => id !== removed)
  validateDictionary(next)
  engine = load(next)
  assert.equal(data.get("manabu-learning-v1"), before)
  const restored = engine.validateBackup(JSON.parse(before))
  assert(restored.progress.taberu.saved && restored.progress.neko.saved)
  assert.equal(restored.progress.taberu.incorrect, 1)
  assert.equal(restored.progress.taberu.understanding, "Hesitated")
  assert.equal(restored.history.length, 2)
  assert.equal(engine.itemById("taberu").id, "taberu")
  assert.equal(engine.itemById("neko"), undefined)
  assert(engine.recordAnswer("gakkou", true))
  assert.equal(JSON.parse(data.get("manabu-learning-v1")).activeSession.index, 1)
  const newWord = next.entries.find(entry => entry.kind === "Words" && !entry.legacyIds.length)
  assert(engine.beginSession({ ...engine.defaultConfig, levels: ["Unclassified"] }, [newWord.id]))
  assert(engine.recordAnswer(newWord.id, true))
  engine.completeSession()
  engine.restoreBackup(JSON.parse(before))
  const afterRestore = JSON.parse(data.get("manabu-learning-v1"))
  assert.deepEqual(afterRestore.progress, JSON.parse(before).progress)
  assert.deepEqual(afterRestore.history, JSON.parse(before).history)
  assert.deepEqual(afterRestore.profile, JSON.parse(before).profile)
  assert.deepEqual(afterRestore.preferences, JSON.parse(before).preferences)
})

test("JMdict preserves senses, restrictions, priorities and inherited parts of speech", () => {
  const xml = `<?xml version="1.0"?><!DOCTYPE JMdict [<!ENTITY n "noun">]><JMdict><entry><ent_seq>1</ent_seq><k_ele><keb>生</keb><ke_pri>ichi1</ke_pri></k_ele><k_ele><keb>性</keb></k_ele><r_ele><reb>せい</reb><re_restr>性</re_restr></r_ele><r_ele><reb>なま</reb><re_restr>生</re_restr></r_ele><sense><stagk>生</stagk><stagr>なま</stagr><pos>&n;</pos><gloss>raw</gloss></sense><sense><stagk>性</stagk><gloss>nature</gloss></sense></entry></JMdict>`
  const registry = { version: 1, mappings: { "fixture:1": { id: "jp_word_fixture_1", legacyIds: [], review: "Synthetic fixture identity", primarySpelling: "生", primaryReading: "なま" } } }
  const source = { id: "fixture", version: "test", permitted: true }
  const entry = adaptJMdict(readJMdict(xml)[0], source, registry, "2026-10-03")
  assert.equal(entry.kanaReadings.length, 2)
  assert.equal(entry.spellings.length, 2)
  assert.equal(entry.senses.length, 2)
  assert.deepEqual(entry.senses[1].partsOfSpeech, ["noun"])
  assert.deepEqual(entry.englishMeanings, ["raw"])
  assert.deepEqual(entry.kanaReadings[0].spellingRestrictions, ["性"])
  assert.throws(() => readJMdict('<!DOCTYPE JMdict [<!ENTITY x SYSTEM "file:///etc/passwd">]><JMdict/>'))
  assert.throws(() => adaptJMdict(readJMdict(xml)[0], source, { version: 1, mappings: {} }, "2026-10-03"))
})

test("KANJIDIC2 keeps structured on/kun readings and never invents modern JLPT", () => {
  const xml = `<kanjidic2><header><file_version>4</file_version></header><character><literal>食</literal><codepoint><cp_value cp_type="ucs">98df</cp_value></codepoint><radical><rad_value rad_type="classical">184</rad_value></radical><misc><grade>2</grade><stroke_count>9</stroke_count><freq>328</freq><jlpt>4</jlpt></misc><reading_meaning><rmgroup><reading r_type="ja_on">ショク</reading><reading r_type="ja_kun">た.べる</reading><meaning>eat</meaning><meaning m_lang="fr">manger</meaning></rmgroup></reading_meaning></character></kanjidic2>`
  const registry = { version: 1, mappings: { "fixture:ucs_98df": { id: "kanji_fixture_1", legacyIds: [], review: "Synthetic fixture identity" } } }
  const entry = adaptKANJIDIC(readKANJIDIC(xml).characters[0], { id: "fixture", version: "test" }, registry, "2026-10-03")
  assert.deepEqual(entry.onReadings, [{ kana: "ショク", romaji: "shoku" }])
  assert.deepEqual(entry.kunReadings, [{ kana: "た.べる", romaji: "taberu" }])
  assert.deepEqual(entry.englishMeanings, ["eat"])
  assert.equal(entry.jlpt.display, "Unclassified")
  assert.equal(entry.legacyJLPT, 4)
  assert.equal(entry.frequency, 328)
})

test("release has valid relationships, licences, stable identities and local variant search", () => {
  validateDictionary(release)
  assert(!release.conflicts.some(conflict => conflict.resolution === "manual-review"))
  for (const original of starter.entries) {
    const current = release.entries.find(entry => entry.id === original.id)
    assert(current)
    assert.deepEqual(current.legacyIds, original.legacyIds)
    if (original.kind === "Sentences") assert.deepEqual(current, original)
  }
  for (const source of release.sources.filter(source => source.id !== "manabu-starter")) {
    assert.equal(source.license, "CC-BY-SA-4.0")
    assert(source.permitted && source.redistribution && source.sha256)
  }
  const search = createContentSearch(release.entries)
  const eat = release.entries.find(entry => entry.legacyIds.includes("taberu"))
  for (const query of ["食べる", "タベル", "taberu", "eat", "食"]) assert(search(query).includes(eat.id))
  assert.equal(kanaToRomaji("コーヒー"), "koohii")
  assert.equal(kanaToRomaji("しんよう"), "shin'you")
  assert.equal(kanaToRomaji("がっこう"), "gakkou")
  assert.throws(() => kanaToRomaji("かなっ"))
  const bad = structuredClone(release)
  bad.entries[0].legacyIds = []
  assert.throws(() => prepareDictionary([bad], { version: "bad", updatedAt: "2026-10-03" }, { preferredSources: {} }, release))
})

test("homographs remain separate and require review instead of automatic merging", () => {
  const snapshot = structuredClone(release)
  const word = structuredClone(snapshot.entries.find(entry => entry.kind === "Words"))
  word.id = "jp_word_distinct_homograph"
  word.legacyIds = []
  snapshot.entries.push(word)
  const prepared = prepareDictionary([snapshot], { version: "homograph-test", updatedAt: "2026-10-03" }, { preferredSources: {} })
  assert(prepared.entries.some(entry => entry.id === word.id))
  assert(prepared.conflicts.some(conflict => conflict.entryId === word.id && conflict.field === "identity" && conflict.resolution === "manual-review"))
})

test("a new release date does not rewrite unchanged curated sentence dates", () => {
  const prepared = prepareDictionary([release], { version: "2026-10-04.candidate", updatedAt: "2026-10-04" }, { preferredSources: {} }, release)
  for (const sentence of starter.entries.filter(entry => entry.kind === "Sentences")) assert.deepEqual(prepared.entries.find(entry => entry.id === sentence.id), sentence)
})
