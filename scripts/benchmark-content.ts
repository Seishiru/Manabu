import { readFile, writeFile, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { gunzipSync } from "node:zlib"
import { performance } from "node:perf_hooks"
import { createHash } from "node:crypto"
import { readJMdict, adaptJMdict } from "./content/jmdict.ts"
import { createContentSearch } from "../src/content/search.ts"
import { validateDictionary } from "../src/content/validation.ts"
import type { DictionaryDatabase, Source, Vocabulary } from "../src/content/model.ts"
import type { IdentityRegistry } from "./content/registry.ts"

const [mode, input] = process.argv.slice(2)
if (mode === "--measure") {
  const start = performance.now()
  const database = JSON.parse(await readFile(input, "utf8")) as DictionaryDatabase
  const loaded = performance.now()
  validateDictionary(database)
  const validated = performance.now()
  const search = createContentSearch(database.entries)
  const indexed = performance.now()
  const timings = []
  for (const query of ["食", "たべ", "taberu", "water", "school", "no-such-lexeme-98765"]) { const time = performance.now(); search(query); timings.push(performance.now() - time) }
  const filteredStart = performance.now()
  const eligible = database.entries.filter(entry => entry.kind === "Words" && entry.jlpt.display === "Unclassified")
  const filterMs = performance.now() - filteredStart
  const deckStart = performance.now()
  const deck = eligible.map(entry => entry.id)
  for (let index = deck.length - 1; index > 0; index--) { const target = Math.floor(Math.random() * (index + 1)); [deck[index], deck[target]] = [deck[target], deck[index]] }
  deck.slice(0, 20)
  console.log(JSON.stringify({ entries: database.entries.length, loadMs: loaded - start, validationMs: validated - loaded, indexMs: indexed - validated, searchMs: timings, filterMs, deckMs: performance.now() - deckStart, heapMiB: process.memoryUsage().heapUsed / 1048576, rssMiB: process.memoryUsage().rss / 1048576 }))
} else {
  if (!mode || !input) throw new Error("Usage: pnpm content:benchmark <JMdict_e.gz> <report.json>")
  const sources: Source[] = JSON.parse(await readFile("content/source-manifests.json", "utf8"))
  const source = sources.find(source => source.id === "jmdict")!
  const registry: IdentityRegistry = { version: 1, mappings: {} }
  const entries: Vocabulary[] = []
  let excluded = 0
  const adapterStart = performance.now()
  const data = await readFile(mode)
  if (createHash("sha256").update(data).digest("hex") !== source.sha256) throw new Error("Benchmark source differs from approved manifest")
  for (const raw of readJMdict(gunzipSync(data).toString("utf8"))) {
    registry.mappings[`jmdict:${raw.ent_seq}`] = { id: `jp_word_jmdict_${raw.ent_seq}`, legacyIds: [], review: "Benchmark-only source identity; not approved for publication" }
    try { entries.push(adaptJMdict(raw, source, registry, source.retrievedAt!)) } catch { excluded++ }
    if (entries.length >= 50000) break
  }
  if (entries.length < 50000) throw new Error("Not enough valid real source entries for the requested benchmark")
  const adapterPreparationMs = performance.now() - adapterStart
  const directory = await mkdtemp(join(tmpdir(), "manabu-content-benchmark-"))
  const results = []
  for (const count of [1000, 5000, 10000, 25000, 50000]) {
    const snapshot = join(directory, `${count}.json`)
    await writeFile(snapshot, JSON.stringify({ schemaVersion: 1, version: "benchmark-only", updatedAt: source.retrievedAt, sources: [source], entries: entries.slice(0, count), conflicts: [], retiredIds: [] }))
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--max-old-space-size=1536", "scripts/benchmark-content.ts", "--measure", snapshot], { encoding: "utf8", maxBuffer: 2_000_000 })
    if (result.status !== 0) { results.push({ entries: count, failure: result.stderr, exitCode: result.status }); break }
    results.push(JSON.parse(result.stdout.trim()))
    console.log(`Measured ${count} real adapted vocabulary entries`)
  }
  await writeFile(input, JSON.stringify({ environment: { node: process.version, platform: process.platform, architecture: process.arch }, sourceVersion: source.version, scope: "Real JMdict vocabulary subsets; isolated Node process per size. This is not a full JMdict/browser benchmark. Deck measures the engine's filter/shuffle operations; browser startup/rendering measured separately for the bundled release.", adapterPreparationMs, excludedUnsupportedEntries: excluded, results }, null, 2) + "\n")
}
