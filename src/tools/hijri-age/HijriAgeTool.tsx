import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Input, Select, Stack, Seg, SegButton, Panel } from '../../components/ui'
import { CakeIcon } from '../../components/icons'
import { gregorianToHijri, hijriToGregorian, formatHijri, HIJRI_MONTHS } from '../prayer-times/islamic'

// A Hijri year is ~354 days, so a Hijri age runs ahead of a Gregorian one by
// roughly one year every 33. People whose documents carry a Hijri date of birth
// need both, and subtracting the year numbers is not the same as the age.

const STR = {
  en: {
    born: 'Date of birth', calendar: 'Entered as', gregorian: 'Gregorian', hijri: 'Hijri',
    day: 'Day', month: 'Month', year: 'Year',
    ageHijri: 'Age in Hijri years', ageGregorian: 'Age in Gregorian years',
    years: 'years', months: 'months', days: 'days',
    bornOn: 'Born on', nextBirthday: 'Next Hijri birthday',
    inDays: (n: number) => `in ${n} day${n === 1 ? '' : 's'}`,
    today: 'today',
    drift: 'A Hijri year is about 354 days, so a Hijri age runs ahead of a Gregorian one by roughly a year every 33. Both are given because official documents here use one and daily life often uses the other.',
    future: 'That date is in the future.',
    totalDays: 'Days lived',
  },
  ar: {
    born: 'تاريخ الميلاد', calendar: 'مُدخل بالتقويم', gregorian: 'ميلادي', hijri: 'هجري',
    day: 'اليوم', month: 'الشهر', year: 'السنة',
    ageHijri: 'العمر بالسنوات الهجرية', ageGregorian: 'العمر بالسنوات الميلادية',
    years: 'سنة', months: 'شهرًا', days: 'يومًا',
    bornOn: 'وُلد في', nextBirthday: 'الميلاد الهجري القادم',
    inDays: (n: number) => `بعد ${n.toLocaleString('ar')} يومًا`,
    today: 'اليوم',
    drift: 'السنة الهجرية نحو ٣٥٤ يومًا، لذا يسبق العمر الهجري الميلادي بنحو سنة كل ٣٣ سنة. ويُعرض الاثنان لأن الوثائق الرسمية هنا تستخدم أحدهما والحياة اليومية كثيرًا ما تستخدم الآخر.',
    future: 'هذا التاريخ في المستقبل.',
    totalDays: 'الأيام المعاشة',
  },
}

/** Whole years/months/days between two dates, borrowing properly. */
function exactDiff(from: Date, to: Date) {
  let years = to.getFullYear() - from.getFullYear()
  let months = to.getMonth() - from.getMonth()
  let days = to.getDate() - from.getDate()
  if (days < 0) {
    months--
    days += new Date(to.getFullYear(), to.getMonth(), 0).getDate()
  }
  if (months < 0) { years--; months += 12 }
  return { years, months, days }
}

export default function HijriAgeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [calendar, setCalendar] = useState<'gregorian' | 'hijri'>('gregorian')
  const [greg, setGreg] = useState('1995-06-15')
  const [h, setH] = useState({ y: 1416, m: 1, d: 1 })

  const birth = useMemo(() => {
    if (calendar === 'hijri') return hijriToGregorian(h.y, h.m, h.d)
    const [y, m, d] = greg.split('-').map(Number)
    return new Date(y || 2000, (m || 1) - 1, d || 1)
  }, [calendar, greg, h])

  const now = new Date()
  const future = birth.getTime() > now.getTime()

  const gregAge = useMemo(() => exactDiff(birth, now), [birth, now])
  const hijriBirth = useMemo(() => gregorianToHijri(birth), [birth])
  const hijriNow = useMemo(() => gregorianToHijri(now), [now])

  // Hijri age, borrowing across the 12 Hijri months rather than Gregorian ones.
  const hijriAge = useMemo(() => {
    let years = hijriNow.y - hijriBirth.y
    let months = hijriNow.m - hijriBirth.m
    let days = hijriNow.d - hijriBirth.d
    if (days < 0) { months--; days += 30 }
    if (months < 0) { years--; months += 12 }
    return { years, months, days }
  }, [hijriBirth, hijriNow])

  const totalDays = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / 86400000))

  // The next Hijri birthday: same Hijri day/month, this Hijri year or the next.
  const nextBirthday = useMemo(() => {
    for (const y of [hijriNow.y, hijriNow.y + 1]) {
      const d = hijriToGregorian(y, hijriBirth.m, hijriBirth.d)
      if (d.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) return d
    }
    return null
  }, [hijriBirth, hijriNow, now])

  const daysToBirthday = nextBirthday
    ? Math.round((nextBirthday.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000)
    : 0

  return (
    <Stack data-testid="hijri-age">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[0.8rem] text-ink-faint">{s.calendar}</span>
          <Seg>
            <SegButton active={calendar === 'gregorian'} data-testid="ha-cal-greg" onClick={() => setCalendar('gregorian')}>{s.gregorian}</SegButton>
            <SegButton active={calendar === 'hijri'} data-testid="ha-cal-hijri" onClick={() => setCalendar('hijri')}>{s.hijri}</SegButton>
          </Seg>
        </div>
        {calendar === 'gregorian' ? (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.born}
            <Input type="date" className="w-44" data-testid="ha-date" value={greg} onChange={(e) => setGreg(e.target.value)} />
          </label>
        ) : (
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.day}
              <Input type="number" min={1} max={30} className="w-20 font-mono" data-testid="ha-h-day"
                value={h.d} onChange={(e) => setH({ ...h, d: Math.max(1, Math.min(30, +e.target.value || 1)) })} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.month}
              <Select className="min-w-[9rem]" data-testid="ha-h-month" value={h.m} onChange={(e) => setH({ ...h, m: +e.target.value })}>
                {HIJRI_MONTHS[locale].map((name: string, i: number) => <option key={i} value={i + 1}>{name}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.year}
              <Input type="number" min={1300} max={1500} className="w-24 font-mono" data-testid="ha-h-year"
                value={h.y} onChange={(e) => setH({ ...h, y: Math.max(1300, Math.min(1500, +e.target.value || 1400)) })} />
            </label>
          </div>
        )}
      </div>

      {future ? (
        <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="ha-future">{s.future}</p>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-1 min-[560px]:grid-cols-2">
            <Panel className="flex flex-col gap-1">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.ageHijri}</span>
              <span className="font-display text-[clamp(1.8rem,6vw,2.4rem)] text-green-700 leading-none" data-testid="ha-hijri">
                {hijriAge.years}
              </span>
              <span className="text-[0.85rem] text-ink-soft rtl:font-ar">
                {hijriAge.years} {s.years} · {hijriAge.months} {s.months} · {hijriAge.days} {s.days}
              </span>
            </Panel>
            <Panel className="flex flex-col gap-1">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.ageGregorian}</span>
              <span className="font-display text-[clamp(1.8rem,6vw,2.4rem)] text-ink leading-none" data-testid="ha-greg">
                {gregAge.years}
              </span>
              <span className="text-[0.85rem] text-ink-soft rtl:font-ar">
                {gregAge.years} {s.years} · {gregAge.months} {s.months} · {gregAge.days} {s.days}
              </span>
            </Panel>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[0.9rem] [&_dt]:text-ink-faint">
            <div className="flex flex-col">
              <dt className="rtl:font-ar">{s.bornOn}</dt>
              <dd className="text-ink" data-testid="ha-born">
                {birth.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}
                <span className="rtl:font-ar">{formatHijri(birth, locale)}</span>
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="rtl:font-ar">{s.totalDays}</dt>
              <dd className="text-ink font-mono" data-testid="ha-days">{totalDays.toLocaleString(locale === 'ar' ? 'ar' : 'en')}</dd>
            </div>
            {nextBirthday && (
              <div className="flex flex-col">
                <dt className="rtl:font-ar flex items-center gap-1.5"><CakeIcon /> {s.nextBirthday}</dt>
                <dd className="text-ink" data-testid="ha-next">
                  {daysToBirthday === 0 ? s.today : s.inDays(daysToBirthday)}
                  {' · '}
                  <span className="font-mono">{nextBirthday.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </dd>
              </div>
            )}
          </dl>

          <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.drift}</p>
        </>
      )}
    </Stack>
  )
}
