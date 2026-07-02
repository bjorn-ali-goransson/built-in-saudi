import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
// Shared Umm al-Qura helpers (live under the prayer-times tool).
import {
  gregorianToHijri, hijriToGregorian, daysInHijriMonth, HIJRI_MONTHS, type Hijri,
} from '../prayer-times/islamic'

type Mode = 'greg' | 'hijri'

const STR = {
  en: {
    gregorianCal: 'Gregorian', hijriCal: 'Hijri',
    from: 'From', to: 'To', swap: 'Swap dates',
    totalDays: 'Total days', totalWeeks: 'Total weeks',
    sameDay: 'Same day', and: ', ',
    years: 'years', months: 'months', days: 'days',
    year: 'year', month: 'month', day: 'day',
    fieldDay: 'Day', fieldMonth: 'Month', fieldYear: 'Year',
  },
  ar: {
    gregorianCal: 'ميلادي', hijriCal: 'هجري',
    from: 'من', to: 'إلى', swap: 'تبديل التاريخين',
    totalDays: 'إجمالي الأيام', totalWeeks: 'إجمالي الأسابيع',
    sameDay: 'اليوم نفسه', and: '، ',
    years: 'سنوات', months: 'أشهر', days: 'أيام',
    year: 'سنة', month: 'شهر', day: 'يوم',
    fieldDay: 'اليوم', fieldMonth: 'الشهر', fieldYear: 'السنة',
  },
}

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (iso: string): Date | null => {
  const [y, m, d] = iso.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}

/** Calendar-agnostic Y/M/D difference given month-length lookup for `b`'s prev month. */
function ymd(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }, prevMonthDays: (y: number, m: number) => number) {
  let y = b.y - a.y
  let m = b.m - a.m
  let d = b.d - a.d
  if (d < 0) {
    m -= 1
    const pm = b.m === 1 ? 12 : b.m - 1
    const py = b.m === 1 ? b.y - 1 : b.y
    d += prevMonthDays(py, pm)
  }
  if (m < 0) { y -= 1; m += 12 }
  return { y, m, d }
}
const gregPrevMonthDays = (y: number, m: number) => new Date(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 0).getDate()

export default function DateDiffTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const nowH = gregorianToHijri(new Date())

  const [mode, setMode] = useState<Mode>('greg')
  const [gFrom, setGFrom] = useState(toISO(new Date()))
  const [gTo, setGTo] = useState(toISO(new Date()))
  const [hFrom, setHFrom] = useState<Hijri>(nowH)
  const [hTo, setHTo] = useState<Hijri>(nowH)

  const fromDate = mode === 'greg' ? parse(gFrom) : hijriToGregorian(hFrom.y, hFrom.m, hFrom.d)
  const toDate = mode === 'greg' ? parse(gTo) : hijriToGregorian(hTo.y, hTo.m, hTo.d)

  const result = useMemo(() => {
    if (!fromDate || !toDate) return null
    const [a, b] = fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate]
    const totalDays = Math.round((b.getTime() - a.getTime()) / 86400000)
    const breakdown = mode === 'greg'
      ? ymd({ y: a.getFullYear(), m: a.getMonth() + 1, d: a.getDate() }, { y: b.getFullYear(), m: b.getMonth() + 1, d: b.getDate() }, gregPrevMonthDays)
      : ymd(gregorianToHijri(a), gregorianToHijri(b), daysInHijriMonth)
    return { ...breakdown, totalDays, totalWeeks: Math.floor(totalDays / 7) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate?.getTime(), toDate?.getTime(), mode])

  const phrase = useMemo(() => {
    if (!result) return ''
    if (result.totalDays === 0) return s.sameDay
    const parts: string[] = []
    if (result.y) parts.push(`${result.y} ${result.y === 1 ? s.year : s.years}`)
    if (result.m) parts.push(`${result.m} ${result.m === 1 ? s.month : s.months}`)
    if (result.d) parts.push(`${result.d} ${result.d === 1 ? s.day : s.days}`)
    return parts.join(s.and)
  }, [result, s])

  function swap() {
    if (mode === 'greg') { setGFrom(gTo); setGTo(gFrom) } else { setHFrom(hTo); setHTo(hFrom) }
  }

  return (
    <div className="stack" data-testid="date-diff">
      <div className="seg" role="group" aria-label="Calendar">
        {(['greg', 'hijri'] as Mode[]).map((m) => (
          <button key={m} className={`seg__btn ${mode === m ? 'is-active' : ''}`}
            aria-pressed={mode === m} data-testid={`dd-cal-${m}`} onClick={() => setMode(m)}>
            {m === 'greg' ? s.gregorianCal : s.hijriCal}
          </button>
        ))}
      </div>

      <div className="panel dd__inputs">
        {mode === 'greg' ? (
          <label className="field">
            <span className="field__label">{s.from}</span>
            <input className="input" type="date" value={gFrom} data-testid="dd-from" onChange={(e) => setGFrom(e.target.value)} />
          </label>
        ) : (
          <HijriInput label={s.from} value={hFrom} onChange={setHFrom} s={s} months={HIJRI_MONTHS[locale]} testid="from" />
        )}

        <button className="btn dd__swap" data-testid="dd-swap" aria-label={s.swap} title={s.swap} onClick={swap}>⇅</button>

        {mode === 'greg' ? (
          <label className="field">
            <span className="field__label">{s.to}</span>
            <input className="input" type="date" value={gTo} data-testid="dd-to" onChange={(e) => setGTo(e.target.value)} />
          </label>
        ) : (
          <HijriInput label={s.to} value={hTo} onChange={setHTo} s={s} months={HIJRI_MONTHS[locale]} testid="to" />
        )}
      </div>

      {result && (
        <>
          <div className="dd__hero" data-testid="dd-phrase">{phrase}</div>
          <div className="wc__stats">
            <div className="wc__stat"><span className="wc__stat-num" data-testid="dd-total-days">{result.totalDays}</span><span className="wc__stat-label">{s.totalDays}</span></div>
            <div className="wc__stat"><span className="wc__stat-num" data-testid="dd-total-weeks">{result.totalWeeks}</span><span className="wc__stat-label">{s.totalWeeks}</span></div>
          </div>
        </>
      )}
    </div>
  )
}

function HijriInput({ label, value, onChange, s, months, testid }: {
  label: string; value: Hijri; onChange: (h: Hijri) => void
  s: typeof STR['en']; months: string[]; testid: string
}) {
  return (
    <fieldset className="dd__hijri">
      <legend className="field__label">{label}</legend>
      <div className="pray__hijri-inputs">
        <label className="field"><span className="field__label">{s.fieldDay}</span>
          <input className="input" type="number" min={1} max={30} value={value.d} data-testid={`dd-${testid}-day`}
            onChange={(e) => onChange({ ...value, d: Math.min(30, Math.max(1, Number(e.target.value))) })} /></label>
        <label className="field pray__month"><span className="field__label">{s.fieldMonth}</span>
          <select className="input" value={value.m} data-testid={`dd-${testid}-month`}
            onChange={(e) => onChange({ ...value, m: Number(e.target.value) })}>
            {months.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
          </select></label>
        <label className="field"><span className="field__label">{s.fieldYear}</span>
          <input className="input" type="number" min={1} max={2000} value={value.y} data-testid={`dd-${testid}-year`}
            onChange={(e) => onChange({ ...value, y: Math.max(1, Number(e.target.value)) })} /></label>
      </div>
    </fieldset>
  )
}
