import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Field, Input, Stack, Panel, Seg, SegButton, Check, Disclaimer } from '../../components/ui'
import { quote, PERIODS, DEPENDENT_MONTH, LATE_PENALTIES, type Period } from './iqama'

const STR = {
  en: {
    intro: 'What renewing an iqama costs a family, and who is supposed to pay it. The fee people forget is not the iqama — it is the dependent fee, charged per person per month and collected up front for the whole period.',
    period: 'Renewing for', months: (n: number) => `${n} months`, year: '1 year',
    dependents: 'Dependents on your iqama',
    dependentsHint: 'Spouse and children sponsored under you. Not counting yourself.',
    domestic: 'Domestic worker (lower iqama fee)',
    total: 'Due up front', iqamaFee: 'Iqama fee', depFee: 'Dependent fees',
    sar: 'SAR',
    breakdown: (n: number, months: number, each: number) =>
      `${n} × ${each} SAR per month × ${months} months`,
    shock: (share: number) => `${share}% of what you pay is the dependent fee, not the iqama.`,
    none: 'With no dependents the renewal is the iqama fee alone.',
    lever: 'Paying quarterly',
    leverBody: (q: number, y: number) =>
      `The iqama fee is exactly pro rata, so four quarterly renewals cost the same ${y} SAR a year in iqama fee as one annual renewal — but each payment is ${q} SAR instead of the full year at once. It does not reduce the total; it splits it.`,
    leverOff: 'You are already on the shortest period, so this is as split as the payments get.',
    who: 'The work permit levy is not yours to pay',
    whoBody: 'The monthly work permit levy (maktab amal) is charged to your employer, and its rate depends on their Saudization band — not on anything you can see or change. Article 40 of the Labour Law forbids passing iqama and work permit fees to the worker. If it is being deducted from your salary, that is the thing to query, and it is worth more than any number on this page.',
    late: 'Renewing late',
    lateBody: (a: string, b: string, c: string) =>
      `Penalties escalate per offence: ${a} SAR, then ${b} SAR, then ${c} SAR — and at the third there is a deportation risk. The renewal window is worth a reminder well before the day.`,
    disclaimer: 'Fees as published for the standard case: 650 SAR a year for the iqama and 400 SAR per dependent per month. Your employer may add their own charges, some pay a small Absher Business processing fee, and medical insurance is separate and priced by age and plan. The work permit levy is deliberately not calculated here — published rates disagree, it is set by your employer’s band, and it is not the worker’s to pay. Absher and Muqeem are the record.',
  },
  ar: {
    intro: 'كم يكلّف تجديد الإقامة أسرةً، ومن الذي يفترض أن يدفع. والرسم الذي ينساه الناس ليس الإقامة، بل رسم المرافقين: يُحتسب عن كل فرد شهريًا ويُدفع كاملًا مقدمًا عن المدة كلها.',
    period: 'التجديد لمدة', months: (n: number) => `${n} أشهر`, year: 'سنة',
    dependents: 'المرافقون على إقامتك',
    dependentsHint: 'الزوجة والأبناء تحت كفالتك. من دونك أنت.',
    domestic: 'عامل منزلي (رسم إقامة أقل)',
    total: 'المستحق مقدمًا', iqamaFee: 'رسم الإقامة', depFee: 'رسوم المرافقين',
    sar: 'ريال',
    breakdown: (n: number, months: number, each: number) =>
      `${n} × ${each} ريال شهريًا × ${months} أشهر`,
    shock: (share: number) => `${share}٪ مما تدفعه رسوم مرافقين لا رسم إقامة.`,
    none: 'من دون مرافقين يكون التجديد رسم الإقامة وحده.',
    lever: 'الدفع كل ثلاثة أشهر',
    leverBody: (q: number, y: number) =>
      `رسم الإقامة تناسبي تمامًا، فأربعة تجديدات ربعية تكلّف ${y} ريال في السنة كما التجديد السنوي تمامًا — لكن كل دفعة ${q} ريال بدل السنة كاملة دفعةً واحدة. فهو لا يقلّل الإجمالي بل يقسّمه.`,
    leverOff: 'أنت على أقصر مدة أصلًا، فالدفعات مقسّمة إلى أبعد حد.',
    who: 'رسم رخصة العمل ليس عليك',
    whoBody: 'رسم مكتب العمل الشهري يُحتسب على صاحب العمل، ونسبته تتبع نطاق السعودة عنده — لا شيئًا تراه أنت أو تغيّره. والمادة الأربعون من نظام العمل تمنع تحميل العامل رسوم الإقامة ورخصة العمل. فإن كان يُخصم من راتبك فهذا ما يستحق المراجعة، وهو أنفع من أي رقم في هذه الصفحة.',
    late: 'التجديد المتأخر',
    lateBody: (a: string, b: string, c: string) =>
      `الغرامات تتصاعد مع التكرار: ${a} ريال ثم ${b} ريال ثم ${c} ريال — وفي الثالثة احتمال ترحيل. ويستحق موعد التجديد تذكيرًا قبل يومه بوقت.`,
    disclaimer: 'الرسوم كما هي منشورة للحالة المعتادة: 650 ريالًا سنويًا للإقامة و400 ريال لكل مرافق شهريًا. وقد يضيف صاحب العمل رسومًا خاصة به، ويدفع بعضهم رسم معالجة يسيرًا عبر أبشر أعمال، والتأمين الطبي منفصل وسعره بحسب العمر والبرنامج. ورسم رخصة العمل غير محسوب هنا عمدًا — فالمنشور متضارب، ونسبته تتبع نطاق صاحب العمل، وليست على العامل أصلًا. والمرجع أبشر ومقيم.',
  },
}

export default function IqamaFeesTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')

  const [months, setMonths] = useState<Period>(12)
  const [dependents, setDependents] = useState('2')
  const [domestic, setDomestic] = useState(false)

  const deps = Math.max(0, Math.min(20, Math.floor(Number(dependents) || 0)))
  const q = useMemo(() => quote(months, deps, domestic), [months, deps, domestic])
  const quarter = useMemo(() => quote(3, deps, domestic), [deps, domestic])

  return (
    <Stack data-testid="iqama-fees">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
        <Field label={s.period}>
          <Seg data-testid="if-period">
            {PERIODS.map((p) => (
              <SegButton
                key={p}
                active={months === p}
                onClick={() => setMonths(p)}
                data-testid={`if-period-${p}`}
              >
                {p === 12 ? s.year : s.months(p)}
              </SegButton>
            ))}
          </Seg>
        </Field>
        <Field label={s.dependents}>
          <Input
            type="number"
            min={0}
            max={20}
            value={dependents}
            data-testid="if-dependents"
            onChange={(e) => setDependents(e.target.value)}
          />
          <span className="text-[0.78rem] font-normal text-ink-faint rtl:font-ar">{s.dependentsHint}</span>
        </Field>
      </div>

      <Check>
        <input
          type="checkbox"
          checked={domestic}
          data-testid="if-domestic"
          onChange={(e) => setDomestic(e.target.checked)}
        />
        {s.domestic}
      </Check>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.total}</div>
            <div className="font-mono text-[1.5rem] font-semibold text-green-700" data-testid="if-total">{fmt(q.total)} {s.sar}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.iqamaFee}</div>
            <div className="font-mono text-[1.15rem] text-ink" data-testid="if-iqama">{fmt(q.iqama)} {s.sar}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.depFee}</div>
            <div className="font-mono text-[1.15rem] text-ink" data-testid="if-dependents-total">{fmt(q.dependentTotal)} {s.sar}</div>
          </div>
        </div>
        {q.dependents > 0 ? (
          <>
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="if-breakdown">
              {s.breakdown(q.dependents, q.months, DEPENDENT_MONTH)}
            </p>
            <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="if-shock">
              {s.shock(Math.round(q.dependentShare * 100))}
            </p>
          </>
        ) : (
          <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="if-none">{s.none}</p>
        )}
      </Panel>

      <Panel className="gap-1" data-testid="if-lever">
        <p className="font-display text-[1.05rem] rtl:font-ar">{s.lever}</p>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar">
          {months === 3 ? s.leverOff : s.leverBody(quarter.total, q.yearTotal - DEPENDENT_MONTH * 12 * q.dependents)}
        </p>
      </Panel>

      <Panel className="gap-1 border-gold-500" data-testid="if-who">
        <p className="font-display text-[1.2rem] text-gold-500 rtl:font-ar">{s.who}</p>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.whoBody}</p>
      </Panel>

      <Panel className="gap-1" data-testid="if-late">
        <p className="font-display text-[1.05rem] rtl:font-ar">{s.late}</p>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.lateBody(fmt(LATE_PENALTIES[0]), fmt(LATE_PENALTIES[1]), fmt(LATE_PENALTIES[2]))}</p>
      </Panel>

      <Disclaimer kind="official" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
