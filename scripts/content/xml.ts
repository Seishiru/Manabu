import { XMLParser, XMLValidator } from "fast-xml-parser"

export const list = <Value>(value: Value | Value[] | undefined): Value[] => value === undefined ? [] : Array.isArray(value) ? value : [value]
export const text = (value: any): string => typeof value === "object" ? String(value?.["#text"] || "") : String(value || "")
export function parseXML(xml: string): any {
  if (xml.length > 200_000_000 || /<!ENTITY[^>]*\b(?:SYSTEM|PUBLIC)\b/i.test(xml)) throw new Error("External entities and oversized XML are not permitted")
  const entities = new Set([...xml.matchAll(/<!ENTITY\s+([\w-]+)\s+["']/g)].map(match => match[1]))
  const valid = XMLValidator.validate(xml.replace(/&([\w-]+);/g, (match, name) => entities.has(name) ? "declared-entity" : match))
  if (valid !== true) throw new Error(`Invalid source XML: ${valid.err.msg}`)
  return new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false,
    processEntities: { enabled: true, maxExpandedLength: 200_000_000, maxExpansionDepth: 3, maxTotalExpansions: 10_000_000, maxEntityCount: 1000 },
  }).parse(xml)
}
