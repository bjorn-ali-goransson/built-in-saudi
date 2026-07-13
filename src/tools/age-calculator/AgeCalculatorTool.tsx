import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    birth: 'Date of birth', age: 'Your age', y: 'years', m: 'months', d: 'days',
    totals: 'In total', months: 'months', weeks: 'weeks', days: 'days', bornOn: 'Born on a', next: 'Next birthday in',
    future: 'That date is in the future.', privacy: 'Computed in your browser — nothing is uploaded.',
  },
  ar: {
    birth: 'تاريخ الميلاد', age: 'عمرك', y: 'سنة', m: 'شهر', d: 'يوم',
    totals: 'الإجمالي', months: 'شهرًا', weeks: 'أسبوعًا', days: 'يومًا', bornOn: 'وُلدت يوم', next: 'الميلاد القادم بعد',
    future: 'هذا التاريخ في المستقبل.', privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.',
  },
}

export default function AgeCalculatorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [birth, setBirth] = useState('')

  const res = useMemo(() => {
    if (!birth) return null
    const b = new Date(birth + 'T00:00:00')
    if (Number.isNaN(b.getTime())) return null
    const now = new Date()
    if (b > now) return { future: true as const }
    let years = now.getFullYear() - b.getFullYear()
    let months = now.getMonth() - b.getMonth()
    let days = now.getDate() - b.getDate()
    if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate() }
    if (months < 0) { years--; months += 12 }
    const totalDays = Math.floor((now.getTime() - b.getTime()) / 86400_000)
    const totalMonths = years * 12 + months
    const totalWeeks = Math.floor(totalDays / 7)
    // next birthday
    let nb = new Date(now.getFullYear(), b.getMonth(), b.getDate())
    if (nb < now) nb = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate())
    const nextDays = Math.ceil((nb.getTime() - now.getTime()) / 86400_000)
    const weekday = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' }).format(b)
    return { future: false as const, years, months, days, totalDays, totalMonths, totalWeeks, nextDays, weekday }
  }, [birth, locale])

  const nf = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')

  return (
    <Stack data-testid="age-calculator">
      <label className="flex flex-col gap-[0.4rem] max-w-xs"><FieldLabel>{s.birth}</FieldLabel>
        <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} className="font-mono" data-testid="age-input" /></label>

      {res?.future && <p className="text-[color:var(--danger)] text-[0.9rem]">{s.future}</p>}

      {res && !res.future && (
        <>
          <Panel className="text-center">
            <div><FieldLabel>{s.age}</FieldLabel>
              <p className="text-[2.2rem] font-display font-bold text-green-700 leading-tight" data-testid="age-result">
                {nf(res.years)} {s.y} · {nf(res.months)} {s.m} · {nf(res.days)} {s.d}
              </p></div>
          </Panel>
          <div className="grid gap-2 sm:grid-cols-3 text-center">
            {[[res.totalMonths, s.months], [res.totalWeeks, s.weeks], [res.totalDays, s.days]].map(([v, label], i) => (
              <div key={i} className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3">
                <p className="text-[1.4rem] font-bold text-ink font-mono">{nf(v as number)}</p><p className="text-[0.8rem] text-ink-faint">{label as string}</p>
              </div>
            ))}
          </div>
          <p className="text-[0.9rem] text-ink-soft">{s.bornOn} <b className="text-ink">{res.weekday}</b>. {s.next} <b className="text-ink" data-testid="age-next">{nf(res.nextDays)}</b> {s.days}.</p>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
