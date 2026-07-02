import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import {
  gregorianToHijri, hijriToGregorian, daysInHijriMonth, HIJRI_MONTHS, type IslamicEventKey,
} from '../prayer-times/islamic'

type Mode = 'hijri' | 'greg'

const STR = {
  en: {
    hijri: 'Hijri', gregorian: 'Gregorian', today: 'Today', prev: 'Previous month', next: 'Next month',
    whiteDays: 'White days (13–15)', holiday: 'Islamic date', todayLegend: 'Today', holidaysTitle: 'Islamic dates',
    events: { ramadan: 'Ramadan', eidFitr: 'Eid al-Fitr', eidAdha: 'Eid al-Adha', arafah: 'Day of Arafah', newYear: 'Islamic New Year', ashura: 'Day of Ashura' } as Record<IslamicEventKey, string>,
  },
  ar: {
    hijri: 'هجري', gregorian: 'ميلادي', today: 'اليوم', prev: 'الشهر السابق', next: 'الشهر التالي',
    whiteDays: 'الأيام البيض (١٣–١٥)', holiday: 'مناسبة إسلامية', todayLegend: 'اليوم', holidaysTitle: 'المناسبات الإسلامية',
    events: { ramadan: 'رمضان', eidFitr: 'عيد الفطر', eidAdha: 'عيد الأضحى', arafah: 'يوم عرفة', newYear: 'رأس السنة الهجرية', ashura: 'عاشوراء' } as Record<IslamicEventKey, string>,
  },
}

const HOLIDAYS: Record<string, IslamicEventKey> = {
  '1-1': 'newYear', '1-10': 'ashura', '9-1': 'ramadan', '10-1': 'eidFitr', '12-9': 'arafah', '12-10': 'eidAdha',
}
// Ordered through the Hijri year for the list below the grid.
const HOLIDAY_LIST: { key: IslamicEventKey; m: number; d: number }[] = [
  { key: 'newYear', m: 1, d: 1 }, { key: 'ashura', m: 1, d: 10 }, { key: 'ramadan', m: 9, d: 1 },
  { key: 'eidFitr', m: 10, d: 1 }, { key: 'arafah', m: 12, d: 9 }, { key: 'eidAdha', m: 12, d: 10 },
]

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

  const dateFmtShort = useMemo(() => new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', year: 'numeric' }), [intl])
  const topRef = useRef<HTMLDivElement>(null)
  function goToHoliday(h: { key: IslamicEventKey; m: number; d: number }) {
    setMode('hijri'); setHy(todayH.y); setHm(h.m)
    setSel({ hy: todayH.y, hm: h.m, hd: h.d, greg: hijriToGregorian(todayH.y, h.m, h.d) })
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40)
  }

  return (
    <div className="flex flex-col gap-[0.9rem]" data-testid="islamic-calendar">
      <div className="flex justify-between items-center gap-[0.6rem]">
        <div className="seg" role="group">
          {(['hijri', 'greg'] as Mode[]).map((m) => (
            <button key={m} className={`seg__btn ${mode === m ? 'is-active' : ''}`} aria-pressed={mode === m}
              data-testid={`cal-mode-${m}`} onClick={() => { setMode(m); setSel(null) }}>{m === 'hijri' ? s.hijri : s.gregorian}</button>
          ))}
        </div>
        <button className="pill" data-testid="cal-today" onClick={goToday}>{s.today}</button>
      </div>

      <div className="flex items-center justify-between gap-[0.6rem]" ref={topRef}>
        <button className="w-[42px] h-[42px] border border-[color:var(--line)] rounded-[5px] bg-[var(--surface)] text-[1.5rem] text-ink-soft cursor-pointer grid place-items-center hover:border-green-500 hover:text-green-700" aria-label={s.prev} data-testid="cal-prev" onClick={() => step(-1)}>‹</button>
        <div className="text-center flex flex-col [&_strong]:font-display [&_strong]:text-[1.3rem] [&_strong]:text-green-700 rtl:[&_strong]:font-ar">
          <strong data-testid="cal-title">{title}</strong>
          <span className="text-[0.82rem] text-ink-faint">{sub}</span>
        </div>
        <button className="w-[42px] h-[42px] border border-[color:var(--line)] rounded-[5px] bg-[var(--surface)] text-[1.5rem] text-ink-soft cursor-pointer grid place-items-center hover:border-green-500 hover:text-green-700" aria-label={s.next} data-testid="cal-next" onClick={() => step(1)}>›</button>
      </div>

      <div className="grid grid-cols-7 gap-[4px]" role="grid">
        {weekdayLabels.map((w, i) => <span key={`w${i}`} className="text-center text-[0.68rem] font-bold text-ink-faint uppercase pb-[0.2rem]">{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} className="cal2__cell is-blank aspect-square" />)}
        {cells.map((c) => {
          const holiday = HOLIDAYS[`${c.hm}-${c.hd}`]
          const white = c.hd >= 13 && c.hd <= 15
          const today = isToday(c.greg)
          const isSel = sel && sel.greg.toDateString() === c.greg.toDateString()
          const primary = mode === 'hijri' ? c.hd : c.greg.getDate()
          const secondary = mode === 'hijri' ? c.greg.getDate() : c.hd
          return (
            <button key={c.greg.toDateString()} className={`cal2__cell relative aspect-square flex flex-col items-center justify-center gap-px border rounded-[5px] cursor-pointer p-[2px] transition-[border-color] duration-[120ms] hover:border-green-500 ${today ? 'bg-green-600 border-green-700' : white ? 'bg-[var(--surface)] border-gold-400' : 'bg-[var(--surface)] border-[color:var(--line-soft)]'} ${isSel ? 'outline outline-2 outline-green-500 -outline-offset-1' : ''}`}
              data-testid={`cal-day-${c.hm}-${c.hd}`} onClick={() => setSel(c)}>
              <span className={`text-[1rem] font-bold leading-none ${today ? 'text-sand-100' : holiday ? 'text-gold-500' : ''}`}>{primary}</span>
              {white ? <span className="text-[0.72rem] leading-none" aria-hidden="true">🌕</span> : <span className="text-[0.72rem] leading-none" />}
              <span className={`text-[0.6rem] leading-none ${today ? 'text-[color-mix(in_srgb,var(--sand-100)_80%,transparent)]' : 'text-ink-faint'}`}>{secondary}</span>
              {holiday && <span className="absolute bottom-[3px] w-[5px] h-[5px] rounded-full bg-gold-500" aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      {sel && (
        <div className="flex flex-col gap-[0.35rem] px-4 py-[0.9rem] border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] [&_strong]:text-[1.05rem] [&_strong]:text-green-700" data-testid="cal-detail">
          <strong>{HIJRI_MONTHS[locale][sel.hm - 1]} {sel.hd}, {sel.hy} {locale === 'ar' ? 'هـ' : 'AH'}</strong>
          <span>{dateFmt.format(sel.greg)}{sel.hd >= 13 && sel.hd <= 15 ? ' · 🌕' : ''}</span>
          {HOLIDAYS[`${sel.hm}-${sel.hd}`] && <span className="self-start px-[0.6rem] py-[0.2rem] rounded-full text-[0.78rem] font-semibold bg-[color-mix(in_srgb,var(--gold-400)_25%,transparent)] text-gold-500">{s.events[HOLIDAYS[`${sel.hm}-${sel.hd}`]]}</span>}
          {sel.hd >= 13 && sel.hd <= 15 && <span className="self-start px-[0.6rem] py-[0.2rem] rounded-full text-[0.78rem] font-semibold bg-[color-mix(in_srgb,var(--green-400)_15%,transparent)] text-green-700">{s.whiteDays}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-[0.9rem] text-[0.8rem] text-ink-soft [&_span]:inline-flex [&_span]:items-center [&_span]:gap-[0.4rem]">
        <span><i className="w-3 h-3 rounded inline-block bg-green-600" /> {s.todayLegend}</span>
        <span>🌕 {s.whiteDays}</span>
        <span><i className="w-3 h-3 rounded inline-block bg-gold-500" /> {s.holiday}</span>
      </div>

      <section className="flex flex-col gap-[0.4rem] mt-[0.4rem]" data-testid="cal-holidays">
        <h2 className="text-[0.95rem] font-semibold text-green-700 mb-[0.2rem]">{s.holidaysTitle}</h2>
        {HOLIDAY_LIST.map((h) => (
          <button key={h.key} className="flex items-center justify-between gap-4 px-[0.85rem] py-[0.6rem] border border-[color:var(--line-soft)] rounded-[5px] bg-[var(--surface)] cursor-pointer text-start transition-[border-color,background] duration-[120ms] hover:border-green-500 hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)]" data-testid={`cal-hol-${h.key}`} onClick={() => goToHoliday(h)}>
            <span className="font-semibold text-ink">{s.events[h.key]}</span>
            <span className="text-[0.82rem] text-ink-faint">
              {HIJRI_MONTHS[locale][h.m - 1]} {h.d} · {dateFmtShort.format(hijriToGregorian(todayH.y, h.m, h.d))}
            </span>
          </button>
        ))}
      </section>
    </div>
  )
}
