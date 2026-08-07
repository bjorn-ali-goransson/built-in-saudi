import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Field, Input, Stack, Panel, Seg, SegButton, Check, Disclaimer } from '../../components/ui'
import { freezeVerdict, noticeStatus, NOTICE_DAYS, FREEZE_END, type Situation } from './rent'

const STR = {
  en: {
    intro: 'Two rules, and the date that separates them. Rent increases inside Riyadh’s urban boundary are frozen for five years from 25 September 2025 — but an escalation clause in a contract that was already in place on that date still stands, so two tenants in one building can get different answers. Separately, and everywhere in the Kingdom, a lease renews itself unless somebody gives notice 60 days before it ends.',
    where: 'Where', riyadh: 'Inside Riyadh', elsewhere: 'Anywhere else',
    signed: 'Contract signed', ends: 'Contract ends',
    situation: 'The property was',
    leased: 'Already let on 25 Sep 2025', vacant: 'Let before, empty then', never: 'Never let before',
    escalation: 'The contract has an escalation clause',
    increase: 'Can the rent go up?',
    yes: 'Yes', no: 'No',
    reasons: {
      'not-riyadh': 'The freeze is a Riyadh rule. Elsewhere, the rent is whatever the contract says — but the 60-day renewal notice below applies to you all the same.',
      expired: 'The five years are up, so the freeze no longer applies.',
      'pre-existing-escalation': 'The contract was in place before 25 September 2025 and contains an escalation clause, and REGA’s guidance is that such clauses stay valid and enforceable. This is the exception people miss.',
      frozen: 'The contract was entered on or after 25 September 2025, so escalation cannot be applied during the freeze — even if the term runs past it.',
      'first-agreement': 'A property never let before has no reference rent, so the first rent is whatever the two of you agree. It is then frozen at that figure.',
    } as Record<string, string>,
    pinned: 'Rent is pinned to',
    refs: {
      current: 'the rent as it stood on 25 September 2025',
      'last-ejar': 'the total value of the last contract registered on Ejar',
      agreed: 'the figure the two of you agreed, from then on',
    } as Record<string, string>,
    until: 'Freeze runs until',
    notice: 'Renewal notice',
    noticeBody: `A lease renews itself automatically unless one party tells the other at least ${NOTICE_DAYS} days before it ends. This applies across the Kingdom, not only in Riyadh.`,
    deadline: 'Give notice by', left: 'days left', missed: 'That date has passed — the lease renews unless the other side has already given notice.',
    refuse: 'Refusing to renew',
    refuseBody: 'In Riyadh a landlord can refuse renewal only in limited cases: the tenant has not paid, a structural defect is certified, or the landlord or their family will live in it.',
    disclaimer: 'This follows the published decree and REGA’s guidance, and cannot see your contract, your property, or whether your address falls inside Riyadh’s defined urban boundary — which is what the freeze turns on. Registered Ejar contracts and REGA are the authority; take a real dispute to them or to a lawyer.',
  },
  ar: {
    intro: 'قاعدتان، والتاريخ الفاصل بينهما. فالزيادات الإيجارية داخل النطاق العمراني للرياض مجمّدة خمس سنوات من 25 سبتمبر 2025 — لكن شرط الزيادة في عقد كان قائمًا قبل ذلك التاريخ يظل نافذًا، فقد يختلف الجواب بين مستأجرَين في عمارة واحدة. وبمعزل عن ذلك، وفي المملكة كلها، يتجدد العقد تلقائيًا ما لم يُشعر أحد الطرفين الآخر قبل انتهائه بستين يومًا.',
    where: 'الموقع', riyadh: 'داخل الرياض', elsewhere: 'خارجها',
    signed: 'تاريخ توقيع العقد', ends: 'تاريخ انتهاء العقد',
    situation: 'كان العقار',
    leased: 'مؤجَّرًا في 25 سبتمبر 2025', vacant: 'أُجّر سابقًا وكان شاغرًا', never: 'لم يُؤجَّر من قبل',
    escalation: 'في العقد شرط زيادة',
    increase: 'هل يجوز رفع الإيجار؟',
    yes: 'نعم', no: 'لا',
    reasons: {
      'not-riyadh': 'التجميد قرار خاص بالرياض. وخارجها يكون الإيجار بحسب العقد — أما مهلة الإشعار بستين يومًا أدناه فتسري عليك أيضًا.',
      expired: 'انقضت السنوات الخمس، فلم يعد التجميد ساريًا.',
      'pre-existing-escalation': 'العقد كان قائمًا قبل 25 سبتمبر 2025 وفيه شرط زيادة، وإرشادات الهيئة العامة للعقار أن هذه الشروط تبقى صحيحة ونافذة. وهذا هو الاستثناء الذي يغفل عنه الناس.',
      frozen: 'أُبرم العقد في 25 سبتمبر 2025 أو بعده، فلا يجوز تطبيق شرط الزيادة خلال مدة التجميد — ولو امتدت مدة العقد بعدها.',
      'first-agreement': 'العقار الذي لم يُؤجَّر من قبل لا مرجع لإيجاره، فالإيجار الأول ما تتفقان عليه، ثم يُجمَّد عنده.',
    } as Record<string, string>,
    pinned: 'الإيجار مثبَّت على',
    refs: {
      current: 'الإيجار كما كان في 25 سبتمبر 2025',
      'last-ejar': 'القيمة الإجمالية لآخر عقد مسجَّل في إيجار',
      agreed: 'المبلغ الذي اتفقتما عليه، ومن ثمّ يثبت',
    } as Record<string, string>,
    until: 'يستمر التجميد حتى',
    notice: 'إشعار التجديد',
    noticeBody: `يتجدد العقد تلقائيًا ما لم يُشعر أحد الطرفين الآخر قبل انتهائه بـ${NOTICE_DAYS} يومًا على الأقل. وهذا يسري في المملكة كلها لا في الرياض وحدها.`,
    deadline: 'أشعِر قبل', left: 'يومًا متبقيًا', missed: 'مضى هذا التاريخ — فيتجدد العقد ما لم يكن الطرف الآخر قد أشعر.',
    refuse: 'رفض التجديد',
    refuseBody: 'في الرياض لا يجوز للمؤجر رفض التجديد إلا في حالات محدودة: تخلّف المستأجر عن السداد، أو ثبوت خلل إنشائي، أو رغبة المالك أو أسرته في السكن فيه.',
    disclaimer: 'هذا يتبع القرار المنشور وإرشادات الهيئة العامة للعقار، ولا يرى عقدك ولا عقارك ولا ما إذا كان عنوانك داخل النطاق العمراني للرياض — وهو مناط التجميد. والمرجع عقود إيجار المسجَّلة والهيئة؛ فارفع أي نزاع حقيقي إليها أو إلى محامٍ.',
  },
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function RentRulesTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const today = useMemo(() => new Date(), [])

  const [riyadh, setRiyadh] = useState(true)
  const [signed, setSigned] = useState(() => iso(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())))
  const [ends, setEnds] = useState(() => iso(new Date(today.getFullYear(), today.getMonth() + 4, today.getDate())))
  const [situation, setSituation] = useState<Situation>('leased')
  const [escalation, setEscalation] = useState(false)

  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium' })
  const signedDate = useMemo(() => new Date(signed + 'T00:00:00'), [signed])
  const endsDate = useMemo(() => new Date(ends + 'T00:00:00'), [ends])
  const ok = !Number.isNaN(signedDate.getTime()) && !Number.isNaN(endsDate.getTime())

  const v = useMemo(
    () => (ok ? freezeVerdict({ riyadh, signed: signedDate, situation, escalation, today }) : null),
    [ok, riyadh, signedDate, situation, escalation, today],
  )
  const n = useMemo(() => (ok ? noticeStatus(endsDate, today) : null), [ok, endsDate, today])

  return (
    <Stack data-testid="rent-rules">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3">
        <Field label={s.where}>
          <Seg data-testid="rr-where">
            <SegButton active={riyadh} onClick={() => setRiyadh(true)} data-testid="rr-riyadh">{s.riyadh}</SegButton>
            <SegButton active={!riyadh} onClick={() => setRiyadh(false)} data-testid="rr-elsewhere">{s.elsewhere}</SegButton>
          </Seg>
        </Field>
        <Field label={s.signed}>
          <Input type="date" value={signed} data-testid="rr-signed" onChange={(e) => setSigned(e.target.value)} />
        </Field>
        <Field label={s.ends}>
          <Input type="date" value={ends} data-testid="rr-ends" onChange={(e) => setEnds(e.target.value)} />
        </Field>
      </div>

      {riyadh && (
        <div className="flex flex-col gap-2">
          <Field label={s.situation}>
            <Seg data-testid="rr-situation">
              {(['leased', 'vacant', 'never'] as Situation[]).map((k) => (
                <SegButton key={k} active={situation === k} onClick={() => setSituation(k)} data-testid={`rr-sit-${k}`}>{s[k]}</SegButton>
              ))}
            </Seg>
          </Field>
          <Check>
            <input type="checkbox" checked={escalation} data-testid="rr-escalation" onChange={(e) => setEscalation(e.target.checked)} />
            {s.escalation}
          </Check>
        </div>
      )}

      {v && (
        <Panel className="gap-2">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.increase}</h2>
          <p className={`font-display text-[1.5rem] leading-none ${v.increaseAllowed ? 'text-gold-500' : 'text-green-700'}`} data-testid="rr-answer">
            {v.increaseAllowed ? s.yes : s.no}
          </p>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="rr-reason">{s.reasons[v.reason]}</p>
          {v.reference && (
            <p className="text-[0.88rem] text-ink rtl:font-ar" data-testid="rr-reference">
              {s.pinned}: {s.refs[v.reference]}
            </p>
          )}
          {v.applies && <p className="text-[0.82rem] text-ink-faint">{s.until} {fmt.format(FREEZE_END)}</p>}
        </Panel>
      )}

      {n && (
        <Panel className="gap-1">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.notice}</h2>
          <p className={`text-[0.95rem] rtl:font-ar ${n.passed ? 'text-gold-500' : 'text-ink'}`} data-testid="rr-notice">
            {n.passed ? s.missed : `${s.deadline} ${fmt.format(n.deadline)} — ${n.daysLeft} ${s.left}`}
          </p>
          <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.noticeBody}</p>
        </Panel>
      )}

      {riyadh && (
        <Panel className="gap-1">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.refuse}</h2>
          <p className="text-[0.88rem] text-ink-soft rtl:font-ar" data-testid="rr-refuse">{s.refuseBody}</p>
        </Panel>
      )}

      <Disclaimer kind="legal" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
