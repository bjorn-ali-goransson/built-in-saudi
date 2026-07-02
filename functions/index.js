import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'
import webpush from 'web-push'
import * as adhan from 'adhan'

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
const BODY = {
  en: (p, m) => (m > 0 ? `${p} in ${m} min` : `It’s time for ${p}`),
  ar: (p, m) => (m > 0 ? `${p} بعد ${m} د` : `حان وقت ${p}`),
}
const IQAMA_BODY = {
  en: (p) => `Iqama — ${p}`,
  ar: (p) => `الإقامة — ${p}`,
}
// Iqama (congregation) minutes after the adhan, per common Saudi practice.
const IQAMA_MIN = { fajr: 20, dhuhr: 15, asr: 15, maghrib: 10, isha: 15 }

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
  const enabled = new Set(prefs.prayers && prefs.prayers.length ? prefs.prayers : ALL_PRAYERS)
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
    const { subscription, lat, lng, tz, locale, prefs } = req.body || {}
    if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'missing subscription' })
    const p = {
      minutesBefore: Number((prefs && prefs.minutesBefore) ?? 0),
      iqamaAlert: !!(prefs && prefs.iqamaAlert),
      prayers: (prefs && prefs.prayers) || ALL_PRAYERS,
    }
    const now = new Date()
    const next = computeNext(Number(lat), Number(lng), p, now)
    await db.collection(COL).doc(docId(subscription.endpoint)).set({
      subscription,
      lat: Number(lat), lng: Number(lng),
      tz: tz || 'Asia/Riyadh',
      locale: locale === 'ar' ? 'ar' : 'en',
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
    const lc = locale === 'ar' ? 'ar' : 'en'
    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: lc === 'ar' ? 'تم تفعيل التنبيهات' : 'Prayer alerts on',
        body: lc === 'ar' ? 'سنذكّرك قبل كل صلاة بإذن الله.' : 'We’ll remind you before each prayer.',
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
    const prayer = NAMES[locale][s.nextPrayer] || s.nextPrayer
    const kind = s.nextKind === 'iqama' ? 'iqama' : 'adhan'
    const mins = Number((s.prefs && s.prefs.minutesBefore) ?? 0)
    const body = kind === 'iqama' ? IQAMA_BODY[locale](prayer) : BODY[locale](prayer, mins)
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify({
        title: prayer, body, tag: 'prayer',
        url: `${ORIGIN}/${locale}/tools/prayer-times`,
      }))
      sent++
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await doc.ref.delete(); removed++; continue
      }
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
  res.json({ ok: true, checked: snap.size, sent, removed })
})
