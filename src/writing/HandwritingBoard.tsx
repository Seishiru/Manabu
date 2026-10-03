import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { clampPoint, curvePath, stabilizePoint, type InkStroke, type Point, type StrokeGeometry } from "./model"
import type { WritingSettings } from "./settings"
import { GridLines } from "./StrokeDiagram"

export default function HandwritingBoard({ character, geometry, settings, strokes, completed, onStroke, onActive, onDone }: { character: string; geometry: StrokeGeometry[]; settings: WritingSettings; strokes: InkStroke[]; completed: boolean; onStroke: (stroke: InkStroke) => void; onActive: (active: boolean) => void; onDone: () => void }) {
  const helpId = useId()
  const board = useRef<SVGSVGElement>(null)
  const active = useRef<{ id: number; points: Point[]; width: number } | null>(null)
  const frame = useRef<number | null>(null)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState(false)
  const pointFor = (event: { clientX: number; clientY: number }) => {
    const bounds = board.current?.getBoundingClientRect()
    if (!bounds || !bounds.width || !bounds.height || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) throw new Error("Drawing board unavailable")
    return clampPoint({ x: (event.clientX - bounds.left) / bounds.width * 109, y: (event.clientY - bounds.top) / bounds.height * 109 })
  }
  const finish = (event?: ReactPointerEvent<SVGSVGElement>) => {
    const stroke = active.current
    if (!stroke || event && event.pointerId !== stroke.id) return
    active.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    if (event) { try { stroke.points.push(pointFor(event)) } catch { setError(true) } }
    if (stroke.points.length) onStroke({ d: curvePath(stroke.points), width: stroke.width })
    setDraft("")
    onActive(false)
    try { if (board.current?.hasPointerCapture(stroke.id)) board.current.releasePointerCapture(stroke.id) } catch {}
  }
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    const stroke = active.current
    active.current = null
    if (stroke) { onStroke({ d: curvePath(stroke.points), width: stroke.width }); onActive(false) }
  }, [])
  if (error) return <div className="writing-surface-error" role="alert"><h3>We couldn’t open the writing board.</h3><p>Your completed strokes are still here. Try the board again or return to Writing System.</p><button className="secondary-button" onClick={() => setError(false)}>Try Again</button></div>
  return <>
    <svg ref={board} viewBox="0 0 109 109" className={`writing-square writing-board${completed ? " is-complete" : ""}`} role="group" aria-label={`Writing board for ${character}: one square divided into four sections, ${strokes.length} drawn strokes`} aria-describedby={helpId} tabIndex={0}
      onContextMenu={event => { event.preventDefault(); onDone() }}
      onPointerDown={event => {
        if (completed || active.current || event.button !== 0) return
        event.preventDefault()
        try {
          const point = pointFor(event)
          active.current = { id: event.pointerId, points: [point], width: settings.thickness }
          setDraft(curvePath([point]))
          onActive(true)
          try { event.currentTarget.setPointerCapture(event.pointerId) } catch {}
        } catch { setError(true) }
      }}
      onPointerMove={event => {
        const stroke = active.current
        if (!stroke || stroke.id !== event.pointerId) return
        event.preventDefault()
        try {
          const coalesced = event.nativeEvent.getCoalescedEvents?.() || []
          for (const sample of coalesced.length ? coalesced : [event.nativeEvent]) {
            const previous = stroke.points[stroke.points.length - 1]
            const point = stabilizePoint(previous, pointFor(sample), settings.smoothness)
            if (Math.hypot(point.x - previous.x, point.y - previous.y) > .04) stroke.points.push(point)
          }
          if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; if (active.current) setDraft(curvePath(active.current.points)) })
        } catch { finish(); setError(true) }
      }}
      onPointerUp={finish}
      onPointerCancel={event => { if (event.pointerId === active.current?.id) finish() }}
      onLostPointerCapture={event => { if (event.pointerId === active.current?.id) finish() }}
      onPointerLeave={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) finish(event) }}>
      {settings.grid && <GridLines />}
      {settings.guided && <g className="writing-guides" aria-hidden="true">
        {geometry.length ? geometry.map((stroke, index) => <g key={index} transform={stroke.transform}><path d={stroke.d} />{settings.numbers && <text x={stroke.label[0]} y={stroke.label[1]} className="writing-stroke-number">{index + 1}</text>}</g>) : <text x="54.5" y="59" className="writing-typeface-guide" textAnchor="middle" dominantBaseline="middle" fontSize={character.length > 1 ? 55 : 87}>{character}</text>}
      </g>}
      {strokes.map((stroke, index) => <path key={index} d={stroke.d} strokeWidth={stroke.width} className="writing-user-stroke" />)}
      {draft && <path d={draft} strokeWidth={active.current?.width || settings.thickness} className="writing-user-stroke writing-active-stroke" />}
    </svg>
    <p id={helpId} className="writing-board-help">{completed ? "Your drawing is complete. Compare it with the reference, then write again or continue." : "Draw with a mouse, pen, or touch. Each lift ends a stroke."}{!geometry.length && settings.guided && " The faint reference is a typeface, not stroke-order training."}</p>
  </>
}
