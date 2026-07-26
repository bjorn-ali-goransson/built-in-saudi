// To-do backend — the OPTIONAL cloud half of the to-do tool. A list is local-only
// until the user turns sync on for it; only then does anything reach Firestore.
// Verifies a Google sign-in, stores lists in `todoLists/{id}` and lets the owner
// share one with other people by email. Covered by `my-data` (see booking.js).
// No new deps. Registered via index.js.

import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'

const { Firestore } = firestore
const db = new Firestore()
const LISTS = 'todoLists'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const SITE = 'https://built-in-saudi.com'

const MAX_ITEMS = 500 // per list
const MAX_LISTS = 50 // per owner
const MAX_MEMBERS = 20
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000 // a year since last write

function cors(req, res) {
  const origin = (req.headers && req.headers.origin) || ''
  const ok = /^https:\/\/([a-z0-9-]+\.)?built-in-saudi\.com$/.test(origin)
  res.set('Access-Control-Allow-Origin', ok ? origin : SITE)
  res.set('Vary', 'Origin')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}

async function verifyGoogle(idToken) {
  if (!idToken) return null
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
    if (!r.ok) return null
    const p = await r.json()
    if (p.aud !== CLIENT_ID) return null
    if (p.exp && Date.now() / 1000 > Number(p.exp)) return null
    return { sub: p.sub, email: String(p.email || '').toLowerCase() }
  } catch {
    return null
  }
}

const str = (x, n) => String(x == null ? '' : x).slice(0, n)
const email = (x) => str(x, 160).trim().toLowerCase()

function normalizeList(raw) {
  const items = Array.isArray(raw.items) ? raw.items : []
  return {
    id: str(raw.id, 40).replace(/[^a-zA-Z0-9_-]/g, ''),
    title: str(raw.title, 120),
    items: items.slice(0, MAX_ITEMS).map((i) => ({
      id: str(i && i.id, 40),
      text: str(i && i.text, 500),
      done: !!(i && i.done),
      at: Number(i && i.at) || Date.now(),
      by: str(i && i.by, 60),
    })).filter((i) => i.id && i.text),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  }
}

/** Can this user write to the list? Owner always; members yes (a shared list is
 *  collaborative — that's the point). Sharing itself stays owner-only. */
const canWrite = (d, user) => d.owner === user.sub || (Array.isArray(d.members) && d.members.includes(user.email))

function fail(res, e) {
  res.status(e && e.code ? e.code : 500).json({ error: String((e && e.message) || e) })
}

// POST { idToken, list } → { ok, list }. Create or update one list. Last write
// wins on the whole list (they're small, and it's predictable to explain).
http('todoSync', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, list } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user) return res.status(401).json({ error: 'sign in with Google first' })
    const incoming = normalizeList(list || {})
    if (!incoming.id) return res.status(400).json({ error: 'list id required' })

    const ref = db.collection(LISTS).doc(incoming.id)
    const now = Date.now()
    const saved = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const d = snap.exists ? snap.data() : null
      if (d && !canWrite(d, user)) { const e = new Error('not your list'); e.code = 403; throw e }
      if (!d) {
        // New list — cap how many one account can own.
        const owned = await db.collection(LISTS).where('owner', '==', user.sub).count().get().catch(() => null)
        const n = owned && owned.data ? owned.data().count : 0
        if (n >= MAX_LISTS) { const e = new Error(`limit reached — ${MAX_LISTS} lists per account`); e.code = 429; throw e }
      }
      // A stale client push must not clobber a newer server copy.
      if (d && Number(d.updatedAt) > incoming.updatedAt) return d
      const next = {
        ...incoming,
        owner: d ? d.owner : user.sub,
        members: d && Array.isArray(d.members) ? d.members : [],
        updatedAt: incoming.updatedAt || now,
        expiresAt: new Date(now + RETENTION_MS),
      }
      tx.set(ref, next)
      return next
    })
    res.json({ ok: true, list: { ...saved, cloud: true, shared: saved.owner !== user.sub, expiresAt: undefined } })
  } catch (e) {
    fail(res, e)
  }
})

// POST { idToken } → { ok, lists }. Everything owned by, or shared with, this user.
http('todoMine', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const user = await verifyGoogle((req.body || {}).idToken)
    if (!user) return res.status(401).json({ error: 'sign in with Google first' })
    const [own, shared] = await Promise.all([
      db.collection(LISTS).where('owner', '==', user.sub).get(),
      user.email ? db.collection(LISTS).where('members', 'array-contains', user.email).get() : Promise.resolve({ docs: [] }),
    ])
    const seen = new Set()
    const lists = []
    for (const doc of [...own.docs, ...shared.docs]) {
      if (seen.has(doc.id)) continue
      seen.add(doc.id)
      const d = doc.data()
      lists.push({
        id: doc.id, title: d.title || '', items: d.items || [], updatedAt: Number(d.updatedAt) || 0,
        owner: d.owner, members: d.members || [], cloud: true, shared: d.owner !== user.sub,
      })
    }
    res.json({ ok: true, lists })
  } catch (e) {
    fail(res, e)
  }
})

// POST { idToken, id, members } → { ok, list }. Owner only: set who it's shared with.
http('todoShare', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, id, members } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user) return res.status(401).json({ error: 'sign in with Google first' })
    const code = str(id, 40).replace(/[^a-zA-Z0-9_-]/g, '')
    if (!code) return res.status(400).json({ error: 'list id required' })
    const list = (Array.isArray(members) ? members : [])
      .map(email)
      .filter((m) => m && m.includes('@') && m !== user.email)
      .slice(0, MAX_MEMBERS)

    const ref = db.collection(LISTS).doc(code)
    const saved = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) { const e = new Error('no such list'); e.code = 404; throw e }
      const d = snap.data()
      if (d.owner !== user.sub) { const e = new Error('only the owner can share'); e.code = 403; throw e }
      const next = { ...d, members: [...new Set(list)], updatedAt: Date.now() }
      tx.set(ref, next)
      return next
    })
    res.json({ ok: true, list: { ...saved, cloud: true, shared: false, expiresAt: undefined } })
  } catch (e) {
    fail(res, e)
  }
})

// POST { idToken, id } → { ok }. Owner deletes it for everyone; a member just
// drops their own access (their copy stays local on their device).
http('todoDelete', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, id } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user) return res.status(401).json({ error: 'sign in with Google first' })
    const code = str(id, 40).replace(/[^a-zA-Z0-9_-]/g, '')
    if (!code) return res.status(400).json({ error: 'list id required' })
    const ref = db.collection(LISTS).doc(code)
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return
      const d = snap.data()
      if (d.owner === user.sub) tx.delete(ref)
      else if (Array.isArray(d.members) && d.members.includes(user.email)) {
        tx.set(ref, { ...d, members: d.members.filter((m) => m !== user.email) })
      }
    })
    res.json({ ok: true })
  } catch (e) {
    fail(res, e)
  }
})
