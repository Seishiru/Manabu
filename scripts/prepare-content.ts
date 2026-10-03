import { readFile, writeFile, rename } from "node:fs/promises"
import { resolve } from "node:path"
import { prepareDictionary } from "../src/content/prepare.ts"
import { validateDistribution } from "../src/content/validation.ts"
import type { DictionaryDatabase } from "../src/content/model.ts"
import type { PreparationPolicy } from "../src/content/prepare.ts"

const [configurationPath] = process.argv.slice(2)
if (!configurationPath) throw new Error("Usage: pnpm content:prepare <configuration.json>")
const readJSON = async (path: string) => JSON.parse(await readFile(resolve(path), "utf8"))
const configuration = await readJSON(configurationPath) as {
  inputs: string[]
  output: string
  previous?: string
  version: string
  updatedAt: string
  policy: PreparationPolicy
  distribution?: boolean
}
const inputs: DictionaryDatabase[] = await Promise.all(configuration.inputs.map(readJSON))
const previous = configuration.previous ? await readJSON(configuration.previous) : undefined
const database = prepareDictionary(inputs, { version: configuration.version, updatedAt: configuration.updatedAt }, configuration.policy, previous)
if (resolve(configuration.output) === resolve(configuration.previous || "") || configuration.inputs.some(path => resolve(path) === resolve(configuration.output))) throw new Error("Prepare into a new output file; never overwrite source or previous snapshots")
await writeFile(resolve(configuration.output + ".review.json"), JSON.stringify(database.conflicts, null, 2) + "\n")
if (database.entries.some(entry => entry.reviewStatus === "needs-review")) throw new Error("Unresolved content needs manual review; release was not written. See the review report.")
if (configuration.distribution) validateDistribution(database)
await writeFile(resolve(configuration.output + ".tmp"), JSON.stringify(database, null, 2) + "\n")
await rename(resolve(configuration.output + ".tmp"), resolve(configuration.output))
console.log(`Prepared ${database.entries.length} entries for ${database.version}. Learning data was not accessed.`)
