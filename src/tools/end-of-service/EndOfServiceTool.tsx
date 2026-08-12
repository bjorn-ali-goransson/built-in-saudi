// SOURCES — checked 8 August 2026
//   Ministry of Human Resources and Social Development (HRSD), hrsd.gov.sa —
//     Labour Law, end-of-service award.
//     · Art. 84: half a month's wage per year for the first five years, a full
//       month per year thereafter, on the LAST wage.
//     · Art. 85: on resignation — nothing under 2 years, one third for 2–5,
//       two thirds for 5–10, the full award at 10+.
//     · Art. 87: a FEMALE worker who ends the contract within six months of the
//       marriage contract, or three months of delivery, receives the full award
//       with no Art. 85 reduction. Corroborated by two independent sources
//       before being encoded; a third named only Arts. 84–85 and was not enough
//       on its own.
//     · Art. 81: leaving because the employer broke the contract (unpaid wages,
//       assault) is treated as a termination, so no reduction applies. Force
//       majeure likewise.
//   This tool has no separate rules module — the arithmetic is six lines — so
//   the sources live here.

import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Link } from 'react-router-dom'
import { Disclaimer, FieldLabel, Input, Panel, Seg, SegButton, Stack } from '../../components/ui'

const STR = {
  en: {
    wage: 'Last monthly wage', years: 'Years of service', months: 'Extra months', reason: 'Reason for leaving',
    ended: 'Contract ended / dismissed', resigned: 'Resigned',
    exempt: 'Did you resign for one of these reasons?',
    exemptNone: 'No, an ordinary resignation',
    exemptYes: 'Yes, one of them applies',
    exemptWhy: 'A resignation for any of these is treated as though the contract had ended: the Article 85 reduction does not apply and the award is the full one. Article 87 gives a female worker the full award if she ends the contract within six months of the marriage contract or three months of delivery; Article 81 covers leaving because the employer broke the contract — unpaid wages, assault and the like.',
    exemptApplied: 'Full award — the Article 85 reduction does not apply here.',
    award: 'Estimated award', full: 'Full entitlement', breakdown: 'Breakdown',
    firstFive: 'First 5 years (½ month/yr)', beyond: 'Beyond 5 years (1 month/yr)', factor: 'Resignation factor',
    note: 'Based on Saudi Labour Law Articles 84–85 and 87, using your last wage. Resignation reduces the award: nothing under 2 years, one-third for 2–5, two-thirds for 5–10, full at 10+ — unless one of the cases above applies, in which case there is no reduction at all. Special cases such as unpaid leave and allowances are not modelled.',
    privacy: 'Computed in your browser — nothing is uploaded.',
  },
  ar: {
    wage: 'آخر أجر شهري', years: 'سنوات الخدمة', months: 'أشهر إضافية', reason: 'سبب ترك العمل',
    ended: 'انتهاء العقد / الفصل', resigned: 'استقالة',
    exempt: 'هل استقلت لأحد هذه الأسباب؟',
    exemptNone: 'لا، استقالة عادية',
    exemptYes: 'نعم، ينطبق أحدها',
    exemptWhy: 'الاستقالة لأي من هذه الأسباب تُعامل كأن العقد انتهى: فلا ينطبق تخفيض المادة 85 وتكون المكافأة كاملة. فالمادة 87 تعطي العاملة المكافأة كاملة إذا أنهت العقد خلال ستة أشهر من عقد الزواج أو ثلاثة أشهر من الوضع؛ والمادة 81 تشمل ترك العمل لإخلال صاحب العمل بالعقد — كعدم دفع الأجور والاعتداء.',
    exemptApplied: 'المكافأة كاملة — لا ينطبق تخفيض المادة 85 هنا.',
    award: 'المكافأة التقديرية', full: 'الاستحقاق الكامل', breakdown: 'التفصيل',
    firstFive: 'أول 5 سنوات (نصف شهر/سنة)', beyond: 'ما بعد 5 سنوات (شهر/سنة)', factor: 'معامل الاستقالة',
    note: 'مبنيّة على المواد 84 و85 و87 من نظام العمل السعودي باستخدام آخر أجر. تخفّض الاستقالة المكافأة: لا شيء دون سنتين، والثلث من 2 إلى 5، والثلثان من 5 إلى 10، وكاملة عند 10 فأكثر — إلا أن ينطبق شيء مما سبق فلا تخفيض أصلًا. لأغراض إرشادية فقط وليست استشارة قانونية. الحالات الخاصة (إجازات بلا أجر، بدلات) غير محسوبة.',
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
  // Article 85's reduction is not the whole rule, and the half that was missing
  // is the half that costs money. A resignation under Article 87 (a female
  // worker within six months of marriage or three of childbirth), under Article
  // 81 (the employer broke the contract), or through force majeure is treated
  // as though the contract had ENDED — full award, no reduction.
  //
  // Leaving this out did not make the tool vague, it made it wrong in the
  // direction that matters: it told a woman resigning two years after marriage
  // she was owed a THIRD of what the law gives her in full.
  const [exempt, setExempt] = useState(false)

  const calc = useMemo(() => {
    const service = Math.max(0, years + months / 12)
    const firstFive = Math.min(service, 5) * 0.5 * wage
    const beyond = Math.max(0, service - 5) * 1 * wage
    const fullAward = firstFive + beyond
    let factor = 1
    if (resigned && !exempt) {
      if (service < 2) factor = 0
      else if (service < 5) factor = 1 / 3
      else if (service < 10) factor = 2 / 3
      else factor = 1
    }
    return { service, firstFive, beyond, fullAward, factor, award: fullAward * factor }
  }, [wage, years, months, resigned, exempt])

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

      {resigned && (
        <div className="flex flex-col gap-2" data-testid="eos-exempt">
          <FieldLabel>{s.exempt}</FieldLabel>
          <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="eos-exempt-why">{s.exemptWhy}</p>
          <Seg>
            <SegButton active={!exempt} onClick={() => setExempt(false)} data-testid="eos-exempt-no">{s.exemptNone}</SegButton>
            <SegButton active={exempt} onClick={() => setExempt(true)} data-testid="eos-exempt-yes">{s.exemptYes}</SegButton>
          </Seg>
          {exempt && (
            <p className="text-[0.9rem] text-green-700 font-semibold rtl:font-ar" data-testid="eos-exempt-applied">{s.exemptApplied}</p>
          )}
        </div>
      )}

      <Panel className="text-center">
        <div><FieldLabel>{s.award}</FieldLabel><p className="text-[2.6rem] font-display font-bold text-green-700 leading-none" data-testid="eos-award">{money(calc.award, locale)}</p></div>
        <div className="grid gap-1 text-[0.88rem] text-ink-soft max-w-sm mx-auto w-full [&>div]:flex [&>div]:justify-between [&>div]:gap-3">
          <div><span>{s.firstFive}</span><span className="font-mono text-ink">{money(calc.firstFive, locale)}</span></div>
          <div><span>{s.beyond}</span><span className="font-mono text-ink">{money(calc.beyond, locale)}</span></div>
          <div className="border-t border-[color:var(--line-soft)] pt-1"><span>{s.full}</span><span className="font-mono text-ink" data-testid="eos-full">{money(calc.fullAward, locale)}</span></div>
          {resigned && <div><span>{s.factor}</span><span className="font-mono text-ink">×{calc.factor.toFixed(2)}</span></div>}
        </div>
      </Panel>

      {/* The Labour Law EXPRESSLY EXCLUDES domestic workers, and this tool
          answered as though it did not — measured on a SAR 1,500 wage, it
          overstates their reward by 2.0x at four years and 3.2x at twelve. A
          rule that does not apply is worse than no answer, so it says so and
          routes. */}
      <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="eos-domestic">
        {locale === 'ar'
          ? 'لا ينطبق هذا على العمالة المنزلية — فنظام العمل يستثنيهم صراحةً، ولهم لائحة أخرى تعطي أجر شهر عن كل أربع سنوات. '
          : 'This does not apply to a domestic worker — the Labour Law expressly excludes them, and a separate regulation gives one month’s wage per four years. '}
        <Link to={localePath(locale, '/apps/domestic-worker')} data-testid="eos-domestic-link"
          className="text-green-700">
          {locale === 'ar' ? 'حقوق العمالة المنزلية' : 'Domestic worker entitlements'}
        </Link>
      </p>
      <Disclaimer kind="legal" locale={locale}>{s.note}</Disclaimer>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
