import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Stack, Panel, Field, Input, Check, Disclaimer } from '../../components/ui'
import { formatHijri } from '../prayer-times/islamic'
import { buildIcsCalendar } from '../../lib/ics'
import { GRACE_AFTER_DAYS, OPENS_BEFORE_DAYS, crStatus } from './cr'

const STR = {
  en: {
    intro: 'When your commercial registration can be renewed, when it must be, and what the grace period actually costs.',
    expiry: 'Commercial registration expires',
    chamber: 'The Chamber of Commerce subscription is paid and active',
    opensOn: 'Renewal opens', expiryLabel: 'Expires', graceEnds: 'Grace period ends',
    phaseEarly: (n: number) => `Renewal opens in ${n} days`,
    phaseOpen: (n: number) => `Open now — ${n} days until it expires`,
    phaseGrace: (n: number) => `EXPIRED. ${n} days of grace left, and fines are already running`,
    phaseLapsed: 'Past the grace period — the commercial identity can be cancelled',
    blockedTitle: 'The Chamber subscription blocks this',
    blockedBody: 'A renewal is not complete without an active Chamber of Commerce subscription. The portal will refuse, and it refuses on the day you try — so this is worth settling before the window opens, not during it.',
    graceTitle: 'The 90 days after expiry are not an extension',
    graceBody: `Renewal is still possible for ${GRACE_AFTER_DAYS} days after the register expires, which is why the deadline is widely treated as six months. It is not. Fines start accruing at expiry, the business is operating on a lapsed register throughout, and past the grace the commercial identity can be cancelled outright — which is not a fine, it is starting again.`,
    feeTitle: 'What this will not put a number on',
    feeBody: 'The published annual figure is SAR 200 for a main register and 100 for a branch, and real renewal costs are quoted anywhere from 200 to 5,000 — because the Chamber subscription is banded by capital and activity, and a municipal licence is charged per square metre by zone. Those depend on things this page cannot see, so it names the components instead of inventing a total.',
    ics: 'Add the dates to my calendar',
    icsOpens: 'Commercial registration: renewal opens',
    icsExpiry: 'Commercial registration expires',
    icsGrace: 'Commercial registration: grace period ends',
    related: 'Tracking documents generally: Iqama & ID Expiry',
    disc: 'Ministry of Commerce rules, as published on its portal. The windows and the prerequisites can be revised, and an individual register may carry conditions this page cannot see — confirm on the Ministry of Commerce portal before relying on it.',
  },
  ar: {
    intro: 'متى يمكن تجديد السجل التجاري، ومتى يجب، وكم تكلّف مهلة السماح فعلًا.',
    expiry: 'تاريخ انتهاء السجل التجاري',
    chamber: 'اشتراك الغرفة التجارية مدفوع وسارٍ',
    opensOn: 'يفتح التجديد', expiryLabel: 'ينتهي', graceEnds: 'تنتهي مهلة السماح',
    phaseEarly: (n: number) => `يفتح التجديد بعد ${n} يومًا`,
    phaseOpen: (n: number) => `مفتوح الآن — ${n} يومًا حتى الانتهاء`,
    phaseGrace: (n: number) => `منتهٍ. بقي ${n} يومًا من مهلة السماح، والغرامات تجري بالفعل`,
    phaseLapsed: 'انقضت مهلة السماح — والهوية التجارية عرضة للإلغاء',
    blockedTitle: 'اشتراك الغرفة يمنع هذا',
    blockedBody: 'لا يكتمل التجديد دون اشتراك سارٍ في الغرفة التجارية. والبوابة ترفض، وترفض يوم تحاول — فالأولى تسويته قبل فتح النافذة لا أثناءها.',
    graceTitle: 'التسعون يومًا بعد الانتهاء ليست تمديدًا',
    graceBody: `يبقى التجديد ممكنًا ${GRACE_AFTER_DAYS} يومًا بعد انتهاء السجل، ولهذا يُتعامل مع المهلة كأنها ستة أشهر. وليست كذلك: الغرامات تبدأ من تاريخ الانتهاء، والنشاط يعمل طوال المدة بسجل منتهٍ، وبعد المهلة تصبح الهوية التجارية عرضة للإلغاء — وذلك ليس غرامة بل بداية من جديد.`,
    feeTitle: 'ما لا يضع هذا رقمًا له',
    feeBody: 'الرقم السنوي المنشور ٢٠٠ ريال للسجل الرئيس و١٠٠ للفرع، والتكاليف الفعلية تُذكر بين ٢٠٠ و٥٬٠٠٠ — لأن اشتراك الغرفة مُدرَّج برأس المال والنشاط، ورخصة البلدية تُحسب بالمتر المربع حسب النطاق. وكلها تتوقف على ما لا تراه هذه الصفحة، فتسمّي المكوّنات بدل اختراع مجموع.',
    ics: 'أضف المواعيد إلى تقويمي',
    icsOpens: 'السجل التجاري: يفتح التجديد',
    icsExpiry: 'انتهاء السجل التجاري',
    icsGrace: 'السجل التجاري: انتهاء مهلة السماح',
    related: 'لتتبّع المستندات عمومًا: انتهاء الإقامة والهويات',
    disc: 'أنظمة وزارة التجارة كما تنشرها على بوابتها. وقد تُعدَّل النوافذ والمتطلبات، وقد يحمل سجل بعينه شروطًا لا تراها هذه الصفحة — تحقّق من بوابة وزارة التجارة قبل الاعتماد عليها.',
  },
}

const isoLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function CrRenewalTool() {
  const { locale } = useLocale()
  const l = locale === 'ar' ? 'ar' : 'en'
  const s = STR[l]
  const nf = useMemo(() => new Intl.NumberFormat(l === 'ar' ? 'ar-SA' : 'en-GB'), [l])
  const df = useMemo(
    () => new Intl.DateTimeFormat(l === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium' }),
    [l],
  )

  const [expiry, setExpiry] = useState(() => isoLocal(new Date(Date.now() + 120 * 86400000)))
  const [chamber, setChamber] = useState(true)

  const r = useMemo(() => crStatus(new Date(`${expiry}T00:00:00`)), [expiry])
  const show = (d: Date) => `${df.format(d)} · ${formatHijri(d, l)}`

  function downloadIcs() {
    const ics = buildIcsCalendar('cr-renewal', [
      { summary: s.icsOpens, date: isoLocal(r.opensOn), alarmDays: 7 },
      { summary: s.icsExpiry, date: isoLocal(r.expiry), alarmDays: 14 },
      { summary: s.icsGrace, date: isoLocal(r.graceEnds), alarmDays: 14 },
    ])
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'commercial-registration.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  const phaseText = r.phase === 'early' ? s.phaseEarly(r.daysLeftInPhase)
    : r.phase === 'open' ? s.phaseOpen(r.daysLeftInPhase)
      : r.phase === 'grace' ? s.phaseGrace(r.daysLeftInPhase)
        : s.phaseLapsed

  return (
    <Stack data-testid="cr-renewal">
      <p className="text-ink-faint">{s.intro}</p>

      <Field label={s.expiry}>
        <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} data-testid="cr-expiry" />
      </Field>
      <Check>
        <input type="checkbox" checked={chamber} data-testid="cr-chamber"
          onChange={(e) => setChamber(e.target.checked)} />
        {s.chamber}
      </Check>

      <Panel>
        <p className="font-display text-[1.4rem]" data-testid="cr-phase" data-phase={r.phase}>{phaseText}</p>
        <ul className="list-none p-0 m-0 flex flex-col gap-1 mt-2">
          <li className="flex justify-between gap-4"><span>{s.opensOn}</span><span data-testid="cr-opens">{show(r.opensOn)}</span></li>
          <li className="flex justify-between gap-4"><span>{s.expiryLabel}</span><span data-testid="cr-expires">{show(r.expiry)}</span></li>
          <li className="flex justify-between gap-4"><span>{s.graceEnds}</span><span data-testid="cr-grace">{show(r.graceEnds)}</span></li>
        </ul>
        <button type="button" onClick={downloadIcs} data-testid="cr-ics"
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-ink cursor-pointer">
          {s.ics}
        </button>
        <p className="sr-only">{nf.format(OPENS_BEFORE_DAYS)}</p>
      </Panel>

      {!chamber ? (
        <Panel>
          <h3 className="font-display text-lg">{s.blockedTitle}</h3>
          <p className="text-ink-faint text-sm" data-testid="cr-blocked">{s.blockedBody}</p>
        </Panel>
      ) : null}

      <Panel>
        <h3 className="font-display text-lg">{s.graceTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="cr-grace-note">{s.graceBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.feeTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="cr-fee">{s.feeBody}</p>
      </Panel>

      <Disclaimer kind="official" locale={l}>{s.disc}</Disclaimer>

      <p className="text-sm">
        <a href={localePath(locale, '/apps/id-expiry')}>{s.related}</a>
      </p>
    </Stack>
  )
}
