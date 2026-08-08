import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Field, Input, Stack, Panel, Seg, SegButton, Disclaimer } from '../../components/ui'
import { quote, againstIqama, daysBetween, TERMS, type VisaKind, type ExtendFrom } from './visa'

const STR = {
  en: {
    intro: 'What an exit and re-entry visa costs for the trip you are actually taking. Two things catch people: months are charged in whole 30-day blocks, so 31 days costs the same as 60 and 61 costs a month more; and the visa cannot outrun your iqama, so a trip that returns after it expires is not a dearer visa but no visa at all.',
    kind: 'Visa', single: 'Single', multiple: 'Multiple',
    depart: 'Leaving', ret: 'Coming back', iqama: 'Iqama expires',
    from: 'Applying from', inside: 'Inside the Kingdom', outside: 'From abroad',
    fromHint: 'Extending from abroad costs double for each extra month.',
    total: 'Total', trip: 'Trip length', charged: 'Charged as',
    days: 'days', months: (n: number) => `${n} month${n === 1 ? '' : 's'}`,
    breakdown: 'Base', extra: 'Extra months', each: 'each',
    included: (n: number) => `covers ${n} month${n === 1 ? '' : 's'}`,
    edge: (d: number, cost: number) => `${d} more day${d === 1 ? '' : 's'} and it costs another ${cost} SAR — the price steps every 30 days, not gradually.`,
    blocked: 'Your iqama expires first',
    blockedBody: (n: number, max: number) => `The trip runs ${n} day${n === 1 ? '' : 's'} past your iqama, and the visa cannot be issued beyond it. The longest trip this iqama allows is ${max} days — renew it first, then apply.`,
    sar: 'SAR',
    disclaimer: 'Fees as published for the standard case. Yours can differ — a sponsor may add their own charges, and unpaid fines or an expired passport can block the application for reasons no fee table shows. Absher and Muqeem are the record.',
  },
  ar: {
    intro: 'كم تكلّف تأشيرة الخروج والعودة للرحلة التي ستسافرها فعلًا. وأمران يغفل عنهما الناس: الأشهر تُحتسب كتلًا كاملة من ثلاثين يومًا، فـ31 يومًا كـ60 يومًا في السعر و61 يومًا تزيد شهرًا؛ والتأشيرة لا تتجاوز إقامتك، فالرحلة التي تعود بعد انتهائها ليست تأشيرة أغلى بل لا تأشيرة أصلًا.',
    kind: 'التأشيرة', single: 'مفردة', multiple: 'متعددة',
    depart: 'المغادرة', ret: 'العودة', iqama: 'انتهاء الإقامة',
    from: 'التقديم من', inside: 'داخل المملكة', outside: 'من الخارج',
    fromHint: 'التمديد من الخارج يكلّف ضعف قيمة الشهر الإضافي.',
    total: 'الإجمالي', trip: 'مدة الرحلة', charged: 'تُحتسب',
    days: 'يومًا', months: (n: number) => `${n} شهرًا`,
    breakdown: 'الأساسي', extra: 'أشهر إضافية', each: 'للشهر',
    included: (n: number) => `يشمل ${n} أشهر`,
    edge: (d: number, cost: number) => `${d} يومًا إضافيًا وتزيد ${cost} ريال — فالسعر يقفز كل ثلاثين يومًا لا تدريجيًا.`,
    blocked: 'إقامتك تنتهي أولًا',
    blockedBody: (n: number, max: number) => `الرحلة تتجاوز إقامتك بـ${n} يومًا، ولا تُصدر التأشيرة بعدها. وأطول رحلة تسمح بها هذه الإقامة ${max} يومًا — جدّدها أولًا ثم قدّم.`,
    sar: 'ريال',
    disclaimer: 'الرسوم كما هي منشورة للحالة المعتادة، وقد تختلف حالتك — فقد يضيف الكفيل رسومًا خاصة به، وقد تمنع المخالفات غير المسددة أو جواز منتهٍ التقديمَ لأسباب لا يظهرها أي جدول رسوم. والمرجع أبشر ومقيم.',
  },
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d) }

export default function ExitReentryTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')

  const [kind, setKind] = useState<VisaKind>('single')
  const [from, setFrom] = useState<ExtendFrom>('inside')
  const [depart, setDepart] = useState(() => shift(14))
  const [ret, setRet] = useState(() => shift(45))
  const [iqama, setIqama] = useState(() => shift(300))

  const departDate = useMemo(() => new Date(depart + 'T00:00:00'), [depart])
  const retDate = useMemo(() => new Date(ret + 'T00:00:00'), [ret])
  const iqamaDate = useMemo(() => new Date(iqama + 'T00:00:00'), [iqama])
  const ok = [departDate, retDate, iqamaDate].every((d) => !Number.isNaN(d.getTime()))

  const days = ok ? Math.max(1, daysBetween(departDate, retDate)) : 1
  const q = useMemo(() => quote(kind, days, from), [kind, days, from])
  const cap = useMemo(() => (ok ? againstIqama(departDate, days, iqamaDate) : null), [ok, departDate, days, iqamaDate])

  return (
    <Stack data-testid="exit-reentry">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
        <Field label={s.kind}>
          <Seg data-testid="er-kind">
            <SegButton active={kind === 'single'} onClick={() => setKind('single')} data-testid="er-single">{s.single}</SegButton>
            <SegButton active={kind === 'multiple'} onClick={() => setKind('multiple')} data-testid="er-multiple">{s.multiple}</SegButton>
          </Seg>
        </Field>
        <Field label={s.from}>
          <Seg data-testid="er-from">
            <SegButton active={from === 'inside'} onClick={() => setFrom('inside')} data-testid="er-inside">{s.inside}</SegButton>
            <SegButton active={from === 'outside'} onClick={() => setFrom('outside')} data-testid="er-outside">{s.outside}</SegButton>
          </Seg>
        </Field>
      </div>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3">
        <Field label={s.depart}><Input type="date" value={depart} data-testid="er-depart" onChange={(e) => setDepart(e.target.value)} /></Field>
        <Field label={s.ret}><Input type="date" value={ret} data-testid="er-return" onChange={(e) => setRet(e.target.value)} /></Field>
        <Field label={s.iqama}><Input type="date" value={iqama} data-testid="er-iqama" onChange={(e) => setIqama(e.target.value)} /></Field>
      </div>
      <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.fromHint}</p>

      {cap?.beyond && (
        <Panel className="gap-1 border-gold-500" data-testid="er-blocked">
          <p className="font-display text-[1.2rem] text-gold-500 rtl:font-ar">{s.blocked}</p>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.blockedBody(cap.daysBeyond, cap.maxDays)}</p>
        </Panel>
      )}

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.total}</div>
            <div className="font-mono text-[1.5rem] font-semibold text-green-700" data-testid="er-total">{fmt(q.total)} {s.sar}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.trip}</div>
            <div className="font-mono text-[1.15rem] text-ink" data-testid="er-days">{fmt(q.days)} {s.days}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.charged}</div>
            <div className="font-mono text-[1.15rem] text-ink" data-testid="er-months">{s.months(q.months)}</div>
          </div>
        </div>
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="er-breakdown">
          {s.breakdown} {fmt(q.base)} {s.sar} ({s.included(TERMS[kind].included)})
          {q.extraMonths > 0 && ` + ${q.extraMonths} × ${fmt(q.perMonth)} ${s.sar} ${s.each}`}
        </p>
        <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="er-edge">
          {s.edge(q.daysToNextMonth, q.nextMonthCost)}
        </p>
      </Panel>

      <Disclaimer kind="official" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
