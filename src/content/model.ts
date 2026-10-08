export type ContentKind =
  | "Words"
  | "Kanji"
  | "Sentences"
  | "Hiragana"
  | "Katakana"
  | "Hiragana word"
  | "Katakana word"
  | "Kanji word"
  | "Basics"
  | "Dakuon"
  | "Handakuon"
  | "Yoon"
  | "All"
  | "Randomize"
export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1" | "Unclassified"
import type { WritingType } from "./writingType"
export type PracticeItem = {
  id: string
  kind: ContentKind
  japanese: string
  reading: string
  romaji: string
  meanings: string[]
  level: string
  readings?: string[]
  tokens?: string[]
  group?: "Basic" | "Dakuon" | "Handakuon" | "Yoon"
  sentence?: string
  sentenceReading?: string
  sentenceRomaji?: string
}
export type Source = {
  role?: string
  redistribution?: boolean
  licenseUrl?: string
  sha256?: string
  retrievedAt?: string
  id: string
  name: string
  version: string
  attribution: string
  license: string | null
  url?: string
  permitted: boolean
}
export type Provenance = {
  derivation?: string
  sourceId: string
  sourceEntryId: string
  sourceVersion: string
  fields: string[]
  updatedAt: string
}
export type Classification = {
  level: JLPTLevel
  sourceId: string
  note?: string
}
export type ContentBase = {
  id: string
  legacyIds: string[]
  japanese: string
  kana: string
  romaji: string
  meanings: string[]
  englishMeanings: string[]
  japaneseMeanings?: string[]
  jlpt: { display: JLPTLevel; classifications: Classification[] }
  tags: string[]
  priority?: number
  frequency?: number
  provenance: Provenance[]
  reviewStatus: "curated" | "validated" | "needs-review"
  updatedAt: string
  media?: { type: "image" | "audio"; path: string; attribution: string }[]
  writingType?: WritingType
}
export type Vocabulary = ContentBase & {
  spellings?: { text: string; information: string[]; priorityTags: string[] }[]
  kanaReadings?: { kana: string; romaji: string; spellingRestrictions: string[]; noKanji: boolean; information: string[]; priorityTags: string[] }[]
  senses?: { sourceOrder: number; meanings: string[]; partsOfSpeech: string[]; spellingRestrictions: string[]; readingRestrictions: string[]; information: string[]; fields: string[]; dialects: string[]; crossReferences: string[]; antonyms: string[] }[]
  kind: "Words"
  partsOfSpeech: string[]
  kanjiIds: string[]
  exampleIds: string[]
  relatedWordIds: string[]
}
export type KanjiEntry = ContentBase & {
  radicalNumber?: number
  strokeCounts?: number[]
  legacyJLPT?: number
  nameReadings?: string[]
  kind: "Kanji"
  onReadings: { kana: string; romaji: string }[]
  kunReadings: { kana: string; romaji: string }[]
  radical: string
  strokeCount: number
  grade?: number
  wordIds: string[]
}
export type SentenceEntry = ContentBase & {
  kind: "Sentences"
  translation: string
  wordIds: string[]
  kanjiIds: string[]
  grammarTags: string[]
  tokens?: string[]
}
export type KanaEntry = ContentBase & {
  kind: "Hiragana" | "Katakana"
  group: "Basic" | "Dakuon" | "Handakuon" | "Yoon"
  counterpartId: string
}
export type ContentEntry = Vocabulary | KanjiEntry | SentenceEntry | KanaEntry
export type ContentConflict = {
  entryId: string
  field: string
  candidates: { sourceId: string; value: unknown }[]
  resolution: "preferred-source" | "manual-review"
}
export type DictionaryDatabase = {
  schemaVersion: 1
  version: string
  updatedAt: string
  sources: Source[]
  entries: ContentEntry[]
  conflicts: ContentConflict[]
  retiredIds: string[]
}
