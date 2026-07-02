import { useEffect, useMemo, useState } from 'react'
import { Coordinates, CalculationMethod, PrayerTimes, Prayer } from 'adhan'
import { useLocale } from '../../i18n'
import { CITIES, DEFAULT_CITY } from './cities'
import {
  gregorianToHijri, hijriToGregorian, formatHijri, upcomingEvents,
  HIJRI_MONTHS, type IslamicEventKey,
} from './islamic'

type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
const PRAYER_ORDER: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

const STR = {
  en: {
    location: 'Location', useMyLocation: 'Use my location', myLocation: 'My location',
    prayerTimes: 'Prayer times', method: 'Umm al-Qura method',
    next: 'Next', inTime: (h: number, m: number) => `in ${h}h ${m}m`,
    today: 'Today', converter: 'Date converter',
    gregorian: 'Gregorian date', hijri: 'Hijri date',
    day: 'Day', month: 'Month', year: 'Year',
    upcoming: 'Upcoming Islamic dates',
    privacy: 'Computed locally — your location is never uploaded.',
    geoError: 'Couldn’t get your location — please pick a city instead.',
    prayers: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
    events: {
      ramadan: 'Ramadan', eidFitr: 'Eid al-Fitr', eidAdha: 'Eid al-Adha',
      arafah: 'Day of Arafah', newYear: 'Islamic New Year', ashura: 'Day of Ashura',
    } as Record<IslamicEventKey, string>,
  },
  ar: {
    location: 'الموقع', useMyLocation: 'استخدم موقعي', myLocation: 'موقعي',
    prayerTimes: 'مواقيت الصلاة', method: 'طريقة أم القرى',
    next: 'التالية', inTime: (h: number, m: number) => `بعد ${h} س ${m} د`,
    today: 'اليوم', converter: 'محوّل التاريخ',
    gregorian: 'التاريخ الميلادي', hijri: 'التاريخ الهجري',
    day: 'اليوم', month: 'الشهر', year: 'السنة',
    upcoming: 'المناسبات الإسلامية القادمة',
    privacy: 'يُحسب محليًا — لا يُرفع موقعك أبدًا.',
    geoError: 'تعذّر تحديد موقعك — يرجى اختيار مدينة بدلاً من ذلك.',
    prayers: { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
    events: {
      ramadan: 'رمضان', eidFitr: 'عيد الفطر', eidAdha: 'عيد الأضحى',
      arafah: 'يوم عرفة', newYear: 'رأس السنة الهجرية', ashura: 'عاشوراء',
    } as Record<IslamicEventKey, string>,
  },
}

interface Loc { lat: number; lng: number; tz: string; label: string }

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
  const [now, setNow] = useState(() => new Date())

  // Tick every 30s for the "next prayer" countdown.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
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
  }

  function useMyLocation() {
    setGeoError('')
    if (!navigator.geolocation) { setGeoError(s.geoError); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCityId('')
        setLoc({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone, label: s.myLocation,
        })
      },
      () => setGeoError(s.geoError),
      { timeout: 10000 },
    )
  }

  const hijriToday = formatHijri(now, locale)
  const events = useMemo(() => upcomingEvents(now), [dayKey])

  return (
    <div className="pray">
      {/* Location */}
      <div className="pray__loc">
        <label className="field pray__city">
          <span className="field__label">{s.location}</span>
          <select className="input" value={cityId} onChange={(e) => pickCity(e.target.value)}>
            {cityId === '' && <option value="">{s.myLocation}</option>}
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>{locale === 'ar' ? c.ar : c.en}</option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={useMyLocation}>{s.useMyLocation}</button>
      </div>
      {geoError && <p className="pray__geoerr">{geoError}</p>}

      {/* Prayer times */}
      <section className="pray__card">
        <div className="pray__card-head">
          <h2>{s.prayerTimes}</h2>
          <span className="pray__method">{s.method} · {loc.label}</span>
        </div>
        <ul className="pray__times">
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
      </section>

      {/* Today */}
      <section className="pray__today">
        <span className="pray__today-hijri">{hijriToday}</span>
        <span className="pray__today-greg">{dateFmt.format(now)}</span>
      </section>

      {/* Converter + upcoming */}
      <div className="pray__grid">
        <Converter locale={locale} s={s} dateFmt={dateFmt} />

        <section className="pray__card">
          <div className="pray__card-head"><h2>{s.upcoming}</h2></div>
          <ul className="pray__events">
            {events.map((ev) => (
              <li key={ev.key} className="pray__event">
                <span className="pray__event-name">{s.events[ev.key]}</span>
                <span className="pray__event-date">
                  {dateFmt.format(ev.date)}
                  <span className="pray__event-hijri">{formatHijri(ev.date, locale)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="qr__privacy"><span aria-hidden="true">🔒</span> {s.privacy}</p>
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

  return (
    <section className="pray__card">
      <div className="pray__card-head"><h2>{s.converter}</h2></div>

      <label className="field">
        <span className="field__label">{s.gregorian}</span>
        <input className="input" type="date" value={greg} onChange={(e) => setGreg(e.target.value)} />
      </label>
      <p className="pray__conv-out" dir={locale === 'ar' ? 'rtl' : 'ltr'}>{gregAsHijri}</p>

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
