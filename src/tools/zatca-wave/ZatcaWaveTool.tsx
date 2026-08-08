import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Field, Input, Stack, Panel, Disclaimer } from '../../components/ui'
import { classify, WAVES, YEARS } from './wave'

const STR = {
  en: {
    intro: 'Which ZATCA e-invoicing wave your business is in, and by when you have to be integrated with Fatoora. Enter your VAT-taxable revenue for each year — the rule uses the HIGHEST of the three, not the latest.',
    year: (y: number) => `Revenue in ${y}`,
    basis: 'The figure the rule uses', wave: 'Your wave', deadline: 'Integrate by',
    sar: 'SAR',
    left: (n: number) => `${n} days left`,
    over: (n: number) => `${n} days overdue`,
    dueToday: 'Due today',
    anyYear: 'Any ONE of these years crossing the threshold puts you in scope — it does not have to be all three, and it does not have to be the most recent. A good 2022 followed by two quiet years still counts.',
    biggerEarlier: 'A bigger business has an EARLIER deadline, which catches people out. The waves started at SAR 3 billion and step down over time, so crossing a higher threshold puts you in an earlier wave — reading the lowest published threshold and taking its date can hand you months you do not have.',
    earlierTitle: 'An earlier wave may already have caught you',
    earlierBody: 'Waves 1–22 ran from SAR 3 billion downwards between 2023 and 2025, and their exact boundaries are not published in a form this page can check. If ZATCA notified you before this wave, that notice and its date are yours — this one is not. Fatoora shows your status.',
    noneTitle: 'No announced wave reaches you yet',
    noneBody: (n: string) => `The lowest announced threshold is SAR ${n}. Waves are announced with at least six months' notice and the thresholds have fallen steadily, so this is "not yet" rather than "never".`,
    notice: 'ZATCA writes to each taxpayer directly, at least six months before their deadline, and that letter is the official trigger. This page tells you which wave the published thresholds put you in — it is not the notice.',
    disclaimer: 'Wave thresholds and dates as published by ZATCA. Waves are added over time, so a business under the lowest threshold here may be in scope by a later announcement. Your ZATCA notice and the Fatoora portal are the record, not this page.',
  },
  ar: {
    intro: 'في أي موجة من موجات الفوترة الإلكترونية أنت، ومتى عليك الربط مع فاتورة. أدخل إيراداتك الخاضعة للضريبة لكل سنة — فالقاعدة تأخذ الأعلى من الثلاث لا الأحدث.',
    year: (y: number) => `الإيراد في ${y}`,
    basis: 'الرقم الذي تعتمده القاعدة', wave: 'موجتك', deadline: 'الربط قبل',
    sar: 'ريال',
    left: (n: number) => `بقي ${n} يومًا`,
    over: (n: number) => `تأخّرت ${n} يومًا`,
    dueToday: 'يستحق اليوم',
    anyYear: 'تجاوز الحد في أي سنة من هذه السنوات يدخلك في النطاق — لا يلزم أن تكون الثلاث، ولا أن تكون الأحدث. فسنة 2022 جيدة تليها سنتان هادئتان تكفي.',
    biggerEarlier: 'المنشأة الأكبر موعدها أبكر، وهذا ما يخدع الناس. فالموجات بدأت من ثلاثة مليارات ريال وتنزل تدريجيًا، فتجاوز حد أعلى يضعك في موجة أسبق — والاكتفاء بأدنى حد منشور وأخذ تاريخه قد يمنحك أشهرًا لا تملكها.',
    earlierTitle: 'قد تكون موجة أسبق قد شملتك',
    earlierBody: 'جرت الموجات من الأولى إلى الثانية والعشرين من ثلاثة مليارات ريال نزولًا بين 2023 و2025، وحدودها الدقيقة غير منشورة بصورة تستطيع هذه الصفحة التحقق منها. فإن أشعرتك الهيئة قبل هذه الموجة فذلك الإشعار وتاريخه هما لك، لا هذا. وبوابة فاتورة تبيّن حالتك.',
    noneTitle: 'لا موجة معلنة تصل إليك بعد',
    noneBody: (n: string) => `أدنى حد معلن هو ${n} ريال. وتُعلن الموجات قبل ستة أشهر على الأقل، والحدود تنزل باطراد، فهذا «ليس بعد» لا «أبدًا».`,
    notice: 'تخاطب الهيئة كل مكلّف مباشرةً قبل موعده بستة أشهر على الأقل، وذلك الإشعار هو المرجع الرسمي. وهذه الصفحة تقول لك أي موجة تضعك فيها الحدود المنشورة — وليست الإشعار.',
    disclaimer: 'حدود الموجات وتواريخها كما نشرتها هيئة الزكاة والضريبة والجمارك. وتُضاف الموجات مع الوقت، فقد تدخل منشأة تحت أدنى حد هنا في النطاق بإعلان لاحق. والمرجع إشعارك من الهيئة وبوابة فاتورة لا هذه الصفحة.',
  },
}

export default function ZatcaWaveTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')

  const [rev, setRev] = useState<Record<number, string>>({ 2022: '', 2023: '400000', 2024: '' })
  const nums = useMemo(() => YEARS.map((y) => Number(rev[y]) || 0), [rev])
  const v = useMemo(() => classify(nums), [nums])

  const dateFmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

  return (
    <Stack data-testid="zatca-wave">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3">
        {YEARS.map((y) => (
          <Field key={y} label={s.year(y)}>
            <Input
              type="number"
              min={0}
              step={1000}
              value={rev[y]}
              data-testid={`zw-${y}`}
              onChange={(e) => setRev((r) => ({ ...r, [y]: e.target.value }))}
            />
          </Field>
        ))}
      </div>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.basis}</div>
            <div className="font-mono text-[1.15rem] text-ink" data-testid="zw-basis">{fmt(v.basis)} {s.sar}</div>
          </div>
          {v.wave && (
            <>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.wave}</div>
                <div className="font-mono text-[1.5rem] font-semibold text-green-700" data-testid="zw-wave">{fmt(v.wave.n)}</div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.deadline}</div>
                <div className="font-mono text-[1.15rem] text-ink" data-testid="zw-deadline">{dateFmt(v.wave.deadline)}</div>
              </div>
            </>
          )}
        </div>
        {v.wave && v.daysLeft !== null && (
          <p
            className={`text-[0.9rem] rtl:font-ar ${v.daysLeft < 0 ? 'text-gold-500' : 'text-ink-soft'}`}
            data-testid="zw-countdown"
          >
            {v.daysLeft === 0 ? s.dueToday : v.daysLeft > 0 ? s.left(v.daysLeft) : s.over(-v.daysLeft)}
          </p>
        )}
      </Panel>

      {v.maybeEarlier && (
        <Panel className="gap-1 border-gold-500" data-testid="zw-earlier">
          <p className="font-display text-[1.2rem] text-gold-500 rtl:font-ar">{s.earlierTitle}</p>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.earlierBody}</p>
        </Panel>
      )}

      {!v.wave && (
        <Panel className="gap-1" data-testid="zw-none">
          <p className="font-display text-[1.05rem] rtl:font-ar">{s.noneTitle}</p>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.noneBody(fmt(v.nextThreshold))}</p>
        </Panel>
      )}

      <Panel className="gap-1" data-testid="zw-any-year">
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.anyYear}</p>
      </Panel>
      <Panel className="gap-1" data-testid="zw-bigger-earlier">
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.biggerEarlier}</p>
      </Panel>
      <Panel className="gap-1" data-testid="zw-notice">
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.notice}</p>
      </Panel>

      <p className="text-[0.8rem] text-ink-faint rtl:font-ar" data-testid="zw-waves">
        {WAVES.map((w) => `${fmt(w.n)}: > ${fmt(w.threshold)} → ${dateFmt(w.deadline)}`).join('  ·  ')}
      </p>

      <Disclaimer kind="legal" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
