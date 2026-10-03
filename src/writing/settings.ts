export type WritingSettings = {
  guided: boolean
  speed: "Slow" | "Normal" | "Fast"
  smoothness: "Low" | "Medium" | "High"
  grid: boolean
  numbers: boolean
  thickness: number
}
export const defaultWritingSettings: WritingSettings = { guided: true, speed: "Normal", smoothness: "Medium", grid: true, numbers: false, thickness: 2.5 }
export function validWritingSettings(value: unknown): value is WritingSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const settings = value as Record<string, unknown>
  return typeof settings.guided === "boolean" && typeof settings.grid === "boolean" && typeof settings.numbers === "boolean" && ["Slow", "Normal", "Fast"].includes(String(settings.speed)) && ["Low", "Medium", "High"].includes(String(settings.smoothness)) && typeof settings.thickness === "number" && Number.isFinite(settings.thickness) && settings.thickness >= 1 && settings.thickness <= 6
}
