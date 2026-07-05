import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
// Shared Umm al-Qura helpers live under the prayer-times tool.
import {
  gregorianToHijri, hijriToGregorian, formatHijri,
  daysInHijriMonth, HIJRI_MONTHS, type IslamicEventKey,
} from '../prayer-times/islamic'
import { Button, Input } from '../../components/ui'

const WEEKDAYS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ar: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
}

const STR = {
  en: {
    today: 'Today', converter: 'Date converter',
    gregorian: 'Gregorian', hijri: 'Hijri',
    prevMonth: 'Previous month', nextMonth: 'Next month',
    inDays: (n: number) => `in ${n} ${n === 1 ? 'day' : 'days'}`,
    daysAgo: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} ago`,
    inMonths: (n: number) => `in ${n} ${n === 1 ? 'month' : 'months'}`,
    monthsAgo: (n: number) => `${n} ${n === 1 ? 'month' : 'months'} ago`,
    inHours: (n: number) => `in ${n} ${n === 1 ? 'hour' : 'hours'}`,
    hoursAgo: (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'} ago`,
    soon: 'now',
    hijriYear: 'Hijri year', prevYear: 'Previous year', nextYear: 'Next year', thisYear: 'This year',
    upcoming: 'Islamic dates',
    privacy: 'Computed locally in your browser.',
    events: {
      ramadan: 'Ramadan', eidFitr: 'Eid al-Fitr', eidAdha: 'Eid al-Adha',
      arafah: 'Day of Arafah', newYear: 'Islamic New Year', ashura: 'Day of Ashura',
    } as Record<IslamicEventKey, string>,
  },
  ar: {
    today: 'اليوم', converter: 'محوّل التاريخ',
    gregorian: 'ميلادي', hijri: 'هجري',
    prevMonth: 'الشهر السابق', nextMonth: 'الشهر التالي',
    inDays: (n: number) => `بعد ${n} يوم`,
    daysAgo: (n: number) => `قبل ${n} يوم`,
    inMonths: (n: number) => `بعد ${n} شهر`,
    monthsAgo: (n: number) => `قبل ${n} شهر`,
    inHours: (n: number) => `بعد ${n} ساعة`,
    hoursAgo: (n: number) => `قبل ${n} ساعة`,
    soon: 'الآن',
    hijriYear: 'السنة الهجرية', prevYear: 'السنة السابقة', nextYear: 'السنة التالية', thisYear: 'هذه السنة',
    upcoming: 'المناسبات الإسلامية',
    privacy: 'يُحسب محليًا داخل متصفحك.',
    events: {
      ramadan: 'رمضان', eidFitr: 'عيد الفطر', eidAdha: 'عيد الأضحى',
      arafah: 'يوم عرفة', newYear: 'رأس السنة الهجرية', ashura: 'عاشوراء',
    } as Record<IslamicEventKey, string>,
  },
}

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

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

  return (
    <div className="flex flex-col gap-[1.3rem]">
      {/* Today — edge-docked hero, like the prayer-times app */}
      <section className="text-center bg-green-700 text-sand-100 shadow-[var(--shadow-md)] mx-[calc(50%_-_50vw)] w-screen max-w-[100vw] rounded-none mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] py-[1.4rem] px-[1.2rem]">
        <span className="block font-display text-[clamp(1.3rem,4vw,1.9rem)] rtl:font-ar" data-testid="hijri-today">{hijriToday}</span>
        <span className="block opacity-80 mt-[0.3rem] text-[0.95rem]">{dateFmt.format(now)}</span>
      </section>

      <Converter locale={locale} s={s} dateFmt={dateFmt} intlLoc={intlLoc} />

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </div>
  )
}

function Converter({ locale, s, dateFmt, intlLoc }: {
  locale: 'en' | 'ar'
  s: typeof STR['en']
  dateFmt: Intl.DateTimeFormat
  intlLoc: string
}) {
  // Canonical selection — a Gregorian date at local midnight. Both calendars are
  // views onto it; picking a day in either one moves this and re-centres both.
  const [sel, setSel] = useState(() => midnight(new Date()))
  const [gv, setGv] = useState(() => ({ y: sel.getFullYear(), m: sel.getMonth() }))       // Gregorian view (m: 0-11)
  const hijriSel = useMemo(() => gregorianToHijri(sel), [sel])
  const [hv, setHv] = useState(() => ({ y: hijriSel.y, m: hijriSel.m }))                    // Hijri view (m: 1-12)

  const select = (d: Date) => {
    const nd = midnight(d)
    setSel(nd)
    setGv({ y: nd.getFullYear(), m: nd.getMonth() })
    const h = gregorianToHijri(nd)
    setHv({ y: h.y, m: h.m })
  }

  const gMonthName = useMemo(
    () => new Intl.DateTimeFormat(intlLoc, { month: 'long' }).format(new Date(gv.y, gv.m, 1)),
    [gv, intlLoc],
  )

  // Gregorian grid.
  const gFirstDow = new Date(gv.y, gv.m, 1).getDay()
  const gDays = new Date(gv.y, gv.m + 1, 0).getDate()
  const gSelHere = sel.getFullYear() === gv.y && sel.getMonth() === gv.m

  // Hijri grid.
  const hDays = daysInHijriMonth(hv.y, hv.m)
  const hFirstDow = hijriToGregorian(hv.y, hv.m, 1).getDay()
  const hSelHere = hijriSel.y === hv.y && hijriSel.m === hv.m

  const stepG = (delta: number) => setGv(({ y, m }) => {
    const nm = m + delta
    return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 }
  })
  const stepH = (delta: number) => setHv(({ y, m }) => {
    const nm = m - 1 + delta
    return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 + 1 }
  })

  return (
    <section className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-[1.3rem]" data-testid="converter">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
        <h2 className="text-[1.25rem]">{s.converter}</h2>
        <Button data-testid="conv-today" onClick={() => select(new Date())}>{s.today}</Button>
      </div>

      <div className="grid grid-cols-2 gap-[1.1rem] max-[560px]:grid-cols-1 max-[560px]:gap-[1.4rem]">
        <MonthCalendar
          testid="cal-greg" label={s.gregorian} title={`${gMonthName} ${gv.y}`}
          weekdays={WEEKDAYS[locale]} firstDow={gFirstDow} days={gDays}
          selectedDay={gSelHere ? sel.getDate() : null}
          onPrev={() => stepG(-1)} onNext={() => stepG(1)} prevLabel={s.prevMonth} nextLabel={s.nextMonth}
          onPick={(day) => select(new Date(gv.y, gv.m, day))}
          numeric={{ d: sel.getDate(), m: sel.getMonth() + 1, y: sel.getFullYear() }}
          onNumeric={(d, m, y) => { if (m >= 1 && m <= 12 && d >= 1 && d <= 31) select(new Date(y, m - 1, d)) }}
          caption={dateFmt.format(sel)}
        />
        <MonthCalendar
          testid="cal-hijri" label={s.hijri} title={`${HIJRI_MONTHS[locale][hv.m - 1]} ${hv.y}`}
          weekdays={WEEKDAYS[locale]} firstDow={hFirstDow} days={hDays}
          selectedDay={hSelHere ? hijriSel.d : null}
          onPrev={() => stepH(-1)} onNext={() => stepH(1)} prevLabel={s.prevMonth} nextLabel={s.nextMonth}
          onPick={(day) => select(hijriToGregorian(hv.y, hv.m, day))}
          numeric={{ d: hijriSel.d, m: hijriSel.m, y: hijriSel.y }}
          onNumeric={(d, m, y) => {
            if (m < 1 || m > 12 || y < 1) return
            const max = daysInHijriMonth(y, m)
            if (d >= 1 && d <= max) select(hijriToGregorian(y, m, d))
          }}
          caption={formatHijri(sel, locale)}
        />
      </div>
    </section>
  )
}

interface MonthCalendarProps {
  testid: string
  label: string
  title: string
  weekdays: string[]
  firstDow: number
  days: number
  selectedDay: number | null
  onPrev: () => void
  onNext: () => void
  prevLabel: string
  nextLabel: string
  onPick: (day: number) => void
  numeric: { d: number; m: number; y: number }
  onNumeric: (d: number, m: number, y: number) => void
  caption: string
}

function MonthCalendar(p: MonthCalendarProps) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const asText = ({ d, m, y }: { d: number; m: number; y: number }) => `${pad(d)}/${pad(m)}/${y}`
  const [text, setText] = useState(() => asText(p.numeric))

  // Keep the numeric field in step when the canonical selection changes elsewhere.
  const canonical = asText(p.numeric)
  useEffect(() => { setText(canonical) }, [canonical])

  const onChange = (v: string) => {
    setText(v)
    const parts = v.split(/[/\-.\s]+/).map((x) => Number(x))
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n > 0)) {
      p.onNumeric(parts[0], parts[1], parts[2])
    }
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: p.firstDow }, () => null),
    ...Array.from({ length: p.days }, (_, i) => i + 1),
  ]

  return (
    <div className="cal" data-testid={p.testid}>
      <div className="flex items-center gap-2">
        <button className="flex-none w-8 h-8 grid place-items-center border border-[color:var(--line)] rounded-sm bg-[var(--surface)] text-green-700 text-[1.1rem] leading-none cursor-pointer transition-[border-color,background] duration-150 hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_8%,transparent)]" aria-label={p.prevLabel} data-testid={`${p.testid}-prev`} onClick={p.onPrev}>‹</button>
        <div className="flex-1 text-center flex flex-col leading-[1.15] min-w-0">
          <span className="text-[0.68rem] uppercase tracking-[0.08em] text-ink-faint rtl:tracking-normal">{p.label}</span>
          <strong className="font-display text-[1.02rem] text-green-700 whitespace-nowrap overflow-hidden text-ellipsis rtl:font-ar" data-testid={`${p.testid}-title`}>{p.title}</strong>
        </div>
        <button className="flex-none w-8 h-8 grid place-items-center border border-[color:var(--line)] rounded-sm bg-[var(--surface)] text-green-700 text-[1.1rem] leading-none cursor-pointer transition-[border-color,background] duration-150 hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_8%,transparent)]" aria-label={p.nextLabel} data-testid={`${p.testid}-next`} onClick={p.onNext}>›</button>
      </div>

      <div className="grid grid-cols-7 gap-[2px] text-ink-faint text-[0.66rem] text-center" aria-hidden="true">
        {p.weekdays.map((w, i) => <span key={i} className="py-[0.2rem] overflow-hidden text-ellipsis">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-[2px]" role="grid">
        {cells.map((day, i) => day === null
          ? <span key={i} className="aspect-square" />
          : (
            <button
              key={i}
              className={`aspect-square grid place-items-center border border-transparent rounded-sm text-[0.9rem] [font-variant-numeric:tabular-nums] cursor-pointer transition-[border-color,background] duration-[120ms] max-[560px]:text-[0.95rem] ${day === p.selectedDay ? 'bg-green-600 text-sand-100 font-bold' : 'bg-[color-mix(in_srgb,var(--sand-100)_55%,var(--surface))] text-ink hover:border-[color-mix(in_srgb,var(--green-500)_45%,transparent)]'}`}
              data-testid={day === p.selectedDay ? `${p.testid}-selected` : undefined}
              aria-pressed={day === p.selectedDay}
              onClick={() => p.onPick(day)}
            >{day}</button>
          ))}
      </div>

      <Input
        className="font-mono text-center tracking-[0.04em]" inputMode="numeric" dir="ltr" data-testid={`${p.testid}-num`}
        value={text} onChange={(e) => onChange(e.target.value)} aria-label={p.label}
        spellCheck={false} autoComplete="off"
      />
      <p className="text-[0.82rem] text-ink-soft text-center" dir={/* keep Arabic captions RTL */ undefined}>{p.caption}</p>
    </div>
  )
}
