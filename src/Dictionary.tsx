import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router"
import { navigateTabs } from "./accessibility"
import { pagination } from "./pagination"
import KanjiStrokePlayer from "./writing/KanjiStrokePlayer"
import { words, kanji, type Word } from "./dictionaryData"
import { contentEntryById, sentences, searchContent, relatedWords, examplesFor } from "./content/catalog"
import { browseDictionary, dictionaryEntryByOrdinal, dictionaryManifest, searchDictionary, type DictionaryBrowseEntry } from "./content/dictionarySearch"
import type { Vocabulary } from "./content/model"
import { writingType, writingTypeIsMixed, writingTypeLabel, type WritingType } from "./content/writingType"
import {
  itemById,
  items,
  saveItem,
  speakJapanese,
  updateState,
  useLearning,
  type Item,
} from "./learning"

function Symbol({
  name,
}: {
  name: "search" | "audio" | "arrow" | "back" | "book" | "star" | "check" | "filter"
}) {
  const shapes: Record<string, ReactNode> = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    audio: (
      <>
        <path d="m11 5-5 4H3v6h3l5 4zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    back: <path d="m14 5-7 7 7 7M7 12h14" />,
    book: (
      <>
        <path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1ZM12 5v15" />
      </>
    ),
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z" />
    ),
    check: <path d="m5 12 4 4L19 6" />,
    filter: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="17" r="2" />
      </>
    ),
  }
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  )
}

export default function Dictionary({
  kanjiOnly = false,
  onPractice,
  initialEntryId,
  onBack,
  initialTab,
}: {
  kanjiOnly?: boolean
  onPractice: (item: Item) => void
  initialEntryId?: string
  onBack?: () => void
  initialTab?: string
}) {
  const data = useLearning()
  const location = useLocation()
  const navigate = useNavigate()
  const entryId = initialEntryId || new URLSearchParams(location.search).get("entry")
  const [searchParams, setSearchParams] = useSearchParams()
  const routeTab = "All"
  const learning = data.progress
  const recent = data.recent
  const showRomaji = data.preferences.romaji !== "Hide"
  const romajiVisible = (id: string) =>
    showRomaji &&
    (data.preferences.romaji !== "Show for difficult words" ||
      !learning[id]?.correct ||
      learning[id]?.needsReview)
  const [query, setQuery] = useState("")
  const [dictionaryMatches, setDictionaryMatches] = useState<Vocabulary[]>([])
  const [dictionaryLoading, setDictionaryLoading] = useState(false)
  const [dictionaryError, setDictionaryError] = useState("")
  const [browseEntries, setBrowseEntries] = useState<DictionaryBrowseEntry[]>([])
  const [browsePage, setBrowsePage] = useState(0)
  const [browsePageCount, setBrowsePageCount] = useState(0)
  const [browseResultCount, setBrowseResultCount] = useState(0)
  const [tab, updateTab] = useState(kanjiOnly ? "Kanji" : routeTab)
  useEffect(() => { if (location.pathname.replace(/\/$/, "") === "/dictionary") updateTab(routeTab) }, [routeTab, location.pathname])
  const setTab = (next: string) => {
    updateTab(next)
    if (location.pathname.replace(/\/$/, "") === "/dictionary") setSearchParams(previous => {
      const params = new URLSearchParams(previous)
      if (next === "All") params.delete("tab")
      else params.set("tab", next.toLowerCase())
      return params
    }, { replace: true })
  }
  const [filters, setFilters] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<Word | null>(() => {
    const entry = entryId && contentEntryById(entryId)
    return entry && entry.kind !== "Kanji" ? words.find(word => contentEntryById(word.id)?.id === entry.id) || null : null
  })
  const selectedContent = selected && contentEntryById(selected.id)
  const selectedVocabulary = selectedContent?.kind === "Words" ? selectedContent : null
  const [selectedKanji, setSelectedKanji] = useState<string | null>(() => {
    const entry = entryId && contentEntryById(entryId)
    return entry && entry.kind === "Kanji" ? kanji.find(item => contentEntryById(item.id)?.id === entry.id)?.id || null : null
  })
  const [savedOnly, setSavedOnly] = useState(false)
  const [notice, setNotice] = useState("")
  const [resultPage, setResultPage] = useState(1)
  const resultsHeading = useRef<HTMLDivElement>(null)
  const changePage = (page: number) => {
    setResultPage(page)
    resultsHeading.current?.focus({ preventScroll: true })
    resultsHeading.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
  }
  useEffect(() => {
    if (onBack) return
    const entry = entryId && contentEntryById(entryId)
    setSelected(entry && entry.kind !== "Kanji" ? [...words, ...sentences].find(word => contentEntryById(word.id)?.id === entry.id) || null : null)
    setSelectedKanji(entry && entry.kind === "Kanji" ? kanji.find(item => contentEntryById(item.id)?.id === entry.id)?.id || null : null)
    if (entryId && !entry) setNotice("This dictionary entry is no longer available. Your historical learning data is still safe. Explore another entry below.")
  }, [entryId, onBack])
  const entryPath = (id?: string) => {
    if (onBack) return
    const params = new URLSearchParams(location.search)
    if (id) params.set("entry", contentEntryById(id)?.id || id)
    else params.delete("entry")
    navigate({ pathname: "/dictionary", search: params.toString() }, { replace: !id })
  }
  const openKanji = (id: string) => { setSelected(null); setSelectedKanji(id); entryPath(id) }
  const changeTab = (next: string) => {
    setTab(next)
    if (onBack) return
    const params = new URLSearchParams(location.search)
    if (next === "All") params.delete("tab")
    else params.set("tab", next.toLowerCase())
    navigate({ pathname: "/dictionary", search: params.toString() })
  }
  useEffect(() => setResultPage(1), [query, tab, filters, savedOnly])
  useEffect(() => {
    let active = true
    if (!query.trim() || savedOnly || tab === "Kanji") {
      setDictionaryMatches([])
      setDictionaryError("")
      setDictionaryLoading(false)
      return
    }
    setDictionaryMatches([])
    setDictionaryLoading(true)
    setDictionaryError("")
    searchDictionary(query).then(matches => {
      if (active) setDictionaryMatches(matches.filter(match => !contentEntryById(match.id) && dictionaryEntryMatches(match)))
    }).catch(error => {
      if (active) setDictionaryError(error instanceof Error ? error.message : "Dictionary data unavailable")
    }).finally(() => {
      if (active) setDictionaryLoading(false)
    })
    return () => { active = false }
  }, [query, savedOnly, tab])
  const updateLearning = (id: string, change: { saved: boolean }) =>
    saveItem(id, change.saved)
  const speak = speakJapanese
  const openWord = (word: Word) => {
    setSelected(word)
    setSelectedKanji(null)
    entryPath(word.id)
    const next = [word.id, ...recent.filter((id) => id !== word.id)].slice(0, 5)
    if (word.type !== "Sentence") updateState({ recent: next })
  }
  const toggle = (filter: string) =>
    setFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter],
    )
  const normalized = query.trim().toLowerCase()
  const searchIds = useMemo(() => new Set(searchContent(query)), [query])
  const searchMatches = (id: string) => {
    const entry = contentEntryById(id)
    return !!entry && searchIds.has(entry.id)
  }
  const groupMatches = (group: string[], values: string[]) =>
    !filters.some((filter) => group.includes(filter)) ||
    values.some((value) => filters.includes(value))
  const statusMatches = (id: string) =>
    groupMatches(["Learned", "Not learned", "Incorrect"], [
      learning[id]?.correct ? "Learned" : "Not learned",
      ...(learning[id]?.needsReview ? ["Incorrect"] : []),
    ])
  const writingFilterMatches = (type: WritingType, activeFilters: string[]) => {
    const writingFilters = activeFilters.filter(filter => ["Hiragana", "Katakana", "Kanji", "Mixed", "Kanji + Hiragana", "Kanji + Katakana", "Hiragana + Katakana", "Other"].includes(filter))
    if (!writingFilters.length) return true
    return writingFilters.some(filter =>
      filter === "Mixed"
        ? writingTypeIsMixed(type)
        : filter === writingTypeLabel(type) || (filter === "Hiragana" && type === "hiragana") || (filter === "Katakana" && type === "katakana") || (filter === "Kanji" && type === "kanji"),
    )
  }
  const wordMatches = (word: Word) => {
    return (
      groupMatches(["N5", "N4", "N3", "N2", "N1", "Unclassified"], [word.level]) &&
      writingFilterMatches(writingType(word.japanese), filters) &&
      statusMatches(word.id) &&
      (!savedOnly || learning[word.id]?.saved)
    )
  }
  const dictionaryEntryMatches = (entry: Vocabulary) => {
    return (
      groupMatches(["N5", "N4", "N3", "N2", "N1", "Unclassified"], [entry.jlpt.display]) &&
      writingFilterMatches(entry.writingType || writingType(entry.japanese), filters) &&
      statusMatches(entry.id)
    )
  }
  const matched = useMemo(() => (
    tab === "Sentences"
      ? sentences
      : tab === "All"
        ? [...words, ...sentences]
        : words
  ).filter(
    (word) =>
      wordMatches(word) &&
      searchMatches(word.id),
  ), [query, tab, filters, learning, savedOnly])
  const matchedKanji = useMemo(() => kanji.filter(
    (item) =>
      searchMatches(item.id) &&
      groupMatches(["N5", "N4", "N3", "N2", "N1", "Unclassified"], [item.level]) &&
      writingFilterMatches("kanji", filters) &&
      statusMatches(item.id) &&
      (!savedOnly || learning[item.id]?.saved),
  ), [query, filters, learning, savedOnly])
  const statusFilters = ["Learned", "Not learned", "Incorrect"]
  const isFullBrowse = !normalized && tab === "All" && !savedOnly && !filters.some(filter => statusFilters.includes(filter))
  const isBrowsing = !normalized && (!filters.length || isFullBrowse) && !savedOnly
  const compactBrowseItems = [
    ...(tab === "Sentences" ? sentences : tab === "Kanji" ? [] : words).slice(0, 5).map(word => ({ id: word.id, japanese: word.japanese, kana: word.reading, romaji: word.romaji, meanings: word.meanings.slice(0, 2), level: word.level, writingType: writingType(word.japanese), ordinal: -1 })),
    ...(tab === "Kanji" ? kanji.slice(0, 5).map(item => ({ id: item.id, japanese: item.character, kana: item.on, romaji: item.kun, meanings: item.meanings.slice(0, 2), level: item.level, writingType: "kanji" as const, ordinal: -1 })) : []),
  ]
  const browseItems = isFullBrowse ? browseEntries : compactBrowseItems
  useEffect(() => {
    if (!isFullBrowse) return
    let active = true
    setDictionaryLoading(true)
    Promise.all([browseDictionary(browsePage, filters), dictionaryManifest()]).then(([result, manifest]) => {
      if (!active) return
      setBrowseEntries(result.entries)
      setBrowseResultCount(result.total)
      setBrowsePageCount(Math.ceil(result.total / manifest.browsePageSize))
    }).catch(error => {
      if (active) setDictionaryError(error instanceof Error ? error.message : "Dictionary data unavailable")
    }).finally(() => {
      if (active) setDictionaryLoading(false)
    })
    return () => { active = false }
  }, [isFullBrowse, browsePage, filters])
  useEffect(() => setBrowsePage(0), [tab, filters, savedOnly])
  const results = useMemo(() => [
    ...(tab === "Kanji" ? [] : matched.map(word => ({ kind: "word" as const, word }))),
    ...(tab === "Kanji" ? [] : dictionaryMatches.map(entry => ({ kind: "dictionary" as const, entry }))),
    ...(tab === "Kanji" || tab === "All" ? matchedKanji.map(item => ({ kind: "kanji" as const, item })) : []),
  ], [tab, matched, dictionaryMatches, matchedKanji])
  const paging = pagination(results.length, resultPage)
  useEffect(() => setResultPage(page => pagination(results.length, page).page), [results.length])
  const entry = kanji.find((item) => item.id === selectedKanji)
  const startPractice = (word: { id: string }) => {
    const item = itemById(word.id)
    if (item) onPractice(item)
  }
  const openDictionaryWord = (entry: Vocabulary) => {
    setSelected({
      id: entry.id, kind: "Words", japanese: entry.japanese, reading: entry.kana,
      romaji: entry.romaji, meanings: entry.englishMeanings, level: entry.jlpt.display,
      type: entry.partsOfSpeech.join(" · ") || "Dictionary entry", sentence: "",
      translation: "", sentenceRomaji: "",
      readings: entry.kanaReadings?.map(reading => reading.romaji) || [],
    })
    setSelectedKanji(null)
  }
  const openBrowseEntry = async (item: DictionaryBrowseEntry) => {
    try {
      openDictionaryWord(await dictionaryEntryByOrdinal(item.ordinal))
    } catch (error) {
      setDictionaryError(error instanceof Error ? error.message : "Dictionary entry unavailable")
    }
  }
  const audioButton = (text: string) =>
    data.preferences.pronunciation && (
      <button
        className="dict-icon-button"
        onClick={() => speak(text)}
        aria-label={`Hear ${text}`}
      >
        <Symbol name="audio" />
      </button>
    )
  const wordCard = (word: Word, index: number, sentence = false) => (
    <button
      className={`dict-result tone-${index % 4}`}
      key={word.id}
      onClick={() => openWord(word)}
    >
      <span className="dict-character">{word.japanese.charAt(0)}</span>
      <span className="dict-result-copy">
        <strong lang="ja">{sentence ? word.sentence : word.japanese}</strong>
        <span lang="ja">
          {sentence ? word.sentenceRomaji : word.reading}{" "}
          <small>{!sentence && romajiVisible(word.id) && word.romaji}</small>
        </span>
        {data.preferences.english && (
          <b>
            {sentence ? word.translation : word.meanings.slice(0, 2).join(", ")}
          </b>
        )}
      </span>
      <span className="dict-result-end">
        <span className="dict-badge">{word.level}</span>
        {learning[word.id]?.correct ? (
          <small>✓ Studied</small>
        ) : learning[word.id]?.needsReview ? (
          <small>Needs review</small>
        ) : learning[word.id]?.saved ? (
          <small>★ Saved</small>
        ) : null}
      </span>
      <Symbol name="arrow" />
    </button>
  )

  return (
    <main className="dictionary-page">
      {notice && (
        <button
          className="dict-notice"
          onClick={() => setNotice("")}
          role="status"
        >
          {notice} <span>×</span>
        </button>
      )}
      {selected || entry ? (
        <>
          <button
            className="dict-back"
            onClick={() => {
              if (onBack) { onBack(); return }
              setSelected(null)
              setSelectedKanji(null)
              entryPath()
            }}
          >
            <Symbol name="back" /> {onBack ? "Back to keyboard" : entry ? "Kanji" : "Dictionary"}
          </button>
          <div className="dict-detail-layout">
            <article className="dict-detail">
              <div className="dict-detail-actions">
                <span className="dict-section-label">
                  {entry ? "KANJI EXPLORER" : "WORD DETAIL"}
                </span>
                <div>
                  <button
                    className={`dict-save ${
                      learning[selected?.id || entry!.id]?.saved
                        ? "is-saved"
                        : ""
                    }`}
                    onClick={() =>
                      updateLearning(selected?.id || entry!.id, {
                        saved: !learning[selected?.id || entry!.id]?.saved,
                      })
                    }
                  >
                    <Symbol name="star" />{" "}
                    {learning[selected?.id || entry!.id]?.saved
                      ? "Saved"
                      : "Save"}
                  </button>
                  {itemById(selected?.id || entry!.id) && <button
                    className="dict-primary"
                    onClick={() => startPractice(selected || { id: entry!.id })}
                  >
                    Practice <Symbol name="arrow" />
                  </button>}
                </div>
              </div>
              <div className="dict-entry-title">
                <h1 lang="ja">{selected?.japanese || entry?.character}</h1>
                {audioButton(selected?.japanese || entry!.character)}
              </div>
              {selected && (
                <>
                  <p className="dict-reading" lang="ja">
                    {selected.reading}
                  </p>
                  {romajiVisible(selected.id) && (
                    <p className="dict-romaji">{selected.romaji}</p>
                  )}
                  {!!selectedVocabulary?.kanaReadings?.length && <details className="dict-alternative-readings"><summary>Spellings & readings</summary><p lang="ja">{selectedVocabulary.spellings?.map(spelling => spelling.text).join(" · ")}</p>{selectedVocabulary.kanaReadings.map(reading => <p key={reading.kana}><span lang="ja">{reading.kana}</span>{romajiVisible(selected.id) && <small> · {reading.romaji}</small>}{reading.spellingRestrictions.length > 0 && <small> ({reading.spellingRestrictions.join(" / ")})</small>}</p>)}</details>}
                </>
              )}
              <div className="dict-tags">
                <span className="dict-badge">
                  {selected?.level || entry?.level}
                </span>
                <span>{selected?.type || `${entry?.strokes} strokes`}</span>
                {learning[selected?.id || entry!.id]?.correct ? (
                  <span>
                    ✓ Studied · {learning[selected?.id || entry!.id].correct}{" "}
                    correct
                  </span>
                ) : null}
              </div>
              <section>
                <h2>Meanings</h2>
                {selectedVocabulary?.senses?.length ? <ol>{selectedVocabulary.senses.map(sense => <li key={sense.sourceOrder}><p>{sense.meanings.join("; ")}</p>{(sense.spellingRestrictions.length > 0 || sense.readingRestrictions.length > 0) && <small>{[...sense.spellingRestrictions, ...sense.readingRestrictions].join(" · ")}</small>}{sense.information.length > 0 && <small>{sense.information.join(" · ")}</small>}</li>)}</ol> : <ul>
                  {(selected?.meanings || entry!.meanings).map((meaning) => (
                    <li key={meaning}>{meaning}</li>
                  ))}
                </ul>}
              </section>
              {selected ? (
                <>
                  {selected.sentence && <section className="dict-example">
                    <div className="dict-section-row">
                      <h2>Example sentence</h2>
                      {audioButton(selected.sentence)}
                    </div>
                    <p lang="ja">{selected.sentence}</p>
                    {romajiVisible(selected.id) && (
                      <small>{selected.sentenceRomaji}</small>
                    )}
                    <p>{selected.translation}</p>
                  </section>}
                  <section>
                    <h2>Word information</h2>
                    <dl>
                      <div>
                        <dt>JLPT level</dt>
                        <dd>{selected.level}</dd>
                      </div>
                      <div>
                        <dt>Word type</dt>
                        <dd>{selected.type}</dd>
                      </div>
                      <div>
                        <dt>Reading</dt>
                        <dd>
                          {selected.reading} <small>({selected.romaji})</small>
                        </dd>
                      </div>
                      <div>
                        <dt>Kanji</dt>
                        <dd>
                          {[...selected.japanese]
                            .filter((character) => /[一-龯]/.test(character))
                            .map((character) =>
                              kanji.some((item) => item.character === character) ? (
                                <button
                                  className="dict-kanji-link"
                                  key={character}
                                  onClick={() => {
                                    openKanji(kanji.find(item => item.character === character)!.id)
                                  }}
                                >
                                  {character} ↗
                                </button>
                              ) : (
                                <span key={character}>{character} </span>
                              ),
                            )}
                        </dd>
                      </div>
                    </dl>
                  </section>
                  {examplesFor(selected.id).length > 0 && <section><h2>Practice sentences</h2><div className="dict-related">{examplesFor(selected.id).slice(0, 5).map((sentence, index) => wordCard(sentence, index, true))}</div></section>}
                </>
              ) : (
                <>
                  <section>
                    <h2>Readings</h2>
                    <div className="dict-readings">
                      <div>
                        <small>On’yomi · 音読み</small>
                        <p>{entry!.on}</p>
                      </div>
                      <div>
                        <small>Kun’yomi · 訓読み</small>
                        <p>{entry!.kun}</p>
                      </div>
                    </div>
                  </section>
                  <section>
                    <h2>Kanji information</h2>
                    <dl>
                      {[
                        ["JLPT", entry!.level],
                        ["Radical", entry!.radical],
                        ["Stroke count", entry!.strokes],
                        ["School grade", entry!.grade],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value ?? "Not supplied"}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <KanjiStrokePlayer key={entry!.id} character={entry!.character} />
                </>
              )}
              <section>
                <h2>{entry ? "Words using this kanji" : "Related words"}</h2>
                <div className="dict-related">
                  {relatedWords(selected?.id || entry!.id)
                    .slice(0, 5)
                    .map((word, index) => wordCard(word, index))}
                  {selected &&
                    !relatedWords(selected.id).length && (
                      <p className="dict-muted">
                        No related entries in this starter collection yet.
                      </p>
                    )}
                </div>
              </section>
            </article>
            <aside className="dict-detail-aside">
              <span className="dict-section-label">MAKE IT YOURS</span>
              <h3>
                A little practice.
                <br />A lasting memory.
              </h3>
              <p>
                Take this discovery with you. Practice at your own pace,
                whenever you’re ready.
              </p>
              <button
                className="dict-primary"
                onClick={() =>
                  startPractice(
                    selected || { id: entry!.id },
                  )
                }
              >
                Practice this {entry ? "kanji" : "word"} <Symbol name="arrow" />
              </button>
              <small>Progress stays on this device.</small>
            </aside>
          </div>
        </>
      ) : (
        <>
          <header className="dict-header">
            <div>
              <p className="dict-section-label">YOUR JAPANESE, YOUR WAY</p>
              <h1>
                {kanjiOnly ? "Kanji" : "Dictionary"}
                <span lang="ja">{kanjiOnly ? "漢字" : "辞書"}</span>
              </h1>
              <p>
                Every word is a new beginning. Find something you want to learn.
              </p>
            </div>
            <span className="dict-offline">
              <span /> Available offline
            </span>
          </header>
          <div className="dict-layout">
            <div className="dict-content">
              <div className="dict-search-box">
                <Symbol name="search" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search Japanese or English..."
                  aria-label="Search Japanese, romaji or English"
                />
                {query ? (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                ) : (
                  <span>あ / A</span>
                )}
              </div>
              <div className="dict-toolbar">
                <div
                  className="dict-tabs"
                  role="tablist"
                  aria-label="Dictionary category"
                  onKeyDown={navigateTabs}
                >
                  {["All"].map((item) => (
                    <button
                      role="tab"
                      aria-selected={tab === item}
                      aria-controls="dictionary-results"
                      tabIndex={tab === item ? 0 : -1}
                      className={tab === item ? "active" : ""}
                      key={item}
                      onClick={() => changeTab(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <button
                  className={`dict-filter-button ${
                    showFilters ? "active" : ""
                  }`}
                  aria-expanded={showFilters}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Symbol name="filter" /> Filters{" "}
                  {filters.length > 0 && <b>{filters.length}</b>}
                </button>
              </div>
              {showFilters && (
                <section className="dict-filters">
                  {[
                    ["JLPT level", "N5", "N4", "N3", "N2", "N1", "Unclassified"],
                    ["Writing system", "Hiragana", "Katakana", "Kanji", "Mixed", "Kanji + Hiragana", "Kanji + Katakana", "Hiragana + Katakana", "Other"],
                    ["Learning status", "Learned", "Not learned", "Incorrect"],
                  ].map(([label, ...options]) => (
                    <fieldset key={label}>
                      <legend>{label}</legend>
                      <div>
                        {options.map((option) => (
                          <button
                            key={option}
                            aria-pressed={filters.includes(option)}
                            className={
                              filters.includes(option) ? "selected" : ""
                            }
                            onClick={() => toggle(option)}
                          >
                            <span>{filters.includes(option) ? "✓" : "+"}</span>
                            {option}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <button
                    className="dict-text-button"
                    onClick={() => setFilters([])}
                  >
                    Reset filters
                  </button>
                </section>
              )}
              {filters.length > 0 && !showFilters && (
                <div className="dict-active-filters">
                  {filters.map((filter) => (
                    <button key={filter} onClick={() => toggle(filter)}>
                      {filter} ×
                    </button>
                  ))}
                  <button onClick={() => setFilters([])}>Clear all</button>
                </div>
              )}
              <div ref={resultsHeading} tabIndex={-1} className="dict-section-row dict-results-heading">
                <h2>
                  {isBrowsing
                    ? tab === "All" && recent.length
                      ? "Recently explored"
                      : "Start exploring"
                    : savedOnly
                      ? "Saved entries"
                      : "Search results"}{" "}
                  <span>
                    {isBrowsing
                      ? isFullBrowse ? `${browseResultCount ? browsePage * 25 + 1 : 0}–${Math.min((browsePage + 1) * 25, browseResultCount)} of ${browseResultCount}` : browseItems.length
                      : results.length}
                  </span>
                </h2>
                {savedOnly && (
                  <button
                    className="dict-text-button"
                    onClick={() => setSavedOnly(false)}
                  >
                    Show all
                  </button>
                )}
                {isBrowsing && (
                  <span className="dict-muted">
                    {tab === "All" && recent.length
                      ? "Pick up where you left off"
                      : "Find your first word"}
                  </span>
                )}
              </div>
              <div className="dict-results" id="dictionary-results" role="tabpanel" aria-label={`${tab} dictionary results`}>
                {dictionaryLoading && <p className="dict-muted" role="status">Searching full JMdict dictionary…</p>}
                {dictionaryError && <p className="dict-notice" role="alert">Full dictionary unavailable offline. {dictionaryError}</p>}
                {isBrowsing ? (
                  browseItems.map((item, index) => (
                    <button className={`dict-result tone-${index % 4}`} key={item.id} onClick={() => item.ordinal >= 0 ? void openBrowseEntry(item) : undefined}>
                      <span className="dict-character">{item.japanese.charAt(0)}</span>
                      <span className="dict-result-copy">
                        <strong lang="ja">{item.japanese}</strong>
                        <span lang="ja">{item.kana} <small>{item.romaji}</small></span>
                        {data.preferences.english && <b>{item.meanings.join(", ")}</b>}
                      </span>
                      <span className="dict-result-end"><span className="dict-badge">{item.level}</span></span>
                      <Symbol name="arrow" />
                    </button>
                  ))
                ) : (
                  <>
                    {results.slice(paging.start, paging.end).map((result, index) => {
                      if (result.kind === "word") return wordCard(result.word, index, result.word.type === "Sentence")
                      if (result.kind === "dictionary") return (
                        <button className={`dict-result tone-${index % 4}`} key={result.entry.id} onClick={() => openDictionaryWord(result.entry)}>
                          <span className="dict-character">{result.entry.japanese.charAt(0)}</span>
                          <span className="dict-result-copy">
                            <strong lang="ja">{result.entry.japanese}</strong>
                            <span lang="ja">{result.entry.kana} <small>{result.entry.romaji}</small></span>
                            {data.preferences.english && <b>{result.entry.englishMeanings.slice(0, 2).join(", ")}</b>}
                          </span>
                          <span className="dict-result-end"><span className="dict-badge">Unclassified</span></span>
                          <Symbol name="arrow" />
                        </button>
                      )
                      const item = result.item
                      return (
                        <button
                          className="dict-result tone-2"
                          key={item.id}
                          onClick={() => openKanji(item.id)}
                        >
                          <span className="dict-character">{item.character}</span>
                          <span className="dict-result-copy">
                            <strong lang="ja">{item.character}</strong>
                            <span>{item.on}</span>
                            <b>{item.meanings.join(", ")}</b>
                          </span>
                          <span className="dict-badge">{item.level}</span>
                          <Symbol name="arrow" />
                        </button>
                      ) })}
                  </>
                )}
              </div>
              {isFullBrowse && browsePageCount > 1 && (
                <nav className="dict-pagination" aria-label="Full dictionary browse pages">
                  <p role="status">Page {browsePage + 1} / {browsePageCount}</p>
                  <div>
                    <button className="dict-text-button" disabled={browsePage === 0} onClick={() => setBrowsePage(page => page - 1)}>← Previous</button>
                    <button className="dict-text-button" disabled={browsePage + 1 >= browsePageCount} onClick={() => setBrowsePage(page => page + 1)}>Next →</button>
                  </div>
                </nav>
              )}
              {!isBrowsing && results.length > 0 && (
                <nav className="dict-pagination" aria-label="Dictionary result pages">
                  <p role="status">{paging.start + 1}–{paging.end} of {results.length} · Page {paging.page} / {paging.pages}</p>
                  <div><button className="dict-text-button" disabled={paging.page === 1} onClick={() => changePage(paging.page - 1)}>← Previous</button>
                    {paging.numbers.map((page, index) => <span key={page}>{index > 0 && page - paging.numbers[index - 1] > 1 && <span aria-hidden="true">…</span>}<button className="dict-text-button" aria-label={`Page ${page}`} aria-current={page === paging.page ? "page" : undefined} onClick={() => changePage(page)}>{page}</button></span>)}
                    <button className="dict-text-button" disabled={paging.page === paging.pages} onClick={() => changePage(paging.page + 1)}>Next →</button></div>
                </nav>
              )}
              {!isBrowsing &&
                !(tab === "Kanji"
                  ? matchedKanji.length
                  : tab === "All"
                    ? results.length
                    : results.length) && (
                  <div className="dict-empty">
                    <Symbol name="search" />
                    <h3>{savedOnly && !query && !filters.length ? "You haven’t saved anything yet." : "No matching entries found."}</h3>
                    <p>
                      {savedOnly ? "Save an entry from its details to find it here, or show all entries." : "Try another spelling or remove a filter to broaden your search."}
                    </p>
                    <button
                      className="dict-text-button"
                      onClick={() => {
                        setQuery("")
                        setFilters([])
                        setSavedOnly(false)
                      }}
                    >
                      Reset search
                    </button>
                  </div>
                )}
              {isBrowsing && (
                <section className="dict-browse">
                  <h2>Find your next discovery</h2>
                  <div>
                    {[
                      {
                        name: "Words",
                        glyph: "あ",
                        text: "A word for every day",
                      },
                      {
                        name: "Kanji",
                        glyph: "漢",
                        text: "Meaning in every stroke",
                      },
                      {
                        name: "Sentences",
                        glyph: "文",
                        text: "See Japanese in context",
                      },
                    ].map((item) => (
                      <button key={item.name} onClick={() => changeTab(item.name)}>
                        <span>{item.glyph}</span>
                        <strong>{item.name}</strong>
                        <small>{item.text}</small>
                        <Symbol name="arrow" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <footer className="dict-footer">
                <Symbol name="book" />
                <span>
                  Full JMdict reference · compact practice content stays local
                </span>
                <span>Cached entries work offline</span>
              </footer>
            </div>
            <aside className="dict-aside">
              <section className="dict-discovery">
                <div className="dict-paper-character" lang="ja">
                  学<span>まなぶ</span>
                </div>
                <span className="dict-section-label">ONE WORD AT A TIME</span>
                <h3>Follow your curiosity.</h3>
                <p>
                  Look up a word. Explore its meaning. Make it part of your
                  Japanese.
                </p>
                <div className="dict-aside-line" />
                <small>
                  No lessons to unlock.
                  <br />
                  Just you and your next discovery.
                </small>
              </section>
              <button
                className={`dict-saved-card ${savedOnly ? "selected" : ""}`}
                onClick={() => setSavedOnly(!savedOnly)}
              >
                <span>
                  <Symbol name="star" />
                </span>
                <div>
                  <strong>Your saved entries</strong>
                  <small>
                    {
                      items.filter(
                        (item) =>
                          ["Words", "Kanji", "Sentences"].includes(item.kind) &&
                          learning[item.id]?.saved,
                      ).length
                    }{" "}
                    entries to come back to
                  </small>
                </div>
                <Symbol name="arrow" />
              </button>
              <div className="dict-tip">
                <span>ちょっとしたヒント</span>
                <h4>A little tip</h4>
                <p>
                  Try <button onClick={() => setQuery("eat")}>eat</button>,{" "}
                  <button onClick={() => setQuery("taberu")}>taberu</button>, or{" "}
                  <button onClick={() => setQuery("食べる")}>食べる</button>.
                  <br />
                  Different ways to the same word.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
      <p className="dict-local-credit">Vocabulary & kanji: JMdict / KANJIDIC2 © James William Breen & EDRDG · CC BY-SA 4.0. Sources & licences in Settings.</p>
    </main>
  )
}
