export function registerOfflineShell(container: ServiceWorkerContainer, script: URL, scope: string, timeoutMs = 15000) {
  return new Promise<void>((resolve, reject) => {
    let settled = false
    let registration: ServiceWorkerRegistration | undefined
    let worker: ServiceWorker | null = null
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      registration?.removeEventListener("updatefound", inspect)
      worker?.removeEventListener("statechange", inspect)
      if (error) reject(error)
      else resolve()
    }
    const inspect = () => {
      if (settled || !registration) return
      if (worker?.state === "redundant") { finish(new Error("Offline installation failed")); return }
      const next = registration.installing || registration.waiting || registration.active
      if (next !== worker) {
        worker?.removeEventListener("statechange", inspect)
        worker = next
        worker?.addEventListener("statechange", inspect)
      }
      if (worker?.state === "activated") finish()
      else if (worker?.state === "redundant") finish(new Error("Offline installation failed"))
    }
    const timer = setTimeout(() => finish(new Error("Offline installation timed out")), timeoutMs)
    void Promise.resolve().then(() => container.register(script, { scope })).then(value => {
      if (settled) return
      registration = value
      registration.addEventListener("updatefound", inspect)
      inspect()
    }, () => finish(new Error("Offline registration failed")))
  })
}
