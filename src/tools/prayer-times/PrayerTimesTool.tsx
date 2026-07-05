import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Coordinates, CalculationMethod, PrayerTimes, Prayer } from 'adhan'
import { useLocale } from '../../i18n'
import { BellIcon, CogIcon } from '../../components/icons'
import { Button, Pill, Select, Sheet, SheetTitle, SheetActions } from '../../components/ui'
import { pushSupported, currentSubscription, enablePush, disablePush, touchSubscription } from '../../lib/push'
import { alertsHelp } from './alertsHelp'
import { reverseGeocode } from './geo'
import { CITIES, DEFAULT_CITY } from './cities'

type PrayerKey = 'fajr' | 'sunrise' | 'duha' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

// Iqama (congregation) periods after the adhan, per common Saudi practice.
type IqamaKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
const IQAMA_MIN: Record<IqamaKey, number> = { fajr: 20, dhuhr: 15, asr: 15, maghrib: 10, isha: 15 }
const IQAMA_KEYS: IqamaKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
// The timeline also shows sunrise (shurūq, end of Fajr) and Ḍuḥā (sunrise+20) as
// informational markers — no adhan/iqama, never the "next prayer" highlight.
const TIMELINE_KEYS: PrayerKey[] = ['fajr', 'sunrise', 'duha', 'dhuhr', 'asr', 'maghrib', 'isha']
const DUHA_AFTER_SUNRISE_MIN = 20
const POST_IQAMA_MIN = 15 // keep showing the prayer this long after iqama, then resume "next"

const STR = {
  en: {
    location: 'Location', useMyLocation: 'Use my location', myLocation: 'My location',
    save: 'Save', cancel: 'Cancel', chooseCity: 'Choose a city',
    prayerTimes: 'Prayer times', method: 'Umm al-Qura method',
    next: 'Next prayer', inTime: (h: number, m: number) => (h > 0 ? `in ${h}h ${m}m` : `in ${m}m`),
    timeForPrayer: 'It’s time for prayer',
    iqamaIn: (m: number) => `Iqama in ${m}m`,
    iqamaNow: 'Iqama now', iqamaAfter: (m: number) => `Iqama ${m}m ago`,
    calcFor: 'Calculated for', locating: 'Finding your location…',
    today: 'Today', showMore: 'Show more', showLess: 'Show less', plusDay: '+1 day', choose: 'Choose date', converter: 'Date converter',
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
    privacy: 'Prayer times are computed in your browser.',
    geoError: 'Couldn’t get your location — please pick a city instead.',
    enableAlerts: 'Enable alerts', alertsOn: 'Alerts on', close: 'Close',
    alertSettings: 'Alert settings', turnOff: 'Turn off alerts', done: 'Done',
    iqamaAlertLabel: 'Iqama alert', iqamaAlertHint: 'A second reminder at iqama',
    duhaLabel: 'Ḍuḥā prayer', duhaHint: 'Remind me when Ḍuḥā begins (after sunrise)',
    beforeLabel: 'Alert before', atAdhan: 'At adhan', minShort: (m: number) => `${m} min`,
    alertsFailed: 'We couldn’t turn on alerts just yet', alertsFixHint: 'Try this:',
    notifyNote: 'We’ll store your location to send alerts. Turn off anytime.',
    prayers: { fajr: 'Fajr', sunrise: 'Sunrise', duha: 'Ḍuḥā', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  },
  ar: {
    location: 'الموقع', useMyLocation: 'استخدم موقعي', myLocation: 'موقعي',
    save: 'حفظ', cancel: 'إلغاء', chooseCity: 'اختر مدينة',
    prayerTimes: 'مواقيت الصلاة', method: 'طريقة أم القرى',
    next: 'الصلاة التالية', inTime: (h: number, m: number) => (h > 0 ? `بعد ${h}س ${m}د` : `بعد ${m}د`),
    timeForPrayer: 'حان وقت الصلاة',
    iqamaIn: (m: number) => `الإقامة بعد ${m}د`,
    iqamaNow: 'حان وقت الإقامة', iqamaAfter: (m: number) => `الإقامة قبل ${m}د`,
    calcFor: 'محسوبة ليوم', locating: 'جارٍ تحديد موقعك…',
    today: 'اليوم', showMore: 'عرض المزيد', showLess: 'عرض أقل', plusDay: '+يوم', choose: 'اختر تاريخًا', converter: 'محوّل التاريخ',
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
    privacy: 'تُحسب مواقيت الصلاة داخل متصفحك.',
    geoError: 'تعذّر تحديد موقعك — يرجى اختيار مدينة بدلاً من ذلك.',
    enableAlerts: 'تفعيل التنبيهات', alertsOn: 'التنبيهات مفعّلة', close: 'إغلاق',
    alertSettings: 'إعدادات التنبيه', turnOff: 'إيقاف التنبيهات', done: 'تم',
    iqamaAlertLabel: 'تنبيه الإقامة', iqamaAlertHint: 'تذكير ثانٍ عند الإقامة',
    duhaLabel: 'صلاة الضحى', duhaHint: 'ذكّرني عند دخول وقت الضحى (بعد الشروق)',
    beforeLabel: 'التنبيه قبل', atAdhan: 'عند الأذان', minShort: (m: number) => `${m} د`,
    alertsFailed: 'تعذّر تفعيل التنبيهات حتى الآن', alertsFixHint: 'جرّب هذا:',
    notifyNote: 'سنحفظ موقعك لإرسال التنبيهات. يمكنك الإيقاف في أي وقت.',
    prayers: { fajr: 'الفجر', sunrise: 'الشروق', duha: 'الضحى', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
  },
}

interface Loc { lat: number; lng: number; tz: string; label: string }

// Remember the chosen location across visits.
const LOC_KEY = 'bis-prayer-loc'

// City name for the push body ("…لمدينة الرياض"): first segment of the localized
// "City, Country" label, unless it's still the "my location" placeholder.
const cityOf = (label: string, placeholder: string): string | undefined =>
  label && label !== placeholder ? label.split(/[،,]/)[0].trim() : undefined
type SavedLoc =
  | { mode: 'city'; cityId: string }
  | { mode: 'geo'; lat: number; lng: number; tz: string; label?: string }
function saveLoc(v: SavedLoc) { try { localStorage.setItem(LOC_KEY, JSON.stringify(v)) } catch { /* ignore */ } }
function readLoc(): SavedLoc | null {
  try { const r = localStorage.getItem(LOC_KEY); return r ? (JSON.parse(r) as SavedLoc) : null } catch { return null }
}

interface AlertPrefs { minutesBefore: number; iqamaAlert: boolean; duha: boolean }
const PREFS_KEY = 'bis-prayer-prefs'
const DAILY = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
function readPrefs(): AlertPrefs {
  try {
    const r = localStorage.getItem(PREFS_KEY)
    if (r) { const p = JSON.parse(r); return { minutesBefore: Number(p.minutesBefore) || 0, iqamaAlert: !!p.iqamaAlert, duha: !!p.duha } }
  } catch { /* ignore */ }
  return { minutesBefore: 0, iqamaAlert: false, duha: false }
}
function savePrefs(p: AlertPrefs) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) } catch { /* ignore */ } }

// Shared hero "pill" chip (was .pray__hero-pill): translucent capsule on the
// green hero, with white 15px icons.
const HERO_PILL =
  'inline-flex items-center gap-[0.4rem] py-[0.38rem] px-[0.85rem] max-w-full rounded-full border '
  + 'border-[color-mix(in_srgb,var(--sand-100)_32%,transparent)] bg-[color-mix(in_srgb,#000_12%,transparent)] '
  + 'text-sand-100 text-[0.82rem] font-semibold cursor-pointer transition-[background,border-color] duration-150 '
  + 'enabled:hover:bg-[color-mix(in_srgb,#000_22%,transparent)] '
  + '[&_svg]:w-[15px] [&_svg]:h-[15px] [&_svg]:flex-none [&_svg]:text-white'

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
  const [pendingCity, setPendingCity] = useState<string>(DEFAULT_CITY.id)
  const [clock24, setClock24] = useState(() => {
    try { return localStorage.getItem('bis-prayer-24h') === '1' } catch { return false }
  })
  const [prefs, setPrefs] = useState<AlertPrefs>(() => readPrefs())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [viewDateStr, setViewDateStr] = useState('') // '' = live (now-centric)
  const [showMore, setShowMore] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)

  function openChoose() {
    const el = dateRef.current
    if (!el) return
    try { if (typeof el.showPicker === 'function') el.showPicker(); else el.focus() } catch { el.focus() }
  }
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
        setLoc({ lat: saved.lat, lng: saved.lng, tz: saved.tz, label: saved.label || STR[locale].myLocation })
        if (!saved.label) resolveGeoLabel(saved.lat, saved.lng, saved.tz)
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
        resolveGeoLabel(pos.coords.latitude, pos.coords.longitude, tz)
        setLocating(false)
      },
      () => setLocating(false), // keep the default city silently
      { timeout: 10000 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLoc, { hour: 'numeric', minute: '2-digit', hour12: !clock24, timeZone: loc.tz }),
    [intlLoc, loc.tz, clock24],
  )
  // Format a time, dropping the space before AM/PM (e.g. "3:20PM").
  const fmtTime = (d: Date) => timeFmt.format(d).replace(/\s/g, '')
  function toggleClock() {
    setClock24((v) => {
      const nv = !v
      try { localStorage.setItem('bis-prayer-24h', nv ? '1' : '0') } catch { /* ignore */ }
      return nv
    })
  }
  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLoc, { weekday: 'long', timeZone: loc.tz }),
    [intlLoc, loc.tz],
  )

  const dayKey = now.toDateString()
  const prayerTimes = useMemo(() => {
    const params = CalculationMethod.UmmAlQura()
    return new PrayerTimes(new Coordinates(loc.lat, loc.lng), new Date(), params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.lat, loc.lng, dayKey])


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

  // Iqama window: from a prayer's adhan until iqama + POST_IQAMA_MIN. Inside it the
  // hero shows "it's time for prayer" with an iqama countdown (negative after iqama).
  const active = useMemo(() => {
    const params = CalculationMethod.UmmAlQura()
    const coords = new Coordinates(loc.lat, loc.lng)
    let best: { key: IqamaKey; adhan: Date; iqama: Date } | null = null
    for (const offset of [-1, 0]) {
      const pt = new PrayerTimes(coords, new Date(now.getTime() + offset * 86400000), params)
      for (const key of IQAMA_KEYS) {
        const adhan = pt[key] as Date
        const end = adhan.getTime() + (IQAMA_MIN[key] + POST_IQAMA_MIN) * 60000
        if (now.getTime() >= adhan.getTime() && now.getTime() < end) {
          if (!best || adhan > best.adhan) best = { key, adhan, iqama: new Date(adhan.getTime() + IQAMA_MIN[key] * 60000) }
        }
      }
    }
    return best
  }, [now, loc.lat, loc.lng])

  const iqamaText = useMemo(() => {
    if (!active) return ''
    const diff = active.iqama.getTime() - now.getTime()
    if (Math.abs(diff) < 60000) return s.iqamaNow
    const mins = Math.floor(Math.abs(diff) / 60000)
    return diff > 0 ? s.iqamaIn(mins) : s.iqamaAfter(mins)
  }, [active, now, s])

  // Circular window: the last-entered prayer, the upcoming one, then 3 more —
  // wrapping across midnight (a day separator marks the new day).
  const isLive = !viewDateStr
  const timeline = useMemo(() => {
    const params = CalculationMethod.UmmAlQura()
    const coords = new Coordinates(loc.lat, loc.lng)
    const base = viewDateStr ? new Date(`${viewDateStr}T12:00:00`) : now
    // Sunrise + Ḍuḥā are only shown while it's actually morning — i.e. the live
    // time is between today's Fajr and Dhuhr. Otherwise just the five prayers.
    const today = new PrayerTimes(coords, now, params)
    const showMarkers = !viewDateStr && now.getTime() >= today.fajr.getTime() && now.getTime() < today.dhuhr.getTime()
    const keys: PrayerKey[] = showMarkers ? TIMELINE_KEYS : IQAMA_KEYS
    const inst: { key: PrayerKey; time: Date }[] = []
    for (const offset of [-1, 0, 1, 2, 3]) {
      const pt = new PrayerTimes(coords, new Date(base.getTime() + offset * 86400000), params)
      for (const key of keys) {
        const time = key === 'duha'
          ? new Date(pt.sunrise.getTime() + DUHA_AFTER_SUNRISE_MIN * 60000)
          : (pt[key] as Date)
        inst.push({ key, time })
      }
    }
    inst.sort((a, b) => a.time.getTime() - b.time.getTime())
    let startIdx = 0
    if (viewDateStr) {
      const vd = new Date(`${viewDateStr}T00:00:00`).getTime()
      const found = inst.findIndex((x) => x.time.getTime() >= vd)
      startIdx = found < 0 ? 0 : found
    } else {
      for (let i = 0; i < inst.length; i++) {
        if (inst[i].time.getTime() <= now.getTime()) startIdx = i; else break
      }
    }
    const base5 = showMarkers ? 7 : 5
    return inst.slice(startIdx, startIdx + (showMore ? base5 * 2 : base5))
  }, [now, loc.lat, loc.lng, viewDateStr, showMore])

  function pickCity(id: string) {
    const c = CITIES.find((x) => x.id === id)
    if (!c) return
    setCityId(id)
    setGeoError('')
    setLoc({ lat: c.lat, lng: c.lng, tz: c.tz, label: locale === 'ar' ? c.ar : c.en })
    saveLoc({ mode: 'city', cityId: id })
  }

  // Reflect subscription state; renew the inactivity window (max once/12h).
  useEffect(() => {
    currentSubscription().then((sub) => {
      setPushOn(!!sub)
      if (!sub) return
      try {
        const last = Number(localStorage.getItem('bis-prayer-touch') || 0)
        if (Date.now() - last > 43200000) {
          localStorage.setItem('bis-prayer-touch', String(Date.now()))
          touchSubscription()
        }
      } catch { touchSubscription() }
    })
  }, [])

  async function enableAlerts() {
    if (!pushSupported()) { setHelpDetail('push not supported'); setHelpOpen(true); return }
    setPushBusy(true)
    try {
      const r = await enablePush(
        { lat: loc.lat, lng: loc.lng, tz: loc.tz, place: await resolvePlace() }, locale,
        { minutesBefore: prefs.minutesBefore, iqamaAlert: prefs.iqamaAlert, duha: prefs.duha, prayers: DAILY },
      )
      if (r.status === 'ok') setPushOn(true)
      else { setHelpDetail(r.detail || ''); setHelpOpen(true) } // blocked/unsupported/error → how-to + reason
    } finally { setPushBusy(false) }
  }

  async function applyPrefs(np: AlertPrefs) {
    setPrefs(np); savePrefs(np)
    setPushBusy(true)
    try {
      await enablePush({ lat: loc.lat, lng: loc.lng, tz: loc.tz, place: await resolvePlace() }, locale,
        { minutesBefore: np.minutesBefore, iqamaAlert: np.iqamaAlert, duha: np.duha, prayers: DAILY })
    } finally { setPushBusy(false) }
  }

  async function disableAlerts() {
    setPushBusy(true)
    try { await disablePush(); setPushOn(false); setSettingsOpen(false) }
    finally { setPushBusy(false) }
  }

  // Resolve a "City, Country" label for granted coordinates (best-effort).
  function resolveGeoLabel(lat: number, lng: number, tz: string) {
    reverseGeocode(lat, lng, locale).then((name) => {
      if (!name) return
      setLoc((prev) => ({ ...prev, label: name }))
      saveLoc({ mode: 'geo', lat, lng, tz, label: name })
    })
  }

  // The city name to put in the push body ("حسب توقيت: <city>"). Prefer the
  // already-resolved label; for a device location whose label hasn't resolved
  // yet, reverse-geocode on demand so we still send a real place, not "توقيتك".
  async function resolvePlace(): Promise<string | undefined> {
    const fromLabel = cityOf(loc.label, STR[locale].myLocation)
    if (fromLabel) return fromLabel
    try {
      const name = await reverseGeocode(loc.lat, loc.lng, locale)
      return name ? name.split(/[،,]/)[0].trim() : undefined
    } catch { return undefined }
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
        resolveGeoLabel(pos.coords.latitude, pos.coords.longitude, tz)
        setLocating(false)
      },
      () => { setGeoError(s.geoError); setLocating(false) },
      { timeout: 10000 },
    )
  }

  return (
    <div className="flex flex-col gap-[1.3rem]">
      {/* Big next-prayer hero */}
      <section
        className="text-center flex flex-col gap-[0.15rem] text-sand-100 rounded-none shadow-[var(--shadow-md)] bg-green-600 mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] py-[1.4rem] max-[560px]:py-[1.1rem] px-4"
        data-testid="next-prayer">
        <span className="text-[0.78rem] uppercase tracking-[0.09em] rtl:tracking-normal opacity-[0.82]">{active ? s.timeForPrayer : s.next}</span>
        <span className="font-display rtl:font-ar text-[clamp(1.9rem,6vw,2.7rem)] max-[560px]:text-[1.8rem] leading-[1.05]">{s.prayers[active ? active.key : nextInfo.key]}</span>
        <span className={`font-display rtl:font-ar text-[clamp(1.5rem,5.5vw,2.1rem)] ${active ? 'text-gold-400 font-bold' : 'font-semibold'}`} data-testid="hero-count">
          {active ? iqamaText : s.inTime(countdown.h, countdown.m)}
        </span>
        <button className="font-mono text-base opacity-[0.72] hover:opacity-[0.85] appearance-none bg-transparent border-none text-inherit cursor-pointer p-0" data-testid="hero-time" onClick={toggleClock}
          title={clock24 ? '12-hour' : '24-hour'} aria-label="Toggle 12 or 24 hour clock">
          {fmtTime(active ? active.adhan : nextInfo.time)}
        </button>
        <div className="flex gap-2 justify-center flex-wrap mt-[0.85rem]">
          <button className={HERO_PILL} data-testid="loc-chip"
            onClick={() => { setPendingCity(cityId); setShowLocPicker(true) }}>
            <LocPin /> <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[42vw]">{loc.label}</span>
            <span className="text-white text-[0.8rem]" aria-hidden="true">▾</span>
          </button>
          <button className={`${HERO_PILL} disabled:opacity-60 disabled:cursor-default ${pushOn ? 'bg-[color-mix(in_srgb,var(--sand-100)_20%,transparent)] border-[color-mix(in_srgb,var(--sand-100)_55%,transparent)]' : ''}`} data-testid="pray-notify"
            disabled={pushBusy} aria-pressed={!!pushOn}
            onClick={() => (pushOn ? setSettingsOpen(true) : enableAlerts())}>
            {pushOn ? <CogIcon /> : <BellIcon />} {pushOn ? s.alertsOn : s.enableAlerts}
          </button>
        </div>
      </section>
      {geoError && <p className="text-[color:var(--danger)] text-[0.9rem]">{geoError}</p>}

      {/* Prayer times — flush, no card/well (nativization) */}
      {locating && <p className="text-[0.85rem] text-ink-faint mb-[0.6rem]" data-testid="pray-locating">{s.locating}</p>}
      <ul className={`list-none p-0 m-0 grid gap-2 ${locating ? 'opacity-[0.55] animate-[pulse_1.2s_ease-in-out_infinite]' : ''}`} data-testid="prayer-list">
        {timeline.map((it, i) => {
          const prev = timeline[i - 1]
          const newDay = prev && it.time.toDateString() !== prev.time.toDateString()
          // Highlight the actual current/next prayer by its time — so the
          // informational sunrise/Ḍuḥā markers are never highlighted.
          const focusMs = active ? active.adhan.getTime() : nextInfo.time.getTime()
          const highlight = isLive && it.time.getTime() === focusMs
          return (
            <Fragment key={i}>
              {newDay && (
                <li className="flex items-center gap-[0.7rem] px-[0.2rem] py-[0.2rem] my-[0.1rem] mx-0 before:content-[''] before:flex-1 before:h-px before:bg-[var(--line-soft)] after:content-[''] after:flex-1 after:h-px after:bg-[var(--line-soft)]" aria-hidden="true"><span className="font-body rtl:font-ar text-[0.68rem] uppercase tracking-[0.08em] rtl:tracking-normal text-ink-faint">{weekdayFmt.format(it.time)}</span></li>
              )}
              <li className={`flex items-center gap-[0.8rem] max-[560px]:gap-[0.6rem] py-[0.7rem] px-[0.9rem] max-[560px]:py-[0.55rem] max-[560px]:px-[0.8rem] rounded-md border ${highlight ? 'bg-[color-mix(in_srgb,var(--green-400)_14%,transparent)] border-[color-mix(in_srgb,var(--green-500)_35%,transparent)]' : 'bg-[color-mix(in_srgb,var(--sand-100)_55%,var(--surface))] border-transparent'}`} data-testid={`prow-${it.key}`}>
                <span className="font-semibold text-[1.05rem] max-[560px]:text-base text-green-700 min-w-[6rem] max-[560px]:min-w-0">{s.prayers[it.key]}</span>
                <span className="font-mono text-[1.05rem] text-ink ms-auto whitespace-nowrap">{fmtTime(it.time)}</span>
                {highlight && !active && (
                  <span className="text-[0.78rem] font-semibold text-green-600 bg-[var(--surface)] border border-[var(--line)] rounded-full py-[0.2rem] px-[0.6rem] whitespace-nowrap max-[560px]:hidden">{s.next} · {s.inTime(countdown.h, countdown.m)}</span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ul>
      <div className="flex flex-col flex-wrap items-center justify-center gap-2 mt-[0.9rem]">
        {!isLive && (
          <span className="font-body rtl:font-ar text-[0.8rem] text-ink-faint me-[0.2rem]" data-testid="pray-viewdate">{weekdayFmt.format(new Date(`${viewDateStr}T12:00:00`))}</span>
        )}
        <Pill data-testid="pray-more" onClick={() => setShowMore((v) => !v)}>{showMore ? s.showLess : s.showMore}</Pill>
        <Pill data-testid="pray-choose" onClick={openChoose}>{s.choose}</Pill>
        {!isLive && <Pill variant="accent" data-testid="pray-today" onClick={() => setViewDateStr('')}>{s.today}</Pill>}
        <input ref={dateRef} type="date" className="absolute w-px h-px opacity-0 pointer-events-none border-0 p-0 m-0" value={viewDateStr} data-testid="pray-date"
          aria-hidden="true" tabIndex={-1} onChange={(e) => setViewDateStr(e.target.value)} />
      </div>
      <p className="text-center text-[0.76rem] text-ink-faint mt-[0.8rem] font-body rtl:font-ar tracking-[0.02em] rtl:tracking-normal">{s.method}</p>

      {helpOpen && (
        <AlertsHelpDialog failedMsg={s.alertsFailed} help={alertsHelp(locale)} detail={helpDetail}
          closeLabel={s.close} onClose={() => setHelpOpen(false)} />
      )}
      {showLocPicker && (
        <LocationSheet
          locale={locale} s={s} pending={pendingCity} onPick={setPendingCity}
          onUseLocation={() => { useMyLocation(); setShowLocPicker(false) }}
          onCancel={() => setShowLocPicker(false)}
          onSave={() => { pickCity(pendingCity); setShowLocPicker(false) }}
        />
      )}
      {settingsOpen && (
        <AlertSettings s={s} prefs={prefs} busy={pushBusy}
          onApply={applyPrefs} onDisable={disableAlerts} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}

function AlertSettings({ s, prefs, busy, onApply, onDisable, onClose }: {
  s: typeof STR['en']; prefs: AlertPrefs; busy: boolean
  onApply: (p: AlertPrefs) => void; onDisable: () => void; onClose: () => void
}) {
  return (
    <Sheet data-testid="alert-settings" onClose={onClose}>
        <SheetTitle>{s.alertSettings}</SheetTitle>

        <div className="flex items-center justify-between gap-4 py-[0.85rem] px-[0.2rem] border-b border-[var(--line-soft)] last-of-type:border-b-0">
          <span>{s.beforeLabel}</span>
          <Select value={prefs.minutesBefore} disabled={busy} data-testid="set-before"
            onChange={(e) => onApply({ ...prefs, minutesBefore: Number(e.target.value) })}>
            <option value={0}>{s.atAdhan}</option>
            <option value={5}>{s.minShort(5)}</option>
            <option value={10}>{s.minShort(10)}</option>
            <option value={15}>{s.minShort(15)}</option>
          </Select>
        </div>

        <label className="flex items-center justify-between gap-4 py-[0.85rem] px-[0.2rem] border-b border-[var(--line-soft)] last-of-type:border-b-0">
          <span className="flex flex-col [&_small]:text-ink-faint [&_small]:text-[0.78rem] [&_small]:mt-[0.1rem]">{s.iqamaAlertLabel}<small>{s.iqamaAlertHint}</small></span>
          <input type="checkbox" className="w-[22px] h-[22px] accent-green-600 flex-none" checked={prefs.iqamaAlert} disabled={busy} data-testid="set-iqama"
            onChange={(e) => onApply({ ...prefs, iqamaAlert: e.target.checked })} />
        </label>

        <label className="flex items-center justify-between gap-4 py-[0.85rem] px-[0.2rem] border-b border-[var(--line-soft)] last-of-type:border-b-0">
          <span className="flex flex-col [&_small]:text-ink-faint [&_small]:text-[0.78rem] [&_small]:mt-[0.1rem]">{s.duhaLabel}<small>{s.duhaHint}</small></span>
          <input type="checkbox" className="w-[22px] h-[22px] accent-green-600 flex-none" checked={prefs.duha} disabled={busy} data-testid="set-duha"
            onChange={(e) => onApply({ ...prefs, duha: e.target.checked })} />
        </label>

        <SheetActions>
          <Button data-testid="set-disable" disabled={busy} onClick={onDisable}>{s.turnOff}</Button>
          <Button variant="primary" data-testid="set-done" onClick={onClose}>{s.done}</Button>
        </SheetActions>
    </Sheet>
  )
}

function LocationSheet({ locale, s, pending, onPick, onUseLocation, onCancel, onSave }: {
  locale: 'en' | 'ar'
  s: typeof STR['en']
  pending: string
  onPick: (id: string) => void
  onUseLocation: () => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <Sheet data-testid="loc-sheet" onClose={onCancel}>
        <SheetTitle>{s.location}</SheetTitle>

        <button className="inline-flex items-center justify-center gap-2 w-full p-3 border border-green-600 rounded-sm bg-[color-mix(in_srgb,var(--green-500)_10%,transparent)] text-green-700 font-semibold cursor-pointer [&_svg]:w-[17px] [&_svg]:h-[17px]" data-testid="loc-geo" onClick={onUseLocation}>
          <LocPin /> {s.useMyLocation}
        </button>

        <p className="font-body text-[0.7rem] uppercase tracking-[0.07em] text-ink-faint mt-[1.1rem] mb-[0.4rem] rtl:font-ar rtl:tracking-normal">{s.chooseCity}</p>
        <ul className="list-none mx-[-0.4rem] p-0 overflow-y-auto flex-1" data-testid="loc-cities">
          {CITIES.map((c) => {
            const selected = pending === c.id
            return (
              <li key={c.id}>
                <button className={`flex items-center justify-between w-full py-3 px-[0.6rem] rounded-sm bg-none border-none text-ink [font:inherit] text-base text-start cursor-pointer hover:bg-sand-100 ${selected ? 'bg-[color-mix(in_srgb,var(--green-500)_12%,transparent)] text-green-700 font-semibold' : ''}`}
                  aria-pressed={selected} onClick={() => onPick(c.id)}>
                  <span>{locale === 'ar' ? c.ar : c.en}</span>
                  {selected && <span className="text-green-600 font-bold" aria-hidden="true">✓</span>}
                </button>
              </li>
            )
          })}
        </ul>

        <SheetActions>
          <Button data-testid="loc-cancel" onClick={onCancel}>{s.cancel}</Button>
          <Button variant="primary" data-testid="loc-save" onClick={onSave}>{s.save}</Button>
        </SheetActions>
    </Sheet>
  )
}

function AlertsHelpDialog({ failedMsg, help, detail, closeLabel, onClose }: {
  failedMsg: string; help: { title: string; steps: string[] }; detail?: string; closeLabel: string; onClose: () => void
}) {
  // Portal to <body> so no transformed/animated ancestor can hijack the fixed
  // overlay's containing block — guarantees it centers on the viewport.
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center p-[1.2rem] bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] animate-[fadeUp_0.15s_ease_both]" role="dialog" aria-modal="true" data-testid="alerts-help" onClick={onClose}>
      <div className="w-[min(420px,100%)] bg-[var(--surface)] border border-[var(--line)] rounded-md shadow-[var(--shadow-lg)] p-[1.4rem]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[1.15rem] font-bold mb-[0.9rem]">{failedMsg}</h3>
        {detail && <p className="m-0 mb-4 font-mono text-[0.74rem] text-ink-faint break-words bg-sand-100 py-2 px-[0.6rem] rounded-sm" data-testid="alerts-help-detail">{detail}</p>}
        <p className="font-semibold mt-[0.2rem] mx-0 mb-[0.6rem] text-ink">{help.title}</p>
        <ol className="m-0 mb-[1.2rem] ps-[1.3rem] flex flex-col gap-2 text-ink-soft text-[0.95rem] leading-normal">
          {help.steps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
        <Button variant="primary" data-testid="alerts-help-close" onClick={onClose}>{closeLabel}</Button>
      </div>
    </div>,
    document.body,
  )
}

function LocPin() {
  return (
    <svg className="w-[16px] h-[16px] text-green-600 flex-none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2c-4 0-7 3-7 7 0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

