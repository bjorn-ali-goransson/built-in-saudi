// Book With Me — the Calendly-style booking backend.
//
// Design notes (see docs/tools/book-with-me.md):
//  • No new npm deps: Google, Resend and Telegram are all reached over Node 20's
//    global fetch; host sessions are HMAC-signed with node:crypto; the .ics is
//    hand-written. Leanness is on-brand.
//  • One OAuth authorization-code flow does double duty: it signs the host in
//    (we read the id_token straight from Google's token endpoint, so it's
//    trusted) and grabs an offline refresh token for calendar access.
//  • The client never sees the refresh token. After the callback we mint our own
//    short-lived "hsid" session (HMAC over {sub,email,name}) and hand it back in
//    the redirect fragment; saveSchedule/subscribeHostPush verify it.
//  • Firestore: bookingHosts/{googleSub}, bookings/{uid_startMs} (the
//    deterministic booking id makes double-booking a transaction, not a query).

import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'
import webpush from 'web-push'
import crypto from 'node:crypto'

const { Firestore } = firestore
const db = new Firestore()
const HOSTS = 'bookingHosts'
const BOOKINGS = 'bookings'

const SITE = 'https://built-in-saudi.com'
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const SESSION_SECRET = process.env.SENDER_SECRET || 'x' // reuse the existing shared secret for HMAC

// This function's own base URL, used as the OAuth redirect target. All gen2
// functions in this project share the us-central1-<project> host.
const FN_BASE = 'https://us-central1-blitz-ksa.cloudfunctions.net'
const REDIRECT_URI = `${FN_BASE}/booking-google-callback`

const OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  // calendar.events covers both reading events (to compute busy times) and
  // creating the booking event — so no separate free/busy scope is needed.
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

// ---- CORS (browser-facing endpoints) ---------------------------------------

function cors(req, res) {
  const origin = (req.headers && req.headers.origin) || ''
  // Allow the apex and any *.built-in-saudi.com subdomain.
  const ok = /^https:\/\/([a-z0-9-]+\.)?built-in-saudi\.com$/.test(origin)
  res.set('Access-Control-Allow-Origin', ok ? origin : SITE)
  res.set('Vary', 'Origin')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}

// ---- host session token (our own, HMAC) ------------------------------------

const b64u = (buf) => Buffer.from(buf).toString('base64url')
const SESSION_TTL_MS = 30 * 86400000

function signSession(payload) {
  const body = b64u(JSON.stringify({ ...payload, exp: Date.now() + SESSION_TTL_MS }))
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verifySession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const expect = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
  // constant-time compare
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (!data.exp || Date.now() > data.exp) return null
    return data
  } catch {
    return null
  }
}

// ---- Google REST helpers ----------------------------------------------------

function decodeJwtPayload(jwt) {
  // The id_token comes straight from Google's token endpoint over TLS, so we can
  // trust its payload without re-verifying the signature.
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
  } catch {
    return {}
  }
}

async function exchangeCode(code) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })
  if (!r.ok) throw new Error(`token exchange ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json() // { access_token, refresh_token?, id_token, expires_in }
}

async function accessTokenFor(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!r.ok) throw new Error(`refresh ${r.status}`)
  return (await r.json()).access_token
}

// Busy = ANY real (timed) event on the calendar, regardless of its Busy/Free
// flag — most people never touch that flag and expect anything on their calendar
// to block. We skip all-day events (date-only) and events the host declined.
async function googleBusy(accessToken, calId, timeMinIso, timeMaxIso) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`
    + `?timeMin=${encodeURIComponent(timeMinIso)}&timeMax=${encodeURIComponent(timeMaxIso)}`
    + '&singleEvents=true&orderBy=startTime&maxResults=2500'
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    const e = new Error(`events ${r.status}`)
    // Distinguish "no Calendar permission granted" from transient errors.
    e.scopeError = r.status === 403 && /insufficientPermissions|insufficient authentication scopes/i.test(body)
    throw e
  }
  const data = await r.json()
  const busy = []
  for (const ev of data.items || []) {
    if (ev.status === 'cancelled') continue
    if (!ev.start || !ev.start.dateTime || !ev.end || !ev.end.dateTime) continue // skip all-day
    if ((ev.attendees || []).some((a) => a.self && a.responseStatus === 'declined')) continue
    busy.push({ start: Date.parse(ev.start.dateTime), end: Date.parse(ev.end.dateTime) })
  }
  return busy
}

async function insertEvent(accessToken, calId, event) {
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?sendUpdates=all&conferenceDataVersion=1`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    },
  )
  if (!r.ok) throw new Error(`insertEvent ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

// ---- notifications ----------------------------------------------------------

async function sendTelegram(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  }).catch(() => {})
}

async function sendEmail({ to, subject, html, ics }) {
  if (!RESEND_API_KEY || !to) return
  const body = {
    from: 'Built in Saudi <book@built-in-saudi.com>',
    to: [to],
    subject,
    html,
  }
  if (ics) {
    body.attachments = [{ filename: 'invite.ics', content: Buffer.from(ics).toString('base64'), content_type: 'text/calendar; method=REQUEST; charset=utf-8' }]
  }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {})
}

function icsStamp(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function buildICS({ uid, start, end, summary, description, location, organizerEmail, attendeeEmail }) {
  const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Built in Saudi//Book With Me//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(summary)}`,
    description ? `DESCRIPTION:${esc(description)}` : '',
    location ? `LOCATION:${esc(location)}` : '',
    organizerEmail ? `ORGANIZER:mailto:${organizerEmail}` : '',
    attendeeEmail ? `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendeeEmail}` : '',
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

// ---- timezone + slot math ---------------------------------------------------

/** Offset (ms) of `tz` at the given UTC instant. */
function tzOffsetMs(tz, utcMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = {}
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute, +p.second)
  return asUtc - utcMs
}

/** Wall-clock time in `tz` → UTC epoch ms. */
function zonedToUtc(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m, d, hh, mm)
  return guess - tzOffsetMs(tz, guess)
}

/** {year,month,day,weekday} of a UTC instant, as seen in `tz`. */
function partsInTz(utcMs, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const p = {}
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday]
  return { y: +p.year, m: +p.month, d: +p.day, weekday: wd }
}

const hhmmToMin = (s) => {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

/**
 * Open slot start epochs over the horizon = drawn availability, stepped by
 * (length + gap), minus min-notice, minus busy ranges.
 */
function openSlots(host, busy, now) {
  const tz = host.tz || 'Asia/Riyadh'
  const meeting = host.meeting || {}
  const windows = host.availability || []
  const minutes = meeting.minutes || 45
  const lenMs = minutes * 60000
  const stepMs = (minutes + (meeting.gapMinutes || 0)) * 60000
  const earliest = now + (meeting.minNoticeHours || 0) * 3600000
  const horizonEnd = now + (meeting.horizonDays || 30) * 86400000
  const HOUR = 3600000
  const slots = []
  const add = (s) => {
    if (s < earliest || s > horizonEnd) return
    const e = s + lenMs
    if (busy.some((b) => s < b.end && e > b.start)) return
    slots.push(s)
  }
  // Iterate calendar days in host tz from today until the horizon.
  for (let dayOffset = 0; dayOffset <= (meeting.horizonDays || 30) + 1; dayOffset++) {
    const probe = now + dayOffset * 86400000
    const { y, m, d, weekday } = partsInTz(probe, tz)
    for (const w of windows) {
      if (w.day !== weekday) continue
      const winStart = zonedToUtc(y, m - 1, d, 0, 0, tz) + hhmmToMin(w.start) * 60000
      const winEnd = zonedToUtc(y, m - 1, d, 0, 0, tz) + hhmmToMin(w.end) * 60000
      if (minutes > 60) {
        // Long meetings span hour boundaries — step continuously.
        for (let s = winStart; s + lenMs <= winEnd + 1; s += stepMs) add(s)
      } else {
        // One booking per painted hour; the rest of the hour is the gap.
        for (let h = winStart; h < winEnd; h += HOUR) add(h)
      }
    }
  }
  return [...new Set(slots)].sort((a, b) => a - b)
}

async function hostByCode(code) {
  if (!code) return null
  const snap = await db.collection(HOSTS).where('code', '==', String(code)).limit(1).get()
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

// ============================================================================
// Endpoints
// ============================================================================

// GET ?code=<localCode>&locale=en → 302 to Google's consent screen.
http('bookingGoogleStart', async (req, res) => {
  try {
    const code = String(req.query.code || '')
    const locale = req.query.locale === 'ar' ? 'ar' : 'en'
    const state = b64u(JSON.stringify({ code, locale, n: crypto.randomBytes(8).toString('hex') }))
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: OAUTH_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    })}`
    res.redirect(302, url)
  } catch (e) {
    res.status(500).send(String((e && e.message) || e))
  }
})

// GET ?code=…&state=… → exchange, upsert host, redirect back with #hsid.
http('bookingGoogleCallback', async (req, res) => {
  try {
    const code = req.query.code
    if (!code) return res.status(400).send('missing code')
    let st = {}
    try { st = JSON.parse(Buffer.from(String(req.query.state || ''), 'base64url').toString()) } catch { /* ignore */ }
    const tokens = await exchangeCode(code)
    const id = decodeJwtPayload(tokens.id_token || '')
    const sub = id.sub
    if (!sub) return res.status(400).send('no subject in id_token')

    const ref = db.collection(HOSTS).doc(sub)
    const existing = (await ref.get()).data() || {}
    // Keep the previously-stored refresh token if Google didn't send a new one
    // (it only returns it on the first consent).
    const refreshToken = tokens.refresh_token || (existing.google && existing.google.refreshToken) || null
    // Did the host actually grant Calendar access? Google's granular consent lets
    // them untick it; without it we can't read busy times or create events.
    const calGranted = /\/auth\/calendar/.test(String(tokens.scope || '')) || (existing.google && existing.google.calGranted) || false
    // Assign a code: keep existing, else the local code from state (if free), else a fresh one.
    let hostCode = existing.code || st.code || crypto.randomBytes(4).toString('hex')
    if (!existing.code && st.code) {
      const clash = await hostByCode(st.code)
      if (clash && clash.id !== sub) hostCode = crypto.randomBytes(4).toString('hex')
    }
    await ref.set(
      {
        code: hostCode,
        email: id.email || existing.email || null,
        name: id.name || existing.name || null,
        picture: id.picture || existing.picture || null,
        google: { refreshToken, calendarId: (existing.google && existing.google.calendarId) || 'primary', calGranted, connectedAt: new Date() },
        updatedAt: new Date(),
      },
      { merge: true },
    )
    const hsid = signSession({ sub, email: id.email, name: id.name, picture: id.picture, cal: calGranted })
    const locale = st.locale === 'ar' ? 'ar' : 'en'
    res.redirect(302, `${SITE}/${locale}/apps/book-me#hsid=${hsid}&code=${hostCode}`)
  } catch (e) {
    res.status(500).send(String((e && e.message) || e))
  }
})

// POST { hsid, code, tz, meeting, availability, notify, pushSub? } → upsert host.
http('saveSchedule', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { hsid, code, tz, firstDay, pageHeading, pageText, meeting, meetingTypes, availability, notify, pushSub } = req.body || {}
    const sess = verifySession(hsid)
    if (!sess) return res.status(401).json({ error: 'invalid session' })

    // Enforce code uniqueness across hosts.
    if (code) {
      const clash = await hostByCode(code)
      if (clash && clash.id !== sess.sub) return res.status(409).json({ error: 'code taken' })
    }
    const patch = { updatedAt: new Date() }
    if (code) patch.code = String(code)
    if (tz) patch.tz = String(tz)
    if (typeof firstDay === 'number') patch.firstDay = firstDay
    if (typeof pageHeading === 'string') patch.pageHeading = pageHeading
    if (typeof pageText === 'string') patch.pageText = pageText
    if (meeting) patch.meeting = meeting
    if (Array.isArray(meetingTypes)) patch.meetingTypes = meetingTypes
    if (Array.isArray(availability)) patch.availability = availability
    if (notify) patch.notify = notify
    if (pushSub && pushSub.endpoint) patch.pushSub = pushSub
    await db.collection(HOSTS).doc(sess.sub).set(patch, { merge: true })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// POST { code } → host meta + open slot start epochs (UTC ms) over the horizon.
http('getAvailability', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const host = await hostByCode(req.body && req.body.code)
    if (!host) return res.status(404).json({ error: 'not found' })
    const now = Date.now()
    const horizonEnd = now + ((host.meeting && host.meeting.horizonDays) || 30) * 86400000

    // Busy = existing confirmed bookings + (if connected) Google free/busy.
    const busy = []
    // Single-field query (no composite index needed); filter to future in code.
    const bk = await db.collection(BOOKINGS).where('hostUid', '==', host.id).get()
    for (const d of bk.docs) {
      const b = d.data()
      if (b.status === 'cancelled' || !b.startUtc) continue
      if (b.startUtc.toMillis() < now) continue
      busy.push({ start: b.startUtc.toMillis(), end: b.endUtc.toMillis() })
    }
    let calScopeMissing = false
    if (host.google && host.google.refreshToken) {
      try {
        const at = await accessTokenFor(host.google.refreshToken)
        const gbusy = await googleBusy(at, host.google.calendarId || 'primary', new Date(now).toISOString(), new Date(horizonEnd).toISOString())
        busy.push(...gbusy)
      } catch (e) {
        console.error('calendar busy failed:', String((e && e.message) || e))
        if (e && e.scopeError) calScopeMissing = true
      }
    }
    // Without Calendar access the availability is meaningless (can't see the host's
    // real events), so the page must not half-work — surface a clear error.
    if (calScopeMissing || !(host.google && host.google.refreshToken)) {
      return res.json({ ok: false, error: 'host-calendar' })
    }
    const slots = openSlots(host, busy, now)
    // All potential slots (ignoring busy) minus the open ones = the taken ones,
    // so the booking page can show unavailable times greyed out.
    const taken = openSlots(host, [], now).filter((s) => !slots.includes(s))
    res.json({
      ok: true,
      taken,
      host: {
        name: host.name || null,
        picture: host.picture || null,
        tz: host.tz || 'Asia/Riyadh',
        minutes: (host.meeting && host.meeting.minutes) || 45,
        title: (host.meeting && host.meeting.title) || 'Meeting',
        location: (host.meeting && host.meeting.location) || '',
        pageHeading: host.pageHeading || '',
        pageText: host.pageText || '',
        meetingTypes: Array.isArray(host.meetingTypes) ? host.meetingTypes : [],
      },
      slots,
    })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

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

// POST { hsid } → delete this host's booking page and all its bookings.
http('deleteHost', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const sess = verifySession((req.body || {}).hsid)
    if (!sess || !sess.sub) return res.status(401).json({ error: 'invalid session' })
    const bk = await db.collection(BOOKINGS).where('hostUid', '==', sess.sub).get()
    const batch = db.batch()
    bk.docs.forEach((d) => batch.delete(d.ref))
    batch.delete(db.collection(HOSTS).doc(sess.sub))
    await batch.commit()
    res.json({ ok: true, deletedBookings: bk.size })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// POST { idToken, del } → report (and optionally delete) everything we store for
// this Google user across the site: booking page + bookings + CV usage counters.
http('myData', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, del } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user || !user.sub) return res.status(401).json({ error: 'sign in first' })
    const [hostDoc, bk, cvDoc, cvSavedDoc, links] = await Promise.all([
      db.collection(HOSTS).doc(user.sub).get(),
      db.collection(BOOKINGS).where('hostUid', '==', user.sub).get(),
      db.collection('cvUsage').doc(user.sub).get(),
      db.collection('cvSaved').doc(user.sub).get(),
      db.collection('shortLinks').where('owner', '==', user.sub).get(),
    ])
    const report = {
      email: user.email || null,
      bookingPage: hostDoc.exists ? { code: hostDoc.get('code') || null, meetingTypes: ((hostDoc.get('meetingTypes')) || []).length } : null,
      bookings: bk.size,
      cvRuns: cvDoc.exists ? ((cvDoc.get('uploads')) || []).length : 0,
      savedCv: cvSavedDoc.exists,
      shortLinks: links.size,
    }
    if (del) {
      const batch = db.batch()
      bk.docs.forEach((d) => batch.delete(d.ref))
      links.docs.forEach((d) => batch.delete(d.ref))
      if (hostDoc.exists) batch.delete(hostDoc.ref)
      if (cvDoc.exists) batch.delete(cvDoc.ref)
      if (cvSavedDoc.exists) batch.delete(cvSavedDoc.ref)
      await batch.commit()
    }
    res.json({ ok: true, report, deleted: !!del })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// POST { hsid } → is the host's stored Google token still usable, and does it
// actually have Calendar access? Lets the editor warn if a reconnect is needed.
http('hostStatus', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const sess = verifySession((req.body || {}).hsid)
    if (!sess || !sess.sub) return res.status(401).json({ error: 'invalid session' })
    const host = (await db.collection(HOSTS).doc(sess.sub).get()).data()
    if (!host || !host.google || !host.google.refreshToken) return res.json({ ok: true, connected: false, calendar: false })
    // Refresh the token and read its granted scopes — the reliable signal.
    let connected = false
    let calendar = false
    try {
      const at = await accessTokenFor(host.google.refreshToken)
      connected = true
      const ti = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(at)}`).then((r) => (r.ok ? r.json() : null))
      calendar = !!(ti && /\/auth\/calendar/.test(String(ti.scope || '')))
    } catch {
      connected = false // refresh token revoked/expired
    }
    res.json({ ok: true, connected, calendar })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// POST { hsid } → the host's saved schedule config (the source of truth for the
// live page), so the editor can detect drift from a local copy.
http('getConfig', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const sess = verifySession((req.body || {}).hsid)
    if (!sess || !sess.sub) return res.status(401).json({ error: 'invalid session' })
    const host = (await db.collection(HOSTS).doc(sess.sub).get()).data()
    if (!host) return res.json({ ok: true, config: null })
    res.json({
      ok: true,
      config: {
        code: host.code || null,
        tz: host.tz || null,
        firstDay: typeof host.firstDay === 'number' ? host.firstDay : null,
        pageHeading: host.pageHeading || '',
        pageText: host.pageText || '',
        meeting: host.meeting || null,
        meetingTypes: Array.isArray(host.meetingTypes) ? host.meetingTypes : [],
        availability: Array.isArray(host.availability) ? host.availability : [],
        notify: host.notify || null,
      },
    })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// POST { code, startUtc, name, email, note } → book (transactional), notify.
http('book', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { code, startUtc, name, email, note, typeId } = req.body || {}
    if (!startUtc || !name || !email) return res.status(400).json({ error: 'missing fields' })
    const host = await hostByCode(code)
    if (!host) return res.status(404).json({ error: 'not found' })

    // The chosen meeting type drives the title, duration and whether we add a Meet.
    const type = (Array.isArray(host.meetingTypes) ? host.meetingTypes : []).find((t) => t.id === typeId)
    const minutes = (type && type.minutes) || (host.meeting && host.meeting.minutes) || 45
    const wantMeet = !!(type && type.meet)
    const start = Number(startUtc)
    const lenMs = minutes * 60000
    const end = start + lenMs
    if (start < Date.now()) return res.status(400).json({ error: 'in the past' })

    // Validate the slot is genuinely open right now (availability + freebusy).
    let busy = []
    if (host.google && host.google.refreshToken) {
      try {
        const at = await accessTokenFor(host.google.refreshToken)
        busy = await googleBusy(at, host.google.calendarId || 'primary', new Date(start).toISOString(), new Date(end).toISOString())
      } catch { /* if freebusy fails, fall back to availability + booking lock */ }
    }
    const stillOpen = openSlots(host, busy, Date.now() - 60000).includes(start)
    if (!stillOpen) return res.status(409).json({ error: 'slot no longer available' })

    // Atomic double-booking guard via a deterministic doc id per slot.
    const bId = `${host.id}_${start}`
    const bRef = db.collection(BOOKINGS).doc(bId)
    await db.runTransaction(async (t) => {
      const snap = await t.get(bRef)
      if (snap.exists && snap.data().status !== 'cancelled') throw new Error('ALREADY_BOOKED')
      t.set(bRef, {
        hostUid: host.id,
        code: host.code,
        startUtc: new Date(start),
        endUtc: new Date(end),
        booker: { name: String(name).slice(0, 120), email: String(email).slice(0, 160), note: String(note || '').slice(0, 500) },
        status: 'confirmed',
        gcalEventId: null,
        createdAt: new Date(),
      })
    }).catch((e) => {
      if (String(e.message).includes('ALREADY_BOOKED')) {
        const err = new Error('slot no longer available'); err.code = 409; throw err
      }
      throw e
    })

    const title = (type && type.name) || (host.meeting && host.meeting.title) || 'Meeting'
    const location = (host.meeting && host.meeting.location) || ''
    const summary = `${title} — ${name}`

    // Create the Google Calendar event (best-effort; booking already persisted).
    // Capture the auto-created Meet link so we can put it in the emails/.ics too.
    let meetLink = ''
    if (host.google && host.google.refreshToken) {
      try {
        const at = await accessTokenFor(host.google.refreshToken)
        const event = {
          summary,
          description: note ? `Booked via Built in Saudi.\n\n${note}` : 'Booked via Built in Saudi.',
          location,
          start: { dateTime: new Date(start).toISOString() },
          end: { dateTime: new Date(end).toISOString() },
          attendees: [{ email: String(email), displayName: String(name) }],
        }
        if (wantMeet) {
          event.conferenceData = { createRequest: { requestId: bId, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
        }
        const ev = await insertEvent(at, host.google.calendarId || 'primary', event)
        if (ev && ev.hangoutLink) meetLink = ev.hangoutLink
        if (ev && ev.id) await bRef.update({ gcalEventId: ev.id, ...(meetLink ? { meetLink } : {}) })
      } catch (e) {
        console.error('gcal insert failed:', String((e && e.message) || e))
      }
    }

    // Notify the host: push + Telegram.
    const whenHost = new Date(start).toLocaleString('en-GB', { timeZone: host.tz || 'Asia/Riyadh' })
    const notify = host.notify || {}
    if (notify.push !== false && host.pushSub && host.pushSub.endpoint) {
      try {
        await webpush.sendNotification(host.pushSub, JSON.stringify({
          title: `New booking: ${title}`,
          body: `${name} · ${whenHost}`,
          tag: 'booking',
          url: `${SITE}/en/apps/book-me`,
        }))
      } catch (e) { /* prune handled elsewhere */ }
    }
    if (notify.telegram !== false && host.telegramChatId) {
      await sendTelegram(
        host.telegramChatId,
        `<b>New booking: ${title}</b>\n${name} (${email})\n${whenHost}${note ? `\n\n${note}` : ''}`,
      )
    }

    // Email the booker (and host) a confirmation with a real .ics.
    const ics = buildICS({
      uid: `${bId}@built-in-saudi.com`,
      start, end, summary: title, description: [note, meetLink && `Google Meet: ${meetLink}`].filter(Boolean).join('\n\n'),
      location: meetLink || location,
      organizerEmail: host.email, attendeeEmail: String(email),
    })
    const meetHtml = meetLink ? `<p><b>Google Meet:</b> <a href="${meetLink}">${meetLink}</a></p>` : ''
    const whenBooker = new Date(start).toISOString()
    if (notify.email !== false) {
      await sendEmail({
        to: String(email),
        subject: `Confirmed: ${title}`,
        html: `<p>Your ${title.toLowerCase()} is booked.</p><p><b>When:</b> ${whenBooker} (UTC)</p>${location ? `<p><b>Where:</b> ${location}</p>` : ''}${meetHtml}<p>Added to your calendar via the attached invite.</p>`,
        ics,
      })
      if (host.email) {
        await sendEmail({
          to: host.email,
          subject: `New booking: ${title} — ${name}`,
          html: `<p><b>${name}</b> (${email}) booked ${title}.</p><p><b>When:</b> ${whenHost}</p>${meetHtml}${note ? `<p><b>Note:</b> ${note}</p>` : ''}`,
          // Skip the .ics when the host has Calendar connected — the event is
          // already on their calendar (avoids Gmail's "Unable to load event").
          ics: host.google && host.google.refreshToken ? undefined : ics,
        })
      }
    }

    res.json({ ok: true })
  } catch (e) {
    if (e && e.code === 409) return res.status(409).json({ error: e.message })
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// Telegram webhook: on "/start <code>" link the sender's chat to that host.
// Set up once with: setWebhook → this function's URL (see functions/README.md).
http('telegramWebhook', async (req, res) => {
  try {
    const msg = req.body && (req.body.message || req.body.edited_message)
    const text = (msg && msg.text) || ''
    const chatId = msg && msg.chat && msg.chat.id
    const m = text.match(/^\/start\s+(\S+)/)
    if (m && chatId) {
      const host = await hostByCode(m[1])
      if (host) {
        await db.collection(HOSTS).doc(host.id).set({ telegramChatId: chatId }, { merge: true })
        await sendTelegram(chatId, '✅ Linked. You’ll get a message here whenever someone books with you.')
      } else {
        await sendTelegram(chatId, '❌ Couldn’t find that booking link.')
      }
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(200).json({ ok: false }) // always 200 so Telegram doesn't retry-storm
  }
})
