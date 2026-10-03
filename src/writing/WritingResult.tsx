import { useEffect, useId, useRef } from "react"
import type { InkStroke, StrokeGeometry } from "./model"
import StrokeDiagram, { GridLines } from "./StrokeDiagram"

export default function WritingResult({ character, strokes, geometry, onClose, onContinueWriting, onAgain, onNext }: { character: string; strokes: InkStroke[]; geometry: StrokeGeometry[]; onClose: () => void; onContinueWriting: () => void; onAgain: () => void; onNext?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  const description = useId()
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialog.current?.showModal()
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose() } }
    window.addEventListener("keydown", escape, true)
    return () => { window.removeEventListener("keydown", escape, true); dialog.current?.close(); document.body.style.overflow = overflow; if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={dialog} className="writing-result-dialog" aria-labelledby={title} aria-describedby={description} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }}>
    <header className="writing-result-header"><span className="dict-badge">SELF-CHECK</span><button className="dict-text-button" aria-label="Close writing result" onClick={onClose}>Close ✕</button></header>
    <h2 id={title}>Writing completed.</h2><p id={description}>Compare your shape with the reference. This is a self-check, not automated handwriting grading.</p>
    <div className="writing-result-comparison"><section><h3>Your writing · {strokes.length} strokes</h3><svg viewBox="0 0 109 109" className="writing-square" role="img" aria-label={`Your drawing of ${character}`}><GridLines />{strokes.map((stroke, index) => <path key={index} d={stroke.d} strokeWidth={stroke.width} className="writing-user-stroke" />)}</svg></section><section><h3>Reference{geometry.length ? ` · ${geometry.length} strokes` : ""}</h3>{geometry.length ? <StrokeDiagram strokes={geometry} progress={geometry.length} grid numbers character={character} /> : <div className="writing-result-missing"><span lang="ja">{character}</span><p>No stroke-path reference is available.</p></div>}</section></div>
    <p className="writing-result-note">Stroke counts are shown for comparison only. Shape, direction, and stroke order are not automatically evaluated; learning accuracy stays unchanged.</p>
    <div className="writing-controls"><button className="secondary-button" onClick={onContinueWriting}>Keep writing</button><button className="dict-primary" onClick={onAgain}>Write Again</button>{onNext && <button className="secondary-button" onClick={onNext}>Next character →</button>}</div><small>Click outside the box or press Escape to close.</small>
  </dialog>
}
