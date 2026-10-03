import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { speakJapanese, updateState, useLearning } from "../learning"
import type { KanaEntry } from "../content/model"
import { writingCharacterId } from "../navigation"
import { characterSequence, drawingReducer, emptyDrawing, kanaCharacter, strokeGeometry, strokeSource } from "./model"
import { defaultWritingSettings, type WritingSettings } from "./settings"
import StrokeDiagram from "./StrokeDiagram"
import HandwritingBoard from "./HandwritingBoard"
import WritingResult from "./WritingResult"
import useReducedMotion from "./useReducedMotion"

function WritingSettingsPanel({ settings, onChange }: { settings: WritingSettings; onChange: (settings: WritingSettings) => void }) {
  const helpId = useId()
  const toggle = (key: "guided" | "grid" | "numbers", label: string) => <div className="learn-preference"><span>{label}</span><button className="writing-setting-toggle" aria-label={label} aria-pressed={settings[key]} onClick={() => onChange({ ...settings, [key]: !settings[key] })}>{settings[key] ? "ON" : "OFF"}</button></div>
  return <details className="learn-panel writing-settings"><summary>Writing settings <span>Make it comfortable</span></summary><div>
    <p className="eyebrow">STROKE GUIDANCE</p>{toggle("guided", "Guided Strokes")}
    <p className="eyebrow">STROKE ANIMATION</p><label className="learn-preference">Animation speed<select value={settings.speed} onChange={event => onChange({ ...settings, speed: event.target.value as WritingSettings["speed"] })}>{["Slow", "Normal", "Fast"].map(speed => <option key={speed}>{speed}</option>)}</select></label>
    <p className="eyebrow">DRAWING</p><label className="learn-preference">Smoothness<select value={settings.smoothness} aria-describedby={helpId} onChange={event => onChange({ ...settings, smoothness: event.target.value as WritingSettings["smoothness"] })}>{["Low", "Medium", "High"].map(value => <option key={value}>{value}</option>)}</select></label><p className="learn-local-note" id={helpId}>Higher stabilization smooths your strokes but may feel slightly less responsive.</p>
    <p className="eyebrow">GRID & NUMBERS</p>{toggle("grid", "Show Grid")}{toggle("numbers", "Show Stroke Numbers")}
    <p className="eyebrow">PEN</p><label className="writing-pen-label">Stroke thickness <output>{settings.thickness}</output><input aria-label="Stroke thickness" type="range" min="1" max="6" step=".5" value={settings.thickness} onChange={event => onChange({ ...settings, thickness: Number(event.target.value) })} /></label>
    <button className="dict-text-button" onClick={() => onChange({ ...defaultWritingSettings })}>Reset Writing Settings</button>
    </div></details>
}

export function CharacterPractice({ entry }: { entry: KanaEntry }) {
  const data = useLearning()
  const navigate = useNavigate()
  const settings = data.preferences.writing || defaultWritingSettings
  const geometry = useMemo(() => strokeGeometry(entry), [entry])
  const sequence = useMemo(() => characterSequence(entry), [entry])
  const index = sequence.findIndex(character => character.id === entry.id)
  const tablePath = `/writing-system?script=${entry.kind.toLowerCase()}`
  const mode = data.preferences.writingMode || "Study"
  const setMode = (writingMode: "Study" | "Write") => { updateState({ preferences: { ...data.preferences, writingMode } }); if (writingMode === "Write") setPlaying(false) }
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  progressRef.current = progress
  const [playing, setPlaying] = useState(false)
  const [playbackRevision, setPlaybackRevision] = useState(0)
  const [drawing, dispatch] = useReducer(drawingReducer, emptyDrawing)
  const [activeStroke, setActiveStroke] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const toggleGuidance = () => updateState({ preferences: { ...data.preferences, writing: { ...settings, guided: !settings.guided } } })
  const finishWriting = () => { if (activeStroke) return; if (drawing.strokes.length) { setCompleted(true); setResultOpen(true); setNotice("") } else setNotice("Draw at least one stroke, then right-click the grid or choose Done · Self-check.") }
  const [notice, setNotice] = useState("")
  const reducedMotion = useReducedMotion()
  const autoplayStarted = useRef(false)
  useEffect(() => {
    setProgress(0)
    setPlaying(false)
    setPlaybackRevision(value => value + 1)
    dispatch({ type: "clear" })
    setActiveStroke(false)
    setCompleted(false)
    setResultOpen(false)
    setNotice("")
    autoplayStarted.current = false
  }, [entry.id])
  useEffect(() => {
    if (!playing || !geometry.length) return
    if (reducedMotion) { setProgress(geometry.length); setPlaying(false); return }
    const duration = settings.speed === "Slow" ? 1800 : settings.speed === "Fast" ? 450 : 950
    const initial = progressRef.current
    let start: number | undefined
    let frame: number
    const tick = (timestamp: number) => {
      start ??= timestamp
      const value = Math.min(geometry.length, initial + (timestamp - start) / duration)
      setProgress(value)
      if (value >= geometry.length) setPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, playbackRevision, settings.speed, geometry.length, reducedMotion])
  const play = (replay = false) => {
    if (reducedMotion) { setProgress(geometry.length); setPlaying(false); setNotice("Reduced motion is enabled. The complete stroke reference is shown without animation."); return }
    if (replay || progress >= geometry.length) { progressRef.current = 0; setProgress(0); setPlaybackRevision(value => value + 1) }
    setPlaying(true)
  }
  const resetDrawing = () => { dispatch({ type: "clear" }); setCompleted(false); setResultOpen(false); setActiveStroke(false); setMode("Write"); setNotice("") }
  useEffect(() => {
    if (mode === "Study" && geometry.length && !autoplayStarted.current) { autoplayStarted.current = true; play() }
  }, [mode])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (resultOpen || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.defaultPrevented) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return
      const key = event.key.toLowerCase()
      const actions: Record<string, () => void> = { "1": () => setMode("Study"), "2": () => setMode("Write") }
      if (index > 0) actions.a = () => navigate(`/writing-system/character/${sequence[index - 1].id}`)
      if (index < sequence.length - 1) actions.d = () => navigate(`/writing-system/character/${sequence[index + 1].id}`)
      if (mode === "Study" && geometry.length) { actions[" "] = () => playing ? setPlaying(false) : play(); actions.r = () => play(true) }
      if (mode === "Write") actions[" "] = toggleGuidance
      if (mode === "Write" && !activeStroke) {
        if (drawing.strokes.length) actions.z = resetDrawing
        if (!completed && drawing.strokes.length) actions.x = () => dispatch({ type: "undo" })
        if (!completed && drawing.redo.length) actions.c = () => dispatch({ type: "redo" })
      }
      if (actions[key]) { event.preventDefault(); actions[key]() }
    }
    window.addEventListener("keydown", shortcut)
    return () => window.removeEventListener("keydown", shortcut)
  })
  const animationState = playing ? "Playing" : progress >= geometry.length && geometry.length ? "Complete" : progress > 0 ? "Paused" : "Ready"
  return <main className="workspace-page writing-page">
    <header className="writing-page-heading"><button className="dict-back" onClick={() => navigate(tablePath)}>← Back to Writing System</button><span className="writing-context">{entry.kind} · {entry.group}</span></header>
    <div className="writing-layout">
      <section className="learn-panel writing-workspace" aria-label={mode === "Write" ? "Handwriting practice" : "Stroke-order study"}>
        <div className="writing-workspace-top"><div><p className="eyebrow">{mode === "Write" ? "MAKE IT YOURS" : "WATCH THE MOVEMENT"}</p><h2>{mode === "Write" ? "Your turn to write" : "Stroke order"}</h2></div><div className="script-toggle writing-mode-switch" role="group" aria-label="Writing mode"><button className={mode === "Study" ? "active" : ""} aria-label="Study" aria-keyshortcuts="1" aria-pressed={mode === "Study"} onClick={() => setMode("Study")}>Study <kbd>1</kbd></button><button className={mode === "Write" ? "active" : ""} aria-label="Write" aria-keyshortcuts="2" aria-pressed={mode === "Write"} onClick={() => setMode("Write")}>Write <kbd>2</kbd></button></div></div>
        <p className="writing-workspace-romaji" aria-label={`Romaji: ${entry.romaji}`}>{entry.romaji}</p>
        {mode === "Study" ? <>
          <div className="writing-board-caption"><span>{geometry.length ? `${geometry.length} strokes` : "Reference only"}</span><span className="writing-playback-state" role="status">{geometry.length ? animationState : "No stroke data"}</span></div>
          {geometry.length ? <StrokeDiagram strokes={geometry} progress={progress} grid={settings.grid} numbers={settings.numbers} character={entry.japanese} /> : <div className="writing-unavailable"><span lang="ja">{entry.japanese}</span><h3>Stroke order isn’t available yet.</h3><p>You can still hear this character and write freely. We won’t substitute a font reveal for real stroke training.</p><button className="dict-primary" onClick={() => setMode("Write")}>Write freely</button></div>}
          <div className="writing-controls"><button className="dict-primary" aria-label={playing ? "Pause" : "Play"} aria-keyshortcuts="Space" disabled={!geometry.length} onClick={() => playing ? setPlaying(false) : play()}>{playing ? "Pause" : "Play"} <kbd>Space</kbd></button><button className="secondary-button" aria-label="Replay" aria-keyshortcuts="r" disabled={!geometry.length} onClick={() => play(true)}>Replay <kbd>R</kbd></button><button className="dict-text-button" disabled={!geometry.length || progress <= 0} onClick={() => { setPlaying(false); setProgress(value => Math.max(0, Math.ceil(value) - 1)) }}>Previous stroke</button><button className="dict-text-button" disabled={!geometry.length || progress >= geometry.length} onClick={() => { setPlaying(false); setProgress(value => Math.min(geometry.length, Math.floor(value) + 1)) }}>Next stroke</button></div>
          <p className="writing-board-help">{geometry.length ? `Stroke ${Math.min(geometry.length, Math.floor(progress) + 1)} / ${geometry.length} · Follow the moving green tip.` : "Missing stroke data does not affect your saved learning progress."}</p>
        </> : <>
          <div className="writing-board-caption"><span>{settings.guided ? "Guided strokes ON" : "Free writing · guidance OFF"} <kbd>Space</kbd></span><span role="status">{completed ? "Completed" : activeStroke ? "Drawing…" : `${drawing.strokes.length} drawn strokes`}</span></div>
          <HandwritingBoard character={entry.japanese} geometry={geometry} settings={settings} strokes={drawing.strokes} completed={completed} onStroke={stroke => dispatch({ type: "add", stroke })} onActive={setActiveStroke} onDone={finishWriting} />
          <div className="writing-controls"><button className="secondary-button" aria-label="Clear" aria-keyshortcuts="z" disabled={!drawing.strokes.length || activeStroke} onClick={resetDrawing}>Clear <kbd>Z</kbd></button><button className="secondary-button" aria-label="Undo" aria-keyshortcuts="x" disabled={!drawing.strokes.length || activeStroke || completed} onClick={() => dispatch({ type: "undo" })}>Undo <kbd>X</kbd></button><button className="secondary-button" aria-label="Redo" aria-keyshortcuts="c" disabled={!drawing.redo.length || activeStroke || completed} onClick={() => dispatch({ type: "redo" })}>Redo <kbd>C</kbd></button><button className="dict-primary" disabled={!drawing.strokes.length || activeStroke} onClick={finishWriting}>{completed ? "View self-check" : "Done · Self-check"}</button></div>
          <p className="writing-board-help">Right-click the grid to finish and open your self-check.</p>
        </>}
      </section>
      <aside className="writing-side"><WritingSettingsPanel settings={settings} onChange={writing => updateState({ preferences: { ...data.preferences, writing } })} /><section className="learn-panel writing-note"><span lang="ja" aria-hidden="true">一</span><h3>A little space to practice.</h3><p>See the shape. Follow the strokes. Then try it your way.</p><p>Your drawing stays on this page only. Writing settings stay on your device.</p></section><details className="writing-credits"><summary>Stroke data & credits</summary><p>{strokeSource.attribution}</p><p>Version: <span className="writing-source-version">{strokeSource.version}</span></p><a href={strokeSource.url} target="_blank" rel="noreferrer">KanjiVG</a>{" · "}<a href={strokeSource.licenseUrl} target="_blank" rel="noreferrer">{strokeSource.license}</a>{" · "}<a href={`${import.meta.env.BASE_URL}writing/KanjiVG-LICENSE.txt`} target="_blank" rel="noreferrer">Bundled attribution</a></details></aside>
    </div>
    <p className="writing-status" role="status">{notice}</p>
    <section className="writing-character-heading" aria-label="Selected character">
      <button className="secondary-button writing-character-prev" aria-label="Previous character" aria-keyshortcuts="a" disabled={index <= 0} onClick={() => navigate(`/writing-system/character/${sequence[index - 1].id}`)}>← Previous <kbd>A</kbd></button>
      <div><p className="eyebrow">ONE CHARACTER AT A TIME</p><h1 lang="ja">{entry.japanese}</h1><div className="writing-character-meta"><span>{entry.kind}</span><span>{index + 1} / {sequence.length}</span><button className="dict-text-button" aria-label={`Play pronunciation for ${entry.japanese}`} onClick={() => {
        if (!data.preferences.pronunciation) setNotice("Pronunciation is turned off in Settings.")
        else if (!("speechSynthesis" in window)) setNotice("Pronunciation isn’t available on this device.")
        else { speakJapanese(entry.japanese); setNotice("") }
      }}>Listen ↗</button></div></div>
      <button className="secondary-button writing-character-next" aria-label="Next character" aria-keyshortcuts="d" disabled={index < 0 || index >= sequence.length - 1} onClick={() => navigate(`/writing-system/character/${sequence[index + 1].id}`)}>Next → <kbd>D</kbd></button>
    </section>
    {resultOpen && <WritingResult character={entry.japanese} strokes={drawing.strokes} geometry={geometry} onClose={() => setResultOpen(false)} onContinueWriting={() => { setResultOpen(false); setCompleted(false) }} onAgain={resetDrawing} onNext={index < sequence.length - 1 ? () => navigate(`/writing-system/character/${sequence[index + 1].id}`) : undefined} />}
  </main>
}

export default function CharacterWriting() {
  const location = useLocation()
  const id = writingCharacterId(location.pathname)
  const entry = id ? kanaCharacter(id) : undefined
  if (!entry) return <main className="workspace-page writing-page"><section className="learn-panel writing-recovery"><p className="eyebrow">LET’S FIND YOUR CHARACTER</p><h1>Character not found</h1><p>This character isn’t available in the bundled kana collection. Your saved learning data is safe.</p><div className="writing-controls"><Link className="dict-primary" to="/writing-system">Back to Writing System</Link><Link className="secondary-button" to="/">Return Home</Link></div></section></main>
  return <CharacterPractice key={entry.id} entry={entry} />
}
