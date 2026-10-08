import { useSyncExternalStore } from "react"
import { practiceItems as items, practiceItemById as itemById, registerDictionaryPracticeItems } from "./content/catalog"
export { practiceItems as items, practiceItemById as itemById } from "./content/catalog"
export { toKatakana } from "./content/catalog"

import type { ContentKind, PracticeItem } from "./content/model"
import { appearances, defaultAppearance, type Appearance } from "./appearance"
import { defaultWritingSettings, validWritingSettings, type WritingSettings } from "./writing/settings"
import { writingSystems } from "./content/writingType"
export type Content = ContentKind
export type Mode = "Flashcards" | "Identification" | "Romaji Input" | "Sentence Formation"
export type Direction = "Japanese → English" | "Japanese → Romaji" | "Romaji → Japanese" | "English → Japanese" | "English → Romaji" | "Romaji → English" | "Kana → Romaji" | "Romaji → Kana" | "Randomize"
export type AnswerType = "Typing" | "Multiple Choice" | "Self Check" | "Sentence typing" | "Drawing" | "Randomize"
export const understandingRatings = ["Forgotten", "Hesitated", "Aware", "Obvious"] as const
export type Understanding = typeof understandingRatings[number]
const isUnderstanding = (value: unknown): value is Understanding => understandingRatings.includes(value as Understanding)
const validContentId = (id: string) => id.length > 0 && id.length <= 200 && !["__proto__", "constructor", "prototype"].includes(id) && !/[\u0000-\u001f]/.test(id)
const validRatings = (value: unknown) => object(value) && Object.entries(value).every(([id, rating]) => validContentId(id) && isUnderstanding(rating))
export type Item = PracticeItem
export type Config = {
  mode: Mode
  content: Content[]
  levels: string[]
  writing: string[]
  direction: Direction
  answerType: AnswerType
  limit: number
  reviewOnly: boolean
  learnedOnly: boolean
  sentenceMinWords?: number
  sentenceMaxWords?: number
  randomizeAnswerType?: boolean
  randomSeed?: number
}
export type Profile = {
  name: string
  age: string
  currentLevel: string
  targetLevel: string
}
export type Preferences = {
  tutorialSeen?: boolean
  writing?: WritingSettings
  writingMode?: "Study" | "Write"
  appearance?: Appearance
  romaji: "Always show" | "Show for difficult words" | "Hide"
  english: boolean
  pronunciation: boolean
  representation: "Romaji" | "Kana" | "Kanji"
}
export type ItemProgress = {
  scheduling?: {
    nextReviewAt?: string
    intervalDays?: number
    difficulty?: number
    stability?: number
    ease?: number
  }
  selfChecks?: number
  understanding?: Understanding
  saved: boolean
  correct: number
  incorrect: number
  needsReview: boolean
  lastPracticed?: string
}
export type Session = {
  ratings?: Record<string, Understanding>
  id: string
  date: string
  mode: Mode
  total: number
  correct: number
  incorrect: number
  newItems: number
  mistakes: string[]
}
export type ActiveSession = {
  id: string
  date: string
  config: Config
  ids: string[]
  index: number
  answers: Record<string, boolean | Understanding>
  newItems: string[]
  retried: string[]
}
export type LearningState = {
  version: 1
  onboarded: boolean
  language: string
  profile: Profile
  preferences: Preferences
  progress: Record<string, ItemProgress>
  history: Session[]
  recent: string[]
  practiceConfig: Config
  activeSession: ActiveSession | null
}

export const defaultConfig: Config = {
  mode: "Flashcards",
  content: ["Kanji"],
  levels: ["N5", "N4", "N3", "N2", "N1", "Unclassified"],
  writing: ["Hiragana", "Katakana", "Kanji"],
  direction: "Japanese → Romaji",
  answerType: "Typing",
  limit: 10,
  reviewOnly: false,
  learnedOnly: false,
  sentenceMinWords: 3,
  sentenceMaxWords: 8,
}
const defaults: LearningState = {
  version: 1,
  onboarded: false,
  language: "English",
  profile: { name: "", age: "", currentLevel: "Beginner", targetLevel: "N5" },
  preferences: {
    writing: defaultWritingSettings,
    appearance: defaultAppearance,
    romaji: "Always show",
    english: true,
    pronunciation: true,
    representation: "Kanji",
  },
  progress: {},
  history: [],
  recent: [],
  practiceConfig: defaultConfig,
  activeSession: null,
}
const storageKey = "manabu-learning-v1"
let storageError = false
let protectUnreadableStorage = false
let recoveryNotice = ""
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
const finiteCount = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
const levels = ["Beginner", "N5", "N4", "N3", "N2", "N1"]
const modes = ["Flashcards", "Identification", "Romaji Input", "Sentence Formation"]
const writingWordContent = ["Hiragana word", "Katakana word", "Kanji word"] as const
const supportedContent = ["All", "Randomize", "Hiragana", "Katakana", "Kanji", ...writingWordContent, "Words", "Sentences", "Basics", "Dakuon", "Handakuon", "Yoon"]
const writingSystemForWordContent = (content: Content) =>
  content === "Hiragana word" ? "Hiragana" :
    content === "Katakana word" ? "Katakana" :
      content === "Kanji word" ? "Kanji" : null
const isWritingWordContent = (content: Content) =>
  writingWordContent.includes(content as typeof writingWordContent[number])
export function validPracticeConfig(value: unknown): value is Config {
  return object(value) && modes.includes(String(value.mode)) &&
    stringArray(value.content) && value.content.every(kind => supportedContent.includes(kind)) &&
    stringArray(value.levels) && value.levels.every(level => [...levels.slice(1), "Unclassified"].includes(level)) &&
    stringArray(value.writing) && value.writing.every(system => ["Hiragana", "Katakana", "Kanji"].includes(system)) &&
    ["Japanese → English", "Japanese → Romaji", "Romaji → Japanese", "English → Japanese", "English → Romaji", "Romaji → English", "Kana → Romaji", "Romaji → Kana", "Randomize"].includes(String(value.direction)) &&
    ["Typing", "Multiple Choice", "Self Check", "Sentence typing", "Drawing", "Randomize"].includes(String(value.answerType)) &&
    typeof value.limit === "number" && Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= 50 &&
    typeof value.reviewOnly === "boolean" && typeof value.learnedOnly === "boolean"
}
export function validActiveSession(value: unknown): value is ActiveSession {
  if (!object(value) || !validPracticeConfig(value.config) || typeof value.id !== "string" || typeof value.date !== "string" || Number.isNaN(Date.parse(value.date)) ||
    !stringArray(value.ids) || !value.ids.length || value.ids.length > 10000 || new Set(value.ids).size !== value.ids.length || !value.ids.every(id => itemById(id)) ||
    !Number.isInteger(value.index) || Number(value.index) < 0 || Number(value.index) >= value.ids.length || !object(value.answers) || !stringArray(value.newItems) || !stringArray(value.retried)) return false
  const ids = value.ids, answers = value.answers
  const selfCheck = value.config.answerType === "Self Check" && value.config.mode !== "Sentence Formation"
  const randomized = value.config.answerType === "Randomize"
  return Object.entries(answers).every(([id, answer]) => ids.includes(id) && (randomized ? (typeof answer === "boolean" || isUnderstanding(answer)) : selfCheck ? isUnderstanding(answer) : typeof answer === "boolean")) &&
    value.newItems.every(id => ids.includes(id)) && value.retried.every(id => ids.includes(id) && answers[id] === false) &&
    ids.slice(0, Number(value.index)).every(id => Object.prototype.hasOwnProperty.call(answers, id))
}
export function validateBackup(value: unknown): LearningState {
  if (
    !object(value) ||
    value.version !== 1 ||
    typeof value.onboarded !== "boolean" ||
    typeof value.language !== "string" ||
    !object(value.profile) ||
    !object(value.preferences) ||
    !object(value.progress) ||
    !Array.isArray(value.history) ||
    !stringArray(value.recent) || !value.recent.every(validContentId)
  )
    throw new Error("This is not a valid Manabu backup.")
  const profile = value.profile
  if (
    typeof profile.name !== "string" ||
    profile.name.length > 100 ||
    typeof profile.age !== "string" ||
    (profile.age !== "" &&
      (!/^\d{1,3}$/.test(profile.age) ||
        Number(profile.age) < 1 ||
        Number(profile.age) > 120)) ||
    !levels.includes(String(profile.currentLevel)) ||
    !levels.slice(1).includes(String(profile.targetLevel))
  )
    throw new Error("Invalid profile in backup.")
  const preferences = value.preferences
  if (
    !["Always show", "Show for difficult words", "Hide"].includes(
      String(preferences.romaji),
    ) ||
    !["Romaji", "Kana", "Kanji"].includes(String(preferences.representation)) ||
    typeof preferences.english !== "boolean" ||
    typeof preferences.pronunciation !== "boolean" ||
    (preferences.appearance !== undefined && !appearances.includes(preferences.appearance as Appearance)) ||
    (preferences.writing !== undefined && !validWritingSettings(preferences.writing)) ||
    (preferences.writingMode !== undefined && !["Study", "Write"].includes(String(preferences.writingMode))) ||
    (preferences.tutorialSeen !== undefined && typeof preferences.tutorialSeen !== "boolean")
  )
    throw new Error("Invalid preferences in backup.")
  for (const [id, progress] of Object.entries(value.progress)) {
    if (
      !validContentId(id) ||
      !object(progress) ||
      typeof progress.saved !== "boolean" ||
      !finiteCount(progress.correct) ||
      !finiteCount(progress.incorrect) ||
      typeof progress.needsReview !== "boolean" ||
      (progress.selfChecks !== undefined && !finiteCount(progress.selfChecks)) ||
      (progress.understanding !== undefined && !isUnderstanding(progress.understanding)) ||
      (progress.scheduling !== undefined && (!object(progress.scheduling) || Object.entries(progress.scheduling).some(([field, value]) => field === "nextReviewAt" ? typeof value !== "string" || Number.isNaN(Date.parse(value)) : !["intervalDays", "difficulty", "stability", "ease"].includes(field) || typeof value !== "number" || !Number.isFinite(value) || value < 0))) ||
      (progress.lastPracticed !== undefined &&
        (typeof progress.lastPracticed !== "string" ||
          Number.isNaN(Date.parse(progress.lastPracticed))))
    )
      throw new Error("Invalid learning progress in backup.")
  }
  for (const session of value.history) {
    if (
      !object(session) ||
      typeof session.id !== "string" ||
      typeof session.date !== "string" ||
      Number.isNaN(Date.parse(session.date)) ||
      !modes.includes(String(session.mode)) ||
      !finiteCount(session.total) ||
      !finiteCount(session.correct) ||
      !finiteCount(session.incorrect) ||
      !finiteCount(session.newItems) ||
      !stringArray(session.mistakes) || !session.mistakes.every(validContentId) ||
      (session.ratings !== undefined && !validRatings(session.ratings)) ||
      Number(session.correct) + Number(session.incorrect) + (object(session.ratings) ? Object.keys(session.ratings).length : 0) !== session.total
    )
    throw new Error("Invalid practice history in backup.")
  }
  if (new Set(value.history.map(session => session.id)).size !== value.history.length) throw new Error("This backup contains duplicate sessions. Choose another backup.")
  const practiceConfig = object(value.practiceConfig)
    ? value.practiceConfig
    : {}
  const validConfig =
    modes.includes(String(practiceConfig.mode)) &&
    stringArray(practiceConfig.content) &&
    practiceConfig.content.every((kind) =>
      supportedContent.includes(kind),
    ) &&
    stringArray(practiceConfig.levels) &&
    practiceConfig.levels.every((level) => [...levels.slice(1), "Unclassified"].includes(level)) &&
    stringArray(practiceConfig.writing) &&
    practiceConfig.writing.every((system) =>
      ["Hiragana", "Katakana", "Kanji"].includes(system),
    ) &&
    [
      "Japanese → Romaji",
      "Romaji → Japanese",
      "Japanese → English",
      "English → Japanese",
      "English → Romaji",
      "Romaji → English",
      "Kana → Romaji",
      "Romaji → Kana",
      "Randomize",
    ].includes(String(practiceConfig.direction)) &&
    ["Typing", "Multiple Choice", "Self Check", "Randomize"].includes(
      String(practiceConfig.answerType),
    ) &&
    typeof practiceConfig.limit === "number" &&
    practiceConfig.limit >= 1 &&
    practiceConfig.limit <= 50 &&
    typeof practiceConfig.reviewOnly === "boolean" &&
    typeof practiceConfig.learnedOnly === "boolean"
  return {
    ...defaults,
    ...value,
    profile,
    preferences: { ...preferences, appearance: preferences.appearance || defaultAppearance, writing: preferences.writing || defaultWritingSettings },
    progress: { ...value.progress },
    history: value.history.slice(-100),
    practiceConfig,
    activeSession: null,
  } as LearningState
}
function loadState(): LearningState {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const raw = JSON.parse(saved)
      const validated = validateBackup(raw)
      const active = raw.activeSession
      const activeIds = object(active) && stringArray(active.ids) ? active.ids : []
      const activeAnswers = object(active) && object(active.answers) ? active.answers : {}
      if (
        object(active) &&
        typeof active.id === "string" &&
        object(active.config) && Object.keys(defaultConfig).every(key => JSON.stringify((active.config as Record<string, unknown>)[key]) === JSON.stringify(validated.practiceConfig[key as keyof Config])) &&
        typeof active.date === "string" &&
        !Number.isNaN(Date.parse(active.date)) &&
        stringArray(active.ids) &&
        active.ids.length > 0 &&
        new Set(active.ids).size === active.ids.length &&
        active.ids.every((id) => validContentId(id) && itemById(id)) &&
        Number.isInteger(active.index) &&
        Number(active.index) >= 0 &&
        Number(active.index) < active.ids.length &&
        object(active.answers) &&
        Object.entries(active.answers).every(
          ([id, answer]) => activeIds.includes(id) && (
            validated.practiceConfig.randomizeAnswerType ||
            validated.practiceConfig.answerType === "Self Check"
              ? isUnderstanding(answer) || typeof answer === "boolean"
              : typeof answer === "boolean"
          ),
        ) &&
        stringArray(active.newItems) &&
        stringArray(active.retried) &&
        [...active.newItems, ...active.retried].every(id => activeIds.includes(id)) &&
        active.ids.slice(0, Number(active.index)).every(id => id in activeAnswers)
      )
        validated.activeSession = ({
          ...active,
          config: validated.practiceConfig,
        } as ActiveSession)
      else if (active !== null && active !== undefined) recoveryNotice = "We couldn’t resume the saved practice session. Your recorded progress is still safe. Start another session in Practice."
      return validated
    }
    const legacy = JSON.parse(
      localStorage.getItem("manabu-dictionary-learning") || "{}",
    )
    const progress: LearningState["progress"] = {}
    if (object(legacy))
      for (const [id, record] of Object.entries(legacy))
        if (itemById(id) && object(record))
          progress[id] = {
            saved: record.saved === true,
            correct: finiteCount(record.correct) ? Number(record.correct) : 0,
            incorrect: finiteCount(record.incorrect)
              ? Number(record.incorrect)
              : 0,
            needsReview: Number(record.incorrect) > 0,
          }
    const legacyRecent = JSON.parse(localStorage.getItem("manabu-dictionary-recent") || "[]")
    const recent = stringArray(legacyRecent) ? legacyRecent.filter(id => itemById(id)?.kind === "Words").slice(0, 5) : []
    return { ...defaults, progress, recent }
  } catch {
    storageError = true
    protectUnreadableStorage = true
    return { ...defaults }
  }
}
let state = loadState()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const useLearning = () => useSyncExternalStore(subscribe, () => state)
export const hasStorageError = () => storageError
export const getRecoveryNotice = () => recoveryNotice
function persistState(next: LearningState, restoring = false) {
  try {
    if (protectUnreadableStorage && !restoring) throw new Error("Existing unreadable data is protected until restore.")
    localStorage.setItem(storageKey, JSON.stringify(next))
    storageError = false
    return true
  } catch {
    storageError = true
    return false
  }
}
export function updateState(change: Partial<LearningState>) {
  state = { ...state, ...change }
  const persisted = persistState(state)
  listeners.forEach((listener) => listener())
  return persisted
}
export function saveItem(id: string, saved?: boolean) {
  if (!validContentId(id)) return
  id = itemById(id)?.id || id
  const progress = state.progress[id] || {
    saved: false,
    correct: 0,
    incorrect: 0,
    needsReview: false,
  }
  updateState({
    progress: {
      ...state.progress,
      [id]: { ...progress, saved: saved ?? !progress.saved },
    },
  })
}
export const shuffle = <Value>(values: Value[]): Value[] => {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}
const kanaOnly = (item: Item) =>
  item.kind === "Hiragana" || item.kind === "Katakana"
export const availableDirections = (_content: Content[]): Direction[] =>
  [
          "Japanese → Romaji",
          "Romaji → Japanese",
          "Japanese → English",
          "English → Japanese",
          "English → Romaji",
          "Romaji → English",
          "Randomize",
        ]
export const flashcardDirections: Direction[] = [
  "Japanese → Romaji",
  "Romaji → Japanese",
]
export function eligibleItems(
  config: Config,
  progress = state.progress,
): Item[] {
  return items.filter((item) => {
    const matchesContent = config.content.some(content =>
      content === "All" ||
      content === item.kind ||
      (["Basics", "Dakuon", "Handakuon", "Yoon"] as string[]).includes(content) &&
        (item.kind === "Hiragana" || item.kind === "Katakana") &&
        item.group === ({ Basics: "Basic", Dakuon: "Dakuon", Handakuon: "Handakuon", Yoon: "Yoon" } as Record<string, string>)[content] ||
      (isWritingWordContent(content) &&
        item.kind === "Words" &&
        writingSystems(item.japanese).includes(writingSystemForWordContent(content)!)),
    )
    if (!matchesContent) return false
    if (!kanaOnly(item) && !config.levels.includes(item.level)) return false
    if (config.mode === "Sentence Formation" && !item.tokens) return false
    if (
      config.mode !== "Sentence Formation" &&
      ["Japanese → English", "English → Japanese"].includes(config.direction) &&
      kanaOnly(item)
    )
      return false
    if (config.reviewOnly && !progress[item.id]?.needsReview) return false
    if (config.learnedOnly && !progress[item.id]?.correct) return false
    if (item.kind === "Words" || item.kind === "Sentences") {
      if (!writingSystems(item.japanese).some(system => config.writing.includes(system))) return false
    }
    return true
  })
}
export function beginSession(config: Config, ids?: string[]) {
  if (!validPracticeConfig(config)) return false
  const sessionConfig = resolvePracticeConfig(config)
  const deck = ids
    ? [...new Set(ids.map(id => itemById(id)).filter((item): item is Item => !!item && (sessionConfig.mode !== "Sentence Formation" || !!item.tokens?.length)).map(item => item.id))]
    : shuffle(eligibleItems(sessionConfig).map((item) => item.id)).slice(
        0,
        config.limit,
      )
  if (!deck.length) return false
  if (sessionConfig.randomizeAnswerType && typeof window !== "undefined" && window.location.hostname === "localhost") {
    console.debug(
      "[Manabu] answer randomization",
      { seed: sessionConfig.randomSeed, cards: deck.map((id, index) => {
        const item = itemById(id)
        return item ? { index, id, answerType: configForItem(sessionConfig, item, index).answerType } : null
      }) },
    )
  }
  updateState({
    practiceConfig: sessionConfig,
    activeSession: {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      config: sessionConfig,
      ids: deck,
      index: 0,
      answers: {},
      newItems: [],
      retried: [],
    },
  })
  return true
}
export function resolvePracticeConfig(config: Config): Config {
  const contentChoices = config.content.filter(content => content !== "Randomize")
  // Randomize mixes the selected content kinds throughout the deck. It must
  // not collapse to one kind when the session starts.
  const sessionContent: Content[] = config.content.includes("Randomize")
    ? (contentChoices.length ? contentChoices : ["All"])
    : contentChoices
  const sessionConfig = {
    ...config,
    content: sessionContent,
    answerType: config.answerType === "Randomize"
      ? (["Typing", "Multiple Choice", "Self Check"] as AnswerType[])[Math.floor(Math.random() * 3)]
      : config.answerType,
    randomizeAnswerType: config.answerType === "Randomize",
    randomSeed: config.randomSeed ?? Math.floor(Math.random() * 0x100000000),
  }
  return sessionConfig
}
const cardSeed = (id: string) => [...id].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 7)
export function configForItem(config: Config, item: Item, position = 0): Config {
  const seed = (cardSeed(item.id) + position + (config.randomSeed || 0)) >>> 0
  const directions = flashcardDirections
  const answerTypes: AnswerType[] = ["Multiple Choice", "Typing", "Self Check"]
  if (
    (item.kind === "Hiragana" || item.kind === "Katakana") &&
    ["Basic", "Dakuon", "Handakuon"].includes(item.group || "")
  )
    answerTypes.push("Drawing")
  const answerType = config.randomizeAnswerType
    ? answerTypes[seed % answerTypes.length]
    : config.answerType
  return {
    ...config,
    direction: config.direction === "Randomize" ? directions[seed % directions.length] : config.direction,
    answerType,
  }
}
export function registerDictionaryItems(entries: Item[]) {
  registerDictionaryPracticeItems(entries)
}
export function recordAnswer(id: string, correct: boolean, retry = false) {
  const session = state.activeSession
  const current = session && itemById(session.ids[session.index])
  const cardConfig = current ? configForItem(session.config, current, session.index) : null
  if (!session || cardConfig?.answerType === "Self Check" || session.ids[session.index] !== id) return false
  const progress = state.progress[id] || {
    saved: false,
    correct: 0,
    incorrect: 0,
    needsReview: false,
  }
  const firstAttempt = !(id in session.answers)
  if (!firstAttempt && (!retry || session.answers[id] !== false || session.retried.includes(id))) return false
  const newItems =
    !progress.correct && correct ? [...session.newItems, id] : session.newItems
  updateState({
    progress: {
      ...state.progress,
      [id]: {
        ...progress,
        correct: progress.correct + Number(correct),
        incorrect: progress.incorrect + Number(!correct),
        needsReview: !correct || (!firstAttempt && progress.needsReview),
        lastPracticed: new Date().toISOString(),
      },
    },
    activeSession: {
      ...session,
      answers: firstAttempt
        ? { ...session.answers, [id]: correct }
        : session.answers,
      newItems,
      retried: firstAttempt ? session.retried : [...session.retried, id],
    },
  })
  return true
}
export function recordUnderstanding(id: string, rating: Understanding) {
  const session = state.activeSession
  const current = session && itemById(session.ids[session.index])
  const cardConfig = current ? configForItem(session.config, current, session.index) : null
  if (!session || session.config.mode === "Sentence Formation" || cardConfig?.answerType !== "Self Check" || session.ids[session.index] !== id || id in session.answers || !isUnderstanding(rating)) return false
  const progress = state.progress[id] || { saved: false, correct: 0, incorrect: 0, needsReview: false }
  updateState({
    progress: { ...state.progress, [id]: { ...progress, understanding: rating, selfChecks: (progress.selfChecks || 0) + 1, lastPracticed: new Date().toISOString() } },
    activeSession: { ...session, answers: { ...session.answers, [id]: rating } },
  })
  return true
}
export function nextCard() {
  if (state.activeSession && state.activeSession.index + 1 < state.activeSession.ids.length && state.activeSession.ids[state.activeSession.index] in state.activeSession.answers)
    updateState({
      activeSession: {
        ...state.activeSession,
        index: state.activeSession.index + 1,
      },
    })
}
export function quitSession() {
  updateState({ activeSession: null })
}
export function completeSession(): Session | null {
  const active = state.activeSession
  if (!active || active.ids.some(id => !(id in active.answers))) return null
  const mistakes = active.ids.filter((id) => active.answers[id] === false)
  const result: Session = {
    id: active.id,
    date: new Date().toISOString(),
    mode: active.config.mode,
    total: Object.keys(active.answers).length,
    correct: Object.values(active.answers).filter(answer => answer === true).length,
    incorrect: mistakes.length,
    newItems: active.newItems.length,
    mistakes,
    ratings: Object.fromEntries(Object.entries(active.answers).filter((entry): entry is [string, Understanding] => isUnderstanding(entry[1]))),
  }
  updateState({
    history: [...state.history, result].slice(-100),
    activeSession: null,
  })
  return result
}
export function normalizeAnswer(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(
      /[āīūēō]/g,
      (vowel) => ({ ā: "aa", ī: "ii", ū: "uu", ē: "ee", ō: "ou" })[vowel]!,
    )
    .replace(/^to\s+/, "")
    .replace(/[\s\p{P}\p{S}]/gu, "")
}
const normalizeRomaji = (value: string) =>
  normalizeAnswer(value)
    .replace(/ou/g, "oo")
    .replace(/ei/g, "ee")
    .replace(/shi/g, "si")
    .replace(/chi/g, "ti")
    .replace(/tsu/g, "tu")
    .replace(/fu/g, "hu")
    .replace(/sha/g, "sya")
    .replace(/shu/g, "syu")
    .replace(/sho/g, "syo")
    .replace(/cha/g, "tya")
    .replace(/chu/g, "tyu")
    .replace(/cho/g, "tyo")
    .replace(/ji/g, "zi")
    .replace(/ja/g, "zya")
    .replace(/ju/g, "zyu")
    .replace(/jo/g, "zyo")
    .replace(/jy(?=[auo])/g, "zy")
    .replace(/cy(?=[auo])/g, "ty")
const romajiAnswers = (item: Item) =>
  item.readings || [
    ...new Set([
      item.romaji,
      ...(["ぢ", "ヂ"].includes(item.japanese) ? ["di", "dji"] : []),
      ...(["づ", "ヅ"].includes(item.japanese) ? ["du", "dzu"] : []),
      ...(["を", "ヲ"].includes(item.japanese) ? ["o"] : []),
    ]),
  ]
export function question(item: Item, config: Config) {
  if (config.answerType === "Sentence typing")
    return config.direction === "Romaji → Japanese"
      ? {
          prompt: item.sentenceRomaji || item.romaji,
          accepted: [item.sentence || item.japanese],
          expected: item.sentence || item.japanese,
          hint: item.sentenceReading || item.reading,
        }
      : {
          prompt: item.sentence || item.japanese,
          accepted: [item.sentenceRomaji || item.romaji],
          expected: item.sentenceRomaji || item.romaji,
          hint: item.sentenceReading || item.reading,
        }
  if (config.mode === "Sentence Formation")
    return {
      prompt: item.meanings[0],
      accepted: [item.japanese],
      expected: item.japanese,
      hint: "Arrange the pieces in Japanese sentence order.",
    }
  const direction =
    config.mode === "Romaji Input" ? "Japanese → Romaji" : config.direction
  const japanese =
    state.preferences.representation === "Kana" && item.kind === "Words"
      ? item.reading
      : state.preferences.representation === "Romaji" &&
          item.kind === "Words" &&
          !["Japanese → Romaji", "Kana → Romaji"].includes(direction)
        ? item.romaji
        : item.japanese
  switch (direction) {
    case "Japanese → English":
      return {
        prompt: japanese,
        accepted: item.meanings,
        expected: item.meanings[0],
        hint: `Starts with “${item.meanings[0].replace(/^to /, "").charAt(0)}”.`,
      }
    case "English → Japanese":
      return {
        prompt: item.meanings[0],
        accepted: [item.japanese, item.reading],
        expected: item.japanese,
        hint: `${item.reading.length} kana in the reading.`,
      }
    case "Japanese → Romaji":
      return {
        prompt: item.japanese,
        accepted: romajiAnswers(item),
        expected: item.romaji,
        hint: `Starts with “${item.romaji.charAt(0)}”.`,
      }
    case "Romaji → Japanese":
      return {
        prompt: item.romaji,
        accepted:
          item.kind === "Kanji"
            ? [item.japanese]
            : [item.japanese, item.reading],
        expected: item.japanese,
        hint: `Starts with “${item.japanese.charAt(0)}”.`,
      }
    case "English → Romaji":
      return {
        prompt: item.meanings[0],
        accepted: romajiAnswers(item),
        expected: item.romaji,
        hint: `Starts with “${item.romaji.charAt(0)}”.`,
      }
    case "Romaji → English":
      return {
        prompt: item.romaji,
        accepted: item.meanings,
        expected: item.meanings[0],
        hint: `Starts with “${item.meanings[0].replace(/^to /, "").charAt(0)}”.`,
      }
    case "Kana → Romaji":
      return {
        prompt: item.kind === "Katakana" ? item.japanese : item.reading,
        accepted: item.kind === "Words" ? [item.romaji] : romajiAnswers(item),
        expected: item.romaji,
        hint: `Starts with “${item.romaji.charAt(0)}”.`,
      }
    case "Romaji → Kana":
      return {
        prompt: item.romaji,
        accepted: [item.kind === "Katakana" ? item.japanese : item.reading],
        expected: item.kind === "Katakana" ? item.japanese : item.reading,
        hint: `Starts with “${item.reading.charAt(0)}”.`,
      }
    case "Randomize":
      return question(item, { ...config, direction: "Japanese → English" })
  }
}
export function isCorrect(item: Item, config: Config, answer: string) {
  const romaji =
    config.mode === "Romaji Input" || config.direction.endsWith("Romaji")
  const normalize = romaji ? normalizeRomaji : normalizeAnswer
  const accepted = question(item, config).accepted
  const kanjiTypingAnswers =
    config.answerType === "Typing" &&
    (item.kind === "Kanji" || (item.kind === "Words" && writingSystems(item.japanese).includes("Kanji")))
      ? [...accepted, item.japanese, item.reading, item.romaji, ...item.meanings]
      : accepted
  return kanjiTypingAnswers.some(
    (expected) => normalize(expected) === normalize(answer),
  )
}
export function learningSummary(data: LearningState) {
  const learned = (kind: Content) =>
    items.filter(
      (item) => item.kind === kind && data.progress[item.id]?.correct > 0,
    ).length
  const counts = Object.values(data.progress)
  const correct = counts.reduce(
    (total, progress) => total + progress.correct,
    0,
  )
  const incorrect = counts.reduce(
    (total, progress) => total + progress.incorrect,
    0,
  )
  const activeDates = new Set(
    counts
      .filter((progress) => progress.lastPracticed)
      .map((progress) =>
        new Date(progress.lastPracticed!).toLocaleDateString("en-CA"),
      ),
  )
  data.history.forEach((session) =>
    activeDates.add(new Date(session.date).toLocaleDateString("en-CA")),
  )
  const day = new Date()
  let streak = 0
  if (!activeDates.has(day.toLocaleDateString("en-CA")))
    day.setDate(day.getDate() - 1)
  while (activeDates.has(day.toLocaleDateString("en-CA"))) {
    streak++
    day.setDate(day.getDate() - 1)
  }
  return {
    words: learned("Words"),
    kanji: learned("Kanji"),
    kana: learned("Hiragana") + learned("Katakana"),
    questions: correct + incorrect + counts.reduce((total, progress) => total + (progress.selfChecks || 0), 0),
    accuracy:
      correct + incorrect
        ? Math.round((correct / (correct + incorrect)) * 100)
        : 0,
    streak,
    weak: items
      .filter((item) => data.progress[item.id]?.needsReview)
      .sort(
        (first, second) =>
          data.progress[second.id].incorrect -
          data.progress[first.id].incorrect,
      ),
  }
}
export function speakJapanese(text: string) {
  if (!state.preferences.pronunciation || !("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "ja-JP"
  utterance.rate = 0.8
  window.speechSynthesis.speak(utterance)
}
export function restoreBackup(value: unknown) {
  const validated = validateBackup(value)
  const next = { ...validated, onboarded: true, activeSession: null }
  if (!persistState(next, true)) {
    listeners.forEach((listener) => listener())
    return { ok: false as const, message: "We couldn’t save this backup on your device. Your current data is unchanged. Free device storage or allow browser storage, then try restoring again." }
  }
  state = next
  protectUnreadableStorage = false
  recoveryNotice = ""
  listeners.forEach((listener) => listener())
  return { ok: true as const }
}
export function exportBackup() {
  const blob = new Blob(
    [JSON.stringify({ ...state, activeSession: null }, null, 2)],
    { type: "application/json" },
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `manabu-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
