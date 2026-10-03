import { useSyncExternalStore } from "react"
import { registerOfflineShell } from "./offlineRegistration"

const productionBuild = import.meta.env.MODE === "production"
let status = productionBuild
  ? "Preparing offline access…"
  : "Offline caching is enabled in the published app."
const listeners = new Set<() => void>()
const notify = (message: string) => {
  status = message
  listeners.forEach((listener) => listener())
}
export const useOfflineStatus = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => status,
  )

export async function startOfflineSupport() {
  if (!productionBuild) return
  if (!("serviceWorker" in navigator)) {
    notify("Offline caching is unavailable in this browser.")
    return
  }
  try {
    const base = new URL(import.meta.env.BASE_URL, window.location.origin)
    await registerOfflineShell(navigator.serviceWorker, new URL("sw.js", base), base.pathname)
    notify("✓ Ready for offline learning")
  } catch {
    notify("Offline caching couldn’t finish. Check your connection and reload to try again. Learning data is still saved locally.")
  }
}
