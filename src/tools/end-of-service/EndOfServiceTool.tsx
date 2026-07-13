import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, FieldLabel, Seg, SegButton } from '../../components/ui'

const STR = {
  en: {
    wage: 'Last monthly wage', years: 'Years of service', months: 'Extra months', reason: 'Reason for leaving',
    ended: 'Contract ended / dismissed', resigned: 'Resigned',
    award: 'Estimated award', full: 'Full entitlement', breakdown: 'Breakdown',
    firstFive: 'First 5 years (½ month/yr)', beyond: 'Beyond 5 years (1 month/yr)', factor: 'Resignation factor',
    note: 'Based on Saudi Labour Law Articles 84–85, using your last wage. Resignation reduces the award: nothing under 2 years, one-third for 2–5, two-thirds for 5–10, full at 10+. Informational only — not legal advice. Special cases (unpaid leave, allowances) are not modelled.',
    privacy: 'Computed in your browser — nothing is uploaded.',
  },
  ar: {
    wage: 'آخر أجر شهري', years: 'سنوات الخدمة', months: 'أشهر إضافية', reason: 'سبب ترك العمل',
    ended: 'انتهاء العقد / الفصل', resigned: 'استقالة',
    award: 'المكافأة التقديرية', full: 'الاستحقاق الكامل', breakdown: 'التفصيل',
    firstFive: 'أول 5 سنوات (نصف شهر/سنة)', beyond: 'ما بعد 5 سنوات (شهر/سنة)', factor: 'معامل الاستقالة',
    note: 'مبنيّة على المادتين 84 و85 من نظام العمل السعودي باستخدام آخر أجر. تخفّض الاستقالة المكافأة: لا شيء دون سنتين، والثلث من 2 إلى 5، والثلثان من 5 إلى 10، وكاملة عند 10 فأكثر. لأغراض إرشادية فقط وليست استشارة قانونية. الحالات الخاصة (إجازات بلا أجر، بدلات) غير محسوبة.',
    privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.',
  },
}

const money = (n: number, locale: string) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function EndOfServiceTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [wage, setWage] = useState(10000)
  const [years, setYears] = useState(7)
  const [months, setMonths] = useState(0)
  const [resigned, setResigned] = useState(false)

  const calc = useMemo(() => {
    const service = Math.max(0, years + months / 12)
    const firstFive = Math.min(service, 5) * 0.5 * wage
    const beyond = Math.max(0, service - 5) * 1 * wage
    const fullAward = firstFive + beyond
    let factor = 1
    if (resigned) {
      if (service < 2) factor = 0
      else if (service < 5) factor = 1 / 3
      else if (service < 10) factor = 2 / 3
      else factor = 1
    }
    return { service, firstFive, beyond, fullAward, factor, award: fullAward * factor }
  }, [wage, years, months, resigned])

  return (
    <Stack data-testid="end-of-service">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.wage}</FieldLabel>
          <Input type="number" min={0} step={100} value={wage} onChange={(e) => setWage(Math.max(0, Number(e.target.value) || 0))} className="font-mono" data-testid="eos-wage" /></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.years}</FieldLabel>
          <Input type="number" min={0} step={1} value={years} onChange={(e) => setYears(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className="font-mono" data-testid="eos-years" /></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.months}</FieldLabel>
          <Input type="number" min={0} max={11} step={1} value={months} onChange={(e) => setMonths(Math.min(11, Math.max(0, Math.floor(Number(e.target.value) || 0))))} className="font-mono" data-testid="eos-months" /></label>
      </div>

      <div className="flex flex-col gap-1"><FieldLabel>{s.reason}</FieldLabel>
        <Seg>
          <SegButton active={!resigned} onClick={() => setResigned(false)} data-testid="eos-ended">{s.ended}</SegButton>
          <SegButton active={resigned} onClick={() => setResigned(true)} data-testid="eos-resigned">{s.resigned}</SegButton>
        </Seg>
      </div>

      <Panel className="text-center">
        <div><FieldLabel>{s.award}</FieldLabel><p className="text-[2.6rem] font-display font-bold text-green-700 leading-none" data-testid="eos-award">{money(calc.award, locale)}</p></div>
        <div className="grid gap-1 text-[0.88rem] text-ink-soft max-w-sm mx-auto w-full [&>div]:flex [&>div]:justify-between [&>div]:gap-3">
          <div><span>{s.firstFive}</span><span className="font-mono text-ink">{money(calc.firstFive, locale)}</span></div>
          <div><span>{s.beyond}</span><span className="font-mono text-ink">{money(calc.beyond, locale)}</span></div>
          <div className="border-t border-[color:var(--line-soft)] pt-1"><span>{s.full}</span><span className="font-mono text-ink" data-testid="eos-full">{money(calc.fullAward, locale)}</span></div>
          {resigned && <div><span>{s.factor}</span><span className="font-mono text-ink">×{calc.factor.toFixed(2)}</span></div>}
        </div>
      </Panel>

      <p className="text-[0.78rem] text-ink-faint leading-relaxed">{s.note}</p>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
