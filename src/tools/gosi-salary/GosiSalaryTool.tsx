import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Field, Input, Stack, Panel, Seg, SegButton, Disclaimer } from '../../components/ui'
import { compute, pensionRate, NEW_PENSION_BY_YEAR, WAGE_CAP, type Scheme } from './gosi'

const STR = {
  en: {
    intro: 'What GOSI actually takes, and what you are actually paid. Contributions are charged on your basic salary plus housing allowance only — not on transport, phone, commission or bonus — and the whole thing is capped at SAR 45,000 a month.',
    nationality: 'Employee', saudi: 'Saudi', expat: 'Non-Saudi',
    scheme: 'First registered with GOSI',
    old: 'Before 3 July 2024', new: 'On or after 3 July 2024',
    schemeHint: 'This is what decides your rate — not your age, your employer, or when you started this job. Any subscription before that date keeps you on the old rates permanently.',
    basic: 'Basic salary', housing: 'Housing allowance', other: 'Other allowances',
    otherHint: 'Transport, phone, commission, bonus — paid to you, but outside the contribution base.',
    year: 'Rates for',
    gross: 'Gross pay', net: 'Take-home', deduction: 'Your GOSI deduction',
    base: 'Contribution base', capped: 'Above the cap, not charged', excluded: 'Outside the base',
    employee: 'Deducted from you', employer: 'Paid by your employer', cost: 'Total cost to employer',
    pension: 'Pension', saned: 'SANED (unemployment)', hazards: 'Occupational hazards',
    noDeduction: 'Nothing is deducted from you.',
    expatNote: 'A non-Saudi employee contributes nothing to GOSI. The employer pays 2% for occupational hazards and that is the whole of it — so a GOSI line deducted from a non-Saudi payslip is a mistake worth querying.',
    capNote: `Your basic and housing come to more than SAR ${WAGE_CAP.toLocaleString('en')}, so contributions stop at the cap. The rest is not charged.`,
    excludedNote: 'These allowances are paid to you but are not part of the contribution base, so nothing is deducted from them.',
    schedule: 'The new scheme rises every July',
    scheduleNote: 'Only the pension part moves. SANED stays at 0.75% each side and occupational hazards at 2% on the employer. The old scheme does not change at all.',
    scheduleYear: 'From July', scheduleYou: 'You', scheduleEmployer: 'Employer',
    sar: 'SAR',
    disclaimer: 'Rates and the wage ceiling are set by the General Organization for Social Insurance and change — most recently each July for the new scheme. Your payslip is the record; check it against your GOSI account.',
  },
  ar: {
    intro: 'ما تأخذه التأمينات فعلًا، وما تُقبض فعلًا. تُحتسب الاشتراكات على الراتب الأساسي وبدل السكن فقط — لا على النقل ولا الجوال ولا العمولة ولا المكافأة — والحد الأعلى 45,000 ريال شهريًا.',
    nationality: 'الموظف', saudi: 'سعودي', expat: 'غير سعودي',
    scheme: 'أول تسجيل في التأمينات',
    old: 'قبل 3 يوليو 2024', new: 'في 3 يوليو 2024 أو بعده',
    schemeHint: 'هذا ما يحدد نسبتك — لا عمرك ولا جهة عملك ولا تاريخ بدايتك في وظيفتك الحالية. وأي اشتراك سابق لذلك التاريخ يُبقيك على النسب القديمة دائمًا.',
    basic: 'الراتب الأساسي', housing: 'بدل السكن', other: 'بدلات أخرى',
    otherHint: 'النقل والجوال والعمولة والمكافأة — تُدفع لك لكنها خارج وعاء الاشتراك.',
    year: 'النسب لسنة',
    gross: 'إجمالي الراتب', net: 'الصافي', deduction: 'خصم التأمينات منك',
    base: 'وعاء الاشتراك', capped: 'فوق الحد الأعلى، لا يُحتسب', excluded: 'خارج الوعاء',
    employee: 'يُخصم منك', employer: 'يدفعه صاحب العمل', cost: 'التكلفة الكاملة على صاحب العمل',
    pension: 'المعاشات', saned: 'ساند (التعطّل عن العمل)', hazards: 'الأخطار المهنية',
    noDeduction: 'لا يُخصم منك شيء.',
    expatNote: 'الموظف غير السعودي لا يساهم في التأمينات بشيء. ويدفع صاحب العمل 2% للأخطار المهنية وهذا كل ما في الأمر — فوجود خصم تأمينات في مسيّر غير سعودي خطأ يستحق المراجعة.',
    capNote: `مجموع أساسيك وبدل سكنك يتجاوز ${WAGE_CAP.toLocaleString('ar-SA')} ريال، فتتوقف الاشتراكات عند الحد الأعلى ولا يُحتسب ما زاد.`,
    excludedNote: 'هذه البدلات تُدفع لك لكنها ليست من وعاء الاشتراك، فلا يُخصم منها شيء.',
    schedule: 'النظام الجديد يرتفع كل يوليو',
    scheduleNote: 'الجزء المتحرك هو المعاشات وحدها. أما ساند فيبقى 0.75% على كل طرف، والأخطار المهنية 2% على صاحب العمل. والنظام القديم لا يتغيّر إطلاقًا.',
    scheduleYear: 'من يوليو', scheduleYou: 'أنت', scheduleEmployer: 'صاحب العمل',
    sar: 'ريال',
    disclaimer: 'النسب والحد الأعلى للأجر تحددها المؤسسة العامة للتأمينات الاجتماعية وهي تتغيّر — وآخرها كل يوليو للنظام الجديد. ومسيّر رواتبك هو المرجع؛ قابله بحسابك في التأمينات.',
  },
}

const YEARS = Object.keys(NEW_PENSION_BY_YEAR).map(Number).sort()

export default function GosiSalaryTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 })
  const pct = (r: number) => `${(r * 100).toFixed(2).replace(/\.?0+$/, '')}%`

  const [saudi, setSaudi] = useState(true)
  const [scheme, setScheme] = useState<Scheme>('old')
  const [basic, setBasic] = useState('10000')
  const [housing, setHousing] = useState('2500')
  const [other, setOther] = useState('500')
  const [year, setYear] = useState(2026)

  const r = useMemo(() => compute({
    saudi, scheme, year,
    basic: Number(basic) || 0,
    housing: Number(housing) || 0,
    other: Number(other) || 0,
  }), [saudi, scheme, year, basic, housing, other])

  const label = (k: 'pension' | 'saned' | 'hazards') => s[k]

  return (
    <Stack data-testid="gosi-salary">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
        <Field label={s.nationality}>
          <Seg data-testid="gs-nationality">
            <SegButton active={saudi} onClick={() => setSaudi(true)} data-testid="gs-saudi">{s.saudi}</SegButton>
            <SegButton active={!saudi} onClick={() => setSaudi(false)} data-testid="gs-expat">{s.expat}</SegButton>
          </Seg>
        </Field>
        {saudi && (
          <Field label={s.scheme}>
            <Seg data-testid="gs-scheme">
              <SegButton active={scheme === 'old'} onClick={() => setScheme('old')} data-testid="gs-old">{s.old}</SegButton>
              <SegButton active={scheme === 'new'} onClick={() => setScheme('new')} data-testid="gs-new">{s.new}</SegButton>
            </Seg>
          </Field>
        )}
      </div>
      {saudi && <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.schemeHint}</p>}

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3">
        <Field label={s.basic}><Input type="number" inputMode="decimal" min="0" value={basic} data-testid="gs-basic" onChange={(e) => setBasic(e.target.value)} /></Field>
        <Field label={s.housing}><Input type="number" inputMode="decimal" min="0" value={housing} data-testid="gs-housing" onChange={(e) => setHousing(e.target.value)} /></Field>
        <Field label={s.other}><Input type="number" inputMode="decimal" min="0" value={other} data-testid="gs-other" onChange={(e) => setOther(e.target.value)} /></Field>
      </div>
      <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.otherHint}</p>

      {saudi && scheme === 'new' && (
        <Field label={s.year}>
          <Seg data-testid="gs-year">
            {YEARS.map((y) => (
              <SegButton key={y} active={year === y} onClick={() => setYear(y)} data-testid={`gs-year-${y}`}>{y}</SegButton>
            ))}
          </Seg>
        </Field>
      )}

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.gross}</div>
            <div className="font-mono text-[1.15rem] text-ink" data-testid="gs-gross">{fmt(r.gross)} {s.sar}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.deduction}</div>
            <div className="font-mono text-[1.15rem] text-gold-500" data-testid="gs-deduction">{fmt(r.employeeTotal)} {s.sar}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.net}</div>
            <div className="font-mono text-[1.4rem] font-semibold text-green-700" data-testid="gs-net">{fmt(r.net)} {s.sar}</div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3 text-[0.85rem]">
        <div className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2">
          <div className="text-ink-faint">{s.base}</div>
          <div className="font-mono text-ink" data-testid="gs-base">{fmt(r.contributable)} {s.sar}</div>
        </div>
        <div className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2">
          <div className="text-ink-faint">{s.excluded}</div>
          <div className="font-mono text-ink" data-testid="gs-excluded">{fmt(r.excluded)} {s.sar}</div>
        </div>
        <div className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2">
          <div className="text-ink-faint">{s.capped}</div>
          <div className="font-mono text-ink" data-testid="gs-capped">{fmt(r.cappedOff)} {s.sar}</div>
        </div>
      </div>

      {r.cappedOff > 0 && <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="gs-cap-note">{s.capNote}</p>}
      {r.excluded > 0 && <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.excludedNote}</p>}

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
        <Panel className="gap-1">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.employee}</h2>
          {r.employee.length === 0
            ? <p className="text-[0.9rem] text-ink rtl:font-ar" data-testid="gs-no-deduction">{s.noDeduction}</p>
            : r.employee.map((l) => (
              <div key={l.label} className="flex justify-between gap-3 text-[0.88rem]" data-testid={`gs-emp-${l.label}`}>
                <span className="text-ink-soft rtl:font-ar">{label(l.label)} <span className="text-ink-faint font-mono">{pct(l.rate)}</span></span>
                <span className="font-mono text-ink">{fmt(l.amount)}</span>
              </div>
            ))}
        </Panel>
        <Panel className="gap-1">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.employer}</h2>
          {r.employer.map((l) => (
            <div key={l.label} className="flex justify-between gap-3 text-[0.88rem]" data-testid={`gs-er-${l.label}`}>
              <span className="text-ink-soft rtl:font-ar">{label(l.label)} <span className="text-ink-faint font-mono">{pct(l.rate)}</span></span>
              <span className="font-mono text-ink">{fmt(l.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-3 text-[0.88rem] pt-1 border-t border-[color:var(--line-soft)]">
            <span className="text-ink-soft rtl:font-ar">{s.cost}</span>
            <span className="font-mono text-ink" data-testid="gs-cost">{fmt(r.costToEmployer)}</span>
          </div>
        </Panel>
      </div>

      {!saudi && <Panel><p className="text-[0.88rem] text-ink-soft rtl:font-ar" data-testid="gs-expat-note">{s.expatNote}</p></Panel>}

      {saudi && (
        <div className="flex flex-col gap-2">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.schedule}</h2>
          <div className="overflow-x-auto">
            <table className="border-collapse text-[0.85rem]" data-testid="gs-schedule">
              <tbody>
                <tr>
                  <td className="border border-[color:var(--line)] px-2 py-1 text-ink-faint">{s.scheduleYear}</td>
                  {YEARS.map((y) => <td key={y} className="border border-[color:var(--line)] px-2 py-1 font-mono text-ink">{y}</td>)}
                </tr>
                <tr>
                  <td className="border border-[color:var(--line)] px-2 py-1 text-ink-faint rtl:font-ar">{s.scheduleYou}</td>
                  {YEARS.map((y) => (
                    <td key={y} className="border border-[color:var(--line)] px-2 py-1 font-mono text-ink-soft">
                      {pct(pensionRate('new', y) + 0.0075)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-[color:var(--line)] px-2 py-1 text-ink-faint rtl:font-ar">{s.scheduleEmployer}</td>
                  {YEARS.map((y) => (
                    <td key={y} className="border border-[color:var(--line)] px-2 py-1 font-mono text-ink-soft">
                      {pct(pensionRate('new', y) + 0.0075 + 0.02)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.scheduleNote}</p>
        </div>
      )}

      <Disclaimer kind="financial" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
