import { useLayoutEffect, useRef, useState } from "react"
import type { StrokeGeometry } from "./model"

export function GridLines() {
  return <path className="writing-grid-lines" d="M54.5 0V109M0 54.5H109" />
}
function AnimatedStroke({ stroke, fraction, number, numbers }: { stroke: StrokeGeometry; fraction: number; number: number; numbers: boolean }) {
  const path = useRef<SVGPathElement>(null)
  const [head, setHead] = useState<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    if (!path.current || fraction <= 0 || fraction >= 1) { setHead(null); return }
    try { setHead(path.current.getPointAtLength(path.current.getTotalLength() * fraction)) }
    catch { setHead(null) }
  }, [fraction, stroke.d])
  return <g transform={stroke.transform}>
    <path ref={path} d={stroke.d} className="writing-demonstration-stroke" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - fraction} visibility={fraction > 0 ? "visible" : "hidden"} />
    {head && <circle cx={head.x} cy={head.y} r="1.8" className="writing-stroke-head" />}
    {numbers && <text x={stroke.label[0]} y={stroke.label[1]} className="writing-stroke-number">{number}</text>}
  </g>
}
export default function StrokeDiagram({ strokes, progress, grid, numbers, character }: { strokes: StrokeGeometry[]; progress: number; grid: boolean; numbers: boolean; character: string }) {
  return <svg viewBox="0 0 109 109" className="writing-square writing-diagram" role="img" aria-label={`Stroke-order demonstration for ${character}`}>
    {grid && <GridLines />}
    <g className="writing-faint-reference">{strokes.map((stroke, index) => <path key={index} d={stroke.d} transform={stroke.transform} />)}</g>
    {strokes.map((stroke, index) => <AnimatedStroke key={index} stroke={stroke} fraction={Math.max(0, Math.min(1, progress - index))} number={index + 1} numbers={numbers} />)}
  </svg>
}
