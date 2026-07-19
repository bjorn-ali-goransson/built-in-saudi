// Signaling relay for the P2P Calls tool. It ONLY relays the WebRTC handshake
// (offers / answers / ICE candidates + join/leave) between peers in an ephemeral
// room — it never sees audio, video, whiteboard, chat or files (those flow
// directly peer-to-peer). Rooms are keyed by a client-chosen random code, live
// in Firestore for 2 hours, and are polled. No auth (public by code); no deps.
import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'
import webpush from 'web-push' // VAPID is configured once in index.js (shared singleton)

const { Firestore } = firestore
const db = new Firestore()
const ROOMS = 'callRooms'
const LINKS = 'callLinks' // personal "call me" links → push subscriptions
const MAX_SUBS = 6 // devices per link
const TTL_MS = 2 * 3600000 // rooms expire after 2 hours
const MAX_MSGS = 400 // cap the message buffer per room (bounds the doc size)
const MAX_PAYLOAD = 20000 // per-message payload cap (an SDP is a few KB)
const SITE = 'https://built-in-saudi.com'

function cors(req, res) {
  const origin = (req.headers && req.headers.origin) || ''
  const ok = /^https:\/\/([a-z0-9-]+\.)?built-in-saudi\.com$/.test(origin)
  res.set('Access-Control-Allow-Origin', ok ? origin : SITE)
  res.set('Vary', 'Origin')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}

const clean = (s, n) => String(s == null ? '' : s).slice(0, n)

// Naive per-IP rate limit (in-memory, per instance). Not distributed and not
// exact — just a cheap circuit-breaker to blunt the most extreme single-source
// floods without adding Firestore load. 300 requests / 10s per IP is very generous
// for real use (a handshake burst is ~8/s; polling is far slower) but stops a flood.
const RL_MAX = 300
const RL_WIN = 10000
const rl = new Map() // ip -> { n, resetAt }
function rateLimited(req) {
  const xf = (req.headers && req.headers['x-forwarded-for']) || ''
  const ip = String(xf).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown'
  const now = Date.now()
  if (rl.size > 20000) for (const [k, e] of rl) if (e.resetAt < now) rl.delete(k) // bound memory
  let e = rl.get(ip)
  if (!e || e.resetAt < now) { e = { n: 0, resetAt: now + RL_WIN }; rl.set(ip, e) }
  e.n++
  return e.n > RL_MAX
}

// POST { room, action:'send', from, to, type, payload }  → { ok, seq }
// POST { room, action:'poll', from, since }              → { ok, seq, msgs }
// `to` = a specific peerId or 'all'. Messages are relayed verbatim; the server
// doesn't interpret the payload.
http('callSignal', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  if (rateLimited(req)) return res.status(429).json({ error: 'rate limited' })
  try {
    const b = req.body || {}
    const room = clean(b.room, 40).replace(/[^a-zA-Z0-9_-]/g, '')
    const from = clean(b.from, 40)
    if (!room || !from) return res.status(400).json({ error: 'room and from required' })
    const ref = db.collection(ROOMS).doc(room)
    const now = Date.now()

    // Host (or the last guest after a disconnect grace) nukes the meeting. We keep
    // a short-lived tombstone so anyone still on the link learns it's over.
    if (b.action === 'close') {
      await ref.set({ closed: true, expiresAt: new Date(now + 15 * 60000), msgs: [] }, { merge: true }).catch(() => {})
      return res.json({ ok: true, closed: true })
    }

    if (b.action === 'poll') {
      const since = Number(b.since) || 0
      const snap = await ref.get()
      if (!snap.exists) return res.json({ ok: true, seq: 0, msgs: [] })
      const d = snap.data()
      if ((d.expiresAt && d.expiresAt.toMillis() < now)) { ref.delete().catch(() => {}); return res.json({ ok: true, seq: 0, msgs: [] }) }
      if (d.closed) return res.json({ ok: true, closed: true, seq: 0, msgs: [] })
      const all = d.msgs || []
      const msgs = all.filter((m) => m.seq > since && m.from !== from && (m.to === 'all' || m.to === from))
      return res.json({ ok: true, seq: d.count || 0, msgs })
    }

    // default: send
    {
      const snapPre = await ref.get()
      if (snapPre.exists && snapPre.data().closed) return res.json({ ok: true, closed: true })
    }
    const to = clean(b.to, 40) || 'all'
    const type = clean(b.type, 24)
    const payload = typeof b.payload === 'string' ? clean(b.payload, MAX_PAYLOAD) : b.payload
    if (payload && JSON.stringify(payload).length > MAX_PAYLOAD + 200) return res.status(413).json({ error: 'payload too large' })

    const seq = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      let d = snap.exists ? snap.data() : null
      if (d && d.expiresAt && d.expiresAt.toMillis() < now) d = null // expired → start fresh
      const count = d ? (d.count || 0) : 0
      const msgs = d ? (d.msgs || []) : []
      msgs.push({ seq: count, from, to, type, payload: payload ?? null, ts: now })
      tx.set(ref, {
        createdAt: d && d.createdAt ? d.createdAt : new Date(now),
        expiresAt: new Date(now + TTL_MS),
        count: count + 1,
        msgs: msgs.slice(-MAX_MSGS),
      })
      return count
    })
    res.json({ ok: true, seq })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// ---- Personal "call me" links (Web Push ring) ------------------------------
// A host claims an anonymous, device-generated code and registers this device's
// push subscription under it. Sharing built-in-saudi.com/call/<code> lets anyone
// RING the host: each call spins up a FRESH ephemeral room (the personal code is
// just the link; every call is a new room) and a push notification wakes the
// host's device(s) to answer. No auth, no identity — the ring notification's URL
// carries the code so the host can cancel with no local state; `my-data` can't
// match anonymous links, so the host removes them itself (in-tool or on a call).
const LINK_TTL_MS = 183 * 24 * 3600000 // ~6 months since last use (register or ring)
const codeOf = (s) => clean(s, 40).replace(/[^a-zA-Z0-9_-]/g, '')

// POST { code, sub, name? } → add/refresh this device's push subscription under code.
http('callRegister', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const b = req.body || {}
    const code = codeOf(b.code)
    const sub = b.sub
    const name = clean(b.name, 40)
    if (!code || !sub || !sub.endpoint) return res.status(400).json({ error: 'code and sub required' })
    const ref = db.collection(LINKS).doc(code)
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const d = snap.exists ? snap.data() : null
      const now = new Date()
      // Dedupe by endpoint (a re-register from the same device just refreshes it).
      const subs = (d && Array.isArray(d.subs) ? d.subs : []).filter((s) => s && s.endpoint !== sub.endpoint)
      subs.push(sub)
      tx.set(ref, {
        subs: subs.slice(-MAX_SUBS),
        name: name || (d && d.name) || '',
        createdAt: (d && d.createdAt) || now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + LINK_TTL_MS),
      })
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// POST { code, room, caller? } → push every device on the link to answer `room`.
http('callRing', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const b = req.body || {}
    const code = codeOf(b.code)
    const room = codeOf(b.room)
    const caller = clean(b.caller, 40) || 'Someone'
    if (!code || !room) return res.status(400).json({ error: 'code and room required' })
    const ref = db.collection(LINKS).doc(code)
    const snap = await ref.get()
    const d = snap.exists ? snap.data() : null
    // Missing or expired → treat as gone (and lazily clean up an expired doc).
    if (!d || (d.expiresAt && d.expiresAt.toDate && d.expiresAt.toDate() < new Date())) {
      if (d) await ref.delete().catch(() => {})
      return res.status(404).json({ ok: false, error: 'no such link' })
    }
    const subs = Array.isArray(d.subs) ? d.subs : []
    // The click-URL carries the room to answer AND the host code, so the incoming
    // call screen can offer "stop receiving calls" without any stored state.
    const payload = JSON.stringify({
      title: `${caller} is calling`,
      body: 'Tap to answer',
      tag: `call-${room}`,
      url: `${SITE}/apps/calls/join?code=${room}&ring=1&link=${code}`,
      requireInteraction: true,
    })
    const alive = []
    let delivered = 0
    for (const s of subs) {
      try {
        await webpush.sendNotification(s, payload)
        alive.push(s); delivered++
      } catch (e) {
        // 404/410 = subscription gone → drop it; anything else is transient → keep.
        if (!(e && (e.statusCode === 404 || e.statusCode === 410))) alive.push(s)
      }
    }
    const now = new Date()
    await ref.set({ subs: alive, updatedAt: now, expiresAt: new Date(now.getTime() + LINK_TTL_MS) }, { merge: true }).catch(() => {})
    res.json({ ok: true, delivered })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// POST { code, endpoint? } → remove one device (endpoint) or the whole link.
http('callDelete', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const b = req.body || {}
    const code = codeOf(b.code)
    const endpoint = b.endpoint ? clean(b.endpoint, 600) : ''
    if (!code) return res.status(400).json({ error: 'code required' })
    const ref = db.collection(LINKS).doc(code)
    if (!endpoint) {
      await ref.delete().catch(() => {})
      return res.json({ ok: true, deleted: 'all' })
    }
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return
      const subs = (snap.data().subs || []).filter((s) => s && s.endpoint !== endpoint)
      if (subs.length === 0) tx.delete(ref)
      else tx.set(ref, { subs, updatedAt: new Date() }, { merge: true })
    })
    res.json({ ok: true, deleted: 'device' })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})
