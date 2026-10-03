import { performance } from "node:perf_hooks"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { normalizeSearch } from "../src/content/search.ts"

const directory = resolve(process.cwd(), process.argv[2] || "public/content/dictionary")
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"))
const cache = new Map<string, Record<string, string[]>>()
const load = async (id: string) => {
  if (cache.has(id)) return cache.get(id)!
  const value = JSON.parse(await readFile(resolve(directory, manifest.indexShards.find((shard: { id: string }) => shard.id === id)!.file), "utf8"))
  cache.set(id, value); return value
}
const search = async (query: string) => {
  const normalized = normalizeSearch(query)
  const grams = normalized.length ? [normalized.slice(0, Math.min(3, normalized.length))] : []
  let hash = 2166136261
  for (const character of grams[0] || "") { hash ^= character.codePointAt(0)!; hash = Math.imul(hash, 16777619) }
  const group = String((hash >>> 0) % 256).padStart(3, "0")
  const index = await load(group)
  return index[grams[0]]?.length || 0
}
const samples = ["食べる", "たべる", "taberu", "eat", "食"]
const timings: Record<string, number> = {}
for (const query of samples) { const start = performance.now(); await search(query); timings[query] = performance.now() - start }
const repeatedStart = performance.now()
for (let index = 0; index < 20; index++) await search("食べる")
timings.repeatedCachedSearch = (performance.now() - repeatedStart) / 20
console.log(JSON.stringify({ datasetEntries: manifest.entryCount, entryShards: manifest.entryShards.length, indexShards: manifest.indexShards.length, entryBytes: manifest.entryShards.reduce((sum: number, shard: { bytes: number }) => sum + shard.bytes, 0), indexBytes: manifest.indexShards.reduce((sum: number, shard: { bytes: number }) => sum + shard.bytes, 0), timings, loadedIndexShards: cache.size }, null, 2))
