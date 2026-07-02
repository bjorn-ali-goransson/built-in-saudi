import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
// Shared Umm al-Qura helpers live under the prayer-times tool.
import {
  gregorianToHijri, hijriToGregorian, formatHijri, eventsForHijriYear,
  HIJRI_MONTHS, type IslamicEventKey,
} from '../prayer-times/islamic'

const STR = {
  en: {
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
    privacy: 'Computed locally in your browser.',
    events: {
      ramadan: 'Ramadan', eidFitr: 'Eid al-Fitr', eidAdha: 'Eid al-Adha',
      arafah: 'Day of Arafah', newYear: 'Islamic New Year', ashura: 'Day of Ashura',
    } as Record<IslamicEventKey, string>,
  },
  ar: {
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
    privacy: 'يُحسب محليًا داخل متصفحك.',
    events: {
      ramadan: 'رمضان', eidFitr: 'عيد الفطر', eidAdha: 'عيد الأضحى',
      arafah: 'يوم عرفة', newYear: 'رأس السنة الهجرية', ashura: 'عاشوراء',
    } as Record<IslamicEventKey, string>,
  },
}

export default function HijriCalendarTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const intlLoc = locale === 'ar' ? 'ar-SA' : 'en-US'
  const [now, setNow] = useState(() => new Date())

  // Refresh when the tab returns (the day may have rolled over).
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) setNow(new Date()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLoc, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    [intlLoc],
  )

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
      {/* Today */}
      <section className="pray__today">
        <span className="pray__today-hijri">{hijriToday}</span>
        <span className="pray__today-greg">{dateFmt.format(now)}</span>
      </section>

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

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
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
