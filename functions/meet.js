// Sawi Kalam's organiser passkeys and meetings (meetCore.js), over HTTP and
// Firestore. One function, `meet`, with the operation in the body: a new action
// is a line in meetCore, not another deployment.
//
// POST { action, ... } → the action's JSON, or { error } with its status.
// Collections: meetOrganisers/{uid}, meetCredentials/{credentialId} (a public
// key, never a secret), meetChallenges/{id} (five minutes), meetings/{code}.
// All four carry `expiresAt`: a month after last use, five minutes for a
// challenge. Firestore's TTL policy on that field deletes them.
import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'
import { meetService, MeetError, MEET_ACTIONS } from './meetCore.js'

const { Firestore } = firestore
const db = new Firestore()
const SITE = 'https://sawikalam.com'

// meetCore keeps `expiresAt` as epoch milliseconds; Firestore keeps it as a
// Timestamp, because that is the type its TTL policy deletes on.
const store = {
  async get(col, id) {
    const s = await db.collection(col).doc(id).get()
    if (!s.exists) return null
    const d = s.data()
    return d.expiresAt?.toMillis ? { ...d, expiresAt: d.expiresAt.toMillis() } : d
  },
  async set(col, id, obj) { await db.collection(col).doc(id).set(typeof obj.expiresAt === 'number' ? { ...obj, expiresAt: new Date(obj.expiresAt) } : obj) },
  async del(col, id) { await db.collection(col).doc(id).delete() },
}

// A passkey is bound to the site it was made on, so the relying party is
// Sawi Kalam's own domain and only its pages may run a ceremony.
const service = meetService({
  store,
  secret: process.env.SENDER_SECRET,
  rp: { id: 'sawikalam.com', name: 'Sawi Kalam' },
  origins: [SITE],
})

http('meet', async (req, res) => {
  const origin = (req.headers && req.headers.origin) || ''
  res.set('Access-Control-Allow-Origin', origin === SITE ? origin : SITE)
  res.set('Vary', 'Origin')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const b = req.body || {}
  if (!MEET_ACTIONS.includes(b.action)) return res.status(400).json({ error: 'unknown action' })
  try {
    res.json(await service[b.action](b))
  } catch (e) {
    if (e instanceof MeetError) return res.status(e.status).json({ error: e.message })
    console.error('meet', b.action, e)
    res.status(500).json({ error: 'server error' })
  }
})
