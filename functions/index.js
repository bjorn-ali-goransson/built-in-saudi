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
  en: (p, m) => `${p} is in about ${m} min`,
  ar: (p, m) => `${p} بعد حوالي ${m} دقيقة`,
}

/** Next enabled prayer notification strictly after `from`, using Umm al-Qura. */
function computeNext(lat, lng, prefs, from) {
  const params = adhan.CalculationMethod.UmmAlQura()
  const coords = new adhan.Coordinates(lat, lng)
  const minutesBefore = Number(prefs.minutesBefore ?? 10)
  const beforeMs = minutesBefore * 60000
  const enabled = new Set(prefs.prayers && prefs.prayers.length ? prefs.prayers : ALL_PRAYERS)
  for (let d = 0; d < 2; d++) {
    const date = new Date(from.getTime() + d * 86400000)
    const pt = new adhan.PrayerTimes(coords, date, params)
    for (const name of ALL_PRAYERS) {
      if (!enabled.has(name)) continue
      const prayerAt = pt[name]
      const notifyAt = new Date(prayerAt.getTime() - beforeMs)
      if (notifyAt > from) return { name, notifyAt, prayerAt, minutesBefore }
    }
  }
  return null
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
    const p = { minutesBefore: Number((prefs && prefs.minutesBefore) ?? 10), prayers: (prefs && prefs.prayers) || ALL_PRAYERS }
    const next = computeNext(Number(lat), Number(lng), p, new Date())
    await db.collection(COL).doc(docId(subscription.endpoint)).set({
      subscription,
      lat: Number(lat), lng: Number(lng),
      tz: tz || 'Asia/Riyadh',
      locale: locale === 'ar' ? 'ar' : 'en',
      prefs: p,
      enabled: true,
      nextNotifyAt: next ? next.notifyAt : null,
      nextPrayer: next ? next.name : null,
      updatedAt: new Date(),
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

// Scheduled sender: Cloud Scheduler hits this (with ?secret=...) every minute.
http('sendDue', async (req, res) => {
  if ((req.query.secret || '') !== (process.env.SENDER_SECRET || 'x')) return res.status(403).send('nope')
  const now = new Date()
  const snap = await db.collection(COL).where('nextNotifyAt', '<=', now).limit(500).get()
  let sent = 0, removed = 0
  for (const doc of snap.docs) {
    const s = doc.data()
    if (s.enabled === false || !s.nextPrayer) { continue }
    const locale = s.locale === 'ar' ? 'ar' : 'en'
    const prayer = NAMES[locale][s.nextPrayer] || s.nextPrayer
    const mins = Number((s.prefs && s.prefs.minutesBefore) ?? 10)
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify({
        title: prayer,
        body: BODY[locale](prayer, mins),
        tag: 'prayer',
        url: `${ORIGIN}/${locale}/tools/prayer-times`,
      }))
      sent++
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await doc.ref.delete(); removed++; continue
      }
    }
    const next = computeNext(s.lat, s.lng, s.prefs || {}, new Date(now.getTime() + 60000))
    await doc.ref.update({ nextNotifyAt: next ? next.notifyAt : null, nextPrayer: next ? next.name : null })
  }
  res.json({ ok: true, checked: snap.size, sent, removed })
})
