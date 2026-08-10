import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Check, Seg, SegButton, Disclaimer } from '../../components/ui'
import { DownloadIcon } from '../../components/icons'
import { formatHijri } from '../prayer-times/islamic'
import { buildIcsCalendar, downloadIcs } from '../../lib/ics'
import {
  feeFor, cumulative, deadline, needsConsent, CONSENT_REASONS, GRACE_DAYS,
  type ConsentReason,
} from './transfer'

const STR = {
  en: {
    intro: 'What a sponsorship transfer costs, who owes it, and whether you need your current employer to agree at all. Nothing is sent anywhere.',
    previous: 'Transfers already on this worker’s record',
    nextFee: 'The next transfer costs', payer: 'Paid by the NEW employer',
    plan: 'Two more would cost',
    tierTitle: 'It is not a flat 2,000',
    tierBody: 'Everyone quotes “2,000 riyals”, and that is only the figure for a worker who has never transferred. The second is 4,000, the third is 6,000, and every one after that stays at 6,000. The count follows the WORKER, not the employer — so somebody who has already moved twice costs 6,000 to hire, whatever their new employer has done before.',
    art40Title: 'It is not your money',
    art40Body: 'Labour Law Article 40 puts the transfer fee on the new employer. It may not be charged to the worker or deducted from wages — the same article that stops the work-permit levy being passed on. If it has been taken out of your pay, that is the thing to raise, not the amount.',
    consent: 'Does any of this apply?',
    reasons: {
      contractExpired: 'My contract has ended',
      wagesUnpaid: 'Wages unpaid for three consecutive months',
      iqamaNotRenewed: 'My iqama was not renewed within a month of expiry',
      contractBreached: 'The employer refuses to pay what the contract says',
    } as Record<ConsentReason, string>,
    consentNo: 'On these grounds the transfer can go through Qiwa without your current employer agreeing to it. That is the half most people do not know, and it is worth more than the fee.',
    consentYes: 'With none of these, the transfer needs your current employer’s approval in Qiwa.',
    deadlineTitle: 'Sixty days after the contract ends',
    contractEnd: 'Contract ended on',
    left: (n: string) => `${n} days left`,
    passedMsg: (n: string) => `That was ${n} days ago — the window has closed.`,
    by: 'Arrange the transfer or an exit by',
    deadlineBody: `A contract that has ended starts a ${GRACE_DAYS}-day window. Past it the residency status is irregular, and that is a different and worse problem than a transfer fee. Nobody sends a reminder for it.`,
    ics: 'Add the deadline to my calendar',
    icsSummary: 'Sponsorship transfer deadline',
    icsDesc: 'Sixty days from the end of the contract. After this the residency status is irregular. Check Qiwa and Absher for the official record.',
    capTitle: 'A limit on how many times is NOT computed here',
    capBody: 'Some sources report a maximum of four transfers per worker and others do not mention it at all. One uncorroborated figure is not enough to tell somebody their case is impossible, so this tool does not apply a cap — ask Qiwa if you are near one.',
    iqama: 'What the iqama itself costs: Iqama Renewal Cost',
    leave: 'Notice periods and leave: Leave, Overtime & Notice',
    caveat: 'These are the published fees and the grounds most consistently reported; the transfer itself is decided in Qiwa and Absher, which can see things this page cannot — an open labour case, a firm’s Saudization band, or a profession that cannot be transferred. Check there before acting on this, and remember the fee is the new employer’s to pay.',
  },
  ar: {
    intro: 'كم يكلّف نقل الكفالة، ومن يتحمّله، وهل تحتاج موافقة صاحب العمل الحالي أصلًا. ولا يُرسل شيء إلى أي مكان.',
    previous: 'عدد مرات النقل السابقة لهذا العامل',
    nextFee: 'تكلفة النقل القادم', payer: 'يتحمّلها صاحب العمل الجديد',
    plan: 'تكلفة نقلتين إضافيتين',
    tierTitle: 'ليست ٢٬٠٠٠ ثابتة',
    tierBody: 'يذكر الجميع «ألفي ريال»، وهي رسوم من لم يُنقل من قبل فقط. فالثانية ٤٬٠٠٠ والثالثة ٦٬٠٠٠، وكل ما بعدها ٦٬٠٠٠. والعدّ يتبع العامل لا المنشأة — فمن نُقل مرتين يكلّف ٦٬٠٠٠ عند توظيفه مهما فعل صاحب عمله الجديد من قبل.',
    art40Title: 'ليست من مالك',
    art40Body: 'تضع المادة ٤٠ من نظام العمل رسوم النقل على صاحب العمل الجديد، ولا يجوز تحميلها العامل ولا خصمها من أجره — وهي المادة نفسها التي تمنع تحميله رسوم رخصة العمل. فإن خُصمت من راتبك فهذا هو ما يُرفع، لا المبلغ.',
    consent: 'هل ينطبق أيٌّ مما يلي؟',
    reasons: {
      contractExpired: 'انتهى عقدي',
      wagesUnpaid: 'لم تُدفع الأجور ثلاثة أشهر متتالية',
      iqamaNotRenewed: 'لم تُجدَّد إقامتي خلال شهر من انتهائها',
      contractBreached: 'يمتنع صاحب العمل عن الوفاء بما في العقد',
    } as Record<ConsentReason, string>,
    consentNo: 'على هذه الأسباب يمكن أن يتم النقل عبر «قوى» دون موافقة صاحب العمل الحالي. وهذا هو النصف الذي يجهله أكثر الناس، وهو أنفع من الرسوم.',
    consentYes: 'بغياب هذه الأسباب يحتاج النقل موافقة صاحب العمل الحالي في «قوى».',
    deadlineTitle: 'ستون يومًا بعد انتهاء العقد',
    contractEnd: 'انتهى العقد في',
    left: (n: string) => `بقي ${n} يومًا`,
    passedMsg: (n: string) => `مضى على ذلك ${n} يومًا — أُغلقت المهلة.`,
    by: 'رتّب النقل أو الخروج قبل',
    deadlineBody: `العقد المنتهي يبدأ مهلة ٦٠ يومًا. وبعدها يصير وضع الإقامة غير نظامي، وهذه مشكلة أخرى أسوأ من رسوم نقل. ولا أحد يرسل تذكيرًا بها.`,
    ics: 'أضف الموعد إلى تقويمي',
    icsSummary: 'موعد نقل الكفالة',
    icsDesc: 'ستون يومًا من انتهاء العقد. وبعدها يصير وضع الإقامة غير نظامي. والسجل الرسمي في «قوى» و«أبشر».',
    capTitle: 'لا يُحسب هنا حدٌّ لعدد المرات',
    capBody: 'تذكر بعض المصادر حدًّا أقصى بأربع نقلات للعامل الواحد ولا تذكره مصادر أخرى إطلاقًا. ورقمٌ غير مؤكَّد لا يكفي لإخبار أحدٍ بأن حالته مستحيلة، فلا تطبّق هذه الأداة حدًّا — واسأل «قوى» إن كنت قريبًا منه.',
    iqama: 'كم تكلّف الإقامة نفسها: تكلفة تجديد الإقامة',
    leave: 'الإشعار والإجازات: الإجازات والعمل الإضافي',
    caveat: 'هذه هي الرسوم المنشورة والأسباب الأكثر ورودًا في المصادر؛ أما النقل نفسه فيُقرَّر في «قوى» و«أبشر»، وهما يريان ما لا تراه هذه الصفحة — دعوى عمالية قائمة، أو نطاق المنشأة، أو مهنة لا تُنقل. فراجعهما قبل التصرف بناءً على هذا، وتذكّر أن الرسوم على صاحب العمل الجديد.',
  },
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function SponsorshipTransferTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [previous, setPrevious] = useState(0)
  const [grounds, setGrounds] = useState<ConsentReason[]>([])
  const [end, setEnd] = useState('')

  const fee = feeFor(previous)
  const two = cumulative(previous, 2)
  const consentNeeded = needsConsent(grounds)

  const ended = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
  }, [end])
  const dl = useMemo(() => (ended ? deadline(ended) : null), [ended])

  const loc = locale === 'ar' ? 'ar-SA' : 'en-US'
  const money = (v: number) => v.toLocaleString(loc)
  const n = (v: number) => v.toLocaleString(loc)
  const g = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  function exportIcs() {
    if (!dl) return
    downloadIcs('sponsorship-transfer', buildIcsCalendar('sponsorship-transfer', [{
      summary: s.icsSummary,
      date: iso(dl.by),
      description: s.icsDesc,
      // Two weeks out: the thing you must act on before the day, not on it.
      alarmDays: 14,
    }]))
  }

  return (
    <Stack data-testid="sponsorship-transfer">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Field label={s.previous}>
        <Seg>
          {[0, 1, 2, 3].map((v) => (
            <SegButton key={v} active={previous === v} data-testid={`st-prev-${v}`} onClick={() => setPrevious(v)}>
              {v === 3 ? `${n(3)}+` : n(v)}
            </SegButton>
          ))}
        </Seg>
      </Field>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.nextFee}</div>
            <div className="font-mono text-[2rem] font-semibold text-green-700" data-testid="st-fee">{money(fee)}</div>
            <div className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.payer}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.plan}</div>
            <div className="font-mono text-[1.4rem] text-ink" data-testid="st-two">{money(two)}</div>
          </div>
        </div>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.tierTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="st-tier">{s.tierBody}</p>
      </Panel>

      <Panel className="gap-1 border-gold-500">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.art40Title}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="st-article40">{s.art40Body}</p>
      </Panel>

      {/* Independent grounds, not a choice between them: they are separate legal
          routes with the same consequence. */}
      <Panel className="gap-2">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.consent}</div>
        <div className="flex flex-col gap-1.5">
          {CONSENT_REASONS.map((r) => (
            <Check key={r}>
              <input type="checkbox" checked={grounds.includes(r)} data-testid={`st-ground-${r}`}
                onChange={(e) => setGrounds((p) => (e.target.checked ? [...p, r] : p.filter((x) => x !== r)))} />
              {s.reasons[r]}
            </Check>
          ))}
        </div>
        <p className={`text-[0.9rem] rtl:font-ar ${consentNeeded ? 'text-ink-soft' : 'text-green-700'}`} data-testid="st-consent">
          {consentNeeded ? s.consentYes : s.consentNo}
        </p>
      </Panel>

      <Panel className="gap-2">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.deadlineTitle}</div>
        <Field label={s.contractEnd}>
          <Input type="date" value={end} data-testid="st-end" onChange={(e) => setEnd(e.target.value)} />
        </Field>
        {dl && (
          <>
            <div className={`text-[0.95rem] rtl:font-ar ${dl.passed ? 'text-gold-500' : 'text-ink'}`} data-testid="st-deadline">
              {s.by} {g(dl.by)} — {dl.passed ? s.passedMsg(n(-dl.daysLeft)) : s.left(n(dl.daysLeft))}
            </div>
            <div className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="st-deadline-hijri">{formatHijri(dl.by, locale)}</div>
            <Button className="self-start px-3 py-1" onClick={exportIcs} data-testid="st-ics">
              <DownloadIcon /> {s.ics}
            </Button>
          </>
        )}
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="st-deadline-note">{s.deadlineBody}</p>
      </Panel>

      {/* The number this refuses to compute, and why — the `iqama-fees` rule. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.capTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="st-cap">{s.capBody}</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button className="px-3 py-1" to={localePath(locale, '/apps/iqama-fees')} data-testid="st-iqama">{s.iqama}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/leave-overtime')} data-testid="st-leave">{s.leave}</Button>
      </div>

      <Disclaimer kind="official" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
