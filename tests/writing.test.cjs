const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
const model = require("../src/writing/model.ts")
const { kanaEntries, kanjiEntries } = require("../src/content/catalog.ts")
const { defaultWritingSettings, validWritingSettings } = require("../src/writing/settings.ts")
const { writingType } = require("../src/content/writingType.ts")

test("writing type classifies Japanese display forms without using readings", () => {
  const cases = new Map([
    ["たべる", "hiragana"],
    ["カメラ", "katakana"],
    ["食べる", "kanji-hiragana"],
    ["食べ物", "kanji-hiragana"],
    ["食堂", "kanji"],
    ["お茶", "kanji-hiragana"],
    ["ひらがな", "hiragana"],
    ["カタカナ", "katakana"],
    ["ひらがなカタカナ", "hiragana-katakana"],
    ["コンピューター", "katakana"],
    ["食々", "kanji"],
    ["１２３！", "other"],
    ["abc食", "other"],
    ["", "other"],
  ])
  for (const [value, expected] of cases) assert.equal(writingType(value), expected, value)
})

test("dictionary pagination bounds combined result pages and clamps filtered pages", () => {
  const { pagination } = require("../src/pagination.ts")
  assert.deepEqual(pagination(0, 99), { page: 1, pages: 1, start: 0, end: 0, numbers: [1] })
  assert.equal(pagination(51, 1).end, 50)
  assert.equal(pagination(51, 2).start, 50)
  assert.equal(pagination(51, 2).end, 51)
  assert.equal(pagination(20, 10).page, 1)
  assert.equal(pagination(2119, 43).end, 2119)
  assert.ok(pagination(2119, 20).numbers.length <= 7)
  const dictionary = fs.readFileSync("src/Dictionary.tsx", "utf8")
  assert.ok(!dictionary.includes("Show more results"))
  assert.ok(dictionary.includes("results.slice(paging.start, paging.end)"))
})

test("bundled KanjiVG kanji paths are licensed, ordered and match original source hashes", () => {
  const crypto = require("node:crypto")
  const snapshot = require("../src/writing/kanji-strokes.json")
  assert.equal(snapshot.source.version, model.strokeSource.version)
  assert.equal(snapshot.source.license, "CC BY-SA 3.0")
  for (const entry of kanjiEntries) {
    const glyph = snapshot.glyphs[entry.japanese]
    if (!glyph) { assert.ok(snapshot.missing.includes(entry.japanese)); continue }
    assert.ok(glyph.paths.length > 0)
    assert.ok(glyph.paths.every(path => /^[Mm]/.test(path.d) && path.label.length === 2 && path.label.every(Number.isFinite)))
    const code = entry.japanese.codePointAt(0).toString(16).padStart(5, "0")
    const original = fs.readFileSync(`public/writing/kanjivg/${code}.svg`, "utf8")
    assert.equal(crypto.createHash("sha256").update(original).digest("hex"), glyph.sha256)
    const orders = [...original.matchAll(/<path\s+[^>]*\bid="[^"\n]*-s(\d+)"/g)].map(match => Number(match[1]))
    assert.deepEqual(orders, glyph.paths.map((_, index) => index + 1))
  }
  assert.equal(snapshot.glyphs["水"].paths.length, 4)
  assert.equal(snapshot.glyphs["食"].paths.length, 9)
})

test("real stroke geometry covers every kana; navigation keeps script and group", () => {
  for (const entry of kanaEntries) {
    assert.equal(model.kanaCharacter(entry.id).id, entry.id)
    const paths = model.strokeGeometry(entry)
    assert.ok(paths.length > 0, entry.japanese)
    assert.ok(paths.every(path => path.d.startsWith("M") || path.d.startsWith("m")))
    assert.ok(model.characterSequence(entry).every(other => other.kind === entry.kind && other.group === entry.group))
  }
  assert.equal(model.kanaCharacter(kanjiEntries[0].id), undefined)
  assert.equal(model.kanaCharacter("missing"), undefined)
  assert.deepEqual(model.strokeGeometry({ japanese: "不存在" }), [])
  assert.equal(model.strokeSource.license, "CC BY-SA 3.0")
  assert.match(model.strokeSource.version, /^[0-9a-f]{40}$/)
})
test("one board keeps pen strokes separate from guidance and supports undo/redo/clear", () => {
  const stroke = { d: model.curvePath([{ x: 1, y: 1 }, { x: 20, y: 22 }, { x: 40, y: 39 }]), width: 2 }
  assert.match(stroke.d, /Q/)
  let drawing = model.drawingReducer(model.emptyDrawing, { type: "add", stroke })
  drawing = model.drawingReducer(drawing, { type: "undo" })
  assert.equal(drawing.strokes.length, 0)
  drawing = model.drawingReducer(drawing, { type: "redo" })
  assert.deepEqual(drawing.strokes, [stroke])
  assert.deepEqual(model.drawingReducer(drawing, { type: "clear" }), model.emptyDrawing)
  drawing = model.drawingReducer(drawing, { type: "undo" })
  assert.equal(model.drawingReducer(drawing, { type: "add", stroke }).redo.length, 0)
  assert.deepEqual(model.clampPoint({ x: -1, y: 120 }), { x: 0, y: 109 })
  assert.ok(model.stabilizePoint({ x: 0, y: 0 }, { x: 10, y: 10 }, "High").x < 10)
})
test("writing preferences validate safely without changing legacy backup contract", () => {
  const storage = new Map()
  global.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }
  const engine = require("../src/learning.ts")
  engine.updateState({ onboarded: true })
  const backup = JSON.parse(storage.get("manabu-learning-v1"))
  delete backup.preferences.writing
  assert.deepEqual(engine.validateBackup(backup).preferences.writing, defaultWritingSettings)
  backup.preferences.writingMode = "Write"
  assert.equal(engine.validateBackup(backup).preferences.writingMode, "Write")
  backup.preferences.writingMode = "invalid"
  assert.throws(() => engine.validateBackup(backup))
  backup.preferences.writingMode = "Study"
  backup.preferences.writing = { ...defaultWritingSettings, thickness: NaN }
  assert.throws(() => engine.validateBackup(backup))
  assert.equal(validWritingSettings({ ...defaultWritingSettings, speed: "Extreme" }), false)
  const routes = require("../src/navigation.ts")
  assert.equal(routes.isKnownRoute("/writing-system/character/missing"), true)
  assert.equal(routes.isKnownRoute("/writing-system/character/id/extra"), false)
})
