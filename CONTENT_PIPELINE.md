# Manabu content preparation

## Separation and current scope

The learner-facing app remains unchanged in structure. All content comes from `src/content/bundled.json`, through `src/content/catalog.ts`; learner data remains in `manabu-learning-v1`. Content preparation has no access to localStorage, user profiles, saved status, mistakes, self-check ratings, or histories.

The current snapshot is `2026-10-03.edrdg-1`: 1,000 vocabulary entries, 2,119 kanji, 20 curated sentences (5 with formation tokens), and 104 kana entries per script. It integrates bounded official JMdict / KANJIDIC2 extracts, not the full sources. The original snapshot is retained as a regression fixture. See `SOURCE_INTEGRATION.md` for verified permissions, pinned versions, adapters, registry review and release measurements.

## Stable identities

- Canonical IDs are explicitly stored, namespaced immutable identifiers: `jp_word_000001`, `kanji_000017`, `sentence_000229`, `kana_000021`.
- Never regenerate IDs from ordering, spelling, romaji, or mutable metadata. Initial starter allocation is frozen in the checked-in snapshot.
- `legacyIds` preserves existing prototype learning keys. The first alias is the persisted learning key; new entries without aliases use their canonical ID.
- Source entry identities belong in provenance, not in mutable Japanese display strings. A future source adapter must use a reviewed source-entry-to-canonical-ID registry.
- Homographs or legitimate different senses must not be automatically merged just because spellings/readings agree. Preparation flags matching identities for review. Maintainers must resolve grouping deliberately.
- With a previous snapshot, changing an entry kind, removing/reordering its primary alias, reassigning aliases, or reusing a retired ID fails validation.
- Removed content records are not deleted from user backups. They are retained in progress and history, although absent entries cannot be searched or practiced until available again.

## Models

`src/content/model.ts` defines vocabulary, kanji, sentences, kana, manifest sources, provenance, classifications, and conflict records.

Common entry fields include canonical ID, aliases, Japanese, kana, stored romaji, meanings, English meanings, source-specific JLPT classifications, display JLPT level, tags, optional priority/frequency, update date, provenance, and review status. Optional media references support later content without adding current UI.

Vocabulary stores parts of speech, kanji IDs, example sentence IDs, and related vocabulary IDs. Kanji stores structured on/kun kana and romaji readings, radical, strokes, optional school grade, and vocabulary IDs. Sentences store translation, reading, romaji, word/kanji IDs, grammar tags, and optional formation tokens. Kana stores its Basic/Dakuon/Handakuon/Yoon group and opposite-script counterpart.

Relationships always use canonical IDs. The catalog adapts these records to the existing practice engine and resolves either canonical or legacy IDs in constant time. Adding examples without formation tokens does not create invalid sentence-piece questions.

JLPT classifications are source/editorial metadata, not universally official labels. Multiple classifications are retained; learners see one display level or Unclassified. Existing N5–N1 filters remain unchanged.

## Approved source contract

The generic preparation stage consumes JSON snapshots conforming to `DictionaryDatabase`. The new maintainer-only JMdict / KANJIDIC2 adapters translate approved XML to this contract before preparation. No XML parser, source download, or external dictionary API is used by the learner-facing app.

Every source requires an ID, name, version, actual attribution, a permission approval flag, and a license string or explicitly unknown `null`. Every entry requires provenance with source ID, source entry ID, source version, fields contributed, and update date. Source version must match the manifest. The `permitted` flag is a maintainer assertion; the tool cannot determine legal permission itself.

Do not invent licenses, attribution, frequency, official JLPT status, or confidence values. The existing starter source uses a null license because redistribution rights were not supplied. `distribution: true` and `pnpm release:check` share the distribution validator: every source must have a recorded licence/attribution and explicit `redistribution: true`, and all content review records must be resolved. The current mixed snapshot deliberately fails this gate until the curated rights are confirmed or the affected content is replaced/excluded through the preparation pipeline. Technical checks (`pnpm verify`) do not grant distribution permission or alter source metadata.

JMdict is now the included authority for vocabulary spellings/readings/English senses/parts of speech; KANJIDIC2 for kanji meanings/readings/radical numbers/strokes/grade and its supplied frequency. Existing editorial classifications and example links remain Manabu-curated. Supplementary examples, modern JLPT metadata and frequency sources must be separately approved; no new modern N labels are inferred.

## Prepare a snapshot

Run with Node 22.18+ (the project uses Node 22):

```sh
pnpm content:prepare /path/to/content-configuration.json
```

Configuration example for validating and versioning the bundled extract, writing outside the repository:

```json
{
  "inputs": ["src/content/bundled.json"],
  "previous": "src/content/bundled.json",
  "output": "/tmp/manabu-next.json",
  "version": "2026-10-04.edrdg-candidate",
  "updatedAt": "2026-10-04",
  "policy": { "preferredSources": {} },
  "distribution": false
}
```

Paths resolve from the command's working directory. Output cannot overwrite an input or the previous snapshot. The tool writes a `.review.json` conflict report, refuses unresolved review records, and writes successful snapshots through a temporary file followed by rename. Review the output before replacing the bundled file. Never replace any user-data file.

With integrated sources, `policy.preferredSources` maps `Kind.field` to a verified source ID, for example `Words.englishMeanings` or `Kanji.strokeCount`. Only a candidate whose provenance claims that field from the preferred source can win. A unique authoritative candidate resolves the conflict; multiple/no authoritative candidates require manual review. There is no majority voting. All candidate provenance and source-specific JLPT classifications are preserved.

Preparation normalizes Unicode width/composition and trims content text while preserving IDs. It groups candidates by explicit canonical identity, detects spelling/reading matches that may need identity review, records conflicting field values, validates sources, unique identities, references, kana counterparts, sentence token reconstruction, and previous-version compatibility. Validation failures or unresolved conflicts do not replace a release snapshot.

To resolve a conflict, cross-check the actual permitted sources, correct the input identity/grouping or field authority policy, and record the reviewed source decision before preparing again. Do not silently dismiss legitimate source differences.

## Local search and performance

The catalog builds ID maps, typed collections, UI/practice adapters, and a local one-to-three-character posting index once per app load. Search intersects the smallest postings first, checks actual normalized fields, ranks exact/prefix matches, and caches up to 64 queries. No network or dictionary API is called. UI filtering is memoized; rendering is batched at 50 results per category.

Unicode width, case, basic punctuation/spacing, kana-script variants, and macron forms normalize for search. Answer validation remains the existing separate engine with reasonable romaji variations. Search is not yet fuzzy/conjugation-aware or a morphological analyzer.

Actual real-source vocabulary benchmarks through 50,000 records are now in `content/performance.json`; production browser measurements are in `content/browser-performance.json`. The 50,000-record Node case showed significant synchronous startup/index memory cost. Worker-based indexing, persistent IndexedDB indexes, and chunked delivery are not implemented yet and should precede a full-scale release. No complete JMdict-sized browser benchmark is claimed.

## Update and distribution safety

1. Obtain approved source files and confirm licenses/attribution.
2. Adapt them to the contract using stable source-to-Manabu identity mappings.
3. Normalize, cross-check, resolve conflicts, and validate against the previous release.
4. Review and version the resulting snapshot.
5. Replace only bundled content; run `pnpm release:check` before public distribution. The build stamps the service-worker cache with a hash of the built shell automatically.
6. Verify existing progress, saved items, mistakes, self-check ratings, backups, paused sessions, and offline search/practice.

The current update mechanism is application distribution only. Settings shows actual bundled metadata and credits; no server check/download button pretends to work. A future updater must stage and validate new content independently of learner storage and atomically rebuild its catalog/index. It must not clear or overwrite the user store.

Learning items allow optional scheduling fields for later spaced repetition, but understanding ratings remain independent of accuracy and no scheduling algorithm is active. Japan Mode, external media, native audio, accounts, and cloud sync are not implemented by this pipeline.
