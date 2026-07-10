// Link shortener. Google sign-in required to create; resolving is public.
// Links are retained for 6 months, then deleted (lazily on access; also removed
// by the consolidated `my-data` deletion). No new npm deps.
import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'
import crypto from 'node:crypto'

const { Firestore } = firestore
const db = new Firestore()
const LINKS = 'shortLinks'
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const SITE = 'https://built-in-saudi.com'
const RETENTION_MS = 183 * 86400000 // ~6 months
const RATE_MS = 3600000 // one new link per hour per user (abuse guard)
const MAX_URL = 2048

function cors(req, res) {
  const origin = (req.headers && req.headers.origin) || ''
  const ok = /^https:\/\/([a-z0-9-]+\.)?built-in-saudi\.com$/.test(origin)
  res.set('Access-Control-Allow-Origin', ok ? origin : SITE)
  res.set('Vary', 'Origin')
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}

// Verify a Google Identity Services id_token (client-side sign-in).
async function verifyGoogle(idToken) {
  if (!idToken) return null
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
    if (!r.ok) return null
    const p = await r.json()
    if (p.aud !== CLIENT_ID) return null
    if (p.exp && Date.now() / 1000 > Number(p.exp)) return null
    return { sub: p.sub, email: p.email }
  } catch {
    return null
  }
}

// URL-safe code (no ambiguous chars).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
function makeCode(n = 6) {
  const bytes = crypto.randomBytes(n)
  let s = ''
  for (let i = 0; i < n; i++) s += ALPHABET[bytes[i] % ALPHABET.length]
  return s
}

// POST { idToken, url } → { code, short } (creates a 6-month short link).
http('shorten', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, url } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user || !user.sub) return res.status(401).json({ error: 'sign in with Google first' })
    let target
    try { target = new URL(String(url || '').trim()) } catch { return res.status(400).json({ error: 'invalid URL' }) }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return res.status(400).json({ error: 'only http/https URLs' })
    const clean = target.toString().slice(0, MAX_URL)
    // Don't shorten our own short links (loop guard).
    if (clean.startsWith(`${SITE}/s/`)) return res.status(400).json({ error: 'already a short link' })

    // Rate limit: one new link per hour per user. Query the user's links and
    // find the newest createdAt in code (avoids a composite index).
    const mine = await db.collection(LINKS).where('owner', '==', user.sub).get()
    let newest = 0
    mine.forEach((doc) => {
      const c = doc.get('createdAt')
      const ms = c && c.toMillis ? c.toMillis() : 0
      if (ms > newest) newest = ms
    })
    const wait = newest + RATE_MS - Date.now()
    if (wait > 0) {
      res.set('Retry-After', String(Math.ceil(wait / 1000)))
      return res.status(429).json({ error: 'rate-limited', retryAfter: wait })
    }

    let code = null
    for (let i = 0; i < 6; i++) {
      const c = makeCode(6)
      if (!(await db.collection(LINKS).doc(c).get()).exists) { code = c; break }
    }
    if (!code) return res.status(500).json({ error: 'please try again' })

    const now = Date.now()
    await db.collection(LINKS).doc(code).set({
      url: clean,
      owner: user.sub,
      email: user.email || null,
      createdAt: new Date(now),
      expiresAt: new Date(now + RETENTION_MS),
      hits: 0,
    })
    res.json({ ok: true, code, short: `${SITE}/s/${code}`, url: clean, expiresAt: now + RETENTION_MS })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// GET ?c=<code> (or POST { code }) → { url }. Public; expired links 404 + delete.
http('resolveLink', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  try {
    const code = String((req.query && req.query.c) || (req.body && req.body.code) || '').trim().slice(0, 24)
    if (!code) return res.status(400).json({ error: 'no code' })
    const ref = db.collection(LINKS).doc(code)
    const snap = await ref.get()
    if (!snap.exists) return res.status(404).json({ error: 'not-found' })
    const d = snap.data()
    if (d.expiresAt && d.expiresAt.toMillis() < Date.now()) {
      ref.delete().catch(() => {})
      return res.status(404).json({ error: 'expired' })
    }
    ref.update({ hits: (d.hits || 0) + 1 }).catch(() => {}) // best-effort
    res.json({ ok: true, url: d.url })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// POST { idToken } → the caller's live short links.
http('myLinks', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const user = await verifyGoogle((req.body || {}).idToken)
    if (!user || !user.sub) return res.status(401).json({ error: 'sign in first' })
    const snap = await db.collection(LINKS).where('owner', '==', user.sub).get()
    const now = Date.now()
    const links = snap.docs
      .map((doc) => {
        const d = doc.data()
        return {
          code: doc.id,
          short: `${SITE}/s/${doc.id}`,
          url: d.url,
          hits: d.hits || 0,
          createdAt: d.createdAt ? d.createdAt.toMillis() : 0,
          expiresAt: d.expiresAt ? d.expiresAt.toMillis() : 0,
        }
      })
      .filter((l) => !l.expiresAt || l.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt)
    res.json({ ok: true, links })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// POST { idToken, code } → delete one of the caller's links.
http('deleteLink', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, code } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user || !user.sub) return res.status(401).json({ error: 'sign in first' })
    const ref = db.collection(LINKS).doc(String(code || ''))
    const snap = await ref.get()
    if (snap.exists && snap.get('owner') === user.sub) await ref.delete()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})
