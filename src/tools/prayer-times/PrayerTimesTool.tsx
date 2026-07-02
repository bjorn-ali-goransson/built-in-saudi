import { useEffect, useMemo, useState } from 'react'
import { Coordinates, CalculationMethod, PrayerTimes, Prayer } from 'adhan'
import { useLocale } from '../../i18n'
import { BellIcon } from '../../components/icons'
import { pushSupported, currentSubscription, enablePush, disablePush } from '../../lib/push'
import { alertsHelp } from './alertsHelp'
import { CITIES, DEFAULT_CITY } from './cities'
import {
  gregorianToHijri, hijriToGregorian, formatHijri, eventsForHijriYear,
  HIJRI_MONTHS, type IslamicEventKey,
} from './islamic'

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
    notifyNote: 'We’ll store your location to send alerts. Turn off anytime.',
    prayers: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
    events: {
      ramadan: 'Ramadan', eidFitr: 'Eid al-Fitr', eidAdha: 'Eid al-Adha',
      arafah: 'Day of Arafah', newYear: 'Islamic New Year', ashura: 'Day of Ashura',
    } as Record<IslamicEventKey, string>,
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
    notifyNote: 'سنحفظ موقعك لإرسال التنبيهات. يمكنك الإيقاف في أي وقت.',
    prayers: { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
    events: {
      ramadan: 'رمضان', eidFitr: 'عيد الفطر', eidAdha: 'عيد الأضحى',
      arafah: 'يوم عرفة', newYear: 'رأس السنة الهجرية', ashura: 'عاشوراء',
    } as Record<IslamicEventKey, string>,
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
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLoc, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    [intlLoc],
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
    if (!pushSupported()) { setHelpOpen(true); return }
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
        if (r === 'ok') setPushOn(true)
        else setHelpOpen(true) // blocked / unsupported → show how-to help
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

  const hijriToday = formatHijri(now, locale)
  const [hijriYear, setHijriYear] = useState(() => gregorianToHijri(new Date()).y)
  const events = useMemo(() => eventsForHijriYear(hijriYear), [hijriYear])

  const relTime = (target: Date): string => {
    const diff = target.getTime() - now.getTime()
    const absDays = Math.round(Math.abs(diff) / 86400000)
    const future = diff >= 0
    if (absDays === 0) {
      const hrs = Math.round(Math.abs(diff) / 3600000)
      return hrs === 0 ? s.soon : future ? s.inHours(hrs) : s.hoursAgo(hrs)
    }
    if (absDays >= 60) {
      const months = Math.round(absDays / 30.44)
      return future ? s.inMonths(months) : s.monthsAgo(months)
    }
    return future ? s.inDays(absDays) : s.daysAgo(absDays)
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

      {/* Today */}
      <section className="pray__today">
        <span className="pray__today-hijri">{hijriToday}</span>
        <span className="pray__today-greg">{dateFmt.format(now)}</span>
      </section>

      {/* Converter + upcoming */}
      <div className="pray__grid">
        <Converter locale={locale} s={s} dateFmt={dateFmt} />

        <section className="pray__card">
          <div className="pray__card-head">
            <h2>{s.upcoming}</h2>
            <div className="pray__year" role="group" aria-label={s.hijriYear}>
              <button className="btn" aria-label={s.prevYear} data-testid="year-prev"
                onClick={() => setHijriYear((y) => y - 1)}>−</button>
              <span className="pray__year-num" data-testid="year-value">{hijriYear}</span>
              <button className="btn" aria-label={s.nextYear} data-testid="year-next"
                onClick={() => setHijriYear((y) => y + 1)}>+</button>
              <button className="btn" data-testid="year-this"
                onClick={() => setHijriYear(gregorianToHijri(new Date()).y)}>{s.thisYear}</button>
            </div>
          </div>
          <ul className="pray__events" data-testid="events">
            {events.map((ev) => (
              <li key={ev.key} className="pray__event"
                title={`${dateFmt.format(ev.date)} · ${formatHijri(ev.date, locale)}`}>
                <span className="pray__event-name">{s.events[ev.key]}</span>
                <span className="pray__event-date">
                  {dateFmt.format(ev.date)}
                  <span className="pray__event-hijri">{relTime(ev.date)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="qr__privacy"><span aria-hidden="true">🔒</span> {s.privacy}</p>

      {helpOpen && (
        <AlertsHelpDialog help={alertsHelp(locale)} closeLabel={s.close} onClose={() => setHelpOpen(false)} />
      )}
    </div>
  )
}

function AlertsHelpDialog({ help, closeLabel, onClose }: {
  help: { title: string; steps: string[] }; closeLabel: string; onClose: () => void
}) {
  return (
    <div className="pray__help-overlay" role="dialog" aria-modal="true" data-testid="alerts-help" onClick={onClose}>
      <div className="pray__help" onClick={(e) => e.stopPropagation()}>
        <h3 className="pray__help-title">{help.title}</h3>
        <ol className="pray__help-steps">
          {help.steps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
        <button className="btn btn--primary" data-testid="alerts-help-close" onClick={onClose}>{closeLabel}</button>
      </div>
    </div>
  )
}

function Converter({ locale, s, dateFmt }: {
  locale: 'en' | 'ar'
  s: typeof STR['en']
  dateFmt: Intl.DateTimeFormat
}) {
  const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [greg, setGreg] = useState(() => toISO(new Date()))
  const initHijri = gregorianToHijri(new Date())
  const [hy, setHy] = useState(initHijri.y)
  const [hm, setHm] = useState(initHijri.m)
  const [hd, setHd] = useState(initHijri.d)

  const gregAsHijri = useMemo(() => {
    const [y, m, d] = greg.split('-').map(Number)
    if (!y || !m || !d) return ''
    return formatHijri(new Date(y, m - 1, d), locale)
  }, [greg, locale])

  const hijriAsGreg = useMemo(() => dateFmt.format(hijriToGregorian(hy, hm, hd)), [hy, hm, hd, dateFmt])

  const shiftGreg = (delta: number) => {
    const [y, m, d] = greg.split('-').map(Number)
    if (y) setGreg(toISO(new Date(y, m - 1, d + delta)))
  }
  const daysFromToday = useMemo(() => {
    const [y, m, d] = greg.split('-').map(Number)
    if (!y) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000)
  }, [greg])
  const countdown = daysFromToday === null ? ''
    : daysFromToday === 0 ? s.today
      : daysFromToday > 0 ? s.inDays(daysFromToday) : s.daysAgo(-daysFromToday)

  return (
    <section className="pray__card">
      <div className="pray__card-head"><h2>{s.converter}</h2></div>

      <label className="field">
        <span className="field__label">{s.gregorian}</span>
        <input className="input" type="date" value={greg} data-testid="conv-greg"
          onChange={(e) => setGreg(e.target.value)} />
      </label>
      <div className="pray__conv-controls">
        <button className="btn" data-testid="conv-prev-day" aria-label={s.prevDay}
          onClick={() => shiftGreg(-1)}>−</button>
        <button className="btn" data-testid="conv-today" onClick={() => setGreg(toISO(new Date()))}>{s.today}</button>
        <button className="btn" data-testid="conv-next-day" aria-label={s.nextDay}
          onClick={() => shiftGreg(1)}>+</button>
        <span className="pray__countdown" data-testid="conv-countdown">{countdown}</span>
      </div>
      <p className="pray__conv-out" dir={locale === 'ar' ? 'rtl' : 'ltr'} data-testid="conv-hijri-out">{gregAsHijri}</p>

      <div className="pray__hijri-inputs">
        <label className="field">
          <span className="field__label">{s.day}</span>
          <input className="input" type="number" min={1} max={30} value={hd}
            onChange={(e) => setHd(Math.min(30, Math.max(1, Number(e.target.value))))} />
        </label>
        <label className="field pray__month">
          <span className="field__label">{s.month}</span>
          <select className="input" value={hm} onChange={(e) => setHm(Number(e.target.value))}>
            {HIJRI_MONTHS[locale].map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{s.year}</span>
          <input className="input" type="number" min={1} max={2000} value={hy}
            onChange={(e) => setHy(Math.max(1, Number(e.target.value)))} />
        </label>
      </div>
      <p className="pray__conv-out">{hijriAsGreg}</p>
    </section>
  )
}
