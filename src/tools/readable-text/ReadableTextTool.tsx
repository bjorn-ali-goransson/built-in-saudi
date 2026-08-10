import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Stack, Panel, Field, Check, Seg, SegButton } from '../../components/ui'
import {
  DEFAULTS, MACHINE_SAFE_TRACKING, MEASURE_RANGE, detectScript, measureOk,
  splitEmphasis, trackingFor, type Settings,
} from './readable'

const KEY = 'bis-readable'

const STR = {
  en: {
    intro: 'Paste something hard to read and set it the way you can read it. Nothing is sent anywhere.',
    label: 'Your text', placeholder: 'Paste an article, a chapter, a set of instructions…',
    size: 'Text size', line: 'Line spacing', letter: 'Letter spacing', word: 'Word spacing',
    measure: 'Line length (characters)', theme: 'Background',
    paper: 'Paper', cream: 'Cream', dark: 'Dark',
    ruler: 'Focus the line under the cursor', emphasis: 'Bold the start of each word',
    reset: 'Back to the defaults for this script',
    detected: (s: string) => `Detected: ${s}`, arabic: 'Arabic', latin: 'Latin script',
    trackingOffTitle: 'Letter spacing is switched off for Arabic, on purpose',
    trackingOffBody: 'Every guide to readable text says to increase letter spacing. That is Latin advice. Arabic is cursive — the letters JOIN, and the join is part of the letterform, not a gap between two shapes. Push them apart and the connecting stroke stretches or breaks, so the word stops looking like a word. What helps Arabic instead is vertical room, because the marks sit above and below the line — which is why the line spacing here starts higher for Arabic and nothing else differs.',
    machineTitle: 'If you are formatting something to send, keep tracking under 0.10em',
    machineBody: `Above about ${MACHINE_SAFE_TRACKING}em a PDF text extractor reads the gaps between glyphs as spaces, so EXPERIENCE comes back as E X P E R I E N C E. Measured on this site's own CV export, it cost 168 of 175 section headings across 32 documents before anybody noticed — the page looked fine and the machine reading it did not. Tracking can help a human and hurt a parser at the same setting.`,
    measureTitle: 'Line length does more than size does',
    measureBody: `A line between ${MEASURE_RANGE[0]} and ${MEASURE_RANGE[1]} characters is what typography has settled on: much longer and the eye loses the return sweep to the next line, much shorter and it breaks the sentence into fragments. It is the setting people never touch and the one that helps most.`,
    tooLong: 'Longer than the comfortable range', tooShort: 'Shorter than the comfortable range',
    ok: 'Within the comfortable range',
    related: 'How hard is this text? Readability Scorer',
    empty: 'Paste some text above and it will be set here.',
  },
  ar: {
    intro: 'ألصق نصًّا يصعب عليك قراءته واضبطه كما تستطيع قراءته. ولا يُرسل شيء إلى أي مكان.',
    label: 'نصّك', placeholder: 'ألصق مقالًا أو فصلًا أو تعليمات…',
    size: 'حجم النص', line: 'تباعد الأسطر', letter: 'تباعد الحروف', word: 'تباعد الكلمات',
    measure: 'طول السطر (بالحروف)', theme: 'الخلفية',
    paper: 'ورقي', cream: 'كريمي', dark: 'داكن',
    ruler: 'إبراز السطر تحت المؤشر', emphasis: 'تغميق أول كل كلمة',
    reset: 'العودة إلى الإعدادات الافتراضية لهذا النظام الكتابي',
    detected: (s: string) => `المكتشف: ${s}`, arabic: 'العربية', latin: 'الحرف اللاتيني',
    trackingOffTitle: 'تباعد الحروف مُعطَّل للعربية عن قصد',
    trackingOffBody: 'كل دليل لتيسير القراءة ينصح بزيادة تباعد الحروف. وهذه نصيحة لاتينية. فالعربية متصلة — الحروف تتّصل، والوصلة جزء من شكل الحرف لا فراغ بين شكلين. فإذا باعدت بينها امتدّت الوصلة أو انقطعت، فلم تعد الكلمة تبدو كلمة. والذي يفيد العربية هو المتّسع الرأسي، لأن العلامات فوق السطر وتحته — ولهذا يبدأ تباعد الأسطر هنا أعلى للعربية، ولا يختلف شيء آخر.',
    machineTitle: 'إن كنت تنسّق مستندًا سترسله، أبقِ التباعد دون ٠٫١٠em',
    machineBody: `فوق نحو ${MACHINE_SAFE_TRACKING}em يقرأ مستخرِج نصّ PDF الفراغات بين الحروف مسافاتٍ، فتعود EXPERIENCE هكذا: E X P E R I E N C E. وقياسًا على تصدير السيرة الذاتية في هذا الموقع نفسه، كلّف ذلك ١٦٨ عنوانًا من ١٧٥ عبر ٣٢ مستندًا قبل أن ينتبه أحد — الصفحة تبدو سليمة والآلة التي تقرؤها لا تراها كذلك. فالتباعد قد ينفع إنسانًا ويضرّ محلّلًا عند الضبط نفسه.`,
    measureTitle: 'طول السطر أثره أكبر من أثر الحجم',
    measureBody: `السطر بين ${MEASURE_RANGE[0]} و${MEASURE_RANGE[1]} حرفًا هو ما استقرّت عليه الطباعة: أطول من ذلك فتضيع على العين عودتها إلى أول السطر التالي، وأقصر فتتقطّع الجملة. وهو الإعداد الذي لا يلمسه أحد وأكثرها نفعًا.`,
    tooLong: 'أطول من النطاق المريح', tooShort: 'أقصر من النطاق المريح',
    ok: 'ضمن النطاق المريح',
    related: 'ما مدى صعوبة النص؟ مقياس السهولة',
    empty: 'ألصق نصًّا في الأعلى ليُعرض هنا.',
  },
}

const BG = {
  paper: { background: '#ffffff', color: '#1a1a18' },
  cream: { background: '#f6efe2', color: '#2b2a26' },
  dark: { background: '#16181a', color: '#e6e3dc' },
}

export default function ReadableTextTool() {
  const { locale } = useLocale()
  const s = STR[locale === 'ar' ? 'ar' : 'en']
  const [text, setText] = useState('')
  const script = useMemo(() => detectScript(text), [text])
  const [set, setSet] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return { ...DEFAULTS.latin, ...JSON.parse(raw) } as Settings
    } catch { /* ignore */ }
    return DEFAULTS.latin
  })
  // Personalisation over preferences: the settings ARE the tool, and asking
  // twice is asking too often.
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(set)) } catch { /* ignore */ }
  }, [set])

  const [line, setLine] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)

  const tracking = trackingFor(script, set.letterSpacing)
  const clamped = script === 'arabic' && set.letterSpacing > 0
  const paras = useMemo(() => text.split(/\n{2,}/).filter((p) => p.trim()), [text])

  const upd = (patch: Partial<Settings>) => setSet((v) => ({ ...v, ...patch }))

  return (
    <Stack data-testid="readable-text">
      <p className="text-ink-faint">{s.intro}</p>

      <Field label={s.label}>
        <textarea
          className="w-full min-h-[7rem] p-3 rounded-md border border-line bg-surface text-ink [font:inherit] resize-y"
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder={s.placeholder} data-testid="rt-input" dir="auto"
        />
      </Field>

      <Panel>
        <p className="text-ink-faint text-sm" data-testid="rt-script">
          {s.detected(script === 'arabic' ? s.arabic : s.latin)}
        </p>
        <div className="grid grid-cols-2 max-[560px]:grid-cols-1 gap-3 mt-2">
          <Field label={`${s.size}: ${set.size}px`}>
            <input type="range" min={14} max={40} value={set.size} data-testid="rt-size"
              onChange={(e) => upd({ size: Number(e.target.value) })} className="w-full" />
          </Field>
          <Field label={`${s.line}: ${set.lineHeight.toFixed(1)}`}>
            <input type="range" min={12} max={30} value={set.lineHeight * 10} data-testid="rt-line"
              onChange={(e) => upd({ lineHeight: Number(e.target.value) / 10 })} className="w-full" />
          </Field>
          <Field label={`${s.letter}: ${tracking.toFixed(2)}em`}>
            <input type="range" min={0} max={20} value={set.letterSpacing * 100} data-testid="rt-letter"
              onChange={(e) => upd({ letterSpacing: Number(e.target.value) / 100 })} className="w-full" />
          </Field>
          <Field label={`${s.word}: ${set.wordSpacing.toFixed(2)}em`}>
            <input type="range" min={0} max={60} value={set.wordSpacing * 100} data-testid="rt-word"
              onChange={(e) => upd({ wordSpacing: Number(e.target.value) / 100 })} className="w-full" />
          </Field>
          <Field label={`${s.measure}: ${set.measure}`}>
            <input type="range" min={30} max={100} value={set.measure} data-testid="rt-measure"
              onChange={(e) => upd({ measure: Number(e.target.value) })} className="w-full" />
          </Field>
          <Field label={s.theme}>
            <Seg>
              {(['paper', 'cream', 'dark'] as const).map((k) => (
                <SegButton key={k} active={set.theme === k} data-testid={`rt-theme-${k}`}
                  onClick={() => upd({ theme: k })}>{s[k]}</SegButton>
              ))}
            </Seg>
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          <Check>
            <input type="checkbox" checked={set.ruler} data-testid="rt-ruler"
              onChange={(e) => upd({ ruler: e.target.checked })} />
            {s.ruler}
          </Check>
          <Check>
            <input type="checkbox" checked={set.emphasis} data-testid="rt-emphasis"
              onChange={(e) => upd({ emphasis: e.target.checked })} />
            {s.emphasis}
          </Check>
          <button type="button" data-testid="rt-reset" onClick={() => setSet(DEFAULTS[script])}
            className="text-sm underline bg-transparent border-0 text-ink-faint cursor-pointer p-0">
            {s.reset}
          </button>
        </div>
        <p className="text-ink-faint text-sm mt-2" data-testid="rt-measure-note">
          {measureOk(set.measure) ? s.ok : set.measure > MEASURE_RANGE[1] ? s.tooLong : s.tooShort}
        </p>
      </Panel>

      {clamped ? (
        <Panel>
          <h3 className="font-display text-lg">{s.trackingOffTitle}</h3>
          <p className="text-ink-faint text-sm" data-testid="rt-tracking-off">{s.trackingOffBody}</p>
        </Panel>
      ) : null}

      <div
        ref={boxRef}
        data-testid="rt-output"
        data-tracking={tracking}
        dir={script === 'arabic' ? 'rtl' : 'ltr'}
        onMouseLeave={() => setLine(-1)}
        style={{
          ...BG[set.theme],
          fontSize: `${set.size}px`,
          lineHeight: set.lineHeight,
          letterSpacing: `${tracking}em`,
          wordSpacing: `${set.wordSpacing}em`,
          maxWidth: `${set.measure}ch`,
          padding: '1.4rem',
          borderRadius: 8,
          margin: '0 auto',
        }}
        className={script === 'arabic' ? 'font-ar' : ''}
      >
        {paras.length === 0 ? <p className="opacity-60">{s.empty}</p> : paras.map((p, i) => (
          <p key={i} data-testid="rt-para" onMouseEnter={() => setLine(i)}
            style={{
              marginBottom: '1em',
              opacity: set.ruler && line >= 0 && line !== i ? 0.35 : 1,
              transition: 'opacity 120ms',
            }}>
            {set.emphasis
              ? p.split(/(\s+)/).map((w, j) => {
                if (!w.trim()) return w
                const [head, tail] = splitEmphasis(w)
                return <span key={j}><strong>{head}</strong>{tail}</span>
              })
              : p}
          </p>
        ))}
      </div>

      <Panel>
        <h3 className="font-display text-lg">{s.measureTitle}</h3>
        <p className="text-ink-faint text-sm">{s.measureBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.machineTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="rt-machine">{s.machineBody}</p>
      </Panel>

      <p className="text-sm">
        <a href={localePath(locale, '/apps/readability')}>{s.related}</a>
      </p>
    </Stack>
  )
}
