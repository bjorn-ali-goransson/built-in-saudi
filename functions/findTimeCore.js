// Find a Time: a group picks a meeting time by marking when each of them is free.
//
// A POLL is a week (seven days from the organiser's midnight today) cut into
// half-hour SLOTS. A slot is an index from the poll's start, which is an
// absolute instant, so every browser draws the same slot at its own local time
// and nobody has to agree on a time zone. The organiser names the people they
// invite; each of them opens the one shared link, says which name is theirs,
// and marks the slots they are free. Everybody with the link sees everybody's
// marks, who has answered, and the slots that suit everyone who has.
//
// People are known by a PASSKEY and nothing else — no password, no email —
// because the server then holds only a public key, and the same person can come
// back from their phone to change their answer. Holding a name is what stops
// somebody else with the link from answering for them.
//
// LIVE: every change bumps `version`, and `get` with the version the page
// already has answers `{ unchanged: true }`, so a page can ask every few
// seconds for the price of one document read.
//
// NOTIFY: a browser can subscribe to the poll; when the set of slots that suit
// everyone who answered changes, each subscription gets a web push.
//
// RETENTION: a poll is deleted a month after it was made, whatever happens to
// it. A person and their passkeys are forgotten after a month of inactivity.
// Expired records are treated as gone here and deleted when read; Firestore's
// TTL policy on `expiresAt` (set by the deploy workflow) removes the rest.
//
// No Firestore and no HTTP in this file: the store is passed in, so the
// deployed function (findTime.js) and the e2e (an in-memory store behind
// Chromium's virtual authenticator) run the same code.
import crypto from 'node:crypto'
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server'

const CHALLENGE_MS = 5 * 60000
const SESSION_MS = 30 * 86400000
const IDLE_MS = 30 * 86400000 // a person and their passkeys, after their last use
export const POLL_MS = 30 * 86400000 // a poll, after it was made — not renewed by use
export const DAYS = 7
export const SLOT_MIN = 30
export const SLOTS = DAYS * 24 * 60 / SLOT_MIN
const MAX_PEOPLE = 40
const MAX_SUBS = 60
const CODE = 'abcdefghjkmnpqrstuvwxyz23456789' // no 0/o, 1/l/i

export class FindTimeError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

const b64u = (buf) => Buffer.from(buf).toString('base64url')
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
function randomCode(n) {
  const b = crypto.randomBytes(n)
  let s = ''
  for (let i = 0; i < n; i++) s += CODE[b[i] % CODE.length]
  return s
}

/** Whether `tz` is an IANA zone this runtime knows. */
export function validZone(tz) {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

/** The offset of `tz` from UTC at instant `t`, in milliseconds. */
function offsetAt(tz, t) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t)).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - Math.floor(t / 1000) * 1000
}

/** The instant of midnight starting the day `t` falls on, on `tz`'s wall clock.
 *  Twice round, because the offset at the guess can differ from the offset at
 *  midnight across a daylight-saving change. */
export function zonedMidnight(tz, t) {
  const local = t + offsetAt(tz, t)
  const day = Math.floor(local / 86400000) * 86400000
  let guess = day - offsetAt(tz, day)
  guess = day - offsetAt(tz, guess)
  return guess
}

/** Slots marked by every one of `people` who has answered, when at least two
 *  have. The thing a subscriber is told about. */
export function everyoneSlots(people) {
  const answered = people.filter((p) => p.answered)
  if (answered.length < 2) return []
  const count = new Map()
  for (const p of answered) for (const s of p.avail || []) count.set(s, (count.get(s) || 0) + 1)
  return [...count].filter(([, n]) => n === answered.length).map(([s]) => s).sort((a, b) => a - b)
}

/**
 * store: { get(col, id), set(col, id, obj), del(col, id), find(col, field, value) },
 *   all async; `find` returns [{ id, ...doc }] whose array `field` CONTAINS value.
 * rp: { id, name }; origins: the page origins a ceremony may come from.
 * site: the page origin links in notifications point at.
 * notify(sub, payload): sends one web push; throws with `statusCode` on failure.
 */
export function findTimeService({ store, secret, rp, origins, now = () => Date.now(), notify = async () => {}, site }) {
  const SITE = site || origins[0]
  if (!secret) throw new Error('findTimeService needs a secret')

  // --- sessions and passkeys (the same ceremony as Sawi Kalam's meetCore) ---
  function sign(payload) {
    const body = b64u(JSON.stringify(payload))
    return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
  }
  function session(token) {
    const [body, sig] = String(token || '').split('.')
    if (!body || !sig) throw new FindTimeError(401, 'sign in')
    const expect = crypto.createHmac('sha256', secret).update(body).digest('base64url')
    const a = Buffer.from(sig), b = Buffer.from(expect)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new FindTimeError(401, 'sign in')
    let p
    try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { throw new FindTimeError(401, 'sign in') }
    if (!p.uid || !(p.exp > now())) throw new FindTimeError(401, 'sign in')
    return p
  }
  async function saveChallenge(kind, challenge, extra = {}) {
    const id = b64u(crypto.randomBytes(16))
    await store.set('ftChallenges', id, { kind, challenge, ...extra, expiresAt: now() + CHALLENGE_MS })
    return id
  }
  async function takeChallenge(id, kind) {
    const c = id ? await store.get('ftChallenges', String(id)) : null
    if (c) await store.del('ftChallenges', String(id))
    if (!c || c.kind !== kind || !(c.expiresAt > now())) throw new FindTimeError(400, 'start again')
    return c
  }
  async function live(col, id) {
    const r = id ? await store.get(col, id) : null
    if (!r) return null
    if (!(r.expiresAt > now())) { await store.del(col, id); return null }
    return r
  }
  async function touchUser(uid, user) {
    const until = now() + IDLE_MS
    await store.set('ftUsers', uid, { ...user, expiresAt: until })
    for (const id of user.creds || []) {
      const c = await store.get('ftCredentials', id)
      if (c) await store.set('ftCredentials', id, { ...c, expiresAt: until })
    }
  }
  async function person(token) {
    const s = session(token)
    const user = await live('ftUsers', s.uid)
    if (!user) throw new FindTimeError(401, 'sign in')
    return { uid: s.uid, user }
  }
  const issue = (uid, name) => ({ token: sign({ uid, name, exp: now() + SESSION_MS }), name })

  // --- polls ---
  // `members` (the uids holding a name) is kept beside `people` so myData and
  // deleteAccount find a person's polls with one equality query.
  const putPoll = (id, p) => store.set('ftPolls', id, { ...p, members: p.people.filter((x) => x.uid).map((x) => x.uid) })
  async function poll(code) {
    const id = clean(code, 16)
    const p = await live('ftPolls', id)
    if (!p) throw new FindTimeError(404, 'no such poll')
    return { id, p }
  }
  const cleanSlots = (a) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < SLOTS))].sort((x, y) => x - y)
  const cleanNames = (a) => {
    const out = []
    for (const n of Array.isArray(a) ? a : []) {
      const c = clean(n, 40)
      if (c && !out.some((x) => x.toLowerCase() === c.toLowerCase())) out.push(c)
    }
    return out.slice(0, MAX_PEOPLE)
  }
  const pid = () => b64u(crypto.randomBytes(6))
  /** What anybody holding the link may see. Never a uid, a subscription or a key. */
  function view(id, p, uid) {
    const people = p.people.map((x) => ({
      id: x.id, name: x.name, owner: !!x.owner, claimed: !!x.uid, answered: !!x.answered,
      avail: x.avail || [], tz: x.tz || '', you: !!uid && x.uid === uid,
    }))
    return {
      code: id, title: p.title, start: p.start, days: DAYS, slotMin: SLOT_MIN, tz: p.tz,
      people, everyone: everyoneSlots(p.people), version: p.version,
      owner: !!uid && p.owner === uid, expiresAt: p.expiresAt,
    }
  }
  async function save(id, p, before) {
    const next = { ...p, version: (p.version || 0) + 1 }
    await putPoll(id, next)
    // Tell the subscribers when what suits everyone changes, and only then:
    // somebody adding a slot nobody else has is not news.
    const was = everyoneSlots(before.people).join(',')
    const is = everyoneSlots(next.people)
    if (was !== is.join(',') && (next.subs || []).length) return tellAll(id, next, is)
    return next
  }
  const TEXT = {
    en: {
      title: (t) => t || 'Find a Time',
      some: (n, a, of) => `${n} ${n === 1 ? 'time suits' : 'times suit'} all ${a} who answered${a < of ? ` (of ${of})` : ''}.`,
      none: () => 'No time suits everyone who answered any more.',
    },
    ar: {
      title: (t) => t || 'ابحث عن موعد',
      some: (n, a, of) => `${n} ${n === 1 ? 'موعد يناسب' : 'مواعيد تناسب'} كل من أجاب (${a}${a < of ? ` من ${of}` : ''}).`,
      none: () => 'لم يعد أي موعد يناسب كل من أجاب.',
    },
  }
  async function tellAll(id, p, slots) {
    const answered = p.people.filter((x) => x.answered).length
    const keep = []
    for (const s of p.subs || []) {
      const T = TEXT[s.locale] || TEXT.en
      const body = slots.length ? T.some(slots.length, answered, p.people.length) : T.none()
      try {
        await notify(s.sub, { title: T.title(p.title), body, url: `${SITE}/${s.locale === 'ar' ? 'ar' : 'en'}/apps/find-time?p=${id}`, tag: `ft-${id}` })
        keep.push(s)
      } catch (e) { if (!(e && (e.statusCode === 404 || e.statusCode === 410))) keep.push(s) }
    }
    if (keep.length !== (p.subs || []).length) { p = { ...p, subs: keep }; await putPoll(id, p) }
    return p
  }
  const cleanSub = (sub) => (sub && typeof sub.endpoint === 'string' && /^https:\/\//.test(sub.endpoint) && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string')
    ? { endpoint: sub.endpoint.slice(0, 1000), keys: { p256dh: sub.keys.p256dh.slice(0, 200), auth: sub.keys.auth.slice(0, 100) } } : null

  return {
    async registerOptions({ name }) {
      const display = clean(name, 40)
      if (!display) throw new FindTimeError(400, 'a name')
      const uid = b64u(crypto.randomBytes(16))
      const options = await generateRegistrationOptions({
        rpName: rp.name, rpID: rp.id, userID: Buffer.from(uid), userName: display, userDisplayName: display,
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      })
      const challengeId = await saveChallenge('reg', options.challenge, { uid, name: display })
      return { challengeId, options }
    },

    async register({ challengeId, response }) {
      const c = await takeChallenge(challengeId, 'reg')
      let v
      try {
        v = await verifyRegistrationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: origins, expectedRPID: rp.id, requireUserVerification: true })
      } catch (e) { throw new FindTimeError(400, `passkey not accepted: ${e.message}`) }
      if (!v.verified || !v.registrationInfo) throw new FindTimeError(400, 'passkey not accepted')
      const cred = v.registrationInfo.credential
      if (await store.get('ftCredentials', cred.id)) throw new FindTimeError(409, 'passkey already registered')
      await store.set('ftCredentials', cred.id, {
        uid: c.uid, publicKey: b64u(cred.publicKey), counter: cred.counter, transports: cred.transports || [], createdAt: now(), expiresAt: now() + IDLE_MS,
      })
      await store.set('ftUsers', c.uid, { name: c.name, creds: [cred.id], createdAt: now(), expiresAt: now() + IDLE_MS })
      return issue(c.uid, c.name)
    },

    async loginOptions() {
      const options = await generateAuthenticationOptions({ rpID: rp.id, userVerification: 'required' })
      const challengeId = await saveChallenge('auth', options.challenge)
      return { challengeId, options }
    },

    async login({ challengeId, response }) {
      const c = await takeChallenge(challengeId, 'auth')
      const credId = String(response?.id || '')
      const raw = credId ? await store.get('ftCredentials', credId) : null
      const user = raw ? await live('ftUsers', raw.uid) : null
      const stored = raw ? await live('ftCredentials', credId) : null
      if (!stored || !user) throw new FindTimeError(401, 'unknown passkey')
      let v
      try {
        v = await verifyAuthenticationResponse({
          response, expectedChallenge: c.challenge, expectedOrigin: origins, expectedRPID: rp.id, requireUserVerification: true,
          credential: { id: credId, publicKey: Buffer.from(stored.publicKey, 'base64url'), counter: stored.counter, transports: stored.transports },
        })
      } catch (e) { throw new FindTimeError(401, `passkey not accepted: ${e.message}`) }
      if (!v.verified) throw new FindTimeError(401, 'passkey not accepted')
      await store.set('ftCredentials', credId, { ...stored, counter: v.authenticationInfo.newCounter, usedAt: now() })
      await touchUser(stored.uid, user)
      return issue(stored.uid, user.name || '')
    },

    /** A new poll. The organiser is its first person, already holding their
     *  name; `names` are the people they invite. */
    async create({ token, title, names, tz }) {
      const { uid, user } = await person(token)
      await touchUser(uid, user)
      const zone = validZone(tz) ? tz : 'UTC'
      const ownerName = user.name || 'Organiser'
      const invited = cleanNames(names).filter((n) => n.toLowerCase() !== ownerName.toLowerCase())
      const people = [
        { id: pid(), name: ownerName, uid, owner: true, answered: false, avail: [], tz: zone },
        ...invited.map((n) => ({ id: pid(), name: n, uid: null, answered: false, avail: [] })),
      ].slice(0, MAX_PEOPLE)
      for (let i = 0; i < 5; i++) {
        const code = randomCode(8)
        if (await store.get('ftPolls', code)) continue
        const t = now()
        const p = { owner: uid, title: clean(title, 80), tz: zone, start: zonedMidnight(zone, t), people, subs: [], version: 1, createdAt: t, expiresAt: t + POLL_MS }
        await putPoll(code, p)
        return view(code, p, uid)
      }
      throw new FindTimeError(503, 'try again')
    },

    /** The poll as anybody with the link sees it. With `since` equal to the
     *  current version, only `{ unchanged: true }`: the cheap live poll. */
    async get({ code, token, since }) {
      const id = clean(code, 16)
      const p = await live('ftPolls', id)
      if (!p) return { exists: false }
      if (since != null && Number(since) === p.version) return { unchanged: true, version: p.version }
      let uid = null
      if (token) { try { uid = session(token).uid } catch { uid = null } }
      return { exists: true, poll: view(id, p, uid) }
    },

    /** Say which invited name is yours (`pid`), or join under a new `name`.
     *  A name somebody else holds cannot be taken; you hold one name per poll. */
    async claim({ token, code, pid: which, name, tz }) {
      const { uid, user } = await person(token)
      const { id, p } = await poll(code)
      if (p.people.some((x) => x.uid === uid)) return view(id, p, uid)
      let people
      if (which) {
        const target = p.people.find((x) => x.id === which)
        if (!target) throw new FindTimeError(404, 'no such person')
        if (target.uid) throw new FindTimeError(409, 'somebody already holds that name')
        people = p.people.map((x) => (x.id === which ? { ...x, uid, tz: validZone(tz) ? tz : x.tz || '' } : x))
      } else {
        const n = clean(name, 40) || user.name
        if (!n) throw new FindTimeError(400, 'a name')
        if (p.people.length >= MAX_PEOPLE) throw new FindTimeError(409, 'the poll is full')
        if (p.people.some((x) => x.name.toLowerCase() === n.toLowerCase())) throw new FindTimeError(409, 'that name is taken')
        people = [...p.people, { id: pid(), name: n, uid, answered: false, avail: [], tz: validZone(tz) ? tz : '' }]
      }
      const next = await save(id, { ...p, people }, p)
      return view(id, next, uid)
    },

    /** Your free slots, replacing what you marked before. */
    async setAvail({ token, code, slots, tz }) {
      const { uid } = await person(token)
      const { id, p } = await poll(code)
      const me = p.people.find((x) => x.uid === uid)
      if (!me) throw new FindTimeError(403, 'say which name is yours first')
      const avail = cleanSlots(slots)
      const people = p.people.map((x) => (x.uid === uid ? { ...x, avail, answered: true, tz: validZone(tz) ? tz : x.tz || '' } : x))
      const next = await save(id, { ...p, people }, p)
      return view(id, next, uid)
    },

    /** The organiser invites more people by name. */
    async invite({ token, code, names }) {
      const { uid } = await person(token)
      const { id, p } = await poll(code)
      if (p.owner !== uid) throw new FindTimeError(403, 'not yours')
      const have = new Set(p.people.map((x) => x.name.toLowerCase()))
      const add = cleanNames(names).filter((n) => !have.has(n.toLowerCase()))
      const people = [...p.people, ...add.map((n) => ({ id: pid(), name: n, uid: null, answered: false, avail: [] }))].slice(0, MAX_PEOPLE)
      const next = await save(id, { ...p, people }, p)
      return view(id, next, uid)
    },

    /** The organiser takes somebody off the poll, with their answer. */
    async remove({ token, code, pid: which }) {
      const { uid } = await person(token)
      const { id, p } = await poll(code)
      if (p.owner !== uid) throw new FindTimeError(403, 'not yours')
      const target = p.people.find((x) => x.id === which)
      if (!target) throw new FindTimeError(404, 'no such person')
      if (target.owner) throw new FindTimeError(400, 'the organiser stays')
      const next = await save(id, { ...p, people: p.people.filter((x) => x.id !== which) }, p)
      return view(id, next, uid)
    },

    /** A browser that wants to hear when what suits everyone changes. Anybody
     *  with the link may: the push says no more than the page does. */
    async subscribe({ code, sub, locale }) {
      const s = cleanSub(sub)
      if (!s) throw new FindTimeError(400, 'subscription')
      const { id, p } = await poll(code)
      const subs = (p.subs || []).filter((x) => x.sub.endpoint !== s.endpoint)
      await putPoll(id, { ...p, subs: [...subs, { sub: s, locale: locale === 'ar' ? 'ar' : 'en' }].slice(-MAX_SUBS) })
      return { ok: true }
    },

    async unsubscribe({ code, endpoint }) {
      const { id, p } = await poll(code)
      const subs = (p.subs || []).filter((x) => x.sub.endpoint !== String(endpoint || ''))
      if (subs.length !== (p.subs || []).length) await putPoll(id, { ...p, subs })
      return { ok: true }
    },

    async deletePoll({ token, code }) {
      const { uid } = await person(token)
      const { id, p } = await poll(code)
      if (p.owner !== uid) throw new FindTimeError(403, 'not yours')
      await store.del('ftPolls', id)
      return { ok: true }
    },

    /** Everything kept for the signed-in person: their name, passkeys (id
     *  prefix and dates), the polls they made, and the polls they answer in
     *  (found through `members`, so one equality query serves it). */
    async myData({ token }) {
      const { uid, user } = await person(token)
      const passkeys = []
      for (const id of user.creds || []) {
        const c = await store.get('ftCredentials', id)
        if (c) passkeys.push({ id: id.slice(0, 8), createdAt: c.createdAt || null, usedAt: c.usedAt || null, expiresAt: c.expiresAt })
      }
      const polls = []
      for (const p of await store.find('ftPolls', 'members', uid)) {
        if (!(p.expiresAt > now())) continue
        const me = p.people.find((x) => x.uid === uid)
        polls.push({ code: p.id, title: p.title, owner: p.owner === uid, name: me?.name || '', slots: (me?.avail || []).length, createdAt: p.createdAt, expiresAt: p.expiresAt })
      }
      polls.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      return { person: { name: user.name || '', createdAt: user.createdAt || null, expiresAt: user.expiresAt }, passkeys, polls }
    },

    /** The person, their passkeys' public keys, the polls they made, and their
     *  name and answer on everybody else's polls, gone now. */
    async deleteAccount({ token }) {
      const { uid, user } = await person(token)
      for (const p of await store.find('ftPolls', 'members', uid)) {
        if (p.owner === uid) { await store.del('ftPolls', p.id); continue }
        const { id: _drop, ...rest } = p
        const people = p.people.filter((x) => x.uid !== uid)
        await putPoll(p.id, { ...rest, people, version: (p.version || 0) + 1 })
      }
      for (const id of user.creds || []) await store.del('ftCredentials', id)
      await store.del('ftUsers', uid)
      return { ok: true }
    },
  }
}

/** The routes, so the function and the tests dispatch identically. */
export const FIND_TIME_ACTIONS = ['registerOptions', 'register', 'loginOptions', 'login', 'create', 'get', 'claim', 'setAvail', 'invite', 'remove', 'subscribe', 'unsubscribe', 'deletePoll', 'myData', 'deleteAccount']
