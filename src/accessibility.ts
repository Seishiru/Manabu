import type { KeyboardEvent } from "react"
export function navigateTabs(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "tab") return
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const current = tabs.indexOf(event.target as HTMLButtonElement)
  const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length
  event.preventDefault()
  tabs[index]?.focus()
  tabs[index]?.click()
}
