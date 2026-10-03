const cacheName = "manabu-app-v0.8"
const appRoot = new URL("./", self.location.href).href

async function cacheShell(cache, response) {
  if (!response.ok) throw new Error("App shell unavailable")
  const html = await response.clone().text()
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => new URL(match[1], appRoot))
    .filter(url => url.origin === self.location.origin && /\.(js|css)$/.test(url.pathname))
  if (!assets.length) throw new Error("App assets unavailable")
  const visited = new Set()
  const cacheAsset = async url => {
    if (visited.has(url.href)) return
    visited.add(url.href)
    const asset = await cache.match(url.href) || await fetch(url.href, { cache: "reload" })
    if (!asset.ok) throw new Error("App asset unavailable")
    const script = url.pathname.endsWith(".js") ? await asset.clone().text() : ""
    await cache.put(url.href, asset)
    const imports = [...script.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'`]([^"'`]+\.(?:js|css))["'`]/g)]
      .map(match => new URL(match[1], url))
      .filter(child => child.origin === self.location.origin)
    await Promise.all(imports.map(cacheAsset))
  }
  await Promise.all(assets.map(cacheAsset))
  await cache.put(appRoot, response)
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const existed = (await caches.keys()).includes(cacheName)
      try {
      const cache = await caches.open(cacheName)
      const response = await fetch(appRoot, { cache: "reload" })
      const fonts = [
        "../content-licenses/EDRDG-LICENCE.html",
        "../content-licenses/CC-BY-SA-4.0.txt",
        "../content-licenses/JMdict-format.txt",
        "../content-licenses/KANJIDIC2-format.txt",
        "nunito-400.ttf",
        "nunito-500.ttf",
        "nunito-600.ttf",
        "nunito-700.ttf",
        "nunito-800.ttf",
        "zen-maru-gothic-500.ttf",
        "zen-maru-gothic-700.ttf",
      ].map((file) => new URL("fonts/" + file, appRoot))
      fonts.push(new URL("writing/KanjiVG-LICENSE.txt", appRoot))
      await Promise.all(fonts.map(async url => {
        const asset = await fetch(url.href, { cache: "reload" })
        if (!asset.ok) throw new Error("App asset unavailable")
        await cache.put(url.href, asset)
      }))
      await cacheShell(cache, response)
      await self.skipWaiting()
      } catch (error) {
        if (!existed) await caches.delete(cacheName)
        throw error
      }
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      const previous = names.filter(name => name.startsWith("manabu-app-") && name !== cacheName).at(-1)
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith("manabu-app-") && name !== cacheName && name !== previous,
          )
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (
    url.origin !== self.location.origin &&
    !["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname)
  )
    return
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName)
      if (request.mode === "navigate") {
        try {
          const response = await fetch(request)
          if (response.ok) event.waitUntil(cacheShell(cache, response.clone()).catch(() => {}))
          return response
        } catch {
          return (await cache.match(appRoot)) || Response.error()
        }
      }
      const cached = await cache.match(request)
      if (cached) return cached
      if (/\.(js|css)$/.test(url.pathname)) {
        const previous = await caches.match(request)
        if (previous) return previous
      }
      try {
        const response = await fetch(request)
        if (response.ok || response.type === "opaque")
          await cache.put(request, response.clone())
        return response
      } catch {
        return Response.error()
      }
    })(),
  )
})
