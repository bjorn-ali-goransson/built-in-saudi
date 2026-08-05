import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Input, Select, Stack, Seg, SegButton, Panel, Disclaimer } from '../../components/ui'
import {
  toMgdl, toMmol, a1cPercentToMmolMol, a1cMmolMolToPercent, eagMgdl, eagMmol,
  band, a1cBand, BAND_LABEL, BAND_TONE, CONTEXTS, isUrgentLow, isUrgentHigh,
} from './convert'

const STR = {
  en: {
    glucose: 'Blood glucose', a1c: 'HbA1c',
    value: 'Reading', unit: 'Unit', context: 'Taken when',
    equals: 'Equals',
    where: 'Where this sits',
    eag: 'Estimated average glucose',
    eagNote: 'From the ADAG regression — a population average. Individual red-cell lifespan shifts it, so treat it as a guide to the trend, not a reading.',
    urgentLow: 'A reading this low needs treating now — fast-acting sugar, then re-test. If the person is confused or cannot swallow, call emergency services (997).',
    urgentHigh: 'A reading this high, especially with vomiting, deep breathing or drowsiness, can mean ketoacidosis. Contact a doctor or emergency services (997) rather than waiting.',
    factorNote: 'mg/dL and mmol/L differ by a factor of 18.02 — the molar mass of glucose. Saudi labs and meters report mg/dL; most research papers and European results use mmol/L.',
    bands: 'These bands describe where a reading falls. They do not diagnose anything — that takes a repeat test and a doctor.',
  },
  ar: {
    glucose: 'سكر الدم', a1c: 'السكر التراكمي',
    value: 'القراءة', unit: 'الوحدة', context: 'وقت القياس',
    equals: 'تساوي',
    where: 'أين تقع هذه القراءة',
    eag: 'متوسط السكر التقديري',
    eagNote: 'من معادلة دراسة ADAG — وهو متوسط لعموم الناس. ويختلف بحسب عمر كريات الدم الحمراء لدى كل شخص، فاعتبره دليلًا على الاتجاه لا قراءةً.',
    urgentLow: 'قراءة بهذا الانخفاض تحتاج معالجة فورية — سكر سريع المفعول ثم إعادة القياس. وإن كان الشخص مشوّشًا أو لا يستطيع البلع فاتصل بالإسعاف (٩٩٧).',
    urgentHigh: 'قراءة بهذا الارتفاع، خصوصًا مع قيء أو تنفّس عميق أو خمول، قد تعني الحماض الكيتوني. راجع طبيبًا أو اتصل بالإسعاف (٩٩٧) ولا تنتظر.',
    factorNote: 'تختلف mg/dL عن mmol/L بمعامل ١٨٫٠٢ — وهو الكتلة المولية للجلوكوز. تستخدم المختبرات والأجهزة في السعودية mg/dL، بينما تستخدم معظم الأبحاث والنتائج الأوروبية mmol/L.',
    bands: 'تصف هذه النطاقات موضع القراءة فقط، ولا تشخّص شيئًا — فالتشخيص يحتاج إعادة تحليل وطبيبًا.',
  },
}

type Mode = 'glucose' | 'a1c'

export default function GlucoseUnitsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [mode, setMode] = useState<Mode>('glucose')
  const [unit, setUnit] = useState<'mgdl' | 'mmol'>('mgdl')
  const [a1cUnit, setA1cUnit] = useState<'percent' | 'mmolmol'>('percent')
  const [value, setValue] = useState('110')
  const [context, setContext] = useState<'fasting' | 'random' | 'postMeal'>('fasting')

  const num = parseFloat(value.replace(',', '.'))
  const valid = Number.isFinite(num) && num > 0

  const g = useMemo(() => {
    if (!valid || mode !== 'glucose') return null
    const mgdl = unit === 'mgdl' ? num : toMgdl(num)
    return { mgdl, mmol: unit === 'mmol' ? num : toMmol(num) }
  }, [num, unit, valid, mode])

  const a = useMemo(() => {
    if (!valid || mode !== 'a1c') return null
    const pct = a1cUnit === 'percent' ? num : a1cMmolMolToPercent(num)
    return {
      pct,
      mmolmol: a1cUnit === 'mmolmol' ? num : a1cPercentToMmolMol(num),
      eagMgdl: eagMgdl(pct),
      eagMmol: eagMmol(pct),
    }
  }, [num, a1cUnit, valid, mode])

  const b = g ? band(g.mgdl, context) : a ? a1cBand(a.pct) : null

  return (
    <Stack data-testid="glucose-units">
      <Seg>
        <SegButton active={mode === 'glucose'} data-testid="gl-mode-glucose" onClick={() => { setMode('glucose'); setValue('110') }}>{s.glucose}</SegButton>
        <SegButton active={mode === 'a1c'} data-testid="gl-mode-a1c" onClick={() => { setMode('a1c'); setValue('6.5') }}>{s.a1c}</SegButton>
      </Seg>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.value}
          <Input type="number" step="any" min={0} dir="ltr" className="w-32 font-mono text-[1.1rem]"
            data-testid="gl-value" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.unit}
          {mode === 'glucose' ? (
            <Select className="w-32" data-testid="gl-unit" value={unit} onChange={(e) => setUnit(e.target.value as 'mgdl' | 'mmol')}>
              <option value="mgdl">mg/dL</option>
              <option value="mmol">mmol/L</option>
            </Select>
          ) : (
            <Select className="w-32" data-testid="gl-a1cunit" value={a1cUnit} onChange={(e) => setA1cUnit(e.target.value as 'percent' | 'mmolmol')}>
              <option value="percent">%  (NGSP)</option>
              <option value="mmolmol">mmol/mol (IFCC)</option>
            </Select>
          )}
        </label>
        {mode === 'glucose' && (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.context}
            <Select className="min-w-[12rem]" data-testid="gl-context" value={context}
              onChange={(e) => setContext(e.target.value as typeof context)}>
              {CONTEXTS.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.ar : c.en}</option>)}
            </Select>
          </label>
        )}
      </div>

      {g && (
        <Panel className="flex flex-wrap items-baseline gap-x-6 gap-y-2" data-testid="gl-result">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.equals}</span>
          <span className="font-display text-[clamp(1.6rem,5vw,2.2rem)] text-ink" data-testid="gl-mgdl">
            {g.mgdl.toFixed(0)} <span className="text-[0.5em] text-ink-faint">mg/dL</span>
          </span>
          <span className="font-display text-[clamp(1.6rem,5vw,2.2rem)] text-ink" data-testid="gl-mmol">
            {g.mmol.toFixed(1)} <span className="text-[0.5em] text-ink-faint">mmol/L</span>
          </span>
        </Panel>
      )}

      {a && (
        <Panel className="flex flex-col gap-3" data-testid="gl-a1cresult">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.equals}</span>
            <span className="font-display text-[clamp(1.5rem,5vw,2rem)] text-ink" data-testid="gl-a1cpct">
              {a.pct.toFixed(1)} <span className="text-[0.5em] text-ink-faint">%</span>
            </span>
            <span className="font-display text-[clamp(1.5rem,5vw,2rem)] text-ink" data-testid="gl-a1cmmol">
              {a.mmolmol.toFixed(0)} <span className="text-[0.5em] text-ink-faint">mmol/mol</span>
            </span>
          </div>
          <div className="flex flex-col gap-1 border-t border-[color:var(--line)] pt-2">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.eag}</span>
            <span className="font-mono text-[1.05rem] text-ink" data-testid="gl-eag">
              {a.eagMgdl.toFixed(0)} mg/dL · {a.eagMmol.toFixed(1)} mmol/L
            </span>
            <span className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.eagNote}</span>
          </div>
        </Panel>
      )}

      {b && (
        <p className="text-[0.95rem] rtl:font-ar" data-testid="gl-band">
          <span className="text-ink-faint">{s.where}: </span>
          <b className={BAND_TONE[b]}>{BAND_LABEL[b][locale]}</b>
        </p>
      )}

      {g && isUrgentLow(g.mgdl) && (
        <Disclaimer kind="medical" locale={locale}>{s.urgentLow}</Disclaimer>
      )}
      {g && isUrgentHigh(g.mgdl) && (
        <Disclaimer kind="medical" locale={locale}>{s.urgentHigh}</Disclaimer>
      )}
      {!(g && (isUrgentLow(g.mgdl) || isUrgentHigh(g.mgdl))) && (
        <Disclaimer kind="medical" locale={locale}>{s.bands}</Disclaimer>
      )}

      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.factorNote}</p>
    </Stack>
  )
}
