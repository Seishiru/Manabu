export type Appearance = "Light" | "Dark" | "System"
export const appearances: Appearance[] = ["Light", "Dark", "System"]
export const defaultAppearance: Appearance = "Light"
const owners = new Map<symbol, Appearance>()
let media: MediaQueryList | undefined
function syncAppearance() {
  const choice = [...owners.values()].at(-1) || defaultAppearance
  document.documentElement.dataset.theme = resolveAppearance(choice, media?.matches || false)
}
export function resolveAppearance(choice: Appearance, prefersDark: boolean) {
  return choice === "Dark" || choice === "System" && prefersDark ? "dark" : "light"
}
export function applyAppearance(choice: Appearance = defaultAppearance) {
  const owner = Symbol()
  owners.set(owner, choice)
  if (!media) {
    media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", syncAppearance)
  }
  syncAppearance()
  return () => {
    if (!owners.delete(owner)) return
    if (owners.size) syncAppearance()
    else {
      media?.removeEventListener("change", syncAppearance)
      media = undefined
    }
  }
}
export function initializeAppearance() {
  let choice: Appearance = defaultAppearance
  try {
    const value = JSON.parse(localStorage.getItem("manabu-learning-v1") || "null")?.preferences?.appearance
    if (appearances.includes(value)) choice = value
  } catch {}
  return applyAppearance(choice)
}
