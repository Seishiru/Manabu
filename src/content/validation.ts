import type { DictionaryDatabase, ContentEntry } from "./model.ts"

const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text)
const date = (value: unknown) => text(value) && !Number.isNaN(Date.parse(value))
const levels = ["N5", "N4", "N3", "N2", "N1", "Unclassified"]
export function validateDistribution(database: DictionaryDatabase): DictionaryDatabase {
  validateDictionary(database)
  const unapproved = database.sources.filter(source => !text(source.license) || source.redistribution !== true)
  if (unapproved.length) throw new Error(`Public distribution is blocked: confirm the licence and redistribution permission for ${unapproved.map(source => source.name).join(", ")}. No permissions have been inferred.`)
  if (database.entries.some(entry => entry.reviewStatus === "needs-review") || database.conflicts.some(conflict => conflict.resolution === "manual-review")) throw new Error("Public distribution requires resolution of all content review records")
  return database
}
export function validateDictionary(database: DictionaryDatabase): DictionaryDatabase {
  if (!database || database.schemaVersion !== 1 || !text(database.version) || !date(database.updatedAt) || !Array.isArray(database.sources) || !Array.isArray(database.entries) || !Array.isArray(database.conflicts) || !strings(database.retiredIds)) throw new Error("Invalid dictionary manifest")
  const sources = new Set<string>()
  for (const source of database.sources) {
    if (!source || sources.has(source.id) || !text(source.id) || !text(source.name) || !text(source.version) || !text(source.attribution) || (source.license !== null && !text(source.license)) || source.permitted !== true) throw new Error("Source permission, version and attribution must be verified")
    sources.add(source.id)
  }
  const entries = new Map<string, ContentEntry>()
  const aliases = new Set<string>()
  for (const entry of database.entries) {
    if (!entry || !/^(jp_word|kanji|sentence|kana)_[a-z0-9_]+$/.test(entry.id) || entries.has(entry.id) || !["Words", "Kanji", "Sentences", "Hiragana", "Katakana"].includes(entry.kind) || !text(entry.japanese) || !text(entry.kana) || !text(entry.romaji) || !strings(entry.meanings) || !entry.meanings.length || !strings(entry.englishMeanings) || !strings(entry.tags) || !strings(entry.legacyIds) || !date(entry.updatedAt) || !["curated", "validated", "needs-review"].includes(entry.reviewStatus) || !entry.jlpt || !levels.includes(entry.jlpt.display) || !Array.isArray(entry.jlpt.classifications) || !Array.isArray(entry.provenance) || !entry.provenance.length) throw new Error(`Invalid entry: ${entry?.id}`)
    const namespace = entry.kind === "Words" ? "jp_word_" : entry.kind === "Kanji" ? "kanji_" : entry.kind === "Sentences" ? "sentence_" : "kana_"
    if (!entry.id.startsWith(namespace) || !entry.englishMeanings.length || [entry.frequency, entry.priority].some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) throw new Error(`Invalid entry classification: ${entry.id}`)
    for (const alias of entry.legacyIds) {
      if (aliases.has(alias)) throw new Error(`Duplicate legacy ID: ${alias}`)
      aliases.add(alias)
    }
    for (const classification of entry.jlpt.classifications) if (!levels.includes(classification.level) || !sources.has(classification.sourceId)) throw new Error(`Invalid JLPT metadata: ${entry.id}`)
    for (const provenance of entry.provenance) if (!sources.has(provenance.sourceId) || !text(provenance.sourceEntryId) || !text(provenance.sourceVersion) || provenance.sourceVersion !== database.sources.find(source => source.id === provenance.sourceId)?.version || !strings(provenance.fields) || !provenance.fields.length || !date(provenance.updatedAt)) throw new Error(`Invalid provenance: ${entry.id}`)
    entries.set(entry.id, entry)
  }
  const links = (id: string, values: unknown, kind?: string) => {
    if (!strings(values)) throw new Error(`Invalid relationships: ${id}`)
    for (const target of values) if (!entries.has(target) || (kind && entries.get(target)?.kind !== kind)) throw new Error(`Broken relationship: ${id} → ${target}`)
  }
  for (const entry of database.entries) {
    if (aliases.has(entry.id)) throw new Error(`Canonical ID overlaps an alias: ${entry.id}`)
    if (database.retiredIds.includes(entry.id)) throw new Error(`Retired ID was reused: ${entry.id}`)
    if (entry.kind === "Words") {
      if (!strings(entry.partsOfSpeech)) throw new Error(`Invalid parts of speech: ${entry.id}`)
      if (entry.spellings && entry.spellings.some(spelling => !text(spelling.text) || !strings(spelling.information) || !strings(spelling.priorityTags))) throw new Error(`Invalid spellings: ${entry.id}`)
      if (entry.kanaReadings && entry.kanaReadings.some(reading => !text(reading.kana) || !text(reading.romaji) || !strings(reading.spellingRestrictions) || typeof reading.noKanji !== "boolean" || !strings(reading.information) || !strings(reading.priorityTags) || reading.spellingRestrictions.some(spelling => !entry.spellings?.some(candidate => candidate.text === spelling)))) throw new Error(`Invalid vocabulary readings: ${entry.id}`)
      if (entry.senses && entry.senses.some(sense => !Number.isInteger(sense.sourceOrder) || !strings(sense.meanings) || !strings(sense.partsOfSpeech) || !strings(sense.spellingRestrictions) || !strings(sense.readingRestrictions) || !strings(sense.information) || !strings(sense.fields) || !strings(sense.dialects) || !strings(sense.crossReferences) || !strings(sense.antonyms) || sense.readingRestrictions.some(reading => !entry.kanaReadings?.some(candidate => candidate.kana === reading)) || sense.spellingRestrictions.some(spelling => !entry.spellings?.some(candidate => candidate.text === spelling)))) throw new Error(`Invalid lexical senses: ${entry.id}`)
      links(entry.id, entry.kanjiIds, "Kanji"); links(entry.id, entry.exampleIds, "Sentences"); links(entry.id, entry.relatedWordIds, "Words")
    } else if (entry.kind === "Kanji") {
      if (entry.grade !== undefined && (!Number.isInteger(entry.grade) || entry.grade < 1)) throw new Error(`Invalid school grade: ${entry.id}`)
      if (!text(entry.radical) || !Number.isInteger(entry.strokeCount) || entry.strokeCount < 1 || !Array.isArray(entry.onReadings) || !Array.isArray(entry.kunReadings) || [...entry.onReadings, ...entry.kunReadings].some(reading => !text(reading.kana) || !text(reading.romaji))) throw new Error(`Invalid kanji metadata: ${entry.id}`)
      links(entry.id, entry.wordIds, "Words")
    } else if (entry.kind === "Sentences") {
      if (!text(entry.translation) || !strings(entry.grammarTags) || (entry.tokens && (!strings(entry.tokens) || entry.tokens.join("") !== entry.japanese))) throw new Error(`Invalid sentence: ${entry.id}`)
      links(entry.id, entry.wordIds, "Words"); links(entry.id, entry.kanjiIds, "Kanji")
    } else {
      if (!["Basic", "Dakuon", "Handakuon", "Yoon"].includes(entry.group)) throw new Error(`Invalid kana group: ${entry.id}`)
      links(entry.id, [entry.counterpartId], entry.kind === "Hiragana" ? "Katakana" : "Hiragana")
    }
  }
  for (const conflict of database.conflicts) if (!entries.has(conflict.entryId) || !text(conflict.field) || !["preferred-source", "manual-review"].includes(conflict.resolution) || !Array.isArray(conflict.candidates) || conflict.candidates.some(candidate => !sources.has(candidate.sourceId))) throw new Error("Invalid conflict record")
  return database
}
