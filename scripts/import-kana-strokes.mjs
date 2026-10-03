import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execute = promisify(execFile)

const revision = "70a0b7ae0c18ceb5cb358274b029cce0234a43bc"
const kanjiMode = process.argv.includes("--kanji")
const sourceDirectory = process.argv.find(argument => argument.startsWith("--source-dir="))?.slice("--source-dir=".length)
const database = JSON.parse(await readFile(new URL("../src/content/bundled.json", import.meta.url), "utf8"))
const characters = [...new Set(database.entries.filter(entry => kanjiMode ? entry.kind === "Kanji" : ["Hiragana", "Katakana"].includes(entry.kind)).flatMap(entry => [...entry.japanese]))]
const glyphs = {}
const missing = []
const output = new URL("../public/writing/kanjivg/", import.meta.url)
await mkdir(output, { recursive: true })
await mkdir(new URL("../src/writing/", import.meta.url), { recursive: true })
let licence
let cursor = 0
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < characters.length) {
    const character = characters[cursor++]
    const code = character.codePointAt(0).toString(16).padStart(5, "0")
    const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/${revision}/kanji/${code}.svg`
    let svg
    if (sourceDirectory) {
      try { svg = await readFile(`${sourceDirectory}/${code}.svg`, "utf8") }
      catch (error) { if (error.code !== "ENOENT") throw error }
    }
    if (!svg) {
      const { stdout } = await execute("curl", ["--silent", "--show-error", "--retry", "5", "--retry-all-errors", "--max-time", "30", "--write-out", "\n%{http_code}", url], { maxBuffer: 1024 * 1024 })
      const separator = stdout.lastIndexOf("\n")
      const status = Number(stdout.slice(separator + 1))
      if (status === 404) { missing.push(character); continue }
      if (status !== 200) throw new Error(`Stroke source unavailable: ${code} (${status})`)
      svg = stdout.slice(0, separator)
    }
    const header = svg.match(/<!--([\s\S]*?)-->/)?.[1]?.trim()
    if (!header?.includes("Ulrich Apel") || !header.includes("Attribution-Share Alike 3.0")) throw new Error(`Unverified stroke licence: ${code}`)
    licence ||= header
    const paths = [...svg.matchAll(/<path\s+([^>]+)>?/g)].map(match => {
      const attributes = match[1]
      const id = attributes.match(/\bid="([^"]+)"/)?.[1]
      const shape = attributes.match(/\bd="([^"]+)"/)?.[1]
      const order = Number(id?.match(/-s(\d+)$/)?.[1])
      if (!shape || !/^[MmLlHhVvCcSsQqTtAaZzEe0-9.,+\-\s]+$/.test(shape) || !order) throw new Error(`Invalid stroke path: ${code}`)
      return { order, d: shape }
    }).sort((first, second) => first.order - second.order)
    if (!paths.length || paths.some((stroke, index) => stroke.order !== index + 1)) throw new Error(`Invalid stroke sequence: ${code}`)
    const labels = [...svg.matchAll(/<text\s+transform="matrix\(1 0 0 1 ([\d.-]+) ([\d.-]+)\)"[^>]*>(\d+)<\/text>/g)]
    if (labels.length !== paths.length) throw new Error(`Missing stroke labels: ${code}`)
    glyphs[character] = { paths: paths.map(stroke => {
      const label = labels.find(label => Number(label[3]) === stroke.order)
      if (!label) throw new Error(`Missing stroke number: ${code}`)
      return { d: stroke.d, label: [Number(label[1]), Number(label[2])] }
    }), sha256: createHash("sha256").update(svg).digest("hex") }
    await writeFile(new URL(`${code}.svg`, output), svg)
  }
}))
const snapshot = {
  source: { name: "KanjiVG", author: "Ulrich Apel and KanjiVG contributors", version: revision, url: "https://kanjivg.tagaini.net/", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", attribution: "Kana and kanji stroke paths from KanjiVG, © Ulrich Apel and contributors, licensed CC BY-SA 3.0. Paths and number positions are extracted from the pinned SVG files. Multi-kana diagrams scale and position those paths; the derived geometry remains CC BY-SA 3.0." },
  viewBox: 109,
  glyphs: Object.fromEntries(Object.entries(glyphs).sort(([first], [second]) => first.localeCompare(second))),
  missing: missing.sort(),
}
await writeFile(new URL(kanjiMode ? "../src/writing/kanji-strokes.json" : "../src/writing/strokes.json", import.meta.url), JSON.stringify(snapshot, null, 2) + "\n")
await writeFile(new URL("../public/writing/KanjiVG-LICENSE.txt", import.meta.url), `${licence}\n\n${snapshot.source.attribution}\nSource revision: ${revision}\nWebsite: ${snapshot.source.url}\nLicence: ${snapshot.source.licenseUrl}\n`)
console.log(`Prepared ${Object.keys(glyphs).length} licensed ${kanjiMode ? "kanji" : "kana"} glyphs; ${missing.length} unavailable. Dictionary and learning records were not changed.`)
