import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Field, Input, Stack, Panel, Disclaimer } from '../../components/ui'
import { settle } from './settle'

const STR = {
  en: {
    intro: 'What it costs to pay a personal finance off early, and what it saves you. The rule is the opposite of what most people assume: settling early does not mean paying the rest of the term cost. You pay the outstanding balance plus the term cost for the three months following — and the rest is waived.',
    principal: 'Amount financed', rate: 'Annual rate (%)', months: 'Term (months)', paid: 'Payments made',
    monthly: 'Monthly payment',
    settleNow: 'To settle today',
    balance: 'Outstanding balance', compensation: 'Three months’ term cost', remaining: 'Payments left',
    ifContinued: 'If you keep paying',
    saving: 'You save',
    savingNote: 'This is the figure that decides it, and the one a settlement quote does not put in front of you.',
    capped: 'The three months is a ceiling',
    cappedBody: 'The lender may charge no more than the term cost for the three months following repayment, worked out on the declining balance. If a quote is higher than the figure above, that is worth asking about.',
    sar: 'SAR',
    disclaimer: 'Worked out from the figures you entered, on a standard declining-balance schedule. Your contract may include administrative fees or insurance that this cannot see, and the exact balance is the lender’s record — ask them for a settlement quote and compare it with this rather than instead of it. The three-month ceiling is SAMA’s rule.',
  },
  ar: {
    intro: 'كم يكلّفك سداد التمويل الشخصي مبكرًا، وكم يوفّر عليك. والقاعدة عكس ما يظنه أكثر الناس: فالسداد المبكر لا يعني دفع بقية تكلفة الأجل. إنما تدفع الرصيد القائم مع تكلفة أجل ثلاثة أشهر تالية — ويُسقط الباقي.',
    principal: 'مبلغ التمويل', rate: 'النسبة السنوية (%)', months: 'المدة (بالأشهر)', paid: 'الأقساط المدفوعة',
    monthly: 'القسط الشهري',
    settleNow: 'للسداد اليوم',
    balance: 'الرصيد القائم', compensation: 'تكلفة أجل ثلاثة أشهر', remaining: 'الأقساط المتبقية',
    ifContinued: 'إن واصلت السداد',
    saving: 'توفّر',
    savingNote: 'هذا هو الرقم الذي يحسم الأمر، وهو الذي لا يضعه أمامك عرض السداد.',
    capped: 'الثلاثة أشهر حدٌّ أعلى',
    cappedBody: 'لا يجوز للممول أن يأخذ أكثر من تكلفة أجل الأشهر الثلاثة التالية للسداد، محسوبة على الرصيد المتناقص. فإن جاءك عرض أعلى من الرقم أعلاه فالسؤال عنه في محله.',
    sar: 'ريال',
    disclaimer: 'محسوب من الأرقام التي أدخلتها، على جدول رصيد متناقص معتاد. وقد يتضمن عقدك رسومًا إدارية أو تأمينًا لا تراه هذه الأداة، والرصيد الدقيق في سجل الممول — فاطلب منه عرض سداد وقابله بهذا لا أن تستغني به عنه. وحدّ الأشهر الثلاثة قاعدة مؤسسة النقد.',
  },
}

export default function EarlySettlementTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 })

  const [principal, setPrincipal] = useState('150000')
  const [rate, setRate] = useState('6.5')
  const [months, setMonths] = useState('60')
  const [paid, setPaid] = useState('24')

  const r = useMemo(() => settle({
    principal: Number(principal) || 0,
    annualRate: Number(rate) || 0,
    months: Number(months) || 1,
    paid: Number(paid) || 0,
  }), [principal, rate, months, paid])

  return (
    <Stack data-testid="early-settlement">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-4">
        <Field label={s.principal}>
          <Input type="number" inputMode="decimal" min="0" value={principal} data-testid="es-principal" onChange={(e) => setPrincipal(e.target.value)} />
        </Field>
        <Field label={s.rate}>
          <Input type="number" inputMode="decimal" min="0" step="0.1" value={rate} data-testid="es-rate" onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label={s.months}>
          <Input type="number" inputMode="numeric" min="1" value={months} data-testid="es-months" onChange={(e) => setMonths(e.target.value)} />
        </Field>
        <Field label={s.paid}>
          <Input type="number" inputMode="numeric" min="0" value={paid} data-testid="es-paid" onChange={(e) => setPaid(e.target.value)} />
        </Field>
      </div>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.settleNow}</div>
            <div className="font-mono text-[1.4rem] font-semibold text-ink" data-testid="es-total">{fmt(r.total)} {s.sar}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.ifContinued}</div>
            <div className="font-mono text-[1.15rem] text-ink-soft" data-testid="es-continued">{fmt(r.ifContinued)} {s.sar}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.saving}</div>
            <div className="font-mono text-[1.4rem] font-semibold text-green-700" data-testid="es-saving">{fmt(r.saving)} {s.sar}</div>
          </div>
        </div>
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.savingNote}</p>
      </Panel>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-4 text-[0.85rem]">
        {[
          { label: s.monthly, value: r.monthly, id: 'es-monthly' },
          { label: s.balance, value: r.balance, id: 'es-balance' },
          { label: s.compensation, value: r.compensation, id: 'es-compensation' },
        ].map((x) => (
          <div key={x.id} className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2">
            <div className="text-ink-faint rtl:font-ar">{x.label}</div>
            <div className="font-mono text-ink" data-testid={x.id}>{fmt(x.value)} {s.sar}</div>
          </div>
        ))}
        <div className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2">
          <div className="text-ink-faint rtl:font-ar">{s.remaining}</div>
          <div className="font-mono text-ink" data-testid="es-remaining">{r.remaining}</div>
        </div>
      </div>

      <Panel className="gap-1">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.capped}</h2>
        <p className="text-[0.88rem] text-ink-soft rtl:font-ar" data-testid="es-cap">{s.cappedBody}</p>
      </Panel>

      <Disclaimer kind="financial" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
