import { validateDictionary } from "./validation.ts"
import type { ContentEntry, DictionaryDatabase, Source } from "./model.ts"

export type PreparationPolicy = {
  preferredSources: Record<string, string>
}
const identityFields = new Set(["id", "kind", "legacyIds"])
const normalize = (value: unknown, field = ""): unknown => {
  if (typeof value === "string") return identityFields.has(field) || field.endsWith("Id") || field.endsWith("Ids") ? value : value.normalize("NFKC").trim()
  if (Array.isArray(value)) return value.map(item => normalize(item, field))
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, key)]))
  return value
}
export function prepareDictionary(
  inputs: DictionaryDatabase[],
  release: { version: string; updatedAt: string },
  policy: PreparationPolicy,
  previous?: DictionaryDatabase,
): DictionaryDatabase {
  const sources = new Map<string, Source>()
  const groups = new Map<string, ContentEntry[]>()
  for (const input of inputs) {
    if (!Array.isArray(input.sources) || !Array.isArray(input.entries)) throw new Error("Prepared source input must contain sources and entries")
    for (const source of input.sources) {
      if (!source.permitted) throw new Error(`Source has not been approved: ${source.id}`)
      const existing = sources.get(source.id)
      if (existing && JSON.stringify(existing) !== JSON.stringify(source)) throw new Error(`Conflicting source manifests: ${source.id}`)
      sources.set(source.id, source)
    }
    for (const candidate of input.entries) {
      const entry = normalize(candidate) as ContentEntry
      if (!groups.has(entry.id)) groups.set(entry.id, [])
      groups.get(entry.id)!.push(entry)
    }
  }
  const conflicts: DictionaryDatabase["conflicts"] = inputs.flatMap(input => input.conflicts || [])
  const entries: ContentEntry[] = []
  for (const [id, candidates] of groups) {
    const merged = { ...candidates[0] } as unknown as Record<string, unknown>
    for (const field of new Set(candidates.flatMap(candidate => Object.keys(candidate)))) {
      if (["provenance", "reviewStatus", "updatedAt"].includes(field)) continue
      const values = candidates.filter(candidate => field in candidate)
      const distinct = new Set(values.map(candidate => JSON.stringify((candidate as unknown as Record<string, unknown>)[field])))
      if (distinct.size <= 1) continue
      if (identityFields.has(field)) throw new Error(`Identity conflict: ${id}.${field}; IDs and aliases require explicit migration review`)
      if (["kanjiIds", "exampleIds", "relatedWordIds", "wordIds"].includes(field)) {
        merged[field] = [...new Set(values.flatMap(candidate => (candidate as unknown as Record<string, string[]>)[field]))]
        continue
      }
      if (field === "jlpt") {
        const classifications = [...new Map(candidates.flatMap(candidate => candidate.jlpt.classifications).map(classification => [JSON.stringify(classification), classification])).values()]
        merged.jlpt = { ...candidates[0].jlpt, classifications }
      }
      const preferred = policy.preferredSources[`${candidates[0].kind}.${field}`]
      const authoritative = preferred ? values.filter(candidate => candidate.provenance.some(provenance => provenance.sourceId === preferred && provenance.fields.includes(field))) : []
      const resolved = authoritative.length === 1
      if (resolved) merged[field] = (authoritative[0] as unknown as Record<string, unknown>)[field]
      if (field === "jlpt") merged.jlpt = { ...(merged.jlpt as ContentEntry["jlpt"]), classifications: [...new Map(candidates.flatMap(candidate => candidate.jlpt.classifications).map(classification => [JSON.stringify(classification), classification])).values()] }
      conflicts.push({ entryId: id, field, candidates: values.flatMap(candidate => candidate.provenance.filter(provenance => provenance.fields.includes(field)).map(provenance => ({ sourceId: provenance.sourceId, value: (candidate as unknown as Record<string, unknown>)[field] }))), resolution: resolved ? "preferred-source" : "manual-review" })
    }
    merged.provenance = [...new Map(candidates.flatMap(candidate => candidate.provenance).map(provenance => [JSON.stringify(provenance), provenance])).values()]
    merged.updatedAt = candidates.reduce((latest, candidate) => Date.parse(candidate.updatedAt) > Date.parse(latest) ? candidate.updatedAt : latest, candidates[0].updatedAt)
    merged.reviewStatus = candidates.some(candidate => candidate.reviewStatus === "needs-review") || conflicts.some(conflict => conflict.entryId === id && conflict.resolution === "manual-review") ? "needs-review" : candidates[0].reviewStatus
    entries.push(merged as unknown as ContentEntry)
  }
  const matching = new Map<string, ContentEntry>()
  for (const entry of entries) {
    const key = `${entry.kind}:${entry.japanese}:${entry.kana}`
    const existing = matching.get(key)
    if (existing && existing.id !== entry.id) {
      conflicts.push({ entryId: entry.id, field: "identity", candidates: [existing, entry].map(candidate => ({ sourceId: candidate.provenance[0].sourceId, value: candidate.id })), resolution: "manual-review" })
      entry.reviewStatus = "needs-review"
    } else matching.set(key, entry)
  }
  const retiredIds = new Set(inputs.flatMap(input => input.retiredIds || []))
  if (previous) {
    validateDictionary(previous)
    previous.retiredIds.forEach(id => retiredIds.add(id))
    const newEntries = new Map(entries.map(entry => [entry.id, entry]))
    for (const old of previous.entries) {
      const updated = newEntries.get(old.id)
      if (!updated) { retiredIds.add(old.id); continue }
      if (updated.kind !== old.kind || updated.legacyIds[0] !== old.legacyIds[0] || old.legacyIds.some(alias => !updated.legacyIds.includes(alias))) throw new Error(`Update would break identity: ${old.id}`)
    }
    const oldAliases = new Map(previous.entries.flatMap(entry => entry.legacyIds.map(alias => [alias, entry.id] as const)))
    for (const entry of entries) for (const alias of entry.legacyIds) if (oldAliases.has(alias) && oldAliases.get(alias) !== entry.id) throw new Error(`Update reassigned a progress alias: ${alias}`)
  }
  return validateDictionary({ schemaVersion: 1, ...release, sources: [...sources.values()], entries, conflicts, retiredIds: [...retiredIds] })
}
