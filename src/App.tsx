import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import Dictionary from "./Dictionary"
import JapaneseKeyboard from "./JapaneseKeyboard"
import { applyAppearance, defaultAppearance } from "./appearance"
import { isKnownRoute, writingCharacterId } from "./navigation"
import CharacterWriting from "./writing/CharacterWriting"
import { APP_VERSION } from "./version"
import ApplicationBoundary, { RecoveryPage } from "./Recovery"
import { navigateTabs } from "./accessibility"
import { kanaEntries } from "./content/catalog"
import HomeWelcome from "./HomeWelcome"
import SpotlightTour from "./SpotlightTour"
import Shortcuts from "./Shortcuts"
import Updates from "./Updates"
import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router"
import Practice from "./Practice"
import Settings, {
  ProfileForm,
  Progress,
  RestoreControl,
  WeakItems,
} from "./LearningPanels"
import {
  beginSession,
  defaultConfig,
  hasStorageError,
  getRecoveryNotice,
  items,
  learningSummary,
  speakJapanese,
  toKatakana,
  updateState,
  useLearning,
  type Item,
  type Mode,
} from "./learning"

type IconName = "home" | "practice" | "book" | "kanji" | "keyboard" | "chart" | "settings" | "arrow" | "volume" | "flame" | "check" | "updates"

const icons: Record<IconName, ReactNode> = {
  keyboard: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" /></>,
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9M9 20v-6h6v6" />
    </>
  ),
  practice: (
    <>
      <path d="M7 5h10M7 12h10M7 19h6" />
      <circle cx="4" cy="5" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="19" r="1" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v17H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v17h4.5a2.5 2.5 0 0 1 2.5 2.5z" />
    </>
  ),
  kanji: (
    <>
      <path d="M5 4h14M8 4c0 8-1 13-4 16M16 4c0 8 1 13 4 16M7 11h10M6 20l6-6 6 6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  volume: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />
    </>
  ),
  flame: (
    <path d="M12 22c4 0 7-3 7-7 0-5-4-8-6-12 0 5-3 6-5 9-1-2-1-3-1-4-2 2-3 4-3 7 0 4 4 7 8 7Zm0-3c-2 0-3-1-3-3 0-1 1-2 2-3 0 2 2 2 2 4 1-1 1-2 1-2 1 2 0 4-2 4Z" />
  ),
  check: <path d="m5 12 4 4L19 6" />,
  updates: <><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5" /><path d="m17 17 3 3" /></>,
}

function Icon({ name, size = 20 }: {
  name: IconName
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  )
}

const nav = [
  { label: "Home", icon: "home" as IconName },
  { label: "Practice", icon: "practice" as IconName },
  { label: "Dictionary", icon: "book" as IconName },
  { label: "Japanese Keyboard", icon: "keyboard" as IconName },
  { label: "Writing System", icon: "practice" as IconName },
  { label: "Progress", icon: "chart" as IconName },
  { label: "Settings", icon: "settings" as IconName },
  { label: "Shortcuts", icon: "keyboard" as IconName },
  { label: "Updates", icon: "updates" as IconName },
]

function Logo() {
  return (
    <div className="brand">
      <div className="cat-mark" aria-hidden="true">
        <span className="cat-ear left" />
        <span className="cat-ear right" />
        <span className="cat-face">
          <i />
          <i />
        </span>
      </div>
      <div>
        <strong>Manabu</strong>
        <span>Keep going!</span>
      </div>
    </div>
  )
}

function Sidebar({
  active,
  onSelect,
}: {
  active: string
  onSelect: (label: string) => void
}) {
  const summary = learningSummary(useLearning())
  return (
    <aside className="sidebar">
      <Logo />
      <nav aria-label="Main navigation">
        {nav.map((item) => (
          <button
            className={active === item.label ? "nav-item active" : "nav-item"}
            data-tour-route={item.label === "Home" ? "/" : "/" + item.label.toLowerCase().replace(/ /g, "-")}
            aria-current={active === item.label ? "page" : undefined}
            onClick={() => onSelect(item.label)}
            key={item.label}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="streak">
        <span className="streak-icon">
          <Icon name="flame" size={18} />
        </span>
        <div>
          <b>{summary.streak} day streak</b>
          <small>
            {summary.streak
              ? "Keep it growing!"
              : "Your next step starts here."}
          </small>
        </div>
        <small className="app-version">Version {APP_VERSION}</small>
      </div>
    </aside>
  )
}

function Scene() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="cloud cloud-one" />
      <div className="cloud cloud-two" />
      <svg viewBox="0 0 480 160" preserveAspectRatio="none">
        <path d="M40 160 150 58l31 35 55-64 90 131Z" fill="#8bc4b8" />
        <path
          d="m150 58 31 35 15-17 40-47 34 60-38-37-14 25-16-17-21 33Z"
          fill="#fff"
          opacity=".95"
        />
        <path
          d="M0 160 0 128l30-10 22 17 35-26 34 17 29-11 46 45Zm230 0 51-38 38 16 36-32 36 23 50-23 39 29v25Z"
          fill="#58a782"
        />
        <path
          d="M0 160v-18l47-20 52 25 45-15 65 28Zm206 0 70-30 47 19 54-28 55 24 48-15v30Z"
          fill="#258963"
        />
        <g transform="translate(388 45)">
          <path d="M20 14v100M5 114h42" stroke="#614e42" strokeWidth="5" />
          <path d="m2 28 22-13 22 13Z" fill="#dc4d45" />
          <path d="m-4 53 28-15 28 15Z" fill="#dc4d45" />
          <path d="m-8 80 32-17 32 17Z" fill="#dc4d45" />
          <rect x="8" y="29" width="32" height="9" fill="#f2e4b9" />
          <rect x="5" y="54" width="38" height="10" fill="#f2e4b9" />
          <rect x="2" y="81" width="44" height="26" fill="#f2e4b9" />
        </g>
      </svg>
    </div>
  )
}

function Dashboard({
  onPractice,
  onSelect,
  onPracticeItem,
  onReview,
  showWelcome,
  onContinueLastPractice,
  onDismissWelcome,
  onTutorial,
}: {
  onPractice: (mode?: Mode) => void
  onSelect: (page: string) => void
  onPracticeItem: (item: Item) => void
  onReview: () => void
  showWelcome: boolean
  onContinueLastPractice: () => void
  onDismissWelcome: () => void
  onTutorial: () => void
}) {
  const data = useLearning()
  const summary = learningSummary(data)
  const active = data.activeSession
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const modes: {
    title: string
    mode: Mode
    text: string
    icon: IconName
    tone: string
  }[] = [
    {
      title: "Flashcards",
      mode: "Flashcards",
      text: "Recall it your way",
      icon: "book",
      tone: "green",
    },
  ]
  const wordItems = items.filter((item) => item.kind === "Words")
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
  const dateHash = [...dateKey].reduce((hash, character) => (Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0), 2166136261)
  const dayWord = wordItems[dateHash % wordItems.length] || wordItems[0]
  return (
    <main className="main home-learning">
      <button className="home-tutorial-button" aria-label="Replay Manabu tutorial" title="Take a quick tour" onClick={onTutorial}>?</button>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            {new Date()
              .toLocaleDateString("en", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
              .toUpperCase()}
          </p>
          <h1>
            {greeting}
            {data.profile.name ? ", " + data.profile.name : ""}!
          </h1>
          <p>What do you want to practice today?</p>
        </div>
        <Scene />
      </section>
      <section className="continue-card">
        <div className="continue-top">
          <div>
            <span className="section-label">
              {active ? "CONTINUE LEARNING" : "YOUR NEXT SMALL STEP"}
            </span>
            <h2>{active ? active.config.mode : "Learn Japanese your way."}</h2>
            <p>
              {active
                ? active.ids.length -
                  active.index +
                  " cards remaining · " +
                  active.config.direction
                : "Choose a word, a sound, or a sentence."}
            </p>
          </div>
          <button className="primary-button" onClick={() => onPractice()}>
            {active ? "Continue" : "Start practice"}{" "}
            <Icon name="arrow" size={17} />
          </button>
        </div>
        {active && (
          <>
            <div className="progress-meta">
              <span>
                {active.index} of {active.ids.length} cards completed
              </span>
              <strong>
                {Math.round((active.index / active.ids.length) * 100)}%
              </strong>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: (active.index / active.ids.length) * 100 + "%",
                }}
              />
            </div>
          </>
        )}
      </section>
      <div className="learn-home-section-title">
        <h2>Quick practice</h2>
        <span>Your choice. Your pace.</span>
      </div>
      <section className="feature-grid">
        {modes.map((mode) => (
          <button
            className="feature-card"
            key={mode.title}
            onClick={() => onPractice(mode.mode)}
          >
            <span className={"feature-icon " + mode.tone}>
              <Icon name={mode.icon} size={21} />
            </span>
            <span className="feature-title">{mode.title}</span>
            <span className="feature-text">{mode.text}</span>
            <span className="card-arrow">
              <Icon name="arrow" size={17} />
            </span>
          </button>
        ))}
      </section>
      <div className="learn-home-section-title">
        <h2>Your small steps, so far</h2>
        <button
          className="dict-text-button"
          onClick={() => onSelect("Progress")}
        >
          View progress →
        </button>
      </div>
      <section className="learn-home-stats">
        {[
          [summary.words, "Words learned"],
          [summary.kanji, "Kanji learned"],
          [
            summary.questions ? summary.accuracy + "%" : "—",
            "Practice accuracy",
          ],
          [summary.streak, "Day streak"],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>
      <section className="learn-panel">
        <div className="dict-section-row">
          <h2>Needs review</h2>
          <button
            className="dict-text-button"
            disabled={!summary.weak.length}
            onClick={onReview}
          >
            Review all →
          </button>
        </div>
        <WeakItems onPractice={onPracticeItem} limit={3} />
      </section>
      <section className="lower-grid">
        <article className="quote-card">
          <span className="section-label">A LITTLE ENCOURAGEMENT</span>
          <blockquote>継続は力なり。</blockquote>
          <p>“Persistence is power.”</p>
          <span className="quote-mark">“</span>
        </article>
        <article className="word-card">
          <div>
            <span className="section-label">WORD OF THE DAY</span>
            <h3>{dayWord.japanese}</h3>
            {data.preferences.romaji !== "Hide" && <p>{dayWord.romaji}</p>}
            {data.preferences.english && <p>{dayWord.meanings[0]}</p>}
            <button
              className="dict-text-button"
              onClick={() => onPracticeItem(dayWord)}
            >
              Practice this word →
            </button>
          </div>
          {data.preferences.pronunciation && (
            <button
              className="sound-button"
              onClick={() => speakJapanese(dayWord.japanese)}
              aria-label="Hear pronunciation"
            >
              <Icon name="volume" size={20} />
            </button>
          )}
        </article>
      </section>
      {showWelcome && (
        <HomeWelcome
          returning={!!active || data.history.length > 0}
          description={active
            ? active.config.mode + " · " + (active.ids.length - active.index) + " cards remaining"
            : data.history.length
              ? data.practiceConfig.mode + " · " + data.practiceConfig.direction
              : "A little practice, at your own pace."}
          icon={<Icon name="book" size={26} />}
          onContinue={onContinueLastPractice}
          onDismiss={onDismissWelcome}
        />
      )}
    </main>
  )
}

const languages = [
  { name: "English", flag: "english" },
  { name: "日本語", flag: "japanese" },
  { name: "中文", flag: "chinese" },
  { name: "한국어", flag: "korean" },
  { name: "Español", flag: "spanish" },
  { name: "Français", flag: "french" },
  { name: "Deutsch", flag: "german" },
]
const onboardingText = (language: string) => language === "日本語"
  ? {
      choose: "言語を選択",
      select: "アプリで使用する言語を選択してください。",
      next: "次へ",
      tip: "ヒント",
      welcome: "Manabuへようこそ",
      learn: "あなたの方法で日本語を学ぼう。",
      intro: "練習する内容を選び、自分のペースで学びましょう。",
      started: "始める",
      privacyTitle: "学習データはあなたのものです。",
      privacy: "進捗はこの端末に保存されます。オンラインアカウントは必要ありません。",
      guest: "ゲストとして続ける",
      restore: "以前に書き出したManabuのバックアップを復元します。",
    }
  : {
      choose: "Choose your language",
      select: "Select the language you want to use the app in.",
      next: "Next",
      tip: "Tip",
      welcome: "WELCOME TO MANABU",
      learn: "Learn Japanese your way.",
      intro: "Choose what to practice. Learn at your own pace.",
      started: "Get Started",
      privacyTitle: "Your learning data stays with you.",
      privacy: "Your progress is saved on this device. No online account required.",
      guest: "Continue as Guest",
      restore: "Restore a previously exported Manabu backup.",
    }

function Globe() {
  return (
    <svg
      width="68"
      height="68"
      viewBox="0 0 68 68"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="34"
        cy="34"
        r="27"
        fill="#e0f2e9"
        stroke="#69a98d"
        strokeWidth="2"
      />
      <ellipse
        cx="34"
        cy="34"
        rx="13"
        ry="27"
        stroke="#69a98d"
        strokeWidth="2"
      />
      <path d="M8 34h52M13 20h42M13 48h42" stroke="#69a98d" strokeWidth="2" />
    </svg>
  )
}

function LanguageSelection({ onNext }: { onNext: (language: string) => void }) {
  const copy = onboardingText("English")
  return (
    <main className="onboarding language-screen">
      <div className="onboarding-inner">
        <div className="globe">
          <Globe />
        </div>
        <h1>{copy.choose}</h1>
        <p className="onboarding-subtitle">
          {copy.select}
        </p>
        <p className="onboarding-subtitle">English is currently the supported app language.</p>
        <button className="onboarding-button" onClick={() => onNext("English")}>
          {copy.next} <Icon name="arrow" size={17} />
        </button>
      </div>
    </main>
  )
}

function MountainMark() {
  return (
    <svg viewBox="0 0 260 190" aria-hidden="true">
      <circle cx="130" cy="64" r="48" fill="#f6b9bf" />
      <path d="m31 155 92-91 104 91Z" fill="#8fc6df" />
      <path
        d="m123 64 24 25 13-7 25 35-29-17-12 17-14-18-20 11-16-16Z"
        fill="#f9fbfa"
      />
      <path
        d="M24 91c0-11 9-20 20-20 9 0 16 5 19 13 2-1 5-2 8-2 10 0 18 8 18 18H24Z"
        fill="#dcecf1"
      />
      <path
        d="M187 91c0-9 7-16 16-16 7 0 13 4 16 10 2-1 4-1 6-1 8 0 14 6 14 14h-52Z"
        fill="#dcecf1"
      />
    </svg>
  )
}

function LoadingScreen({ onDone }: { onDone: () => void }) {
  const language = useLearning().language
  const copy = onboardingText(language)
  const tips = [
    "Japanese sentences usually place the verb at the end.",
    "ありがとう means arigatou — thank you.",
    "Hiragana is used for native words and grammar.",
  ]
  const [tipIndex, setTipIndex] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2300)
    const rotate = window.setInterval(
      () => setTipIndex((index) => (index + 1) % 3),
      1100,
    )
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(rotate)
    }
  }, [])

  return (
    <main className="onboarding loading-screen">
      <div className="loading-content">
        <MountainMark />
        <div className="loading-track">
          <span />
        </div>
        <div className="tip" aria-live="polite">
          <span className="bulb">i</span>
          <p>
            <strong>{copy.tip}:</strong>
            <br />
            {tips[tipIndex]}
          </p>
        </div>
      </div>
    </main>
  )
}

const introFeatures = [
  {
    title: "Study",
    text: "Flashcards, quizzes, and more.",
    icon: "book" as IconName,
    tone: "green",
  },
  {
    title: "Build",
    text: "Hiragana, katakana, kanji, and vocabulary.",
    icon: "kanji" as IconName,
    tone: "purple",
  },
  {
    title: "Track",
    text: "See your progress and improve over time.",
    icon: "chart" as IconName,
    tone: "blue",
  },
]

function Introduction({ onStart }: { onStart: () => void }) {
  const copy = onboardingText(useLearning().language)
  return (
    <main className="onboarding intro-screen">
      <div className="intro-inner">
        <p className="eyebrow">{copy.welcome}</p>
        <h1>
          {copy.learn}
        </h1>
        <p className="intro-subtitle">
          {copy.intro}
        </p>
        <div className="intro-features">
          {introFeatures.map((feature) => (
            <div className="intro-feature" key={feature.title}>
              <span className={`intro-icon ${feature.tone}`}>
                <Icon name={feature.icon} size={25} />
              </span>
              <div>
                <strong>{feature.title}</strong>
                <p>{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="onboarding-button" onClick={onStart}>
          {copy.started} <Icon name="arrow" size={17} />
        </button>
      </div>
      <div className="intro-landscape" aria-hidden="true">
        <span className="intro-cat">
          <i />
          <i />
        </span>
      </div>
    </main>
  )
}

function PrivacyScreen({
  onContinue,
  onRestored,
}: {
  onContinue: () => void
  onRestored: () => void
}) {
  const copy = onboardingText(useLearning().language)
  return (
    <main className="onboarding privacy-screen">
      <div className="privacy-inner">
        <div className="offline-art" aria-hidden="true">
          <span className="plant left" />
          <span className="plant right" />
          <div className="laptop">
            <Icon name="settings" size={38} />
          </div>
        </div>
        <h1>{copy.privacyTitle}</h1>
        <p className="onboarding-subtitle">
          {copy.privacy}
        </p>
        <button className="onboarding-button" onClick={onContinue}>
          {copy.guest}
        </button>
        <RestoreControl onRestored={onRestored} />
        <small className="privacy-help">
          {copy.restore}
        </small>
      </div>
    </main>
  )
}

function ProfileSetup({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="onboarding profile-setup-screen">
      <div className="profile-setup">
        <p className="eyebrow">ONE LAST STEP</p>
        <h1>
          Your Profile <span>(Optional)</span>
        </h1>
        <p className="onboarding-subtitle">
          A little about you. Only on this device.
        </p>
        <ProfileForm onContinue={onContinue} onboarding />
      </div>
    </main>
  )
}

function PageHeading({
  title,
  subtitle,
  onBack,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
}) {
  return (
    <div className="page-heading">
      {onBack && (
        <button className="back-button" onClick={onBack}>
          ←
        </button>
      )}
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  )
}

type Kana = {
  id?: string
  kana: string
  romaji: string
}
type KanaSection = {
  title: string
  japanese: string
  guide: string
  columns: 3 | 5
  characters: Kana[]
}

const kanaSectionLabels = [
  { title: "Basic", japanese: "Seion", guide: "a · i · u · e · o", columns: 5 },
  { title: "Dakuon", japanese: "Voiced sounds", guide: "g · z · d · b", columns: 5 },
  { title: "Handakuon", japanese: "Half-voiced sounds", guide: "p sounds", columns: 5 },
  { title: "Yoon", japanese: "Contracted sounds", guide: "ya · yu · yo", columns: 3 },
] as const

function kanaSectionsFor(script: "Hiragana" | "Katakana"): KanaSection[] {
  return kanaSectionLabels.map(section => {
    const entries = kanaEntries.filter(entry => entry.kind === script && entry.group === section.title)
    const characters = entries.map(entry => ({ id: entry.id, kana: entry.japanese, romaji: entry.romaji }))
    if (section.title === "Basic") {
      const remaining = new Map(characters.slice(35).map(character => [character.romaji, character]))
      return { ...section, characters: [...characters.slice(0, 35), ...["ya", "", "yu", "", "yo", "ra", "ri", "ru", "re", "ro", "wa", "", "", "", "wo", "n", "", "", "", ""].map(label => remaining.get(label) || { kana: "", romaji: "" })] }
    }
    return { ...section, characters }
  })
}

function KanaButton({ id, kana, romaji }: Kana) {
  const navigate = useNavigate()
  const openCharacter = () => { closePreview(); if (id) navigate(`/writing-system/character/${id}`) }
  const tooltipId = useId()
  const [showPreview, setShowPreview] = useState(false)
  const previewTimer = useRef<number | null>(null)
  const holdTimer = useRef<number | null>(null)
  const held = useRef(false)

  const openPreview = () => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => setShowPreview(true), 650)
  }

  const closePreview = () => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    previewTimer.current = null
    setShowPreview(false)
  }

  useEffect(() => () => {
    closePreview()
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
  }, [])

  const pronounce = () => {
    speakJapanese(kana)
  }
  const startHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      held.current = true
      pronounce()
    }, 500)
  }
  const cancelHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  return (
    <button
      className="kana-button"
      aria-label={`${kana}, ${romaji}. Click to open writing practice. Right-click or hold to hear pronunciation.`}
      aria-describedby={showPreview ? tooltipId : undefined}
      onClick={() => {
        if (held.current) {
          held.current = false
          return
        }
        openCharacter()
      }}
      onContextMenu={event => { event.preventDefault(); cancelHold(); pronounce() }}
      onPointerDown={event => { if (event.pointerType === "touch") startHold() }}
      onPointerUp={event => { if (event.pointerType === "touch") cancelHold() }}
      onPointerCancel={cancelHold}
      onMouseEnter={openPreview}
      onMouseLeave={closePreview}
      onFocus={openPreview}
      onBlur={closePreview}
      onKeyDown={event => { if (event.key === "Escape") closePreview(); if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") { event.preventDefault(); openCharacter() } }}
    >
      <span>{romaji}</span>
      <strong>{kana}</strong>
      <i className="kana-audio">
        <Icon name="volume" size={12} />
      </i>
      {showPreview && (
        <span className="stroke-tooltip" role="tooltip" id={tooltipId}>
          <span className="tooltip-label">Sound & reading</span>
          <span className="kana-preview-character">{kana}</span>
          <small>{romaji} · Right-click or hold to listen</small>
        </span>
      )}
    </button>
  )
}

function CharacterTable({
  initialScript = "Hiragana",
  onPracticeScript,
}: {
  initialScript?: "Hiragana" | "Katakana"
  onPracticeScript: (script: "Hiragana" | "Katakana") => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const script = new URLSearchParams(location.search).get("script") === "katakana" ? "Katakana" : initialScript
  const setScript = (next: "Hiragana" | "Katakana") => navigate(`/writing-system?script=${next.toLowerCase()}`, { replace: true })
  return (
    <main className="workspace-page">
      <PageHeading
        title={`${script} Table`}
        subtitle="Click a character to explore its strokes and write. Right-click or hold it to hear the pronunciation."
      />
      <label className="writing-character-picker">Open writing practice<select aria-label="Choose a character for writing practice" value="" onChange={event => { if (event.target.value) navigate(`/writing-system/character/${event.target.value}`) }}><option value="">Choose a character…</option>{kanaSectionLabels.map(group => <optgroup key={group.title} label={group.title}>{kanaEntries.filter(entry => entry.kind === script && entry.group === group.title).map(entry => <option key={entry.id} value={entry.id}>{entry.japanese} · {entry.romaji}</option>)}</optgroup>)}</select></label>
      <div className="script-toggle" role="tablist" aria-label="Writing system" onKeyDown={navigateTabs}>
        <button
          role="tab"
          aria-selected={script === "Hiragana"}
          aria-controls="writing-system-panel"
          tabIndex={script === "Hiragana" ? 0 : -1}
          className={script === "Hiragana" ? "active" : ""}
          onClick={() => setScript("Hiragana")}
        >
          Hiragana
        </button>
        <button
          role="tab"
          aria-selected={script === "Katakana"}
          aria-controls="writing-system-panel"
          tabIndex={script === "Katakana" ? 0 : -1}
          className={script === "Katakana" ? "active" : ""}
          onClick={() => setScript("Katakana")}
        >
          Katakana
        </button>
        <button
          className="kana-start-practice"
          onClick={() => onPracticeScript(script)}
        >
          Practice {script} →
        </button>
      </div>
      <div className="kana-sections">
        {kanaSectionsFor(script).map((section) => (
          <section className="kana-section" key={section.title}>
            <div className="kana-section-heading">
              <div>
                <h2>{section.title}</h2>
                <span>{section.japanese}</span>
              </div>
              <p>
                <b>Romaji</b>
                {section.guide}
              </p>
            </div>
            <div className={`character-table columns-${section.columns}`}>
              {section.characters.map((character, index) =>
                character.kana ? (
                  <KanaButton
                    id={character.id}
                    kana={character.kana}
                    romaji={character.romaji}
                    key={`${character.kana}-${index}`}
                  />
                ) : (
                  <span className="kana-space" key={`space-${index}`} />
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

function ManabuShell() {
  const data = useLearning()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => applyAppearance(data.preferences.appearance || defaultAppearance), [data.preferences.appearance])
  useEffect(() => {
    if (location.pathname.replace(/\/$/, "") === "/kanji") navigate("/dictionary?tab=kanji", { replace: true })
  }, [location.pathname, navigate])
  const active =
    nav.find(
      (item) =>
        location.pathname.replace(/\/$/, "") === "/" + item.label.toLowerCase().replace(/ /g, "-"),
    )?.label || (writingCharacterId(location.pathname) !== null ? "Writing System" : location.pathname.replace(/\/$/, "") === "/kanji" ? "Dictionary" : "Home")
  const [onboarding, setOnboarding] =
    useState<"language" | "loading" | "intro" | "privacy" | "profile" | "done">(
      data.onboarded ? "done" : "language",
    )
  const [writingSystemVisit, setWritingSystemVisit] = useState(0)
  const [practiceMode, setPracticeMode] = useState<Mode | undefined>()
  const [practiceVisit, setPracticeVisit] = useState(0)
  const [resumePractice, setResumePractice] = useState(false)
  const [homeWelcomeDismissed, setHomeWelcomeDismissed] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const openTutorial = () => {
    setHomeWelcomeDismissed(true)
    updateState({ preferences: { ...data.preferences, tutorialSeen: true } })
    setTourOpen(true)
  }
  const closeTutorial = () => { setTourOpen(false); navigate("/", { replace: true }); window.scrollTo(0, 0) }
  useEffect(() => {
    if (onboarding === "done" && ["/", "/home"].includes(location.pathname.replace(/\/$/, "") || "/") && !data.preferences.tutorialSeen && !tourOpen) openTutorial()
  }, [onboarding, location.pathname, data.preferences.tutorialSeen, tourOpen])
  const [recoveryNotice, setRecoveryNotice] = useState(getRecoveryNotice)
  const homeVisited = useRef(false)
  const dismissHomeWelcome = useCallback(() => setHomeWelcomeDismissed(true), [])
  useEffect(() => {
    if (onboarding !== "done") return
    if (active === "Home") homeVisited.current = true
    else if (homeVisited.current) setHomeWelcomeDismissed(true)
  }, [active, onboarding])
  const selectPage = (page: string) => {
    if (page === "Writing System") setWritingSystemVisit((visit) => visit + 1)
    if (page === "Practice") {
      setPracticeMode(undefined)
      setResumePractice(false)
      setPracticeVisit((visit) => visit + 1)
    }
    navigate(
      page === "Home" ? "/" : "/" + page.toLowerCase().replace(/ /g, "-"),
    )
    window.scrollTo(0, 0)
  }
  const openPractice = (mode?: Mode) => {
    setPracticeMode(mode)
    setResumePractice(!mode)
    setPracticeVisit((visit) => visit + 1)
    navigate("/practice")
    window.scrollTo(0, 0)
  }
  const practiceItem = (item: Item) => {
    beginSession(
      {
        ...defaultConfig,
        content: [item.kind],
        direction:
          item.kind === "Kanji" ||
          item.kind === "Hiragana" ||
          item.kind === "Katakana"
            ? "Japanese → Romaji"
            : "English → Japanese",
        mode: item.kind === "Sentences" && item.tokens?.length ? "Sentence Formation" : "Flashcards",
      },
      [item.id],
    )
    openPractice()
  }
  const continueLastPractice = () => {
    dismissHomeWelcome()
    if (data.activeSession && data.activeSession.index < data.activeSession.ids.length) {
      openPractice()
    } else if (beginSession(data.practiceConfig)) {
      openPractice()
    } else {
      openPractice(data.practiceConfig.mode)
    }
  }
  const review = () => {
    const ids = learningSummary(data).weak.map((item) => item.id)
    if (ids.length) {
      beginSession(
        {
          ...defaultConfig,
          mode: "Romaji Input",
          direction: "Japanese → Romaji",
        },
        ids,
      )
      openPractice()
    }
  }
  const finishOnboarding = () => {
    updateState({ onboarded: true })
    setOnboarding("done")
  }

  if (!isKnownRoute(location.pathname)) return <RecoveryPage notFound />
  if (onboarding === "language")
    return (
      <LanguageSelection
        onNext={(language) => {
          updateState({ language })
          setOnboarding("loading")
        }}
      />
    )
  if (onboarding === "loading")
    return <LoadingScreen onDone={() => setOnboarding("intro")} />
  if (onboarding === "intro")
    return <Introduction onStart={() => setOnboarding("privacy")} />
  if (onboarding === "privacy")
    return (
      <PrivacyScreen
        onContinue={() => setOnboarding("profile")}
        onRestored={finishOnboarding}
      />
    )
  if (onboarding === "profile")
    return <ProfileSetup onContinue={finishOnboarding} />

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Sidebar active={active} onSelect={selectPage} />
      <div className="app-content" id="main-content" tabIndex={-1}>
        {recoveryNotice && <p role="alert" className="dict-notice">{recoveryNotice} <button className="dict-text-button" onClick={() => setRecoveryNotice("")}>Dismiss</button></p>}
        {hasStorageError() && (
          <p role="alert" className="dict-notice">
            Your saved data couldn’t be read or written. Existing device data has not been cleared. Restore a valid backup in Settings; export any new work before leaving.
          </p>
        )}
        <ApplicationBoundary resetKey={location.key} captureRuntime={false}>
        <div className="page-transition" key={location.pathname}>
        {active === "Home" ? (
          <Dashboard
            onPractice={openPractice}
            onSelect={selectPage}
            onPracticeItem={practiceItem}
            onReview={review}
            showWelcome={!homeWelcomeDismissed && !tourOpen && !!data.preferences.tutorialSeen}
            onContinueLastPractice={continueLastPractice}
            onDismissWelcome={dismissHomeWelcome}
            onTutorial={openTutorial}
          />
        ) : active === "Practice" ? (
          <Practice
            key={tourOpen ? "tutorial-overview" : practiceVisit}
            overviewOnly={tourOpen}
            initialMode={tourOpen ? undefined : practiceMode}
            resumeSession={resumePractice}
            onHome={() => selectPage("Home")}
          />
        ) : active === "Dictionary" ? (
          <Dictionary key="dictionary" onPractice={practiceItem} />
        ) : active === "Japanese Keyboard" ? (
          <JapaneseKeyboard onPractice={practiceItem} />
        ) : active === "Writing System" ? (
          writingCharacterId(location.pathname) !== null ? <CharacterWriting /> : <CharacterTable
            key={writingSystemVisit}
            onPracticeScript={(script) => {
              beginSession({
                ...defaultConfig,
                content: [script],
                direction: "Kana → Romaji",
              })
              openPractice()
            }}
          />
        ) : active === "Settings" ? (
          <Settings />
        ) : active === "Shortcuts" ? (
          <Shortcuts />
        ) : active === "Updates" ? (
          <Updates />
        ) : (
          <Progress onPractice={practiceItem} onReview={review} />
        )}
        </div>
        </ApplicationBoundary>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((item) => (
          <button
            className={active === item.label ? "active" : ""}
            data-tour-route={item.label === "Home" ? "/" : "/" + item.label.toLowerCase().replace(/ /g, "-")}
            aria-current={active === item.label ? "page" : undefined}
            onClick={() => selectPage(item.label)}
            key={item.label}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {tourOpen && <SpotlightTour onClose={closeTutorial} />}
    </div>
  )
}

const router = createBrowserRouter([{ path: "*", Component: ManabuShell, errorElement: <RecoveryPage /> }], {
  basename:
    new URL(import.meta.env.BASE_URL, window.location.origin).pathname.replace(
      /\/$/,
      "",
    ) || "/",
})

export default function App() {
  return <RouterProvider router={router} />
}
