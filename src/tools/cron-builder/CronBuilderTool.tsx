import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Stack, Seg, SegButton, CodeOut, Panel } from '../../components/ui'
import { CopyIcon, ClockIcon } from '../../components/icons'
import { DEFAULTS, toCron, nextRuns, parseCron, type Choice, type Preset } from './build'

const PRESETS: Preset[] = ['minutely', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'custom']

const STR = {
  en: {
    when: 'Run', every: 'Every', minutes: 'minutes', hours: 'hours',
    at: 'at', on: 'on', dayOfMonth: 'day', month: 'Month',
    expression: 'Cron expression', copy: 'Copy', copied: 'Copied!',
    next: 'Next five runs', none: 'This expression never matches a real date.',
    invalid: 'That is not a valid five-field cron expression.',
    tz: 'Times are shown in your device’s timezone. Cron runs in whatever timezone the machine or scheduler is set to — check that before you trust the list.',
    orTrap: 'Careful: when both the day-of-month and the day-of-week are set, most cron implementations fire when EITHER matches, not both. The runs below follow that rule.',
    presets: {
      minutely: 'Every few minutes', hourly: 'Every few hours', daily: 'Daily',
      weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', custom: 'Write it myself',
    } as Record<Preset, string>,
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
  ar: {
    when: 'شغّل', every: 'كل', minutes: 'دقيقة', hours: 'ساعة',
    at: 'عند', on: 'في', dayOfMonth: 'يوم', month: 'الشهر',
    expression: 'تعبير الكرون', copy: 'نسخ', copied: 'تم النسخ!',
    next: 'المواعيد الخمسة القادمة', none: 'هذا التعبير لا يطابق أي تاريخ حقيقي.',
    invalid: 'ليس تعبير كرون صالحًا بخمسة حقول.',
    tz: 'تُعرض المواعيد بتوقيت جهازك. أما الكرون فيعمل بتوقيت الجهاز أو المجدول المضبوط عليه — تحقّق من ذلك قبل الاعتماد على القائمة.',
    orTrap: 'انتبه: عند ضبط يوم الشهر ويوم الأسبوع معًا، تعمل معظم تطبيقات الكرون إذا تطابق أحدهما لا كلاهما. والمواعيد أدناه تتبع هذه القاعدة.',
    presets: {
      minutely: 'كل بضع دقائق', hourly: 'كل بضع ساعات', daily: 'يوميًا',
      weekly: 'أسبوعيًا', monthly: 'شهريًا', yearly: 'سنويًا', custom: 'أكتبه بنفسي',
    } as Record<Preset, string>,
    days: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  },
}

export default function CronBuilderTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [c, setC] = useState<Choice>(DEFAULTS)
  const [copied, setCopied] = useState(false)

  const expr = useMemo(() => toCron(c), [c])
  const valid = useMemo(() => parseCron(expr) !== null, [expr])
  const runs = useMemo(() => (valid ? nextRuns(expr, 5) : []), [expr, valid])
  const bothDays = useMemo(() => parseCron(expr)?.bothDayFields ?? false, [expr])

  const set = (patch: Partial<Choice>) => setC((prev) => ({ ...prev, ...patch }))

  async function copy() {
    try { await navigator.clipboard.writeText(expr); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const timeFields = (
    <>
      <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
        {s.at}
        <div className="flex items-center gap-1">
          <Input type="number" min={0} max={23} dir="ltr" className="w-16 font-mono" data-testid="cb-hour"
            value={c.hour} onChange={(e) => set({ hour: Math.max(0, Math.min(23, +e.target.value || 0)) })} />
          <span className="text-ink-faint">:</span>
          <Input type="number" min={0} max={59} dir="ltr" className="w-16 font-mono" data-testid="cb-minute"
            value={c.minute} onChange={(e) => set({ minute: Math.max(0, Math.min(59, +e.target.value || 0)) })} />
        </div>
      </label>
    </>
  )

  return (
    <Stack data-testid="cron-builder">
      <div className="flex flex-col gap-2">
        <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.when}</span>
        <Seg className="flex-wrap">
          {PRESETS.map((p) => (
            <SegButton key={p} active={c.preset === p} data-testid={`cb-preset-${p}`} onClick={() => set({ preset: p })}>
              {s.presets[p]}
            </SegButton>
          ))}
        </Seg>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {(c.preset === 'minutely' || c.preset === 'hourly') && (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.every}
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={c.preset === 'minutely' ? 59 : 23} dir="ltr" className="w-20 font-mono"
                data-testid="cb-everyn" value={c.everyN}
                onChange={(e) => set({ everyN: Math.max(1, +e.target.value || 1) })} />
              <span className="text-[0.9rem] text-ink-soft rtl:font-ar">{c.preset === 'minutely' ? s.minutes : s.hours}</span>
            </div>
          </label>
        )}
        {c.preset === 'hourly' && (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.at}
            <Input type="number" min={0} max={59} dir="ltr" className="w-20 font-mono" data-testid="cb-minute"
              value={c.minute} onChange={(e) => set({ minute: Math.max(0, Math.min(59, +e.target.value || 0)) })} />
          </label>
        )}
        {['daily', 'weekly', 'monthly', 'yearly'].includes(c.preset) && timeFields}

        {c.preset === 'weekly' && (
          <div className="flex flex-col gap-1">
            <span className="text-[0.8rem] text-ink-faint">{s.on}</span>
            <div className="flex flex-wrap gap-1" data-testid="cb-weekdays">
              {s.days.map((d, i) => (
                <button key={i} data-testid={`cb-day-${i}`}
                  onClick={() => set({ weekdays: c.weekdays.includes(i) ? c.weekdays.filter((x) => x !== i) : [...c.weekdays, i] })}
                  className={`px-2 py-1 text-[0.8rem] rounded-sm border ${c.weekdays.includes(i) ? 'border-green-600 bg-green-600 text-sand-100' : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft'}`}>
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        )}

        {(c.preset === 'monthly' || c.preset === 'yearly') && (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.dayOfMonth}
            <Input type="number" min={1} max={31} dir="ltr" className="w-20 font-mono" data-testid="cb-dom"
              value={c.dayOfMonth} onChange={(e) => set({ dayOfMonth: Math.max(1, Math.min(31, +e.target.value || 1)) })} />
          </label>
        )}

        {c.preset === 'yearly' && (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.month}
            <Select className="w-32" data-testid="cb-month" value={c.month} onChange={(e) => set({ month: +e.target.value })}>
              {s.months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
          </label>
        )}

        {c.preset === 'custom' && (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint flex-1 min-w-[16rem]">
            {s.expression}
            <Input dir="ltr" className="font-mono" data-testid="cb-custom"
              value={c.custom} onChange={(e) => set({ custom: e.target.value })} />
          </label>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.expression}</span>
          <Button className="px-3 py-1" onClick={copy} data-testid="cb-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
        </div>
        <CodeOut data-testid="cb-expr">{expr}</CodeOut>
      </div>

      {!valid ? (
        <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="cb-invalid">{s.invalid}</p>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.next}</h2>
          {runs.length === 0 ? (
            <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="cb-never">{s.none}</p>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="cb-runs">
              {runs.map((d, i) => (
                <li key={i} className="flex items-center gap-2 text-[0.92rem] text-ink-soft">
                  <ClockIcon className="text-ink-faint" />
                  <span className="font-mono">
                    {d.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {bothDays && <Panel><p className="text-[0.85rem] text-gold-500 rtl:font-ar">{s.orTrap}</p></Panel>}
      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.tz}</p>
      <Button to={`/${locale}/apps/cron-explainer`} className="self-start">
        {locale === 'ar' ? 'اشرح تعبيرًا موجودًا' : 'Explain an existing expression'}
      </Button>
    </Stack>
  )
}
