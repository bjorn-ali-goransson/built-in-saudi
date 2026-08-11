import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Check, Disclaimer } from '../../components/ui'
import {
  computeRett, EXEMPT_KINDS, FIRST_HOME_MAX_RELIEF, FIRST_HOME_VALUE_CAP,
  LATE_CAP, LATE_RATE, MONTHS_TO_CAP, RETT_RATE,
} from './rett'

const EXEMPT_LABEL: Record<string, { en: string; ar: string }> = {
  inheritance: { en: 'Dividing an inheritance between heirs', ar: 'تقسيم إرث بين الوَرَثة' },
  gift: { en: 'A gift to a relative within the degree of kinship the Law states', ar: 'هبة لقريب داخل درجة القرابة التي يحدّدها النظام' },
  endowment: { en: 'Placing a property into an endowment (waqf)', ar: 'إدخال العقار في وقف' },
  government: { en: 'A transfer to a government or public-benefit entity', ar: 'نقل لجهة حكومية أو ذات نفع عام' },
  restructuring: { en: 'A merger, demerger or group restructuring', ar: 'اندماج أو انفصال أو إعادة هيكلة داخل مجموعة' },
  securities: { en: 'Trading listed securities or investment-fund units', ar: 'تداول أوراق مالية مدرجة أو وحدات صناديق' },
  inKind: { en: 'A contribution in kind into a company’s capital', ar: 'حصة عينية في رأس مال شركة' },
  repossession: { en: 'A financier taking back a property under a finance contract', ar: 'استرداد الممول للعقار بموجب عقد تمويل' },
}

const STR = {
  en: {
    intro: 'What the 5% property tax comes to when you sell or transfer a property — and the 15% VAT that does NOT also apply. Nothing is sent anywhere.',
    value: 'Value of the disposal (SAR)',
    firstHome: 'A Saudi citizen’s first home, with the Sakani certificate',
    late: 'Months late (if the tax was not paid on time)',
    gross: `Tax at ${RETT_RATE * 100}%`,
    relief: 'The state bears',
    owed: 'You owe',
    penalty: 'Late penalty',
    total: 'Total to pay',
    ofValue: (p: string) => `${p}% of the value`,
    fullyBorne: 'The state bears the whole of it — nothing to pay.',

    vatTitle: 'The 15% VAT does NOT also apply',
    vatBody:
      'RETT replaced VAT on real estate in October 2020; it did not join it. Adding both is the commonest way a property budget goes wrong — one tax, once, on the disposal.',
    vatOver: (v: string) => `Budgeting 5% + 15% overstates the tax by SAR ${v}.`,

    taperTitle: 'The first-home relief is a taper, not a cliff',
    taperBody: (cap: string, max: string) =>
      `A first home over SAR ${cap} is not disqualified. The state bears the tax on the first SAR ${cap} — a maximum of SAR ${max} — and you pay ${RETT_RATE * 100}% on the rest. That is the opposite of the customs threshold, where one riyal over means the duty falls on the whole value, so knowing one rule tells you nothing about the other.`,
    taperNow: (borne: string, rest: string, owed: string) =>
      `Here: SAR ${borne} borne by the state on the first million, and ${RETT_RATE * 100}% of the remaining SAR ${rest} — SAR ${owed} — is yours.`,

    penaltyTitle: 'The late penalty is 2% a month, not the 5% much of the web still prints',
    penaltyBody:
      `The penalty is ${LATE_RATE * 100}% of the unpaid tax for each month or part of a month, capped at ${LATE_CAP * 100}% of it however long it runs — so it stops growing after ${MONTHS_TO_CAP} months. Guides and news pieces widely still quote 5% a month, which was the earlier figure: this is a rule that moved in the taxpayer’s favour and a lot of copy that never caught up. Check your own figure against ZATCA rather than against an article.`,
    cappedNote: `The cap is what decided this — ${LATE_CAP * 100}% of the tax, reached at ${MONTHS_TO_CAP} months.`,

    whoTitle: 'The seller is the taxable person, and the deed waits on the payment',
    whoBody:
      'The Law puts the tax on the disposer — the seller — not on the buyer, though a contract can and often does move who actually hands over the money. What it cannot move is the sequence: the notary will not document the transfer without a valid, paid RETT reference, so this is not a bill that arrives later. A buyer paying it on the seller’s behalf is settling somebody else’s tax, which is worth writing into the contract rather than assuming.',

    exemptTitle: 'Whether a disposal is exempt is not decided here',
    exemptBody:
      'The Law carries a long schedule of exempt cases, each with conditions — a degree of kinship, a holding period, the purpose of the transfer — that this page cannot see. They are named here so you know to ask, not so this page can tell you the answer. An exemption is claimed in the declaration and is ZATCA’s to accept.',
    exemptAfter:
      'An exemption whose conditions later fail becomes payable, so a transfer made on the strength of one is worth keeping the paperwork for.',

    vatTool: 'VAT on a normal purchase: VAT Calculator',
    rentTool: 'Renting rather than buying: Rent Rules',
    zakatTool: 'Zakat on property held for trade: Zakat Calculator',
    caveat:
      'The 5% rate, the SAR 1,000,000 first-home ceiling and the 2% monthly penalty are ZATCA’s and the Ministry of Municipalities and Housing’s published figures, in force since 10 April 2025 under Royal Decree M/84 — but whether a particular disposal is taxable, exempt or valued at more than the price on the contract is ZATCA’s to decide, and the Authority may assess a fair market value of its own. Check the Real Estate Transaction Tax portal before you sign, and Sakani for the first-home certificate.',
  },
  ar: {
    intro: 'كم تبلغ ضريبة التصرفات العقارية ٥٪ عند بيع عقار أو نقل ملكيته — وضريبة القيمة المضافة ١٥٪ التي لا تُضاف إليها. ولا يُرسل شيء إلى أي مكان.',
    value: 'قيمة التصرف (ريال)',
    firstHome: 'مسكن أول لمواطن سعودي، مع شهادة سكني',
    late: 'أشهر التأخير (إن لم تُسدَّد الضريبة في وقتها)',
    gross: 'الضريبة بنسبة ٥٪',
    relief: 'تتحمّل الدولة',
    owed: 'ما تدفعه',
    penalty: 'غرامة التأخير',
    total: 'الإجمالي المستحق',
    ofValue: (p: string) => `${p}٪ من القيمة`,
    fullyBorne: 'تتحمّلها الدولة بكاملها — لا شيء عليك.',

    vatTitle: 'ضريبة القيمة المضافة ١٥٪ لا تُضاف',
    vatBody:
      'حلّت ضريبة التصرفات العقارية محلّ ضريبة القيمة المضافة على العقار في أكتوبر ٢٠٢٠، ولم تُضَف إليها. وجمع النسبتين هو أشيع خطأ في ميزانية عقارية: ضريبة واحدة، مرّة واحدة، على التصرف.',
    vatOver: (v: string) => `حساب ٥٪ + ١٥٪ يزيد الضريبة بـ${v} ريال عمّا هي عليه.`,

    taperTitle: 'إعفاء المسكن الأول تدرّج لا عتبة',
    taperBody: (cap: string, max: string) =>
      `المسكن الأول الذي تتجاوز قيمته ${cap} ريال لا يخرج من الإعفاء. تتحمّل الدولة الضريبة عن أول ${cap} ريال — بحد أقصى ${max} ريال — وتدفع أنت ٥٪ على الباقي. وهذا عكس الحدّ الجمركي، حيث ريال واحد فوق الحدّ يجعل الرسوم على القيمة كاملة؛ فمعرفة أحد الحكمين لا تُغني عن الآخر.`,
    taperNow: (borne: string, rest: string, owed: string) =>
      `هنا: ${borne} ريال تتحمّلها الدولة عن أول مليون، و٥٪ من الباقي ${rest} ريال — أي ${owed} ريال — عليك.`,

    penaltyTitle: 'غرامة التأخير ٢٪ شهريًا لا ٥٪ كما يُنشر في كثير من المواقع',
    penaltyBody:
      'الغرامة ٢٪ من الضريبة غير المسدَّدة عن كل شهر أو جزء منه، بحد أقصى ٥٠٪ منها مهما طال التأخير — فتتوقّف عن النمو بعد ٢٥ شهرًا. ولا تزال أدلّة ومقالات كثيرة تذكر ٥٪ شهريًا، وهي النسبة السابقة: حكمٌ تغيّر لمصلحة المكلَّف ولم يلحق به كثير من المنشور. فتحقّق من رقمك عند هيئة الزكاة والضريبة والجمارك لا من مقال.',
    cappedNote: 'الحدّ الأقصى هو ما حدّد الرقم هنا — ٥٠٪ من الضريبة، ويُبلَغ عند ٢٥ شهرًا.',

    whoTitle: 'المكلَّف هو البائع، والإفراغ ينتظر السداد',
    whoBody:
      'يضع النظام الضريبة على المتصرِّف — أي البائع — لا على المشتري، وإن كان العقد قد ينقل من يدفعها فعلًا وكثيرًا ما يفعل. أما ما لا ينقله العقد فهو الترتيب: لا يوثّق كاتب العدل النقل دون رقم مرجعي ساري ومسدَّد، فهذه ليست فاتورة تأتي لاحقًا. والمشتري الذي يدفعها عن البائع يسدّد ضريبة غيره، وهو ما يُكتب في العقد لا يُفترض.',

    exemptTitle: 'لا تُقرَّر هنا مسألة الإعفاء',
    exemptBody:
      'يحمل النظام قائمة طويلة من حالات الإعفاء، لكل منها شروط — درجة قرابة، أو مدة حَوز، أو غرض النقل — لا تراها هذه الصفحة. وهي مذكورة هنا لتعرف أن تسأل، لا ليقول لك هذا الموقع الجواب. فالإعفاء يُطلَب في الإقرار، وقبوله للهيئة.',
    exemptAfter:
      'والإعفاء الذي تسقط شروطه لاحقًا تصير الضريبة مستحقة عليه، فالتصرف المبني عليه يستحق الاحتفاظ بمستنداته.',

    vatTool: 'الضريبة على شراء عادي: حاسبة ضريبة القيمة المضافة',
    rentTool: 'الإيجار بدل الشراء: أحكام الإيجار',
    zakatTool: 'زكاة العقار المعروض للتجارة: حاسبة الزكاة',
    caveat:
      'نسبة ٥٪، وحدّ المليون ريال للمسكن الأول، وغرامة ٢٪ الشهرية هي الأرقام المنشورة لهيئة الزكاة والضريبة والجمارك ووزارة البلديات والإسكان، السارية من ١٠ أبريل ٢٠٢٥ بالمرسوم الملكي م/٨٤ — أما كون تصرف بعينه خاضعًا أو معفيًا أو مقوَّمًا بأكثر من ثمن العقد فذلك للهيئة، ولها أن تُقدّر قيمة سوقية عادلة من عندها. فراجع بوابة ضريبة التصرفات العقارية قبل التوقيع، وسكني لشهادة المسكن الأول.',
  },
}

export default function RettTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [value, setValue] = useState('1500000')
  const [firstHome, setFirstHome] = useState(false)
  const [late, setLate] = useState('0')

  const r = useMemo(() => computeRett({
    value: Number(value) || 0,
    firstHome,
    monthsLate: Number(late) || 0,
  }), [value, firstHome, late])

  const loc = locale === 'ar' ? 'ar-SA' : 'en-US'
  const money = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 2 })
  const pct = (v: number) =>
    (v * 100).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const effective = (Number(value) || 0) > 0 ? r.tax / (Number(value) || 1) : 0

  return (
    <Stack data-testid="rett">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={s.value}>
          <Input type="number" min={0} step={50000} className="w-[10rem]" value={value}
            data-testid="rt-value" onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label={s.late}>
          <Input type="number" min={0} step={1} className="w-[7rem]" value={late}
            data-testid="rt-late" onChange={(e) => setLate(e.target.value)} />
        </Field>
      </div>
      <Check>
        <input type="checkbox" checked={firstHome} data-testid="rt-first-home"
          onChange={(e) => setFirstHome(e.target.checked)} /> {s.firstHome}
      </Check>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.gross}</div>
            <div className="font-mono text-[1.3rem] text-ink" data-testid="rt-gross">{money(r.grossTax)}</div>
          </div>
          {r.relief > 0 && (
            <div>
              <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.relief}</div>
              <div className="font-mono text-[1.3rem] text-green-700" data-testid="rt-relief">{money(r.relief)}</div>
            </div>
          )}
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.owed}</div>
            <div className="font-mono text-[2rem] font-semibold text-green-700" data-testid="rt-tax">{money(r.tax)}</div>
            <div className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="rt-effective">{s.ofValue(pct(effective))}</div>
          </div>
          {r.penalty > 0 && (
            <div>
              <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.penalty}</div>
              <div className="font-mono text-[1.3rem] text-ink" data-testid="rt-penalty">{money(r.penalty)}</div>
            </div>
          )}
        </div>
        <div className="text-[0.9rem] text-ink-soft rtl:font-ar">
          {s.total}: <span className="font-mono text-ink" data-testid="rt-total">{money(r.total)}</span>
        </div>
        {r.tax === 0 && r.relief > 0 && (
          <p className="text-[0.9rem] text-green-700 rtl:font-ar" data-testid="rt-fully-borne">{s.fullyBorne}</p>
        )}
        {r.penaltyCapped && (
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="rt-capped">{s.cappedNote}</p>
        )}
      </Panel>

      {/* The belief the tool exists to correct, first. */}
      <Panel className="gap-1 border-gold-500">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.vatTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="rt-vat">
          {s.vatBody}{' '}
          {r.vatOverstatement > 0 ? <span data-testid="rt-vat-over">{s.vatOver(money(r.vatOverstatement))}</span> : null}
        </p>
      </Panel>

      {/* A taper, and the contrast with the customs cliff. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.taperTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="rt-taper">
          {s.taperBody(money(FIRST_HOME_VALUE_CAP), money(FIRST_HOME_MAX_RELIEF))}
        </p>
        {r.aboveFirstHomeCap && (
          <p className="text-[0.9rem] text-ink rtl:font-ar" data-testid="rt-taper-now">
            {s.taperNow(money(r.relief), money((Number(value) || 0) - FIRST_HOME_VALUE_CAP), money(r.tax))}
          </p>
        )}
      </Panel>

      {/* A figure the web has stale, which is the reason for the beta badge. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.penaltyTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="rt-penalty-note">{s.penaltyBody}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.whoTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="rt-who">{s.whoBody}</p>
      </Panel>

      {/* What it refuses to decide, and why — the `iqama-fees` rule. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.exemptTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="rt-exempt">{s.exemptBody}</p>
        <ul className="ms-5 list-disc text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="rt-exempt-list">
          {EXEMPT_KINDS.map((k) => <li key={k}>{EXEMPT_LABEL[k][locale]}</li>)}
        </ul>
        <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="rt-exempt-after">{s.exemptAfter}</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button className="px-3 py-1" to={localePath(locale, '/apps/vat-calculator')} data-testid="rt-vat-tool">{s.vatTool}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/rent-rules')} data-testid="rt-rent">{s.rentTool}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/zakat-calculator')} data-testid="rt-zakat">{s.zakatTool}</Button>
      </div>

      <Disclaimer kind="official" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
