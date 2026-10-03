export const pagePaths = ["/", "/home", "/practice", "/dictionary", "/japanese-keyboard", "/writing-system", "/progress", "/settings", "/shortcuts", "/kanji"]
export function writingCharacterId(pathname: string): string | null {
  const match = pathname.replace(/\/$/, "").match(/^\/writing-system\/character\/([^/]+)$/)
  if (!match) return null
  try { return decodeURIComponent(match[1]) } catch { return match[1] }
}
export const isKnownRoute = (pathname: string) => pagePaths.includes(pathname.replace(/\/$/, "") || "/") || writingCharacterId(pathname) !== null
