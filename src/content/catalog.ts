import bundled from "./bundled.json"
import { validateDictionary } from "./validation"
import { createContentSearch } from "./search"
import { toKanaScript } from "./romaji"
export { normalizeSearch } from "./search"
import type { ContentEntry, DictionaryDatabase, KanaEntry, KanjiEntry, PracticeItem, SentenceEntry, Vocabulary } from "./model"

export const dictionary = validateDictionary(bundled as DictionaryDatabase)
export const toKatakana = (text: string) => toKanaScript(text, "Katakana")
export const contentById = new Map(dictionary.entries.map(entry => [entry.id, entry]))
export const canonicalIds = new Map(dictionary.entries.flatMap(entry => [[entry.id, entry.id], ...entry.legacyIds.map(alias => [alias, entry.id])] as [string, string][]))
export const contentEntryById = (id: string) => contentById.get(canonicalIds.get(id) || id)
export const learningId = (entry: ContentEntry) => entry.legacyIds[0] || entry.id
export const vocabulary = dictionary.entries.filter((entry): entry is Vocabulary => entry.kind === "Words")
export const kanjiEntries = dictionary.entries.filter((entry): entry is KanjiEntry => entry.kind === "Kanji")
export const kanaEntries = dictionary.entries.filter((entry): entry is KanaEntry => entry.kind === "Hiragana" || entry.kind === "Katakana")
export const sentenceEntries = dictionary.entries.filter((entry): entry is SentenceEntry => entry.kind === "Sentences")
export const dictionaryInfo = {
  version: dictionary.version,
  updatedAt: dictionary.updatedAt,
  words: vocabulary.length,
  kanji: kanjiEntries.length,
  sentences: sentenceEntries.length,
  practiceSentences: sentenceEntries.filter(entry => entry.tokens?.length).length,
  hiragana: dictionary.entries.filter(entry => entry.kind === "Hiragana").length,
  katakana: dictionary.entries.filter(entry => entry.kind === "Katakana").length,
  sources: dictionary.sources,
}
export type Word = PracticeItem & {
  type: string
  sentence: string
  translation: string
  sentenceRomaji: string
}
export const practiceItems: PracticeItem[] = dictionary.entries.map(entry => ({
  id: learningId(entry), kind: entry.kind, japanese: entry.japanese, reading: entry.kana,
  romaji: entry.romaji, meanings: entry.englishMeanings,
  level: entry.kind === "Hiragana" || entry.kind === "Katakana" ? "" : entry.jlpt.display,
  ...(entry.kind === "Words" && entry.kanaReadings ? { readings: [...new Set([entry.romaji, ...entry.kanaReadings.filter(reading => !reading.noKanji && (!reading.spellingRestrictions.length || reading.spellingRestrictions.includes(entry.japanese))).map(reading => reading.romaji)])] } : {}),
  ...(entry.kind === "Kanji" ? { readings: [...entry.onReadings, ...entry.kunReadings].map(reading => reading.romaji) } : {}),
  ...(entry.kind === "Sentences" && entry.tokens ? { tokens: entry.tokens } : {}),
}))
const practiceIndex = new Map(practiceItems.map(item => [item.id, item]))
const dictionaryPracticeIndex = new Map<string, PracticeItem>()
export const registerDictionaryPracticeItems = (entries: PracticeItem[]) => {
  for (const entry of entries) if (!practiceIndex.has(entry.id)) dictionaryPracticeIndex.set(entry.id, entry)
}
export const practiceItemById = (id: string) => {
  const entry = contentEntryById(id)
  return practiceIndex.get(entry ? learningId(entry) : id) || dictionaryPracticeIndex.get(id)
}
const toWord = (entry: Vocabulary | SentenceEntry): Word => {
  const example = entry.kind === "Words" ? contentById.get(entry.exampleIds[0]) : entry
  return { ...practiceIndex.get(learningId(entry))!, type: entry.kind === "Words" ? entry.partsOfSpeech.join(" · ") : "Sentence",
    sentence: example?.japanese || "", sentenceRomaji: example?.romaji || "",
    translation: example?.englishMeanings[0] || "" }
}
export const words = vocabulary.map(toWord)
export const sentences = sentenceEntries.map(toWord)
const sentenceIndex = new Map(sentences.map(sentence => [contentEntryById(sentence.id)!.id, sentence]))
export function examplesFor(id: string): Word[] {
  const entry = contentEntryById(id)
  return entry?.kind === "Words" ? entry.exampleIds.map(id => sentenceIndex.get(id)).filter((sentence): sentence is Word => !!sentence) : []
}
const readingLabel = (readings: KanjiEntry["onReadings"]) => readings.map(reading => `${reading.kana} · ${reading.romaji}`).join(" / ")
export const kanji = kanjiEntries.map(entry => ({
  id: learningId(entry), character: entry.japanese, meanings: entry.englishMeanings,
  on: readingLabel(entry.onReadings), kun: readingLabel(entry.kunReadings),
  level: entry.jlpt.display, radical: entry.radical, strokes: entry.strokeCount, grade: entry.grade,
}))
export const searchContent = createContentSearch(dictionary.entries)
export function relatedWords(id: string): Word[] {
  const entry = contentEntryById(id)
  const ids = entry?.kind === "Kanji" || entry?.kind === "Sentences" ? entry.wordIds : entry?.kind === "Words" ? entry.relatedWordIds : []
  return ids.map(id => contentById.get(id)).filter((entry): entry is Vocabulary => entry?.kind === "Words").map(toWord)
}
