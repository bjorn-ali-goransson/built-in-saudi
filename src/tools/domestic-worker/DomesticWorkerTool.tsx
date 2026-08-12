import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Disclaimer } from '../../components/ui'
import {
  entitlement, overstatement, EOS_YEARS_PER_MONTH, LEAVE_AFTER_YEARS, LEAVE_DAYS,
  SICK_DAYS, SICK_FULL_PAY_DAYS, WEEKLY_REST_HOURS, MAX_CONSECUTIVE_HOURS, DAILY_REST_HOURS,
} from './domestic'

const STR = {
  en: {
    intro: 'What a domestic worker in Saudi Arabia is actually entitled to — under the regulation that covers them, not the Labour Law that does not. Nothing is sent anywhere.',
    wage: 'Monthly wage (SAR)',
    years: 'Completed years with this employer',

    reward: 'End-of-service reward', periods: 'Completed four-year periods',
    nothingYet: (y: string) => `Nothing is due yet — the first month falls due after ${EOS_YEARS_PER_MONTH} continuous years, in ${y}.`,
    next: (y: string) => `The next month falls due in ${y}.`,

    diffTitle: 'The Labour Law does not apply, and the difference is large',
    diffBody: (labour: string, real: string, times: string) =>
      `The Labour Law expressly excludes domestic workers. Its formula — half a month per year for the first five years, a full month per year after — would give SAR ${labour} here. The regulation that does apply gives SAR ${real}, which is ${times} less. A calculator that does not ask whether the job is domestic work will answer with the first figure.`,
    diffNothing: (labour: string) =>
      `The Labour Law formula would give SAR ${labour} here. The regulation that actually applies gives nothing yet, because the first month falls due only after four continuous years.`,

    rightsTitle: 'What else the regulation gives',
    leave: `Annual leave: ${LEAVE_DAYS} days after ${LEAVE_AFTER_YEARS} years of service, plus a round-trip ticket home.`,
    leaveNotYet: `Annual leave becomes due after ${LEAVE_AFTER_YEARS} years of service — not yet, on the service entered.`,
    sick: (full: string, half: string) =>
      `Sick leave: ${SICK_DAYS} days — the first ${SICK_FULL_PAY_DAYS} at full pay (SAR ${full} a day) and the rest at half pay (SAR ${half} a day).`,
    weekly: `Weekly rest: one full paid day, not less than ${WEEKLY_REST_HOURS} continuous hours.`,
    daily: `Daily: no more than ${MAX_CONSECUTIVE_HOURS} consecutive hours without a break, and total rest of not less than ${DAILY_REST_HOURS} continuous hours.`,

    wpsTitle: 'The wage must go through Musaned now — this changed in January',
    wpsBody:
      'Wage Protection for domestic workers was phased in from July 2024 by household size, and since 1 January 2026 it applies to every employer without exception. The wage is paid monthly through a Musaned-linked bank or approved digital wallet. Cash in hand no longer satisfies it, however long it has been the arrangement — which is the part households are most likely not to know.',

    partialTitle: 'What the published rule does not settle',
    partialBody:
      'The wording is "one month’s wage for every four consecutive years", so the reward is counted in completed four-year periods. Whether a part-finished period is paid pro-rata is not stated in anything published, and this page will not invent an answer to it — ask the Ministry through Musaned, or the labour office, before settling a contract that ends mid-period.',

    eosTool: 'Not a domestic worker? End of Service (Labour Law)',
    leaveTool: 'Leave and overtime under the Labour Law',
    iqamaTool: 'Iqama renewal cost',
    caveat:
      'These are the figures the Ministry of Human Resources and Social Development publishes through Musaned, which is also where a complaint is filed and where the wage must be paid. Sources on the end-of-service reward disagree — one widely republished figure is four times the official one — so check Musaned before settling anything, and note that a contract may give more than the regulation and cannot give less.',
  },
  ar: {
    intro: 'ما تستحقه العمالة المنزلية في السعودية فعلًا — بموجب اللائحة التي تشملهم لا نظام العمل الذي لا يشملهم. ولا يُرسل شيء إلى أي مكان.',
    wage: 'الأجر الشهري (ريال)',
    years: 'سنوات الخدمة المكتملة لدى صاحب العمل',

    reward: 'مكافأة نهاية الخدمة', periods: 'فترات الأربع سنوات المكتملة',
    nothingYet: (y: string) => `لا شيء مستحق بعد — أول شهر يستحق بعد أربع سنوات متصلة، أي بعد ${y}.`,
    next: (y: string) => `الشهر التالي يستحق بعد ${y}.`,

    diffTitle: 'نظام العمل لا ينطبق، والفرق كبير',
    diffBody: (labour: string, real: string, times: string) =>
      `يستثني نظام العمل العمالة المنزلية صراحةً. ومعادلته — نصف شهر عن كل سنة في الخمس الأولى وشهر كامل بعدها — تعطي هنا ${labour} ريال. أما اللائحة التي تنطبق فتعطي ${real} ريال، أي أقل بمقدار ${times}. والحاسبة التي لا تسأل إن كان العمل منزليًا ستجيب بالرقم الأول.`,
    diffNothing: (labour: string) =>
      `معادلة نظام العمل تعطي هنا ${labour} ريال. واللائحة التي تنطبق فعلًا لا تعطي شيئًا بعد، لأن أول شهر لا يستحق إلا بعد أربع سنوات متصلة.`,

    rightsTitle: 'ما تعطيه اللائحة أيضًا',
    leave: 'الإجازة السنوية: ثلاثون يومًا بعد سنتين من الخدمة، مع تذكرة ذهاب وعودة إلى بلده.',
    leaveNotYet: 'الإجازة السنوية تستحق بعد سنتين من الخدمة — ولم تُبلغ بعد بحسب المدة المُدخلة.',
    sick: (full: string, half: string) =>
      `الإجازة المرضية: ثلاثون يومًا — الخمسة عشر الأولى بأجر كامل (${full} ريال يوميًا) وبقيتها بنصف أجر (${half} ريال يوميًا).`,
    weekly: 'الراحة الأسبوعية: يوم كامل مدفوع الأجر لا يقل عن أربع وعشرين ساعة متصلة.',
    daily: 'يوميًا: لا يعمل أكثر من خمس ساعات متصلة دون فترة راحة، ولا تقل الراحة الإجمالية عن ثماني ساعات متصلة.',

    wpsTitle: 'الأجر يجب أن يمر عبر مساند الآن — وهذا تغيّر في يناير',
    wpsBody:
      'طُبِّقت حماية الأجور للعمالة المنزلية على مراحل من يوليو ٢٠٢٤ بحسب عدد العمالة لدى صاحب العمل، ومنذ الأول من يناير ٢٠٢٦ صارت تشمل كل صاحب عمل بلا استثناء. فيُدفع الأجر شهريًا عبر بنك مرتبط بمساند أو محفظة رقمية معتمدة. ولم يعد الدفع نقدًا باليد كافيًا مهما طال العمل به — وهو أكثر ما قد تجهله الأسر.',

    partialTitle: 'ما لا تحسمه اللائحة المنشورة',
    partialBody:
      'النص «أجر شهر عن كل أربع سنوات متصلة»، فالمكافأة تُحسب بفترات أربع سنوات مكتملة. أما هل تُدفع الفترة غير المكتملة بالتناسب فليس مذكورًا في المنشور، ولن تخترع هذه الصفحة جوابًا له — فاسأل الوزارة عبر مساند أو مكتب العمل قبل إنهاء عقد ينتهي في منتصف فترة.',

    eosTool: 'لست عاملًا منزليًا؟ مكافأة نهاية الخدمة (نظام العمل)',
    leaveTool: 'الإجازات والعمل الإضافي في نظام العمل',
    iqamaTool: 'تكلفة تجديد الإقامة',
    caveat:
      'هذه هي الأرقام التي تنشرها وزارة الموارد البشرية والتنمية الاجتماعية عبر مساند، وهي أيضًا حيث تُقدَّم الشكوى وحيث يجب أن يُدفع الأجر. وتتعارض المصادر في مكافأة نهاية الخدمة — إذ يتكرر رقم يبلغ أربعة أضعاف الرقم الرسمي — فراجع مساند قبل تسوية أي شيء، واعلم أن العقد قد يعطي أكثر مما تعطيه اللائحة ولا يعطي أقل.',
  },
}

export default function DomesticWorkerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [wage, setWage] = useState('1500')
  const [years, setYears] = useState('8')

  const e = useMemo(
    () => entitlement({ wage: Number(wage) || 0, years: Number(years) || 0 }),
    [wage, years],
  )
  const times = overstatement(e)

  const loc = locale === 'ar' ? 'ar-SA' : 'en-US'
  const money = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 2 })
  const num = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 1 })
  const yrs = (v: number) =>
    locale === 'ar' ? `${num(v)} سنة` : `${num(v)} year${v === 1 ? '' : 's'}`

  return (
    <Stack data-testid="domestic-worker">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={s.wage}>
          <Input type="number" min={0} step={100} className="w-[8rem]" value={wage}
            data-testid="dw-wage" onChange={(ev) => setWage(ev.target.value)} />
        </Field>
        <Field label={s.years}>
          <Input type="number" min={0} step={1} className="w-[7rem]" value={years}
            data-testid="dw-years" onChange={(ev) => setYears(ev.target.value)} />
        </Field>
      </div>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.periods}</div>
            <div className="font-mono text-[1.3rem] text-ink" data-testid="dw-periods">{num(e.periods)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.reward}</div>
            <div className="font-mono text-[2rem] font-semibold text-green-700" data-testid="dw-reward">{money(e.reward)}</div>
          </div>
        </div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="dw-next">
          {e.periods === 0 ? s.nothingYet(yrs(e.yearsToNext)) : s.next(yrs(e.yearsToNext))}
        </p>
      </Panel>

      {/* The belief the tool exists to correct — and the defect in our own
          catalogue, since `end-of-service` answered this question for everyone. */}
      <Panel className="gap-1 border-gold-500">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.diffTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="dw-diff">
          {times === null
            ? s.diffNothing(money(e.labourLawReward))
            : s.diffBody(money(e.labourLawReward), money(e.reward), `${num(times)}×`)}
        </p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.rightsTitle}</div>
        <ul className="ms-5 list-disc text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="dw-rights">
          <li data-testid="dw-leave">{e.leaveDue ? s.leave : s.leaveNotYet}</li>
          <li>{s.sick(money(e.sickFullDaily), money(e.sickHalfDaily))}</li>
          <li>{s.weekly}</li>
          <li>{s.daily}</li>
        </ul>
      </Panel>

      {/* A dated obligation that changed in January and lands on ordinary
          households rather than on companies. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.wpsTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="dw-wps">{s.wpsBody}</p>
      </Panel>

      {/* What it refuses to settle, and why — the `iqama-fees` rule. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.partialTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="dw-partial">{s.partialBody}</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button className="px-3 py-1" to={localePath(locale, '/apps/end-of-service')} data-testid="dw-eos">{s.eosTool}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/leave-overtime')} data-testid="dw-leave-tool">{s.leaveTool}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/iqama-fees')} data-testid="dw-iqama">{s.iqamaTool}</Button>
      </div>

      <Disclaimer kind="legal" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
