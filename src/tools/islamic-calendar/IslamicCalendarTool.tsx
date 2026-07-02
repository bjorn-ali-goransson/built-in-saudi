import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import {
  gregorianToHijri, hijriToGregorian, daysInHijriMonth, HIJRI_MONTHS, type IslamicEventKey,
} from '../prayer-times/islamic'

type Mode = 'hijri' | 'greg'

const STR = {
  en: {
    hijri: 'Hijri', gregorian: 'Gregorian', today: 'Today', prev: 'Previous month', next: 'Next month',
    whiteDays: 'White days (13–15)', holiday: 'Islamic date', todayLegend: 'Today', moonNote: 'Moon phase is approximate (from the Hijri day).',
    events: { ramadan: 'Ramadan', eidFitr: 'Eid al-Fitr', eidAdha: 'Eid al-Adha', arafah: 'Day of Arafah', newYear: 'Islamic New Year', ashura: 'Day of Ashura' } as Record<IslamicEventKey, string>,
  },
  ar: {
    hijri: 'هجري', gregorian: 'ميلادي', today: 'اليوم', prev: 'الشهر السابق', next: 'الشهر التالي',
    whiteDays: 'الأيام البيض (١٣–١٥)', holiday: 'مناسبة إسلامية', todayLegend: 'اليوم', moonNote: 'طور القمر تقريبي (من اليوم الهجري).',
    events: { ramadan: 'رمضان', eidFitr: 'عيد الفطر', eidAdha: 'عيد الأضحى', arafah: 'يوم عرفة', newYear: 'رأس السنة الهجرية', ashura: 'عاشوراء' } as Record<IslamicEventKey, string>,
  },
}

const MOON = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']
const moonFor = (hd: number) => MOON[Math.round(((hd - 1) / 29.53) * 8) % 8]

const HOLIDAYS: Record<string, IslamicEventKey> = {
  '1-1': 'newYear', '1-10': 'ashura', '9-1': 'ramadan', '10-1': 'eidFitr', '12-9': 'arafah', '12-10': 'eidAdha',
}

interface Cell { hy: number; hm: number; hd: number; greg: Date }

export default function IslamicCalendarTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const intl = locale === 'ar' ? 'ar-SA' : 'en-GB'
  const [mode, setMode] = useState<Mode>('hijri')
  const todayH = gregorianToHijri(new Date())
  const now = new Date()
  const [hy, setHy] = useState(todayH.y)
  const [hm, setHm] = useState(todayH.m)
  const [gy, setGy] = useState(now.getFullYear())
  const [gm, setGm] = useState(now.getMonth())
  const [sel, setSel] = useState<Cell | null>(null)

  const monthNames = useMemo(() => new Intl.DateTimeFormat(intl, { month: 'long' }), [intl])
  const weekFmt = useMemo(() => new Intl.DateTimeFormat(intl, { weekday: 'short' }), [intl])
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(intl, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), [intl])
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, i) => weekFmt.format(new Date(2024, 8, 1 + i))), [weekFmt]) // Sun..Sat

  const { cells, lead, title, sub } = useMemo(() => {
    const out: Cell[] = []
    let first: Date, count: number
    if (mode === 'hijri') {
      first = hijriToGregorian(hy, hm, 1)
      count = daysInHijriMonth(hy, hm)
      for (let d = 1; d <= count; d++) { const greg = hijriToGregorian(hy, hm, d); out.push({ hy, hm, hd: d, greg }) }
    } else {
      first = new Date(gy, gm, 1)
      count = new Date(gy, gm + 1, 0).getDate()
      for (let d = 1; d <= count; d++) { const greg = new Date(gy, gm, d); const h = gregorianToHijri(greg); out.push({ hy: h.y, hm: h.m, hd: h.d, greg }) }
    }
    const lead = first.getDay()
    const a = out[0].greg, b = out[out.length - 1].greg
    let title: string, sub: string
    if (mode === 'hijri') {
      title = `${HIJRI_MONTHS[locale][hm - 1]} ${hy}`
      sub = a.getMonth() === b.getMonth() ? `${monthNames.format(a)} ${a.getFullYear()}` : `${monthNames.format(a)} – ${monthNames.format(b)} ${b.getFullYear()}`
    } else {
      title = `${monthNames.format(a)} ${gy}`
      const ha = out[0], hb = out[out.length - 1]
      sub = ha.hm === hb.hm ? `${HIJRI_MONTHS[locale][ha.hm - 1]} ${ha.hy}` : `${HIJRI_MONTHS[locale][ha.hm - 1]} – ${HIJRI_MONTHS[locale][hb.hm - 1]} ${hb.hy}`
    }
    return { cells: out, lead, title, sub }
  }, [mode, hy, hm, gy, gm, locale, monthNames])

  function step(delta: number) {
    setSel(null)
    if (mode === 'hijri') {
      let m = hm + delta, y = hy
      if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }
      setHy(y); setHm(m)
    } else {
      const d = new Date(gy, gm + delta, 1); setGy(d.getFullYear()); setGm(d.getMonth())
    }
  }
  function goToday() {
    setSel(null); const h = gregorianToHijri(new Date()); setHy(h.y); setHm(h.m)
    setGy(new Date().getFullYear()); setGm(new Date().getMonth())
  }
  const isToday = (d: Date) => d.toDateString() === now.toDateString()

  return (
    <div className="stack cal2" data-testid="islamic-calendar">
      <div className="cal2__bar">
        <div className="seg" role="group">
          {(['hijri', 'greg'] as Mode[]).map((m) => (
            <button key={m} className={`seg__btn ${mode === m ? 'is-active' : ''}`} aria-pressed={mode === m}
              data-testid={`cal-mode-${m}`} onClick={() => { setMode(m); setSel(null) }}>{m === 'hijri' ? s.hijri : s.gregorian}</button>
          ))}
        </div>
        <button className="pill" data-testid="cal-today" onClick={goToday}>{s.today}</button>
      </div>

      <div className="cal2__head">
        <button className="cal2__nav" aria-label={s.prev} data-testid="cal-prev" onClick={() => step(-1)}>‹</button>
        <div className="cal2__title">
          <strong data-testid="cal-title">{title}</strong>
          <span className="cal2__sub">{sub}</span>
        </div>
        <button className="cal2__nav" aria-label={s.next} data-testid="cal-next" onClick={() => step(1)}>›</button>
      </div>

      <div className="cal2__grid" role="grid">
        {weekdayLabels.map((w, i) => <span key={`w${i}`} className="cal2__wd">{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} className="cal2__cell is-blank" />)}
        {cells.map((c) => {
          const holiday = HOLIDAYS[`${c.hm}-${c.hd}`]
          const white = c.hd >= 13 && c.hd <= 15
          const today = isToday(c.greg)
          const primary = mode === 'hijri' ? c.hd : c.greg.getDate()
          const secondary = mode === 'hijri' ? c.greg.getDate() : c.hd
          return (
            <button key={c.greg.toDateString()} className={`cal2__cell ${today ? 'is-today' : ''} ${white ? 'is-white' : ''} ${holiday ? 'is-holiday' : ''} ${sel && sel.greg.toDateString() === c.greg.toDateString() ? 'is-sel' : ''}`}
              data-testid={`cal-day-${c.hm}-${c.hd}`} onClick={() => setSel(c)}>
              <span className="cal2__num">{primary}</span>
              <span className="cal2__moon" title="">{moonFor(c.hd)}</span>
              <span className="cal2__sub-num">{secondary}</span>
              {holiday && <span className="cal2__dot" aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      {sel && (
        <div className="cal2__detail" data-testid="cal-detail">
          <strong>{HIJRI_MONTHS[locale][sel.hm - 1]} {sel.hd}, {sel.hy} {locale === 'ar' ? 'هـ' : 'AH'}</strong>
          <span>{dateFmt.format(sel.greg)} · {moonFor(sel.hd)}</span>
          {HOLIDAYS[`${sel.hm}-${sel.hd}`] && <span className="cal2__tag cal2__tag--holiday">{s.events[HOLIDAYS[`${sel.hm}-${sel.hd}`]]}</span>}
          {sel.hd >= 13 && sel.hd <= 15 && <span className="cal2__tag cal2__tag--white">{s.whiteDays}</span>}
        </div>
      )}

      <div className="cal2__legend">
        <span><i className="cal2__sw cal2__sw--today" /> {s.todayLegend}</span>
        <span><i className="cal2__sw cal2__sw--white" /> {s.whiteDays}</span>
        <span><i className="cal2__sw cal2__sw--holiday" /> {s.holiday}</span>
      </div>
      <p className="pray__method-note">{s.moonNote}</p>
    </div>
  )
}
