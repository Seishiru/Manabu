export type IdentityRegistry = {
  version: 1
  mappings: Record<string, { id: string; legacyIds: string[]; review: string; primarySpelling?: string; primaryReading?: string }>
}
export function resolveIdentity(registry: IdentityRegistry, source: string, sourceEntryId: string) {
  const mapping = registry.mappings[`${source}:${sourceEntryId}`]
  if (!mapping || !mapping.review || !/^(jp_word|kanji)_[a-z0-9_]+$/.test(mapping.id)) throw new Error(`Unreviewed source identity: ${source}:${sourceEntryId}`)
  return mapping
}
export function validateRegistry(registry: IdentityRegistry) {
  if (registry.version !== 1 || !registry.mappings) throw new Error("Invalid source identity registry")
  const identities = new Set<string>()
  for (const [key, mapping] of Object.entries(registry.mappings)) {
    const source = key.slice(0, key.indexOf(":"))
    resolveIdentity(registry, source, key.slice(key.indexOf(":") + 1))
    if (identities.has(`${source}:${mapping.id}`)) throw new Error(`Multiple source entries assigned to one lexical identity: ${mapping.id}`)
    identities.add(`${source}:${mapping.id}`)
  }
}
