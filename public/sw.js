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
// Version 2 adds the `dms` store alongside `missed`; version 3 adds `msgs` for
// Messages. All are drained by the app. MUST match src/lib/localQueue.ts.
function queueLocal(store, entry) {
  return new Promise((resolve) => {
    let settled = false
    const done = () => { if (!settled) { settled = true; resolve() } }
    try {
      const open = indexedDB.open('bis-calls', 3)
      open.onupgradeneeded = () => {
        const db = open.result
        if (!db.objectStoreNames.contains('missed')) db.createObjectStore('missed', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('dms')) db.createObjectStore('dms', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('msgs')) db.createObjectStore('msgs', { keyPath: 'id' })
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

// Messages (src/tools/messages): an envelope sealed end to end with a key only
// the two devices hold. The relay could not read it; this worker CAN, because
// the device's private key is in IndexedDB — so the notification shows the
// actual message instead of "New message". Read-only: if the Messages database
// does not exist yet, opening it must not create an empty one (that would leave
// the app with a version-1 database and no stores), so the upgrade is aborted.
function readMessagesKv(keys) {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open('bis-messages', 1)
      open.onupgradeneeded = () => { try { open.transaction.abort() } catch (e) { /* */ } }
      open.onerror = () => resolve({})
      open.onsuccess = () => {
        try {
          const db = open.result
          if (!db.objectStoreNames.contains('kv')) { db.close(); return resolve({}) }
          const os = db.transaction('kv').objectStore('kv')
          const out = {}
          let left = keys.length
          for (const k of keys) {
            const r = os.get(k)
            r.onsuccess = () => { out[k] = r.result ? r.result.v : undefined; if (--left === 0) { db.close(); resolve(out) } }
            r.onerror = () => { if (--left === 0) { db.close(); resolve(out) } }
          }
        } catch (e) { resolve({}) }
      }
    } catch (e) { resolve({}) }
  })
}
function b64uDec(s) {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(t + '==='.slice((t.length + 3) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
// Mirrors sharedKey/open in src/tools/messages/crypto.ts — keep them identical.
async function openSealed(from, sealed) {
  const kv = await readMessagesKv(['identity', 'peerPub', 'me'])
  const pub = kv.peerPub && kv.peerPub[from]
  if (!kv.identity || !pub || !kv.me) return null
  const theirs = await crypto.subtle.importKey('raw', b64uDec(pub), { name: 'ECDH', namedCurve: 'P-256' }, true, [])
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, kv.identity.privateKey, 256)
  const hk = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey'])
  const info = new TextEncoder().encode('bis-messages-v1:' + [kv.me, from].sort().join(':'))
  const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info }, hk, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
  const b = b64uDec(sealed)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12), additionalData: new TextEncoder().encode(from) }, key, b.subarray(12))
  return new TextDecoder().decode(pt)
}
function msgPreview(env) {
  try {
    if (!env || env.type !== 'msg' || !env.msg) {
      if (env && env.type === 'react') return env.emoji || ''
      return ''
    }
    const m = env.msg
    if (m.kind === 'file') return '📎 ' + ((m.file && m.file.name) || '')
    if (m.kind === 'voice') return '🎤'
    if (m.kind === 'poll') return '📊 ' + ((m.poll && m.poll.q) || '')
    if (m.kind === 'location') return '📍'
    if (m.kind === 'call') return '📞'
    if (m.kind === 'doc') return '📄 ' + ((m.doc && m.doc.title) || '')
    return String(m.text || '').slice(0, 140)
  } catch (e) { return '' }
}
async function messageNotification(data, msg) {
  let body = ''
  let title = data.title || msg.name || 'Built in Saudi'
  let conv = ''
  try {
    const text = msg.sealed ? await openSealed(msg.from, msg.env) : msg.env
    const env = text ? JSON.parse(text) : null
    if (env) {
      body = msgPreview(env)
      conv = env.conv && String(env.conv).indexOf('g:') === 0 ? env.conv : ''
      if (conv && env.title) title = (msg.name || '') + ' · ' + env.title
      // Receipts, typing and edits are not worth waking somebody for.
      if (env.type !== 'msg' && env.type !== 'react') return null
    }
  } catch (e) { /* could not decrypt — say only that something arrived */ }
  return { title, body: body || data.body || 'New message', tag: 'msg-' + (conv || msg.from), url: '/apps/messages?c=' + encodeURIComponent(conv || msg.from) }
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
    // A reaction to an earlier message rather than a message of its own.
    react: m2.react && m2.react.id ? { id: String(m2.react.id), emoji: String(m2.react.emoji || '') } : null,
    // A voice note (#232): metadata only — the audio arrives peer-to-peer, not here.
    voice: m2.voice && typeof m2.voice === 'object' ? { dur: Number(m2.voice.dur) || 0, mime: String(m2.voice.mime || 'audio/webm'), pending: true } : null,
  } : null
  const m3 = data.msg && typeof data.msg === 'object' ? data.msg : null
  if (m3) {
    const entry = { id: String(m3.id || Date.now()), from: String(m3.from || ''), name: String(m3.name || ''), env: String(m3.env || ''), sealed: !!m3.sealed }
    event.waitUntil((async () => {
      await queueLocal('msgs', entry)
      await messageVisibleClients({ type: 'bis-msg' })
      const n = await messageNotification(data, entry)
      // A visible Messages tab shows it itself; don't double up with a system banner.
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const showing = all.some((c) => c.visibilityState === 'visible' && c.url.indexOf('/apps/messages') !== -1)
      if (n && !showing) await self.registration.showNotification(n.title, { body: n.body, icon: '/icon.svg', badge: '/icon.svg', tag: n.tag, dir: 'auto', data: { url: n.url } })
      await touch()
    })())
    return
  }
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
