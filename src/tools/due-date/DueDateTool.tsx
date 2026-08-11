import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { buildIcsCalendar } from '../../lib/ics'
import { Button, Input, Select, Stack, Panel, Field, Disclaimer } from '../../components/ui'
import { formatHijri } from '../prayer-times/islamic'
import { FULL_TERM_FROM_DAYS, FULL_TERM_TO_DAYS, calcDue, startOfDay, type Basis } from './due'

const STR = {
  en: {
    intro: 'Work out a due date and see where you are in the pregnancy — with every date in both the Gregorian and the Hijri calendar, because the appointment card and the family both matter. Nothing is sent anywhere; the dates stay in your browser.',
    basis: 'I know', cycle: 'Cycle length', days: 'days',
    bases: {
      lmp: 'The first day of my last period',
      conception: 'The date of conception',
      ivf3: 'My IVF transfer date (day-3 embryo)',
      ivf5: 'My IVF transfer date (day-5 blastocyst)',
      edd: 'A due date a scan already gave me',
    } as Record<Basis, string>,
    date: 'Date',
    due: 'Estimated due date',
    now: 'Today you are',
    weeksDays: (w: number, d: number) => `${w} weeks and ${d} day${d === 1 ? '' : 's'}`,
    trimester: (n: number) => ['before conception', 'first trimester', 'second trimester', 'third trimester', 'past 42 weeks'][n],
    toGo: (n: number) => (n >= 0 ? `${n} day${n === 1 ? '' : 's'} to go` : `${-n} day${n === -1 ? '' : 's'} past the due date`),
    shift: (n: number) =>
      `Your cycle is ${n > 0 ? `${n} day${n === 1 ? '' : 's'} longer` : `${-n} day${n === -1 ? '' : 's'} shorter`} than the 28 days the rule assumes, so ovulation lands ${n > 0 ? 'later' : 'earlier'} and the due date moves by the same ${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}. Most calculators skip this.`,
    milestonesTitle: 'The dates around it',
    keys: {
      trimester2: 'Second trimester begins',
      viability: 'Week 24',
      trimester3: 'Third trimester begins',
      termEarly: 'Full term begins (37 weeks)',
      edd: 'Estimated due date (40 weeks)',
      termLate: 'End of week 42',
    } as Record<string, string>,
    ics: 'Add to my calendar',
    icsEdd: 'Estimated due date (a midpoint, not an appointment)',
    icsTerm: 'Full term — any day in here is normal',
    icsWhy: 'The calendar gets the 37-to-42-week window as well as the date, because a lone dated entry is exactly what makes a due date read as an appointment.',
    notADate: 'A due date is a midpoint, not an appointment: only about 1 baby in 25 arrives on it, and anything from 37 to 42 weeks is full term. A scan in the first trimester dates a pregnancy more accurately than any period date can, so if you have been given a date by one, use it above.',
    caveat: 'This is the standard 280-day estimate and nothing more. It cannot know anything about you or your pregnancy. Your doctor or midwife, and a dating scan, are what the date should come from.',
    future: 'That date is in the future.',
  },
  ar: {
    intro: 'احسب موعد الولادة المتوقع واعرف أين أنتِ من الحمل — وكل تاريخ بالميلادي والهجري معًا، فبطاقة الموعد والأهل كلاهما مهم. ولا يُرسل شيء إلى أي مكان؛ تبقى التواريخ في متصفحك.',
    basis: 'أعرف', cycle: 'طول الدورة', days: 'يومًا',
    bases: {
      lmp: 'أول يوم في آخر دورة',
      conception: 'تاريخ حدوث الحمل',
      ivf3: 'تاريخ الإرجاع في أطفال الأنابيب (جنين يوم ٣)',
      ivf5: 'تاريخ الإرجاع في أطفال الأنابيب (كيسة يوم ٥)',
      edd: 'موعد ولادة حدّدته لي أشعة',
    } as Record<Basis, string>,
    date: 'التاريخ',
    due: 'موعد الولادة المتوقع',
    now: 'أنتِ اليوم في',
    weeksDays: (w: number, d: number) => `${w} أسبوعًا و${d} يومًا`,
    trimester: (n: number) => ['ما قبل الحمل', 'الثلث الأول', 'الثلث الثاني', 'الثلث الثالث', 'بعد الأسبوع ٤٢'][n],
    toGo: (n: number) => (n >= 0 ? `بقي ${n} يومًا` : `مضى ${-n} يومًا على الموعد`),
    shift: (n: number) =>
      `دورتك أطول من ٢٨ يومًا التي تفترضها القاعدة بـ${n} يومًا${n > 0 ? '' : ''}، فتتأخر الإباضة ويتحرك الموعد المقدار نفسه. ومعظم الحاسبات تتجاهل هذا.`,
    shiftShort: (n: number) =>
      `دورتك أقصر من ٢٨ يومًا التي تفترضها القاعدة بـ${n} يومًا، فتتقدّم الإباضة ويتحرك الموعد المقدار نفسه. ومعظم الحاسبات تتجاهل هذا.`,
    milestonesTitle: 'التواريخ حوله',
    keys: {
      trimester2: 'بداية الثلث الثاني',
      viability: 'الأسبوع ٢٤',
      trimester3: 'بداية الثلث الثالث',
      termEarly: 'بداية تمام الحمل (٣٧ أسبوعًا)',
      edd: 'موعد الولادة المتوقع (٤٠ أسبوعًا)',
      termLate: 'نهاية الأسبوع ٤٢',
    } as Record<string, string>,
    ics: 'أضف إلى تقويمي',
    icsEdd: 'موعد الولادة التقديري (نقطة وسط لا موعد محجوز)',
    icsTerm: 'الحمل التام — أي يوم هنا طبيعي',
    icsWhy: 'يأخذ التقويم نافذة الأسبوع ٣٧ إلى ٤٢ إلى جانب التاريخ، لأن إدخالًا واحدًا بتاريخ واحد هو بالضبط ما يجعل موعد الولادة يُقرأ موعدًا محجوزًا.',
    notADate: 'موعد الولادة نقطة وسط لا موعدٌ محجوز: فنحو مولود واحد من كل ٢٥ يأتي فيه، وما بين ٣٧ و٤٢ أسبوعًا حملٌ تام. والأشعة في الثلث الأول أدق في تحديد عمر الحمل من أي تاريخ دورة، فإن أعطتك موعدًا فاستخدميه أعلاه.',
    caveat: 'هذا هو التقدير القياسي بـ٢٨٠ يومًا ولا شيء غير ذلك. ولا يمكنه أن يعرف شيئًا عنكِ ولا عن حملك. والطبيب أو القابلة وأشعة تحديد العمر هي ما ينبغي أن يأتي منه الموعد.',
    future: 'هذا التاريخ في المستقبل.',
  },
}

const iso = (d: Date) => {
  // Local terms, never toISOString(): east of Greenwich they name yesterday.
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function DueDateTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [basis, setBasis] = useState<Basis>('lmp')
  const [date, setDate] = useState(() => iso(new Date(Date.now() - 60 * 86400000)))
  const [cycle, setCycle] = useState(28)

  const parsed = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
  }, [date])

  const r = useMemo(() => (parsed ? calcDue(basis, parsed, cycle) : null), [parsed, basis, cycle])

  const isoLocal = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  function downloadIcs() {
    if (!r) return
    const day = (n: number) => new Date(r.lmp.getFullYear(), r.lmp.getMonth(), r.lmp.getDate() + n)
    const ics = buildIcsCalendar('due-date', [
      // The WINDOW first and the date second, deliberately. About 1 baby in 25
      // arrives on the due date; a calendar carrying only the date teaches the
      // opposite of what the page says three inches below it.
      { summary: s.icsTerm, date: isoLocal(day(FULL_TERM_FROM_DAYS)), endDate: isoLocal(day(FULL_TERM_TO_DAYS)) },
      { summary: s.icsEdd, date: isoLocal(r.edd), alarmDays: 7 },
    ])
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'due-date.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  const g = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // A future LMP is a typo, not a pregnancy — say so instead of computing a
  // negative gestation and rendering it as though it meant something.
  const future = parsed ? startOfDay(parsed).getTime() > startOfDay(new Date()).getTime() && basis !== 'edd' : false

  return (
    <Stack data-testid="due-date">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Panel className="gap-3">
        <Field label={s.basis}>
          <Select value={basis} data-testid="dd-basis" onChange={(e) => setBasis(e.target.value as Basis)}>
            {(['lmp', 'conception', 'ivf3', 'ivf5', 'edd'] as Basis[]).map((b) => (
              <option key={b} value={b}>{s.bases[b]}</option>
            ))}
          </Select>
        </Field>
        <Field label={s.date}>
          <Input type="date" value={date} data-testid="dd-date" onChange={(e) => setDate(e.target.value)} />
        </Field>
        {/* Only where it can change the answer: the other bases are exact, and
            offering a cycle length beside them would imply it matters. */}
        {basis === 'lmp' && (
          <Field label={`${s.cycle} — ${cycle} ${s.days}`}>
            <input
              type="range" min={21} max={45} value={cycle} data-testid="dd-cycle"
              className="w-full accent-green-600"
              onChange={(e) => setCycle(Number(e.target.value))}
            />
          </Field>
        )}
      </Panel>

      {future && <p className="text-[color:var(--danger)] text-[0.9rem] rtl:font-ar" data-testid="dd-future">{s.future}</p>}

      {r && !future && (
        <>
          <Panel className="gap-1">
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.due}</div>
            <div className="font-display text-[1.6rem] text-green-700" data-testid="dd-edd">{g(r.edd)}</div>
            <div className="text-[0.95rem] text-ink-soft rtl:font-ar" data-testid="dd-edd-hijri">{formatHijri(r.edd, locale)}</div>
            <div className="text-[0.9rem] text-ink-faint mt-1 rtl:font-ar" data-testid="dd-togo">{s.toGo(r.daysToGo)}</div>
          </Panel>

          <Panel className="gap-1">
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.now}</div>
            <div className="font-mono text-[1.3rem] text-ink" data-testid="dd-gestation">{s.weeksDays(r.weeks, r.days)}</div>
            <div className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="dd-trimester">{s.trimester(r.trimester)}</div>
          </Panel>

          {r.cycleShift !== 0 && (
            <Panel className="border-gold-500">
              <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="dd-shift">
                {locale === 'ar'
                  ? (r.cycleShift > 0 ? s.shift(r.cycleShift) : (s as typeof STR.ar).shiftShort(-r.cycleShift))
                  : (s as typeof STR.en).shift(r.cycleShift)}
              </p>
            </Panel>
          )}

          <Panel className="gap-2">
            <div role="heading" aria-level={2} className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.milestonesTitle}</div>
            <table className="w-full text-[0.9rem]" data-testid="dd-milestones">
              <tbody>
                {r.milestones.map((m) => (
                  <tr key={m.key} className="border-b border-[color:var(--line-soft)] last:border-0">
                    <td className="py-[0.35rem] pe-3 text-ink-soft rtl:font-ar">{s.keys[m.key]}</td>
                    <td className="py-[0.35rem] pe-3 text-ink whitespace-nowrap">{g(m.date)}</td>
                    <td className="py-[0.35rem] text-ink-faint whitespace-nowrap rtl:font-ar">{formatHijri(m.date, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel><p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="dd-not-a-date">{s.notADate}</p></Panel>
          <Panel className="gap-2">
            <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="dd-ics-why">{s.icsWhy}</p>
            <Button className="self-start px-3 py-1" onClick={downloadIcs} data-testid="dd-ics">{s.ics}</Button>
          </Panel>
        </>
      )}

      <Disclaimer kind="medical" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
