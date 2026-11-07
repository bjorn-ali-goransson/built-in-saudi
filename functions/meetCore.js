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
// A meeting can carry a TIME SLOT both sides agree on, with one invitee: the
// organiser proposes a time for the guest to confirm, or lets the guest pick
// one. Whoever answers confirms their own side by answering, and the other is
// told by web push that it is their turn. The first guest to answer becomes THE
// invitee, held by a secret only their browser has (stored here as a hash), so
// somebody else holding the link can read the status and cannot answer for
// them. The server is the truth for who has confirmed; a link only mirrors it.
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
// A background picture, as a data URL: about 450KB of JPEG, well inside a
// Firestore document and a request body.
const BG_MAX = 600_000
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
export function meetService({ store, secret, rp, origins, now = () => Date.now(), notify = async () => {}, site }) {
  const SITE = site || origins[0]
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
  const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('base64url')
  const isGuestSecret = (g) => typeof g === 'string' && g.length >= 16 && g.length <= 128
  /** What anybody may know about a slot: the time, its length, how it is being
   *  agreed, and who has confirmed. Never the secrets or the subscriptions. */
  const publicSlot = (m) => (m.slot ? { at: m.slot.at, minutes: m.slot.minutes, mode: m.slot.mode, organiser: !!m.slot.org, guest: !!m.slot.guest, title: m.slot.title || '', by: m.slot.by || '', hours: m.slot.hours || null } : null)
  /** The address a notification opens: the meeting's own link for the guest,
   *  the schedule page for the organiser, each carrying the status as it is. */
  function linkFor(code, m, role) {
    const q = new URLSearchParams({ code })
    const sl = m.slot
    if (sl?.at) q.set('at', new Date(sl.at).toISOString().slice(0, 16) + 'Z')
    if (sl?.minutes) q.set('dur', String(sl.minutes))
    if (sl?.title) q.set('title', sl.title)
    if (sl?.by && role === 'guest') q.set('by', sl.by)
    const ok = (sl?.org ? 'o' : '') + (sl?.guest ? 'g' : '')
    if (ok) q.set('ok', ok)
    return `${SITE}${role === 'guest' ? '/call/join' : '/schedule'}?${q.toString().replace(/%3A/g, ':')}`
  }
  const TEXT = {
    en: {
      proposed: (by) => [`${by || 'The organiser'} proposed a time`, 'Open the invitation to confirm it.'],
      pick: (by) => [`${by || 'The organiser'} asks you to pick a time`, 'Open the invitation to choose one.'],
      picked: (g) => [`${g || 'Your guest'} picked a time`, 'Open the meeting to confirm it.'],
      agreed: (g) => [`${g || 'Your guest'} confirmed the time`, 'The meeting is agreed.'],
      confirmed: (by) => [`${by || 'The organiser'} confirmed the time`, 'The meeting is agreed.'],
    },
    ar: {
      proposed: (by) => [`${by || 'المنظّم'} اقترح موعدًا`, 'افتح الدعوة لتأكيده.'],
      pick: (by) => [`${by || 'المنظّم'} يطلب منك اختيار موعد`, 'افتح الدعوة لتختار موعدًا.'],
      picked: (g) => [`${g || 'ضيفك'} اختار موعدًا`, 'افتح الاجتماع لتأكيده.'],
      agreed: (g) => [`${g || 'ضيفك'} أكّد الموعد`, 'تم الاتفاق على الاجتماع.'],
      confirmed: (by) => [`${by || 'المنظّم'} أكّد الموعد`, 'تم الاتفاق على الاجتماع.'],
    },
  }
  // A push to every device the other side gave us. A subscription the push
  // service says is gone (404/410) is dropped, so a dead phone is not asked
  // forever.
  async function tell(code, m, role, kind, who) {
    const key = role === 'guest' ? 'guestSubs' : 'orgSubs'
    const subs = m[key] || []
    if (!subs.length) return m
    const keep = []
    for (const s of subs) {
      const [title, body] = (TEXT[s.locale] || TEXT.en)[kind](who)
      try {
        await notify(s.sub, { title, body, url: linkFor(code, m, role), tag: `sk-${code}` })
        keep.push(s)
      } catch (e) { if (!(e && (e.statusCode === 404 || e.statusCode === 410))) keep.push(s) }
    }
    if (keep.length !== subs.length) { m = { ...m, [key]: keep }; await store.set('meetings', code, m) }
    return m
  }
  const cleanSub = (sub) => (sub && typeof sub.endpoint === 'string' && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string')
    ? { endpoint: sub.endpoint.slice(0, 1000), keys: { p256dh: sub.keys.p256dh.slice(0, 200), auth: sub.keys.auth.slice(0, 100) } } : null
  const cleanAt = (at) => { const t = Number(at); return Number.isFinite(t) && t > 0 ? Math.floor(t / 60000) * 60000 : null }
  const cleanMinutes = (n) => { const v = Math.round(Number(n)); return v > 0 && v <= 24 * 60 ? v : 0 }
  /** The hours a guest may pick in: weekdays (0 = Sunday), and a span of the
   *  day in minutes, on the organiser's wall clock in their time zone. */
  function cleanHours(h) {
    if (!h || typeof h !== 'object') return null
    const days = [...new Set((Array.isArray(h.days) ? h.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    const from = Math.round(Number(h.from)), to = Math.round(Number(h.to))
    const tz = clean(h.tz, 64)
    if (!days.length || !(from >= 0 && to <= 24 * 60 && from < to) || !tz) return null
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }) } catch { return null }
    return { days, from, to, tz }
  }
  /** Whether a meeting starting at `t` and lasting `minutes` is inside the hours. */
  function withinHours(h, t, minutes) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: h.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t)).map((p) => [p.type, p.value]))
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
    const start = Number(parts.hour) * 60 + Number(parts.minute)
    return h.days.includes(day) && start >= h.from && start + (minutes || 0) <= h.to
  }
  async function ownMeeting(token, code) {
    const { s, org } = await organiser(token)
    const id = clean(code, 20)
    const m = await live('meetings', id)
    if (!m) throw new MeetError(404, 'no such meeting')
    if (m.owner !== s.uid) throw new MeetError(403, 'not yours')
    return { id, m, s, org }
  }
  async function guestMeeting(code, guest) {
    if (!isGuestSecret(guest)) throw new MeetError(400, 'guest')
    const id = clean(code, 20)
    const m = await live('meetings', id)
    if (!m) throw new MeetError(404, 'no such meeting')
    if (m.guestKey && m.guestKey !== sha(guest)) throw new MeetError(403, 'somebody else answered')
    return { id, m }
  }

  const issue = (uid, name) => ({ token: sign({ uid, name, exp: now() + SESSION_MS }), name })

  return {
    /** Sign up, step 1: options for navigator.credentials.create. */
    async registerOptions({ name }) {
      // A name is optional: an organiser can start with the passkey alone and
      // be asked what to be called in the call. The passkey still needs a label
      // in the device's password manager, so it carries the app's name then.
      const display = clean(name, 60)
      const label = display || rp.name
      const uid = b64u(crypto.randomBytes(16))
      const options = await generateRegistrationOptions({
        rpName: rp.name, rpID: rp.id, userID: Buffer.from(uid), userName: label, userDisplayName: label,
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
      // The account is read through the passkey before either is checked for
      // expiry, so a forgotten pair is deleted together rather than leaving the
      // account for the TTL sweep.
      const raw = credId ? await store.get('meetCredentials', credId) : null
      const org = raw ? await live('meetOrganisers', raw.uid) : null
      const stored = raw ? await live('meetCredentials', credId) : null
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
    async info({ code, guest }) {
      const m = await live('meetings', clean(code, 20))
      if (!m) return { exists: false }
      // `you`: whether the asking browser is the invitee, somebody else is, or
      // nobody has answered yet — so the page knows whether to offer to answer.
      const you = !m.guestKey ? 'none' : isGuestSecret(guest) && m.guestKey === sha(guest) ? 'invitee' : 'other'
      return { exists: true, organiser: m.ownerName, slot: publicSlot(m), you }
    },

    /** The organiser sets the slot: a time for the guest to confirm (the
     *  organiser's side is confirmed by proposing it), or the length alone
     *  for the guest to pick a time, within the organiser's hours if given.
     *  Either way the guest has to answer again. */
    async schedule({ token, code, at, minutes, mode, title, by, hours }) {
      const { id, m } = await ownMeeting(token, code)
      const md = mode === 'pick' ? 'pick' : 'confirm'
      const t = md === 'confirm' ? cleanAt(at) : null
      if (md === 'confirm' && !t) throw new MeetError(400, 'a time')
      let next = { ...m, slot: { at: t, minutes: cleanMinutes(minutes), mode: md, org: md === 'confirm', guest: false, title: clean(title, 60), by: clean(by, 40), hours: md === 'pick' ? cleanHours(hours) : null }, expiresAt: now() + IDLE_MS }
      await store.set('meetings', id, next)
      next = await tell(id, next, 'guest', md === 'pick' ? 'pick' : 'proposed', next.slot.by)
      return { slot: publicSlot(next) }
    },

    /** The guest answers: with a time (picking one, or suggesting another),
     *  which confirms their side and asks the organiser; or without one, which
     *  confirms the organiser's proposal. The first guest to answer is the
     *  invitee from then on. */
    async respond({ code, guest, at, name }) {
      const { id, m } = await guestMeeting(code, guest)
      if (!m.slot) throw new MeetError(409, 'no time to answer')
      const t = at == null ? null : cleanAt(at)
      if (at != null && !t) throw new MeetError(400, 'a time')
      if (!t && !m.slot.at) throw new MeetError(409, 'pick a time')
      if (t && t !== m.slot.at && m.slot.hours && !withinHours(m.slot.hours, t, m.slot.minutes)) throw new MeetError(400, 'outside the hours')
      const gname = clean(name, 40) || m.guestName || ''
      const slot = t && t !== m.slot.at ? { ...m.slot, at: t, guest: true, org: false } : { ...m.slot, guest: true }
      let next = { ...m, slot, guestKey: m.guestKey || sha(guest), guestName: gname }
      await store.set('meetings', id, next)
      next = await tell(id, next, 'organiser', slot.org ? 'agreed' : 'picked', gname)
      return { slot: publicSlot(next) }
    },

    /** The organiser accepts the time the guest picked. */
    async confirm({ token, code }) {
      const { id, m } = await ownMeeting(token, code)
      if (!m.slot?.at) throw new MeetError(409, 'no time to confirm')
      let next = { ...m, slot: { ...m.slot, org: true } }
      await store.set('meetings', id, next)
      next = await tell(id, next, 'guest', 'confirmed', m.slot.by || m.ownerName)
      return { slot: publicSlot(next) }
    },

    /** A device that wants to be told: the organiser's (with their session) or
     *  the invitee's (with their secret, which a first subscribe claims). */
    async subscribe({ token, code, guest, sub, locale }) {
      const clean1 = cleanSub(sub)
      if (!clean1) throw new MeetError(400, 'subscription')
      const entry = { sub: clean1, locale: locale === 'ar' ? 'ar' : 'en' }
      let id, m, key
      if (token) { ({ id, m } = await ownMeeting(token, code)); key = 'orgSubs' }
      else { ({ id, m } = await guestMeeting(code, guest)); key = 'guestSubs'; if (!m.guestKey) m = { ...m, guestKey: sha(guest) } }
      const list = (m[key] || []).filter((x) => x.sub.endpoint !== clean1.endpoint)
      await store.set('meetings', id, { ...m, [key]: [...list, entry].slice(-5) })
      return { ok: true }
    },

    /** The organiser's background picture for the screen before the call,
     *  kept apart from the meeting so the polled `info` stays small. A JPEG
     *  data URL; null removes it. */
    async setBackground({ token, code, image }) {
      const { id } = await ownMeeting(token, code)
      if (image == null || image === '') { await store.del('meetBackgrounds', id); return { ok: true } }
      if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw new MeetError(400, 'image')
      if (image.length > BG_MAX) throw new MeetError(413, 'image too large')
      await store.set('meetBackgrounds', id, { image, expiresAt: now() + IDLE_MS })
      return { ok: true }
    },

    /** Anybody with the code may see the picture: it is on the invitation too. */
    async background({ code }) {
      const id = clean(code, 20)
      if (!(await live('meetings', id))) return { image: null }
      const b = await live('meetBackgrounds', id)
      return { image: b?.image || null }
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
export const MEET_ACTIONS = ['registerOptions', 'register', 'loginOptions', 'login', 'create', 'info', 'claim', 'schedule', 'respond', 'confirm', 'subscribe', 'setBackground', 'background']
