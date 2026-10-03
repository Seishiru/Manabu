import type { Script } from "./keyboard"
export type KeyboardDraft = {
  text: string
  script: Script
  convertTyping: boolean
}
const draftKey = "manabu-keyboard-draft-v1"
export function readKeyboardDraft(): KeyboardDraft {
  const empty: KeyboardDraft = { text: "", script: "Hiragana", convertTyping: true }
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null")
    if (!draft || typeof draft.text !== "string" || draft.text.length > 1000000) return empty
    return { text: draft.text, script: draft.script === "Katakana" ? "Katakana" : "Hiragana", convertTyping: typeof draft.convertTyping === "boolean" ? draft.convertTyping : true }
  } catch { return empty }
}
export function writeKeyboardDraft(draft: KeyboardDraft) {
  if (draft.text.length > 1000000) throw new Error("Draft exceeds the tab cache limit")
  sessionStorage.setItem(draftKey, JSON.stringify(draft))
}
