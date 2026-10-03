export type WritingType =
  | "hiragana"
  | "katakana"
  | "kanji"
  | "kanji-hiragana"
  | "kanji-katakana"
  | "hiragana-katakana"
  | "mixed"
  | "other"

type WritingParts = { hiragana: boolean; katakana: boolean; kanji: boolean; other: boolean }

const isHiragana = (codePoint: number) => codePoint >= 0x3040 && codePoint <= 0x309f
const isKatakana = (codePoint: number) =>
  (codePoint >= 0x30a0 && codePoint <= 0x30ff) ||
  (codePoint >= 0x31f0 && codePoint <= 0x31ff) ||
  (codePoint >= 0x1b000 && codePoint <= 0x1b0ff)
const isKanji = (codePoint: number) =>
  (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
  (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
  (codePoint >= 0x20000 && codePoint <= 0x2fa1f)
const ignored = (codePoint: number) =>
  codePoint === 0x3005 ||
  codePoint === 0x30fc ||
  /\p{P}|\p{S}|\p{N}|\p{L}/u.test(String.fromCodePoint(codePoint)) === false

export function writingParts(value: string): WritingParts {
  const parts: WritingParts = { hiragana: false, katakana: false, kanji: false, other: false }
  for (const character of value) {
    const codePoint = character.codePointAt(0)!
    if (isHiragana(codePoint)) parts.hiragana = true
    else if (isKatakana(codePoint)) parts.katakana = true
    else if (isKanji(codePoint)) parts.kanji = true
    else if (!ignored(codePoint)) parts.other = true
  }

  return parts
}

export function writingSystems(value: string): ("Hiragana" | "Katakana" | "Kanji")[] {
  const parts = writingParts(value)
  return [
    parts.hiragana ? "Hiragana" : null,
    parts.katakana ? "Katakana" : null,
    parts.kanji ? "Kanji" : null,
  ].filter((value): value is "Hiragana" | "Katakana" | "Kanji" => value !== null)
}

export function writingType(value: string): WritingType {
  const parts = writingParts(value)
  const kinds = [parts.kanji, parts.hiragana, parts.katakana].filter(Boolean).length
  if (parts.other || !kinds) return "other"
  if (parts.kanji && parts.hiragana && parts.katakana) return "mixed"
  if (parts.kanji && parts.hiragana) return "kanji-hiragana"
  if (parts.kanji && parts.katakana) return "kanji-katakana"
  if (parts.hiragana && parts.katakana) return "hiragana-katakana"
  if (parts.kanji) return "kanji"
  if (parts.hiragana) return "hiragana"
  return "katakana"
}

export const writingTypeLabel = (type: WritingType) => ({
  hiragana: "Hiragana",
  katakana: "Katakana",
  kanji: "Kanji",
  "kanji-hiragana": "Kanji + Hiragana",
  "kanji-katakana": "Kanji + Katakana",
  "hiragana-katakana": "Hiragana + Katakana",
  mixed: "Mixed",
  other: "Other",
}[type])

export const writingTypeIsMixed = (type: WritingType) =>
  type === "mixed" ||
  type === "kanji-hiragana" ||
  type === "kanji-katakana" ||
  type === "hiragana-katakana"
