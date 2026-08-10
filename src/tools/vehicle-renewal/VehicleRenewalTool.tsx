import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Field, Input, Stack, Panel, Seg, SegButton, Disclaimer } from '../../components/ui'
import { DownloadIcon } from '../../components/icons'
import { buildIcsCalendar, downloadIcs } from '../../lib/ics'
import { nextInspection, registrationStatus, blockedByInspection, EXEMPT_YEARS, RENEWAL_WINDOW_DAYS, type VehicleKind } from './vehicle'

const STR = {
  en: {
    intro: 'When your inspection and your registration are actually due, and — the part people find out at the counter — which one has to happen first. A valid Fahes is required to renew the istimara, so an overdue inspection blocks the renewal.',
    kind: 'Vehicle', private: 'Private car', public: 'Taxi / public transport',
    first: 'First registered', firstHint: 'The date the vehicle was first licensed, not when you bought it.',
    expiry: 'Registration expires', expiryHint: 'From the istimara. If yours shows a Hijri date, the Hijri equivalent is shown beside each result.',
    last: 'Last inspection', lastHint: 'Leave blank if it has never been inspected — a certificate is valid a year from the day it was passed, so this is what sets the next one.',
    never: 'No inspection on record, and the exemption has ended — so one is due.',
    ics: 'Add these dates to your calendar',
    icsNote: 'Three all-day entries — the inspection due date, the day the renewal window opens, and the registration expiry — each with a reminder a fortnight ahead. Built here and downloaded; nothing is sent anywhere.',
    icsInspection: 'Vehicle inspection (Fahes) due',
    icsOpens: 'Vehicle registration renewal opens',
    icsExpires: 'Vehicle registration (istimara) expires',
    icsDesc: 'A valid inspection is required to renew, so an overdue Fahes blocks the renewal. Check Absher for the official record.',
    inspection: 'Periodic inspection (Fahes)',
    registration: 'Registration (istimara)',
    exemptUntil: 'Exempt until',
    exemptBody: (y: number) => `A new vehicle of this type is exempt for ${y} years from first registration. Paying for an inspection before then buys nothing.`,
    dueOn: 'Next due', overdueBy: 'Overdue by', inDays: 'in', days: 'days', daysAgo: 'days ago',
    annual: 'Annual from then on, on the same date.',
    windowOpens: 'Renewal window opens', canRenew: 'You can renew now', notYet: 'Not yet renewable',
    expired: 'Expired', expiresIn: 'Expires in',
    windowBody: `The window opens ${RENEWAL_WINDOW_DAYS} days before expiry.`,
    blocked: 'Inspection first',
    blockedBody: 'Your inspection is overdue and your registration is renewable — but it will be refused until the vehicle passes. Book the Fahes before going near the renewal.',
    clear: 'Order of play',
    orderBody: 'Inspection, then registration. That is the whole rule, and it is why an inspection booked the same week as an expiring istimara is cutting it fine.',
    hijri: 'Hijri',
    disclaimer: 'Dates are worked out from what you entered, using the standard exemption and annual cycle. Absher and the MVPI record are what actually count — check them before relying on this, and note that fines and traffic violations can block a renewal for reasons this tool cannot see.',
  },
  ar: {
    intro: 'متى يستحق الفحص ومتى تنتهي الاستمارة، والأهم — وهو ما يكتشفه الناس عند النافذة — أيّهما قبل الآخر. فالفحص الدوري الساري شرط لتجديد الاستمارة، ومن ثمّ فالفحص المتأخر يمنع التجديد.',
    kind: 'المركبة', private: 'سيارة خاصة', public: 'أجرة / نقل عام',
    first: 'تاريخ أول تسجيل', firstHint: 'تاريخ ترخيص المركبة أول مرة، لا تاريخ شرائك لها.',
    expiry: 'انتهاء الاستمارة', expiryHint: 'من الاستمارة. وإن كان تاريخك هجريًا فالمقابل الهجري معروض بجانب كل نتيجة.',
    last: 'آخر فحص', lastHint: 'اتركه فارغًا إن لم تُفحص المركبة قط — فشهادة الفحص سارية سنة من يوم اجتيازه، وهي التي تحدد الموعد التالي.',
    never: 'لا فحص مسجّل وقد انتهى الإعفاء — فالفحص مستحق.',
    ics: 'أضف هذه المواعيد إلى تقويمك',
    icsNote: 'ثلاثة مواعيد ليوم كامل — موعد الفحص، ويوم فتح نافذة التجديد، وانتهاء الاستمارة — مع تذكير قبل أسبوعين. يُبنى هنا ويُنزَّل، ولا يُرسل شيء.',
    icsInspection: 'موعد الفحص الدوري (فحص)',
    icsOpens: 'تفتح نافذة تجديد الاستمارة',
    icsExpires: 'تنتهي الاستمارة',
    icsDesc: 'الفحص الساري شرط للتجديد، فالفحص المتأخر يمنع التجديد. والسجل الرسمي في أبشر.',
    inspection: 'الفحص الدوري',
    registration: 'الاستمارة',
    exemptUntil: 'معفاة حتى',
    exemptBody: (y: number) => `المركبة الجديدة من هذا النوع معفاة ${y} سنوات من أول تسجيل. ودفع رسوم فحص قبل ذلك لا يشتري شيئًا.`,
    dueOn: 'الاستحقاق القادم', overdueBy: 'متأخر منذ', inDays: 'بعد', days: 'يومًا', daysAgo: 'يومًا',
    annual: 'ثم سنويًا في التاريخ نفسه.',
    windowOpens: 'يفتح التجديد في', canRenew: 'يمكنك التجديد الآن', notYet: 'لم يفتح التجديد بعد',
    expired: 'منتهية', expiresIn: 'تنتهي بعد',
    windowBody: `يفتح التجديد قبل الانتهاء بـ${RENEWAL_WINDOW_DAYS} يومًا.`,
    blocked: 'الفحص أولًا',
    blockedBody: 'فحصك متأخر واستمارتك قابلة للتجديد — لكن التجديد سيُرفض حتى تجتاز المركبة الفحص. فاحجز الفحص قبل أن تقترب من التجديد.',
    clear: 'الترتيب',
    orderBody: 'الفحص ثم التجديد. هذه هي القاعدة كلها، ولهذا فحجز فحص في الأسبوع نفسه الذي تنتهي فيه الاستمارة مجازفة.',
    hijri: 'هجري',
    disclaimer: 'التواريخ محسوبة مما أدخلته، وفق مدة الإعفاء والدورة السنوية المعتادة. والمعوّل عليه هو أبشر وسجل الفحص الدوري — فراجعهما قبل الاعتماد على هذا، مع ملاحظة أن المخالفات قد تمنع التجديد لأسباب لا تراها هذه الأداة.',
  },
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function VehicleRenewalTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const today = useMemo(() => new Date(), [])
  const [kind, setKind] = useState<VehicleKind>('private')
  const [first, setFirst] = useState(() => iso(new Date(today.getFullYear() - 4, today.getMonth(), today.getDate())))
  const [expiry, setExpiry] = useState(() => iso(new Date(today.getFullYear(), today.getMonth() + 2, today.getDate())))
  const [last, setLast] = useState('')

  const gregorian = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium' })
  const hijri = new Intl.DateTimeFormat(`${locale === 'ar' ? 'ar-SA' : 'en'}-u-ca-islamic-umalqura`, { dateStyle: 'medium' })
  const show = (d: Date) => `${gregorian.format(d)} · ${hijri.format(d)} ${s.hijri}`

  const firstDate = useMemo(() => new Date(first + 'T00:00:00'), [first])
  const expiryDate = useMemo(() => new Date(expiry + 'T00:00:00'), [expiry])
  const valid = !Number.isNaN(firstDate.getTime()) && !Number.isNaN(expiryDate.getTime())

  const lastDate = useMemo(() => (last ? new Date(last + 'T00:00:00') : null), [last])
  const insp = useMemo(
    () => (valid ? nextInspection(firstDate, kind, today, lastDate && !Number.isNaN(lastDate.getTime()) ? lastDate : null) : null),
    [firstDate, kind, today, valid, lastDate],
  )
  const reg = useMemo(() => (valid ? registrationStatus(expiryDate, today) : null), [expiryDate, today, valid])
  const blocked = insp && reg ? blockedByInspection(insp, reg) : false

  function exportIcs() {
    if (!insp || !reg) return
    // A fortnight, because all three of these are things you act on before the
    // day rather than on it — and the registration one exists precisely because
    // the window opens 180 days early and nobody has a reminder for that.
    const LEAD = 14
    downloadIcs('vehicle-renewal', buildIcsCalendar('vehicle-renewal', [
      { summary: s.icsInspection, date: iso(insp.due), description: s.icsDesc, alarmDays: LEAD },
      { summary: s.icsOpens, date: iso(reg.opens), description: s.icsDesc, alarmDays: LEAD },
      { summary: s.icsExpires, date: iso(reg.expires), description: s.icsDesc, alarmDays: LEAD },
    ]))
  }

  return (
    <Stack data-testid="vehicle-renewal">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-4">
        <Field label={s.kind}>
          <Seg data-testid="vh-kind">
            <SegButton active={kind === 'private'} onClick={() => setKind('private')} data-testid="vh-private">{s.private}</SegButton>
            <SegButton active={kind === 'public'} onClick={() => setKind('public')} data-testid="vh-public">{s.public}</SegButton>
          </Seg>
        </Field>
        <Field label={s.first}>
          <Input type="date" value={first} data-testid="vh-first" onChange={(e) => setFirst(e.target.value)} />
        </Field>
        <Field label={s.expiry}>
          <Input type="date" value={expiry} data-testid="vh-expiry" onChange={(e) => setExpiry(e.target.value)} />
        </Field>
        <Field label={s.last}>
          <Input type="date" value={last} data-testid="vh-last" onChange={(e) => setLast(e.target.value)} />
        </Field>
      </div>
      <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.firstHint} {s.expiryHint} {s.lastHint}</p>

      {blocked && (
        <Panel className="gap-1 border-gold-500" data-testid="vh-blocked">
          <p className="font-display text-[1.2rem] text-gold-500 rtl:font-ar">{s.blocked}</p>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.blockedBody}</p>
        </Panel>
      )}

      {insp && reg && (
        <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
          <Panel className="gap-1">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.inspection}</h2>
            {insp.exempt ? (
              <>
                <p className="text-[0.9rem] text-green-700 rtl:font-ar" data-testid="vh-exempt">
                  {s.exemptUntil} {show(insp.due)}
                </p>
                <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.exemptBody(EXEMPT_YEARS[kind])}</p>
              </>
            ) : (
              <>
                <p className={`text-[0.95rem] rtl:font-ar ${insp.daysAway < 0 ? 'text-gold-500' : 'text-ink'}`} data-testid="vh-inspection">
                  {insp.daysAway < 0
                    ? `${s.overdueBy} ${Math.abs(insp.daysAway)} ${s.daysAgo}`
                    : `${s.dueOn} ${show(insp.due)} — ${s.inDays} ${insp.daysAway} ${s.days}`}
                </p>
                <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{last ? s.annual : s.never}</p>
              </>
            )}
          </Panel>

          <Panel className="gap-1">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.registration}</h2>
            <p className={`text-[0.95rem] rtl:font-ar ${reg.daysAway < 0 ? 'text-gold-500' : 'text-ink'}`} data-testid="vh-registration">
              {reg.daysAway < 0
                ? `${s.expired} — ${Math.abs(reg.daysAway)} ${s.daysAgo}`
                : `${s.expiresIn} ${reg.daysAway} ${s.days} — ${show(reg.expires)}`}
            </p>
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="vh-window">
              {reg.open ? s.canRenew : `${s.notYet} · ${s.windowOpens} ${show(reg.opens)}`}
            </p>
            <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.windowBody}</p>
          </Panel>
        </div>
      )}

      {insp && reg && (
        <>
          <Button variant="primary" className="self-start px-3 py-1" onClick={exportIcs} data-testid="vh-ics">
            <DownloadIcon /> {s.ics}
          </Button>
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar" data-testid="vh-ics-note">{s.icsNote}</p>
        </>
      )}

      <Panel className="gap-1">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.clear}</h2>
        <p className="text-[0.88rem] text-ink-soft rtl:font-ar">{s.orderBody}</p>
      </Panel>

      <Disclaimer kind="official" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
