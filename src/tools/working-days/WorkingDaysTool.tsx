import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, FieldLabel, Seg, SegButton } from '../../components/ui'

const STR = {
  en: {
    from: 'From', to: 'To', weekend: 'Weekend', friSat: 'Fri–Sat (Saudi)', satSun: 'Sat–Sun',
    working: 'Working days', totalDays: 'Calendar days', weekendDays: 'Weekend days', inclusive: 'Both dates are counted (inclusive).',
    order: 'The end date is before the start date.', privacy: 'Computed in your browser — nothing is uploaded.',
  },
  ar: {
    from: 'من', to: 'إلى', weekend: 'نهاية الأسبوع', friSat: 'الجمعة–السبت (السعودية)', satSun: 'السبت–الأحد',
    working: 'أيام العمل', totalDays: 'الأيام الكلية', weekendDays: 'أيام العطلة', inclusive: 'يُحتسب التاريخان معًا (شامل).',
    order: 'تاريخ النهاية قبل تاريخ البداية.', privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.',
  },
}

export default function WorkingDaysTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [friSat, setFriSat] = useState(true)

  const res = useMemo(() => {
    if (!from || !to) return null
    const a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00')
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
    if (b < a) return { order: true as const }
    const weekendDaysSet = friSat ? [5, 6] : [6, 0] // getDay: Sun0..Sat6
    let total = 0, working = 0, weekend = 0
    const d = new Date(a)
    while (d <= b) {
      total++
      if (weekendDaysSet.includes(d.getDay())) weekend++; else working++
      d.setDate(d.getDate() + 1)
    }
    return { order: false as const, total, working, weekend }
  }, [from, to, friSat])

  const nf = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')

  return (
    <Stack data-testid="working-days">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.from}</FieldLabel>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="font-mono" data-testid="wd-from" /></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.to}</FieldLabel>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="font-mono" data-testid="wd-to" /></label>
      </div>

      <div className="flex flex-col gap-1"><FieldLabel>{s.weekend}</FieldLabel>
        <Seg>
          <SegButton active={friSat} onClick={() => setFriSat(true)} data-testid="wd-frisat">{s.friSat}</SegButton>
          <SegButton active={!friSat} onClick={() => setFriSat(false)} data-testid="wd-satsun">{s.satSun}</SegButton>
        </Seg>
      </div>

      {res?.order && <p className="text-[color:var(--danger)] text-[0.9rem]">{s.order}</p>}

      {res && !res.order && (
        <>
          <Panel className="text-center">
            <div><FieldLabel>{s.working}</FieldLabel><p className="text-[2.6rem] font-display font-bold text-green-700 leading-none" data-testid="wd-working">{nf(res.working)}</p></div>
            <div className="flex justify-center gap-6 text-[0.9rem] text-ink-soft">
              <span>{s.totalDays}: <b className="text-ink font-mono">{nf(res.total)}</b></span>
              <span>{s.weekendDays}: <b className="text-ink font-mono">{nf(res.weekend)}</b></span>
            </div>
          </Panel>
          <p className="text-[0.8rem] text-ink-faint">{s.inclusive}</p>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
