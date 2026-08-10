import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Check, Disclaimer } from '../../components/ui'
import {
  landedCost, overBy, cliffCost, BANDS, DUTY_FREE_LIMIT,
} from './duty'

const BAND_LABEL: Record<string, { en: string; ar: string }> = {
  zero: { en: 'Books, medicines, basic food, GCC-made — 0%', ar: 'كتب وأدوية وأغذية أساسية ومنتجات خليجية — ٠٪' },
  standard: { en: 'Most goods — 5%', ar: 'أغلب السلع — ٥٪' },
  protected: { en: 'Protected categories — about 20%', ar: 'فئات محمية — نحو ٢٠٪' },
  tobacco: { en: 'Tobacco — 100%', ar: 'التبغ — ١٠٠٪' },
}

const STR = {
  en: {
    intro: 'What a parcel from abroad actually costs when it lands — including the tax almost everybody forgets. Nothing is sent anywhere.',
    goods: 'Price of the goods (SAR)', shipping: 'Shipping (SAR)', insurance: 'Insurance (SAR)',
    band: 'What is in the parcel', personal: 'A personal shipment, not a business import',
    cif: 'Customs value (CIF)', duty: 'Customs duty', vat: 'VAT (15%)',
    charges: 'You will owe', total: 'Total to get it in your hands',
    effective: (p: string) => `${p}% of the customs value`,
    waived: `Duty waived — a personal shipment at or below SAR ${DUTY_FREE_LIMIT.toLocaleString('en')}.`,
    mythTitle: 'Duty-free is not tax-free',
    mythBody: `A personal parcel at or below SAR ${DUTY_FREE_LIMIT.toLocaleString('en')} pays no customs duty, and almost everybody reads that as “nothing to pay”. The 15% VAT applies to every import at any value — so a SAR 300 parcel still owes 45. That is the single most common surprise at the door.`,
    shipTitle: 'Postage counts towards the limit',
    shipBody: (over: string) =>
      `Customs values a parcel at CIF — the goods PLUS freight PLUS insurance — so the shipping is inside the threshold, not outside it. This parcel is ${over}.`,
    overBy: (v: string) => `SAR ${v} over the line`,
    underBy: (v: string) => `SAR ${v} under the line`,
    cliffTitle: 'The limit is a cliff, not a taper',
    cliffBody: (v: string) =>
      `One riyal over and the duty is charged on the WHOLE value, not on the excess — about SAR ${v} the moment you cross, before the VAT that compounds on it. If a purchase is close to the line, the shipping option is worth more thought than the discount code.`,
    compoundTitle: 'The two rates do not add up',
    compoundBody: 'VAT is charged on the landed value including the duty, so 5% and 15% are not 20%: they are 20.75% of the customs value. It is a rounding error on a phone case and a real number on a laptop.',
    feeTitle: 'The courier’s own fee is not computed here',
    feeBody: 'Carriers add a clearance or handling charge of their own, and it is theirs rather than a published rate — it differs by company and by shipment. Guessing at it would put a number on this page that nobody could check, so it is named instead: ask your carrier what they add.',
    vatTool: 'VAT on a local purchase: VAT Calculator',
    currency: 'Paid in another currency? Currency Converter',
    caveat: 'Duty rates run by HS code, there are thousands of them, and they were revised in late 2025 — the bands here are the published headline rates, not a tariff book. ZATCA’s Integrated Tariff is the authority on what your goods actually attract, and the carrier adds fees this page cannot see.',
  },
  ar: {
    intro: 'كم يكلّف الطرد القادم من الخارج حين يصل فعلًا — بما في ذلك الضريبة التي ينساها الجميع تقريبًا. ولا يُرسل شيء إلى أي مكان.',
    goods: 'سعر البضاعة (ريال)', shipping: 'الشحن (ريال)', insurance: 'التأمين (ريال)',
    band: 'ما في الطرد', personal: 'شحنة شخصية لا استيراد تجاري',
    cif: 'القيمة الجمركية (CIF)', duty: 'الرسوم الجمركية', vat: 'ضريبة القيمة المضافة (١٥٪)',
    charges: 'ما ستدفعه', total: 'الإجمالي حتى يصل إليك',
    effective: (p: string) => `${p}٪ من القيمة الجمركية`,
    waived: `أُعفيت الرسوم — شحنة شخصية بقيمة ١٬٠٠٠ ريال أو أقل.`,
    mythTitle: 'الإعفاء من الرسوم ليس إعفاءً من الضريبة',
    mythBody: 'الطرد الشخصي بقيمة ١٬٠٠٠ ريال أو أقل لا رسوم جمركية عليه، ويقرأ الجميع تقريبًا ذلك على أنه «لا شيء يُدفع». أما ضريبة القيمة المضافة ١٥٪ فتُطبَّق على كل وارد مهما كانت قيمته — فطرد بـ٣٠٠ ريال عليه ٤٥. وهذه أكثر مفاجأة تتكرّر عند الاستلام.',
    shipTitle: 'الشحن يدخل في الحدّ',
    shipBody: (over: string) =>
      `تُقوّم الجمارك الطرد بقيمة CIF — البضاعة زائد الشحن زائد التأمين — فالشحن داخل الحدّ لا خارجه. وهذا الطرد ${over}.`,
    overBy: (v: string) => `يتجاوز الحدّ بـ${v} ريال`,
    underBy: (v: string) => `دون الحدّ بـ${v} ريال`,
    cliffTitle: 'الحدّ عتبة لا تدرّج',
    cliffBody: (v: string) =>
      `ريال واحد فوقه وتُحتسب الرسوم على القيمة كاملةً لا على الزائد — نحو ${v} ريال بمجرد التجاوز، قبل الضريبة التي تُركَّب عليها. فإن كانت مشترياتك قريبة من الحدّ فخيار الشحن أجدر بالتفكير من كوبون الخصم.`,
    compoundTitle: 'النسبتان لا تُجمعان',
    compoundBody: 'تُحتسب ضريبة القيمة المضافة على القيمة الواصلة شاملةً الرسوم، فـ٥٪ و١٥٪ ليستا ٢٠٪ بل ٢٠٫٧٥٪ من القيمة الجمركية. وهي فرق ضئيل في غلاف جوال وحقيقي في حاسب محمول.',
    feeTitle: 'رسوم الناقل نفسه غير محسوبة هنا',
    feeBody: 'تضيف شركات الشحن رسوم تخليص أو مناولة خاصة بها، وهي رسومها لا نسبة منشورة — تختلف بالشركة وبالشحنة. وتخمينها يضع في هذه الصفحة رقمًا لا يستطيع أحد التحقق منه، فتُسمّى بدل ذلك: اسأل ناقلك كم يضيف.',
    vatTool: 'الضريبة على شراء محلي: حاسبة ضريبة القيمة المضافة',
    currency: 'دفعت بعملة أخرى؟ محوّل العملات',
    caveat: 'تجري الرسوم بحسب البند الجمركي (HS)، وهي آلاف البنود، وقد رُوجعت أواخر ٢٠٢٥ — والفئات هنا هي النسب المنشورة العامة لا كتاب تعرفة. والتعرفة المتكاملة لدى هيئة الزكاة والضريبة والجمارك هي المرجع فيما تستحقه بضاعتك، ويضيف الناقل رسومًا لا تراها هذه الصفحة.',
  },
}

export default function ImportDutyTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [goods, setGoods] = useState('900')
  const [shipping, setShipping] = useState('120')
  const [insurance, setInsurance] = useState('0')
  const [band, setBand] = useState('standard')
  const [personal, setPersonal] = useState(true)

  const rate = BANDS.find((b) => b.id === band)?.rate ?? 0.05
  const r = useMemo(() => landedCost({
    goods: Number(goods) || 0,
    shipping: Number(shipping) || 0,
    insurance: Number(insurance) || 0,
    dutyRate: rate,
    personal,
  }), [goods, shipping, insurance, rate, personal])

  const loc = locale === 'ar' ? 'ar-SA' : 'en-US'
  const money = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 2 })
  const pct = (v: number) => v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const diff = overBy(r.cif)
  const cliff = cliffCost(rate)

  return (
    <Stack data-testid="import-duty">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={s.goods}>
          <Input type="number" min={0} step={10} className="w-[8rem]" value={goods} data-testid="id-goods" onChange={(e) => setGoods(e.target.value)} />
        </Field>
        <Field label={s.shipping}>
          <Input type="number" min={0} step={10} className="w-[7rem]" value={shipping} data-testid="id-shipping" onChange={(e) => setShipping(e.target.value)} />
        </Field>
        <Field label={s.insurance}>
          <Input type="number" min={0} step={10} className="w-[7rem]" value={insurance} data-testid="id-insurance" onChange={(e) => setInsurance(e.target.value)} />
        </Field>
      </div>

      <Field label={s.band}>
        <select className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 py-[0.45rem] text-[0.9rem] text-ink"
          value={band} data-testid="id-band" onChange={(e) => setBand(e.target.value)}>
          {BANDS.map((b) => <option key={b.id} value={b.id}>{BAND_LABEL[b.id][locale]}</option>)}
        </select>
      </Field>
      <Check><input type="checkbox" checked={personal} data-testid="id-personal" onChange={(e) => setPersonal(e.target.checked)} /> {s.personal}</Check>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.cif}</div>
            <div className="font-mono text-[1.3rem] text-ink" data-testid="id-cif">{money(r.cif)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.duty}</div>
            <div className="font-mono text-[1.3rem] text-ink" data-testid="id-duty">{money(r.duty)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.vat}</div>
            <div className="font-mono text-[1.3rem] text-ink" data-testid="id-vat">{money(r.vat)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.charges}</div>
            <div className="font-mono text-[2rem] font-semibold text-green-700" data-testid="id-charges">{money(r.charges)}</div>
            <div className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="id-effective">{s.effective(pct(r.effectiveRate))}</div>
          </div>
        </div>
        <div className="text-[0.9rem] text-ink-soft rtl:font-ar">
          {s.total}: <span className="font-mono text-ink" data-testid="id-total">{money(r.total)}</span>
        </div>
        {r.dutyWaived && (
          <p className="text-[0.9rem] text-green-700 rtl:font-ar" data-testid="id-waived">{s.waived}</p>
        )}
      </Panel>

      {/* The belief the tool exists to correct, first. */}
      <Panel className="gap-1 border-gold-500">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.mythTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="id-myth">{s.mythBody}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.shipTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="id-shipping-note">
          {s.shipBody(diff > 0 ? s.overBy(money(diff)) : s.underBy(money(-diff)))}
        </p>
      </Panel>

      {rate > 0 && (
        <Panel className="gap-1">
          <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.cliffTitle}</div>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="id-cliff">{s.cliffBody(money(cliff))}</p>
        </Panel>
      )}

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.compoundTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="id-compound">{s.compoundBody}</p>
      </Panel>

      {/* The number it refuses to compute, and why — the `iqama-fees` rule. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.feeTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="id-carrier">{s.feeBody}</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button className="px-3 py-1" to={localePath(locale, '/apps/vat-calculator')} data-testid="id-vat-tool">{s.vatTool}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/currency-converter')} data-testid="id-currency">{s.currency}</Button>
      </div>

      <Disclaimer kind="official" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
