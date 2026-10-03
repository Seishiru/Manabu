import { readFile } from "node:fs/promises"
import { validateDictionary, validateDistribution } from "../src/content/validation.ts"

const database = JSON.parse(await readFile(new URL("../src/content/bundled.json", import.meta.url), "utf8"))
if (process.argv.includes("--distribution")) validateDistribution(database)
else {
  validateDictionary(database)
  if (database.entries.some((entry: { reviewStatus: string }) => entry.reviewStatus === "needs-review") || database.conflicts.some((conflict: { resolution: string }) => conflict.resolution === "manual-review")) throw new Error("Bundled content has unresolved review records")
}
console.log(`Validated dictionary ${database.version}: ${database.entries.length} entries${process.argv.includes("--distribution") ? ", approved for distribution" : " (technical validation; not a distribution permission check)"}.`)
