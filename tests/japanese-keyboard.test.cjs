const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
const { romajiToKana, convertEdit, deleteSelection, keyboardCandidates, toScript } = require("../src/keyboard.ts")
const { practiceItemById, contentEntryById } = require("../src/content/catalog.ts")

test("romaji composition supports variants, small kana, gemination and nasal boundaries", () => {
  for (const [input, expected] of Object.entries({ mizu: "みず", miz: "みz", shi: "し", si: "し", chi: "ち", ti: "ち", tsu: "つ", tu: "つ", fu: "ふ", hu: "ふ", gakkou: "がっこう", matcha: "まっちゃ", shashin: "しゃしn", "kan'i": "かんい", kanni: "かんに", konnichiha: "こんにちは", n: "n", nn: "ん", nya: "にゃ", xya: "ゃ", xtsu: "っ", pa: "ぱ", fa: "ふぁ", "ko-hi-": "こーひー" })) assert.equal(romajiToKana(input), expected, input)
  assert.equal(romajiToKana("shashin", "Hiragana", true), "しゃしん")
  assert.equal(romajiToKana("mizu", "Katakana"), "ミズ")
  assert.equal(toScript("水みず。", "Katakana"), "水ミズ。")
  let typed = "", nasal = false
  for (const character of "konnichiha") {
    const result = convertEdit(typed, typed + character, typed.length + 1, "Hiragana", nasal)
    typed = result.text
    nasal = result.pendingN
  }
  assert.equal(typed, "こんにちは")
})

test("incremental typing and exact candidates compose 水を飲む without replacing committed text", () => {
  let text = "", cursor = 0
  const type = input => {
    for (const character of input) {
      const result = convertEdit(text, text.slice(0, cursor) + character + text.slice(cursor), cursor + 1, "Hiragana")
      text = result.text
      cursor = result.cursor
    }
  }
  type("mizu")
  assert.equal(text, "みず")
  const water = keyboardCandidates(text, cursor).find(candidate => candidate.spelling === "水")
  assert.ok(water)
  assert.equal(water.kana, "みず")
  assert.ok(water.entry.englishMeanings.some(meaning => meaning.includes("water")))
  assert.ok(practiceItemById(water.entry.id))
  text = text.slice(0, water.start) + water.spelling + text.slice(water.end)
  cursor = water.start + water.spelling.length
  const boundary = cursor
  type("wonomu")
  assert.equal(text, "水をのむ")
  const drink = keyboardCandidates(text, cursor, boundary).find(candidate => candidate.spelling === "飲む")
  assert.ok(drink)
  text = text.slice(0, drink.start) + drink.spelling + text.slice(drink.end)
  assert.equal(text, "水を飲む")
  assert.equal(convertEdit(text, "水をn飲む", 3, "Hiragana").text, "水をn飲む")
  assert.equal(convertEdit("みず", "み", 1, "Hiragana").text, "み")
})

test("bounded candidates use shared IDs and exact-reading ranking", () => {
  const candidates = keyboardCandidates("ミズ", 2)
  assert.ok(candidates.length <= 12)
  assert.equal(candidates[0].score, 0)
  for (const candidate of candidates) assert.equal(contentEntryById(candidate.entry.id), candidate.entry)
  assert.deepEqual(keyboardCandidates("", 0), [])
  assert.deepEqual(keyboardCandidates("水 ", 2), [])
  assert.ok(keyboardCandidates("みz", 2).length > 0)
  assert.deepEqual(keyboardCandidates("mizu", 4), [])
  assert.ok(keyboardCandidates("mizu", 4, 0, true).some(candidate => candidate.spelling === "水"))
})

test("deletion preserves Unicode and surrounding text; unfinished and very long input is safe", () => {
  assert.deepEqual(deleteSelection("水😀", 3, 3), { text: "水", cursor: 1 })
  assert.deepEqual(deleteSelection("水を飲む", 1, 2), { text: "水飲む", cursor: 1 })
  assert.deepEqual(deleteSelection("", 0, 0), { text: "", cursor: 0 })
  assert.equal(romajiToKana("n'"), "ん")
  assert.equal(romajiToKana("k"), "k")
  assert.equal(romajiToKana("ga"), "が")
  assert.equal(romajiToKana("pyo"), "ぴょ")
  assert.equal(romajiToKana("水😀mizu"), "水😀みず")
  assert.doesNotThrow(() => keyboardCandidates("あ".repeat(10000), 10000))
})

test("Backspace deletes complete kana, emoji families, modifiers and flags, including the fallback", () => {
  const segmenter = Intl.Segmenter
  for (const fallback of [false, true]) {
    try {
      if (fallback) Intl.Segmenter = undefined
      for (const cluster of ["か\u3099", "👨‍👩‍👧‍👦", "🇯🇵", "👍🏽", "❤️", "1️⃣", "e\u0301", "\r\n"]) {
        const text = "水" + cluster + "です"
        assert.deepEqual(deleteSelection(text, 1 + cluster.length, 1 + cluster.length), { text: "水です", cursor: 1 }, `${cluster} / fallback ${fallback}`)
      }
      assert.deepEqual(deleteSelection("\u3099", 1, 1), { text: "", cursor: 0 })
    } finally { Intl.Segmenter = segmenter }
  }
})
