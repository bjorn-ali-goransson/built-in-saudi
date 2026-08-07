import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Field, Input, Stack, Panel, Seg, SegButton, Disclaimer, Button } from '../../components/ui'
import { fromTotals, fromMonths, crossedAt, deadlineFrom, MANDATORY, VOLUNTARY, REGISTER_WITHIN_DAYS } from './vat'

const MONTHS_BACK = 18

const STR = {
  en: {
    intro: 'Whether you have to register for VAT, on the test ZATCA actually applies. Two things catch people out: it is any twelve consecutive months, not your calendar year — so the clock may have started months ago — and exempt supplies do not count towards it while zero-rated ones do.',
    mode: 'How much detail', simple: 'Two totals', detailed: 'Month by month',
    past: 'Taxable turnover, last 12 months',
    next: 'Expected, next 12 months',
    nextHint: 'Expecting to cross in the year ahead makes registration due now — which is how a new business can owe it before it has earned anything.',
    monthly: 'Taxable turnover by month',
    monthlyHint: 'Oldest first. Leave a month blank if there was nothing.',
    clear: 'Clear',
    peak: 'Highest twelve consecutive months',
    verdict: 'Where you stand',
    none: 'No registration required',
    noneBody: `You are below the voluntary threshold of SAR ${VOLUNTARY.toLocaleString('en')}.`,
    voluntary: 'You may register voluntarily',
    voluntaryBody: `You are above SAR ${VOLUNTARY.toLocaleString('en')} but below the mandatory SAR ${MANDATORY.toLocaleString('en')}. Registering is a choice — it lets you reclaim input VAT, and it obliges you to charge and file.`,
    mandatory: 'Registration is mandatory',
    mandatoryBody: `You are at or above SAR ${MANDATORY.toLocaleString('en')}.`,
    byExpectation: 'It is what you expect to earn in the next twelve months that makes this mandatory, not what you have earned.',
    crossed: 'Crossed in',
    deadline: 'Register by',
    deadlineNote: `Registration is due within ${REGISTER_WITHIN_DAYS} days of crossing, and being late carries a SAR 10,000 penalty.`,
    counts: 'What counts',
    countsBody: 'Standard-rated and zero-rated supplies both count towards the threshold. Exempt supplies — such as certain financial services and residential rent — do not. Counting exempt income is the mistake that produces a registration nobody needed.',
    sar: 'SAR',
    disclaimer: 'Thresholds and the test are set by the Zakat, Tax and Customs Authority. What counts as taxable, zero-rated or exempt turns on the detail of what you actually sell — confirm with ZATCA or an accountant before registering or deciding not to.',
  },
  ar: {
    intro: 'هل يلزمك التسجيل في ضريبة القيمة المضافة، وفق الاختبار الذي تطبّقه هيئة الزكاة والضريبة والجمارك فعلًا. أمران يغفل عنهما الناس: العبرة بأي اثني عشر شهرًا متتالية لا بالسنة الميلادية — وقد تكون المهلة بدأت قبل أشهر — وأن التوريدات المعفاة لا تُحتسب بينما تُحتسب الخاضعة بنسبة صفر.',
    mode: 'مستوى التفصيل', simple: 'مجموعان', detailed: 'شهرًا بشهر',
    past: 'الإيرادات الخاضعة، آخر 12 شهرًا',
    next: 'المتوقع، الاثنا عشر شهرًا القادمة',
    nextHint: 'توقّعك تجاوز الحد في السنة القادمة يجعل التسجيل واجبًا الآن — وبهذا قد يلزم منشأةً جديدة قبل أن تكسب شيئًا.',
    monthly: 'الإيرادات الخاضعة شهريًا',
    monthlyHint: 'الأقدم أولًا. واترك الشهر فارغًا إن لم يكن فيه شيء.',
    clear: 'مسح',
    peak: 'أعلى اثني عشر شهرًا متتالية',
    verdict: 'موقفك',
    none: 'لا يلزمك التسجيل',
    noneBody: `أنت دون حد التسجيل الاختياري البالغ ${VOLUNTARY.toLocaleString('ar-SA')} ريال.`,
    voluntary: 'يمكنك التسجيل اختياريًا',
    voluntaryBody: `أنت فوق ${VOLUNTARY.toLocaleString('ar-SA')} ريال ودون الحد الإلزامي ${MANDATORY.toLocaleString('ar-SA')} ريال. والتسجيل خيار — يتيح لك خصم ضريبة المدخلات، ويلزمك بالتحصيل والإقرار.`,
    mandatory: 'التسجيل إلزامي',
    mandatoryBody: `بلغت ${MANDATORY.toLocaleString('ar-SA')} ريال أو تجاوزتها.`,
    byExpectation: 'الذي جعل التسجيل إلزاميًا هو ما تتوقّع كسبه في الاثني عشر شهرًا القادمة، لا ما كسبته.',
    crossed: 'تجاوزت في',
    deadline: 'سجّل قبل',
    deadlineNote: `التسجيل واجب خلال ${REGISTER_WITHIN_DAYS} يومًا من التجاوز، والتأخر عنه غرامته 10,000 ريال.`,
    counts: 'ما الذي يُحتسب',
    countsBody: 'تُحتسب التوريدات الخاضعة للنسبة الأساسية والخاضعة بنسبة صفر كلتاهما ضمن الحد. أما المعفاة — كبعض الخدمات المالية والإيجار السكني — فلا تُحتسب. واحتساب الدخل المعفى هو الخطأ الذي يُنشئ تسجيلًا لم يكن لازمًا.',
    sar: 'ريال',
    disclaimer: 'الحدود والاختبار تحددهما هيئة الزكاة والضريبة والجمارك. وما يُعدّ خاضعًا أو بنسبة صفر أو معفى يتوقّف على تفصيل ما تبيعه فعلًا — فتأكّد من الهيئة أو من محاسب قبل أن تسجّل أو تقرر عدم التسجيل.',
  },
}

export default function VatRegistrationTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 0 })

  const [detailed, setDetailed] = useState(false)
  const [past, setPast] = useState('300000')
  const [next, setNext] = useState('')
  const [months, setMonths] = useState<string[]>(() => Array(MONTHS_BACK).fill(''))

  // Oldest-first labels ending with the current month.
  const labels = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { month: 'short', year: '2-digit' })
    const now = new Date()
    return Array.from({ length: MONTHS_BACK }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1 - i), 1)
      return { text: f.format(d), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) }
    })
  }, [locale])

  const nums = useMemo(() => months.map((m) => Number(m) || 0), [months])
  const v = useMemo(
    () => (detailed ? fromMonths(nums, Number(next) || 0) : fromTotals(Number(past) || 0, Number(next) || 0)),
    [detailed, nums, past, next],
  )
  const crossIndex = detailed ? crossedAt(nums) : null
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium' })

  const tone = v.status === 'mandatory' ? 'text-gold-500' : v.status === 'voluntary' ? 'text-ink' : 'text-green-700'

  return (
    <Stack data-testid="vat-registration">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Field label={s.mode}>
        <Seg data-testid="vr-mode">
          <SegButton active={!detailed} onClick={() => setDetailed(false)} data-testid="vr-simple">{s.simple}</SegButton>
          <SegButton active={detailed} onClick={() => setDetailed(true)} data-testid="vr-detailed">{s.detailed}</SegButton>
        </Seg>
      </Field>

      {!detailed ? (
        <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
          <Field label={s.past}>
            <Input type="number" inputMode="decimal" min="0" value={past} data-testid="vr-past" onChange={(e) => setPast(e.target.value)} />
          </Field>
          <Field label={s.next}>
            <Input type="number" inputMode="decimal" min="0" value={next} data-testid="vr-next" onChange={(e) => setNext(e.target.value)} />
          </Field>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.monthly}</h2>
            <Button className="px-2 py-0.5 text-[0.78rem]" data-testid="vr-clear" onClick={() => setMonths(Array(MONTHS_BACK).fill(''))}>{s.clear}</Button>
          </div>
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.monthlyHint}</p>
          <div className="grid gap-2 grid-cols-2 min-[560px]:grid-cols-3 min-[900px]:grid-cols-6">
            {labels.map((l, i) => (
              <label key={i} className={`flex flex-col gap-0.5 rounded-md border px-2 py-1 ${crossIndex === i ? 'border-gold-500' : 'border-[color:var(--line)]'}`}>
                <span className="text-[0.7rem] text-ink-faint">{l.text}</span>
                <input type="number" inputMode="decimal" min="0" value={months[i]} data-testid={`vr-m-${i}`}
                  className="w-full border-0 bg-transparent p-0 font-mono text-[0.85rem] text-ink outline-none"
                  onChange={(e) => setMonths((p) => p.map((x, k) => (k === i ? e.target.value : x)))} />
              </label>
            ))}
          </div>
          <Field label={s.next}>
            <Input type="number" inputMode="decimal" min="0" value={next} data-testid="vr-next" onChange={(e) => setNext(e.target.value)} />
          </Field>
        </div>
      )}
      <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.nextHint}</p>

      <Panel className="gap-2">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.verdict}</h2>
        <p className={`font-display text-[1.35rem] leading-tight rtl:font-ar ${tone}`} data-testid="vr-status">
          {v.status === 'mandatory' ? s.mandatory : v.status === 'voluntary' ? s.voluntary : s.none}
        </p>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="vr-body">
          {v.status === 'mandatory' ? s.mandatoryBody : v.status === 'voluntary' ? s.voluntaryBody : s.noneBody}
        </p>
        {v.byExpectation && <p className="text-[0.88rem] text-ink rtl:font-ar" data-testid="vr-expected">{s.byExpectation}</p>}
        <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1">
          <span className="text-[0.85rem] text-ink-faint">{s.peak}: <span className="font-mono text-ink" data-testid="vr-peak">{fmt(v.peak)} {s.sar}</span></span>
          {crossIndex !== null && (
            <>
              <span className="text-[0.85rem] text-ink-faint">{s.crossed}: <span className="font-mono text-ink" data-testid="vr-crossed">{labels[crossIndex].text}</span></span>
              <span className="text-[0.85rem] text-ink-faint">{s.deadline}: <span className="font-mono text-gold-500" data-testid="vr-deadline">{dateFmt.format(deadlineFrom(labels[crossIndex].end))}</span></span>
            </>
          )}
        </div>
        {v.status === 'mandatory' && <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="vr-deadline-note">{s.deadlineNote}</p>}
      </Panel>

      <Panel className="gap-1">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.counts}</h2>
        <p className="text-[0.88rem] text-ink-soft rtl:font-ar" data-testid="vr-counts">{s.countsBody}</p>
      </Panel>

      <Disclaimer kind="legal" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
