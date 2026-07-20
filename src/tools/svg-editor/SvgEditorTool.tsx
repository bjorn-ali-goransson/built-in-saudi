import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Check } from '../../components/ui'
import { CopyIcon, DownloadIcon } from '../../components/icons'
import { optimizeSvg } from './svgOptimize'
import { useEditor } from './useEditor'
import { Canvas } from './Canvas'
import { Toolbar } from './Toolbar'
import { Inspector } from './Inspector'
import { docToSvg } from './model'
import { parseSvg } from './parse'

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180">
  <rect x="20" y="20" width="200" height="140" rx="10" fill="#f4efe6" stroke="#0f3d20" stroke-width="3"/>
  <circle cx="90" cy="80" r="34" fill="#1f7a3f"/>
  <path d="M150 120 L180 60 L210 120 Z" fill="#c8952a"/>
</svg>`

const STR = {
  en: {
    select: 'Select / move', pan: 'Pan', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', pen: 'Freehand', text: 'Text',
    undo: 'Undo', redo: 'Redo', grid: 'Grid', fit: 'Fit', code: 'Code', canvas: 'Canvas',
    none: 'none', fill: 'Fill', stroke: 'Stroke', width: 'Width', opacity: 'Opacity', textLabel: 'Text', size: 'Size',
    layers: 'Layers', empty: 'Nothing drawn yet.', up: 'Bring forward', down: 'Send backward', del: 'Delete', nothing: 'Select a shape to edit its style, or pick a tool and draw.',
    w: 'W', h: 'H', apply: 'Apply code', optimize: 'Optimise export', precision: 'Precision',
    copy: 'Copy SVG', copied: 'Copied!', download: 'Download', importer: 'Import SVG', clear: 'Clear', sample: 'Sample',
    privacy: 'Runs entirely in your browser — nothing is uploaded.', saved: (b: number, a: number) => `${fmt(b)} → ${fmt(a)} (−${b > 0 ? Math.max(0, Math.round((1 - a / b) * 100)) : 0}%)`,
  },
  ar: {
    select: 'تحديد / تحريك', pan: 'تحريك العرض', rect: 'مستطيل', ellipse: 'شكل بيضوي', line: 'خط', pen: 'رسم حر', text: 'نص',
    undo: 'تراجع', redo: 'إعادة', grid: 'شبكة', fit: 'ملاءمة', code: 'الكود', canvas: 'اللوحة',
    none: 'بلا', fill: 'التعبئة', stroke: 'الحد', width: 'العرض', opacity: 'الشفافية', textLabel: 'النص', size: 'الحجم',
    layers: 'الطبقات', empty: 'لا يوجد رسم بعد.', up: 'إلى الأمام', down: 'إلى الخلف', del: 'حذف', nothing: 'حدّد شكلًا لتعديل نمطه، أو اختر أداة وارسم.',
    w: 'ع', h: 'ط', apply: 'تطبيق الكود', optimize: 'تحسين التصدير', precision: 'الدقة',
    copy: 'نسخ SVG', copied: 'تم النسخ!', download: 'تنزيل', importer: 'استيراد SVG', clear: 'مسح', sample: 'مثال',
    privacy: 'يعمل بالكامل في متصفحك — لا يُرفع أي شيء.', saved: (b: number, a: number) => `${fmt(b)} ‹ ${fmt(a)} (−${b > 0 ? Math.max(0, Math.round((1 - a / b) * 100)) : 0}٪)`,
  },
}

function fmt(n: number): string { return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB` }

const initialDoc = (() => { const p = parseSvg(SAMPLE); return { shapes: p.shapes, width: p.width, height: p.height } })()

export default function SvgEditorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const ed = useEditor(initialDoc)
  const [showGrid, setShowGrid] = useState(true)
  const [codeOpen, setCodeOpen] = useState(false)
  const [codeText, setCodeText] = useState('')
  const [optimize, setOptimize] = useState(true)
  const [decimals, setDecimals] = useState(2)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const raw = useMemo(() => docToSvg(ed.doc.shapes, ed.doc.width, ed.doc.height), [ed.doc])
  const result = useMemo(() => optimizeSvg(raw, decimals), [raw, decimals])
  const output = optimize && result.ok ? result.svg : raw

  function openCode() { setCodeText(output); setCodeOpen(true) }
  function applyCode() { const p = parseSvg(codeText); if (p.ok) { ed.load({ shapes: p.shapes, width: p.width, height: p.height }); setCodeOpen(false) } }
  function fit() { ed.setView({ x: -8, y: -8, w: ed.doc.width + 16, h: ed.doc.height + 16 }) }

  async function copy() { try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }
  function download() {
    const blob = new Blob([output], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'drawing.svg'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function onFile(f: File | undefined) {
    if (!f) return
    f.text().then((txt) => { const p = parseSvg(txt); if (p.ok) ed.load({ shapes: p.shapes, width: p.width, height: p.height }) }).catch(() => { /* */ })
  }

  return (
    <div className="flex flex-col gap-3" data-testid="svg-editor">
      <div className="flex items-center gap-3 flex-wrap">
        <Toolbar ed={ed} t={s} />
        <div className="flex items-center gap-2 ms-auto text-[0.8rem]">
          <label className="flex items-center gap-1.5 text-ink-soft cursor-pointer"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="accent-green-600" data-testid="svg-grid" /> {s.grid}</label>
          <Button onClick={fit} data-testid="svg-fit">{s.fit}</Button>
          <Button variant={codeOpen ? 'primary' : undefined} onClick={() => (codeOpen ? setCodeOpen(false) : openCode())} data-testid="svg-code-toggle">{codeOpen ? s.canvas : s.code}</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
        <div className="relative rounded-md border border-[color:var(--line-soft)] overflow-hidden h-[62vh] min-h-[22rem] bg-[#fbfaf6]"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          {codeOpen ? (
            <div className="absolute inset-0 flex flex-col">
              <textarea value={codeText} onChange={(e) => setCodeText(e.target.value)} spellCheck={false} dir="ltr" data-testid="svg-code" className="flex-1 w-full resize-none font-mono text-[0.78rem] p-3 bg-paper outline-none" />
              <div className="p-2 border-t border-[color:var(--line-soft)] bg-paper"><Button variant="primary" onClick={applyCode} data-testid="svg-code-apply">{s.apply}</Button></div>
            </div>
          ) : (
            <Canvas ed={ed} showGrid={showGrid} />
          )}
        </div>

        <aside className="min-w-0">
          <div className="flex items-center gap-2 mb-3 text-[0.8rem]">
            <span className="text-ink-faint">{s.w}</span>
            <input type="number" value={ed.doc.width} min={1} onChange={(e) => ed.resize(Math.max(1, Number(e.target.value) || 1), ed.doc.height)} data-testid="svg-width" className="w-16 rounded-md border border-[color:var(--line-soft)] px-2 py-1 bg-paper" />
            <span className="text-ink-faint">{s.h}</span>
            <input type="number" value={ed.doc.height} min={1} onChange={(e) => ed.resize(ed.doc.width, Math.max(1, Number(e.target.value) || 1))} data-testid="svg-height" className="w-16 rounded-md border border-[color:var(--line-soft)] px-2 py-1 bg-paper" />
          </div>
          <Inspector ed={ed} t={{ none: s.none, fill: s.fill, stroke: s.stroke, width: s.width, opacity: s.opacity, text: s.textLabel, size: s.size, layers: s.layers, empty: s.empty, up: s.up, down: s.down, del: s.del, nothing: s.nothing }} />
        </aside>
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
        <Button onClick={() => fileRef.current?.click()} data-testid="svg-import">{s.importer}</Button>
        <input ref={fileRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button onClick={() => ed.load({ shapes: [], width: ed.doc.width, height: ed.doc.height })} data-testid="svg-clear">{s.clear}</Button>
        <Button onClick={() => ed.load(initialDoc)} data-testid="svg-sample">{s.sample}</Button>
      </div>

      <p className="text-[0.8rem] text-ink-faint">{s.privacy}</p>
    </div>
  )
}
