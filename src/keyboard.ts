import { kanaToRomaji, toKanaScript } from "./content/romaji"
import { contentEntryById, searchContent } from "./content/catalog"
import { normalizeSearch } from "./content/search"
import type { ContentEntry } from "./content/model"
import type { Vocabulary } from "./content/model"

export type Script = "Hiragana" | "Katakana"
export const keyboardRows = ["あいうえお", "かきくけこ", "さしすせそ", "たちつてと", "なにぬねの", "はひふへほ", "まみむめも", "やゆよ", "らりるれろ", "わをん", "がぎぐげご", "ざじずぜぞ", "だぢづでど", "ばびぶべぼ", "ぱぴぷぺぽ"]
export const toScript = toKanaScript
const syllables = new Map<string, string>()
for (const character of keyboardRows.join("") + "ゔ") {
  const romaji = kanaToRomaji(character)
  if (!syllables.has(romaji)) syllables.set(romaji, character)
}
for (const base of "きぎしじちにひびぴみり") for (const small of "ゃゅょ") syllables.set(kanaToRomaji(base + small), base + small)
for (const pair of ["うぃ", "うぇ", "うぉ", "しぇ", "じぇ", "ちぇ", "てぃ", "でぃ", "とぅ", "どぅ", "てゅ", "でゅ", "ふぁ", "ふぃ", "ふぇ", "ふぉ", "ふゅ", "ゔぁ", "ゔぃ", "ゔぇ", "ゔぉ", "つぁ", "つぃ", "つぇ", "つぉ", "くぁ", "くぃ", "くぇ", "くぉ", "ぐぁ", "ぐぃ", "ぐぇ", "ぐぉ"]) {
  const romaji = kanaToRomaji(pair)
  if (!syllables.has(romaji)) syllables.set(romaji, pair)
}
for (const [romaji, kana] of Object.entries({ si: "し", ti: "ち", tu: "つ", hu: "ふ", zi: "じ", di: "ぢ", du: "づ", wo: "を", sya: "しゃ", syu: "しゅ", syo: "しょ", tya: "ちゃ", tyu: "ちゅ", tyo: "ちょ", cya: "ちゃ", cyu: "ちゅ", cyo: "ちょ", jya: "じゃ", jyu: "じゅ", jyo: "じょ", zya: "じゃ", zyu: "じゅ", zyo: "じょ", dya: "ぢゃ", dyu: "ぢゅ", dyo: "ぢょ", xtsu: "っ", ltsu: "っ", xtu: "っ", ltu: "っ" })) syllables.set(romaji, kana)
for (const [romaji, kana] of Object.entries({ a: "ぁ", i: "ぃ", u: "ぅ", e: "ぇ", o: "ぉ", ya: "ゃ", yu: "ゅ", yo: "ょ", wa: "ゎ", ka: "ゕ", ke: "ゖ" })) for (const prefix of ["x", "l"]) syllables.set(prefix + romaji, kana)
const prefixes = new Set([...syllables.keys()].flatMap(key => Array.from({ length: key.length }, (_, index) => key.slice(0, index + 1))))

export function romajiToKana(input: string, script: Script = "Hiragana", finalize = false) {
  let output = ""
  let index = 0
  const text = input.normalize("NFKC").replace(/[’′]/g, "'")
  while (index < text.length) {
    const rest = text.slice(index).toLowerCase()
    if (rest.startsWith("n'")) { output += "ん"; index += 2; continue }
    if (rest[0] === "n" && (rest[1] === "n" || rest[1] && !/[aeiouy]/.test(rest[1]) || finalize && rest.length === 1)) {
      output += "ん"; index += rest === "nn" ? 2 : 1; continue
    }
    if (/^([bcdfghjklmpqrstvwxyz])\1/.test(rest) || rest.startsWith("tch")) { output += "っ"; index++; continue }
    const match = [...Array(Math.min(4, rest.length))].map((_, offset) => rest.slice(0, Math.min(4, rest.length) - offset)).find(part => syllables.has(part) && part !== "n")
    if (match) { output += syllables.get(match); index += match.length; continue }
    if (!finalize && prefixes.has(rest)) { output += rest; break }
    output += ({ ".": "。", ",": "、", "-": "ー" } as Record<string, string>)[text[index]] || text[index]
    index++
  }
  return toScript(output, script)
}

export function convertEdit(previous: string, next: string, cursor: number, script: Script, pendingN = false) {
  let start = 0
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++
  if (next.length <= previous.length && cursor <= start) return { text: next, cursor, pendingN: false }
  while (start > 0 && /[a-z']/i.test(next[start - 1])) start--
  const fragment = next.slice(start, cursor)
  const source = pendingN && /^[aeiouy]/i.test(fragment) ? "n" + fragment : fragment
  const converted = romajiToKana(source, script)
  return { text: next.slice(0, start) + converted + next.slice(cursor), cursor: start + converted.length, pendingN: source.toLowerCase() === "nn" }
}

export type Candidate = {
  entry: ContentEntry
  start: number
  end: number
  kana: string
  romaji: string
  spelling: string
  score: number
}
export function deleteSelection(text: string, start: number, end: number) {
  let from = start
  if (start === end && start > 0) {
    if (typeof Intl.Segmenter === "function") {
      const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text.slice(0, start))
      for (const segment of segments) from = segment.index
    } else {
      const characters = [...text.slice(0, start)]
      let offset = 0
      let previous = ""
      let regionalCount = 0
      for (const character of characters) {
        const regional = /\p{Regional_Indicator}/u.test(character)
        const attached = offset > 0 && (/[\p{M}\p{Emoji_Modifier}\u200D\uFE0E\uFE0F\u{E0020}-\u{E007F}]/u.test(character) || previous === "\u200D" || character === "\n" && previous === "\r" || regional && regionalCount % 2 === 1)
        if (!attached) from = offset
        regionalCount = regional ? regionalCount + 1 : 0
        offset += character.length
        previous = character
      }
    }
  }
  return { text: text.slice(0, from) + text.slice(end), cursor: from }
}
export function keyboardCandidates(text: string, cursor: number, boundary = 0, literal = false): Candidate[] {
  const prefix = text.slice(Math.min(boundary, cursor), cursor)
  const run = (prefix.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Latin}ー']+$/iu)?.[0] || "").slice(-64)
  if (!run) return []
  const offset = cursor - run.length
  const candidates = new Map<string, Candidate>()
  for (let suffix = 0; suffix < Math.min(run.length, 12); suffix++) {
    if (suffix && (!"をにはがでとへも".includes(run[suffix - 1]) || run.length - suffix < 2)) continue
    const query = literal ? run.slice(suffix) : run.slice(suffix).replace(/[a-z']+$/i, "")
    if (!query) continue
    const normalized = normalizeSearch(query)
    for (const id of searchContent(query)) {
      const entry = contentEntryById(id)!
      if (entry.kind !== "Words" && entry.kind !== "Kanji") continue
      const readings: { kana: string; romaji: string; spellingRestrictions?: string[]; noKanji?: boolean }[] = entry.kind === "Words" ? entry.kanaReadings?.length ? entry.kanaReadings : [{ kana: entry.kana, romaji: entry.romaji, spellingRestrictions: [] }] : [...entry.onReadings, ...entry.kunReadings]
      const reading = readings.find(value => normalizeSearch(value.kana.replace(/[.\-]/g, "")) === normalized || normalizeSearch(value.romaji) === normalized) || readings.find(value => normalizeSearch(value.kana).startsWith(normalized)) || readings[0]
      const exact = readings.some(value => normalizeSearch(value.kana.replace(/[.\-]/g, "")) === normalized)
      if (suffix && !exact) continue
      const okurigana = entry.kind === "Kanji" && exact && reading?.kana.includes(".") ? reading.kana.split(".")[1] : ""
      const spelling = entry.kind === "Words" && reading?.noKanji ? reading.kana : entry.kind === "Words" && reading?.spellingRestrictions?.length ? reading.spellingRestrictions[0] : entry.japanese + okurigana
      const score = (exact ? 0 : readings.some(value => normalizeSearch(value.romaji) === normalized) ? 0.1 : normalizeSearch(entry.japanese) === normalized ? 1 : readings.some(value => normalizeSearch(value.kana).startsWith(normalized)) ? 2 : 3) + suffix * 0.1
      const existing = candidates.get(id)
      if (!existing || existing.score > score) candidates.set(id, { entry, start: offset + suffix, end: cursor, kana: reading?.kana.replace(/[.\-]/g, "") || entry.kana, romaji: reading?.romaji || entry.romaji, spelling, score })
    }
  }
  return [...candidates.values()].sort((first, second) => first.score - second.score || first.entry.id.localeCompare(second.entry.id)).slice(0, 12)
}

export async function dictionaryKeyboardCandidates(text: string, cursor: number, boundary = 0, literal = false): Promise<Candidate[]> {
  const { searchDictionary } = await import("./content/dictionarySearch")
  const prefix = text.slice(Math.min(boundary, cursor), cursor)
  const run = (prefix.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Latin}ー']+$/iu)?.[0] || "").slice(-64)
  if (!run) return []
  const offset = cursor - run.length
  const queries = Array.from({ length: Math.min(run.length, 12) }, (_, suffix) => {
    if (suffix && (!"をにはがでとへも".includes(run[suffix - 1]) || run.length - suffix < 2)) return null
    return { suffix, query: literal ? run.slice(suffix) : run.slice(suffix).replace(/[a-z']+$/i, "") }
  }).filter((item, index, values): item is { suffix: number; query: string } => !!item && !!item.query && values.findIndex(value => value?.query === item.query) === index)
  const candidates = new Map<string, Candidate>()
  const results = await Promise.all(queries.map(async item => ({ ...item, entries: await searchDictionary(item.query, 50) })))
  for (const { query, suffix, entries } of results) {
    const normalized = normalizeSearch(query)
    for (const entry of entriesForKeyboard(entries)) {
      const readings: { kana: string; romaji: string; spellingRestrictions?: string[]; noKanji?: boolean }[] = entry.kanaReadings?.length ? entry.kanaReadings : [{ kana: entry.kana, romaji: entry.romaji, spellingRestrictions: [] }]
      const reading = readings.find(value => normalizeSearch(value.kana.replace(/[.\-]/g, "")) === normalized || normalizeSearch(value.romaji) === normalized) || readings.find(value => normalizeSearch(value.kana).startsWith(normalized)) || readings[0]
      const exact = readings.some(value => normalizeSearch(value.kana.replace(/[.\-]/g, "")) === normalized)
      if (suffix && !exact) continue
      const okurigana = exact && reading?.kana.includes(".") ? reading.kana.split(".")[1] : ""
      const spelling = reading?.noKanji ? reading.kana : reading?.spellingRestrictions?.length ? reading.spellingRestrictions[0] : entry.japanese + okurigana
      const score = (exact ? 0 : readings.some(value => normalizeSearch(value.romaji) === normalized) ? 0.1 : normalizeSearch(entry.japanese) === normalized ? 1 : readings.some(value => normalizeSearch(value.kana).startsWith(normalized)) ? 2 : 3) + suffix * 0.1
      const candidate = { entry, start: offset + suffix, end: cursor, kana: reading?.kana.replace(/[.\-]/g, "") || entry.kana, romaji: reading?.romaji || entry.romaji, spelling, score }
      const existing = candidates.get(entry.id)
      if (!existing || existing.score > score) candidates.set(entry.id, candidate)
    }
  }
  return [...candidates.values()].sort((first, second) => first.score - second.score || first.entry.id.localeCompare(second.entry.id)).slice(0, 12)
}

function entriesForKeyboard(entries: Vocabulary[]) {
  return entries.filter(entry => entry.kind === "Words")
}
