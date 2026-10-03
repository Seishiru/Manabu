# Manabu

Manabu is an offline-first Japanese learning application built around learner-controlled practice.

Its philosophy is:

> Practice exactly what I want.

Manabu provides Japanese dictionary search, curated learning content, Japanese keyboard input, kana and kanji writing practice, flashcards, progress tracking, and local learner data.

## Features

- Full JMdict dictionary coverage with 218,623 adapted entries
- Lazy dictionary loading with bounded runtime caches
- Japanese, kana, romaji, and English dictionary search
- Dictionary browsing with writing-system filters
- Curated learning content kept separate from the full dictionary
- Flashcard practice with:
  - Typing
  - Multiple Choice
  - Self Check
- Randomized:
  - Practice content
  - Answer type
  - Question direction
- Practice content categories:
  - All
  - Hiragana
  - Katakana
  - Kanji
  - Hiragana word
  - Katakana word
  - Kanji word
- Practice session sizes:
  - 5 cards
  - 10 cards
  - 20 cards
  - 50 cards
- Kanji answer validation accepts Japanese, kana, romaji, and English meanings when appropriate
- Unicode-aware writing-system classification
- Hiragana and Katakana study
- Kana and Kanji writing practice
- Japanese keyboard with romaji-to-kana composition
- Japanese dictionary candidate lookup
- Local learner progress and saved items
- Offline service-worker caching
- Light, Dark, and System appearance modes
- Keyboard shortcuts
- Backup and restore support
- No account or server-side learner profile required

## Current version

**Version:** `1.1.0`

**Documentation date:** `2026-10-03`

## Technology

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- React Router
- pnpm
- Node.js 22+
- Native browser storage
- Service Worker caching

## Project structure

```text
src/
  App.tsx                  Main application and routing
  Practice.tsx             Practice setup and session UI
  Dictionary.tsx           Dictionary UI
  JapaneseKeyboard.tsx     Japanese keyboard UI
  learning.ts              Practice engine and learner state
  content/
    catalog.ts             Curated learning catalog
    model.ts               Content and dictionary models
    dictionarySearch.ts    Dictionary repository exports
    dictionaryRepository.ts
                            Lazy JMdict repository
    writingType.ts         Unicode writing-system classifier
    bundled.json           Curated learning dictionary

scripts/
  build-dictionary-dataset.ts
                            Generate the full dictionary dataset
  validate-dictionary-dataset.ts
                            Validate dictionary shards and indexes
  benchmark-dictionary.ts  Benchmark dictionary operations

public/content/dictionary/
  manifest.json             Dictionary manifest
  entries/                  Full JMdict entry shards
  indexes/                  Search index shards
  browse/                   Browse shards and filter metadata

tests/
  reliability.test.cjs
  content-release.test.cjs
  japanese-keyboard.test.cjs
  writing.test.cjs
  offline-reliability.test.cjs
  browser-reliability.cjs
