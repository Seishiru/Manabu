import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"
import type { Vocabulary } from "../src/content/model.ts"
import { writingType, type WritingType } from "../src/content/writingType.ts"

const directory = resolve(process.cwd(), process.argv[2] || "public/content/dictionary")
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"))
const ids = new Set<string>()
const entSeqs = new Set<string>()
let records = 0
for (const shard of manifest.entryShards) {
  const data = await readFile(resolve(directory, shard.file))
  if (createHash("sha256").update(data).digest("hex") !== shard.sha256) throw new Error(`Entry shard checksum mismatch: ${shard.file}`)
  const entries = JSON.parse(data.toString()) as Vocabulary[]
  if (entries.length !== shard.count) throw new Error(`Entry shard count mismatch: ${shard.file}`)
  for (const entry of entries) {
    if (ids.has(entry.id) || !/^jp_word_(?:[a-z0-9_]+)$/.test(entry.id)) throw new Error(`Invalid or duplicate ID: ${entry.id}`)
    ids.add(entry.id); records++
    const provenance = entry.provenance[0]
    if (entSeqs.has(provenance.sourceEntryId)) throw new Error(`Duplicate JMdict ent_seq: ${provenance.sourceEntryId}`)
    entSeqs.add(provenance.sourceEntryId)
    if (entry.jlpt.display !== "Unclassified" || entry.jlpt.classifications.length) throw new Error(`Unexpected JLPT classification: ${entry.id}`)
    if (!entry.englishMeanings.length || !entry.kanaReadings?.length) throw new Error(`Incomplete dictionary entry: ${entry.id}`)
  }
}
const indexOrdinals = new Set<number>()
for (const shard of manifest.indexShards) {
  const data = await readFile(resolve(directory, shard.file))
  if (createHash("sha256").update(data).digest("hex") !== shard.sha256) throw new Error(`Index shard checksum mismatch: ${shard.file}`)
  const index = JSON.parse(data.toString()) as Record<string, string[]>
  if (Object.keys(index).length !== shard.grams) throw new Error(`Index gram count mismatch: ${shard.file}`)
  for (const [gram, postings] of Object.entries(index)) {
    if (!gram || !Array.isArray(postings)) throw new Error(`Malformed posting: ${shard.file}`)
    for (const ordinal of postings) {
      if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= records) throw new Error(`Orphaned posting ${gram} -> ${ordinal}`)
      indexOrdinals.add(ordinal)
    }
  }
}
let browseRecords = 0
for (const shard of manifest.browseShards || []) {
  const data = await readFile(resolve(directory, shard.file))
  if (createHash("sha256").update(data).digest("hex") !== shard.sha256) throw new Error(`Browse shard checksum mismatch: ${shard.file}`)
  const records = JSON.parse(data.toString()) as { ordinal: number; id: string; japanese: string; kana: string; romaji: string; meanings: string[]; level: string; writingType: WritingType }[]
  if (records.length !== shard.count) throw new Error(`Browse shard count mismatch: ${shard.file}`)
  for (const record of records) if (!Number.isInteger(record.ordinal) || !ids.has(record.id) || !record.japanese || !record.kana || !record.romaji || !record.meanings.length || record.writingType !== writingType(record.japanese)) throw new Error(`Invalid browse record: ${record.id}`)
  browseRecords += records.length
}
if (records !== manifest.entryCount) throw new Error(`Manifest entry count mismatch: ${records}`)
if (browseRecords !== records) throw new Error(`Browse record count mismatch: ${browseRecords}`)
if (manifest.browseFilterIndex) {
  const filterData = await readFile(resolve(directory, manifest.browseFilterIndex.file))
  if (createHash("sha256").update(filterData).digest("hex") !== manifest.browseFilterIndex.sha256) throw new Error("Browse filter index checksum mismatch")
  const filterIndex = JSON.parse(filterData.toString()) as { level: Record<string, number[]>; writingSystem: Record<string, number[]> }
  const filteredOrdinals = [...Object.values(filterIndex.level), ...Object.values(filterIndex.writingSystem)].flat()
  if (filteredOrdinals.some(ordinal => !Number.isInteger(ordinal) || ordinal < 0 || ordinal >= records)) throw new Error("Browse filter index contains an orphaned ordinal")
}
const source = manifest.source
if (source.id !== "jmdict" || source.version !== manifest.generatedAt || source.license !== "CC-BY-SA-4.0" || !source.sha256) throw new Error("Invalid source provenance")
console.log(`Validated ${records} JMdict entries, ${manifest.entryShards.length} entry shards, ${manifest.indexShards.length} index shards, ${manifest.browseShards?.length || 0} browse shards; ${indexOrdinals.size} records indexed.`)
