import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import ConfirmationDialog from "./ConfirmationDialog"
import {
  availableDirections,
  beginSession,
  completeSession,
  quitSession,
  defaultConfig,
  eligibleItems,
  isCorrect,
  itemById,
  items,
  nextCard,
  question,
  recordAnswer,
  recordUnderstanding,
  understandingRatings,
  saveItem,
  shuffle,
  speakJapanese,
  updateState,
  useLearning,
  registerDictionaryItems,
  resolvePracticeConfig,
  type AnswerType,
  type Config,
  type Content,
  type Mode,
  type Session,
  type Understanding,
} from "./learning"
import { dictionaryManifest, randomDictionaryPracticeItems } from "./content/dictionarySearch"

const answerKeys = ["q", "w", "a", "s"]
const selfRatings = understandingRatings.map(label => ({ label }))
const allPracticeLevels = ["N5", "N4", "N3", "N2", "N1", "Unclassified"]

function HiddenAnswer({ visible, onHold, children, alwaysVisible = false }: {
  visible: boolean
  onHold: (held: boolean) => void
  children: ReactNode
  alwaysVisible?: boolean
}) {
  return (
    <div className="learn-answer-preview">
      <div
        id="practice-correct-answer"
        className={`learn-hidden-answer ${visible || alwaysVisible ? "is-visible" : ""}`}
        aria-hidden={!visible && !alwaysVisible}
        inert={!visible && !alwaysVisible}
      >
        {children}
      </div>
      {!alwaysVisible && <button
        type="button"
        className="learn-hold-answer"
        aria-keyshortcuts="T"
        aria-controls="practice-correct-answer"
        aria-expanded={visible}
        onPointerDown={event => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          onHold(true)
        }}
        onPointerUp={() => onHold(false)}
        onPointerCancel={() => onHold(false)}
        onLostPointerCapture={() => onHold(false)}
        onContextMenu={event => event.preventDefault()}
      >
        Hold <kbd>T</kbd> or hold here to view the answer
      </button>}
    </div>
  )
}

export function configForMode(mode: Mode, previous = defaultConfig): Config {
  const content = mode === "Flashcards"
    ? previous.content.filter(kind =>
      ["Hiragana", "Katakana", "Kanji", "Hiragana word", "Katakana word", "Kanji word"].includes(kind))
    : previous.content
  if (mode === "Identification")
    return {
      ...previous,
      content,
      mode,
      direction: previous.content.every((kind) =>
        ["Hiragana", "Katakana"].includes(kind),
      )
        ? "Kana → Romaji"
        : "Japanese → English",
      answerType: "Multiple Choice",
    }
  if (mode === "Romaji Input")
    return {
      ...previous,
      content,
      mode,
      direction: "Japanese → Romaji",
      answerType: "Typing",
    }
  if (mode === "Sentence Formation")
    return {
      ...previous,
      mode,
      content: ["Sentences"],
      direction: "English → Japanese",
      answerType: "Typing",
    }
  return { ...previous, content: content.length ? content : ["Kanji"], mode }
}

function Toggles({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: string[]
  selected: string[]
  onToggle: (option: string) => void
}) {
  return (
    <fieldset className="learn-toggles">
      <legend>{title}</legend>
      <div>
        {options.map((option) => (
          <button
            type="button"
            aria-pressed={selected.includes(option)}
            className={selected.includes(option) ? "selected" : ""}
            key={option}
            onClick={() => onToggle(option)}
          >
            <span>{selected.includes(option) ? "✓" : "+"}</span>
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export default function Practice({
  initialMode,
  resumeSession = false,
  overviewOnly = false,
  onHome,
}: {
  initialMode?: Mode
  resumeSession?: boolean
  overviewOnly?: boolean
  onHome: () => void
}) {
  const data = useLearning()
  const [stage, setStage] = useState<"menu" | "setup">(
    initialMode ? "setup" : "menu",
  )
  const [config, setConfig] = useState<Config>(() =>
    initialMode
      ? configForMode(initialMode, { ...data.practiceConfig, levels: allPracticeLevels })
      : { ...data.practiceConfig, levels: allPracticeLevels },
  )
  const [answer, setAnswer] = useState("")
  const [feedback, setFeedback] = useState<boolean | Understanding | null>(null)
  const [hint, setHint] = useState(false)
  const [quitOpen, setQuitOpen] = useState(false)
  const [pieces, setPieces] = useState<number[]>([])
  const [completed, setCompleted] = useState<Session | null>(null)
  const [editing, setEditing] = useState(overviewOnly || !!initialMode || !resumeSession && !data.activeSession)
  const [retrying, setRetrying] = useState(false)
  const [keyPeeking, setKeyPeeking] = useState(false)
  const [pointerPeeking, setPointerPeeking] = useState(false)
  const [dictionaryCount, setDictionaryCount] = useState<number | null>(null)
  const [dictionaryLoading, setDictionaryLoading] = useState(false)
  const [dictionaryError, setDictionaryError] = useState<string | null>(null)
  const [completedPractice, setCompletedPractice] = useState<{
    config: Config
    ids: string[]
  } | null>(null)
  const active = data.activeSession
  const current = active && itemById(active.ids[active.index])
  const prompt = current && active ? question(current, active.config) : null
  const cardKey = `${active?.id || ""}:${active?.index || 0}`
  useEffect(() => {
    setAnswer("")
    setHint(false)
    setPieces([])
    setRetrying(false)
    setKeyPeeking(false)
    setPointerPeeking(false)
    setFeedback(
      current && active && current.id in active.answers
        ? active.answers[current.id]
        : null,
    )
  }, [cardKey])
  const choices = useMemo(() => {
    if (!current || !active || !prompt) return []
    const alternatives = [
      ...new Set(
        items
          .filter(
            (item) => item.kind === current.kind && item.id !== current.id,
          )
          .map((item) => question(item, active.config).expected),
      ),
    ].filter((value) => !isCorrect(current, active.config, value))
    return shuffle([prompt.expected, ...shuffle(alternatives).slice(0, 3)])
  }, [cardKey])
  const tokens = useMemo(
    () =>
      current?.tokens
        ? shuffle(current.tokens.map((text, index) => ({ text, index })))
        : [],
    [cardKey],
  )
  const changeConfig = (change: Partial<Config>) => {
    setConfig(previous => {
      const next = { ...previous, ...change }
      if (
        next.content.length &&
        !availableDirections(next.content).includes(next.direction)
      )
        next.direction = availableDirections(next.content)[0]
      return next
    })
  }
  const toggle = (key: "content" | "levels" | "writing", option: string) =>
    changeConfig({
      [key]: config[key].includes(option as Content)
        ? config[key].filter((value) => value !== option)
        : [...config[key], option],
    } as Partial<Config>)
  const submit = (value = answer) => {
    if (!current || !active || feedback !== null) return
    const correct = isCorrect(current, active.config, value)
    if (recordAnswer(current.id, correct, retrying)) setFeedback(correct)
  }
  const rateUnderstanding = (rating: Understanding) => {
    if (!current || feedback !== null) return
    if (recordUnderstanding(current.id, rating)) setFeedback(rating)
  }
  const next = () => {
    if (!active || feedback === null) return
    setKeyPeeking(false)
    setPointerPeeking(false)
    if (active.index + 1 >= active.ids.length) {
      setCompletedPractice({ config: active.config, ids: [...active.ids] })
      setCompleted(completeSession())
    } else nextCard()
  }
  const start = (nextConfig = config, ids?: string[]) => {
    const resolvedConfig = resolvePracticeConfig(nextConfig)
    const launch = (sessionIds?: string[]) => {
      if (!beginSession(resolvedConfig, sessionIds)) return
      setCompleted(null)
      setCompletedPractice(null)
      setKeyPeeking(false)
      setPointerPeeking(false)
      setEditing(false)
      setStage("setup")
    }
    if (resolvedConfig.content.includes("All") && !ids) {
      setDictionaryLoading(true)
      setDictionaryError(null)
      randomDictionaryPracticeItems(nextConfig.limit)
        .then(entries => {
          registerDictionaryItems(entries)
          launch(entries.map(entry => entry.id))
        })
        .catch(error => setDictionaryError(error instanceof Error ? error.message : "Dictionary practice unavailable"))
        .finally(() => setDictionaryLoading(false))
    } else {
      launch(ids)
    }
  }
  const retryCard = () => {
    if (feedback !== false || !active || !current || active.retried.includes(current.id)) return
    setRetrying(true)
    setFeedback(null)
    setAnswer("")
    setPieces([])
    setKeyPeeking(false)
    setPointerPeeking(false)
  }
  const practiceAgain = () => start(completedPractice?.config || data.practiceConfig, completedPractice?.ids)
  const reviewMistakes = () => {
    if (!completed?.mistakes.length) return
    start(
      { ...(completedPractice?.config || data.practiceConfig), reviewOnly: false, learnedOnly: false },
      [...completed.mistakes],
    )
  }
  const holdAnswer = (held: boolean) => {
    setPointerPeeking(held)
  }
  const quit = () => {
    quitSession()
    setQuitOpen(false)
    setCompleted(null)
    setCompletedPractice(null)
    setEditing(true)
    setStage("menu")
  }
  const shortcuts = useRef({ completed, active, current, feedback, editing, quitOpen, choices, submit, rateUnderstanding, next, retryCard, practiceAgain, reviewMistakes })
  shortcuts.current = { completed, active, current, feedback, editing, quitOpen, choices, submit, rateUnderstanding, next, retryCard, practiceAgain, reviewMistakes }
  useEffect(() => {
    let controlTap = false
    const resetPeek = () => { controlTap = false; setKeyPeeking(false); setPointerPeeking(false) }
    const keyDown = (event: KeyboardEvent) => {
      const state = shortcuts.current
      if (state.quitOpen) { controlTap = false; return }
      if (event.key === "Control" && !event.repeat && !event.isComposing && !event.metaKey && !event.altKey) { controlTap = true; return }
      controlTap = false
      if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === "`" && state.active && state.current && !state.editing && !state.completed) {
        event.preventDefault()
        resetPeek()
        setQuitOpen(true)
        return
      }
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return
      const key = event.key.toLowerCase()
      if (state.completed) {
        if (key === "r") { event.preventDefault(); state.practiceAgain() }
        if (key === "t" && state.completed.mistakes.length) { event.preventDefault(); state.reviewMistakes() }
        return
      }
      if (!state.active || !state.current || state.editing) return
      const choiceIndex = answerKeys.indexOf(key)
      if (choiceIndex !== -1 && state.feedback === null && state.active.config.mode !== "Sentence Formation") {
        if (state.active.config.answerType === "Multiple Choice" && state.choices.length > 1 && state.choices[choiceIndex] !== undefined) {
          event.preventDefault()
          state.submit(state.choices[choiceIndex])
        } else if (state.active.config.answerType === "Self Check") {
          event.preventDefault()
          state.rateUnderstanding(selfRatings[choiceIndex].label)
        }
      } else if ((event.code === "Space" || event.key === " ") && state.feedback !== null) {
        event.preventDefault()
        state.next()
      } else if (key === "r" && state.feedback === false) {
        event.preventDefault()
        state.retryCard()
      } else if (key === "t" && state.feedback !== null && state.feedback !== true) {
        event.preventDefault()
        setKeyPeeking(true)
      }
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        const state = shortcuts.current
        if (controlTap && !state.quitOpen && !state.completed && state.active && state.current && !state.editing && state.feedback === null) setHint(true)
        controlTap = false
      }
      if (event.key.toLowerCase() === "t") setKeyPeeking(false)
    }
    const visibilityChange = () => { if (document.hidden) resetPeek() }
    window.addEventListener("keydown", keyDown)
    window.addEventListener("keyup", keyUp)
    window.addEventListener("blur", resetPeek)
    document.addEventListener("visibilitychange", visibilityChange)
    return () => {
      window.removeEventListener("keydown", keyDown)
      window.removeEventListener("keyup", keyUp)
      window.removeEventListener("blur", resetPeek)
      document.removeEventListener("visibilitychange", visibilityChange)
    }
  }, [])
  const showRomaji =
    data.preferences.romaji !== "Hide" &&
    (data.preferences.romaji !== "Show for difficult words" ||
      !current ||
      !data.progress[current.id]?.correct ||
      data.progress[current.id]?.needsReview)
  const modes: {
    mode: Mode
    icon: string
    description: string
  }[] = [
    {
      mode: "Flashcards",
      icon: "あ",
      description: "Recall it your way. Choose the direction and answer style.",
    },
  ]
  const eligible = eligibleItems(config, data.progress)
  useEffect(() => {
    if (!config.content.includes("All") || dictionaryCount !== null) return
    dictionaryManifest().then(manifest => setDictionaryCount(manifest.entryCount)).catch(() => setDictionaryCount(null))
  }, [config.content, dictionaryCount])

  if (completed)
    return (
      <main className="workspace-page learning-page">
        <section className="learn-results">
          <span className="success-mark">✓</span>
          <p className="eyebrow">ONE STEP FORWARD</p>
          <h1>Practice complete!</h1>
          <p>
            {completed.total} cards · {completed.mode}
          </p>
          {Object.keys(completed.ratings || {}).length > 0 ? (
            <div className="learn-result-numbers">
              {understandingRatings.map(rating => <div key={rating}><b>{Object.values(completed.ratings || {}).filter(value => value === rating).length}</b><span>{rating}</span></div>)}
            </div>
          ) : <><div className="learn-score">
            <strong>
              {completed.total
                ? Math.round((completed.correct / completed.total) * 100)
                : 0}
              <small>%</small>
            </strong>
            <span>First-answer accuracy</span>
          </div>
          <div className="learn-result-numbers">
            <div>
              <b>{completed.correct}</b>
              <span>Correct</span>
            </div>
            <div>
              <b>{completed.incorrect}</b>
              <span>Incorrect</span>
            </div>
            <div>
              <b>{completed.newItems}</b>
              <span>Newly learned</span>
            </div>
          </div>
          </>}
          {completed.mistakes.length > 0 && (
            <section className="learn-session-mistakes">
              <h2>Your missed cards</h2>
              <ul>
                {completed.mistakes.map(id => {
                  const item = itemById(id)
                  if (!item) return null
                  return <li key={id}><span>{question(item, completedPractice?.config || data.practiceConfig).prompt}</span><small>Missed on first answer</small></li>
                })}
              </ul>
            </section>
          )}
          <div className="learn-result-actions">
            {completed.mistakes.length > 0 && (
              <button
                className="wide-primary"
                onClick={reviewMistakes}
                aria-keyshortcuts="T"
              >
                Review mistakes ({completed.mistakes.length}) <kbd>T</kbd>
              </button>
            )}
            <button
              className="secondary-button"
              onClick={practiceAgain}
              aria-keyshortcuts="R"
            >
              Practice again <kbd>R</kbd>
            </button>
            <button className="text-button" onClick={onHome}>
              Home
            </button>
          </div>
        </section>
      </main>
    )

  if (active && current && prompt && !editing) {
    const sentence = active.config.mode === "Sentence Formation"
    const answerType = sentence ? "Typing" : active.config.answerType
    const progress = data.progress[current.id]
    return (
      <main className="workspace-page learning-page">
        <button className="learn-soft-button practice-quit" onClick={() => { setKeyPeeking(false); setPointerPeeking(false); setQuitOpen(true) }} aria-keyshortcuts="`">← Quit <kbd>`</kbd></button>
        {quitOpen && <ConfirmationDialog title="Quit this test?" description="This unfinished session won’t be saved or available to resume. Answers already recorded in your learning progress stay safe. You’ll return to choose what to practice." confirmLabel="Yes, quit" cancelLabel="No, keep practicing" onConfirm={quit} onCancel={() => setQuitOpen(false)} />}
        <header className="learn-heading">
          <div>
            <p className="eyebrow">{active.config.mode.toUpperCase()}</p>
            <h1>
              {current.kind === "Kanji"
                ? "Kanji practice"
                : sentence
                  ? "Build the sentence"
                  : current.kind === "Hiragana" || current.kind === "Katakana"
                    ? `${current.kind} practice`
                    : "A little practice, real progress."}
            </h1>
          </div>
          <button className="learn-soft-button" onClick={onHome}>
            Pause
          </button>
        </header>
        <div className="learn-session-progress">
          <span>
            Card {active.index + 1} / {active.ids.length}
          </span>
          <span>{active.config.direction}</span>
          <div>
            <span
              style={{ width: `${(active.index / active.ids.length) * 100}%` }}
            />
          </div>
        </div>
        <section className="learn-card">
          <div className="learn-card-top">
            <span className="dict-badge">{current.level || current.kind}</span>
            <div>
              {data.preferences.pronunciation && (
                <button
                  className="dict-icon-button"
                  onClick={() => speakJapanese(current.japanese)}
                  aria-label="Hear pronunciation"
                >
                  ♪
                </button>
              )}
              <button
                className={`dict-icon-button ${progress?.saved ? "saved" : ""}`}
                onClick={() => saveItem(current.id)}
                aria-label={progress?.saved ? "Unsave item" : "Save item"}
              >
                {progress?.saved ? "★" : "☆"}
              </button>
            </div>
          </div>
          <p className="learn-prompt-instruction">
            {sentence
              ? "Put the Japanese pieces in order."
              : active.config.mode === "Romaji Input" ||
                  active.config.direction.endsWith("Romaji")
                ? "Type the reading in romaji."
                : active.config.direction.endsWith("English")
                  ? "What does this mean?"
                  : "Write it in Japanese."}
          </p>
          <div
            className={`learn-prompt ${
              /[一-龯ぁ-ヺ]/.test(prompt.prompt) ? "japanese" : ""
            }`}
            lang={/[一-龯ぁ-ヺ]/.test(prompt.prompt) ? "ja" : "en"}
          >
            {prompt.prompt}
          </div>
          {hint && <p className="learn-hint">{prompt.hint}</p>}
          {!hint && feedback === null && (
            <button className="dict-text-button" onClick={() => setHint(true)} aria-label="Show hint (tap Control)">
              Show hint <kbd>Ctrl</kbd>
            </button>
          )}
        </section>
        {feedback === null ? (
          <section className="learn-answer-area">
            {sentence ? (
              <>
                <div
                  className="learn-sentence-answer"
                  aria-label="Your sentence"
                >
                  {pieces.length ? (
                    pieces.map((index, position) => (
                      <button
                        key={index}
                        onClick={() =>
                          setPieces(
                            pieces.filter(
                              (_, piecePosition) => piecePosition !== position,
                            ),
                          )
                        }
                      >
                        {current.tokens![index]} <small>×</small>
                      </button>
                    ))
                  ) : (
                    <span>Tap the pieces to build your sentence.</span>
                  )}
                </div>
                <div className="learn-sentence-pieces">
                  {tokens.map((token) => (
                    <button
                      key={token.index}
                      disabled={pieces.includes(token.index)}
                      onClick={() => setPieces([...pieces, token.index])}
                    >
                      {token.text}
                    </button>
                  ))}
                </div>
                <button
                  className="wide-primary"
                  disabled={pieces.length !== tokens.length}
                  onClick={() =>
                    submit(
                      pieces.map((index) => current.tokens![index]).join(""),
                    )
                  }
                >
                  Check
                </button>
              </>
            ) : answerType === "Multiple Choice" && choices.length > 1 ? (
              <div className="learn-choices">
                {choices.map((choice, index) => (
                  <button key={choice} className={`learn-choice-${answerKeys[index]}`} onClick={() => submit(choice)} aria-keyshortcuts={answerKeys[index].toUpperCase()}>
                    {choice} <kbd>{answerKeys[index].toUpperCase()}</kbd>
                  </button>
                ))}
              </div>
            ) : answerType === "Self Check" ? (
                  <div className="learn-self-check">
                    <div className="learn-choices learn-self-ratings">
                      {selfRatings.map((rating, index) => (
                        <button
                          key={rating.label}
                          className={`learn-choice-${answerKeys[index]}`}
                          onClick={() => rateUnderstanding(rating.label)}
                          aria-keyshortcuts={answerKeys[index].toUpperCase()}
                        >
                          {rating.label} <kbd>{answerKeys[index].toUpperCase()}</kbd>
                        </button>
                      ))}
                    </div>
                  </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  if (answer.trim()) submit()
                }}
              >
                <label htmlFor="practice-answer">Your answer</label>
                <div>
                  <input
                    id="practice-answer"
                    key={cardKey}
                    autoFocus
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    placeholder={
                      active.config.direction.endsWith("Romaji") ||
                      active.config.mode === "Romaji Input"
                        ? "Type the romaji..."
                        : "Type your answer..."
                    }
                  />
                  <button className="wide-primary" disabled={!answer.trim()}>
                    Check
                  </button>
                </div>
              </form>
            )}
          </section>
        ) : (
          <section
            className={`learn-feedback ${typeof feedback === "string" ? "self-rated" : feedback ? "correct" : "incorrect"}`}
            aria-live="polite"
          >
            <h2>{typeof feedback === "string" ? `Understanding: ${feedback}` : feedback ? "✓ Correct!" : "× Not quite"}</h2>
            <HiddenAnswer visible={keyPeeking || pointerPeeking} onHold={holdAnswer} alwaysVisible={feedback === true}>
            <small>{typeof feedback === "string" ? "Reference answer" : "Correct answer"}: {prompt.expected}</small>
            <strong lang="ja">{current.japanese}</strong>
            {current.reading !== current.japanese && (
              <span lang="ja">{current.reading}</span>
            )}
            {showRomaji && <span>{current.romaji}</span>}
            {data.preferences.english && <p>{current.meanings.join(", ")}</p>}
            </HiddenAnswer>
            <div>
              {feedback === false && !active.retried.includes(current.id) && (
                <button
                  className="secondary-button"
                  onClick={retryCard}
                  aria-keyshortcuts="R"
                >
                  Try again <kbd>R</kbd>
                </button>
              )}
              <button className="wide-primary" onClick={next} aria-keyshortcuts="Space">
                {active.index + 1 === active.ids.length ? "Finish" : "Next"} → <kbd>Space</kbd>
              </button>
            </div>
          </section>
        )}
        <p className="learn-local-note">
          Your progress is saved on this device.
        </p>
      </main>
    )
  }

  if (stage === "setup")
    return (
      <main className="workspace-page learning-page">
        <header className="learn-heading">
          <div>
            <button className="dict-back" onClick={() => setStage("menu")}>
              ← Practice
            </button>
            <h1>{config.mode}</h1>
            <p>Choose what you want to practice.</p>
          </div>
        </header>
        <section className="learn-setup">
          {config.mode !== "Sentence Formation" && (
            <Toggles
              title="Content"
              options={[
                "All",
                "Randomize",
                "Hiragana",
                "Katakana",
                "Kanji",
                ...config.writing.map(system => `${system} word`),
              ]}
              selected={config.content}
              onToggle={(option) => toggle("content", option)}
            />
          )}{" "}
          {config.content.some((kind) =>
            ["Words", "Sentences"].includes(kind),
          ) && (
            <Toggles
              title="Writing system of entries"
              options={["Hiragana", "Katakana", "Kanji"]}
              selected={config.writing}
              onToggle={(option) => toggle("writing", option)}
            />
          )}
          {config.mode !== "Sentence Formation" &&
            config.mode !== "Romaji Input" && (
              <label className="learn-field">
                Question direction
                <select
                  value={config.direction}
                  onChange={(event) =>
                    changeConfig({
                      direction: event.target.value as Config["direction"],
                    })
                  }
                >
                  {availableDirections(config.content).map((direction) => (
                    <option key={direction}>{direction}</option>
                  ))}
                </select>
              </label>
            )}
          {config.mode === "Flashcards" && (
            <Toggles
              title="Answer type"
              options={["Multiple Choice", "Typing", "Self Check", "Randomize"]}
              selected={[config.answerType]}
              onToggle={(option) =>
                changeConfig({ answerType: option as AnswerType })
              }
            />
          )}
          <div className="learn-setup-options">
            <label>
              <input
                type="checkbox"
                checked={config.reviewOnly}
                onChange={(event) =>
                  changeConfig({ reviewOnly: event.target.checked })
                }
              />{" "}
              Needs review only
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.learnedOnly}
                onChange={(event) =>
                  changeConfig({ learnedOnly: event.target.checked })
                }
              />{" "}
              Learned only
            </label>
          </div>
          <label className="learn-field">
            Session size
            <select
              value={config.limit}
              onChange={(event) =>
                changeConfig({ limit: Number(event.target.value) })
              }
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} cards
                </option>
              ))}
            </select>
          </label>
          <div className="learn-setup-footer">
            <div>
              <strong>
                {config.content.includes("All")
                  ? `${dictionaryCount ?? "…"} dictionary items`
                  : config.content.includes("Randomize")
                    ? "Random content"
                    : `${eligible.length} matching items`}
              </strong>
              <small>
                {eligible.length
                  ? `${Math.min(config.limit, eligible.length)} cards in this session`
                  : "No cards match your current filters. Adjust the choices above."}
              </small>
            </div>
            {dictionaryError && <p className="learn-error">{dictionaryError}</p>}
            <button
              className="wide-primary"
              disabled={dictionaryLoading || (!eligible.length && !config.content.includes("All") && !config.content.includes("Randomize"))}
              onClick={() => start()}
            >
              {dictionaryLoading ? "Loading dictionary…" : "Start practice →"}
            </button>
          </div>
          <p className="learn-local-note">
            {active
              ? "Starting a new session replaces the paused session. Your recorded answers are kept."
              : "Only matching bundled content is used."}
          </p>
        </section>
      </main>
    )

  return (
    <main className="workspace-page learning-page">
      <header className="learn-heading">
        <div>
          <p className="eyebrow">YOUR JAPANESE, YOUR WAY</p>
          <h1>What would you like to practice?</h1>
          <p>A word, a sound, a sentence. The choice is yours.</p>
        </div>
      </header>
      <>
        {active && (
          <section className="learn-review-banner">
            <div>
              <h3>Your practice is waiting.</h3>
              <p>
                {active.ids.length - active.index} cards remaining ·{" "}
                {active.config.mode}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => setEditing(false)}
            >
              Continue session →
            </button>
          </section>
        )}
      </>
      <div className="learn-mode-grid">
        {modes.map(({ mode, icon, description }, index) => (
          <button
            className={`learn-mode mode-${index}`}
            key={mode}
            onClick={() => {
              setConfig(configForMode(mode, { ...data.practiceConfig, levels: allPracticeLevels }))
              setStage("setup")
            }}
          >
            <span>{icon}</span>
            <h2>{mode}</h2>
            <p>{description}</p>
            <b>Choose practice →</b>
          </button>
        ))}
      </div>
      <section className="learn-review-banner">
        <div>
          <h3>Make the tricky ones familiar.</h3>
          <p>
            {items.filter((item) => data.progress[item.id]?.needsReview).length}{" "}
            items need a little more practice.
          </p>
        </div>
        <button
          className="secondary-button"
          disabled={!items.some((item) => data.progress[item.id]?.needsReview)}
          onClick={() =>
            start({
              ...defaultConfig,
              mode: "Flashcards",
              content: ["Kanji"],
              levels: ["N5", "N4", "N3", "N2", "N1", "Unclassified"],
              direction: "Japanese → English",
              reviewOnly: true,
            })
          }
        >
          Review mistakes →
        </button>
      </section>
    </main>
  )
}
