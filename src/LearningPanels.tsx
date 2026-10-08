import { useEffect, useRef, useState, type ChangeEvent } from "react"
import {
  exportBackup,
  items,
  learningSummary,
  restoreBackup,
  updateState,
  useLearning,
  validateBackup,
  type Item,
  type LearningState,
  type Profile,
} from "./learning"
import { useOfflineStatus } from "./offline"
import { dictionaryInfo } from "./content/catalog"
import { strokeSource } from "./writing/model"
import { defaultAppearance } from "./appearance"
import { APP_VERSION } from "./version"

export function RestoreControl({ onRestored }: { onRestored?: () => void }) {
  const [backup, setBackup] = useState<LearningState | null>(null)
  const [message, setMessage] = useState("")
  const [reading, setReading] = useState(false)
  const readRequest = useRef(0)
  useEffect(() => () => { readRequest.current++ }, [])
  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const request = ++readRequest.current
    setBackup(null)
    setMessage("")
    setReading(true)
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Please choose a backup smaller than 5 MB.")
      const validated = validateBackup(JSON.parse(await file.text()))
      if (request !== readRequest.current) return
      setBackup(validated)
    } catch (error) {
      if (request !== readRequest.current) return
      setMessage(
        error instanceof Error
          ? error instanceof SyntaxError ? "This file isn’t a readable Manabu backup. Choose another backup; your current data is unchanged." : `${error.message} Your current data is unchanged. Choose another backup.`
          : "The backup could not be read.",
      )
    } finally {
      if (request === readRequest.current) setReading(false)
    }
  }
  return (
    <div className="learn-restore" aria-busy={reading}>
      <label className="secondary-button learn-import-label">
        {reading ? "Reading backup…" : message ? "Choose another backup" : "Restore my data"}
        <input
          type="file"
          accept=".json,application/json"
          onChange={selectFile}
          disabled={reading}
          aria-label="Choose a Manabu backup to restore"
        />
      </label>
      {reading && <p role="status">Reading your backup…</p>}
      {backup && (
        <div className="learn-restore-confirm">
          <strong>
            Restore {backup.profile.name ? `${backup.profile.name}’s` : "your"}{" "}
            backup?
          </strong>
          <p>
            {Object.keys(backup.progress).length} learning items ·{" "}
            {backup.history.length} sessions.
            <br />
            This replaces the learning data on this device.
            {!Object.keys(backup.progress).length && !backup.history.length && <><br /><strong>This backup has no learning progress. Restoring it will clear existing progress.</strong></>}
          </p>
          <div>
            <button
              className="dict-primary"
              onClick={() => {
                const result = restoreBackup(backup)
                if (!result.ok) { setMessage(result.message); return }
                setBackup(null)
                setMessage("Your data has been restored.")
                onRestored?.()
              }}
            >
              Restore backup
            </button>
            <button
              className="dict-text-button"
              onClick={() => setBackup(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="learn-local-note">
          {message}
        </p>
      )}
    </div>
  )
}

export function ProfileForm({
  onContinue,
  onboarding = false,
}: {
  onContinue?: () => void
  onboarding?: boolean
}) {
  const data = useLearning()
  const [profile, setProfile] = useState<Profile>(data.profile)
  useEffect(() => {
    setProfile(data.profile)
  }, [data.profile])
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState("")
  const setField = (key: keyof Profile, value: string) => {
    setProfile({ ...profile, [key]: value })
    setSaved(false)
    setProfileError("")
  }
  return (
    <form
      className="learn-profile-form"
      onSubmit={(event) => {
        event.preventDefault()
        const age = profile.age === "" ? "" : String(Number(profile.age))
        if (age !== "" && (!Number.isInteger(Number(age)) || Number(age) < 1 || Number(age) > 120)) { setProfileError("Enter a whole-number age from 1 to 120, or leave it blank."); return }
        const validProfile = { ...profile, age }
        updateState({ profile: validProfile })
        setSaved(true)
        onContinue?.()
      }}
    >
      <div className="form-card">
        <label>
          Name <span>(optional)</span>
          <input
            value={profile.name}
            onChange={(event) => setField("name", event.target.value)}
            maxLength={100}
            placeholder="What should we call you?"
            autoComplete="given-name"
          />
        </label>
        <label>
          Age <span>(optional)</span>
          <input
            type="number"
            step="1"
            min="1"
            max="120"
            value={profile.age}
            aria-invalid={!!profileError}
            aria-describedby={profileError ? "profile-error" : undefined}
            onChange={(event) => setField("age", event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label>
          Current Japanese level
          <select
            value={profile.currentLevel}
            onChange={(event) => setField("currentLevel", event.target.value)}
          >
            {["Beginner", "N5", "N4", "N3", "N2", "N1"].map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <label>
          Target level
          <select
            value={profile.targetLevel}
            onChange={(event) => setField("targetLevel", event.target.value)}
          >
            {["N5", "N4", "N3", "N2", "N1"].map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
      </div>
      {profileError && <p id="profile-error" role="alert" className="learn-local-note">{profileError}</p>}
      <button className={onboarding ? "onboarding-button" : "dict-primary"}>
        {onboarding ? "Continue" : "Save profile"}
      </button>
      {onboarding && (
        <button type="button" className="text-button" onClick={onContinue}>
          Skip for now
        </button>
      )}
      {saved && !onboarding && (
        <p className="learn-local-note" role="status">
          Profile saved on this device.
        </p>
      )}
    </form>
  )
}

export function WeakItems({
  onPractice,
  limit = 6,
}: {
  onPractice: (item: Item) => void
  limit?: number
}) {
  const data = useLearning()
  const weak = learningSummary(data).weak
  return (
    <div className="learn-weak-list">
      {weak.length ? weak.slice(0, limit).map((item) => (
          <div key={item.id}>
            <div>
              <strong lang="ja">{item.japanese}</strong>
              {data.preferences.romaji !== "Hide" && (
                <span>
                  {item.reading !== item.japanese && `${item.reading} · `}
                  {item.romaji}
                </span>
              )}
              {data.preferences.english &&
                item.kind !== "Hiragana" &&
                item.kind !== "Katakana" && <small>{item.meanings[0]}</small>}
            </div>
            <small>{data.progress[item.id].incorrect} incorrect</small>
            <button
              className="learn-soft-button"
              onClick={() => onPractice(item)}
            >
              Practice
            </button>
          </div>
        )) : <p className="learn-empty-note">
          You don't have any mistakes to review yet.
        </p>}
    </div>
  )
}

export function Progress({
  onPractice,
  onReview,
}: {
  onPractice: (item: Item) => void
  onReview: () => void
}) {
  const data = useLearning()
  const summary = learningSummary(data)
  return (
    <main className="workspace-page learning-page">
      <header className="learn-heading">
        <div>
          <p className="eyebrow">SMALL STEPS ADD UP</p>
          <h1>Your progress</h1>
          <p>Every answer counts. Keep making Japanese your own.</p>
        </div>
        <span className="learn-streak-pill">♨ {summary.streak} day streak</span>
      </header>
      <div className="learn-stats-grid">
        {[
          [summary.words, "Words learned"],
          [summary.kanji, "Kanji learned"],
          [summary.kana, "Kana learned"],
          [summary.questions, "Questions answered"],
          [`${summary.accuracy}%`, "Accuracy"],
        ].map(([value, label]) => (
          <article key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>
      <div className="learn-panels-grid">
        <section className="learn-panel">
          <div className="dict-section-row">
            <h2>Japanese level</h2>
            <span className="dict-badge">{data.profile.currentLevel}</span>
          </div>
          <p className="learn-local-note">
            Your target: {data.profile.targetLevel}
          </p>
          <h3>Learning progress</h3>
          <p className="learn-local-note">
            Coverage of this bundled starter collection.
          </p>
          {["N5", "N4", "N3", "N2", "N1"].map((level) => {
            const available = items.filter((item) => item.level === level)
            const learned = available.filter(
              (item) => data.progress[item.id]?.correct,
            ).length
            return (
              <div className="learn-progress-row" key={level}>
                <span>{level}</span>
                <div>
                  <span
                    style={{
                      width: `${
                        available.length
                          ? (learned / available.length) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <small>
                  {available.length
                    ? `${learned} / ${available.length}`
                    : "Coming later"}
                </small>
              </div>
            )
          })}
        </section>
        <section className="learn-panel">
          <h2>Writing systems</h2>
          {["Hiragana", "Katakana"].map((kind) => {
            const available = items.filter((item) => item.kind === kind)
            const learned = available.filter(
              (item) => data.progress[item.id]?.correct,
            ).length
            return (
              <div className="learn-script-progress" key={kind}>
                <div>
                  <strong>{kind}</strong>
                  <span>{Math.round((learned / available.length) * 100)}%</span>
                </div>
                <div className="progress-track">
                  <span
                    style={{ width: `${(learned / available.length) * 100}%` }}
                  />
                </div>
                <small>
                  {learned} of {available.length} characters and combinations
                  learned
                </small>
              </div>
            )
          })}
          <div className="learn-progress-tip">
            <span>継続は力なり。</span>
            <p>
              Consistency is strength.
              <br />
              One answer at a time.
            </p>
          </div>
        </section>
      </div>
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
        <WeakItems onPractice={onPractice} />
      </section>
      <section className="learn-panel">
        <h2>Recent activity</h2>
        {data.history.length ? (
          <div className="learn-activity">
            {[...data.history]
              .reverse()
              .slice(0, 8)
              .map((session) => (
                <div key={session.id}>
                  <span className="learn-activity-icon">✓</span>
                  <div>
                    <strong>{session.mode}</strong>
                    <small>
                      {new Date(session.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {session.total} cards
                    </small>
                  </div>
                  <b>
                    {Object.keys(session.ratings || {}).length > 0 ? "Self check" : <>
                    {session.total
                      ? Math.round((session.correct / session.total) * 100)
                      : 0}
                    %
                    </>}
                  </b>
                </div>
              ))}
          </div>
        ) : (
          <p className="learn-empty-note">
            Your completed practice sessions will appear here.
          </p>
        )}
      </section>
    </main>
  )
}

export default function Settings() {
  const data = useLearning()
  const offlineStatus = useOfflineStatus()
  const setPreference = (key: string, value: string | boolean) =>
    updateState({ preferences: { ...data.preferences, [key]: value } })
  return (
    <main className="workspace-page learning-page">
      <header className="learn-heading">
        <div>
          <p className="eyebrow">MAKE YOURSELF AT HOME</p>
          <h1>Settings</h1>
          <p>Your learning, your preferences.</p>
        </div>
      </header>
      <section className="learn-panel">
        <h2>Application</h2>
        <div className="learn-preference"><span>Version</span><span className="dict-badge">{APP_VERSION}</span></div>
      </section>
      <section className="learn-panel appearance-panel">
        <h2>Appearance</h2>
        <p className="learn-local-note">A comfortable space for every time of day.</p>
        <div className="appearance-options" role="group" aria-label="Appearance">{["Light", "Dark", "System"].map(choice => <button key={choice} className={(data.preferences.appearance || defaultAppearance) === choice ? "selected" : ""} aria-pressed={(data.preferences.appearance || defaultAppearance) === choice} onClick={() => setPreference("appearance", choice)}>{choice}</button>)}</div>
      </section>
      <section className="learn-panel">
        <h2>Profile</h2>
        <ProfileForm />
      </section>
      <section className="learn-panel">
        <h2>Learning preferences</h2>
        <label className="learn-preference">
          Romaji
          <select
            value={data.preferences.romaji}
            onChange={(event) => setPreference("romaji", event.target.value)}
          >
            {["Always show", "Show for difficult words", "Hide"].map(
              (option) => (
                <option key={option}>{option}</option>
              ),
            )}
          </select>
        </label>
        <label className="learn-preference">
          Japanese practice display
          <select
            value={data.preferences.representation}
            onChange={(event) =>
              setPreference("representation", event.target.value)
            }
          >
            {["Romaji", "Kana", "Kanji"].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <p className="learn-local-note">
          Display preferences never reveal the answer during a question.
        </p>
        {[
          ["english", "Show English meanings"],
          ["pronunciation", "Enable pronunciation"],
        ].map(([key, label]) => (
          <label className="learn-preference" key={key}>
            {label}
            <input
              type="checkbox"
              role="switch"
              checked={data.preferences[(key as "english" | "pronunciation")]}
              onChange={(event) => setPreference(key, event.target.checked)}
            />
          </label>
        ))}
        <div className="learn-preference">
          <span>Last practice preferences</span>
          <small>
            {data.practiceConfig.mode} · {data.practiceConfig.direction}
          </small>
        </div>
        <p className="learn-local-note">
          Practice setup remembers your last session’s choices.
        </p>
      </section>
      <section className="learn-panel">
        <h2>Your data</h2>
        <p className="learn-panel-copy">
          Your learning data stays on this device. Export a backup to keep it
          safe or move it to another device.
        </p>
        <div className="learn-data-actions">
          <button className="dict-primary" onClick={exportBackup}>
            Export my data ↓
          </button>
          <RestoreControl />
        </div>
        <p className="learn-local-note">
          Restoring a backup replaces your current data after confirmation.
        </p>
      </section>
      <section className="learn-panel">
        <h2>Dictionary</h2>
        <div className="learn-preference">
          <span>Current version</span>
          <span className="dict-badge">{dictionaryInfo.version}</span>
        </div>
        <p className="learn-panel-copy">
          {dictionaryInfo.words} words, {dictionaryInfo.kanji} kanji, and {dictionaryInfo.sentences} sentences ({dictionaryInfo.practiceSentences} for sentence formation). Bundled for local, offline search.
        </p>
        <div className="learn-preference"><span>Content updated</span><small>{dictionaryInfo.updatedAt}</small></div>
        <div className="learn-preference"><span>Writing systems</span><small>{dictionaryInfo.hiragana} hiragana · {dictionaryInfo.katakana} katakana</small></div>
        <details>
          <summary className="dict-text-button">Data sources & credits</summary>
          {dictionaryInfo.sources.map(source => <div key={source.id} className="learn-panel-copy"><strong>{source.name}</strong><p>Source version: {source.version}</p>{source.role && <p>{source.role}</p>}<p>{source.attribution}</p><p>{source.license || "Redistribution license not recorded; source rights must be confirmed before external distribution."}</p>{source.licenseUrl && <a href={source.licenseUrl} target="_blank" rel="noreferrer">Source licence</a>}</div>)}
          <div className="learn-panel-copy writing-credits"><strong>Kana & Kanji stroke order · {strokeSource.name}</strong><p>{strokeSource.attribution}</p><p className="writing-source-version">Source revision: {strokeSource.version}</p><a href={strokeSource.url} target="_blank" rel="noreferrer">KanjiVG</a>{" · "}<a href={strokeSource.licenseUrl} target="_blank" rel="noreferrer">{strokeSource.license}</a></div>
          <p className="learn-local-note">New entries without verified modern JLPT metadata are Unclassified. Existing editorial classifications remain source-labelled; KANJIDIC2 historical JLPT values are not converted to N levels.</p>
          <a className="dict-text-button" href="content-licenses/EDRDG-LICENCE.html" target="_blank" rel="noreferrer">EDRDG licence & attribution</a>{" · "}<a className="dict-text-button" href="content-licenses/CC-BY-SA-4.0.txt" target="_blank" rel="noreferrer">CC BY-SA 4.0 legal text</a>
          <p className="learn-local-note"><a href="content-licenses/JMdict-format.txt" target="_blank" rel="noreferrer">JMdict format documentation</a>{" · "}<a href="content-licenses/KANJIDIC2-format.txt" target="_blank" rel="noreferrer">KANJIDIC2 format documentation</a></p>
        </details>
        <p className="learn-local-note">
          This is a selected dictionary extract, not the complete sources. Updates arrive with application releases; no online update service is connected.
        </p>
        <span className="learn-offline-status">{offlineStatus}</span>
      </section>
      <section className="learn-panel">
        <h2>Privacy & about</h2>
        <p className="learn-panel-copy">
          No online account. No cloud learning-data storage. Clearing your
          browser’s site data removes local progress; keep an exported backup.
        </p>
        <div className="learn-preference">
          <span>Manabu</span>
          <small>Version 0.2 · Local learning</small>
        </div>
        <p className="learn-local-note">
          Fonts: Nunito and Zen Maru Gothic, locally bundled under the SIL Open
          Font License. Japanese audio: device speech synthesis. Current
          dictionary: a selected JMdict / KANJIDIC2 extract from EDRDG under CC BY-SA 4.0, plus retained Manabu-curated examples and metadata. Source-derived content is adapted under the same licence; curated-content redistribution rights still require confirmation.
        </p>
      </section>
    </main>
  )
}
