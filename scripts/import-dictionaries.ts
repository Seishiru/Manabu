import { readFile, writeFile, rename } from "node:fs/promises"
import { gunzipSync } from "node:zlib"
import { createHash } from "node:crypto"
import { resolve } from "node:path"
import { readJMdict, adaptJMdict } from "./content/jmdict.ts"
import { readKANJIDIC, adaptKANJIDIC, kanjiSourceId } from "./content/kanjidic.ts"
import { validateRegistry, type IdentityRegistry } from "./content/registry.ts"
import { prepareDictionary } from "../src/content/prepare.ts"
import type { DictionaryDatabase, Source, Vocabulary, KanjiEntry } from "../src/content/model.ts"

const [sourceDirectory, outputPath] = process.argv.slice(2)
if (!sourceDirectory || !outputPath) throw new Error("Usage: pnpm content:import <approved-source-directory> <new-output.json>")
if (resolve(outputPath) === resolve("src/content/bundled.json") || resolve(outputPath) === resolve("tests/fixtures/starter-dictionary.json")) throw new Error("Write a candidate snapshot, review it, then replace bundled content separately")
const readJSON = async (path: string) => JSON.parse(await readFile(path, "utf8"))
const sources: Source[] = await readJSON("content/source-manifests.json")
const registry: IdentityRegistry = await readJSON("content/source-registry.json")
validateRegistry(registry)
const previous: DictionaryDatabase = await readJSON("src/content/bundled.json")
const starter: DictionaryDatabase = await readJSON("tests/fixtures/starter-dictionary.json")
const sourceXML = async (id: string, file: string) => {
  const source = sources.find(source => source.id === id)!
  const data = await readFile(resolve(sourceDirectory, file))
  if (!source?.permitted || source.redistribution !== true || !source.license || createHash("sha256").update(data).digest("hex") !== source.sha256) throw new Error(`Unapproved or changed source artifact: ${id}; review manifests before updating`)
  return gunzipSync(data, { maxOutputLength: 200_000_000 }).toString("utf8")
}
const jxml = await sourceXML("jmdict", "JMdict_e.gz"), kxml = await sourceXML("kanjidic2", "kanjidic2.xml.gz")
const jsource = sources.find(source => source.id === "jmdict")!, ksource = sources.find(source => source.id === "kanjidic2")!
const updatedAt = jxml.match(/JMdict created: ([\d-]+)/)?.[1]
const kanjiData = readKANJIDIC(kxml)
if (updatedAt !== jsource.version || `${kanjiData.header.database_version}; file ${kanjiData.header.file_version}; ${kanjiData.header.date_of_creation}` !== ksource.version) throw new Error("Source header version differs from reviewed manifest")
const words: Vocabulary[] = readJMdict(jxml).filter(raw => registry.mappings[`jmdict:${raw.ent_seq}`]).map(raw => adaptJMdict(raw, jsource, registry, updatedAt!))
const kanji: KanjiEntry[] = kanjiData.characters.filter(raw => registry.mappings[`kanjidic2:${kanjiSourceId(raw)}`]).map(raw => adaptKANJIDIC(raw, ksource, registry, updatedAt!))
if (words.length + kanji.length !== Object.keys(registry.mappings).length) throw new Error("Reviewed registry identities disappeared from source; manual retirement review required")
const byCharacter = new Map(kanji.map(entry => [entry.japanese, entry.id]))
for (const word of words) {
  word.kanjiIds = [...new Set([...(word.spellings || []).map(spelling => spelling.text).join("")].flatMap(character => byCharacter.has(character) ? [byCharacter.get(character)!] : []))]
}
for (const entry of kanji) entry.wordIds = words.filter(word => word.kanjiIds.includes(entry.id)).map(word => word.id)
const preferredSources: Record<string, string> = {}
for (const [kind, source] of [["Words", jsource], ["Kanji", ksource]] as const) {
  for (const field of ["japanese", "kana", "romaji", "meanings", "englishMeanings", "partsOfSpeech", "tags", "radical", "strokeCount", "grade", "onReadings", "kunReadings", "frequency"]) preferredSources[`${kind}.${field}`] = source.id
  preferredSources[`${kind}.jlpt`] = "manabu-starter"
}
const imported: DictionaryDatabase = { schemaVersion: 1, version: "source-candidates", updatedAt: updatedAt!, sources, entries: [...words, ...kanji], conflicts: [], retiredIds: [] }
const candidate = prepareDictionary([starter, imported], { version: `${updatedAt}.edrdg-1`, updatedAt: updatedAt! }, { preferredSources }, previous)
await writeFile(outputPath + ".review.json", JSON.stringify(candidate.conflicts, null, 2) + "\n")
if (candidate.entries.some(entry => entry.reviewStatus === "needs-review") || candidate.conflicts.some(conflict => conflict.resolution === "manual-review")) throw new Error("Unresolved conflicts; review report before release")
await writeFile(outputPath + ".tmp", JSON.stringify(candidate) + "\n")
await rename(outputPath + ".tmp", outputPath)
console.log(`Prepared ${words.length} words and ${kanji.length} kanji; curated sentences/kana preserved. Source rights verified; starter redistribution rights remain separate.`)
