const navigationTarget = '.sidebar nav button[data-tour-route], .mobile-nav button[data-tour-route]'
export const tutorialSteps = [
  { path: "/", target: navigationTarget, title: "Home · Your next small step", description: "Continue your last practice, choose a quick activity, or check what needs review. You decide what to learn." },
  { path: "/practice", target: navigationTarget, title: "Practice · Make it yours", description: "Choose a mode, then pick content, levels, and question directions. Real answers and self-check ratings are tracked separately." },
  { path: "/dictionary", target: navigationTarget, title: "Dictionary · Find and learn", description: "Search Japanese, kana, romaji, or English offline. Open words, kanji, and sentences to save them or practice that exact item." },
  { path: "/japanese-keyboard", target: navigationTarget, title: "Japanese Keyboard · Compose", description: "Type romaji to make kana, then choose dictionary candidates for kanji. Keep composing, or save and practice an entry." },
  { path: "/writing-system", target: navigationTarget, title: "Writing System · See, hear, write", description: "Switch between Hiragana and Katakana. Click a character to listen; right-click or use the character picker to study stroke order and write." },
  { path: "/progress", target: navigationTarget, title: "Progress · See your learning", description: "See actual practice activity, accuracy, and items needing review. Self-check ratings describe understanding, not correctness." },
  { path: "/settings", target: navigationTarget, title: "Settings · Your device, your data", description: "Choose your appearance and learning preferences. Export a backup to keep progress safe, or restore one without an account." },
] as const
export function tutorialShortcut(key: string) {
  return key.toLowerCase() === "a" ? "previous" : key.toLowerCase() === "d" || key === "Enter" ? "next" : key === "Escape" ? "close" : null
}
