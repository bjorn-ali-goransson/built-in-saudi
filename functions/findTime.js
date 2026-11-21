// Find a Time (findTimeCore.js) over HTTP and Firestore: one function,
// `find-time`, with the operation in the body.
//
// POST { action, ... } → the action's JSON, or { error } with its status.
// Collections: ftUsers/{uid}, ftCredentials/{credentialId} (a public key, never
// a secret), ftChallenges/{id} (five minutes), ftPolls/{code} (a month from
// when it was made). All carry `expiresAt`, which Firestore's TTL policy
// deletes on; the deploy workflow sets that policy.
import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'
import webpush from 'web-push'
import { findTimeService, FindTimeError, FIND_TIME_ACTIONS } from './findTimeCore.js'

const { Firestore } = firestore
const db = new Firestore()
const SITE = 'https://built-in-saudi.com'
const ORIGINS = [SITE, 'https://www.built-in-saudi.com']

// The core keeps `expiresAt` as epoch milliseconds; Firestore keeps it as a
// Timestamp, because that is the type its TTL policy deletes on.
const fromDoc = (d) => (d.expiresAt?.toMillis ? { ...d, expiresAt: d.expiresAt.toMillis() } : d)
const store = {
  async get(col, id) {
    const s = await db.collection(col).doc(id).get()
    return s.exists ? fromDoc(s.data()) : null
  },
  async set(col, id, obj) { await db.collection(col).doc(id).set(typeof obj.expiresAt === 'number' ? { ...obj, expiresAt: new Date(obj.expiresAt) } : obj) },
  async del(col, id) { await db.collection(col).doc(id).delete() },
  // A person's own polls, for myData and deleteAccount: array-contains on one
  // field, which Firestore's automatic single-field index serves.
  async find(col, field, value) {
    const q = await db.collection(col).where(field, 'array-contains', value).get()
    return q.docs.map((d) => ({ ...fromDoc(d.data()), id: d.id }))
  },
}

// A passkey is bound to the site it was made on: built-in-saudi.com.
const service = findTimeService({
  store,
  secret: process.env.SENDER_SECRET,
  rp: { id: 'built-in-saudi.com', name: 'Built in Saudi' },
  origins: ORIGINS,
  site: SITE,
  // VAPID is configured once for every function, in index.js.
  notify: (sub, payload) => webpush.sendNotification(sub, JSON.stringify(payload)),
})

http('findTime', async (req, res) => {
  const origin = (req.headers && req.headers.origin) || ''
  res.set('Access-Control-Allow-Origin', ORIGINS.includes(origin) ? origin : SITE)
  res.set('Vary', 'Origin')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const b = req.body || {}
  if (!FIND_TIME_ACTIONS.includes(b.action)) return res.status(400).json({ error: 'unknown action' })
  try {
    res.json(await service[b.action](b))
  } catch (e) {
    if (e instanceof FindTimeError) return res.status(e.status).json({ error: e.message })
    console.error('find-time', b.action, e)
    res.status(500).json({ error: 'server error' })
  }
})
