import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { DownloadIcon, RefreshIcon } from '../../components/icons'
import { Button, Input, Field, Check, Stack, Panel, Seg, SegButton } from '../../components/ui'
import { newSeed, toArabicDigits } from '../../lib/printPdf'
import { DEFAULTS, OPS, buildWorksheet, format, generate, type Op, type WorksheetOptions } from './worksheet'

const STR = {
  en: {
    ops: 'Operations',
    opName: { add: 'Addition', sub: 'Subtraction', mul: 'Multiplication', div: 'Division' } as Record<Op, string>,
    range: 'Number range', to: 'to',
    count: 'Questions', columns: 'Columns',
    noNegative: 'No negative answers',
    arabicDigits: 'Arabic-Indic numerals (٠١٢٣)',
    withKey: 'Include an answer key page',
    title: 'Title', titlePlaceholder: 'Maths practice',
    seed: 'Sheet code',
    seedWhy: 'The same code always makes the same sheet — so a reprint after a paper jam still matches the answer key you are holding. Change it for a fresh set.',
    regenerate: 'New sheet',
    download: 'Download PDF', working: 'Building…',
    preview: 'Preview',
    key: 'Answer key',
    showKey: 'Show answers',
    labelTitle: 'Maths practice', labelName: 'Name', labelDate: 'Date',
    of: (a: number, b: number) => `Page ${a} of ${b}`,
    noOps: 'Pick at least one operation.',
    divNote: 'Division problems are built from the answer, so every one divides exactly — a random pair of numbers almost never does.',
  },
  ar: {
    ops: 'العمليات',
    opName: { add: 'الجمع', sub: 'الطرح', mul: 'الضرب', div: 'القسمة' } as Record<Op, string>,
    range: 'مدى الأعداد', to: 'إلى',
    count: 'عدد الأسئلة', columns: 'الأعمدة',
    noNegative: 'بلا نواتج سالبة',
    arabicDigits: 'أرقام هندية (٠١٢٣)',
    withKey: 'أضف صفحة الإجابات',
    title: 'العنوان', titlePlaceholder: 'تمارين رياضيات',
    seed: 'رمز الورقة',
    seedWhy: 'الرمز نفسه ينتج الورقة نفسها دائمًا — فإعادة الطباعة بعد انحشار الورق تبقى مطابقة لورقة الإجابات التي بيدك. غيّره لمجموعة جديدة.',
    regenerate: 'ورقة جديدة',
    download: 'نزّل PDF', working: 'جارٍ التجهيز…',
    preview: 'معاينة',
    key: 'الإجابات',
    showKey: 'أظهر الإجابات',
    labelTitle: 'تمارين رياضيات', labelName: 'الاسم', labelDate: 'التاريخ',
    of: (a: number, b: number) => `صفحة ${toArabicDigits(a)} من ${toArabicDigits(b)}`,
    noOps: 'اختر عملية واحدة على الأقل.',
    divNote: 'تُبنى مسائل القسمة من الناتج، فكل قسمة تنتهي بعدد صحيح — والزوج العشوائي من الأعداد لا يفعل ذلك تقريبًا أبدًا.',
  },
}

export default function WorksheetsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [o, setO] = useState<WorksheetOptions>({ ...DEFAULTS, seed: 'ABC123' })
  const [withKey, setWithKey] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof WorksheetOptions>(k: K, v: WorksheetOptions[K]) => setO((p) => ({ ...p, [k]: v }))
  const toggleOp = (op: Op) => setO((p) => ({
    ...p,
    ops: p.ops.includes(op) ? p.ops.filter((x) => x !== op) : [...p.ops, op],
  }))

  const problems = useMemo(() => (o.ops.length ? generate(o) : []), [o])
  const n = (x: number) => (o.arabicDigits ? toArabicDigits(x) : String(x))

  async function download() {
    setBusy(true)
    try {
      const blob = await buildWorksheet(problems, o, {
        title: s.labelTitle, name: s.labelName, date: s.labelDate, key: s.key, of: s.of,
      }, withKey)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `worksheet-${o.seed}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="worksheets">
      <Panel>
        <div className="flex flex-col gap-2">
          <span className="text-[0.82rem] font-semibold text-ink-soft">{s.ops}</span>
          <div className="flex flex-wrap gap-2">
            {OPS.map((op) => (
              <button key={op} data-testid={`ws-op-${op}`} aria-pressed={o.ops.includes(op)}
                onClick={() => toggleOp(op)}
                className={`px-3 py-1.5 rounded-md border text-[0.9rem] font-semibold ${o.ops.includes(op)
                  ? 'border-green-700 bg-green-600 text-sand-100'
                  : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft'}`}>
                {s.opName[op]}
              </button>
            ))}
          </div>
          {!o.ops.length && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="ws-no-ops">{s.noOps}</p>}
        </div>

        <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
          <Field label={s.range}>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} max={999} value={o.min} data-testid="ws-min"
                onChange={(e) => set('min', Math.max(0, Number(e.target.value) || 0))} />
              <span className="text-ink-faint text-[0.8rem]">{s.to}</span>
              <Input type="number" min={1} max={999} value={o.max} data-testid="ws-max"
                onChange={(e) => set('max', Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </Field>
          <Field label={s.count}>
            <Input type="number" min={4} max={120} value={o.count} data-testid="ws-count"
              onChange={(e) => set('count', Math.min(120, Math.max(4, Number(e.target.value) || 4)))} />
          </Field>
          <Field label={s.columns}>
            <Seg data-testid="ws-columns">
              {[2, 3, 4].map((c) => (
                <SegButton key={c} active={o.columns === c} onClick={() => set('columns', c)} data-testid={`ws-col-${c}`}>
                  {n(c)}
                </SegButton>
              ))}
            </Seg>
          </Field>
          <Field label={s.title}>
            <Input value={o.title} placeholder={s.titlePlaceholder} data-testid="ws-title"
              onChange={(e) => set('title', e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4">
          <Check><input type="checkbox" checked={o.noNegative} data-testid="ws-no-negative"
            onChange={(e) => set('noNegative', e.target.checked)} /> {s.noNegative}</Check>
          <Check><input type="checkbox" checked={o.arabicDigits} data-testid="ws-arabic-digits"
            onChange={(e) => set('arabicDigits', e.target.checked)} /> {s.arabicDigits}</Check>
          <Check><input type="checkbox" checked={withKey} data-testid="ws-with-key"
            onChange={(e) => setWithKey(e.target.checked)} /> {s.withKey}</Check>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Field label={s.seed} className="w-[9rem]">
            <Input value={o.seed} data-testid="ws-seed" className="font-mono"
              onChange={(e) => set('seed', e.target.value.toUpperCase())} />
          </Field>
          <Button onClick={() => set('seed', newSeed())} data-testid="ws-regenerate"><RefreshIcon /> {s.regenerate}</Button>
          <Button variant="primary" onClick={download} disabled={busy || !problems.length} data-testid="ws-download">
            <DownloadIcon /> {busy ? s.working : s.download}
          </Button>
        </div>
        <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.seedWhy}</p>
      </Panel>

      {problems.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</h2>
            <Check><input type="checkbox" checked={showKey} data-testid="ws-show-key"
              onChange={(e) => setShowKey(e.target.checked)} /> {s.showKey}</Check>
          </div>
          <div className="grid gap-x-6 gap-y-2 grid-cols-2 min-[620px]:grid-cols-3 border border-[color:var(--line)] rounded-lg bg-[var(--surface)] p-4"
            data-testid="ws-problems">
            {problems.map((p, i) => (
              <div key={i} data-testid={`ws-problem-${i}`} className="flex items-baseline gap-2 text-[1.05rem]" dir="ltr">
                <span className="text-[0.7rem] text-ink-faint w-6 shrink-0 text-end">{n(i + 1)}.</span>
                <span className="text-ink">{format(p, o.arabicDigits)}</span>
                <span className={showKey ? 'text-green-700 font-semibold' : 'text-transparent select-none'}
                  data-testid={`ws-answer-${i}`}>{n(p.answer)}</span>
              </div>
            ))}
          </div>
          {o.ops.includes('div') && <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ws-div-note">{s.divNote}</p>}
        </section>
      )}
    </Stack>
  )
}
