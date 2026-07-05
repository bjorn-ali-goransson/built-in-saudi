import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'
import webpush from 'web-push'
import * as adhan from 'adhan'
// Book With Me endpoints (bookingGoogleStart/Callback, saveSchedule,
// getAvailability, book, telegramWebhook). Importing here registers their
// http() handlers; VAPID is configured below and shared.
import './booking.js'

const { Firestore } = firestore
const db = new Firestore()
const COL = 'prayerSubs'
const ORIGIN = 'https://built-in-saudi.com'
const ALL_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

webpush.setVapidDetails(
  'mailto:hello@built-in-saudi.com',
  process.env.VAPID_PUBLIC || '',
  process.env.VAPID_PRIVATE || '',
)

const NAMES = {
  en: { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  ar: { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
}
// Notification wording, in the style of Saudi Quran Radio, kept terse:
//   title: "دخل المغرب"  ·  body: "حسب توقيت: الرياض"
// `place` is the localized city name (device locations are reverse-geocoded on
// the client, so it should be present; may be absent → generic body).
function compose(locale, prayer, kind, mins, place) {
  const ar = locale === 'ar'
  // "حسب توقيت: <place>" — a colon avoids Arabic grammar/agreement and reads fine
  // even if the geocoder returns a Latin-script city name for device locations.
  const byCity = ar
    ? (place ? `حسب توقيت: ${place}` : 'حسب توقيتك')
    : (place ? `Timing: ${place}` : 'Based on your location')
  if (kind === 'iqama') {
    return ar
      ? { title: `إقامة صلاة ${prayer}`, body: byCity }
      : { title: `Iqama · ${prayer}`, body: byCity }
  }
  if (mins > 0) {
    return ar
      ? { title: `صلاة ${prayer} بعد ${mins} دقيقة`, body: byCity }
      : { title: `${prayer} in ${mins} min`, body: byCity }
  }
  return ar
    ? { title: `دخل ${prayer}`, body: byCity }
    : { title: `It’s time for ${prayer}`, body: byCity }
}
// Iqama (congregation) minutes after the adhan, per common Saudi practice.
const IQAMA_MIN = { fajr: 20, dhuhr: 15, asr: 15, maghrib: 10, isha: 15 }

// Non-prayer timed reminders (kind 'event'): morning adhkār at sunrise, evening
// adhkār 15 min after Maghrib, and Ṣalāt al-Ḍuḥā 20 min after sunrise.
const EVENING_ADHKAR_AFTER_MAGHRIB_MIN = 15
const DUHA_AFTER_SUNRISE_MIN = 20
const EVENT_TEXT = {
  en: {
    morningAdhkar: { title: 'Morning adhkār', body: 'Time for the morning remembrances' },
    eveningAdhkar: { title: 'Evening adhkār', body: 'Time for the evening remembrances' },
    duha: { title: 'Ḍuḥā prayer', body: 'The time for Ṣalāt al-Ḍuḥā has begun' },
  },
  ar: {
    morningAdhkar: { title: 'أذكار الصباح', body: 'حان وقت أذكار الصباح' },
    eveningAdhkar: { title: 'أذكار المساء', body: 'حان وقت أذكار المساء' },
    duha: { title: 'صلاة الضحى', body: 'دخل وقت صلاة الضحى' },
  },
}
const EVENT_TOOL = { morningAdhkar: 'adhkar', eveningAdhkar: 'adhkar', duha: 'prayer-times' }
const EVENT_TAG = { morningAdhkar: 'adhkar', eveningAdhkar: 'adhkar', duha: 'duha' }
function composeEvent(locale, key) {
  const t = (EVENT_TEXT[locale] && EVENT_TEXT[locale][key]) || EVENT_TEXT.en[key] || { title: 'Reminder', body: '' }
  return { title: t.title, body: t.body }
}

// Subscription lifecycle: expire after this much inactivity; warn a week before.
const EXPIRE_DAYS = 90
const WARN_DAYS = 7
const expiryFrom = (from) => new Date(from.getTime() + EXPIRE_DAYS * 86400000)
const WARN = {
  en: { title: 'Prayer alerts pausing soon', body: 'Open Built in Saudi to keep them running.' },
  ar: { title: 'ستتوقف تنبيهات الصلاة قريبًا', body: 'افتح «بُنِيَ في السعودية» لإبقائها مفعّلة.' },
}

/** Next enabled alert strictly after `from`: adhan (optionally X min early) and,
 *  if iqamaAlert, the iqama. Returns the earliest as { name, notifyAt, kind }. */
function computeNext(lat, lng, prefs, from) {
  const params = adhan.CalculationMethod.UmmAlQura()
  const coords = new adhan.Coordinates(lat, lng)
  const beforeMs = Number(prefs.minutesBefore ?? 0) * 60000
  const iqamaAlert = !!prefs.iqamaAlert
  // `prayers` is authoritative: an explicit [] means no prayer alerts (e.g. an
  // adhkār-only subscription); a missing field falls back to all (legacy docs).
  const enabled = new Set(Array.isArray(prefs.prayers) ? prefs.prayers : ALL_PRAYERS)
  let best = null
  const consider = (name, notifyAt, kind) => {
    if (notifyAt > from && (!best || notifyAt < best.notifyAt)) best = { name, notifyAt, kind }
  }
  for (let d = 0; d < 2; d++) {
    const date = new Date(from.getTime() + d * 86400000)
    const pt = new adhan.PrayerTimes(coords, date, params)
    for (const name of ALL_PRAYERS) {
      if (!enabled.has(name)) continue
      const adhanAt = pt[name]
      consider(name, new Date(adhanAt.getTime() - beforeMs), 'adhan')
      if (iqamaAlert) consider(name, new Date(adhanAt.getTime() + IQAMA_MIN[name] * 60000), 'iqama')
    }
    // Non-prayer reminders — independent of the enabled-prayers set.
    if (prefs.morningAdhkar) consider('morningAdhkar', pt.sunrise, 'event')
    if (prefs.eveningAdhkar) consider('eveningAdhkar', new Date(pt.maghrib.getTime() + EVENING_ADHKAR_AFTER_MAGHRIB_MIN * 60000), 'event')
    if (prefs.duha) consider('duha', new Date(pt.sunrise.getTime() + DUHA_AFTER_SUNRISE_MIN * 60000), 'event')
  }
  return best
}

function docId(endpoint) {
  return Buffer.from(endpoint).toString('base64url').slice(0, 300)
}

function cors(req, res) {
  const origin = (req.headers && req.headers.origin) || ''
  // Allow the apex and any built-in-saudi.com subdomain (e.g. www.).
  const allowed = /^https:\/\/([a-z0-9-]+\.)?built-in-saudi\.com$/.test(origin) ? origin : ORIGIN
  res.set('Access-Control-Allow-Origin', allowed)
  res.set('Vary', 'Origin')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}

// POST { subscription, lat, lng, tz, locale, prefs } → saves/updates a subscription.
http('subscribe', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { subscription, lat, lng, tz, place, locale, prefs } = req.body || {}
    if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'missing subscription' })
    // Merge prefs into any existing subscription so the Prayer Times and Adhkar
    // tools can each update just the toggles they own without clobbering the
    // other's. A field is only changed when the caller explicitly sends it.
    const ref = db.collection(COL).doc(docId(subscription.endpoint))
    const existing = (await ref.get()).data() || {}
    const prev = existing.prefs || {}
    const has = (k) => prefs && Object.prototype.hasOwnProperty.call(prefs, k)
    const p = {
      minutesBefore: has('minutesBefore') ? Number(prefs.minutesBefore) : Number(prev.minutesBefore ?? 0),
      iqamaAlert: has('iqamaAlert') ? !!prefs.iqamaAlert : !!prev.iqamaAlert,
      // Explicit [] = no prayer alerts (adhkār-only sub). New subs default to none.
      prayers: has('prayers')
        ? (Array.isArray(prefs.prayers) ? prefs.prayers : [])
        : (Array.isArray(prev.prayers) ? prev.prayers : []),
      morningAdhkar: has('morningAdhkar') ? !!prefs.morningAdhkar : !!prev.morningAdhkar,
      eveningAdhkar: has('eveningAdhkar') ? !!prefs.eveningAdhkar : !!prev.eveningAdhkar,
      duha: has('duha') ? !!prefs.duha : !!prev.duha,
    }
    const now = new Date()
    const latN = Number(lat), lngN = Number(lng)
    const useLat = Number.isFinite(latN) ? latN : existing.lat
    const useLng = Number.isFinite(lngN) ? lngN : existing.lng
    const useTz = tz || existing.tz || 'Asia/Riyadh'
    const usePlace = typeof place === 'string' && place.trim() ? place.trim().slice(0, 60) : (existing.place ?? null)
    const lc = locale === 'ar' ? 'ar' : locale === 'en' ? 'en' : (existing.locale || 'en')
    const next = computeNext(useLat, useLng, p, now)
    await ref.set({
      subscription,
      lat: useLat, lng: useLng, tz: useTz, place: usePlace, locale: lc,
      prefs: p,
      enabled: true,
      nextNotifyAt: next ? next.notifyAt : null,
      nextPrayer: next ? next.name : null,
      nextKind: next ? next.kind : null,
      lastActiveAt: now,
      expiresAt: expiryFrom(now),
      expiryWarned: false,
      updatedAt: now,
    })
    // Immediate confirmation push so the user sees it worked right away.
    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: lc === 'ar' ? 'تم تفعيل التنبيهات' : 'Alerts on',
        body: lc === 'ar' ? 'سنرسل تذكيراتك في وقتها بإذن الله.' : 'We’ll send your reminders at the right time.',
        tag: 'prayer', url: `${ORIGIN}/${lc}/tools/prayer-times`,
      }))
    } catch (e) { /* non-fatal — subscription still saved */ }
    res.json({ ok: true, next: next ? { prayer: next.name, at: next.notifyAt } : null })
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) })
  }
})

// POST { endpoint } → removes a subscription.
http('unsubscribe', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const endpoint = req.body && req.body.endpoint
    if (!endpoint) return res.status(400).json({ error: 'missing endpoint' })
    await db.collection(COL).doc(docId(endpoint)).delete()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) })
  }
})

// POST { endpoint } → keep-alive. Called when the app opens, a push is received,
// or a notification is tapped. Renews the 90-day inactivity window.
http('touch', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const endpoint = req.body && req.body.endpoint
    if (!endpoint) return res.status(400).json({ error: 'missing endpoint' })
    const ref = db.collection(COL).doc(docId(endpoint))
    const snap = await ref.get()
    if (!snap.exists) return res.json({ ok: false, notFound: true })
    const now = new Date()
    await ref.update({ lastActiveAt: now, expiresAt: expiryFrom(now), expiryWarned: false })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) })
  }
})

// Scheduled sender: Cloud Scheduler hits this (with ?secret=...) every minute.
http('sendDue', async (req, res) => {
  if ((req.query.secret || '') !== (process.env.SENDER_SECRET || 'x')) return res.status(403).send('nope')
  const now = new Date()
  const snap = await db.collection(COL).where('nextNotifyAt', '<=', now).limit(500).get()
  let sent = 0, removed = 0
  for (const doc of snap.docs) {
    const s = doc.data()
    if (s.enabled === false || !s.nextPrayer) { continue }
    const nowMs = now.getTime()
    const expMs = s.expiresAt && typeof s.expiresAt.toMillis === 'function' ? s.expiresAt.toMillis() : null
    // Expired through inactivity → delete and skip.
    if (expMs && nowMs >= expMs) { await doc.ref.delete(); removed++; continue }

    const locale = s.locale === 'ar' ? 'ar' : 'en'
    const isEvent = s.nextKind === 'event'
    let title, body, tag, tool
    if (isEvent) {
      ({ title, body } = composeEvent(locale, s.nextPrayer))
      tag = EVENT_TAG[s.nextPrayer] || 'bis'
      tool = EVENT_TOOL[s.nextPrayer] || 'prayer-times'
    } else {
      const prayer = NAMES[locale][s.nextPrayer] || s.nextPrayer
      const kind = s.nextKind === 'iqama' ? 'iqama' : 'adhan'
      const mins = Number((s.prefs && s.prefs.minutesBefore) ?? 0)
      ;({ title, body } = compose(locale, prayer, kind, mins, s.place))
      tag = 'prayer'; tool = 'prayer-times'
    }
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify({
        title, body, tag,
        url: `${ORIGIN}/${locale}/tools/${tool}`,
      }))
      sent++
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await doc.ref.delete(); removed++; continue
      }
      console.error('push failed:', (err && err.statusCode) || '', String((err && (err.body || err.message)) || err).slice(0, 200))
    }
    // One-time warning ~7 days before expiry.
    if (expMs && !s.expiryWarned && nowMs >= expMs - WARN_DAYS * 86400000) {
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify({
          title: WARN[locale].title, body: WARN[locale].body, tag: 'prayer-expiry',
          url: `${ORIGIN}/${locale}/tools/prayer-times`,
        }))
      } catch (e) { /* ignore */ }
      await doc.ref.update({ expiryWarned: true })
    }
    const next = computeNext(s.lat, s.lng, s.prefs || {}, new Date(nowMs + 60000))
    await doc.ref.update({
      nextNotifyAt: next ? next.notifyAt : null,
      nextPrayer: next ? next.name : null,
      nextKind: next ? next.kind : null,
    })
  }
  console.log(`sendDue checked=${snap.size} sent=${sent} removed=${removed}`)
  res.json({ ok: true, checked: snap.size, sent, removed })
})

// GET ?secret=… → snapshot of subscriptions for debugging (no PII beyond a
// truncated endpoint). Lets us diagnose alert delivery without the user.
http('debug', async (req, res) => {
  if ((req.query.secret || '') !== (process.env.SENDER_SECRET || 'x')) return res.status(403).send('nope')
  const snap = await db.collection(COL).limit(50).get()
  const now = Date.now()
  const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null)
  const subs = snap.docs.map((d) => {
    const s = d.data()
    return {
      endpoint: String((s.subscription && s.subscription.endpoint) || '').slice(0, 70),
      locale: s.locale, prefs: s.prefs, nextPrayer: s.nextPrayer, nextKind: s.nextKind,
      nextNotifyAt: ms(s.nextNotifyAt) ? new Date(ms(s.nextNotifyAt)).toISOString() : null,
      dueInMin: ms(s.nextNotifyAt) ? Math.round((ms(s.nextNotifyAt) - now) / 60000) : null,
      expiresInDays: ms(s.expiresAt) ? Math.round((ms(s.expiresAt) - now) / 86400000) : null,
    }
  })
  res.json({ count: snap.size, now: new Date().toISOString(), subs })
})
