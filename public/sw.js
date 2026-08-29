const CACHE = 'sneham-v2'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== location.origin) return
  if (e.request.mode === 'navigate' || url.pathname.startsWith('/assets/')) return

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      })
      .catch(async () => (await caches.match(e.request)) || Response.error()),
  )
})

self.addEventListener('message', (e) => {
  if (e.data === 'CHECK_UPDATE') {
    self.registration.update().then(() => {
      e.source.postMessage({ type: 'UPDATE_RESULT', hasUpdate: !!self.registration.waiting })
    })
  }
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
