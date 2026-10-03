# Real dictionary integration — 2026-10-03.edrdg-1

## Included release

- 1,000 vocabulary entries: 16 explicitly reviewed legacy lexical identities plus 984 new source identities selected using source-provided `ichi1/news1/spec1/gai1` priority flags. Selection traverses the source; it is not a frequency ranking, an official JLPT list, or a pedagogically complete syllabus.
- 2,119 source-graded kanji with English meanings and supported Japanese readings. This is a validated subset, not an assertion that all graded/source kanji have been imported.
- All 20 original curated sentences and 104 kana entries per script are retained. No external example-sentence source was added.
- 416 imported words retain multiple readings, and 390 retain multiple English senses. Spellings, reading restrictions, sense restrictions, inherited parts of speech, usage information, dialect/domain labels, cross-references, antonyms and priority tags are retained where present.
- The checked-in registry contains all 3,119 imported source identities. All 233 old learning aliases remain attached to their original canonical IDs.

## Permissions and attribution, verified against official EDRDG documentation

The official [EDRDG General Dictionary Licence](https://www.edrdg.org/edrdg/licence.html) expressly covers JMdict’s Japanese/English portions and KANJIDIC2. It permits copying, adapting and redistributing under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with attribution and share-alike obligations. Other-language JMdict translations have separate rights and are not imported.

The licence identifies copyright holders as James William Breen and the Electronic Dictionary Research and Development Group. Software using the data need not itself become open source. Adapted source-derived data remains subject to CC BY-SA 4.0. This does not resolve the rights to unrelated curated material.

Required acknowledgements follow EDRDG’s official [sample acknowledgement](https://www.edrdg.org/edrdg/sample.html): acknowledge use of the JMdict/KANJIDIC files, EDRDG ownership, and conformance with its licence. The app now provides a dictionary-page acknowledgement and Settings source credits with versions, roles, licence links and transformation notices. Local copies of the EDRDG licence, full CC BY-SA legal text, and original XML format/DTD documentation are packaged and cached under `public/content-licenses/`. Preserve these notices and licence files when distributing adapted data, and do not imply EDRDG endorsement.

**Remaining distribution gate:** the inherited `manabu-starter` source still has a null redistribution licence because its rights were not supplied. The selected external sources are permitted; public distribution of the combined bundle remains gated until the owner confirms the curated material’s licence/permissions. `content:prepare` with `distribution: true` must continue to reject that unknown licence. No licence was invented to make the gate pass.

## Actual source versions and artifacts

`content/source-manifests.json` records exact names, roles, versions, attribution, licence, redistribution permission, official URLs, retrieval date and SHA-256 checksums of the compressed artifacts.

| Source | Official artifact | Recorded version | Authority |
| --- | --- | --- | --- |
| JMdict Japanese/English | `https://www.edrdg.org/pub/Nihongo/JMdict_e.gz` | XML creation date `2026-10-03` | spellings, kana, English senses, parts of speech, supplied priority tags |
| KANJIDIC2 | `https://www.edrdg.org/kanjidic/kanjidic2.xml.gz` | database `2026-276`, file version `4`, creation date `2026-10-03` | meanings, structured on/kun readings, classical radical numbers, strokes, school grade, supplied frequency |

The JMdict source contains 218,856 source entries; that full collection is **not** shipped. The adapters verify XML dates/versions and the import command verifies compressed-file checksums before constructing a candidate. “Latest” URLs can change: a checksum mismatch is intentionally a failure, not permission to silently accept a new version.

## Adapters and identity review

`scripts/content/jmdict.ts` and `scripts/content/kanjidic.ts` are maintainer-side translators only. They do not touch React, practice state, localStorage or source downloads. The XML parser rejects external entity declarations, validates syntax with declared JMdict entities recognized, and bounds size/expansion. Source gzip files are not bundled with the frontend.

`content/source-registry.json` maps `jmdict:<ent_seq>` and `kanjidic2:ucs_<source-codepoint>` to immutable Manabu IDs. New allocations derive from immutable source identities, never array order or spelling, and are explicitly persisted. Registry validation rejects multiple same-source entries assigned to one logical identity. No automatic spelling/reading match assigns a prototype alias.

The 16 legacy word mappings were checked against exact source spelling, reading and lexical senses, with explicit primary-display overrides. The four legacy kanji mappings were checked against source UCS identities. `content/import-review.json` records those decisions, selection criteria and 23 exclusions requiring unsupported-reading or identity review. Exclusions are not silently merged, partly transliterated or presented as validated content. New allocations were checked for unique source and display-form identities; these checks are not a claim of independent human proofreading of every source sense.

Homographs remain separate source identities. The preparation stage flags a same-spelling/reading collision, and regression tests assert that no automatic merge occurs. A future import must explicitly review such collisions rather than remove their meanings or reuse an unrelated history key.

Multiple source senses remain separate objects. `sourceOrder` records their original order, not a permanent learner progress identity; progress remains attached to the stable lexical entry. Primary practice meanings are limited to senses applicable to the selected spelling/reading. Alternate readings are accepted for a displayed spelling only when their source restrictions apply. A specific kana→romaji question accepts the displayed reading, not every reading of that lexical entry.

Romaji is derived using one deterministic modified-Hepburn routine in `scripts/content/romaji.ts`: vowel spelling retained, long marks expanded, contracted/foreign sounds handled, gemination represented, and syllabic n disambiguated with an apostrophe. Kana, including KANJIDIC2 dot/hyphen boundaries, is retained unchanged by the adapter; normalization occurs in the common preparation stage. Unsupported/ambiguous transliterations fail rather than guessing. Existing reasonable romaji equivalences remain in the answer validator.

## Classification, relationships and conflict resolution

New modern JLPT classifications are **Unclassified**. KANJIDIC2’s historical 1–4 values are stored as `legacyJLPT` and never converted to N5–N1. Existing Manabu editorial classifications are retained with their source provenance. Source priority tags and actual KANJIDIC2 frequency values are preserved independently of JLPT; no frequency rank is manufactured.

Vocabulary→kanji links use canonical IDs for kanji components found in source spellings. Kanji→vocabulary links are populated in reverse. Source senses/readings and canonical relationship targets are validated. Existing curated sentence links are unioned rather than discarded; sentence text, tokens and provenance remain unchanged. No example is fabricated when a source word lacks one.

There are 95 recorded, **resolved** field differences in this release. Explicit policy prefers JMdict lexical fields and KANJIDIC2 kanji fields, while retained modern display classifications come from the existing editorial source. Relationship arrays are unioned, source classifications are retained, and all candidate provenance is preserved. There is no majority voting and no unresolved conflict in the included snapshot.

## Reproduce and review a candidate

After obtaining the exact approved gzip files and reviewing their manifests:

```sh
pnpm content:import /path/to/approved-sources /tmp/manabu-candidate.json
pnpm content:test
pnpm exec tsc --noEmit
pnpm build
```

Import invokes the existing preparation/validation pipeline, checks the registry against source entries, writes a separate candidate and review report, and refuses to overwrite `bundled.json` directly. Inspect counts, identity aliases, restrictions, links, licences and resolved decisions before replacing the bundled snapshot. Source updates require reviewed manifest/checksum and registry changes, not an automatic refetch. Maintainers must also run offline and performance checks before increasing release size. Dictionary updates remain application-distribution based; no online updater exists.

## Permanent update regression

`pnpm content:test` runs six permanent tests. The update regression creates saved items, evaluated errors, understanding ratings, completed history, profile/preferences and a paused starter session. It loads the newer snapshot without writing the learner store, checks surviving aliases, removes an entry safely from the test snapshot while retaining historical progress, completes the paused session, practices a new entry and restores the old backup. Separate tests cover reading/sense restrictions, on/kun structure, no invented JLPT, licences/links, deterministic romaji, source registry failures and homograph review. A later release date does not rewrite unchanged curated sentence dates; the manifest date and individual source-content dates remain distinct.

## Actual performance observations

Run `pnpm content:benchmark /path/to/JMdict_e.gz /tmp/report.json` to reproduce progressive real-source measurements. The benchmark checks the approved source checksum, adapts 50,000 real vocabulary entries and uses isolated Node processes per size. Benchmark-only mappings are not a reviewed release registry and are not distributed. Unsupported entries are reported; no synthetic dictionary was substituted.

Node `v22.23.2`, Linux x64; single cold-process observations on this host:

| Words | JSON load | Validation | Index creation | Maximum sampled search | Filtering | Filtered-deck shuffle | JS heap / RSS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1,000 | 36.7 ms | 10.1 ms | 156.9 ms | 0.47 ms | 0.32 ms | 0.74 ms | 31.6 / 113.7 MiB |
| 5,000 | 213.2 ms | 42.3 ms | 360.7 ms | 0.31 ms | 3.99 ms | 1.62 ms | 67.4 / 167.9 MiB |
| 10,000 | 374.8 ms | 80.4 ms | 954.2 ms | 0.44 ms | 2.61 ms | 5.40 ms | 111.8 / 216.1 MiB |
| 25,000 | 911.3 ms | 170.7 ms | 2,805.9 ms | 1.19 ms | 8.51 ms | 10.05 ms | 274.5 / 379.7 MiB |
| 50,000 | 1,141.9 ms | 308.4 ms | 6,751.4 ms | 1.83 ms | 11.55 ms | 19.15 ms | 600.2 / 711.1 MiB |

Raw values and scope are in `content/performance.json`. Search samples are 食, たべ, taberu, water, school and a missing term; deck measurement exercises the engine’s filter/map/shuffle operations, not React. These are not p95 figures, cross-device guarantees or a complete JMdict-sized benchmark.

For the actual 3,347-content-entry release, fresh-profile headless Chromium on the production local server observed approximately 551 ms navigation/DOM ready. Search-to-two-animation-frames, including rendering and frame scheduling, measured 32.4, 287.7 and 59.7 ms for three queries; flow heap was approximately 57.4 MiB. `content/browser-performance.json` records exact scope and values. Batch rendering limits each category to 50 entries until Show more is selected. A full-size browser import has **not** been benchmarked.

The 50,000-word synchronous index has substantial startup and memory cost: implement/measure worker or persistent indexing and chunked loading before shipping that size. Those optimizations are not necessary to pretend this bounded release is a full dictionary and have not been added prematurely to the UI.

## Offline and production checks

With production networking disabled, the app reloaded and searched imported Japanese, kana, romaji, English and kanji; opened structured details; saved an entry; practiced it; recorded a mistake; reviewed the exact missed entry; exported an actual backup; retained existing saved/count/rating data; and kept kana tabs and mobile layout. There were no external requests or runtime exceptions. Production fonts now include full Zen Maru Gothic faces, and the v0.5 cache includes licence/format documents alongside the app/fonts. Device speech synthesis remains optional and depends on installed voices.

Typecheck, all six regression tests, preparation validation and production build passed. The bundle-size warning remains; this is a selected extract with an explicit growth limit, not a claimed full-dictionary performance solution. No runtime scraping, dictionary API, mandatory account, update server, new course flow, or future learning feature was introduced.
