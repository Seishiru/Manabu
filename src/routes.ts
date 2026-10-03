export const sections = {
  "/": "Home", "/home": "Home", "/practice": "Practice", "/dictionary": "Dictionary",
  "/japanese-keyboard": "Japanese Keyboard", "/writing-system": "Writing System",
  "/progress": "Progress", "/settings": "Settings", "/kanji": "Dictionary",
} as const
export function sectionForPath(path: string): string | null {
  const normalized = path.replace(/\/+$/, "") || "/"
  return Object.prototype.hasOwnProperty.call(sections, normalized) ? sections[normalized as keyof typeof sections] : null
}
