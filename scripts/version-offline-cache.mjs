import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"

const output = new URL("../dist/", import.meta.url)
const shell = await readFile(new URL("index.html", output))
const version = createHash("sha256").update(shell).digest("hex").slice(0, 16)
const workerPath = new URL("sw.js", output)
const worker = await readFile(workerPath, "utf8")
const stamped = worker.replace('const cacheName = "manabu-app-v0.8"', `const cacheName = "manabu-app-v0.8-${version}"`)
if (stamped === worker) throw new Error("Could not stamp the offline cache version")
await writeFile(workerPath, stamped)
