import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Stack, Panel, Field, Input, Check, Disclaimer } from '../../components/ui'
import { formatHijri } from '../prayer-times/islamic'
import { buildIcsCalendar } from '../../lib/ics'
import {
  LEGACY_AGE, LEGACY_EARLY_MONTHS, LEGACY_MONTHS, NEW_EARLIEST, NEW_STANDARD,
  OLD_BAND, PENSION_DIVISOR, SPLIT, assessRetirement, pensionShare,
} from './retire'

const STR = {
  en: {
    intro: 'When you can draw a GOSI pension — which, since July 2024, is no longer 60 for anybody.',
    born: 'Date of birth',
    before: `I was already contributing to GOSI before ${SPLIT}`,
    months: 'Contribution months so far (optional)',
    schemeNew: 'New system', schemeOld: 'Amended existing system',
    standard: 'Standard retirement age', early: 'Earliest early retirement',
    band: (a: number, b: number) => `between ${a} and ${b}`,
    on: 'on', between: 'between', and: 'and',
    notNarrowTitle: 'This will not guess your exact age, and here is why',
    notNarrowBody: `For anybody already contributing on ${SPLIT} the standard age is set by how old they were on that date, rising in steps of four months — the ${OLD_BAND[0]}-to-${OLD_BAND[1]} band and the four-month step are both published, but the ladder mapping one to the other is not something we could confirm. Putting a single date here would be inventing a retirement somebody might plan a life around. Both ends are dated below; GOSI's own awareness platform gives the exact figure.`,
    notSixtyTitle: 'It is not 60, and that is the number almost everybody still says',
    notSixtyBody: `Sixty is the pre-2024 rule: a pension needed ${LEGACY_MONTHS} contribution months AND age ${LEGACY_AGE}, or ${LEGACY_EARLY_MONTHS} months at any age. The law in force from ${SPLIT} replaced it — a new entrant now retires at ${NEW_STANDARD}, and everybody else somewhere in the ${OLD_BAND[0]}–${OLD_BAND[1]} band.`,
    oneDateTitle: 'One date decides which system you are in',
    oneDateBody: `Whether you had ANY contribution period before ${SPLIT}. Not your age, not your employer, not when the current job started — which is the thing people get wrong about themselves, exactly as they do with the two contribution schemes.`,
    earlyTitle: 'Early retirement is a floor, not a discount',
    earlyBody: `In the new system it is ten years before the standard age and no earlier, so ${NEW_EARLIEST} is the earliest anybody in it can draw a pension however long they have contributed.`,
    pensionTitle: 'What the pension is worth',
    pensionBody: `The average wage of your last two years × contribution months ÷ ${PENSION_DIVISOR}. So each YEAR of contributions buys 2.5% of that average, and forty years buys all of it — and because the average is of the LAST TWO YEARS rather than the career, a raise near the end lifts the whole pension and a drop near the end cuts it.`,
    share: (n: string) => `${n}% of your final two-year average`,
    ics: 'Add the dates to my calendar',
    icsEarly: 'GOSI: earliest early retirement',
    icsStandard: 'GOSI: standard retirement age',
    icsBandFrom: 'GOSI: earliest possible retirement age',
    icsBandTo: 'GOSI: latest possible retirement age',
    nonSaudi: 'A non-Saudi contributes nothing to the pension branch — the employer pays occupational hazards and that is all — so none of this applies. Net salary and GOSI',
    related: 'What comes out of the payslip: GOSI & Net Salary',
    disc: 'The Social Insurance Law in force from 3 July 2024, as published by GOSI. The ladder that sets an existing contributor’s exact age is not reproduced here, and an individual record may carry periods this page cannot see — check GOSI before planning on any of it.',
  },
  ar: {
    intro: 'متى يمكنك صرف معاش التأمينات — وهو منذ يوليو ٢٠٢٤ لم يعد ٦٠ لأحد.',
    born: 'تاريخ الميلاد',
    before: `كنت مشتركًا في التأمينات قبل ${SPLIT}`,
    months: 'أشهر الاشتراك حتى الآن (اختياري)',
    schemeNew: 'النظام الجديد', schemeOld: 'النظام الحالي بعد التعديل',
    standard: 'سن التقاعد النظامي', early: 'أبكر تقاعد مبكر',
    band: (a: number, b: number) => `بين ${a} و${b}`,
    on: 'في', between: 'بين', and: 'و',
    notNarrowTitle: 'هذه الأداة لن تخمّن سنّك بالضبط، وهذا السبب',
    notNarrowBody: `لمن كان مشتركًا في ${SPLIT} يُحدَّد السن النظامي بعمره في ذلك التاريخ، ويرتفع بخطوات من أربعة أشهر — والنطاق من ${OLD_BAND[0]} إلى ${OLD_BAND[1]} والخطوة الرباعية منشوران، أما الجدول الذي يربط أحدهما بالآخر فلم نستطع تأكيده. ووضع تاريخ واحد هنا اختراعٌ لتقاعد قد يبني عليه أحدهم حياته. والطرفان مؤرّخان أدناه، والمنصة التوعوية للتأمينات تعطي الرقم الدقيق.`,
    notSixtyTitle: 'ليس ٦٠، وهو الرقم الذي ما زال يقوله الجميع تقريبًا',
    notSixtyBody: `الستون قاعدة ما قبل ٢٠٢٤: كان المعاش يحتاج ${LEGACY_MONTHS} شهر اشتراك مع سن ${LEGACY_AGE}، أو ${LEGACY_EARLY_MONTHS} شهرًا في أي سن. وقد استبدله النظام النافذ من ${SPLIT} — فالداخل الجديد يتقاعد في ${NEW_STANDARD}، وغيره في مكان ما من نطاق ${OLD_BAND[0]}–${OLD_BAND[1]}.`,
    oneDateTitle: 'تاريخ واحد يحدّد أي نظام يشملك',
    oneDateBody: `هل كانت لك أي مدة اشتراك قبل ${SPLIT}. لا عمرك ولا جهة عملك ولا متى بدأت وظيفتك الحالية — وهذا ما يخطئ فيه الناس بشأن أنفسهم، كما يخطئون في نظامَي الاشتراك.`,
    earlyTitle: 'التقاعد المبكر حدٌّ أدنى لا خصم',
    earlyBody: `في النظام الجديد هو قبل السن النظامي بعشر سنوات لا أكثر، فـ${NEW_EARLIEST} أبكر ما يمكن لأحد فيه أن يصرف معاشًا مهما طالت مدة اشتراكه.`,
    pensionTitle: 'كم يساوي المعاش',
    pensionBody: `متوسط أجر آخر سنتين × أشهر الاشتراك ÷ ${PENSION_DIVISOR}. فكل سنة اشتراك تشتري ٢٫٥٪ من ذلك المتوسط، وأربعون سنة تشتريه كله — ولأن المتوسط لآخر سنتين لا للمسيرة كلها، فالزيادة قرب النهاية ترفع المعاش كله والنقص قربها يخفضه.`,
    share: (n: string) => `${n}٪ من متوسط آخر سنتين`,
    ics: 'أضف المواعيد إلى تقويمي',
    icsEarly: 'التأمينات: أبكر تقاعد مبكر',
    icsStandard: 'التأمينات: سن التقاعد النظامي',
    icsBandFrom: 'التأمينات: أبكر سن تقاعد ممكن',
    icsBandTo: 'التأمينات: أقصى سن تقاعد ممكن',
    nonSaudi: 'غير السعودي لا يشترك في فرع المعاشات إطلاقًا — يدفع صاحب العمل الأخطار المهنية فقط — فلا ينطبق عليه شيء من هذا. الراتب الصافي والتأمينات',
    related: 'ما يُخصم من الراتب: التأمينات والراتب الصافي',
    disc: 'نظام التأمينات الاجتماعية النافذ من ٣ يوليو ٢٠٢٤ كما تنشره المؤسسة العامة للتأمينات الاجتماعية. والجدول الذي يحدّد السن الدقيق للمشترك القائم غير مُعاد هنا، وقد يحمل السجل الفردي مددًا لا تراها هذه الصفحة — راجع التأمينات قبل البناء على أي من هذا.',
  },
}

const isoLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function RetirementAgeTool() {
  const { locale } = useLocale()
  const l = locale === 'ar' ? 'ar' : 'en'
  const s = STR[l]
  const nf = useMemo(() => new Intl.NumberFormat(l === 'ar' ? 'ar-SA' : 'en-GB'), [l])
  // Every interpolated number goes through the locale formatter. `toFixed`
  // returns Latin digits whatever the locale, which is how the Arabic side of
  // `ovulation` ended up printing 25.0 — the failure an Arabic test that only
  // asserts prose cannot see.
  const pct = useMemo(
    () => new Intl.NumberFormat(l === 'ar' ? 'ar-SA' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [l],
  )
  const df = useMemo(
    () => new Intl.DateTimeFormat(l === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium' }),
    [l],
  )

  const [born, setBorn] = useState('1990-01-01')
  const [before, setBefore] = useState(true)
  const [months, setMonths] = useState('')

  const r = useMemo(
    () => assessRetirement({ born: new Date(`${born}T00:00:00`), contributedBefore: before }),
    [born, before],
  )
  const show = (d: Date) => `${df.format(d)} · ${formatHijri(d, l)}`
  const share = months.trim() === '' ? null : pensionShare(Number(months) || 0)

  function downloadIcs() {
    const events = r.scheme === 'new'
      ? [
        { summary: s.icsEarly, date: isoLocal(r.earlyDate!), alarmDays: 30 },
        { summary: s.icsStandard, date: isoLocal(r.earliest), alarmDays: 30 },
      ]
      : [
        { summary: s.icsBandFrom, date: isoLocal(r.earliest), alarmDays: 30 },
        { summary: s.icsBandTo, date: isoLocal(r.latest), alarmDays: 30 },
      ]
    const ics = buildIcsCalendar('retirement-age', events)
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'retirement.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Stack data-testid="retirement-age">
      <p className="text-ink-faint">{s.intro}</p>

      <Field label={s.born}>
        <Input type="date" value={born} onChange={(e) => setBorn(e.target.value)} data-testid="ra-born" />
      </Field>
      <Check>
        <input type="checkbox" checked={before} data-testid="ra-before"
          onChange={(e) => setBefore(e.target.checked)} />
        {s.before}
      </Check>
      <Field label={s.months}>
        <Input value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric"
          data-testid="ra-months" placeholder="0" />
      </Field>

      <Panel>
        <p className="text-[0.72rem] uppercase tracking-[0.05em] text-ink-faint rtl:tracking-normal rtl:font-ar"
          data-testid="ra-scheme" data-value={r.scheme}>
          {r.scheme === 'new' ? s.schemeNew : s.schemeOld}
        </p>
        <p className="font-display text-[1.5rem]" data-testid="ra-standard">
          {s.standard}: {r.standardAge !== null
            ? nf.format(r.standardAge)
            : s.band(r.band[0], r.band[1])}
        </p>
        <p data-testid="ra-dates">
          {r.standardAge !== null
            ? `${s.on} ${show(r.earliest)}`
            : `${s.between} ${show(r.earliest)} ${s.and} ${show(r.latest)}`}
        </p>
        {r.earlyAge !== null ? (
          <p data-testid="ra-early">{s.early}: {nf.format(r.earlyAge)} — {show(r.earlyDate!)}</p>
        ) : null}
        {share !== null ? <p data-testid="ra-share">{s.share(pct.format(share))}</p> : null}
        <button type="button" onClick={downloadIcs} data-testid="ra-ics"
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-ink cursor-pointer w-fit">
          {s.ics}
        </button>
      </Panel>

      {r.standardAge === null ? (
        <Panel>
          <h3 className="font-display text-lg">{s.notNarrowTitle}</h3>
          <p className="text-ink-faint text-sm" data-testid="ra-refuses">{s.notNarrowBody}</p>
        </Panel>
      ) : null}

      <Panel>
        <h3 className="font-display text-lg">{s.notSixtyTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="ra-not-sixty">{s.notSixtyBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.oneDateTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="ra-one-date">{s.oneDateBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.earlyTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="ra-early-floor">{s.earlyBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.pensionTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="ra-pension">{s.pensionBody}</p>
      </Panel>

      <Disclaimer kind="official" locale={l}>{s.disc}</Disclaimer>

      <p className="text-sm">
        <a href={localePath(locale, '/apps/gosi-salary')}>{s.related}</a>
      </p>
    </Stack>
  )
}
