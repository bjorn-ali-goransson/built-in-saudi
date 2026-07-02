import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Coordinates, CalculationMethod, PrayerTimes, Prayer } from 'adhan'
import { useLocale } from '../../i18n'
import { BellIcon } from '../../components/icons'
import { pushSupported, currentSubscription, enablePush, disablePush } from '../../lib/push'
import { alertsHelp } from './alertsHelp'
import { CITIES, DEFAULT_CITY } from './cities'

type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
const PRAYER_ORDER: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

const STR = {
  en: {
    location: 'Location', useMyLocation: 'Use my location', myLocation: 'My location',
    prayerTimes: 'Prayer times', method: 'Umm al-Qura method',
    next: 'Next prayer', inTime: (h: number, m: number) => `in ${h}h ${m}m`,
    calcFor: 'Calculated for', locating: 'Finding your location…',
    today: 'Today', converter: 'Date converter',
    gregorian: 'Gregorian date', hijri: 'Hijri date',
    day: 'Day', month: 'Month', year: 'Year',
    prevDay: 'Previous day', nextDay: 'Next day',
    inDays: (n: number) => `in ${n} ${n === 1 ? 'day' : 'days'}`,
    daysAgo: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} ago`,
    inMonths: (n: number) => `in ${n} ${n === 1 ? 'month' : 'months'}`,
    monthsAgo: (n: number) => `${n} ${n === 1 ? 'month' : 'months'} ago`,
    inHours: (n: number) => `in ${n} ${n === 1 ? 'hour' : 'hours'}`,
    hoursAgo: (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'} ago`,
    soon: 'now', hijriYear: 'Hijri year', prevYear: 'Previous year', nextYear: 'Next year', thisYear: 'This year',
    upcoming: 'Islamic dates',
    privacy: 'Computed locally — your location is never uploaded.',
    geoError: 'Couldn’t get your location — please pick a city instead.',
    enableAlerts: 'Enable alerts', alertsOn: 'Alerts on', close: 'Close',
    alertsFailed: 'We couldn’t turn on alerts just yet', alertsFixHint: 'Try this:',
    notifyNote: 'We’ll store your location to send alerts. Turn off anytime.',
    prayers: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  },
  ar: {
    location: 'الموقع', useMyLocation: 'استخدم موقعي', myLocation: 'موقعي',
    prayerTimes: 'مواقيت الصلاة', method: 'طريقة أم القرى',
    next: 'الصلاة التالية', inTime: (h: number, m: number) => `بعد ${h} س ${m} د`,
    calcFor: 'محسوبة ليوم', locating: 'جارٍ تحديد موقعك…',
    today: 'اليوم', converter: 'محوّل التاريخ',
    gregorian: 'التاريخ الميلادي', hijri: 'التاريخ الهجري',
    day: 'اليوم', month: 'الشهر', year: 'السنة',
    prevDay: 'اليوم السابق', nextDay: 'اليوم التالي',
    inDays: (n: number) => `بعد ${n} يوم`,
    daysAgo: (n: number) => `قبل ${n} يوم`,
    inMonths: (n: number) => `بعد ${n} شهر`,
    monthsAgo: (n: number) => `قبل ${n} شهر`,
    inHours: (n: number) => `بعد ${n} ساعة`,
    hoursAgo: (n: number) => `قبل ${n} ساعة`,
    soon: 'الآن', hijriYear: 'السنة الهجرية', prevYear: 'السنة السابقة', nextYear: 'السنة التالية', thisYear: 'هذه السنة',
    upcoming: 'المناسبات الإسلامية',
    privacy: 'يُحسب محليًا — لا يُرفع موقعك أبدًا.',
    geoError: 'تعذّر تحديد موقعك — يرجى اختيار مدينة بدلاً من ذلك.',
    enableAlerts: 'تفعيل التنبيهات', alertsOn: 'التنبيهات مفعّلة', close: 'إغلاق',
    alertsFailed: 'تعذّر تفعيل التنبيهات حتى الآن', alertsFixHint: 'جرّب هذا:',
    notifyNote: 'سنحفظ موقعك لإرسال التنبيهات. يمكنك الإيقاف في أي وقت.',
    prayers: { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
  },
}

interface Loc { lat: number; lng: number; tz: string; label: string }

// Remember the chosen location across visits.
const LOC_KEY = 'bis-prayer-loc'
type SavedLoc = { mode: 'city'; cityId: string } | { mode: 'geo'; lat: number; lng: number; tz: string }
function saveLoc(v: SavedLoc) { try { localStorage.setItem(LOC_KEY, JSON.stringify(v)) } catch { /* ignore */ } }
function readLoc(): SavedLoc | null {
  try { const r = localStorage.getItem(LOC_KEY); return r ? (JSON.parse(r) as SavedLoc) : null } catch { return null }
}

export default function PrayerTimesTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const intlLoc = locale === 'ar' ? 'ar-SA' : 'en-US'

  const [loc, setLoc] = useState<Loc>({
    lat: DEFAULT_CITY.lat, lng: DEFAULT_CITY.lng, tz: DEFAULT_CITY.tz,
    label: locale === 'ar' ? DEFAULT_CITY.ar : DEFAULT_CITY.en,
  })
  const [cityId, setCityId] = useState<string>(DEFAULT_CITY.id)
  const [geoError, setGeoError] = useState('')
  const [locating, setLocating] = useState(false)
  const [pushOn, setPushOn] = useState<boolean | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpDetail, setHelpDetail] = useState('')
  const [pushBusy, setPushBusy] = useState(false)
  const [showLocPicker, setShowLocPicker] = useState(false)
  const [now, setNow] = useState(() => new Date())

  // Refresh "now" every 30s (not every second) for the countdown, and also when
  // the tab becomes visible again — laptops/phones pause timers while asleep, so
  // this recovers the correct time (and recalculates if the day rolled over).
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = window.setInterval(tick, 30000)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  // Restore the remembered location; otherwise auto-request it once (and save it).
  useEffect(() => {
    const saved = readLoc()
    if (saved) {
      if (saved.mode === 'city') {
        const c = CITIES.find((x) => x.id === saved.cityId)
        if (c) { setCityId(c.id); setLoc({ lat: c.lat, lng: c.lng, tz: c.tz, label: locale === 'ar' ? c.ar : c.en }); return }
      } else {
        setCityId('')
        setLoc({ lat: saved.lat, lng: saved.lng, tz: saved.tz, label: STR[locale].myLocation })
        return
      }
    }
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        setCityId('')
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, tz, label: STR[locale].myLocation })
        saveLoc({ mode: 'geo', lat: pos.coords.latitude, lng: pos.coords.longitude, tz })
        setLocating(false)
      },
      () => setLocating(false), // keep the default city silently
      { timeout: 10000 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLoc, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: loc.tz }),
    [intlLoc, loc.tz],
  )

  const dayKey = now.toDateString()
  const prayerTimes = useMemo(() => {
    const params = CalculationMethod.UmmAlQura()
    return new PrayerTimes(new Coordinates(loc.lat, loc.lng), new Date(), params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.lat, loc.lng, dayKey])

  const times: Record<PrayerKey, Date> = {
    fajr: prayerTimes.fajr, sunrise: prayerTimes.sunrise, dhuhr: prayerTimes.dhuhr,
    asr: prayerTimes.asr, maghrib: prayerTimes.maghrib, isha: prayerTimes.isha,
  }

  // Next prayer + countdown.
  const nextInfo = useMemo(() => {
    const np = prayerTimes.nextPrayer(now)
    if (np === Prayer.None) {
      const tomorrow = new PrayerTimes(
        new Coordinates(loc.lat, loc.lng),
        new Date(now.getTime() + 86400000),
        CalculationMethod.UmmAlQura(),
      )
      return { key: 'fajr' as PrayerKey, time: tomorrow.fajr }
    }
    return { key: np as PrayerKey, time: prayerTimes.timeForPrayer(np)! }
  }, [prayerTimes, now, loc.lat, loc.lng])

  const countdown = useMemo(() => {
    const diff = Math.max(0, nextInfo.time.getTime() - now.getTime())
    return { h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000) }
  }, [nextInfo, now])

  function pickCity(id: string) {
    const c = CITIES.find((x) => x.id === id)
    if (!c) return
    setCityId(id)
    setGeoError('')
    setLoc({ lat: c.lat, lng: c.lng, tz: c.tz, label: locale === 'ar' ? c.ar : c.en })
    saveLoc({ mode: 'city', cityId: id })
  }

  // Reflect whether push is already subscribed on this device.
  useEffect(() => { currentSubscription().then((sub) => setPushOn(!!sub)) }, [])

  async function togglePush() {
    if (!pushSupported()) { setHelpDetail('push not supported'); setHelpOpen(true); return }
    setPushBusy(true)
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
      } else {
        const r = await enablePush(
          { lat: loc.lat, lng: loc.lng, tz: loc.tz }, locale,
          { minutesBefore: 10, prayers: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] },
        )
        if (r.status === 'ok') setPushOn(true)
        else { setHelpDetail(r.detail || ''); setHelpOpen(true) } // blocked/unsupported/error → how-to + reason
      }
    } finally { setPushBusy(false) }
  }

  function useMyLocation() {
    setGeoError('')
    if (!navigator.geolocation) { setGeoError(s.geoError); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        setCityId('')
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, tz, label: s.myLocation })
        saveLoc({ mode: 'geo', lat: pos.coords.latitude, lng: pos.coords.longitude, tz })
        setLocating(false)
      },
      () => { setGeoError(s.geoError); setLocating(false) },
      { timeout: 10000 },
    )
  }

  return (
    <div className="pray">
      {/* Big next-prayer hero */}
      <section className="pray__hero" data-testid="next-prayer">
        <span className="pray__hero-label">{s.next}</span>
        <span className="pray__hero-name">{s.prayers[nextInfo.key]}</span>
        <span className="pray__hero-time">{timeFmt.format(nextInfo.time)}</span>
        <span className="pray__hero-count">{s.inTime(countdown.h, countdown.m)}</span>
        <button className={`pray__hero-alerts ${pushOn ? 'is-on' : ''}`} data-testid="pray-notify"
          disabled={pushBusy} aria-pressed={!!pushOn} onClick={togglePush}>
          <BellIcon /> {pushOn ? s.alertsOn : s.enableAlerts}
        </button>
      </section>

      {/* Location — a chip that reveals the picker only when tapped */}
      {!showLocPicker ? (
        <button className="pray__loc-chip" data-testid="loc-chip" onClick={() => setShowLocPicker(true)}>
          <svg className="pray__loc-pin" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2c-4 0-7 3-7 7 0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="9" r="2.4" fill="currentColor" stroke="none" />
          </svg>
          <span className="pray__loc-name">{loc.label}</span>
          <span className="pray__loc-caret" aria-hidden="true">▾</span>
        </button>
      ) : (
        <div className="pray__loc">
          <select className="input" value={cityId} autoFocus
            onChange={(e) => { pickCity(e.target.value); setShowLocPicker(false) }}>
            {cityId === '' && <option value="">{s.myLocation}</option>}
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>{locale === 'ar' ? c.ar : c.en}</option>
            ))}
          </select>
          <button className="btn" onClick={() => { useMyLocation(); setShowLocPicker(false) }}>{s.useMyLocation}</button>
        </div>
      )}
      {geoError && <p className="pray__geoerr">{geoError}</p>}
      {pushOn && <p className="pray__notify-note">{s.notifyNote}</p>}

      {/* Prayer times — flush, no card/well (nativization) */}
      {locating && <p className="pray__locating" data-testid="pray-locating">{s.locating}</p>}
      <ul className={`pray__times ${locating ? 'is-locating' : ''}`}>
        {PRAYER_ORDER.map((k) => {
          const isNext = k === nextInfo.key
          return (
            <li key={k} className={`pray__row ${isNext ? 'is-next' : ''}`}>
              <span className="pray__name">{s.prayers[k]}</span>
              <span className="pray__time">{timeFmt.format(times[k])}</span>
              {isNext && (
                <span className="pray__next">{s.next} · {s.inTime(countdown.h, countdown.m)}</span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="pray__method-note">{s.method}</p>

      <p className="qr__privacy"><span aria-hidden="true">🔒</span> {s.privacy}</p>

      {helpOpen && (
        <AlertsHelpDialog failedMsg={s.alertsFailed} help={alertsHelp(locale)} detail={helpDetail}
          closeLabel={s.close} onClose={() => setHelpOpen(false)} />
      )}
    </div>
  )
}

function AlertsHelpDialog({ failedMsg, help, detail, closeLabel, onClose }: {
  failedMsg: string; help: { title: string; steps: string[] }; detail?: string; closeLabel: string; onClose: () => void
}) {
  // Portal to <body> so no transformed/animated ancestor can hijack the fixed
  // overlay's containing block — guarantees it centers on the viewport.
  return createPortal(
    <div className="pray__help-overlay" role="dialog" aria-modal="true" data-testid="alerts-help" onClick={onClose}>
      <div className="pray__help" onClick={(e) => e.stopPropagation()}>
        <h3 className="pray__help-title">{failedMsg}</h3>
        {detail && <p className="pray__help-detail" data-testid="alerts-help-detail">{detail}</p>}
        <p className="pray__help-sub">{help.title}</p>
        <ol className="pray__help-steps">
          {help.steps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
        <button className="btn btn--primary" data-testid="alerts-help-close" onClick={onClose}>{closeLabel}</button>
      </div>
    </div>,
    document.body,
  )
}

