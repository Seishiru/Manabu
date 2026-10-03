import strokes from "./strokes.json"
import { contentEntryById, kanaEntries } from "../content/catalog"
import type { KanaEntry } from "../content/model"
import type { WritingSettings } from "./settings"

export type Point = { x: number; y: number }
export type StrokeGeometry = { d: string; label: number[]; transform: string }
type StrokeDatabase = { glyphs: Record<string, { paths: { d: string; label: number[] }[] }> }
const geometry = (strokes as StrokeDatabase).glyphs
export const strokeSource = strokes.source
export function kanaCharacter(id: string): KanaEntry | undefined {
  const entry = contentEntryById(id)
  return entry?.kind === "Hiragana" || entry?.kind === "Katakana" ? entry : undefined
}
export function characterSequence(entry: KanaEntry) {
  return kanaEntries.filter(candidate => candidate.kind === entry.kind && candidate.group === entry.group)
}
export function strokeGeometry(entry: KanaEntry): StrokeGeometry[] {
  const characters = [...entry.japanese]
  if (!characters.length || characters.some(character => !geometry[character] || !Array.isArray(geometry[character].paths) || !geometry[character].paths.length)) return []
  return characters.flatMap((character, index) => geometry[character].paths.map(path => ({ ...path, transform: characters.length === 1 ? "" : index === 0 ? "translate(0 0) scale(.72)" : "translate(54 43) scale(.5)" })))
}
export function clampPoint(point: Point): Point {
  return { x: Math.max(0, Math.min(109, point.x)), y: Math.max(0, Math.min(109, point.y)) }
}
export function stabilizePoint(previous: Point, point: Point, smoothness: WritingSettings["smoothness"]): Point {
  const amount = smoothness === "High" ? .35 : smoothness === "Medium" ? .65 : 1
  return clampPoint({ x: previous.x + (point.x - previous.x) * amount, y: previous.y + (point.y - previous.y) * amount })
}
const coordinate = (value: number) => Number(value.toFixed(3))
export function curvePath(points: Point[]) {
  if (!points.length) return ""
  let path = `M${coordinate(points[0].x)},${coordinate(points[0].y)}`
  if (points.length === 1) return path + "l.01,.01"
  for (let index = 1; index < points.length - 1; index++) {
    const current = points[index], next = points[index + 1]
    path += `Q${coordinate(current.x)},${coordinate(current.y)} ${coordinate((current.x + next.x) / 2)},${coordinate((current.y + next.y) / 2)}`
  }
  const last = points[points.length - 1]
  return path + `L${coordinate(last.x)},${coordinate(last.y)}`
}
export type InkStroke = { d: string; width: number }
export type DrawingState = { strokes: InkStroke[]; redo: InkStroke[] }
export type DrawingAction = { type: "add"; stroke: InkStroke } | { type: "undo" | "redo" | "clear" }
export const emptyDrawing: DrawingState = { strokes: [], redo: [] }
export function drawingReducer(state: DrawingState, action: DrawingAction): DrawingState {
  if (action.type === "clear") return { strokes: [], redo: [] }
  if (action.type === "add") return { strokes: [...state.strokes, action.stroke], redo: [] }
  if (action.type === "undo" && state.strokes.length) return { strokes: state.strokes.slice(0, -1), redo: [...state.redo, state.strokes[state.strokes.length - 1]] }
  if (action.type === "redo" && state.redo.length) return { strokes: [...state.strokes, state.redo[state.redo.length - 1]], redo: state.redo.slice(0, -1) }
  return state
}
