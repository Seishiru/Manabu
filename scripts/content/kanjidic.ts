import { list, text, parseXML } from "./xml.ts"
import { kanaToRomaji } from "./romaji.ts"
import { resolveIdentity, type IdentityRegistry } from "./registry.ts"
import type { Source, KanjiEntry } from "../../src/content/model.ts"

export function readKANJIDIC(xml: string): { header: any; characters: any[] } {
  const data = parseXML(xml).kanjidic2
  return { header: data?.header, characters: list(data?.character) }
}
export function kanjiSourceId(raw: any) {
  const unicode = list<any>(raw.codepoint?.cp_value).find(value => value["@_cp_type"] === "ucs")
  if (!unicode) throw new Error(`No source codepoint: ${raw.literal}`)
  return `ucs_${text(unicode).toLowerCase()}`
}
export function adaptKANJIDIC(raw: any, source: Source, registry: IdentityRegistry, updatedAt: string): KanjiEntry {
  const sourceEntryId = kanjiSourceId(raw), mapping = resolveIdentity(registry, source.id, sourceEntryId)
  const groups = list<any>(raw.reading_meaning?.rmgroup)
  const readings = groups.flatMap(group => list<any>(group.reading))
  const readingGroup = (type: string) => readings.filter(reading => reading["@_r_type"] === type).map(reading => ({ kana: text(reading), romaji: kanaToRomaji(text(reading)) }))
  const onReadings = readingGroup("ja_on"), kunReadings = readingGroup("ja_kun")
  const primary = onReadings[0] || kunReadings[0]
  const meanings = groups.flatMap(group => list<any>(group.meaning).filter(meaning => typeof meaning === "string" || !meaning["@_m_lang"]).map(text))
  const radical = list<any>(raw.radical?.rad_value).find(value => value["@_rad_type"] === "classical")
  const strokeCounts = list(raw.misc?.stroke_count).map(value => Number(text(value)))
  if (!primary || !meanings.length || !radical || !strokeCounts.length) throw new Error(`Incomplete kanji: ${sourceEntryId}`)
  const entry: KanjiEntry = { id: mapping.id, legacyIds: mapping.legacyIds, kind: "Kanji", japanese: text(raw.literal), kana: primary.kana, romaji: primary.romaji, meanings, englishMeanings: meanings, onReadings, kunReadings, radical: text(radical), radicalNumber: Number(text(radical)), strokeCount: strokeCounts[0], strokeCounts, ...(raw.misc?.grade ? { grade: Number(raw.misc.grade) } : {}), ...(raw.misc?.freq ? { frequency: Number(raw.misc.freq) } : {}), ...(raw.misc?.jlpt ? { legacyJLPT: Number(raw.misc.jlpt) } : {}), nameReadings: list(raw.reading_meaning?.nanori).map(text), jlpt: { display: "Unclassified", classifications: [] }, tags: [], wordIds: [], updatedAt, reviewStatus: "validated", provenance: [] }
  entry.provenance = [{ sourceId: source.id, sourceEntryId, sourceVersion: source.version, updatedAt, derivation: "Romaji derived with Manabu modified Hepburn; original dot/hyphen reading boundaries preserved in kana. Source historical JLPT values are not mapped to modern N levels.", fields: Object.keys(entry).filter(field => !["id", "legacyIds", "provenance", "reviewStatus"].includes(field)) }]
  return entry
}
