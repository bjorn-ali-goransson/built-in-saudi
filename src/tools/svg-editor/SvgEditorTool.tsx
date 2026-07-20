import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, Button, Check } from '../../components/ui'
import { CopyIcon, DownloadIcon } from '../../components/icons'
import { optimizeSvg } from './svgOptimize'

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <!-- a friendly star -->
  <circle cx="60" cy="60" r="56" fill="#1f7a3f"/>
  <path fill="#f4efe6" d="M60.0000 28.00000 L69.021 50.117 L92.900 51.888 L74.573 67.283 L80.229 90.612 L60 78.000 L39.771 90.612 L45.427 67.283 L27.100 51.888 L50.979 50.117 Z"/>
</svg>`

const STR = {
  en: {
    input: 'SVG markup', drop: 'Paste SVG above, or drop an .svg file',
    preview: 'Preview', optimize: 'Optimise output (SVGOMG-style)', precision: 'Precision',
    copy: 'Copy', copied: 'Copied!', download: 'Download .svg', clear: 'Clear', sample: 'Load sample',
    invalid: 'That doesn’t parse as SVG — the output is left as-is.',
    saved: (b: number, a: number) => `${fmt(b)} → ${fmt(a)}  (−${b > 0 ? Math.max(0, Math.round((1 - a / b) * 100)) : 0}%)`,
    privacy: 'Runs entirely in your browser — nothing is uploaded.',
  },
  ar: {
    input: 'كود SVG', drop: 'الصق SVG أعلاه أو أفلت ملف ‎.svg',
    preview: 'المعاينة', optimize: 'تحسين المخرجات (بأسلوب SVGOMG)', precision: 'الدقة',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'تنزيل ‎.svg', clear: 'مسح', sample: 'تحميل مثال',
    invalid: 'لا يمكن تحليله كـ SVG — تُترك المخرجات كما هي.',
    saved: (b: number, a: number) => `${fmt(b)} ‹ ${fmt(a)}  (−${b > 0 ? Math.max(0, Math.round((1 - a / b) * 100)) : 0}٪)`,
    privacy: 'يعمل بالكامل في متصفحك — لا يُرفع أي شيء.',
  },
}

function fmt(n: number): string { return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB` }

export default function SvgEditorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [src, setSrc] = useState(SAMPLE)
  const [optimize, setOptimize] = useState(true)
  const [decimals, setDecimals] = useState(2)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const result = useMemo(() => optimizeSvg(src, decimals), [src, decimals])
  const output = optimize && result.ok ? result.svg : src.trim()
  const previewSrc = `data:image/svg+xml,${encodeURIComponent(output)}`

  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ }
  }
  function download() {
    const blob = new Blob([output], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'image.svg'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function onFile(f: File | undefined) {
    if (!f) return
    f.text().then((t) => setSrc(t)).catch(() => { /* */ })
  }

  return (
    <Stack data-testid="svg-editor">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-[0.4rem]">
          <span className="text-[0.8rem] font-semibold uppercase tracking-wide text-ink-faint">{s.input}</span>
          <Textarea value={src} onChange={(e) => setSrc(e.target.value)} rows={14} dir="ltr" spellCheck={false}
            className="font-mono text-[0.8rem]" data-testid="svg-input"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="self-start text-[0.78rem] text-ink-faint hover:text-ink underline underline-offset-2 bg-transparent border-0 cursor-pointer">{s.drop}</button>
          <input ref={fileRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>

        <div className="flex flex-col gap-[0.4rem]">
          <span className="text-[0.8rem] font-semibold uppercase tracking-wide text-ink-faint">{s.preview}</span>
          <div className="grid place-items-center min-h-[12rem] rounded-md border border-[color:var(--line-soft)] p-3"
            style={{ backgroundImage: 'conic-gradient(#e6e1d6 25%, #fff 0 50%, #e6e1d6 0 75%, #fff 0)', backgroundSize: '18px 18px' }}>
            {result.ok || !optimize
              ? <img src={previewSrc} alt={s.preview} data-testid="svg-preview" className="max-w-full max-h-[46vh] object-contain" />
              : <p className="text-[0.85rem] text-[var(--danger)] font-medium" data-testid="svg-invalid">{s.invalid}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Check><input type="checkbox" checked={optimize} onChange={(e) => setOptimize(e.target.checked)} data-testid="svg-optimize" /> {s.optimize}</Check>
        <label className="flex items-center gap-2 text-[0.85rem] text-ink-soft">
          {s.precision}
          <input type="range" min={0} max={4} value={decimals} onChange={(e) => setDecimals(Number(e.target.value))} disabled={!optimize} data-testid="svg-precision" className="accent-green-600" />
          <span className="font-mono text-ink-faint w-3">{decimals}</span>
        </label>
        <span className="font-mono text-[0.82rem] text-ink-soft ms-auto" data-testid="svg-size">{s.saved(result.before, optimize && result.ok ? result.after : result.before)}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={copy} data-testid="svg-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
        <Button onClick={download} data-testid="svg-download"><DownloadIcon /> {s.download}</Button>
        <Button onClick={() => setSrc('')} data-testid="svg-clear">{s.clear}</Button>
        <Button onClick={() => setSrc(SAMPLE)} data-testid="svg-sample">{s.sample}</Button>
      </div>

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
