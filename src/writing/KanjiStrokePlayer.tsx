import { useEffect, useRef, useState } from "react"
import { updateState, useLearning } from "../learning"
import { defaultWritingSettings } from "./settings"
import type { StrokeGeometry } from "./model"
import StrokeDiagram from "./StrokeDiagram"
import useReducedMotion from "./useReducedMotion"

type StrokeSnapshot = { glyphs: Record<string, { paths: { d: string; label: number[] }[] }>; source: { attribution: string; version: string; license: string; licenseUrl: string } }
let snapshotPromise: Promise<StrokeSnapshot> | undefined
function loadSnapshot() {
  snapshotPromise ||= import("./kanji-strokes.json").then(module => module.default).catch(error => { snapshotPromise = undefined; throw error })
  return snapshotPromise
}

export default function KanjiStrokePlayer({ character }: { character: string }) {
  const data = useLearning()
  const settings = data.preferences.writing || defaultWritingSettings
  const reduced = useReducedMotion()
  const [snapshot, setSnapshot] = useState<StrokeSnapshot | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [geometry, setGeometry] = useState<StrokeGeometry[]>([])
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  progressRef.current = progress
  const [playing, setPlaying] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setFailed(false)
    setSnapshot(null)
    setGeometry([])
    setProgress(0)
    setPlaying(false)
    loadSnapshot().then(value => {
      if (cancelled) return
      const paths = value.glyphs[character]?.paths.map(path => ({ ...path, transform: "" })) || []
      setSnapshot(value)
      setGeometry(paths)
      setPlaying(paths.length > 0)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [character, attempt])
  useEffect(() => {
    if (!playing || !geometry.length) return
    if (reduced) { setProgress(geometry.length); setPlaying(false); return }
    const initial = progressRef.current
    const duration = settings.speed === "Slow" ? 1800 : settings.speed === "Fast" ? 450 : 950
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
  }, [playing, geometry.length, reduced, settings.speed, revision])
  const replay = () => { progressRef.current = 0; setProgress(0); setRevision(value => value + 1); setPlaying(true) }
  const change = (patch: Partial<typeof settings>) => updateState({ preferences: { ...data.preferences, writing: { ...settings, ...patch } } })
  return <section className="kanji-stroke-player" aria-label="Kanji stroke order">
    <h2>Stroke order</h2>
    {failed ? <div className="learn-panel-copy" role="alert">We couldn’t load this stroke reference. Your progress is safe. <button className="dict-text-button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>
      : !snapshot ? <p role="status" className="learn-panel-copy">Loading stroke reference…</p>
      : !geometry.length ? <p className="learn-panel-copy">Stroke-order data isn’t available for this character. You can still explore its readings and practice below.</p>
      : <>
        <StrokeDiagram strokes={geometry} progress={progress} grid={settings.grid} numbers={settings.numbers} character={character} />
        <p className="writing-board-help" role="status">{playing ? "Playing" : progress >= geometry.length ? "Complete" : "Paused"} · {geometry.length} strokes{reduced ? " · Reduced motion: complete reference shown." : " · Follow the moving green tip."}</p>
        <div className="writing-controls">
          <button className="dict-primary" onClick={() => playing ? setPlaying(false) : progress >= geometry.length ? replay() : setPlaying(true)}>{playing ? "Pause" : "Play"}</button>
          <button className="secondary-button" onClick={replay}>Replay</button>
          <button className="dict-text-button" disabled={progress <= 0} onClick={() => { setPlaying(false); setProgress(value => Math.max(0, Math.ceil(value) - 1)) }}>Previous stroke</button>
          <button className="dict-text-button" disabled={progress >= geometry.length} onClick={() => { setPlaying(false); setProgress(value => Math.min(geometry.length, Math.floor(value) + 1)) }}>Next stroke</button>
        </div>
        <div className="kanji-animation-settings"><label>Speed <select value={settings.speed} onChange={event => change({ speed: event.target.value as typeof settings.speed })}>{["Slow", "Normal", "Fast"].map(speed => <option key={speed}>{speed}</option>)}</select></label><label><input type="checkbox" checked={settings.numbers} onChange={event => change({ numbers: event.target.checked })} /> Show stroke numbers</label></div>
      </>}
    {snapshot && <details className="writing-credits"><summary>Stroke data & credits</summary><p>{snapshot.source.attribution}</p><p>Revision: {snapshot.source.version}</p><a href={snapshot.source.licenseUrl} target="_blank" rel="noreferrer">{snapshot.source.license}</a>{" · "}<a href={`${import.meta.env.BASE_URL}writing/KanjiVG-LICENSE.txt`}>Bundled attribution</a></details>}
  </section>
}
