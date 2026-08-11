import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Disclaimer } from '../../components/ui'
import {
  breakDown, priceForMargin, naivePrice, markupToMargin,
} from './pricing'

const STR = {
  en: {
    intro: 'What you actually keep from a sale here — where the price you advertise already includes the 15% and the fees come off the whole of it. Nothing is sent anywhere.',
    cost: 'What it costs you (SAR)',
    displayed: 'Price you display (SAR, VAT included)',
    fee: 'Payment / platform fee (%)',
    target: 'Margin you want (%)',

    vat: 'VAT (not yours)', net: 'Your revenue', feeOut: 'Fees', profit: 'You keep',
    margin: 'Margin', markup: 'Markup', loss: 'This sale loses money.',

    needTitle: 'To actually earn that margin, display',
    needBody: (naive: string, actual: string) =>
      `A generic margin calculator — the kind written where prices are quoted before tax — would tell you to charge SAR ${naive}. Displayed here, that price earns you a margin of ${actual}, not the one you asked for, because the VAT comes out of it and the fee is taken on the whole amount.`,
    unreachable: 'That margin cannot be reached at this fee — the fee alone takes more than what would be left.',

    vatTitle: 'The price you advertise is not the money you receive',
    vatBody: (d: string, n: string, v: string) =>
      `The displayed price must include VAT — the Ministry of Commerce is explicit that a SAR 100 shelf price means a final invoice of no more than SAR 100, and adding tax at the till is a violation. So of the SAR ${d} on your product page, SAR ${v} was never yours: you are holding it for ZATCA. Your revenue is SAR ${n}, and that is the figure a margin means anything against.`,

    markupTitle: 'Markup is not margin, and the gap is not small',
    markupBody: (m: string) =>
      `Markup is a share of what the thing COST you; margin is a share of what you SOLD it for. A 50% markup is a ${m} margin. Both numbers are shown above so the flattering one cannot be mistaken for the useful one — this is reported as one of the commonest pricing errors there is, and it takes a few points off every sale for as long as the price stands.`,

    feeTitle: 'A fee is charged on the gross, including the tax',
    feeBody:
      'A payment gateway or marketplace takes its percentage of the whole transaction, which includes the VAT you are only holding. So a 2.5% fee on a SAR 100 sale is SAR 2.50, not 2.5% of your revenue. If you are registered for VAT, the tax charged on the fee itself is input tax you can generally reclaim — that is between you and your provider, and it is not netted off here.',

    noTableTitle: 'There is no built-in fee table, on purpose',
    noTableBody:
      'Gateway and platform rates differ by provider, by package, by card scheme and by volume, and are frequently negotiated. A number printed here would be one nobody could stand behind. Take the rate from your own provider’s statement — the effective rate you actually paid last month, not the headline one — and put it in the box.',

    vatTool: 'Just the 15% on a figure: VAT Calculator',
    invoiceTool: 'Bill it: Create an Invoice',
    regTool: 'Do you have to register for VAT?',
    caveat:
      'The 15% rate and the requirement to display a VAT-inclusive price are ZATCA’s and the Ministry of Commerce’s published rules. Whether your goods are standard-rated, zero-rated or exempt changes the arithmetic entirely, and this page cannot know which. Your own fee rate, your overheads and anything you have not entered are not in these numbers.',
  },
  ar: {
    intro: 'كم يبقى لك فعلًا من عملية بيع هنا — حيث السعر الذي تعلنه شامل للضريبة أصلًا، والرسوم تُقتطع من كامله. ولا يُرسل شيء إلى أي مكان.',
    cost: 'التكلفة عليك (ريال)',
    displayed: 'السعر المعروض (ريال، شامل الضريبة)',
    fee: 'رسوم الدفع أو المنصة (٪)',
    target: 'هامش الربح المطلوب (٪)',

    vat: 'الضريبة (ليست لك)', net: 'إيرادك', feeOut: 'الرسوم', profit: 'ما يبقى لك',
    margin: 'الهامش', markup: 'نسبة الإضافة على التكلفة', loss: 'هذه العملية خاسرة.',

    needTitle: 'لتحقيق هذا الهامش فعلًا، اعرض السعر',
    needBody: (naive: string, actual: string) =>
      `الحاسبات العامة — المكتوبة حيث تُعرض الأسعار قبل الضريبة — ستقول لك اعرض ${naive} ريال. وهذا السعر معروضًا هنا يحقق لك هامشًا قدره ${actual} لا الهامش الذي طلبته، لأن الضريبة تخرج منه والرسوم تُؤخذ من كامله.`,
    unreachable: 'لا يمكن بلوغ هذا الهامش عند هذه الرسوم — فالرسوم وحدها تأخذ أكثر ممّا سيبقى.',

    vatTitle: 'السعر الذي تعلنه ليس المال الذي تقبضه',
    vatBody: (d: string, n: string, v: string) =>
      `يجب أن يكون السعر المعروض شاملًا للضريبة — ووزارة التجارة صريحة في أن سعر الرف ١٠٠ ريال يعني فاتورة نهائية لا تتجاوز ١٠٠ ريال، وإضافة الضريبة عند الكاشير مخالفة. فمن الـ${d} ريال على صفحة منتجك، ${v} ريال لم تكن لك قط: أنت تحتفظ بها لحساب هيئة الزكاة والضريبة والجمارك. وإيرادك ${n} ريال، وهو الرقم الذي يعني الهامشُ شيئًا بالقياس إليه.`,

    markupTitle: 'نسبة الإضافة ليست الهامش، والفرق ليس يسيرًا',
    markupBody: (m: string) =>
      `نسبة الإضافة تُحسب على ما كلّفك الشيء، والهامش يُحسب على ما بعته به. فإضافة ٥٠٪ هامشها ${m}. والرقمان معروضان أعلاه حتى لا يُؤخذ المطمئنُ منهما مكان النافع — وهذا من أشيع أخطاء التسعير، ويقتطع نقاطًا من كل عملية بيع ما بقي السعر.`,

    feeTitle: 'الرسوم تُحتسب على الإجمالي شاملًا الضريبة',
    feeBody:
      'تأخذ بوابة الدفع أو المنصة نسبتها من كامل قيمة العملية، وهي تشمل الضريبة التي تحتفظ بها لغيرك. فرسوم ٢٫٥٪ على بيع بـ١٠٠ ريال هي ٢٫٥٠ ريال لا ٢٫٥٪ من إيرادك. وإن كنت مسجّلًا في الضريبة فالضريبة المفروضة على الرسوم نفسها ضريبة مدخلات يمكن خصمها عادةً — وذلك بينك وبين مزوّدك، ولم تُخصم هنا.',

    noTableTitle: 'لا يوجد جدول رسوم جاهز، وذلك عن قصد',
    noTableBody:
      'تختلف نسب البوابات والمنصات باختلاف المزوّد والباقة ونوع البطاقة وحجم المبيعات، وكثيرًا ما يجري التفاوض عليها. ورقمٌ يُطبع هنا لن يستطيع أحد أن يقف خلفه. فخذ النسبة من كشف مزوّدك أنت — النسبة الفعلية التي دفعتها الشهر الماضي لا النسبة المعلنة — وضعها في الحقل.',

    vatTool: 'الـ١٥٪ على مبلغ فقط: حاسبة ضريبة القيمة المضافة',
    invoiceTool: 'أصدر الفاتورة: إنشاء فاتورة',
    regTool: 'هل يلزمك التسجيل في الضريبة؟',
    caveat:
      'نسبة ١٥٪ ووجوب عرض السعر شاملًا الضريبة هما من الأنظمة المنشورة لهيئة الزكاة والضريبة والجمارك ووزارة التجارة. أما كون سلعتك خاضعة للنسبة الأساسية أو صفرية أو معفاة فيغيّر الحساب كلّه، وهذه الصفحة لا تعلمه. ونسبة رسومك ومصاريفك العامة وكل ما لم تُدخله ليست داخلة في هذه الأرقام.',
  },
}

export default function PricingTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [cost, setCost] = useState('50')
  const [displayed, setDisplayed] = useState('100')
  const [fee, setFee] = useState('2.5')
  const [target, setTarget] = useState('40')

  const feeRate = (Number(fee) || 0) / 100
  const b = useMemo(() => breakDown({
    cost: Number(cost) || 0,
    displayed: Number(displayed) || 0,
    feeRate,
  }), [cost, displayed, feeRate])

  const targetRate = (Number(target) || 0) / 100
  const need = useMemo(
    () => priceForMargin(Number(cost) || 0, targetRate, feeRate),
    [cost, targetRate, feeRate],
  )
  // What a net-of-tax calculator would say, and what it really earns here.
  const naive = naivePrice(Number(cost) || 0, targetRate)
  const naiveActual = useMemo(
    () => breakDown({ cost: Number(cost) || 0, displayed: Number.isFinite(naive) ? naive : 0, feeRate }),
    [cost, naive, feeRate],
  )

  const loc = locale === 'ar' ? 'ar-SA' : 'en-US'
  const money = (v: number) => v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const pct = (v: number) => `${(v * 100).toLocaleString(loc, { maximumFractionDigits: 1 })}${locale === 'ar' ? '٪' : '%'}`

  return (
    <Stack data-testid="pricing">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={s.cost}>
          <Input type="number" min={0} step={1} className="w-[8rem]" value={cost}
            data-testid="pr-cost" onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label={s.displayed}>
          <Input type="number" min={0} step={1} className="w-[10rem]" value={displayed}
            data-testid="pr-displayed" onChange={(e) => setDisplayed(e.target.value)} />
        </Field>
        <Field label={s.fee}>
          <Input type="number" min={0} step={0.1} className="w-[7rem]" value={fee}
            data-testid="pr-fee" onChange={(e) => setFee(e.target.value)} />
        </Field>
      </div>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.vat}</div>
            <div className="font-mono text-[1.3rem] text-ink" data-testid="pr-vat">{money(b.vat)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.net}</div>
            <div className="font-mono text-[1.3rem] text-ink" data-testid="pr-net">{money(b.net)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.feeOut}</div>
            <div className="font-mono text-[1.3rem] text-ink" data-testid="pr-fee-out">{money(b.fee)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.profit}</div>
            <div className={`font-mono text-[2rem] font-semibold ${b.loss ? 'text-[color:var(--danger)]' : 'text-green-700'}`}
              data-testid="pr-profit">{money(b.profit)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-[0.9rem] text-ink-soft rtl:font-ar">
          <span>{s.margin}: <span className="font-mono text-ink" data-testid="pr-margin">{pct(b.margin)}</span></span>
          <span>{s.markup}: <span className="font-mono text-ink" data-testid="pr-markup">{pct(b.markup)}</span></span>
        </div>
        {b.loss && <p className="text-[0.9rem] text-[color:var(--danger)] rtl:font-ar" data-testid="pr-loss">{s.loss}</p>}
      </Panel>

      {/* The reverse question, which is the one a seller actually has. */}
      <Panel className="gap-2 border-gold-500">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={s.target}>
            <Input type="number" min={0} max={99} step={1} className="w-[7rem]" value={target}
              data-testid="pr-target" onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.needTitle}</div>
            <div className="font-mono text-[2rem] font-semibold text-green-700" data-testid="pr-need">
              {need === null ? '—' : money(need)}
            </div>
          </div>
        </div>
        {need === null
          ? <p className="text-[0.9rem] text-[color:var(--danger)] rtl:font-ar" data-testid="pr-unreachable">{s.unreachable}</p>
          : (
            <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="pr-naive">
              {s.needBody(money(naive), pct(naiveActual.margin))}
            </p>
          )}
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.vatTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="pr-vat-note">
          {s.vatBody(money(Number(displayed) || 0), money(b.net), money(b.vat))}
        </p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.markupTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="pr-markup-note">
          {s.markupBody(pct(markupToMargin(0.5)))}
        </p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.feeTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="pr-fee-note">{s.feeBody}</p>
      </Panel>

      {/* The number it refuses to supply, and why — the `iqama-fees` rule. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.noTableTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="pr-no-table">{s.noTableBody}</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button className="px-3 py-1" to={localePath(locale, '/apps/vat-calculator')} data-testid="pr-vat-tool">{s.vatTool}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/invoice-generator')} data-testid="pr-invoice">{s.invoiceTool}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/vat-registration')} data-testid="pr-reg">{s.regTool}</Button>
      </div>

      <Disclaimer kind="financial" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
