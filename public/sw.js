// Minimal PWA service worker: enables install + offline shell.
// Network-first (so fresh chunks always win — no stale-chunk issues); the cache
// is only a fallback when offline. The version poll (/version.json) is never cached.
const CACHE = 'bis-shell-v1'
const SHELL = ['/', '/en', '/ar', '/manifest.webmanifest', '/favicon.svg', '/icon.svg']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/version.json') return // always hit the network for deploy detection

  event.respondWith((async () => {
    try {
      const res = await fetch(req)
      if (res.ok && (req.mode === 'navigate' || url.pathname.startsWith('/assets/'))) {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(req, clone))
      }
      return res
    } catch {
      const cached = await caches.match(req)
      if (cached) return cached
      if (req.mode === 'navigate') {
        const shell = await caches.match('/')
        if (shell) return shell
      }
      throw new Error('offline')
    }
  })())
})

// Keep-alive: a delivered push (or a tap) proves the device is reachable, which
// renews the 90-day inactivity window server-side.
async function touch() {
  try {
    const sub = await self.registration.pushManager.getSubscription()
    if (sub) {
      await fetch('https://us-central1-blitz-ksa.cloudfunctions.net/touch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
    }
  } catch (e) { /* ignore */ }
}

// Prayer-time push notifications
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title || 'Built in Saudi', {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag || 'bis',
      dir: 'auto',
      data: { url: data.url || '/' },
    }),
    touch(),
  ]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    touch()
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) { if (c.url.includes('built-in-saudi') && 'focus' in c) return c.focus() }
    return self.clients.openWindow(url)
  })())
})
