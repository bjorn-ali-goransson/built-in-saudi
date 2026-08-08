import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Field, Input, Stack, Panel, Seg, SegButton, Disclaimer } from '../../components/ui'
import { weighted, levers, weightsValid, weightsTotal, PRESETS, type Weights } from './score'

const STR = {
  en: {
    intro: 'Your weighted admission percentage, at whatever weighting the university actually uses. The formula is exact; only the weights differ between universities and programmes, so they are yours to set rather than ours to guess — and the tool shows the same scores under every common weighting so you can see where you stand best.',
    school: 'High school %', qudurat: 'Qudurat (GAT)', tahsili: 'Tahsili',
    weighting: 'Weighting', custom: 'Custom',
    wSchool: 'School %', wQudurat: 'Qudurat %', wTahsili: 'Tahsili %',
    invalid: (t: number) => `The weights add up to ${t}%, not 100% — the result below is not meaningful until they do.`,
    result: 'Weighted percentage',
    compare: 'Under each common weighting',
    levers: 'Where your remaining points are',
    leverBody: 'Each point of a component is worth its weight, so the same effort is not worth the same everywhere. This is sorted by what is actually still available — a heavily weighted subject already at 98 has little left to give.',
    perPoint: 'per point', headroom: 'points left', potential: 'could still add',
    names: { school: 'High school', qudurat: 'Qudurat', tahsili: 'Tahsili' } as Record<string, string>,
    disclaimer: 'The formula is arithmetic; everything around it is the university’s. Weights differ by university and by programme, cut-offs move every year with the applicant pool, and some programmes add interviews or their own tests. Confirm the weighting and the cut-off with the university before relying on any of this.',
  },
  ar: {
    intro: 'نسبتك الموزونة للقبول، بأي ترجيح تستخدمه الجامعة فعلًا. فالمعادلة ثابتة، ولا يختلف إلا الترجيح بين الجامعات والبرامج، فهو من إدخالك لا من تخميننا — وتعرض الأداة الدرجات نفسها بكل ترجيح شائع لترى أين موقعك أفضل.',
    school: 'الثانوية %', qudurat: 'القدرات', tahsili: 'التحصيلي',
    weighting: 'الترجيح', custom: 'مخصص',
    wSchool: 'الثانوية %', wQudurat: 'القدرات %', wTahsili: 'التحصيلي %',
    invalid: (t: number) => `مجموع الأوزان ${t}% لا 100% — والنتيجة أدناه بلا معنى حتى يستقيم المجموع.`,
    result: 'النسبة الموزونة',
    compare: 'بكل ترجيح شائع',
    levers: 'أين نقاطك المتبقية',
    leverBody: 'قيمة النقطة من كل عنصر بقدر وزنه، فالجهد نفسه لا يساوي الشيء نفسه في كل موضع. والترتيب هنا بحسب المتاح فعلًا — فالمادة ذات الوزن العالي التي بلغت 98 لم يبق فيها كثير.',
    perPoint: 'للنقطة', headroom: 'نقطة متبقية', potential: 'يمكن أن تضيف',
    names: { school: 'الثانوية', qudurat: 'القدرات', tahsili: 'التحصيلي' } as Record<string, string>,
    disclaimer: 'المعادلة حساب، وما حولها من شأن الجامعة. فالأوزان تختلف بين الجامعات والبرامج، وتتغير نسب القبول كل عام بحسب المتقدمين، وبعض البرامج تضيف مقابلات أو اختباراتها الخاصة. فتأكّد من الترجيح ومن نسبة القبول لدى الجامعة قبل أن تعتمد على شيء من هذا.',
  },
}

export default function AdmissionScoreTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 })

  const [scores, setScores] = useState({ school: '95', qudurat: '85', tahsili: '80' })
  const [preset, setPreset] = useState('ksu')
  const [custom, setCustom] = useState<Weights>({ school: 30, qudurat: 30, tahsili: 40 })

  const w = preset === 'custom' ? custom : (PRESETS.find((p) => p.id === preset)?.w ?? PRESETS[0].w)
  const nums = {
    school: Number(scores.school) || 0,
    qudurat: Number(scores.qudurat) || 0,
    tahsili: Number(scores.tahsili) || 0,
  }
  const valid = weightsValid(w)
  const total = useMemo(() => weighted(nums, w), [nums, w])
  const rows = useMemo(() => levers(nums, w), [nums, w])

  const set = (k: keyof typeof scores) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setScores((p) => ({ ...p, [k]: e.target.value }))

  return (
    <Stack data-testid="admission-score">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3">
        <Field label={s.school}><Input type="number" inputMode="decimal" min="0" max="100" value={scores.school} data-testid="as-school" onChange={set('school')} /></Field>
        <Field label={s.qudurat}><Input type="number" inputMode="decimal" min="0" max="100" value={scores.qudurat} data-testid="as-qudurat" onChange={set('qudurat')} /></Field>
        <Field label={s.tahsili}><Input type="number" inputMode="decimal" min="0" max="100" value={scores.tahsili} data-testid="as-tahsili" onChange={set('tahsili')} /></Field>
      </div>

      <Field label={s.weighting}>
        <Seg data-testid="as-weighting">
          {PRESETS.map((p) => (
            <SegButton key={p.id} active={preset === p.id} data-testid={`as-w-${p.id}`} onClick={() => setPreset(p.id)}>
              {locale === 'ar' ? p.labelAr : p.label}
            </SegButton>
          ))}
          <SegButton active={preset === 'custom'} data-testid="as-w-custom" onClick={() => setPreset('custom')}>{s.custom}</SegButton>
        </Seg>
      </Field>

      {preset === 'custom' && (
        <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3">
          {(['school', 'qudurat', 'tahsili'] as const).map((k) => (
            <Field key={k} label={k === 'school' ? s.wSchool : k === 'qudurat' ? s.wQudurat : s.wTahsili}>
              <Input type="number" inputMode="decimal" min="0" max="100" value={String(custom[k])} data-testid={`as-cw-${k}`}
                onChange={(e) => setCustom((p) => ({ ...p, [k]: Number(e.target.value) || 0 }))} />
            </Field>
          ))}
        </div>
      )}

      {!valid && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="as-invalid">{s.invalid(weightsTotal(w))}</p>}

      <Panel className="gap-2">
        <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.result}</div>
        <div className={`font-mono text-[2rem] font-semibold ${valid ? 'text-green-700' : 'text-ink-faint'}`} data-testid="as-total">{fmt(total)}%</div>
      </Panel>

      <div className="flex flex-col gap-2">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.compare}</h2>
        <div className="overflow-x-auto">
          <table className="border-collapse text-[0.85rem]" data-testid="as-compare">
            <tbody>
              {PRESETS.map((p) => (
                <tr key={p.id} data-testid={`as-row-${p.id}`}>
                  <td className="border border-[color:var(--line)] px-3 py-1 text-ink-soft rtl:font-ar whitespace-nowrap">{locale === 'ar' ? p.labelAr : p.label}</td>
                  <td className="border border-[color:var(--line)] px-3 py-1 font-mono text-ink">{fmt(weighted(nums, p.w))}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Panel className="gap-2">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.levers}</h2>
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.leverBody}</p>
        <ul className="flex flex-col gap-1 list-none p-0 m-0 text-[0.88rem]" data-testid="as-levers">
          {rows.map((r, i) => (
            <li key={r.key} className="flex flex-wrap gap-x-4 text-ink-soft rtl:font-ar" data-testid={`as-lever-${i}`}>
              <span className="text-ink font-medium min-w-[7rem]">{s.names[r.key]}</span>
              <span className="font-mono">{fmt(r.perPoint)} {s.perPoint}</span>
              <span className="font-mono text-ink-faint">{fmt(r.headroom)} {s.headroom}</span>
              <span className="font-mono text-green-700">+{fmt(r.potential)} {s.potential}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Disclaimer kind="official" locale={locale}>{s.disclaimer}</Disclaimer>
    </Stack>
  )
}
