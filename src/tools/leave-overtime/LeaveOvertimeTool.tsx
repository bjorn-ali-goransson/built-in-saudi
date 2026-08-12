import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Link } from 'react-router-dom'
import { Field, Input, Stack, Panel, Disclaimer } from '../../components/ui'
import {
  entitlement, overtimePay, LEAVE_BASE, LEAVE_AFTER, LEAVE_STEP_YEARS,
  OVERTIME_CAP, NOTICE_RESIGN, NOTICE_TERMINATE, PROBATION_MAX,
  DAYS_PER_MONTH, HOURS_PER_DAY,
} from './labour'

const STR = {
  en: {
    intro: 'What the Labour Law gives you while you are still working — the gratuity calculator covers what happens when you leave. Three of these are routinely got wrong: leave steps up at five years, notice is a different length depending on who is ending the contract, and overtime has a yearly cap that is your right rather than a payroll limit.',
    start: 'Started this job', wage: 'Monthly wage',
    service: 'Service', years: (n: number) => `${n} year${n === 1 ? '' : 's'}`,
    leave: 'Annual leave', days: 'days',
    stepNote: (d: string, n: number) => `Rises to ${LEAVE_AFTER} days on ${d} — ${n} days away.`,
    steppedNote: `You are past ${LEAVE_STEP_YEARS} years of continuous service, so the higher entitlement applies.`,
    baseNote: `At least ${LEAVE_BASE} days a year until then. The step needs ${LEAVE_STEP_YEARS} CONTINUOUS years with the same employer.`,
    dayValue: 'A day of leave is worth',
    overtime: 'Overtime', otHours: 'Overtime hours', otRate: 'Paid at 150% of the hourly wage',
    otPay: 'That comes to',
    cap: `The cap is ${OVERTIME_CAP} hours a year`,
    capBody: 'Beyond it, overtime needs your explicit written consent. The cap protects you — it is not a limit on what you can be paid for.',
    overCap: (n: number) => `That is ${n} hours past the cap.`,
    notice: 'Notice period',
    noticeBody: `If you resign: ${NOTICE_RESIGN} days. If your employer ends it: ${NOTICE_TERMINATE} days. The two are not the same, and it is the party giving notice that decides which applies.`,
    probation: 'Probation',
    probationBody: `At most ${PROBATION_MAX} days. It cannot be extended past that.`,
    basis: 'Worked out from',
    basisBody: `a ${DAYS_PER_MONTH}-day month and an ${HOURS_PER_DAY}-hour day, which is the usual basis for an hourly rate. Your contract may set a different one — the daily and hourly figures are shown so you can check.`,
    daily: 'Daily wage', hourly: 'Hourly wage', otHourly: 'Overtime hour',
    sar: 'SAR',
    disclaimer: 'These are the statutory minimums. Your contract may give you more, and it cannot give you less — where the two differ, the better of the two applies to you. Individual cases turn on details this cannot see, including whether service has genuinely been continuous. The Ministry of Human Resources and Social Development is the authority.',
  },
  ar: {
    intro: 'ما يمنحك نظام العمل وأنت على رأس العمل — أما ما يقع عند تركه فتغطيه حاسبة نهاية الخدمة. وثلاثة من هذه يخطئ فيها الناس كثيرًا: الإجازة ترتفع عند خمس سنوات، ومدة الإشعار تختلف باختلاف من ينهي العقد، وللعمل الإضافي حدٌّ سنوي هو حقٌّ لك لا قيدٌ على أجرك.',
    start: 'تاريخ بدء العمل', wage: 'الأجر الشهري',
    service: 'مدة الخدمة', years: (n: number) => `${n} سنة`,
    leave: 'الإجازة السنوية', days: 'يومًا',
    stepNote: (d: string, n: number) => `ترتفع إلى ${LEAVE_AFTER} يومًا في ${d} — بعد ${n} يومًا.`,
    steppedNote: `تجاوزت ${LEAVE_STEP_YEARS} سنوات خدمة متصلة، فينطبق عليك الاستحقاق الأعلى.`,
    baseNote: `${LEAVE_BASE} يومًا سنويًا على الأقل حتى ذلك الحين. والارتفاع يشترط ${LEAVE_STEP_YEARS} سنوات متصلة عند صاحب العمل نفسه.`,
    dayValue: 'قيمة يوم الإجازة',
    overtime: 'العمل الإضافي', otHours: 'ساعات إضافية', otRate: 'يُدفع بنسبة 150% من أجر الساعة',
    otPay: 'المجموع',
    cap: `الحد ${OVERTIME_CAP} ساعة سنويًا`,
    capBody: 'وما زاد عليه يلزمه موافقتك الكتابية الصريحة. فالحد حمايةٌ لك لا قيدٌ على ما تُدفع مقابله.',
    overCap: (n: number) => `وهذا يتجاوز الحد بـ${n} ساعة.`,
    notice: 'مدة الإشعار',
    noticeBody: `إن استقلت: ${NOTICE_RESIGN} يومًا. وإن أنهاه صاحب العمل: ${NOTICE_TERMINATE} يومًا. وليستا سواء، والذي يحدد أيّهما هو الطرف الذي يُشعر.`,
    probation: 'فترة التجربة',
    probationBody: `${PROBATION_MAX} يومًا على الأكثر، ولا يجوز تمديدها بعدها.`,
    basis: 'محسوبة على',
    basisBody: `شهر من ${DAYS_PER_MONTH} يومًا ويوم من ${HOURS_PER_DAY} ساعات، وهو الأساس المعتاد لأجر الساعة. وقد يحدد عقدك أساسًا آخر — ولهذا يُعرض الأجر اليومي وأجر الساعة لتراجعهما.`,
    daily: 'الأجر اليومي', hourly: 'أجر الساعة', otHourly: 'ساعة إضافية',
    sar: 'ريال',
    disclaimer: 'هذه هي الحدود الدنيا النظامية. وقد يمنحك عقدك أكثر منها، ولا يجوز أن يمنحك أقل — وعند الاختلاف يسري الأصلح لك. والحالات الفردية تتوقف على تفاصيل لا تراها هذه الأداة، ومنها هل كانت الخدمة متصلة فعلًا. والمرجع وزارة الموارد البشرية والتنمية الاجتماعية.',
  },
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function LeaveOvertimeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const today = useMemo(() => new Date(), [])
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 })
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium' })

  const [start, setStart] = useState(() => iso(new Date(today.getFullYear() - 3, today.getMonth(), today.getDate())))
  const [wage, setWage] = useState('12000')
  const [hours, setHours] = useState('20')

  const startDate = useMemo(() => new Date(start + 'T00:00:00'), [start])
  const ok = !Number.isNaN(startDate.getTime())
  const e = useMemo(() => (ok ? entitlement(startDate, Number(wage) || 0, today) : null), [ok, startDate, wage, today])
  const ot = useMemo(() => (e ? overtimePay(Number(hours) || 0, e.hourlyWage) : null), [e, hours])

  return (
    <Stack data-testid="leave-overtime">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3">
        <Field label={s.start}>
          <Input type="date" value={start} data-testid="lo-start" onChange={(ev) => setStart(ev.target.value)} />
        </Field>
        <Field label={s.wage}>
          <Input type="number" inputMode="decimal" min="0" value={wage} data-testid="lo-wage" onChange={(ev) => setWage(ev.target.value)} />
        </Field>
        <Field label={s.otHours}>
          <Input type="number" inputMode="numeric" min="0" value={hours} data-testid="lo-hours" onChange={(ev) => setHours(ev.target.value)} />
        </Field>
      </div>

      {e && (
        <>
          <Panel className="gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.leave}</h2>
            <p className="font-display text-[1.6rem] leading-none text-green-700" data-testid="lo-leave">
              {e.leaveDays} {s.days}
            </p>
            <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="lo-step">
              {e.stepsOn && e.daysUntilStep !== null
                ? `${s.baseNote} ${s.stepNote(dateFmt.format(e.stepsOn), e.daysUntilStep)}`
                : s.steppedNote}
            </p>
            <p className="text-[0.88rem] text-ink rtl:font-ar">
              {s.dayValue}: <span className="font-mono" data-testid="lo-dayvalue">{fmt(e.leaveDayValue)} {s.sar}</span>
              {' · '}{s.service}: <span data-testid="lo-years">{s.years(e.years)}</span>
            </p>
          </Panel>

          <Panel className="gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.overtime}</h2>
            <p className="text-[0.88rem] text-ink-soft rtl:font-ar">{s.otRate}</p>
            {ot && (
              <>
                <p className="text-[1.1rem] text-ink">
                  {s.otPay} <span className="font-mono font-semibold" data-testid="lo-otpay">{fmt(ot.pay)} {s.sar}</span>
                </p>
                {ot.overCap && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="lo-overcap">{s.overCap(ot.beyondCap)}</p>}
              </>
            )}
            <p className="text-[0.85rem] text-ink rtl:font-ar"><strong>{s.cap}.</strong> {s.capBody}</p>
          </Panel>

          <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3 text-[0.85rem]">
            {[
              { label: s.daily, value: e.dailyWage, id: 'lo-daily' },
              { label: s.hourly, value: e.hourlyWage, id: 'lo-hourly' },
              { label: s.otHourly, value: e.overtimeHourly, id: 'lo-othourly' },
            ].map((x) => (
              <div key={x.id} className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2">
                <div className="text-ink-faint rtl:font-ar">{x.label}</div>
                <div className="font-mono text-ink" data-testid={x.id}>{fmt(x.value)} {s.sar}</div>
              </div>
            ))}
          </div>
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.basis} {s.basisBody}</p>
        </>
      )}

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
        <Panel className="gap-1">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.notice}</h2>
          <p className="text-[0.88rem] text-ink-soft rtl:font-ar" data-testid="lo-notice">{s.noticeBody}</p>
        </Panel>
        <Panel className="gap-1">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.probation}</h2>
          <p className="text-[0.88rem] text-ink-soft rtl:font-ar" data-testid="lo-probation">{s.probationBody}</p>
        </Panel>
      </div>

      {/* Same exclusion: a domestic worker's leave is 30 days after TWO
          years, not 21 or 30 a year, and the overtime rules here do not reach
          them at all. */}
      <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="lo-domestic">
        {locale === 'ar'
          ? 'لا ينطبق هذا على العمالة المنزلية — إجازتهم ثلاثون يومًا بعد سنتين بموجب لائحة مستقلة. '
          : 'This does not apply to a domestic worker — their leave is 30 days after two years, under a separate regulation. '}
        <Link to={localePath(locale, '/apps/domestic-worker')} data-testid="lo-domestic-link"
          className="text-green-700">
          {locale === 'ar' ? 'حقوق العمالة المنزلية' : 'Domestic worker entitlements'}
        </Link>
      </p>
      <Disclaimer kind="legal" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
