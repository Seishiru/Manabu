import type { ContentEntry } from "./model"
import { toKanaScript } from "./romaji.ts"

export function normalizeSearch(value: string) {
  return toKanaScript(value.normalize("NFKC").toLowerCase(), "Hiragana").replace(/[āīūēō]/g, vowel => ({ ā: "aa", ī: "ii", ū: "uu", ē: "ee", ō: "ou" })[vowel]!).replace(/[\s\p{P}]/gu, "")
}
export function createContentSearch(entries: ContentEntry[]) {
  const fieldsById = new Map<string, string[]>()
  const postings = new Map<string, Set<string>>()
  for (const entry of entries) {
    const readings = entry.kind === "Kanji" ? [...entry.onReadings, ...entry.kunReadings].flatMap(reading => [reading.kana, reading.romaji]) : []
    const alternatives = entry.kind === "Words" ? [...(entry.spellings || []).map(spelling => spelling.text), ...(entry.kanaReadings || []).flatMap(reading => [reading.kana, reading.romaji]), ...(entry.senses || []).flatMap(sense => sense.meanings)] : []
    const fields = [...new Set([entry.japanese, entry.kana, entry.romaji, ...entry.englishMeanings, ...readings, ...alternatives].map(normalizeSearch))]
    fieldsById.set(entry.id, fields)
    for (const field of fields) for (let size = 1; size <= 3; size++) for (let start = 0; start + size <= field.length; start++) {
      const gram = field.slice(start, start + size)
      if (!postings.has(gram)) postings.set(gram, new Set())
      postings.get(gram)!.add(entry.id)
    }
  }
  const searchCache = new Map<string, string[]>()
  function searchContent(query: string): string[] {
    const normalized = normalizeSearch(query)
    if (query.trim() && (!normalized || normalized.length > 300)) return []
    const cached = searchCache.get(normalized)
    if (cached) return cached
    const size = Math.min(3, normalized.length)
    const grams = size ? [...new Set(Array.from({ length: normalized.length - size + 1 }, (_, index) => normalized.slice(index, index + size)))] : []
    const lists = grams.map(gram => postings.get(gram) || new Set<string>()).sort((first, second) => first.size - second.size)
    const candidates = lists.length ? [...lists[0]].filter(id => lists.every(list => list.has(id))) : entries.map(entry => entry.id)
    const score = (id: string) => Math.min(...fieldsById.get(id)!.map(field => field === normalized ? 0 : field.startsWith(normalized) ? 1 : 2))
    const results = candidates.filter(id => fieldsById.get(id)!.some(field => field.includes(normalized))).sort((first, second) => score(first) - score(second))
    if (searchCache.size >= 64) searchCache.delete(searchCache.keys().next().value!)
    searchCache.set(normalized, results)
    return results
  }
  
  return searchContent
}
