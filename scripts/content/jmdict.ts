import { list, text, parseXML } from "./xml.ts"
import { kanaToRomaji } from "./romaji.ts"
import { resolveIdentity, type IdentityRegistry } from "./registry.ts"
import type { Source, Vocabulary } from "../../src/content/model.ts"
import { writingType } from "../../src/content/writingType.ts"

export function readJMdict(xml: string): any[] {
  return list(parseXML(xml).JMdict?.entry)
}
export function adaptJMdict(raw: any, source: Source, registry: IdentityRegistry, updatedAt: string): Vocabulary {
  const sourceEntryId = text(raw.ent_seq)
  const mapping = resolveIdentity(registry, source.id, sourceEntryId)
  const spellings = list<any>(raw.k_ele).map(entry => ({ text: text(entry.keb), information: list(entry.ke_inf).map(text), priorityTags: list(entry.ke_pri).map(text) }))
  const kanaReadings = list<any>(raw.r_ele).map(entry => ({ kana: text(entry.reb), romaji: kanaToRomaji(text(entry.reb)), spellingRestrictions: list(entry.re_restr).map(text), noKanji: entry.re_nokanji !== undefined, information: list(entry.re_inf).map(text), priorityTags: list(entry.re_pri).map(text) }))
  const japanese = mapping.primarySpelling || spellings[0]?.text || kanaReadings[0]?.kana
  const applicable = kanaReadings.filter(reading => spellings.some(spelling => spelling.text === japanese) ? !reading.noKanji && (!reading.spellingRestrictions.length || reading.spellingRestrictions.includes(japanese)) : reading.kana === japanese)
  const primary = applicable.find(reading => reading.kana === mapping.primaryReading) || applicable[0]
  if (!primary || (mapping.primaryReading && primary.kana !== mapping.primaryReading) || ![...spellings.map(entry => entry.text), ...kanaReadings.map(entry => entry.kana)].includes(japanese)) throw new Error(`Reviewed display form no longer resolves: ${sourceEntryId}`)
  let inheritedParts: string[] = []
  const senses = list<any>(raw.sense).map((sense, sourceOrder) => {
    if (sense.pos) inheritedParts = list(sense.pos).map(text)
    return { sourceOrder, meanings: list<any>(sense.gloss).filter(gloss => typeof gloss === "string" || !gloss["@_xml:lang"] || gloss["@_xml:lang"] === "eng").map(text), partsOfSpeech: [...inheritedParts], spellingRestrictions: list(sense.stagk).map(text), readingRestrictions: list(sense.stagr).map(text), information: [...list(sense.misc), ...list(sense.s_inf)].map(text), fields: list(sense.field).map(text), dialects: list(sense.dial).map(text), crossReferences: list(sense.xref).map(text), antonyms: list(sense.ant).map(text) }
  }).filter(sense => sense.meanings.length)
  const displayedSenses = senses.filter(sense => (!sense.spellingRestrictions.length || sense.spellingRestrictions.includes(japanese)) && (!sense.readingRestrictions.length || sense.readingRestrictions.includes(primary.kana)))
  const meanings = [...new Set(displayedSenses.flatMap(sense => sense.meanings))]
  if (!meanings.length) throw new Error(`No English sense for selected form: ${sourceEntryId}`)
  const entry: Vocabulary = { id: mapping.id, legacyIds: mapping.legacyIds, kind: "Words", japanese, kana: primary.kana, romaji: primary.romaji, meanings, englishMeanings: meanings, jlpt: { display: "Unclassified", classifications: [] }, tags: [...new Set([...spellings, ...kanaReadings].flatMap(entry => entry.priorityTags))], spellings, kanaReadings, senses, partsOfSpeech: [...new Set(displayedSenses.flatMap(sense => sense.partsOfSpeech))], kanjiIds: [], exampleIds: [], relatedWordIds: [], updatedAt, reviewStatus: "validated", provenance: [] }
  entry.writingType = writingType(japanese)
  entry.provenance = [{ sourceId: source.id, sourceEntryId, sourceVersion: source.version, updatedAt, derivation: "Romaji derived deterministically from source kana with Manabu modified Hepburn; source kana and restrictions preserved.", fields: Object.keys(entry).filter(field => !["id", "legacyIds", "provenance", "reviewStatus"].includes(field)) }]
  return entry
}
