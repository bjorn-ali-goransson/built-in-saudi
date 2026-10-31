// Sawi Kalam's organisers and their meetings: passkeys, nothing else.
//
// An ORGANISER is somebody who makes meetings. They sign up and sign in with a
// passkey and nothing else — no password, no PIN, no email — because a passkey
// cannot be phished, reused or guessed, and the server holds only a public key,
// so a leak of this store gives nobody a way in. Guests never sign in: they open
// a link and knock, and the organiser lets them in.
//
// A MEETING is a room code the server has recorded as belonging to one
// organiser. That is what lets the organiser start it from any device they
// have a passkey on, and what stops somebody else claiming to be its host.
//
// This file has no Firestore and no HTTP in it: the store is passed in, so the
// deployed function (meet.js) and Sawi Kalam's tests run the same code, the
// tests against a store in memory.
import crypto from 'node:crypto'
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server'

const CHALLENGE_MS = 5 * 60000 // a ceremony that takes longer than this is abandoned
const SESSION_MS = 30 * 86400000 // a sign-in lasts a month, then the passkey is asked again
// Every record is forgotten after a month of INACTIVITY, and each use starts the
// month again: an organiser and their passkeys when they sign in or make or
// start a meeting, a meeting when its organiser starts it. Expired records are
// treated as gone here and deleted when read; Firestore's TTL policy on
// `expiresAt` (set by the deploy workflow) removes the ones nobody reads.
const IDLE_MS = 30 * 86400000
const CODE = 'abcdefghjkmnpqrstuvwxyz23456789' // the Calls room alphabet: no 0/o, 1/l/i

export class MeetError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

const b64u = (buf) => Buffer.from(buf).toString('base64url')
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, '').trim().slice(0, n)
function code7() {
  const b = crypto.randomBytes(7)
  let s = ''
  for (let i = 0; i < 7; i++) s += CODE[b[i] % CODE.length]
  return s
}

/**
 * store: { get(col, id) → obj | null, set(col, id, obj), del(col, id) }, all async.
 * rp: { id: 'sawikalam.com', name: 'Sawi Kalam' }; origins: the page origins a
 * ceremony may come from. secret signs sessions.
 */
export function meetService({ store, secret, rp, origins, now = () => Date.now() }) {
  if (!secret) throw new Error('meetService needs a secret')

  function sign(payload) {
    const body = b64u(JSON.stringify(payload))
    return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
  }
  function session(token) {
    const [body, sig] = String(token || '').split('.')
    if (!body || !sig) throw new MeetError(401, 'sign in')
    const expect = crypto.createHmac('sha256', secret).update(body).digest('base64url')
    const a = Buffer.from(sig), b = Buffer.from(expect)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new MeetError(401, 'sign in')
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!p.uid || !(p.exp > now())) throw new MeetError(401, 'sign in')
    return p
  }
  async function saveChallenge(kind, challenge, extra = {}) {
    const id = b64u(crypto.randomBytes(16))
    await store.set('meetChallenges', id, { kind, challenge, ...extra, expiresAt: now() + CHALLENGE_MS })
    return id
  }
  // A challenge is used once: taken from the store before it is checked, so a
  // replayed response finds nothing to match.
  async function takeChallenge(id, kind) {
    const c = id ? await store.get('meetChallenges', String(id)) : null
    if (c) await store.del('meetChallenges', String(id))
    if (!c || c.kind !== kind || !(c.expiresAt > now())) throw new MeetError(400, 'start again')
    return c
  }
  // A record past its expiry is gone, whether or not the TTL sweep has run yet.
  async function live(col, id) {
    const r = id ? await store.get(col, id) : null
    if (!r) return null
    if (!(r.expiresAt > now())) { await store.del(col, id); return null }
    return r
  }
  // Activity by an organiser: they, and every passkey they have, get another month.
  async function touchOrganiser(uid, org) {
    const until = now() + IDLE_MS
    await store.set('meetOrganisers', uid, { ...org, expiresAt: until })
    for (const id of org.creds || []) {
      const c = await store.get('meetCredentials', id)
      if (c) await store.set('meetCredentials', id, { ...c, expiresAt: until })
    }
  }
  // A session is only as alive as its organiser: one forgotten for inactivity
  // signs in again with a passkey, which a forgotten account no longer has.
  async function organiser(token) {
    const s = session(token)
    const org = await live('meetOrganisers', s.uid)
    if (!org) throw new MeetError(401, 'sign in')
    return { s, org }
  }
  const issue = (uid, name) => ({ token: sign({ uid, name, exp: now() + SESSION_MS }), name })

  return {
    /** Sign up, step 1: options for navigator.credentials.create. */
    async registerOptions({ name }) {
      const display = clean(name, 60)
      if (!display) throw new MeetError(400, 'name required')
      const uid = b64u(crypto.randomBytes(16))
      const options = await generateRegistrationOptions({
        rpName: rp.name, rpID: rp.id, userID: Buffer.from(uid), userName: display, userDisplayName: display,
        attestationType: 'none',
        // Discoverable, so signing in later needs no username; verified, so the
        // device itself asks for the face, finger or screen lock.
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      })
      const challengeId = await saveChallenge('reg', options.challenge, { uid, name: display })
      return { challengeId, options }
    },

    /** Sign up, step 2: verify the new passkey, store its public key, sign in. */
    async register({ challengeId, response }) {
      const c = await takeChallenge(challengeId, 'reg')
      let v
      try {
        v = await verifyRegistrationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: origins, expectedRPID: rp.id, requireUserVerification: true })
      } catch (e) { throw new MeetError(400, `passkey not accepted: ${e.message}`) }
      if (!v.verified || !v.registrationInfo) throw new MeetError(400, 'passkey not accepted')
      const cred = v.registrationInfo.credential
      if (await store.get('meetCredentials', cred.id)) throw new MeetError(409, 'passkey already registered')
      await store.set('meetCredentials', cred.id, {
        uid: c.uid, publicKey: b64u(cred.publicKey), counter: cred.counter, transports: cred.transports || [], createdAt: now(), expiresAt: now() + IDLE_MS,
      })
      await store.set('meetOrganisers', c.uid, { name: c.name, creds: [cred.id], createdAt: now(), expiresAt: now() + IDLE_MS })
      return issue(c.uid, c.name)
    },

    /** Sign in, step 1: options for navigator.credentials.get. No user is named:
     *  the device offers the passkeys it holds for this site. */
    async loginOptions() {
      const options = await generateAuthenticationOptions({ rpID: rp.id, userVerification: 'required' })
      const challengeId = await saveChallenge('auth', options.challenge)
      return { challengeId, options }
    },

    /** Sign in, step 2: the signature has to verify against a stored public key. */
    async login({ challengeId, response }) {
      const c = await takeChallenge(challengeId, 'auth')
      const credId = String(response?.id || '')
      const stored = await live('meetCredentials', credId)
      const org = stored ? await live('meetOrganisers', stored.uid) : null
      if (!stored || !org) throw new MeetError(401, 'unknown passkey')
      let v
      try {
        v = await verifyAuthenticationResponse({
          response, expectedChallenge: c.challenge, expectedOrigin: origins, expectedRPID: rp.id, requireUserVerification: true,
          credential: { id: credId, publicKey: Buffer.from(stored.publicKey, 'base64url'), counter: stored.counter, transports: stored.transports },
        })
      } catch (e) { throw new MeetError(401, `passkey not accepted: ${e.message}`) }
      if (!v.verified) throw new MeetError(401, 'passkey not accepted')
      await store.set('meetCredentials', credId, { ...stored, counter: v.authenticationInfo.newCounter, usedAt: now() })
      await touchOrganiser(stored.uid, org)
      return issue(stored.uid, org.name || '')
    },

    /** A new meeting, owned by the signed-in organiser. */
    async create({ token }) {
      const { s, org } = await organiser(token)
      await touchOrganiser(s.uid, org)
      for (let i = 0; i < 5; i++) {
        const code = code7()
        if (await live('meetings', code)) continue
        await store.set('meetings', code, { owner: s.uid, ownerName: org.name || '', createdAt: now(), expiresAt: now() + IDLE_MS })
        return { code }
      }
      throw new MeetError(503, 'try again')
    },

    /** What anybody may know about a meeting: that it exists, and whose it is. */
    async info({ code }) {
      const m = await live('meetings', clean(code, 20))
      if (!m) return { exists: false }
      return { exists: true, organiser: m.ownerName }
    },

    /** Is the signed-in organiser this meeting's owner? Starting it is a use, so
     *  the meeting and its organiser get another month. */
    async claim({ token, code }) {
      const { s, org } = await organiser(token)
      const id = clean(code, 20)
      const m = await live('meetings', id)
      if (!m) return { owner: false, exists: false }
      if (m.owner !== s.uid) return { owner: false, exists: true }
      await store.set('meetings', id, { ...m, expiresAt: now() + IDLE_MS })
      await touchOrganiser(s.uid, org)
      return { owner: true, exists: true }
    },
  }
}

/** The routes, so the function and the tests dispatch identically. */
export const MEET_ACTIONS = ['registerOptions', 'register', 'loginOptions', 'login', 'create', 'info', 'claim']
