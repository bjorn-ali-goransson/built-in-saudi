import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Field, Input, Stack, Panel, Disclaimer } from '../../components/ui'
import { bill, deltaCost } from './bill'

const STR = {
  en: {
    intro: 'What a month of electricity costs, and the thing almost everyone gets wrong about it. The tariff is marginal, not a cliff: the first 6,000 kWh are charged at 18 halalas whatever you use in total, and only the units above that cost 30. Crossing the threshold does not reprice what came before it.',
    kwh: 'Units used this month (kWh)',
    total: 'Estimated bill',
    breakdown: 'Where it comes from',
    lowLine: (u: number, c: number) => `${u.toLocaleString('en')} kWh at 18 halalas — ${c.toFixed(2)} SAR`,
    highLine: (u: number, c: number) => `${u.toLocaleString('en')} kWh at 30 halalas — ${c.toFixed(2)} SAR`,
    meterLine: (c: number) => `Meter service — ${c.toFixed(2)} SAR`,
    vatLine: (c: number) => `VAT at 15% — ${c.toFixed(2)} SAR`,
    marginal: 'The next kWh costs',
    halalas: 'halalas',
    below: (n: number) => `${n.toLocaleString('en')} kWh before the higher rate begins.`,
    above: 'You are past the threshold, so further units cost the higher rate.',
    mythTitle: 'Crossing 6,000 does not double your bill',
    myth: (step: number) => `Going from 5,999 to 6,001 kWh costs about ${step.toFixed(2)} SAR more, not hundreds. Only the units above 6,000 are charged at the higher rate — everything below it stays at 18 halalas. This is the part people brace for and it is not what happens.`,
    whatIf: 'What another 500 kWh would cost',
    sar: 'SAR', kwhShort: 'kWh',
    disclaimer: 'An estimate on the published residential tariff. Your bill can differ — a different tariff category, a meter read on a different cycle, arrears or a government subsidy adjustment all change it, and none of those are visible here. Your SEC account is the record.',
  },
  ar: {
    intro: 'كم يكلّف شهر من الكهرباء، والأمر الذي يخطئ فيه أكثر الناس. فالتعرفة تصاعدية لا قفزة: أول 6000 كيلوواط تُحتسب بـ18 هللة مهما بلغ استهلاكك، ولا تُحتسب بـ30 إلا الوحدات التي فوقها. وتجاوز الحد لا يُعيد تسعير ما قبله.',
    kwh: 'الاستهلاك هذا الشهر (كيلوواط ساعة)',
    total: 'الفاتورة التقديرية',
    breakdown: 'من أين جاءت',
    lowLine: (u: number, c: number) => `${u.toLocaleString('ar-SA')} ك.و.س بـ18 هللة — ${c.toFixed(2)} ريال`,
    highLine: (u: number, c: number) => `${u.toLocaleString('ar-SA')} ك.و.س بـ30 هللة — ${c.toFixed(2)} ريال`,
    meterLine: (c: number) => `خدمة العداد — ${c.toFixed(2)} ريال`,
    vatLine: (c: number) => `ضريبة القيمة المضافة 15% — ${c.toFixed(2)} ريال`,
    marginal: 'الكيلوواط التالي يكلّف',
    halalas: 'هللة',
    below: (n: number) => `${n.toLocaleString('ar-SA')} ك.و.س قبل أن تبدأ الشريحة الأعلى.`,
    above: 'تجاوزت الحد، فما بعده يُحتسب بالسعر الأعلى.',
    mythTitle: 'تجاوز 6000 لا يضاعف فاتورتك',
    myth: (step: number) => `الانتقال من 5999 إلى 6001 ك.و.س يكلّف نحو ${step.toFixed(2)} ريال زيادة لا مئات الريالات. فلا يُحتسب بالسعر الأعلى إلا ما فوق 6000، وما دونه يبقى بـ18 هللة. وهذا ما يتخوّف منه الناس وليس هو ما يحدث.`,
    whatIf: 'كم تكلّف 500 ك.و.س إضافية',
    sar: 'ريال', kwhShort: 'ك.و.س',
    disclaimer: 'تقدير على التعرفة السكنية المنشورة. وقد تختلف فاتورتك — ففئة تعرفة أخرى، أو قراءة عداد بدورة مختلفة، أو متأخرات، أو تسوية دعم حكومي، كلها تغيّرها ولا يظهر منها شيء هنا. وحسابك لدى الشركة هو المرجع.',
  },
}

export default function ElectricityBillTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 })

  const [kwh, setKwh] = useState('4500')
  const units = Number(kwh) || 0
  const b = useMemo(() => bill(units), [units])
  const plus500 = useMemo(() => deltaCost(units, units + 500), [units])

  return (
    <Stack data-testid="electricity-bill">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Field label={s.kwh}>
        <Input type="number" inputMode="numeric" min="0" value={kwh} data-testid="eb-kwh" onChange={(e) => setKwh(e.target.value)} />
      </Field>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.total}</div>
            <div className="font-mono text-[1.6rem] font-semibold text-green-700" data-testid="eb-total">{fmt(b.total)} {s.sar}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.marginal}</div>
            <div className="font-mono text-[1.2rem] text-ink" data-testid="eb-marginal">{Math.round(b.marginal * 100)} {s.halalas}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.whatIf}</div>
            <div className="font-mono text-[1.2rem] text-ink" data-testid="eb-plus500">{fmt(plus500)} {s.sar}</div>
          </div>
        </div>
        <p className="text-[0.88rem] text-ink-soft rtl:font-ar" data-testid="eb-threshold">
          {b.toThreshold > 0 ? s.below(b.toThreshold) : s.above}
        </p>
      </Panel>

      <div className="flex flex-col gap-1">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.breakdown}</h2>
        <ul className="flex flex-col gap-1 text-[0.88rem] text-ink-soft rtl:font-ar list-none p-0 m-0" data-testid="eb-breakdown">
          <li className="font-mono">{s.lowLine(b.lowUnits, b.lowCost)}</li>
          {b.highUnits > 0 && <li className="font-mono" data-testid="eb-high">{s.highLine(b.highUnits, b.highCost)}</li>}
          <li className="font-mono">{s.meterLine(b.meter)}</li>
          <li className="font-mono">{s.vatLine(b.vat)}</li>
        </ul>
      </div>

      <Panel className="gap-1">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.mythTitle}</h2>
        <p className="text-[0.88rem] text-ink-soft rtl:font-ar" data-testid="eb-myth">{s.myth(b.stepCost)}</p>
      </Panel>

      <Disclaimer kind="financial" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
