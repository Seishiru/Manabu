# Manabu — Current Application

**Application version: 1.1.0** · **Documentation updated: 2026-10-03**

Manabu is a learner-controlled Japanese practice app: **choose what to practice, answer, review, and keep your progress locally**. The original soft green/pastel interface, Nunito / Zen Maru Gothic typography, desktop sidebar, and mobile bottom navigation are preserved.

This document describes the implemented application, including the Home welcome prompt, keyboard controls, answer visibility, understanding ratings, and colored multiple-choice buttons. Future concepts are listed separately below.

## Navigation

| Section | Current functionality |
| --- | --- |
| Home | Personalized greeting, resumable activity, Flashcards shortcut, actual learning statistics, weak-item review, and a date-stable word of the day that changes each calendar day. |
| Practice | Flashcards with configurable content, question direction, answer type, randomized selections, curated content, and lazy JMdict dictionary sessions. |
| Dictionary | Offline bundled search, filters, entry details, saved entries, examples, and direct practice. |
| Japanese Keyboard | Offline romaji → kana composition, virtual kana keys, indexed dictionary candidates, insertion, saving, and exact-item practice. |
| Writing System | Hiragana by default, internal Katakana tab, character stroke-order study and free handwriting. No separate kana sidebar entries. |
| Progress | Actual learned-item counts, accuracy, streak, collection coverage, weak items, and recent completed sessions. |
| Settings | Persistent profile, Light/Dark/System appearance, display/audio preferences, backup export/restore, dictionary information, privacy, and credits. |
| Shortcuts | Context-specific keyboard reference for Practice, Writing System, Japanese Keyboard, confirmations, and the tutorial. |

Navigation uses React Router with paths for the eight sections and browser back/forward support. Shortcuts appears below Settings at `/shortcuts`; the existing introductory tour remains seven steps. Dictionary tabs use `?tab=...`; details use `?entry=<canonical-id>` so direct links, refresh, and history navigation retain the selected entry. Keyboard detail dialogs also use entry query parameters. Legacy `/kanji` links redirect to `/dictionary?tab=kanji`, preserving one canonical Kanji interface.

### Quitting Practice and Confirmation Shortcuts

Every active test has an upper-left Quit button. Backtick (`\``) opens the same confirmation, including while typing an answer. The shared confirmation dialog uses **A = Yes** (red) and **S = No** (green); Escape or outside click cancels. It traps focus, initially focuses No, blurs the background, and blocks underlying practice shortcuts. Confirming clears the resumable session and returns to the Practice mode chooser without adding a completed-session history record. **Already-recorded answers, mistakes, ratings and saved items remain intact**, as explained in the confirmation; quitting is not a rollback of learning progress. Pause remains a separate, useful action for retaining a resumable session.

Tap **Control** to reveal an unanswered card’s hint, including from a typing field. Control combinations such as Ctrl+C do not reveal hints. The old V shortcut is removed so it never interferes with an answer.

`/kanji` (including its trailing-slash form) redirects to `/dictionary?tab=kanji` using the same Dictionary UI. Dictionary category tabs keep the URL query consistent and survive refresh. Unknown routes show a dedicated “Page not found” screen with a working Go Home action rather than silently displaying Home.

## Appearance and Recovery

Settings → Appearance offers Light, Dark, and System. **Light is the default** for new users and old backups without an appearance field, including on devices using dark mode. Existing explicit Light/Dark/System choices are preserved in learner preferences and backups; no separate theme store exists. System follows device appearance changes when selected. LINE-inspired styling uses `#06C755` green actions with contrast-safe dark labels, white/light-gray surfaces, and neutral charcoal dark surfaces rather than green-tinted panels. This is a Manabu interpretation, not an official LINE theme or affiliation. Shared tokens cover onboarding, navigation, practice, dictionary/details, keyboard/dialogs, writing tables, progress, settings, welcome overlays, loading, and recovery screens. Q/W/A/S colors remain positional (red/blue/yellow/green), not correctness indicators; label and key text remain explicit.

### First-Visit Spotlight Tour

After onboarding, the first Home visit shows a seven-step numbered spotlight explaining Home, Practice, Dictionary, Japanese Keyboard, Writing System, Progress, and Settings. Each step highlights **only its corresponding sidebar item**, not the entire sidebar or page content; on mobile it highlights only the corresponding bottom-navigation item. Targets use explicit route attributes, not array positions. The current route’s navigation item stays visibly selected. **A** goes back; **D** or **Enter** advances; **Escape** or Skip tour closes. The last step returns Home. The small **?** button at Home’s top-right replays the tour anytime. Tutorial navigation replaces temporary route entries rather than filling browser history. A native modal contains keyboard focus and prevents background interaction; its shortcuts do not reach Practice or Writing controls.

The seen flag is stored in existing learner preferences and included in backups. Starting/skipping the tour marks it seen, so refreshing, reopening, and application cache upgrades do not repeat it automatically. Clearing local learner data starts a fresh first-visit experience; clearing only the service-worker asset cache does not erase the seen flag. Older backups without the optional flag remain compatible. The welcome prompt is suppressed while a first-visit/replayed tutorial is opening; touring never answers questions, changes progress, or replaces a paused session. Practice shows its overview during the tour even when a session is paused.

Page navigation uses a short **170 ms opacity transition**, with no large movement or delayed navigation. Reduced-motion preferences disable it. Existing layout, routes, and learning controls remain unchanged.

A React boundary and router fallback distinguish rendering failures from invalid routes. Runtime failures show Return Home and Try Again without exposing stack traces; debugging stays in the local console. The lightweight application bootstrap displays a real loading state while the larger content/application module initializes. Offline installation now also pre-caches lazy module dependencies.

Unreadable existing learner storage is protected from accidental replacement by onboarding or new practice. Restore a validated backup explicitly to replace it; new in-memory work can still be exported. Invalid or missing-item paused sessions recover to Practice with a dismissible notice and keep recorded progress. Invalid backup files never change the current store; asynchronous file selection only accepts the most recently selected file. Blank valid backups require the same explicit replacement confirmation as other backups.

Audit fixes include Unicode-safe keyboard deletion, synchronous post-edit caret placement (preventing rapid typing from moving in front of an inserted candidate), native-IME composition protection, reliable dialog Escape/close/focus restoration, and removal of the duplicate keyboard detail close control. Writing reference tables now use the same catalog kana entries as practice; script conversion is shared by catalog, search, writing, and keyboard. One bundled content source, one search index, one learning store, and one practice validator remain.

Search/filter empty states offer reset guidance. Punctuation-only and excessively long searches return safely without rebuilding the catalog; whitespace-only searches still browse content. A skip-to-content link, current-page navigation semantics, visible focus, reduced-motion support, scrollable short-height sidebars, wrapping content, and mobile touch-target improvements support keyboard and mobile use.

On the first Home visit each time the app is opened or refreshed, a dismissible welcome prompt offers to continue learning. It resumes an unfinished session at the saved card, or starts a fresh session using the last practice settings. If those filters have no matching content, it opens setup instead. Clicking outside the card, choosing Maybe later, or pressing Escape dismisses it for the rest of that app visit. Only the Home background is blurred; navigation and other pages retain their usual appearance. No online login is involved.

## Japanese Keyboard

Japanese Keyboard replaces the redundant Kanji navigation entry. Kanji remains available under Dictionary → Kanji, with the same detail views, relationships, saved status, and practice history. Existing `/kanji` links redirect to the canonical Dictionary → Kanji view.

The keyboard uses the shared bundled catalog and local search index, not a separate dictionary. Physical romaji input converts live to Hiragana or Katakana; unfinished consonants remain visible until completed. It supports common Hepburn variants, doubled consonants, n/apostrophe boundaries, voiced sounds, contracted sounds, small kana with x/l prefixes, and punctuation. Use `-` for ー; vowels otherwise remain explicitly typed. Native device IME composition is left untouched.

“Convert romaji as I type” can be disabled to preserve literal English alongside Japanese; lookup still uses the shared index. Virtual Backspace removes Unicode graphemes rather than splitting emoji or combining characters. The editor draft survives navigation and refresh through tab-only `sessionStorage` (`manabu-keyboard-draft-v1`). This cache contains only text/input mode, is not another learner database, and is not included in learning backups. If caching is unavailable, the editor advises copying text before leaving.

Select a candidate to replace the active reading, keeping the rest of the sentence. Exact reading matches rank first, followed by spelling/prefix/partial matches; exact trailing-word matches allow `水をのむ` → `水を飲む`. “Keep kana” (or Escape) commits a reading without selecting kanji. Space and Enter commit before inserting a separator. Changing the input mode affects subsequent typing; “Convert to Hiragana/Katakana” explicitly converts existing kana while retaining kanji. Virtual keys include voiced/semi-voiced kana, small kana, punctuation, Backspace, Space, and Enter. Copy/Clear act only on the editor.

Candidates show dictionary-provided senses, their matched reading and romaji. Kanji kun'yomi with explicit source okurigana preserve their suffix on insertion (for example, 飲 + む from の.む); this remains a kanji candidate, not a fabricated vocabulary record. Japanese definitions appear only when present in content; the current imported sources do not supply Japanese definitions. Details reuse the existing Dictionary component in an accessible native dialog. Save and Practice use the existing learning store and exact canonical item; inserting/viewing a candidate does not affect accuracy. All lookup/conversion works locally after the app shell is cached; copying depends on device clipboard permission. Candidate results are bounded to 12, and unmatched readings remain editable rather than generating invented entries.

## Onboarding Experience

First-time users choose a language, see a minimal rotating-tip loading screen and introduction, then receive a short local-data explanation. They can continue as a guest or restore a previously exported backup. Profile setup is optional.

Name, age, current level (Beginner through N1), target level (N5–N1), selected language, and onboarding completion persist locally. Returning users skip onboarding. The current interface remains English regardless of the selected language; full localization is not implemented.

## Shared Learning Loop

All learning screens use the same local learning model. Dictionary practice, kana practice, ordinary sessions, and weak-item review update the same records.

1. Choose a mode and content.
2. Combine suitable filters and generate a shuffled deck.
3. Submit an answer for evaluated modes, or record understanding in Self Check.
4. Inspect feedback/reference answers; retry an evaluated mistake or move to the next card.
5. Finish to see evaluated results or Self Check rating counts.
6. Review mistakes, practice again, or return home.

Sessions can be paused and resumed, including after a refresh. Starting another session replaces the paused deck, but previously recorded answers remain in learning progress. Only completed sessions appear in recent activity.

### Practice Modes

- **Flashcards:** typing, multiple choice, or understanding-based Self Check cards.
- Identification, Romaji Input, and Sentence Formation are currently hidden until their data/model support is ready.

### Filters and Directions

Content includes All (full JMdict), Hiragana, Katakana, Kanji, and writing-specific word categories. JLPT selection is currently hidden because the complete dictionary does not have authoritative per-entry learner levels. Learned-only and needs-review-only filters are available, along with session sizes of 5, 10, 20, or 50 cards.

Directions include Japanese → English, English → Japanese, Japanese → Romaji, Romaji → Japanese, English → Romaji, Romaji → English, and Randomize. Answer type also supports Randomize across typing, multiple choice, and Self Check; content supports Randomize across available categories. All sessions select only the requested number of cards. All/JMdict sessions fetch selected cards lazily instead of loading the 218,623-entry dictionary into memory.

Answers normalize capitalization, spacing, Unicode forms, and punctuation. Romaji accepts common variations such as shi/si, chi/ti, tsu/tu, contracted-sound alternatives, and supported long-vowel forms. Individual kanji reading questions accept the bundled on’yomi and kun’yomi readings. Japanese vocabulary production accepts its spelling or kana reading.

Self Check records understanding, not correctness. Multiple Choice uses **Q/W/A/S** for upper-left/upper-right/lower-left/lower-right choices. Self Check uses the same layout: **Q Forgotten**, **W Hesitated**, **A Aware**, **S Obvious**. Its reference answer and hold-to-reveal guide appear only after a rating is submitted. Ratings persist locally and in backups, with rating counts on session results and a Self check label in activity history. They do not change accuracy, correct/incorrect counts, learned counts, or mistakes; they count as practice activity. These ratings do not yet schedule spaced repetition. Typing, choice, and sentence-piece questions are validated by the engine. Tapping **Control** shows an optional hint before answering, including from answer fields, without intercepting Control combinations.

Correct feedback displays the answer centered and unblurred, without a hold-to-reveal control. Incorrect feedback keeps the answer blurred by default. Hold **T** to peek and release it to blur again; a press-and-hold control also supports mouse/touch. Losing window focus hides a peeked answer. **Space** advances from feedback (or finishes the last card), and **R** retries when Try again is available. On the results screen, **R** repeats the completed deck and **T** reviews only its first-answer mistakes. Results list the actual missed prompts, and review preserves their original question direction. Shortcuts ignore text inputs, IME composition, modifier keys, and held-key repetition.

### Answer Controls and Colors

Multiple-choice answers use a fixed two-by-two layout with filled pastel buttons. Colors indicate keyboard position, **not correctness**; choices are shuffled per card, and all four buttons remain clickable/tappable.

| Position | Key | Button fill (both modes) | Self Check rating |
| --- | --- | --- | --- |
| Upper left | Q | Red | Forgotten |
| Upper right | W | Blue | Hesitated |
| Lower left | A | Yellow | Aware |
| Lower right | S | Green | Obvious |

Self Check uses the same red, blue, yellow, and green button fills as Multiple Choice. Colors identify keyboard positions, not correctness; ratings still describe understanding rather than right/wrong answers. It does not expose a reference answer or hold-to-reveal guide before the rating is submitted. After any rating, it shows a neutral “Understanding” heading and a blurred reference answer, revealed by holding T or the mouse/touch hold control. Unlike evaluated correct answers, no rating automatically makes the reference answer visible.

| Key | During practice | On completed-session results |
| --- | --- | --- |
| Q / W / A / S | Select the corresponding choice or understanding rating | No action |
| Ctrl (tap) | Show the optional hint before answering, including while typing | No action |
| T (hold) | Peek at incorrect feedback or a submitted Self Check reference answer; release to reblur | Start Review mistakes when mistakes exist |
| Space | Next card, or Finish on the last card, after answering/rating | No action |
| R | Try again when the button is available | Practice again using the completed deck and settings |

Buttons display their shortcut labels. Inputs retain normal typing, including spaces and R/T/V letters. Letter shortcuts do not intercept editable fields; the explicit exceptions are tapping Control for hints and backtick for Quit. Composition, modified key combinations and repeated keydown events remain protected. Changing cards, releasing T, losing window focus, or hiding the tab ends answer peeking. Correct evaluated answers stay visible regardless of T.

### Session Results and Exact Mistake Review

Evaluated sessions show first-answer accuracy, correct/incorrect counts, newly learned items, and the prompts of cards missed on their first attempt. A successful retry does not remove a card from that session's mistake list. Only one retry per missed card is currently available.

Review mistakes starts a deck containing exactly those missed item IDs, with the original question direction and practice settings. It does not substitute unrelated weak items or a random deck. Practice again repeats the completed deck, including when the completed deck was itself a mistake-review session. Actual typed wrong-answer strings are not stored; mistake review tracks the missed questions.

Self Check results show counts for Forgotten, Hesitated, Aware, and Obvious, with no correctness score and no mistakes generated from ratings. Practice again is available; Review mistakes only appears for evaluated mistakes.

## Progress and Review

Each item tracks saved status, correct/incorrect counts, review eligibility, and its last practice time. An incorrect answer marks it for review; a correct answer in a later session clears that flag without deleting past mistakes. A successful same-session retry keeps the original mistake eligible for review. An item with at least one correct answer is counted as learned. Self Check additionally stores the latest understanding rating and the number of self-checks. Ratings count as practice activity but do not change correctness, accuracy, learned status, or existing review flags. Recent activity labels rated sessions “Self check” instead of displaying an accuracy percentage.

Session accuracy counts first answers so a retry cannot turn an initially incorrect card into a correct first answer. Overall accuracy includes recorded retry attempts. Newly learned counts can include successful retries. Daily streaks use local calendar dates with recorded practice activity.

Level and writing-system bars describe coverage of the **bundled collection**, not certification or mastery of an entire JLPT level. Levels without available entries are labeled as future content.

## Dictionary and Reference Content

The bundled `2026-10-03.edrdg-1` collection contains **1,000 words, 2,119 kanji, 20 curated sentences, and 104 characters/combinations for each kana script**. Five sentences have curated pieces for Sentence Formation. Vocabulary and kanji are selected, validated extracts from official JMdict / KANJIDIC2 files, not their complete datasets. All original 233 legacy aliases and 20 curated sentences remain intact.

Vocabulary retains alternative spellings/readings, spelling and sense restrictions, separate English senses, inherited parts of speech, and source priority tags. Details show grouped meanings and expandable spellings/readings. Search indexes these alternatives, while reading validation respects the displayed form: Japanese spelling questions can accept applicable source readings, but a specific kana-reading question does not accept unrelated alternate readings. Imported words without examples do not show an empty or fabricated example section.

New content without reliable modern JLPT metadata is **Unclassified**, with a selectable filter in Dictionary and Practice. The original editorial N labels remain attached to their source. KANJIDIC2 historical 1–4 JLPT values are retained separately and never converted to modern N levels. Its actual supplied frequency values remain separate from classification. Romaji is deterministically derived from source kana using the maintainer-side modified-Hepburn transliterator; original reading boundaries and restrictions are retained.

Dictionary search supports Japanese spelling, kana readings, romaji, English, and contained kanji using a shared local character-gram index and bounded query cache. Search normalizes Unicode width, capitalization, punctuation, spaces, and hiragana/katakana equivalents. All / Words / Kanji / Sentences tabs and JLPT, writing-system, and learning-status filters are functional, including saved-only selection. Filtered results are memoized and paginated at **50 total entries per page**, including combined All results. Numbered pages, Previous/Next, ellipses, current-page indicators and result ranges replace Show more results. Changing search/category/filters resets to page one; shrinking results clamp safely. Returning from a detail preserves the current page. Page changes focus and scroll to the result heading, respecting reduced motion. Definitions, examples, related entries, saved status, and learned counts use real bundled data and local learning records. Word details expose linked practice sentences, and kanji/sentence details use explicit vocabulary relationships. Direct practice uses the selected entry, not unrelated random content. Pronunciation uses browser/device Japanese speech synthesis.

### Dictionary Kanji Stroke Animation

All **2,119 bundled kanji** have actual KanjiVG stroke paths, using the same pinned source and **CC BY-SA 3.0** licence as kana. Kanji details reuse the Writing System's SVG stroke renderer and shared writing preferences. Playback runs once on opening, with Play/Pause, Replay, Previous/Next stroke, Slow/Normal/Fast speed and optional numbers. Reduced motion shows the complete reference. Viewing animation never records learning results. Missing data/loading errors show recoverable states without hiding dictionary details.

`src/writing/kanji-strokes.json` is a lazy-loaded stroke-media snapshot, **not a second dictionary**; the catalog remains the sole content source. Its production chunk is included by the existing offline cache traversal. Original SVG files and attribution remain in `public/writing/`. `pnpm writing:prepare --kanji` prepares licensed paths from the pinned revision, validates licence headers/stroke order/number positions and records source hashes; it requires maintainer-side curl. `--source-dir=<directory>` can use an already-downloaded copy of that exact revision, fetching missing files from the pinned source. No learner-time external requests are introduced, and dictionary IDs, relationships, profile, history, backups and progress are unchanged.

## Versioned Content Foundation

### Kana Stroke Study and Writing

Left-clicking a table character still plays its pronunciation. Right-click (native context menu suppressed) or Shift+F10 opens `/writing-system/character/<canonical-id>`. The character picker provides a touch-friendly alternative. The table script lives in the query string, and Back returns to the correct Hiragana/Katakana tab. Previous/Next stays within the selected script and group (Basic, Dakuon, Handakuon, or Yoon), with position and boundary controls.

The shared character component shows audio, real SVG stroke-path playback, Play/Pause/Replay, previous/next stroke, optional numbers, and Slow/Normal/Fast speed. The character summary and Previous/Next controls sit below the workspace. Study automatically plays the animation once per character, without looping. The last Study/Write choice persists in existing preferences and carries into the next character and across refresh. A moving tip indicates stroke direction. Reduced-motion mode reveals the complete reference without animated playback. All 208 catalog entries are covered by 148 individual glyph assets; Yoon combines the appropriate existing glyphs in a scaled layout. Missing geometry gets an honest unavailable state, not a simulated font-reveal animation. Missing/invalid IDs offer Back to Writing System and Return Home.

Write mode uses **one square divided into four sections**, not separate boxes. Pointer capture, coalesced samples, configurable stabilization, quadratic curves, clipping, and touch-scroll prevention support mouse, pen, and touch drawing. Guidance is an independent faint layer, never part of the user’s marks. Clear immediately removes pen strokes; Undo/Redo affect only pen strokes. Done is explicitly **self-check**, not handwriting recognition: it does not change correctness, accuracy, mistakes, or learned counts. Write Again clears the drawing; selecting another character resets drawing/playback state while preserving the selected mode. Leaving, refreshing, and clearing do not ask for confirmation. Drawings are temporary, not stored in backups.

Writing shortcuts: **1 Study**, **2 Write**, **A Previous character**, **D Next character**; in Study, **Space Play/Pause** and **R Replay**; in Write, **Space toggles guided strokes (including their numbers)**, **Z Clear**, **X Undo**, and **C Redo**. The square’s quadrant grid remains independent of guidance. Right-clicking the writing grid suppresses the browser menu and opens **Done · Self-check** after at least one stroke. The button offers the same flow for keyboard/touch users.

Writing results are a centered modal with a blurred backdrop, closed by outside click, Close, or Escape. It compares the actual user drawing with the real reference and reports both stroke counts without claiming shape recognition, correct direction, or a correctness score. Keep writing resumes the drawing; Write Again clears it; Next character resets it. Closing preserves the drawing and allows reopening with View self-check. Page-level writing shortcuts are inactive while the modal is open. Editable inputs/selects, composition, repeated events, and modified keystrokes are ignored; unavailable controls remain inactive.

Writing settings (guided strokes, speed, stabilization, grid, numbers, pen thickness, and reset) persist inside the existing `manabu-learning-v1` preferences and are included in backups. Older backups default these optional settings safely. No additional learner store, practice engine, dictionary, or Kanji destination was introduced.

**Stroke media attribution:** KanjiVG, Ulrich Apel and contributors, pinned revision `70a0b7ae0c18ceb5cb358274b029cce0234a43bc`, **CC BY-SA 3.0**. Original SVGs and upstream notice are preserved under `public/writing/`; extracted paths, stroke-number positions, and composed/scaled layouts are attributed and remain under that licence. Settings and the writing page expose credits. `pnpm writing:prepare` is a maintainer-side importer for that pinned source, validates licence headers and path order, records SHA-256 hashes, and reports missing glyphs. The learner performs no network request for animation or drawing. This source licence does not resolve the pre-existing curated dictionary’s separate redistribution blocker.

Reachable prototype states include playing/paused/completed references, guided/free/active/completed drawings, open settings, dark appearance, character navigation, and missing-character recovery. A missing-stroke fallback is implemented and unit-tested; the current complete kana coverage means it does not normally appear. Regression checks cover one-shot autoplay, mode memory, shortcuts, immediate clear/navigation, drawing history, settings and old backups, script context, pointer drawing, self-check data integrity, reset on navigation, mobile width, and refresh.

Content and learner records are separate. `src/content/bundled.json` is a validated, versioned dictionary snapshot; `manabu-learning-v1` remains the independent user store. A shared catalog supplies Dictionary, Kanji, Practice, and progress coverage. `src/dictionaryData.ts` remains a compatibility export rather than a second dataset.

Each word, kanji, sentence, and kana entry has an immutable canonical ID with a `jp_word_`, `kanji_`, `sentence_`, or `kana_` namespace. Existing prototype keys remain frozen legacy aliases. The practice adapter retains those original progress keys, so saved words, mistakes, self-check ratings, histories, and paused sessions do not require destructive migration. Newly added entries without legacy aliases use canonical IDs directly. Backup validation preserves well-formed progress records for content no longer bundled instead of rejecting the entire backup.

Structured models include English meanings, stored kana/romaji, parts of speech, source-specific JLPT classifications and a simple display level, tags, optional priority/frequency, provenance, source versions, review status, and explicit word/kanji/sentence links. Kanji readings are structured rather than parsed from display strings. Kana include group and counterpart relationships. Optional media metadata leaves room for future content without adding Japan Mode UI.

Settings displays the actual dictionary version, date, counts, source roles/versions, licences, attribution, and locally packaged documentation. The official JMdict Japanese/English and KANJIDIC2 portions are used under EDRDG’s CC BY-SA 4.0 terms, with changes acknowledged. The original curated-content redistribution licence is still unknown: the whole-bundle public-distribution gate remains blocked until those rights are confirmed. No online update check is simulated.

### Preparation and Future Updates

`pnpm content:prepare <configuration.json>` runs a maintainer-only pipeline on permitted, locally prepared source snapshots: normalize → cross-check identities → apply explicit per-field source preferences → preserve classifications/provenance → flag conflicts → validate references → write a new version. It never accesses browser learning storage and never performs network requests or runtime scraping. Ambiguous candidates are not majority-voted; unresolved conflicts prevent a release and produce a review report. A distribution build also requires source license metadata.

When a previous snapshot is supplied, preparation checks immutable kinds/aliases, prevents alias reassignment and retired-ID reuse, and records removed canonical IDs as retired. Updates are currently distributed with application builds, not downloaded through an updater. The production service-worker cache version has been bumped for this content release; learning storage is unchanged.

`pnpm content:import <approved-source-directory> <candidate.json>` verifies pinned source checksums and versions, uses the reviewed persistent registry, runs XML adapters and the preparation pipeline, and refuses unresolved conflicts. All 95 field differences in this release were resolved by explicit field-source policies. `content/import-review.json` records exclusions rather than silently dropping unsupported/ambiguous readings. `SOURCE_INTEGRATION.md` documents source permissions, release commands, identity reviews, and measured performance. An online update delivery mechanism remains future work.

Both writing-system tables retain Basic, Dakuon, Handakuon, and Yoon groups, with romaji above kana. Clicking pronounces a character; hovering or focusing shows a short-delay **sound and reading tooltip**. The misleading simulated handwriting animation has been removed. There is no stroke-order training or stroke-order video in this release.

## Profile, Preferences, and Backups

Settings can update the local profile, romaji display, Japanese practice representation, English support text, and pronunciation. Romaji can always be shown, shown for difficult/unlearned items, or hidden in supported learning/detail displays. Dictionary definitions and kanji reading information remain useful as reference content. Question directions determine the required output; preferences do not expose a question's answer.

Export produces a JSON backup with profile, preferences, progress, saved entries, mistakes, understanding ratings and self-check counts, practice configuration, recent entries, and completed session history (including session ratings). Restoring validates the file and requires confirmation before replacing current data. The replacement must successfully persist before the in-memory state changes or success is shown. Storage denial/quota failures preserve the current profile, progress, paused session, and protected unreadable data; the confirmation remains available to retry. Invalid files, including invalid understanding ratings, leave current data untouched. Older backups without ratings or appearance remain supported; the backup format/version is unchanged. Empty backups explicitly warn that they clear learning progress. Canceling restore changes nothing. The active unfinished deck is not included in exported backups.

Unreadable existing local data is preserved rather than silently overwritten. The app shows recovery guidance and temporarily keeps new changes in memory; export saves that current in-memory work, not the damaged raw storage. A confirmed valid restore exits protected mode only after successfully saving. Unknown historical content IDs remain valid learning records, while malformed or missing-content paused sessions recover safely without deleting progress.

## Appearance

Settings provides **Light / Dark / System**, defaulting to **Light**; System follows device-theme changes only when selected. Explicit choices persist in the existing learner preferences, including backups; there is no separate theme database. A shared appearance lifecycle maintains one media listener across bootstrap, pages, and recovery screens, restoring the page's appearance when recovery closes. The unused appearance provider and superseded dark/recovery styles have been removed without redesigning the interface.

Dark mode uses **`#121212`** for the application background, with intentionally lighter green-tinted surfaces, readable text, and Manabu's green accent. Cards, inputs, tooltips, navigation, keyboard candidates, progress, and feedback use shared semantic tokens. Q/W/A/S retain red/blue/yellow/green positional fills in both themes: these colors indicate keyboard position, never correctness. Labels and key hints remain explicit.

## Reliability and Recovery

Unknown URLs show **Page not found** with **Go Home**. Rendering failures and uncaught runtime errors show a distinct **Something went wrong** recovery screen with **Return Home** and **Try Again**, without exposing stack traces to learners or sending data to a server. Missing dictionary entries offer a way back to the dictionary. Empty filters/searches, saved collections, review lists, and activity lists provide useful guidance rather than fabricated content.

Practice validates paused sessions before resuming, excludes equivalent answers from choice distractors, and prevents unanswered-card advancement. Retries preserve first-answer accuracy; Self Check remains neutral and does not create mistakes. Restore shows a real file-reading state and understandable validation errors. Initial startup has visible loading text; instantaneous synchronous operations do not acquire artificial delays.

Navigation has active-route semantics; tabs support arrow-key navigation, and controls have visible focus styles. Native keyboard-detail dialogs support Escape, outside dismissal, browser Back, focus containment, and scroll locking. Responsive safeguards include sidebar scrolling, mobile safe-area spacing, touch targets, and wrapping for long Japanese/English content.

The bundled catalog remains the single content source, with one indexed search, shared kana conversion, and the existing practice engine and `manabu-learning-v1` learner store. Writing-system tables now derive their characters from that catalog rather than duplicated hardcoded tables. Content IDs, legacy aliases, provenance, licenses, and content snapshots are unchanged by this reliability phase.

The shared storage key is `manabu-learning-v1`. Existing vocabulary/kanji saved states and answer counts migrate from the prototype's `manabu-dictionary-learning` key. Storage failures show a warning and allow exporting the current in-memory data. There is no account, login, cloud synchronization, or remote learning-data storage.

## Offline Behavior

Core content is bundled; practice and dictionary searches never scrape websites or require a dictionary API. A production-mode service worker caches the application shell, JavaScript, CSS, and locally bundled fonts for offline navigation and reloads after a successful first online visit. Development/preview mode does not register this worker. Settings reports readiness only after worker activation; failed or stalled registration/installation exits within 15 seconds with connection/reload guidance rather than staying indefinitely on “Preparing offline access”.

Nunito remains locally subsetted; Zen Maru Gothic’s original full medium/bold faces now replace the tiny starter-only subsets to support expanded Japanese content without changing typography. Both families retain SIL Open Font License files. Production caches use `manabu-app-v0.8-<build-hash>` derived from the built HTML. A new shell is committed only after its lazy modules and styles are cached. Failed installations discard their incomplete cache. Activation retains the immediately previous release so an already-open tab can still load its hashed modules; older releases are cleaned up. Tabs left open across more than one subsequent update should be refreshed while online. Japanese audio depends on browser/device voices and may not be available offline. Browser storage clearing removes progress and caches, so users should keep backups.

## Current Limitations and Future Work

- The current release is a bounded JMdict/KANJIDIC2 extract. Larger selections, approved sentence sources, verified modern JLPT metadata, and an update service remain future work. No fake update status is shown.
- The inherited curated source still has no recorded redistribution licence. External source permissions are documented, but public distribution of the mixed bundle needs that remaining rights confirmation.
- Real-source benchmarks at 50,000 vocabulary entries found roughly 6.75 seconds of synchronous indexing and 600 MiB JS heap in Node. Persistent/worker indexing or chunked delivery should precede shipping a full-size dataset. Full JMdict-sized browser performance has not been claimed.
- Spaced repetition, adaptive scheduling, accurate stroke-order media, improved/native audio, and more sentence content are next-phase features.
- Learning items can hold optional future scheduling metadata (next review date, interval, difficulty, stability, ease), but no scheduling algorithm is active.
- Japan Mode, image questions, real-world situations, listening, speaking, and pronunciation evaluation remain future concepts and do not clutter current navigation.
- Interface localization, cross-device synchronization, and multi-tab learning synchronization are not implemented.

## Reliability Verification

- `pnpm typecheck` and `pnpm content:validate` pass. The unit suite currently contains **32 tests**, including atomic failed restores, protected storage, complete-grapheme Backspace with a fallback, shared appearance listeners, offline installation failures/timeouts, two-release cache upgrades, and explicit distribution permission checks. Content IDs, backup compatibility, first-answer accuracy and neutral ratings remain covered.
- `pnpm verify` runs typecheck, bundled content validation, the unit suite, and the production build. `.github/workflows/reliability.yml` runs these checks plus isolated Chromium interactions on pushes and pull requests. The existing large dictionary chunk warning remains; these changes do not claim a full-source or physical-mobile performance improvement.
- `pnpm release:check` additionally requires explicit licences, attribution, redistribution permission and resolved content review. **The current snapshot intentionally fails this public-distribution gate because the curated source's licence/redistribution permission is unknown.** Development validation/builds remain available. The CI workflow also offers a manual `public_distribution` permission check. Passing ordinary CI alone does not authorize public distribution; maintainers must pass this gate before publishing.
- `pnpm test:browser` uses the running Vite server and an isolated temporary Chromium profile. `MANABU_TEST_URL` overrides port 3000; `CHROMIUM_PATH` selects the executable. Use `MANABU_CDP_URL` only with a disposable testing profile because fixtures replace that profile's test-origin local state. Coverage includes direct/refreshed/history routes, System changes and overrides, legacy Kanji redirection, 404 recovery, 56 route/viewport checks, keyboard/dialog flow, failed storage restore followed by retry, backup rejection/cancel, Self Check shortcuts and rendering-error recovery.
- This pass completed the Chromium suite and `figma make verify-deploy` successfully. A separate production check served the built app under a locally mirrored origin (rewriting the publish-origin URLs only for that test) and disabled both networking and the browser HTTP cache: Dark Settings reloaded, cached lazy modules loaded, `mizu` produced `みず` with `水` candidates, and exact-entry practice started. Two-release upgrade/failure behavior is additionally covered by deterministic service-worker tests. No physical-device or live public-deployment signoff is implied.

Viewport coverage: 1920×1080, 1440×900, 1280×720, 768×1024, 1024×768, 320×720, 390×844, and 430×932. Contrast tests cover the actual light/dark Q/W/A/S fills. Keyboard drafts persist through navigation and refresh in tab-only session storage, but are not permanent documents or part of learner backups; copy important text before closing the tab. Dictionary entry URLs are implemented. Multi-tab learner synchronization and cloud storage are not.

### Manual release checks still required

- Test Safari/iOS and Firefox, narrow physical phones, OS appearance changes, native IME composition, and offline reopening. Chromium automation is not cross-browser signoff.
- Use keyboard-only navigation and a screen reader to check names, focus order, feedback announcements and dialog focus restoration. Targeted contrast checks are not a full WCAG certification.
- Before a substantial dictionary expansion, repeat startup/index/search/memory measurements on representative mobile hardware and across progressively larger datasets. Preserve the existing measured benchmark files; do not extrapolate desktop observations into mobile guarantees.

### Previous content-release verification

The permanent `pnpm content:test` suite now covers a starter→new-content reload with saved words, errors, neutral ratings, histories, a paused session, removed-item records, new-entry practice and backup restoration. Additional tests exercise adapter restrictions/senses, on/kun readings, source labels, transliteration, stable aliases, local search, non-merged homographs, and preserving unchanged sentence dates across new release versions. All six tests passed. Production offline browser checks confirmed imported spelling/kana/romaji/English/kanji searches, details, saving, exact practice, mistake review, export, existing counts, kana tabs, batching, and mobile layout, with no external requests or runtime exceptions. Build/typecheck passed; the large-bundle warning remains.

`content/performance.json` records actual isolated Node measurements for 1,000/5,000/10,000/25,000/50,000 adapted JMdict vocabulary records. `content/browser-performance.json` records the 3,347-entry production bundle: approximately 551 ms first navigation, 32–288 ms search-to-two-frames including rendering, and 57 MiB observed JS heap during the browser flow. These are single observations on the development host, not statistical guarantees or a full-source browser benchmark.

Previous foundation checks:

- TypeScript validation and the production build passed; the existing large-bundle warning remains.
- Targeted checks covered all 233 original aliases, unique canonical IDs, local search representations, relationships, old backups, saved/mistake retention, missing-content record preservation, romaji equivalents, and pipeline conflict/authority/permission handling.
- Additional engine checks verified canonical-ID direct practice, alias deduplication, actual backup restoration, rejection of unsegmented Sentence Formation content, and neutral Self Check ratings.
- Headless browser checks verified existing-user entry, saved counts, indexed word/kanji searches, word-to-sentence navigation, exact-entry practice, Settings counts, writing-system tabs, and mobile overflow.
- A production browser with networking disabled successfully reloaded the cached app, searched the dictionary, practiced the selected word, validated an answer, saved progress without losing prior counts/saved status, and used Space to finish.
- The native preparation command successfully produced a separate validated snapshot without accessing learner storage. No full external dictionary or large-scale performance benchmark is claimed.

## Main Files

- `src/App.tsx`: preserved application shell, onboarding, home, navigation, and writing-system references.
- `src/HomeWelcome.tsx`: Home-only welcome dialog, outside-click/Escape dismissal, and keyboard focus handling.
- `src/learning.ts`: user state, persistence, compatible backups, deck generation through the shared catalog, answer validation, and statistics.
- `src/Practice.tsx`: setup, four practice modes, feedback, retry, and results.
- `src/Dictionary.tsx` / `src/dictionaryData.ts`: dictionary UI and compatibility exports from the shared catalog.
- `src/content/model.ts`, `src/content/bundled.json`, `src/content/catalog.ts`: structured content models, versioned data, stable ID adapters, relationships, and local search index.
- `src/content/validation.ts`, `src/content/prepare.ts`, `scripts/prepare-content.ts`: content integrity checks and maintainer preparation pipeline.
- `scripts/content/`, `scripts/import-dictionaries.ts`, `content/source-registry.json`: source-only XML adapters, deterministic romaji, reviewed identities, and checksum-pinned release generation.
- `tests/content-release.test.cjs`, `scripts/benchmark-content.ts`, `content/*performance.json`: permanent content-update regression and measured scaling/browser reports.
- `src/LearningPanels.tsx`: profile forms, settings, restore controls, weak-item lists, and progress.
- `src/index.css`: existing visual language, local font wiring, and responsive styling.
- `src/offline.ts`, `src/offlineRegistration.ts`, `public/sw.js`: bounded registration/status and release-safe production caches; `scripts/version-offline-cache.mjs` stamps each built shell's cache version.
- `.github/workflows/reliability.yml`, `scripts/validate-content.ts`: automated technical checks and the explicit public-distribution gate.
- `public/fonts/`: locally bundled font assets and font licenses.
