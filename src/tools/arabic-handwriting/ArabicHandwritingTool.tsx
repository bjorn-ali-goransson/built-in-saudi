import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Field, Check, Stack, Panel, Seg, SegButton } from '../../components/ui'
import { DownloadIcon } from '../../components/icons'
import { FORMS, LETTERS, shaped, type Form } from './letters'
import { DEFAULTS, buildSheet, rowGlyphs, type SheetOptions, type Style } from './sheet'

const STR = {
  en: {
    mode: 'Practise', modeLetters: 'Letters', modeText: 'A word or name',
    letters: 'Pick letters', all: 'All 28', none: 'Clear',
    text: 'Word or name', textPh: 'محمد',
    forms: 'All four positional forms',
    formsHelp: 'How a letter looks alone, at the start, in the middle and at the end of a word. This is what makes Arabic handwriting different from tracing 28 isolated shapes — and it is the thing generic worksheet sites get wrong.',
    rows: 'Rows each', traced: 'Faded copies', size: 'Letter size',
    style: 'Guide style', styleTrace: 'Faded', styleOutline: 'Outline', styleDots: 'Dotted',
    guides: 'Ruled guide lines',
    title: 'Title', titlePh: 'كراسة الخط',
    download: 'Download PDF', working: 'Building…',
    preview: 'Preview', rowsCount: (n: number) => `${n} row${n === 1 ? '' : 's'} over ${Math.max(1, Math.ceil(n / 9))} page${Math.ceil(n / 9) === 1 ? '' : 's'}`,
    nothing: 'Pick at least one letter, or type a word.',
    nonJoining: 'ا د ذ ر ز و never join to the letter after them, so they have no initial or middle form — those rows are left out rather than filled with a shape that does not exist.',
    labelTitle: 'كراسة الخط', labelName: 'الاسم', labelDate: 'التاريخ',
    formNames: { isolated: 'Alone', initial: 'Start', medial: 'Middle', final: 'End' } as Record<Form, string>,
  },
  ar: {
    mode: 'التدريب', modeLetters: 'الحروف', modeText: 'كلمة أو اسم',
    letters: 'اختر الحروف', all: 'الـ٢٨ كلها', none: 'مسح',
    text: 'كلمة أو اسم', textPh: 'محمد',
    forms: 'المواضع الأربعة كلها',
    formsHelp: 'شكل الحرف مفردًا، وفي أول الكلمة، ووسطها، وآخرها. وهذا ما يميّز خط العربية عن نسخ ٢٨ شكلًا مفردًا — وهو ما تخطئ فيه مواقع أوراق العمل العامة.',
    rows: 'أسطر لكل شكل', traced: 'نسخ باهتة', size: 'حجم الحرف',
    style: 'نمط الاسترشاد', styleTrace: 'باهت', styleOutline: 'مفرّغ', styleDots: 'منقّط',
    guides: 'أسطر مسطّرة',
    title: 'العنوان', titlePh: 'كراسة الخط',
    download: 'نزّل PDF', working: 'جارٍ التجهيز…',
    preview: 'معاينة', rowsCount: (n: number) => `${n} سطرًا في ${Math.max(1, Math.ceil(n / 9))} صفحة`,
    nothing: 'اختر حرفًا واحدًا على الأقل، أو اكتب كلمة.',
    nonJoining: 'الحروف ا د ذ ر ز و لا تتصل بما بعدها، فلا شكل لها في أول الكلمة ولا وسطها — وتُحذف تلك الأسطر بدل ملئها بشكل لا وجود له.',
    labelTitle: 'كراسة الخط', labelName: 'الاسم', labelDate: 'التاريخ',
    formNames: { isolated: 'مفردة', initial: 'أول', medial: 'وسط', final: 'آخر' } as Record<Form, string>,
  },
}

export default function ArabicHandwritingTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [o, setO] = useState<SheetOptions>(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const set = <K extends keyof SheetOptions>(k: K, v: SheetOptions[K]) => setO((p) => ({ ...p, [k]: v }))
  const toggle = (ch: string) => setO((p) => ({
    ...p,
    letters: p.letters.includes(ch) ? p.letters.filter((x) => x !== ch) : [...p.letters, ch],
  }))

  const rows = useMemo(() => rowGlyphs(o), [o])

  // An on-screen version of one row, drawn with the same canvas text engine the
  // PDF uses — so the preview cannot flatter the print.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !rows.length) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 600
    const h = 90
    canvas.width = w * dpr; canvas.height = h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    const size = 54
    ctx.font = `400 ${size}px "IBM Plex Sans Arabic", sans-serif`
    if (o.guides) {
      ctx.strokeStyle = 'rgba(31,92,61,0.22)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(8, 64); ctx.lineTo(w - 8, 64); ctx.stroke()
      ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(8, 22); ctx.lineTo(w - 8, 22); ctx.stroke()
      ctx.setLineDash([])
    }
    const glyph = rows[0].glyph
    const width = ctx.measureText(glyph).width
    const gap = width * 0.6
    let x = w - 12
    ctx.fillStyle = '#1a1a1a'
    ctx.fillText(glyph, x, 64)
    x -= width + gap
    for (let i = 0; i < o.traced && x - width > 8; i++) {
      if (o.style === 'trace') { ctx.fillStyle = '#c2c2c2'; ctx.fillText(glyph, x, 64) }
      else {
        ctx.strokeStyle = '#c2c2c2'; ctx.lineWidth = 1.2
        ctx.setLineDash(o.style === 'dots' ? [2, 3] : [])
        ctx.strokeText(glyph, x, 64)
        ctx.setLineDash([])
      }
      x -= width + gap
    }
  }, [rows, o.traced, o.style, o.guides])

  async function download() {
    setBusy(true)
    try {
      const blob = await buildSheet(o, { title: s.labelTitle, name: s.labelName, date: s.labelDate })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'arabic-handwriting.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="arabic-handwriting">
      <Panel>
        <Field label={s.mode}>
          <Seg data-testid="ah-mode">
            <SegButton active={o.mode === 'letters'} onClick={() => set('mode', 'letters')} data-testid="ah-mode-letters">{s.modeLetters}</SegButton>
            <SegButton active={o.mode === 'text'} onClick={() => set('mode', 'text')} data-testid="ah-mode-text">{s.modeText}</SegButton>
          </Seg>
        </Field>

        {o.mode === 'letters' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[0.82rem] font-semibold text-ink-soft">{s.letters}</span>
              <Button className="px-2 py-0.5 text-[0.78rem]" data-testid="ah-all"
                onClick={() => set('letters', LETTERS.map((l) => l.ch))}>{s.all}</Button>
              <Button className="px-2 py-0.5 text-[0.78rem]" data-testid="ah-none"
                onClick={() => set('letters', [])}>{s.none}</Button>
            </div>
            <div className="grid grid-cols-7 min-[560px]:grid-cols-14 gap-1" data-testid="ah-letters" dir="rtl">
              {LETTERS.map((l) => (
                <button key={l.ch} data-testid={`ah-letter-${l.ch}`} aria-pressed={o.letters.includes(l.ch)}
                  onClick={() => toggle(l.ch)} title={l.name}
                  className={`font-ar text-[1.5rem] leading-none py-2 rounded-md border ${o.letters.includes(l.ch)
                    ? 'border-green-700 bg-green-600 text-sand-100'
                    : 'border-[color:var(--line)] bg-[var(--surface)] text-ink'}`}>
                  {l.ch}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Field label={s.text}>
            <Input dir="rtl" className="font-ar text-[1.3rem]" value={o.text} placeholder={s.textPh}
              data-testid="ah-text" onChange={(e) => set('text', e.target.value)} />
          </Field>
        )}

        <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
          <Field label={s.rows}>
            <Input type="number" min={1} max={12} value={o.rows} data-testid="ah-rows"
              onChange={(e) => set('rows', Math.min(12, Math.max(1, Number(e.target.value) || 1)))} />
          </Field>
          <Field label={s.traced}>
            <Input type="number" min={0} max={8} value={o.traced} data-testid="ah-traced"
              onChange={(e) => set('traced', Math.min(8, Math.max(0, Number(e.target.value) || 0)))} />
          </Field>
          <Field label={s.size}>
            <Input type="number" min={12} max={40} value={o.size} data-testid="ah-size"
              onChange={(e) => set('size', Math.min(40, Math.max(12, Number(e.target.value) || 12)))} />
          </Field>
          <Field label={s.title}>
            <Input value={o.title} placeholder={s.titlePh} data-testid="ah-title"
              onChange={(e) => set('title', e.target.value)} />
          </Field>
        </div>

        <Field label={s.style}>
          <Seg data-testid="ah-style">
            {(['trace', 'outline', 'dots'] as Style[]).map((k) => (
              <SegButton key={k} active={o.style === k} onClick={() => set('style', k)} data-testid={`ah-style-${k}`}>
                {k === 'trace' ? s.styleTrace : k === 'outline' ? s.styleOutline : s.styleDots}
              </SegButton>
            ))}
          </Seg>
        </Field>

        <div className="flex flex-wrap gap-4">
          {o.mode === 'letters' && (
            <Check><input type="checkbox" checked={o.showForms} data-testid="ah-forms"
              onChange={(e) => set('showForms', e.target.checked)} /> {s.forms}</Check>
          )}
          <Check><input type="checkbox" checked={o.guides} data-testid="ah-guides"
            onChange={(e) => set('guides', e.target.checked)} /> {s.guides}</Check>
        </div>

        {o.mode === 'letters' && o.showForms && (
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.formsHelp}</p>
        )}

        <Button variant="primary" className="self-start" onClick={download} disabled={busy || !rows.length} data-testid="ah-download">
          <DownloadIcon /> {busy ? s.working : s.download}
        </Button>
        {!rows.length && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="ah-nothing">{s.nothing}</p>}
      </Panel>

      {rows.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</h2>
            <span className="text-[0.8rem] text-ink-faint" data-testid="ah-count">{s.rowsCount(rows.length * o.rows)}</span>
          </div>
          <canvas ref={canvasRef} data-testid="ah-preview"
            className="w-full h-[90px] rounded-md border border-[color:var(--line)] bg-white" />
        </section>
      )}

      {/* The four forms of the first selected letter, as a reference strip. */}
      {o.mode === 'letters' && o.letters.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2" dir="rtl" data-testid="ah-form-strip">
            {FORMS.map((form) => {
              const letter = LETTERS.find((l) => l.ch === o.letters[0])!
              const g = shaped(letter, form)
              return (
                <div key={form} data-testid={`ah-form-${form}`}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-md border border-[color:var(--line)] bg-[var(--surface)] ${g ? '' : 'opacity-40'}`}>
                  <span className="font-ar text-[2rem] leading-none text-ink">{g ?? '—'}</span>
                  <span className="text-[0.7rem] text-ink-faint rtl:font-ar">{s.formNames[form]}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.nonJoining}</p>
        </section>
      )}
    </Stack>
  )
}
