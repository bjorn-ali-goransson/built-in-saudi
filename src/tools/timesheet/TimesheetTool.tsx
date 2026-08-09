import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Select, Check, Disclaimer } from '../../components/ui'
import { CopyIcon } from '../../components/icons'
import {
  calcWeek, decimal, hhmm, OVERTIME_RATE, RAMADAN_DAY, STANDARD_DAY, type Day,
} from './timecard'

// The Saudi week: Sunday to Thursday are the working days, Friday and Saturday
// the weekend. Starting the week on Monday, as the American calculators do,
// puts the weekend in the middle of the sheet.
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const STR = {
  en: {
    intro: 'Add up a week of shifts — with breaks, overnight shifts and overtime — and see the total both as hours and minutes and as the decimal hours payroll asks for. Nothing is sent anywhere; the hours stay in your browser.',
    days: { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' } as Record<string, string>,
    start: 'Start', end: 'End', brk: 'Break (min)',
    basis: 'Overtime counted', daily: 'Per day', weekly: 'Per week',
    threshold: 'Hours before overtime',
    rate: 'Hourly wage (optional)',
    ramadan: 'Ramadan hours (6 a day)',
    total: 'Total worked', regular: 'Regular', overtime: 'Overtime', pay: 'Pay',
    decimalNote: 'The decimal column is what a payroll system wants: 7:30 is 7.50 hours, but 7:20 is 7.33, not 7.20. That conversion is where hand-totalled timesheets go wrong.',
    overnight: 'crossed midnight',
    invalid: 'the break is longer than the shift',
    copy: 'Copy the sheet', copied: 'Copied!',
    otNote: 'Saudi Labour Law puts overtime at 150% of the hourly wage, and the standard day at 8 hours — 6 during Ramadan for Muslim workers. Both are set as defaults you can change, because your contract may differ and cannot give less.',
    moreRules: 'Leave, notice and the overtime cap',
    caveat: 'This adds up the hours you enter and applies the rate you choose. It is not payroll, and it cannot know your contract, your allowances or what your employer counts as a working day.',
  },
  ar: {
    intro: 'اجمع أسبوعًا من الورديات — مع الاستراحات والورديات الليلية والعمل الإضافي — واعرف المجموع بالساعات والدقائق وبالساعات العشرية التي يطلبها نظام الرواتب. ولا يُرسل شيء إلى أي مكان؛ تبقى الساعات في متصفحك.',
    days: { sun: 'الأحد', mon: 'الاثنين', tue: 'الثلاثاء', wed: 'الأربعاء', thu: 'الخميس', fri: 'الجمعة', sat: 'السبت' } as Record<string, string>,
    start: 'من', end: 'إلى', brk: 'استراحة (دقيقة)',
    basis: 'حساب الإضافي', daily: 'يوميًا', weekly: 'أسبوعيًا',
    threshold: 'الساعات قبل الإضافي',
    rate: 'أجر الساعة (اختياري)',
    ramadan: 'ساعات رمضان (٦ يوميًا)',
    total: 'إجمالي العمل', regular: 'عادي', overtime: 'إضافي', pay: 'الأجر',
    decimalNote: 'العمود العشري هو ما يطلبه نظام الرواتب: فـ٧:٣٠ تساوي ٧٫٥٠ ساعة، أما ٧:٢٠ فهي ٧٫٣٣ لا ٧٫٢٠. وعند هذا التحويل تقع أخطاء الجداول المحسوبة يدويًا.',
    overnight: 'تجاوزت منتصف الليل',
    invalid: 'الاستراحة أطول من الوردية',
    copy: 'انسخ الجدول', copied: 'تم النسخ!',
    otNote: 'يجعل نظام العمل السعودي أجر الساعة الإضافية ١٥٠٪ من أجر الساعة، واليوم المعتاد ثماني ساعات — وست ساعات في رمضان للعامل المسلم. وكلاهما هنا قيمة افتراضية يمكنك تغييرها، فقد يعطي عقدك أكثر ولا يعطي أقل.',
    moreRules: 'الإجازات والإشعار وحد الساعات الإضافية',
    caveat: 'تجمع هذه الأداة الساعات التي تُدخلها وتطبّق الأجر الذي تختاره. وليست نظام رواتب، ولا تعرف عقدك ولا بدلاتك ولا ما يعدّه صاحب العمل يوم عمل.',
  },
}

const BLANK: Day = { start: '', end: '', breakMin: 0 }

export default function TimesheetTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [days, setDays] = useState<Day[]>(() => DAY_KEYS.map((_, i) =>
    i <= 4 ? { start: '08:00', end: '17:00', breakMin: 60 } : { ...BLANK }))
  const [basis, setBasis] = useState<'daily' | 'weekly'>('daily')
  const [ramadan, setRamadan] = useState(false)
  const [threshold, setThreshold] = useState(STANDARD_DAY)
  const [rate, setRate] = useState('')
  const [copied, setCopied] = useState(false)

  const set = (i: number, patch: Partial<Day>) =>
    setDays((p) => p.map((d, k) => (k === i ? { ...d, ...patch } : d)))

  // Ramadan changes the standard DAY, so it only means anything on the daily
  // basis — on a weekly basis the threshold is 36 rather than 48, which the
  // user sets themselves.
  const toggleRamadan = (on: boolean) => {
    setRamadan(on)
    if (basis === 'daily') setThreshold(on ? RAMADAN_DAY : STANDARD_DAY)
  }

  const num = Number(rate)
  const result = useMemo(
    () => calcWeek(days, { basis, threshold, rate: rate.trim() && Number.isFinite(num) && num > 0 ? num : null }),
    [days, basis, threshold, rate, num],
  )

  const money = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 })

  async function copy() {
    const lines = DAY_KEYS.map((k, i) => {
      const r = result.days[i]
      return `${s.days[k]}\t${days[i].start || '—'}\t${days[i].end || '—'}\t${days[i].breakMin || 0}\t${hhmm(r.minutes)}\t${decimal(r.minutes)}`
    })
    lines.push(`${s.total}\t\t\t\t${hhmm(result.totalMin)}\t${decimal(result.totalMin)}`)
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="timesheet">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-[0.9rem]" data-testid="ts-table">
          <thead>
            <tr className="text-[0.72rem] uppercase tracking-[0.05em] text-ink-faint text-start">
              <th className="text-start font-medium py-1 rtl:font-ar">&nbsp;</th>
              <th className="text-start font-medium py-1 rtl:font-ar">{s.start}</th>
              <th className="text-start font-medium py-1 rtl:font-ar">{s.end}</th>
              <th className="text-start font-medium py-1 rtl:font-ar">{s.brk}</th>
              <th className="text-start font-medium py-1 font-mono">h:mm</th>
              <th className="text-start font-medium py-1 font-mono">dec</th>
            </tr>
          </thead>
          <tbody>
            {DAY_KEYS.map((k, i) => {
              const r = result.days[i]
              return (
                <tr key={k} className="border-t border-[color:var(--line-soft)]" data-testid={`ts-row-${k}`}>
                  <td className="py-1 pe-2 text-ink-soft whitespace-nowrap rtl:font-ar">{s.days[k]}</td>
                  <td className="py-1 pe-2"><Input type="time" className="w-[7rem]" value={days[i].start} data-testid={`ts-start-${k}`} onChange={(e) => set(i, { start: e.target.value })} /></td>
                  <td className="py-1 pe-2"><Input type="time" className="w-[7rem]" value={days[i].end} data-testid={`ts-end-${k}`} onChange={(e) => set(i, { end: e.target.value })} /></td>
                  <td className="py-1 pe-2"><Input type="number" min={0} className="w-[5rem]" value={days[i].breakMin} data-testid={`ts-break-${k}`} onChange={(e) => set(i, { breakMin: Number(e.target.value) })} /></td>
                  <td className="py-1 pe-2 font-mono text-ink" data-testid={`ts-hhmm-${k}`}>{hhmm(r.minutes)}</td>
                  <td className="py-1 font-mono text-ink-soft" data-testid={`ts-dec-${k}`}>
                    {decimal(r.minutes)}
                    {r.overnight && <span className="ms-2 text-[0.7rem] text-gold-500 rtl:font-ar" data-testid={`ts-overnight-${k}`}>{s.overnight}</span>}
                    {r.invalid && <span className="ms-2 text-[0.7rem] text-[color:var(--danger)] rtl:font-ar" data-testid={`ts-invalid-${k}`}>{s.invalid}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field label={s.basis}>
          <Select value={basis} data-testid="ts-basis" onChange={(e) => {
            const b = e.target.value as 'daily' | 'weekly'
            setBasis(b)
            setThreshold(b === 'daily' ? (ramadan ? RAMADAN_DAY : STANDARD_DAY) : (ramadan ? 36 : 48))
          }}>
            <option value="daily">{s.daily}</option>
            <option value="weekly">{s.weekly}</option>
          </Select>
        </Field>
        <Field label={s.threshold}>
          <Input type="number" min={0} className="w-[6rem]" value={threshold} data-testid="ts-threshold" onChange={(e) => setThreshold(Number(e.target.value))} />
        </Field>
        <Field label={s.rate}>
          <Input type="number" min={0} className="w-[8rem]" value={rate} data-testid="ts-rate" onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Check><input type="checkbox" checked={ramadan} data-testid="ts-ramadan" onChange={(e) => toggleRamadan(e.target.checked)} /> {s.ramadan}</Check>
      </div>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.total}</div>
            <div className="font-mono text-[1.5rem] font-semibold text-green-700" data-testid="ts-total">{hhmm(result.totalMin)}</div>
            <div className="font-mono text-[0.9rem] text-ink-faint" data-testid="ts-total-dec">{decimal(result.totalMin)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.regular}</div>
            <div className="font-mono text-[1.2rem] text-ink" data-testid="ts-regular">{hhmm(result.regularMin)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.overtime}</div>
            <div className="font-mono text-[1.2rem] text-ink" data-testid="ts-overtime">{hhmm(result.overtimeMin)}</div>
            <div className="text-[0.7rem] text-ink-faint font-mono">×{OVERTIME_RATE}</div>
          </div>
          {result.pay !== null && (
            <div>
              <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.pay}</div>
              <div className="font-mono text-[1.2rem] text-green-700" data-testid="ts-pay">{money(result.pay)}</div>
            </div>
          )}
        </div>
        <Button className="self-start px-3 py-1" onClick={copy} data-testid="ts-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
      </Panel>

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ts-decimal-note">{s.decimalNote}</p></Panel>

      <Panel className="gap-2">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ts-ot-note">{s.otNote}</p>
        {/* The rules themselves belong to leave-overtime, which carries the
            fuller treatment and its own disclaimer. Two tools asserting the same
            statute is how they drift apart. */}
        <Button className="self-start px-3 py-1" to={localePath(locale, '/apps/leave-overtime')} data-testid="ts-more-rules">{s.moreRules}</Button>
      </Panel>

      <Disclaimer kind="legal" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
