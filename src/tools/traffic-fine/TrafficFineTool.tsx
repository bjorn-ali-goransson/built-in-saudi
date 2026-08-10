import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Stack, Panel, Field, Input, Check, Disclaimer } from '../../components/ui'
import { formatHijri } from '../prayer-times/islamic'
import { buildIcsCalendar } from '../../lib/ics'
import {
  DISCOUNT_DAYS, EXTENSION_DAYS, EXTENSION_DISCOUNT_DAYS,
  OBJECTION_DAYS, PAYMENT_DAYS, SCHEME_START, assess, isoLocal,
} from './fine'

const STR = {
  en: {
    intro: 'What a traffic fine costs if you pay it in time, and exactly when "in time" runs out.',
    date: 'Date of the violation', amount: 'Fine as issued (SAR)',
    excluded: 'It is one of the excluded violations (listed below)',
    extended: 'A 90-day payment extension has been requested on Absher',
    payNow: 'Pay now', saved: 'You save', full: 'Full amount',
    objectBy: 'Last day to object', discountUntil: 'Discount stands until', payBy: 'Pay by',
    left: (n: number) => (n >= 0 ? `${n} days left on the discount` : `the discount ended ${-n} days ago`),
    gone: 'The discount has gone — this is the full amount.',
    notEligible: 'This violation is excluded from the reduction, so the full amount is due.',
    beforeScheme: `The reduction applies to violations from ${SCHEME_START} onwards. This one is earlier, so it is not covered.`,
    seriesTitle: 'The 45 days are 30 + 15, not one window',
    seriesBody: `You have ${OBJECTION_DAYS} days to object, and the ${PAYMENT_DAYS} days to pay begin when that ends — so the reduction stands for ${DISCOUNT_DAYS} days from the violation. Read as running at the same time, they come to 30, and two weeks of it are lost for nothing.`,
    extTitle: 'The 90-day extension does not extend the discount by 90 days',
    extBody: `Absher can grant a further ${EXTENSION_DAYS} days to pay. The reduction carries only ${EXTENSION_DISCOUNT_DAYS} days into it — so it is worth asking for the time and the discount is gone on day ${DISCOUNT_DAYS + EXTENSION_DISCOUNT_DAYS} either way. Somebody who requests it believing they have until day ${DISCOUNT_DAYS + EXTENSION_DAYS} pays the full amount.`,
    exclTitle: 'What the reduction does not cover',
    exclBody: 'The list is not intuitive — a periodic-inspection violation is on it and running a red light is not:',
    excl: [
      'an accident caused by overtaking', 'an accident caused by speeding', 'drifting',
      'running a driving school without a licence', 'vehicle weights and dimensions',
      'periodic inspection (Fahes) violations', 'workshop violations',
      'driving after a licence or registration has been confiscated',
      'selling or dismantling a vehicle outside the Kingdom', 'vehicle showroom violations',
    ],
    lookupTitle: 'This cannot see your fines',
    lookupBody: 'It works out what a fine you already know about will cost and when the discount lapses. Only Absher can tell you which violations are recorded against you, and only Absher can take the payment.',
    ics: 'Add the deadlines to your calendar',
    icsObject: 'Traffic fine: last day to object',
    icsDiscount: 'Traffic fine: 25% discount ends',
    icsPay: 'Traffic fine: pay by',
    related: 'Inspection and registration dates: Fahes & Istimara',
    disc: 'Article 75 of the Traffic Law and the General Department of Traffic’s published FAQ. The excluded categories and the payment windows can be revised, and an individual case may differ — check Absher or the traffic department before acting on this.',
  },
  ar: {
    intro: 'كم تكلّف المخالفة المرورية إذا سُدّدت في وقتها، ومتى ينتهي هذا الوقت بالضبط.',
    date: 'تاريخ المخالفة', amount: 'قيمة المخالفة كما صدرت (ريال)',
    excluded: 'هي من المخالفات المستثناة (القائمة أدناه)',
    extended: 'طُلبت مهلة سداد ٩٠ يومًا عبر أبشر',
    payNow: 'المبلغ عند السداد الآن', saved: 'توفّر', full: 'المبلغ كاملًا',
    objectBy: 'آخر يوم للاعتراض', discountUntil: 'التخفيض قائم حتى', payBy: 'السداد قبل',
    left: (n: number) => (n >= 0 ? `بقي ${n} يومًا على التخفيض` : `انتهى التخفيض قبل ${-n} يومًا`),
    gone: 'انتهى التخفيض — هذا هو المبلغ كاملًا.',
    notEligible: 'هذه المخالفة مستثناة من التخفيض، فالمبلغ مستحق كاملًا.',
    beforeScheme: `التخفيض يسري على المخالفات من ${SCHEME_START} فما بعد. وهذه أسبق، فلا يشملها.`,
    seriesTitle: 'الـ٤٥ يومًا هي ٣٠ + ١٥ لا مهلة واحدة',
    seriesBody: `لك ${OBJECTION_DAYS} يومًا للاعتراض، وتبدأ مهلة السداد البالغة ${PAYMENT_DAYS} يومًا حين تنتهي — فيقوم التخفيض ${DISCOUNT_DAYS} يومًا من تاريخ المخالفة. ومن قرأهما متوازيتين حسبهما ٣٠ يومًا وأضاع أسبوعين بلا سبب.`,
    extTitle: 'مهلة الـ٩٠ يومًا لا تمدّ التخفيض ٩٠ يومًا',
    extBody: `يمكن لأبشر منح ${EXTENSION_DAYS} يومًا إضافية للسداد، ولا يمتد التخفيض فيها إلا ${EXTENSION_DISCOUNT_DAYS} يومًا — فالمهلة تستحق الطلب، والتخفيض ينتهي في اليوم ${DISCOUNT_DAYS + EXTENSION_DISCOUNT_DAYS} على كل حال. ومن طلبها ظانًّا أن أمامه حتى اليوم ${DISCOUNT_DAYS + EXTENSION_DAYS} يدفع المبلغ كاملًا.`,
    exclTitle: 'ما لا يشمله التخفيض',
    exclBody: 'القائمة غير بديهية — مخالفة الفحص الدوري فيها، وقطع الإشارة ليس فيها:',
    excl: [
      'حادث ناتج عن التجاوز', 'حادث ناتج عن السرعة', 'التفحيط',
      'تشغيل مدرسة قيادة دون ترخيص', 'أوزان المركبات وأبعادها',
      'مخالفات الفحص الدوري', 'مخالفات الورش',
      'القيادة بعد سحب رخصة القيادة أو السير',
      'بيع المركبات أو تفكيكها خارج المملكة', 'مخالفات معارض السيارات',
    ],
    lookupTitle: 'هذه الأداة لا ترى مخالفاتك',
    lookupBody: 'تحسب ما ستكلّفه مخالفة تعرفها ومتى يسقط تخفيضها. وأبشر وحده يخبرك بما هو مسجّل عليك، وأبشر وحده يستقبل السداد.',
    ics: 'أضف المواعيد إلى تقويمك',
    icsObject: 'مخالفة مرورية: آخر يوم للاعتراض',
    icsDiscount: 'مخالفة مرورية: انتهاء تخفيض ٢٥٪',
    icsPay: 'مخالفة مرورية: السداد قبل',
    related: 'مواعيد الفحص والاستمارة: فحص واستمارة',
    disc: 'المادة ٧٥ من نظام المرور والأسئلة الشائعة المنشورة من الإدارة العامة للمرور. وقد تُعدَّل الفئات المستثناة ومهل السداد، وقد تختلف الحالة الفردية — راجع أبشر أو المرور قبل التصرّف بناءً على هذا.',
  },
}

export default function TrafficFineTool() {
  const { locale } = useLocale()
  const l = locale === 'ar' ? 'ar' : 'en'
  const s = STR[l]
  const nf = useMemo(
    () => new Intl.NumberFormat(l === 'ar' ? 'ar-SA' : 'en-GB', { maximumFractionDigits: 2 }),
    [l],
  )
  const df = useMemo(
    () => new Intl.DateTimeFormat(l === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium' }),
    [l],
  )

  const [date, setDate] = useState(() => isoLocal(new Date()))
  const [amount, setAmount] = useState('500')
  const [excluded, setExcluded] = useState(false)
  const [extended, setExtended] = useState(false)

  const r = useMemo(() => assess({
    date: new Date(`${date}T00:00:00`),
    amount: Math.max(0, Number(amount) || 0),
    excluded, extended,
  }), [date, amount, excluded, extended])

  const showDate = (d: Date) => `${df.format(d)} · ${formatHijri(d, l)}`

  function downloadIcs() {
    const ics = buildIcsCalendar('traffic-fine', [
      { summary: s.icsObject, date: isoLocal(r.objectBy), alarmDays: 3 },
      { summary: s.icsDiscount, date: isoLocal(r.discountUntil), alarmDays: 7 },
      { summary: s.icsPay, date: isoLocal(r.payBy), alarmDays: 3 },
    ])
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'traffic-fine.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Stack data-testid="traffic-fine">
      <p className="text-ink-faint">{s.intro}</p>

      <Field label={s.date}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="tf-date" />
      </Field>
      <Field label={s.amount}>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" data-testid="tf-amount" />
      </Field>
      <Check>
        <input type="checkbox" checked={excluded} data-testid="tf-excluded"
          onChange={(e) => setExcluded(e.target.checked)} />
        {s.excluded}
      </Check>
      <Check>
        <input type="checkbox" checked={extended} data-testid="tf-extended"
          onChange={(e) => setExtended(e.target.checked)} />
        {s.extended}
      </Check>

      <Panel>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <span className="font-display text-[2.1rem] leading-none" data-testid="tf-payable">{nf.format(r.payable)}</span>
            <span className="ms-2 text-ink-faint">{s.payNow}</span>
          </div>
          {r.discount > 0 ? (
            <div className="text-green-700" data-testid="tf-saved">{s.saved} {nf.format(r.discount)}</div>
          ) : null}
        </div>
        {r.beforeScheme ? <p className="text-ink-faint" data-testid="tf-before">{s.beforeScheme}</p>
          : !r.eligible ? <p className="text-ink-faint" data-testid="tf-excl-note">{s.notEligible}</p>
            : r.discount === 0 ? <p className="text-ink-faint" data-testid="tf-gone">{s.gone}</p>
              : <p className="text-ink-faint" data-testid="tf-left">{s.left(r.daysLeft)}</p>}
      </Panel>

      <Panel>
        <ul className="list-none p-0 m-0 flex flex-col gap-1">
          <li className="flex justify-between gap-4"><span>{s.objectBy}</span><span data-testid="tf-object-by">{showDate(r.objectBy)}</span></li>
          <li className="flex justify-between gap-4"><span>{s.discountUntil}</span><span data-testid="tf-discount-until">{showDate(r.discountUntil)}</span></li>
          <li className="flex justify-between gap-4"><span>{s.payBy}</span><span data-testid="tf-pay-by">{showDate(r.payBy)}</span></li>
        </ul>
        <button type="button" onClick={downloadIcs} data-testid="tf-ics"
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-ink cursor-pointer">
          {s.ics}
        </button>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.seriesTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="tf-series">{s.seriesBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.extTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="tf-ext">{s.extBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.exclTitle}</h3>
        <p className="text-ink-faint text-sm">{s.exclBody}</p>
        <ul className="text-ink-faint text-sm ps-5 list-disc" data-testid="tf-excluded-list">
          {s.excl.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.lookupTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="tf-lookup">{s.lookupBody}</p>
      </Panel>

      <Disclaimer kind="official" locale={l}>{s.disc}</Disclaimer>

      <p className="text-sm">
        <a href={localePath(locale, '/apps/vehicle-renewal')}>{s.related}</a>
      </p>
    </Stack>
  )
}
