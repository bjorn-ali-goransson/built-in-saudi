import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, CopyIcon } from '../../components/icons'
import { Button, Input, Textarea, Stack, Check, Panel } from '../../components/ui'
import { DEFAULTS, optimise, stillValid, type OptimiseOptions } from './optimise'

const STR = {
  en: {
    pick: 'Choose an SVG', paste: 'or paste the markup here…',
    hint: 'Strip the editor cruft, round the coordinates and squeeze the whitespace out of an SVG — conservatively, so the artwork still renders.',
    invalid: 'That is not valid SVG.',
    options: 'What to remove',
    opts: {
      stripEditor: 'Editor metadata (Inkscape, Illustrator, Figma)',
      comments: 'Comments',
      stripTitles: 'Titles and descriptions',
      minifyWhitespace: 'Whitespace between elements',
      responsive: 'Fixed width and height (keeps the viewBox, so it scales)',
      stripIds: 'Unreferenced ids',
    } as Record<string, string>,
    precision: 'Decimal places',
    precisionHint: 'Two is usually invisible. One is often fine for icons. Zero will visibly distort curves.',
    before: 'Before', after: 'After', saved: 'saved',
    copy: 'Copy', copied: 'Copied!', download: 'Download',
    preview: 'Preview', broke: 'Optimising broke this file, so the original is shown instead. Please report it — that is a bug, not a trade-off.',
    conservative: 'This does not merge paths, convert shapes, or strip ids that anything references. Those win more bytes and break real files silently — a stylesheet hook, a <use> target, a script selector. An optimiser you cannot trust is one you have to check by hand every time.',
    titlesWarn: 'Removing titles and descriptions saves a few bytes and costs screen-reader users the only description of the image.',
  },
  ar: {
    pick: 'اختر ملف SVG', paste: 'أو الصق الترميز هنا…',
    hint: 'أزل بقايا برامج التحرير وقرّب الإحداثيات واعصر المسافات من ملف SVG — بتحفّظ، ليبقى الرسم كما هو.',
    invalid: 'هذا ليس SVG صالحًا.',
    options: 'ما الذي يُزال',
    opts: {
      stripEditor: 'بيانات برامج التحرير (إنكسكيب، إليستريتور، فيغما)',
      comments: 'التعليقات',
      stripTitles: 'العناوين والأوصاف',
      minifyWhitespace: 'المسافات بين العناصر',
      responsive: 'العرض والارتفاع الثابتان (مع إبقاء viewBox ليتمدّد)',
      stripIds: 'المعرّفات غير المستخدمة',
    } as Record<string, string>,
    precision: 'المنازل العشرية',
    precisionHint: 'منزلتان غير محسوستين عادةً. ومنزلة واحدة تكفي للأيقونات غالبًا. أما الصفر فيشوّه المنحنيات بوضوح.',
    before: 'قبل', after: 'بعد', saved: 'وُفِّر',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'تنزيل',
    preview: 'معاينة', broke: 'أفسد التحسينُ هذا الملف، لذا يُعرض الأصل بدلًا منه. أبلغ عن ذلك من فضلك — فهو خلل لا مقايضة.',
    conservative: 'لا تدمج هذه الأداة المسارات ولا تحوّل الأشكال ولا تحذف معرّفًا يشير إليه شيء. فتلك تكسب بايتات أكثر وتُفسد ملفات حقيقية بصمت — خطاف في ورقة أنماط أو هدف <use> أو محدّد في سكربت. والمحسّن الذي لا تثق به هو محسّن تراجعه يدويًا في كل مرة.',
    titlesWarn: 'إزالة العناوين والأوصاف توفّر بضعة بايتات وتحرم مستخدمي قارئات الشاشة من الوصف الوحيد للصورة.',
  },
}

const KEYS: (keyof OptimiseOptions)[] = ['stripEditor', 'comments', 'minifyWhitespace', 'responsive', 'stripIds', 'stripTitles']

export default function SvgOptimiseTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [input, setInput] = useState('')
  const [o, setO] = useState<OptimiseOptions>(DEFAULTS)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const result = useMemo(() => (input.trim() ? optimise(input, o) : null), [input, o])
  const broke = !!result && !result.notes.includes('parse-error') && !stillValid(result.svg)
  const shown = broke ? input : result?.svg ?? ''
  const parseFailed = !!result && (result.notes.includes('parse-error') || result.notes.includes('not-svg'))

  async function pick(f: File | undefined) {
    if (!f) return
    setInput(await f.text())
  }
  async function copy() {
    try { await navigator.clipboard.writeText(shown); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  function download() {
    const blob = new Blob([shown], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'optimised.svg'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const pct = result && result.before ? Math.max(0, Math.round((1 - result.after / result.before) * 100)) : 0

  return (
    <Stack data-testid="svg-optimise">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" className="hidden" data-testid="so-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="so-pick"><UploadIcon /> {s.pick}</Button>
      </div>
      <Textarea className="min-h-[8rem] font-mono text-[0.8rem]" dir="ltr" data-testid="so-input"
        placeholder={s.paste} value={input} onChange={(e) => setInput(e.target.value)} />

      {!input.trim() && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}
      {parseFailed && <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="so-invalid">{s.invalid}</p>}

      <div className="flex flex-col gap-2">
        <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.options}</span>
        <div className="grid gap-x-5 gap-y-2 grid-cols-1 min-[640px]:grid-cols-2">
          {KEYS.map((k) => (
            <Check key={k}>
              <input type="checkbox" checked={o[k] as boolean} data-testid={`so-${k}`}
                onChange={() => setO({ ...o, [k]: !o[k] })} />
              <span className="rtl:font-ar">{s.opts[k]}</span>
            </Check>
          ))}
        </div>
        {o.stripTitles && <p className="text-[0.85rem] text-gold-500 rtl:font-ar">{s.titlesWarn}</p>}
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.precision}
          <Input type="range" min={0} max={4} step={1} className="w-32 p-0" data-testid="so-precision"
            value={o.precision} onChange={(e) => setO({ ...o, precision: +e.target.value })} />
          <span className="font-mono text-ink w-4">{o.precision}</span>
        </label>
        <span className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.precisionHint}</span>
      </div>

      {result && !parseFailed && (
        <>
          {broke && <Panel><p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="so-broke">{s.broke}</p></Panel>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9rem]">
            <span className="text-ink-faint font-mono" data-testid="so-before">{s.before} {(result.before / 1024).toFixed(2)} KB</span>
            <span className="text-ink font-mono font-semibold" data-testid="so-after">{s.after} {(result.after / 1024).toFixed(2)} KB</span>
            <span className={`font-mono ${pct > 0 ? 'text-green-700' : 'text-ink-faint'}`} data-testid="so-saved">−{pct}% {s.saved}</span>
            <Button className="px-3 py-1 ms-auto" onClick={copy} data-testid="so-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <Button variant="primary" className="px-3 py-1" onClick={download} data-testid="so-download"><DownloadIcon /> {s.download}</Button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</span>
            <div className="flex justify-center p-4 bg-white rounded-md border border-[color:var(--line)]">
              {/* Sandboxed, and never injected into this document. An SVG is a
                  script host: someone pastes one they downloaded, and inline
                  script would run on OUR origin — where the 2FA tool keeps
                  secrets in localStorage. srcDoc + sandbox="" gives it a null
                  origin with scripts disabled, so the preview can only draw. */}
              <iframe
                data-testid="so-preview"
                title={s.preview}
                sandbox=""
                className="w-[16rem] h-[16rem] border-0 bg-white"
                srcDoc={`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:grid;place-items:center}svg{max-width:100%;max-height:100%;height:auto}</style>${shown}`}
              />
            </div>
          </div>

          <Textarea readOnly dir="ltr" className="min-h-[8rem] font-mono text-[0.8rem]"
            data-testid="so-output" value={shown} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.conservative}</p></Panel>
    </Stack>
  )
}
