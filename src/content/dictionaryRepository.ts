import type { PracticeItem, Vocabulary } from "./model"
import { normalizeSearch } from "./search"
import type { WritingType } from "./writingType"

type Manifest = {
  entryCount: number
  entryShardSize: number
  entryShards: { file: string }[]
  indexShards: { id: string; file: string }[]
  browsePageSize: number
  browseShards: { file: string }[]
  browseFilterIndex: { file: string }
}
export type DictionaryBrowseEntry = { ordinal: number; id: string; japanese: string; kana: string; romaji: string; meanings: string[]; level: string; writingType: WritingType }
type IndexShard = Record<string, number[]>
type BrowseFilterIndex = { level: Record<string, number[]>; writingSystem: Record<WritingType, number[]> }
const writingFilterTypes: Record<string, WritingType[]> = {
  Hiragana: ["hiragana"],
  Katakana: ["katakana"],
  Kanji: ["kanji"],
  Mixed: ["kanji-hiragana", "kanji-katakana", "hiragana-katakana", "mixed"],
  "Kanji + Hiragana": ["kanji-hiragana"],
  "Kanji + Katakana": ["kanji-katakana"],
  "Hiragana + Katakana": ["hiragana-katakana"],
  Other: ["other"],
}

const basePath = "/content/dictionary/"
const manifestPromise = fetch(`${basePath}manifest.json`).then(async response => {
  if (!response.ok) throw new Error(`Dictionary manifest unavailable (${response.status})`)
  return response.json() as Promise<Manifest>
})
const indexCache = new Map<string, IndexShard>()
const entryCache = new Map<string, Vocabulary[]>()
const browseCache = new Map<string, DictionaryBrowseEntry[]>()
let browseFilterPromise: Promise<BrowseFilterIndex> | undefined
const cacheSet = <Value>(cache: Map<string, Value>, key: string, value: Value, limit: number) => {
  cache.delete(key)
  cache.set(key, value)
  while (cache.size > limit) cache.delete(cache.keys().next().value!)
}
const loadJSON = async <Value>(file: string) => {
  const response = await fetch(basePath + file)
  if (!response.ok) throw new Error(`Dictionary shard unavailable (${response.status})`)
  return response.json() as Promise<Value>
}
const shardFor = (gram: string) => {
  let hash = 2166136261
  for (const character of gram) { hash ^= character.codePointAt(0)!; hash = Math.imul(hash, 16777619) }
  return String((hash >>> 0) % 256).padStart(3, "0")
}
const fields = (entry: Vocabulary) => [
  entry.japanese, entry.kana, entry.romaji, ...entry.englishMeanings,
  ...(entry.spellings || []).map(spelling => spelling.text),
  ...(entry.kanaReadings || []).flatMap(reading => [reading.kana, reading.romaji]),
  ...(entry.senses || []).flatMap(sense => sense.meanings),
].map(normalizeSearch)

export async function searchDictionary(query: string, limit = 50): Promise<Vocabulary[]> {
  const normalized = normalizeSearch(query)
  if (!normalized || normalized.length > 300) return []
  const manifest = await manifestPromise
  const size = Math.min(3, normalized.length)
  const grams = [...new Set(Array.from({ length: normalized.length - size + 1 }, (_, index) => normalized.slice(index, index + size)))]
  const postings = await Promise.all(grams.map(async gram => {
    const shardId = shardFor(gram)
    let shard = indexCache.get(shardId)
    if (!shard) { shard = await loadJSON<IndexShard>(manifest.indexShards.find(candidate => candidate.id === shardId)!.file); cacheSet(indexCache, shardId, shard, 16) }
    return shard[gram] || []
  }))
  const candidates = (postings.sort((a, b) => a.length - b.length)[0] || []).filter(ordinal => postings.every(list => list.includes(ordinal)))
  const shardIds = [...new Set(candidates.map(ordinal => Math.floor(ordinal / manifest.entryShardSize)))]
  const loaded = await Promise.all(shardIds.map(async shardId => {
    const key = String(shardId)
    let entries = entryCache.get(key)
    if (!entries) { entries = await loadJSON<Vocabulary[]>(manifest.entryShards[shardId].file); cacheSet(entryCache, key, entries, 8) }
    return entries
  }))
  const byOrdinal = new Map<number, Vocabulary>()
  for (const [index, ordinal] of candidates.entries()) byOrdinal.set(ordinal, loaded[shardIds.indexOf(Math.floor(ordinal / manifest.entryShardSize))][ordinal % manifest.entryShardSize])
  return candidates
    .map(ordinal => byOrdinal.get(ordinal)!)
    .filter(entry => fields(entry).some(field => field.includes(normalized)))
    .sort((first, second) => {
      const score = (entry: Vocabulary) => Math.min(...fields(entry).map(field => field === normalized ? 0 : field.startsWith(normalized) ? 1 : 2))
      return score(first) - score(second)
    })
    .slice(0, limit)
}

export async function browseDictionary(page: number, filters: string[] = []): Promise<{ entries: DictionaryBrowseEntry[]; total: number }> {
  const manifest = await manifestPromise
  if (!filters.length) {
    const shard = manifest.browseShards[page]
    if (!shard) return { entries: [], total: 0 }
    return { entries: await loadJSON<DictionaryBrowseEntry[]>(shard.file), total: manifest.entryCount }
  }
  browseFilterPromise ||= loadJSON<BrowseFilterIndex>(manifest.browseFilterIndex.file)
  const filterIndex = await browseFilterPromise
  const levelFilters = filters.filter(filter => filter in filterIndex.level)
  const writingFilters = filters.filter(filter => filter in writingFilterTypes)
  const levelOrdinals = levelFilters.length
    ? new Set(levelFilters.flatMap(filter => filterIndex.level[filter]))
    : undefined
  const writingOrdinals = writingFilters.length
    ? new Set(writingFilters.flatMap(filter => writingFilterTypes[filter].flatMap(type => filterIndex.writingSystem[type])))
    : undefined
  const ordinals = Array.from({ length: manifest.entryCount }, (_, ordinal) => ordinal)
    .filter(ordinal => (!levelOrdinals || levelOrdinals.has(ordinal)) && (!writingOrdinals || writingOrdinals.has(ordinal)))
  const pageOrdinals = ordinals.slice(page * manifest.browsePageSize, (page + 1) * manifest.browsePageSize)
  const byShard = new Map<number, number[]>()
  for (const ordinal of pageOrdinals) {
    const shardId = Math.floor(ordinal / manifest.browsePageSize)
    const values = byShard.get(shardId) || []
    values.push(ordinal)
    byShard.set(shardId, values)
  }
  const records = new Map<number, DictionaryBrowseEntry>()
  await Promise.all([...byShard.keys()].map(async shardId => {
    const key = String(shardId)
    let entries = browseCache.get(key)
    if (!entries) {
      entries = await loadJSON<DictionaryBrowseEntry[]>(manifest.browseShards[shardId].file)
      cacheSet(browseCache, key, entries, 16)
    }
    for (const ordinal of byShard.get(shardId) || []) records.set(ordinal, entries[ordinal % manifest.browsePageSize])
  }))
  return { entries: pageOrdinals.map(ordinal => records.get(ordinal)!).filter(Boolean), total: ordinals.length }
}

export async function dictionaryEntryByOrdinal(ordinal: number): Promise<Vocabulary> {
  const manifest = await manifestPromise
  const shardId = Math.floor(ordinal / manifest.entryShardSize)
  const key = String(shardId)
  let entries = entryCache.get(key)
  if (!entries) {
    entries = await loadJSON<Vocabulary[]>(manifest.entryShards[shardId].file)
    cacheSet(entryCache, key, entries, 8)
  }
  const entry = entries[ordinal % manifest.entryShardSize]
  if (!entry) throw new Error("Dictionary entry unavailable")
  return entry
}

export async function dictionaryManifest() {
  return manifestPromise
}

export async function randomDictionaryPracticeItems(count: number): Promise<PracticeItem[]> {
  const manifest = await manifestPromise
  const target = Math.max(1, Math.min(50, Math.floor(count)))
  const pages = new Set<number>()
  while (pages.size < Math.min(Math.ceil(target / manifest.browsePageSize), manifest.browseShards.length)) {
    pages.add(Math.floor(Math.random() * manifest.browseShards.length))
  }
  const summaries = (await Promise.all([...pages].map(async page => {
    const shard = manifest.browseShards[page]
    let entries = browseCache.get(String(page))
    if (!entries) {
      entries = await loadJSON<DictionaryBrowseEntry[]>(shard.file)
      cacheSet(browseCache, String(page), entries, 16)
    }
    return entries
  }))).flat()
  const selected = summaries.sort(() => Math.random() - 0.5).slice(0, target)
  const full = await Promise.all(selected.map(entry => dictionaryEntryByOrdinal(entry.ordinal)))
  return full.map((entry): PracticeItem => ({
    id: entry.id,
    kind: "Words",
    japanese: entry.japanese,
    reading: entry.kana,
    romaji: entry.romaji,
    meanings: entry.englishMeanings,
    level: "Unclassified",
    readings: [...new Set([entry.romaji, ...(entry.kanaReadings || []).map(reading => reading.romaji)])],
  }))
}
