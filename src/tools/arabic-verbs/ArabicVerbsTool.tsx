import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Seg, SegButton } from '../../components/ui'
import { conjugate, weakness, findIrregular, FORMS, type Cell, type Mood } from './conjugate'

const A = 'َ', I = 'ِ', U = 'ُ'
const TRI_FORMS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'X']
const QUAD_FORMS = ['Q1', 'Q2']
const onlyArabic = (s: string) => (s.match(/[ء-ي]/g) || []).join('')

// A few interesting examples spanning forms and the Form-I vowel patterns.
const EXAMPLES: { label: string; root: string; form: string; pastV?: string; presV?: string }[] = [
  { label: 'كَتَبَ', root: 'كتب', form: 'I', pastV: A, presV: U },
  { label: 'شَرِبَ', root: 'شرب', form: 'I', pastV: I, presV: A },
  { label: 'عَلَّمَ', root: 'علم', form: 'II' },
  { label: 'تَعَاوَنَ', root: 'عون', form: 'VI' },
  { label: 'اِسْتَخْرَجَ', root: 'خرج', form: 'X' },
  { label: 'دَحْرَجَ', root: 'دحرج', form: 'Q1' },
]

const DERIVED_LABEL: Record<string, { ar: string; en: string }> = {
  ismFa3il: { ar: 'اسم الفاعل', en: 'Active participle' },
  ismMaf3ul: { ar: 'اسم المفعول', en: 'Passive participle' },
  masdar: { ar: 'المصدر', en: 'Verbal noun' },
  mubalagha: { ar: 'صيغة المبالغة', en: 'Intensive' },
  makan: { ar: 'اسم المكان/الزمان', en: 'Noun of place/time' },
  aala: { ar: 'اسم الآلة', en: 'Noun of instrument' },
}

const STR = {
  en: {
    root: 'Root letters', rootPlaceholder: 'e.g. كتب or دحرج', rootHint: 'Type 3 letters (triliteral) or 4 (quadriliteral). Diacritics are ignored.', examples: 'Try:',
    form: 'Form (وزن)', pastVowel: 'Past middle vowel', presVowel: 'Present middle vowel',
    voice: 'Voice', active: 'Active', passive: 'Passive',
    past: 'Past — الماضي', present: 'Present — المضارع', imperative: 'Imperative — الأمر',
    derived: 'Derived nouns — المشتقات', emphatic: 'Emphatic (energetic) — التوكيد بالنون',
    marfu: 'Indicative', mansub: 'Subjunctive', majzum: 'Jussive',
    weak: 'Heads up: this root is weak', weakBody: (k: string) => `It's ${k} — the forms below use the sound (regular) template, so weak-letter rules (dropped/changed و/ي/ء) are NOT applied. Treat them as a scaffold and check the irregular notes.`,
    irregular: 'Common irregular verb', noPassive: 'This form has no passive.', masdarSama: 'سماعي — memorised, not derivable (e.g. كِتَابَة, عِلْم).',
    enter: 'Enter a 3- or 4-letter Arabic root above to see the full conjugation.',
    noImperativePassive: 'The imperative and derived nouns are formed from the active voice.',
  },
  ar: {
    root: 'حروف الجذر', rootPlaceholder: 'مثل: كتب أو دحرج', rootHint: 'اكتب ٣ حروف (ثلاثي) أو ٤ (رباعي). تُتجاهَل الحركات.', examples: 'جرّب:',
    form: 'الوزن', pastVowel: 'حركة العين في الماضي', presVowel: 'حركة العين في المضارع',
    voice: 'البناء', active: 'معلوم', passive: 'مجهول',
    past: 'الماضي', present: 'المضارع', imperative: 'الأمر',
    derived: 'المشتقات', emphatic: 'التوكيد بالنون',
    marfu: 'مرفوع', mansub: 'منصوب', majzum: 'مجزوم',
    weak: 'تنبيه: هذا الجذر معتلّ', weakBody: (k: string) => `النوع: ${k} — الجداول أدناه على القالب الصحيح السالم، فلا تُطبَّق أحكام الإعلال (حذف/قلب و/ي/ء). اعتبرها هيكلًا واطّلع على ملاحظات الشواذّ.`,
    irregular: 'فعل شاذّ شائع', noPassive: 'لا مبني للمجهول لهذا الوزن.', masdarSama: 'سماعي — يُحفظ ولا يُقاس (مثل: كِتَابَة، عِلْم).',
    enter: 'أدخل جذرًا عربيًّا من ٣ أو ٤ حروف أعلاه لعرض التصريف الكامل.',
    noImperativePassive: 'الأمر والمشتقات تُبنى من المعلوم.',
  },
}

function Grid({ cells }: { cells: Cell[] }) {
  return (
    <div dir="rtl" className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
      {cells.map((c) => (
        <div key={c.p} className="flex items-baseline gap-2 rounded-md border border-[color:var(--line-soft)] bg-[var(--surface)] px-2.5 py-1.5">
          <span className="text-[0.72rem] text-ink-faint font-ar shrink-0 w-14">{c.label}</span>
          <span className="font-ar text-[1.25rem] text-ink leading-tight" data-verb={c.word}>{c.word}</span>
        </div>
      ))}
    </div>
  )
}

export default function ArabicVerbsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('كتب')
  const [form, setForm] = useState('I')
  const [pastV, setPastV] = useState(A)
  const [presV, setPresV] = useState(U)
  const [voice, setVoice] = useState<'active' | 'passive'>('active')
  const [mood, setMood] = useState<Mood>('marfu')

  const root = useMemo(() => onlyArabic(raw).split(''), [raw])
  const isQuad = root.length === 4
  const valid = root.length === 3 || root.length === 4
  const available = isQuad ? QUAD_FORMS : TRI_FORMS
  const activeForm = available.includes(form) ? form : available[0]

  const result = useMemo(
    () => (valid ? conjugate(root, activeForm, { past: pastV, pres: presV }) : null),
    [root, valid, activeForm, pastV, presV],
  )
  const weak = useMemo(() => (valid ? weakness(root) : { weak: false }), [root, valid])
  const irregular = useMemo(() => (valid ? findIrregular(root) : undefined), [root, valid])
  const cfg = FORMS[activeForm]
  const showPassive = voice === 'passive' && !!result?.passivePast

  const vowelSeg = (val: string, set: (v: string) => void) => (
    <Seg>
      {([[A, 'فتحة'], [U, 'ضمة'], [I, 'كسرة']] as const).map(([v, lbl]) => (
        <SegButton key={v} active={val === v} onClick={() => set(v)}><span className="font-ar">{lbl}<span className="text-ink-faint"> ـ{v}</span></span></SegButton>
      ))}
    </Seg>
  )

  return (
    <Stack data-testid="arabic-verbs">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{s.root}</span>
          <input
            data-testid="av-root" value={raw} onChange={(e) => setRaw(e.target.value)} dir="rtl" placeholder={s.rootPlaceholder}
            className="rounded-md border border-[color:var(--line-soft)] bg-[var(--surface)] px-3 py-2 font-ar text-[1.6rem] text-ink outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--green-400)_45%,transparent)] tracking-[0.3em] text-center"
          />
          <span className="text-[0.8rem] text-ink-faint">{s.rootHint}</span>
        </label>

        <div className="flex flex-wrap items-center gap-1.5" dir="rtl">
          <span className="text-[0.72rem] text-ink-faint font-ar">{s.examples}</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" data-testid={`av-ex-${ex.root}`}
              onClick={() => { setRaw(ex.root); setForm(ex.form); setPastV(ex.pastV ?? A); setPresV(ex.presV ?? U) }}
              className="rounded-full border border-[color:var(--line-soft)] bg-[var(--surface)] px-2.5 py-1 font-ar text-[1.05rem] text-ink-soft hover:border-green-500 hover:text-green-800 cursor-pointer transition-colors">
              {ex.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{s.form}</span>
          <div className="flex flex-wrap gap-1.5" dir="rtl">
            {available.map((f) => (
              <button key={f} type="button" onClick={() => setForm(f)} data-testid={`av-form-${f}`}
                className={`rounded-md border px-3 py-1.5 cursor-pointer font-ar text-[1.05rem] transition-colors ${activeForm === f ? 'border-green-600 bg-[color-mix(in_srgb,var(--green-400)_14%,transparent)] text-green-800' : 'border-[color:var(--line-soft)] bg-[var(--surface)] text-ink-soft hover:border-green-500'}`}>
                {FORMS[f].wazn}<span className="text-ink-faint text-[0.7rem] ms-1" dir="ltr">{f}</span>
              </button>
            ))}
          </div>
        </div>

        {cfg.needsVowel && (
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1"><span className="text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{s.pastVowel}</span>{vowelSeg(pastV, setPastV)}</div>
            <div className="flex flex-col gap-1"><span className="text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{s.presVowel}</span>{vowelSeg(presV, setPresV)}</div>
          </div>
        )}

        {result?.passivePast && (
          <div className="flex flex-col gap-1">
            <span className="text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{s.voice}</span>
            <Seg>
              <SegButton active={voice === 'active'} onClick={() => setVoice('active')} data-testid="av-active">{s.active}</SegButton>
              <SegButton active={voice === 'passive'} onClick={() => setVoice('passive')} data-testid="av-passive">{s.passive}</SegButton>
            </Seg>
          </div>
        )}
      </div>

      {!valid && <p className="text-ink-faint text-[0.95rem]">{s.enter}</p>}

      {result && (
        <div className="flex flex-col gap-4">
          {irregular && (
            <div dir="rtl" className="rounded-md border-s-4 border-brass-500 bg-[color-mix(in_srgb,var(--brass-400)_10%,transparent)] px-3 py-2" data-testid="av-irregular">
              <p className="text-[0.8rem] font-semibold text-ink">{s.irregular}</p>
              <p className="font-ar text-[1.1rem] text-ink">{irregular.past} — {irregular.present}</p>
              <p className="text-[0.9rem] text-ink-soft font-ar">{irregular.note}</p>
              <p className="text-[0.82rem] text-ink-faint" dir="ltr">{irregular.noteEn}</p>
            </div>
          )}
          {weak.weak && (
            <div dir="rtl" className="rounded-md border-s-4 border-amber-500 bg-[color-mix(in_srgb,#f59e0b_10%,transparent)] px-3 py-2" data-testid="av-weak">
              <p className="text-[0.85rem] font-semibold text-ink font-ar">{s.weak} <span className="text-amber-700">({weak.note})</span></p>
              <p className="text-[0.88rem] text-ink-soft">{s.weakBody(weak.note || '')}</p>
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="font-ar text-[1.05rem] font-semibold text-green-800">{s.past}{voice === 'passive' ? ' · مجهول' : ''}</h3>
            <Grid cells={showPassive ? result.passivePast! : result.past} />
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-ar text-[1.05rem] font-semibold text-green-800">{s.present}{voice === 'passive' ? ' · مجهول' : ''}</h3>
              {!showPassive && (
                <Seg>
                  <SegButton active={mood === 'marfu'} onClick={() => setMood('marfu')}>{s.marfu}</SegButton>
                  <SegButton active={mood === 'mansub'} onClick={() => setMood('mansub')}>{s.mansub}</SegButton>
                  <SegButton active={mood === 'majzum'} onClick={() => setMood('majzum')}>{s.majzum}</SegButton>
                </Seg>
              )}
            </div>
            <Grid cells={showPassive ? result.passivePresent! : result.present[mood]} />
          </section>

          {!showPassive && (
            <section className="flex flex-col gap-2">
              <h3 className="font-ar text-[1.05rem] font-semibold text-green-800">{s.imperative}</h3>
              <Grid cells={result.imperative} />
            </section>
          )}
          {showPassive && <p className="text-[0.85rem] text-ink-faint font-ar" dir="rtl">{s.noImperativePassive}</p>}

          <section className="flex flex-col gap-2">
            <h3 className="font-ar text-[1.05rem] font-semibold text-green-800">{s.derived}</h3>
            <div dir="rtl" className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" data-testid="av-derived">
              {result.derived.map((d) => (
                <div key={d.key} className="flex flex-col rounded-md border border-[color:var(--line-soft)] bg-[var(--surface)] px-2.5 py-1.5">
                  <span className="text-[0.72rem] text-ink-faint font-ar">{DERIVED_LABEL[d.key]?.ar || d.key}</span>
                  <span className="font-ar text-[1.2rem] text-ink">{d.word || <span className="text-[0.82rem] text-ink-faint">{s.masdarSama}</span>}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-ar text-[1.05rem] font-semibold text-green-800">{s.emphatic}</h3>
            <Grid cells={[...result.emphaticPresent, ...result.emphaticImperative.map((c) => ({ ...c, label: c.label + ' (أمر)' }))]} />
          </section>
        </div>
      )}
    </Stack>
  )
}
