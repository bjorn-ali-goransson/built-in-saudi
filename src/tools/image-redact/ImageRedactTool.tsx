import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, TrashIcon } from '../../components/icons'
import { Button, Stack, Seg, SegButton } from '../../components/ui'

type Rect = { x: number; y: number; w: number; h: number }

const STR = {
  en: { drop: 'Drop an image, or tap to choose', mode: 'Style', blur: 'Pixelate', black: 'Black box', hint: 'Drag boxes over anything to hide. Redactions are baked into the download.', undo: 'Undo last', clear: 'Clear all', download: 'Download', change: 'Choose another image', privacy: 'Redacted on your device — the image is never uploaded.' },
  ar: { drop: 'أفلت صورة أو اضغط للاختيار', mode: 'النمط', blur: 'بكسلة', black: 'مربّع أسود', hint: 'اسحب مربّعات فوق ما تريد إخفاءه. يُدمج التمويه في الملف المنزَّل.', undo: 'تراجع', clear: 'مسح الكل', download: 'تنزيل', change: 'اختر صورة أخرى', privacy: 'يُموّه على جهازك — لا تُرفع الصورة أبدًا.' },
}

export default function ImageRedactTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [rects, setRects] = useState<Rect[]>([])
  const [mode, setMode] = useState<'blur' | 'black'>('blur')
  const drawing = useRef<Rect | null>(null)

  async function onFile(f: File | undefined) {
    if (!f || !f.type.startsWith('image/')) return
    try { setBitmap(await createImageBitmap(f)); setRects([]) } catch { /* */ }
  }

  function applyRect(ctx: CanvasRenderingContext2D, r: Rect) {
    const x = Math.round(Math.min(r.x, r.x + r.w)), y = Math.round(Math.min(r.y, r.y + r.h))
    const w = Math.round(Math.abs(r.w)), h = Math.round(Math.abs(r.h))
    if (w < 2 || h < 2) return
    if (mode === 'black') { ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); return }
    const block = Math.max(6, Math.floor(Math.max(w, h) / 12))
    const tw = Math.max(1, Math.round(w / block)), th = Math.max(1, Math.round(h / block))
    const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th
    const tctx = tmp.getContext('2d')!
    tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, tw, th)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tmp, 0, 0, tw, th, x, y, w, h)
    ctx.imageSmoothingEnabled = true
  }

  function render(preview?: Rect | null) {
    const c = canvasRef.current; if (!c || !bitmap) return
    const ctx = c.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    rects.forEach((r) => applyRect(ctx, r))
    if (preview) applyRect(ctx, preview)
    if (preview) { ctx.strokeStyle = '#c8a24b'; ctx.lineWidth = 2; ctx.strokeRect(preview.x, preview.y, preview.w, preview.h) }
  }

  useEffect(() => { const c = canvasRef.current; if (c && bitmap) { c.width = bitmap.width; c.height = bitmap.height } render() }, [bitmap, rects, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  function toImg(e: React.PointerEvent): Rect {
    const c = canvasRef.current!; const b = c.getBoundingClientRect()
    const sx = c.width / b.width, sy = c.height / b.height
    return { x: (e.clientX - b.left) * sx, y: (e.clientY - b.top) * sy, w: 0, h: 0 }
  }
  function down(e: React.PointerEvent) { (e.target as HTMLElement).setPointerCapture(e.pointerId); drawing.current = toImg(e) }
  function move(e: React.PointerEvent) { if (!drawing.current) return; const p = toImg(e); drawing.current = { ...drawing.current, w: p.x - drawing.current.x, h: p.y - drawing.current.y }; render(drawing.current) }
  function up() { if (drawing.current && Math.abs(drawing.current.w) > 3 && Math.abs(drawing.current.h) > 3) setRects((r) => [...r, drawing.current!]); drawing.current = null }

  function download() {
    const c = canvasRef.current; if (!c) return
    render() // ensure no preview stroke baked
    c.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'redacted.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }, 'image/png')
  }

  return (
    <Stack data-testid="image-redact">
      {!bitmap ? (
        <button className="relative flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)]" data-testid="redact-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" accept="image/*" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Seg><SegButton active={mode === 'blur'} onClick={() => setMode('blur')} data-testid="redact-blur">{s.blur}</SegButton>
              <SegButton active={mode === 'black'} onClick={() => setMode('black')} data-testid="redact-black">{s.black}</SegButton></Seg>
            <Button onClick={() => setRects((r) => r.slice(0, -1))} disabled={!rects.length} data-testid="redact-undo">{s.undo}</Button>
            <Button onClick={() => setRects([])} disabled={!rects.length}><TrashIcon className="w-4 h-4" /> {s.clear}</Button>
          </div>
          <p className="text-[0.82rem] text-ink-faint">{s.hint}</p>
          <canvas ref={canvasRef} className="max-w-full h-auto rounded-md border border-[color:var(--line-soft)] touch-none cursor-crosshair mx-auto" data-testid="redact-canvas"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
          <div className="flex gap-2">
            <Button variant="primary" onClick={download} data-testid="redact-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={() => setBitmap(null)}>{s.change}</Button>
          </div>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
