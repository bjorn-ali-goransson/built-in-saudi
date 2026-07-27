// Minimal PWA service worker: enables install + offline shell.
// Network-first (so fresh chunks always win — no stale-chunk issues); the cache
// is only a fallback when offline. The version poll (/version.json) is never cached.
// Cache name carries the build id — the prerender plugin rewrites the __BIS_BUILD__
// token at build time (vite.config.ts). A new deploy therefore lands in a NEW cache
// and `activate` deletes the old one, so a stale shell (with an old
// <meta name="build">) can never outlive its deploy and re-trigger the update
// reload. In dev the token stays as-is, which is a perfectly good constant name.
const CACHE = 'bis-shell-__BIS_BUILD__'
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

// Tell open, VISIBLE tabs about a message (used so an already-open Calls page can
// jump to the "someone is calling" screen without waiting for the notification tap).
async function messageVisibleClients(msg) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const c of all) { if (c.visibilityState === 'visible') { try { c.postMessage(msg) } catch (e) { /* */ } } }
}

// A MISSED call ("call me" caller gave up before being answered) is never stored
// on our server — the push carries the record and this device keeps it. Queue it
// in IndexedDB so it survives with no tab open; the app drains the queue into
// localStorage (src/lib/missedCalls.ts). Never rejects — a lost record must not
// break the notification.
// Version 2 adds the `dms` store alongside `missed`. Both are drained by the app.
function queueLocal(store, entry) {
  return new Promise((resolve) => {
    let settled = false
    const done = () => { if (!settled) { settled = true; resolve() } }
    try {
      const open = indexedDB.open('bis-calls', 2)
      open.onupgradeneeded = () => {
        const db = open.result
        if (!db.objectStoreNames.contains('missed')) db.createObjectStore('missed', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('dms')) db.createObjectStore('dms', { keyPath: 'id' })
      }
      open.onerror = done
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction(store, 'readwrite')
          tx.objectStore(store).put(entry)
          tx.oncomplete = done; tx.onerror = done; tx.onabort = done
        } catch (e) { done() }
      }
    } catch (e) { done() }
  })
}

// Push notifications (prayer times, and "call me" rings / missed calls).
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  // A ring carries ?ring=1 in its URL — nudge any visible tab straight to the
  // incoming-call screen (the notification still shows for backgrounded tabs).
  const isCall = typeof data.url === 'string' && data.url.indexOf('ring=1') !== -1
  const m = data.missed && typeof data.missed === 'object' ? data.missed : null
  const missed = m ? {
    id: String(m.id || data.tag || Date.now()),
    name: String(m.name || ''),
    at: Number(m.at) || Date.now(),
    back: m.back ? String(m.back) : '',
    from: m.from ? String(m.from) : '',
  } : null
  // A direct message from a contact — stored on THIS device only, never server-side.
  const m2 = data.dm && typeof data.dm === 'object' ? data.dm : null
  const dm = m2 ? {
    id: String(m2.id || Date.now()),
    from: String(m2.from || ''),
    name: String(m2.name || ''),
    text: String(m2.text || ''),
    at: Number(m2.at) || Date.now(),
    mine: false,
  } : null
  event.waitUntil(Promise.all([
    missed ? queueLocal('missed', missed) : Promise.resolve(),
    // A visible tab records it right away (and leaves a now-pointless ringing screen).
    missed ? messageVisibleClients({ type: 'bis-missed-call' }) : Promise.resolve(),
    dm ? queueLocal('dms', dm) : Promise.resolve(),
    dm ? messageVisibleClients({ type: 'bis-dm' }) : Promise.resolve(),
    self.registration.showNotification(data.title || 'Built in Saudi', {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag || 'bis',
      dir: 'auto',
      data: { url: data.url || '/' },
    }),
    touch(),
    isCall ? messageVisibleClients({ type: 'bis-incoming-call', url: data.url }) : Promise.resolve(),
  ]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    touch()
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Focus an existing same-origin tab and take it to the tapped URL. Prefer a hard
    // client.navigate() over a postMessage — a tab that was backgrounded when the
    // call came in may have a stale/asleep page whose message handler never runs, so
    // the incoming call wouldn't show (#198). navigate() is authoritative.
    const target = all.find((c) => c.url.indexOf(self.location.origin) === 0 && 'focus' in c)
    if (target) {
      try { await target.focus() } catch (e) { /* */ }
      if ('navigate' in target) {
        try { await target.navigate(url); return } catch (e) { /* cross-origin/edge — fall through */ }
      }
      try { target.postMessage({ type: 'bis-incoming-call', url }) } catch (e) { /* */ }
      return
    }
    return self.clients.openWindow(url)
  })())
})
