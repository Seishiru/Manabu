import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { gunzipSync } from "node:zlib"
import { dirname, resolve } from "node:path"
import { readJMdict, adaptJMdict } from "./content/jmdict.ts"
import { validateRegistry, type IdentityRegistry } from "./content/registry.ts"
import { normalizeSearch } from "../src/content/search.ts"
import { writingType, type WritingType } from "../src/content/writingType.ts"
import type { Source, Vocabulary } from "../src/content/model.ts"

type DictionaryManifest = {
  schemaVersion: 1
  datasetVersion: string
  generatedAt: string
  source: Pick<Source, "id" | "name" | "version" | "license" | "licenseUrl" | "attribution" | "sha256">
  entryCount: number
  rejectedCount: number
  entryShardSize: number
  entryShards: { id: string; file: string; count: number; bytes: number; sha256: string }[]
  indexShards: { id: string; file: string; grams: number; bytes: number; sha256: string }[]
  browsePageSize: number
  browseShards: { id: string; file: string; count: number; bytes: number; sha256: string }[]
  browseFilterIndex: { file: string; bytes: number; sha256: string }
  rejections: { entSeq: string; reason: string }[]
}

const [sourceDirectory = "approved-sources", outputDirectory = "public/content/dictionary"] = process.argv.slice(2)
const root = process.cwd()
const output = resolve(root, outputDirectory)
const sourcePath = resolve(root, sourceDirectory, "jmdict", "JMdict_e.gz")
const readJSON = async <T>(path: string) => JSON.parse(await readFile(path, "utf8")) as T
const sources = await readJSON<Source[]>("content/source-manifests.json")
const registry = await readJSON<IdentityRegistry>("content/source-registry.json")
validateRegistry(registry)
const source = sources.find(candidate => candidate.id === "jmdict")
if (!source || !source.permitted || source.redistribution !== true || !source.license || !source.sha256) throw new Error("JMdict source is not approved for dataset generation")
const compressed = await readFile(sourcePath)
const actualHash = createHash("sha256").update(compressed).digest("hex")
if (actualHash !== source.sha256) throw new Error(`JMdict checksum mismatch: expected ${source.sha256}, received ${actualHash}`)
const xml = gunzipSync(compressed, { maxOutputLength: 200_000_000 }).toString("utf8")
const version = xml.match(/JMdict created: ([\d-]+)/)?.[1]
if (version !== source.version) throw new Error(`JMdict version mismatch: expected ${source.version}, received ${version || "unknown"}`)

const previous = await readJSON<{ entries: { id: string; legacyIds: string[] }[] }>("src/content/bundled.json")
const previousBySource = new Map<string, { id: string; legacyIds: string[] }>()
for (const [key, mapping] of Object.entries(registry.mappings)) if (key.startsWith("jmdict:")) previousBySource.set(key.slice("jmdict:".length), mapping)
const fullRegistry: IdentityRegistry = { version: 1, mappings: { ...registry.mappings } }
const rawEntries = readJMdict(xml)
for (const raw of rawEntries) {
  const entSeq = String(raw.ent_seq?.["#text"] || raw.ent_seq || "").trim()
  if (!entSeq) continue
  if (!fullRegistry.mappings[`jmdict:${entSeq}`]) fullRegistry.mappings[`jmdict:${entSeq}`] = {
    id: `jp_word_jmdict_${entSeq}`,
    legacyIds: [],
    review: "Deterministic JMdict ent_seq identity; dictionary-only and not practice eligible.",
  }
}
validateRegistry(fullRegistry)

const rejected: { entSeq: string; reason: string }[] = []
const entries: Vocabulary[] = []
for (const raw of rawEntries) {
  const entSeq = String(raw.ent_seq?.["#text"] || raw.ent_seq || "").trim()
  try {
    const entry = adaptJMdict(raw, source, fullRegistry, source.version)
    entry.jlpt = { display: "Unclassified", classifications: [] }
    entry.kanjiIds = []
    entry.exampleIds = []
    entry.relatedWordIds = []
    entries.push(entry)
  } catch (error) {
    rejected.push({ entSeq, reason: error instanceof Error ? error.message : String(error) })
  }
}
entries.sort((a, b) => a.id.localeCompare(b.id))
const existingIds = new Set(previous.entries.map(entry => entry.id))
for (const [entSeq, mapping] of previousBySource) {
  if (!entries.some(entry => entry.id === mapping.id)) throw new Error(`Existing JMdict identity disappeared: jmdict:${entSeq} -> ${mapping.id}`)
  if (!existingIds.has(mapping.id)) throw new Error(`Existing mapping does not resolve in compact content: ${mapping.id}`)
}

const entryShardSize = 1000
const entryShards: DictionaryManifest["entryShards"] = []
const browsePageSize = 25
const browseShards: DictionaryManifest["browseShards"] = []
const index = new Map<string, number[]>()
const addPosting = (gram: string, ordinal: number) => {
  const postings = index.get(gram) || []
  postings.push(ordinal)
  index.set(gram, postings)
}
const fieldsFor = (entry: Vocabulary) => [
  entry.japanese, entry.kana, entry.romaji, ...entry.englishMeanings,
  ...(entry.spellings || []).map(spelling => spelling.text),
  ...(entry.kanaReadings || []).flatMap(reading => [reading.kana, reading.romaji]),
  ...(entry.senses || []).flatMap(sense => sense.meanings),
]
await rm(output, { recursive: true, force: true })
await mkdir(resolve(output, "entries"), { recursive: true })
await mkdir(resolve(output, "indexes"), { recursive: true })
await mkdir(resolve(output, "browse"), { recursive: true })
for (let offset = 0; offset < entries.length; offset += entryShardSize) {
  const shardEntries = entries.slice(offset, offset + entryShardSize)
  const file = `entries/${String(offset / entryShardSize).padStart(4, "0")}.json`
  const data = JSON.stringify(shardEntries) + "\n"
  await writeFile(resolve(output, file), data)
  entryShards.push({ id: String(offset / entryShardSize), file, count: shardEntries.length, bytes: Buffer.byteLength(data), sha256: createHash("sha256").update(data).digest("hex") })
  for (const [localIndex, entry] of shardEntries.entries()) {
    const fields = [...new Set(fieldsFor(entry).map(normalizeSearch).filter(Boolean))]
    for (const field of fields) for (let size = 1; size <= 3; size++) for (let start = 0; start + size <= field.length; start++) addPosting(field.slice(start, start + size), offset + localIndex)
  }
}
const indexGroups = new Map<string, Map<string, number[]>>()
for (const [gram, ids] of index) {
  let hash = 2166136261
  for (const character of gram) { hash ^= character.codePointAt(0)!; hash = Math.imul(hash, 16777619) }
  const group = String((hash >>> 0) % 256).padStart(3, "0")
  if (!indexGroups.has(group)) indexGroups.set(group, new Map())
  indexGroups.get(group)!.set(gram, [...new Set(ids)].sort())
}
const indexShards: DictionaryManifest["indexShards"] = []
for (const [id, values] of [...indexGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const file = `indexes/${id}.json`
  const data = JSON.stringify(Object.fromEntries([...values.entries()].sort(([a], [b]) => a.localeCompare(b)))) + "\n"
  await writeFile(resolve(output, file), data)
  indexShards.push({ id, file, grams: values.size, bytes: Buffer.byteLength(data), sha256: createHash("sha256").update(data).digest("hex") })
}
for (let offset = 0; offset < entries.length; offset += browsePageSize) {
  const page = entries.slice(offset, offset + browsePageSize).map((entry, index) => ({
    ordinal: offset + index, id: entry.id, japanese: entry.japanese, kana: entry.kana, romaji: entry.romaji,
    meanings: entry.englishMeanings.slice(0, 2), level: entry.jlpt.display, writingType: entry.writingType || writingType(entry.japanese),
  }))
  const id = String(offset / browsePageSize).padStart(5, "0")
  const file = `browse/${id}.json`
  const data = JSON.stringify(page) + "\n"
  await writeFile(resolve(output, file), data)
  browseShards.push({ id, file, count: page.length, bytes: Buffer.byteLength(data), sha256: createHash("sha256").update(data).digest("hex") })
}
const levelIndex: Record<string, number[]> = { N5: [], N4: [], N3: [], N2: [], N1: [], Unclassified: [] }
const writingIndex: Record<WritingType, number[]> = {
  hiragana: [], katakana: [], kanji: [], "kanji-hiragana": [], "kanji-katakana": [],
  "hiragana-katakana": [], mixed: [], other: [],
}
for (const [ordinal, entry] of entries.entries()) {
  levelIndex[entry.jlpt.display].push(ordinal)
  writingIndex[entry.writingType || writingType(entry.japanese)].push(ordinal)
}
const filterData = JSON.stringify({ level: levelIndex, writingSystem: writingIndex }) + "\n"
const filterFile = "browse/filter-index.json"
await writeFile(resolve(output, filterFile), filterData)
const filterMetadata = { file: filterFile, bytes: Buffer.byteLength(filterData), sha256: createHash("sha256").update(filterData).digest("hex") }
const manifest: DictionaryManifest = {
  schemaVersion: 1, datasetVersion: `${source.version}.jmdict-1`, generatedAt: source.version,
  source: { id: source.id, name: source.name, version: source.version, license: source.license, licenseUrl: source.licenseUrl, attribution: source.attribution, sha256: source.sha256 },
  entryCount: entries.length, rejectedCount: rejected.length, entryShardSize, entryShards, indexShards, browsePageSize, browseShards, browseFilterIndex: filterMetadata, rejections: rejected,
}
await writeFile(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
await writeFile(resolve(output, "identity-map.json"), JSON.stringify(Object.fromEntries(entries.map(entry => [entry.provenance[0].sourceEntryId, entry.id])), null, 2) + "\n")
await mkdir(dirname(resolve(output, "rejections.json")), { recursive: true })
await writeFile(resolve(output, "rejections.json"), JSON.stringify(rejected, null, 2) + "\n")
console.log(JSON.stringify({
  sourceEntries: rawEntries.length, adaptedEntries: entries.length, rejected: rejected.length,
  entryShards: entryShards.length, indexShards: indexShards.length,
  totalEntryBytes: entryShards.reduce((sum, shard) => sum + shard.bytes, 0),
  totalIndexBytes: indexShards.reduce((sum, shard) => sum + shard.bytes, 0),
  largestEntryShard: Math.max(...entryShards.map(shard => shard.bytes)),
  averageEntryShard: Math.round(entryShards.reduce((sum, shard) => sum + shard.bytes, 0) / entryShards.length),
  identityConflicts: 0, provenance: "JMdict source metadata preserved; dictionary-only entries are Unclassified and not practice eligible.",
}, null, 2))
