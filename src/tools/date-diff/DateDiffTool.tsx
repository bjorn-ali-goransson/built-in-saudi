import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Field, Stack, Seg, SegButton } from '../../components/ui'
// Shared Umm al-Qura helpers (live under the prayer-times tool).
import {
  gregorianToHijri, hijriToGregorian, daysInHijriMonth, HIJRI_MONTHS, type Hijri,
} from '../prayer-times/islamic'

// Age and working days were their own apps until November 2026; both are a
// difference between two dates, so they are a tab and a line here.
type Mode = 'greg' | 'hijri' | 'age'

const STR = {
  en: {
    gregorianCal: 'Gregorian', hijriCal: 'Hijri',
    from: 'From', to: 'To', swap: 'Swap dates',
    totalDays: 'Total days', totalWeeks: 'Total weeks',
    sameDay: 'Same day', and: ', ',
    years: 'years', months: 'months', days: 'days',
    year: 'year', month: 'month', day: 'day',
    fieldDay: 'Day', fieldMonth: 'Month', fieldYear: 'Year',
    ageTab: 'Age', birth: 'Date of birth', age: 'Your age', future: 'That date is in the future.',
    totalMonths: 'Total months', bornOn: 'Born on a', next: 'Next birthday in',
    working: 'Working days', weekendDays: 'Weekend days', inclusive: 'both dates counted',
    weekend: 'Weekend', friSat: 'Fri–Sat (Saudi)', satSun: 'Sat–Sun',
  },
  ar: {
    gregorianCal: 'ميلادي', hijriCal: 'هجري',
    from: 'من', to: 'إلى', swap: 'تبديل التاريخين',
    totalDays: 'إجمالي الأيام', totalWeeks: 'إجمالي الأسابيع',
    sameDay: 'اليوم نفسه', and: '، ',
    years: 'سنوات', months: 'أشهر', days: 'أيام',
    year: 'سنة', month: 'شهر', day: 'يوم',
    fieldDay: 'اليوم', fieldMonth: 'الشهر', fieldYear: 'السنة',
    ageTab: 'العمر', birth: 'تاريخ الميلاد', age: 'عمرك', future: 'هذا التاريخ في المستقبل.',
    totalMonths: 'إجمالي الأشهر', bornOn: 'وُلدت يوم', next: 'الميلاد القادم بعد',
    working: 'أيام العمل', weekendDays: 'أيام العطلة', inclusive: 'يُحتسب التاريخان معًا',
    weekend: 'نهاية الأسبوع', friSat: 'الجمعة–السبت (السعودية)', satSun: 'السبت–الأحد',
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

/** Working and weekend days from a to b, both counted. */
function workingDays(a: Date, b: Date, friSat: boolean) {
  const off = friSat ? [5, 6] : [6, 0] // getDay: Sun 0 … Sat 6
  let working = 0, weekend = 0
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    if (off.includes(d.getDay())) weekend++; else working++
  }
  return { working, weekend }
}

export default function DateDiffTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const nowH = gregorianToHijri(new Date())

  const [mode, setMode] = useState<Mode>('greg')
  const [gFrom, setGFrom] = useState(toISO(new Date()))
  const [gTo, setGTo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return toISO(d) })
  const [hFrom, setHFrom] = useState<Hijri>(nowH)
  const [hTo, setHTo] = useState<Hijri>(nowH)
  const [birth, setBirth] = useState('')
  const [friSat, setFriSat] = useState(true)

  const fromDate = mode === 'greg' ? parse(gFrom) : hijriToGregorian(hFrom.y, hFrom.m, hFrom.d)
  const toDate = mode === 'greg' ? parse(gTo) : hijriToGregorian(hTo.y, hTo.m, hTo.d)

  const result = useMemo(() => {
    if (!fromDate || !toDate) return null
    const [a, b] = fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate]
    const totalDays = Math.round((b.getTime() - a.getTime()) / 86400000)
    const breakdown = mode === 'greg'
      ? ymd({ y: a.getFullYear(), m: a.getMonth() + 1, d: a.getDate() }, { y: b.getFullYear(), m: b.getMonth() + 1, d: b.getDate() }, gregPrevMonthDays)
      : ymd(gregorianToHijri(a), gregorianToHijri(b), daysInHijriMonth)
    return { ...breakdown, totalDays, totalWeeks: Math.floor(totalDays / 7), ...workingDays(a, b, friSat) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate?.getTime(), toDate?.getTime(), mode, friSat])

  const nf = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')

  const ageRes = useMemo(() => {
    const b = birth ? parse(birth) : null
    if (!b) return null
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (b > today) return { future: true as const }
    const r = ymd({ y: b.getFullYear(), m: b.getMonth() + 1, d: b.getDate() }, { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() }, gregPrevMonthDays)
    const totalDays = Math.round((today.getTime() - b.getTime()) / 86400000)
    let nb = new Date(today.getFullYear(), b.getMonth(), b.getDate())
    if (nb < today) nb = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate())
    return {
      future: false as const, ...r, totalDays, totalWeeks: Math.floor(totalDays / 7), totalMonths: r.y * 12 + r.m,
      nextDays: Math.round((nb.getTime() - today.getTime()) / 86400000),
      weekday: new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' }).format(b),
    }
  }, [birth, locale])

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
    <Stack data-testid="date-diff">
      <Seg role="group" aria-label="Calendar">
        {(['greg', 'hijri', 'age'] as Mode[]).map((m) => (
          <SegButton key={m} active={mode === m}
            aria-pressed={mode === m} data-testid={`dd-cal-${m}`} onClick={() => setMode(m)}>
            {m === 'greg' ? s.gregorianCal : m === 'hijri' ? s.hijriCal : s.ageTab}
          </SegButton>
        ))}
      </Seg>

      {mode === 'age' && (
        <>
          <Field label={s.birth} className="max-w-xs">
            <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} className="font-mono" data-testid="age-input" />
          </Field>
          {ageRes?.future && <p className="text-[color:var(--danger)] text-[0.9rem]">{s.future}</p>}
          {ageRes && !ageRes.future && (
            <>
              <div className="text-center p-[1.3rem] bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md">
                <p className="text-[0.82rem] text-ink-faint">{s.age}</p>
                <p className="font-display text-[clamp(1.5rem,5vw,2.3rem)] text-green-700 rtl:font-ar" data-testid="age-result">
                  {nf(ageRes.y)} {s.years} · {nf(ageRes.m)} {s.months} · {nf(ageRes.d)} {s.days}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-center">
                {([[ageRes.totalMonths, s.totalMonths], [ageRes.totalWeeks, s.totalWeeks], [ageRes.totalDays, s.totalDays]] as [number, string][]).map(([v, label]) => (
                  <div key={label} className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3">
                    <p className="text-[1.4rem] font-bold text-ink font-mono">{nf(v)}</p><p className="text-[0.8rem] text-ink-faint">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[0.9rem] text-ink-soft">{s.bornOn} <b className="text-ink">{ageRes.weekday}</b>. {s.next} <b className="text-ink" data-testid="age-next">{nf(ageRes.nextDays)}</b> {s.days}.</p>
            </>
          )}
        </>
      )}

      {mode !== 'age' && (<>

      <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-lg shadow-[var(--shadow-sm)] p-[1.3rem] grid grid-cols-[1fr_auto_1fr] gap-[0.8rem] items-end max-[560px]:grid-cols-1">
        {mode === 'greg' ? (
          <Field label={s.from}>
            <Input type="date" value={gFrom} data-testid="dd-from" onChange={(e) => setGFrom(e.target.value)} />
          </Field>
        ) : (
          <HijriInput label={s.from} value={hFrom} onChange={setHFrom} s={s} months={HIJRI_MONTHS[locale]} testid="from" />
        )}

        <Button className="self-end px-[0.9rem] py-[0.7rem] text-[1.1rem] max-[560px]:justify-self-center" data-testid="dd-swap" aria-label={s.swap} title={s.swap} onClick={swap}>⇅</Button>

        {mode === 'greg' ? (
          <Field label={s.to}>
            <Input type="date" value={gTo} data-testid="dd-to" onChange={(e) => setGTo(e.target.value)} />
          </Field>
        ) : (
          <HijriInput label={s.to} value={hTo} onChange={setHTo} s={s} months={HIJRI_MONTHS[locale]} testid="to" />
        )}
      </div>

      {result && (
        <>
          <div className="text-center font-display text-[clamp(1.5rem,5vw,2.3rem)] text-green-700 p-[1.3rem] bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md rtl:font-ar" data-testid="dd-phrase">{phrase}</div>
          <div className="wc__stats">
            <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center"><span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar" data-testid="dd-total-days">{result.totalDays}</span><span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{s.totalDays}</span></div>
            <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center"><span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar" data-testid="dd-total-weeks">{result.totalWeeks}</span><span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{s.totalWeeks}</span></div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.9rem] text-ink-soft">
            <span>{s.working}: <b className="text-ink font-mono" data-testid="dd-working">{nf(result.working)}</b></span>
            <span>{s.weekendDays}: <b className="text-ink font-mono" data-testid="dd-weekend">{nf(result.weekend)}</b></span>
            <span className="text-[0.8rem] text-ink-faint">({s.inclusive})</span>
            <Seg role="group" aria-label={s.weekend}>
              <SegButton active={friSat} onClick={() => setFriSat(true)} data-testid="dd-frisat">{s.friSat}</SegButton>
              <SegButton active={!friSat} onClick={() => setFriSat(false)} data-testid="dd-satsun">{s.satSun}</SegButton>
            </Seg>
          </div>
        </>
      )}
      </>)}
    </Stack>
  )
}

function HijriInput({ label, value, onChange, s, months, testid }: {
  label: string; value: Hijri; onChange: (h: Hijri) => void
  s: typeof STR['en']; months: string[]; testid: string
}) {
  return (
    <fieldset className="dd__hijri">
      <legend className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]">{label}</legend>
      <div className="grid grid-cols-[0.7fr_1.4fr_0.9fr] gap-[0.6rem]">
        <Field label={s.fieldDay}>
          <Input type="number" min={1} max={30} value={value.d} data-testid={`dd-${testid}-day`}
            onChange={(e) => onChange({ ...value, d: Math.min(30, Math.max(1, Number(e.target.value))) })} /></Field>
        <Field label={s.fieldMonth} className="min-w-0">
          <Select value={value.m} data-testid={`dd-${testid}-month`}
            onChange={(e) => onChange({ ...value, m: Number(e.target.value) })}>
            {months.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
          </Select></Field>
        <Field label={s.fieldYear}>
          <Input type="number" min={1} max={2000} value={value.y} data-testid={`dd-${testid}-year`}
            onChange={(e) => onChange({ ...value, y: Math.max(1, Number(e.target.value)) })} /></Field>
      </div>
    </fieldset>
  )
}
