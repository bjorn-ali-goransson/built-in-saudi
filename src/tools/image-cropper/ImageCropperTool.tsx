import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Field, Stack, Seg, SegButton } from '../../components/ui'
import { ImageEncoder } from '../../lib/imageEncoder'

type Fmt = 'image/png' | 'image/jpeg' | 'image/webp'
type Handle = 'nw' | 'ne' | 'sw' | 'se'
interface Rect { x: number; y: number; w: number; h: number }

const STR = {
  en: { drop: 'Drop an image, or tap to choose', another: 'Choose another', ratio: 'Aspect', free: 'Free', format: 'Format', quality: 'Quality', output: 'Output', download: 'Download crop', privacy: 'Cropped on your device — the image is never uploaded.' },
  ar: { drop: 'أفلت صورة أو اضغط للاختيار', another: 'اختر صورة أخرى', ratio: 'النسبة', free: 'حر', format: 'الصيغة', quality: 'الجودة', output: 'الناتج', download: 'تنزيل الاقتصاص', privacy: 'يُقتصّ على جهازك — لا تُرفع الصورة أبدًا.' },
}
const LABEL: Record<Fmt, string> = { 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/webp': 'WebP' }
const EXT: Record<Fmt, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const MAXW = 520
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export default function ImageCropperTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<{ name: string; url: string; dw: number; dh: number; scale: number } | null>(null)
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 })
  const [ratio, setRatio] = useState<number | null>(null)
  const [format, setFormat] = useState<Fmt>('image/png')
  const [quality, setQuality] = useState(0.92)
  const [out, setOut] = useState<{ url: string; size: number; w: number; h: number } | null>(null)
  const drag = useRef<{ mode: 'move' | Handle; sx: number; sy: number; start: Rect } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const encRef = useRef<ImageEncoder | null>(null)

  useEffect(() => () => encRef.current?.dispose(), [])

  async function onFile(f: File | undefined) {
    if (!f || !f.type.startsWith('image/')) return
    encRef.current ??= new ImageEncoder()
    const dim = await encRef.current.load(f)
    if (!dim) return
    const scale = Math.min(1, MAXW / dim.width)
    const dw = Math.round(dim.width * scale), dh = Math.round(dim.height * scale)
    setSrc({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f), dw, dh, scale })
    const w = Math.round(dw * 0.7), h = Math.round(dh * 0.7)
    setRect({ x: Math.round((dw - w) / 2), y: Math.round((dh - h) / 2), w, h })
    setRatio(null)
  }

  // Apply an aspect ratio to a rect (adjust height from width), clamped to bounds.
  function withRatio(r: Rect, dw: number, dh: number, rat: number | null): Rect {
    if (!rat) return r
    let w = r.w, h = w / rat
    if (h > dh) { h = dh; w = h * rat }
    w = Math.min(w, dw)
    return { x: clamp(r.x, 0, dw - w), y: clamp(r.y, 0, dh - h), w, h }
  }

  function pickRatio(rat: number | null) {
    setRatio(rat)
    if (src) setRect((r) => withRatio(r, src.dw, src.dh, rat))
  }

  function onMove(e: React.PointerEvent) {
    if (!drag.current || !src) return
    const { mode, sx, sy, start } = drag.current
    if (mode === 'move') {
      const dx = e.clientX - sx, dy = e.clientY - sy
      setRect({ ...start, x: clamp(start.x + dx, 0, src.dw - start.w), y: clamp(start.y + dy, 0, src.dh - start.h) })
      return
    }
    // resize: the corner opposite the grabbed handle stays fixed
    const b = wrapRef.current!.getBoundingClientRect()
    const lx = clamp(e.clientX - b.left, 0, src.dw), ly = clamp(e.clientY - b.top, 0, src.dh)
    const movingLeft = mode === 'nw' || mode === 'sw', movingTop = mode === 'nw' || mode === 'ne'
    const anchorX = movingLeft ? start.x + start.w : start.x
    const anchorY = movingTop ? start.y + start.h : start.y
    let nw = Math.max(20, Math.abs(lx - anchorX)), nh = Math.max(20, Math.abs(ly - anchorY))
    if (ratio) {
      nh = nw / ratio
      const maxH = movingTop ? anchorY : src.dh - anchorY
      if (nh > maxH) { nh = maxH; nw = nh * ratio }
      const maxW = movingLeft ? anchorX : src.dw - anchorX
      if (nw > maxW) { nw = maxW; nh = nw / ratio }
    }
    const nx = movingLeft ? anchorX - nw : anchorX
    const ny = movingTop ? anchorY - nh : anchorY
    setRect({ x: clamp(nx, 0, src.dw - nw), y: clamp(ny, 0, src.dh - nh), w: nw, h: nh })
  }
  function endDrag() { drag.current = null }

  // Render the cropped region at full resolution whenever the rect/format changes.
  // The encode runs in a worker (#154) — dragging the crop box used to re-encode a
  // full-res crop on the main thread on every pointer move. The cancel guard
  // ensures a late result from a prior state can't overwrite the latest.
  useEffect(() => {
    if (!src || rect.w < 1) return
    let cancelled = false
    const sx = Math.round(rect.x / src.scale), sy = Math.round(rect.y / src.scale)
    const sw = Math.max(1, Math.round(rect.w / src.scale)), sh = Math.max(1, Math.round(rect.h / src.scale))
    encRef.current!.encode({ crop: { sx, sy, sw, sh }, format, quality: format === 'image/png' ? undefined : quality, bg: format === 'image/jpeg' ? '#fff' : undefined }).then((blob) => {
      if (cancelled || !blob) return
      setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size, w: sw, h: sh } })
    })
    return () => { cancelled = true }
  }, [rect, format, quality, src])

  const HANDLES: Handle[] = ['nw', 'ne', 'sw', 'se']
  const hpos: Record<Handle, string> = { nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize', ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize', sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize', se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize' }

  return (
    <Stack data-testid="image-cropper">
      {!src ? (
        <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] [&_small]:text-[color:var(--ink-faint)] [&_small]:text-[0.82rem]" data-testid="crop-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" accept="image/*" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <Field label={s.ratio}>
              <Seg role="group">
                {([[null, s.free], [1, '1:1'], [4 / 3, '4:3'], [16 / 9, '16:9']] as [number | null, string][]).map(([rat, l]) => (
                  <SegButton key={l} active={ratio === rat} data-testid={`crop-ratio-${l}`} onClick={() => pickRatio(rat)}>{l}</SegButton>
                ))}
              </Seg>
            </Field>
            <Field label={s.format}>
              <Seg role="group">
                {(['image/png', 'image/jpeg', 'image/webp'] as Fmt[]).map((f) => (
                  <SegButton key={f} active={format === f} data-testid={`crop-fmt-${LABEL[f]}`} onClick={() => setFormat(f)}>{LABEL[f]}</SegButton>
                ))}
              </Seg>
            </Field>
          </div>

          <div ref={wrapRef} className="relative touch-none select-none inline-block bg-sand-100 rounded-md overflow-hidden" style={{ width: src.dw, height: src.dh }}
            onPointerMove={onMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
            <img src={src.url} width={src.dw} height={src.dh} draggable={false} alt="" className="block" />
            <div className="absolute border-2 border-white cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" data-testid="crop-box"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              onPointerDown={(e) => { e.preventDefault(); drag.current = { mode: 'move', sx: e.clientX, sy: e.clientY, start: rect } }}>
              {HANDLES.map((h) => (
                <span key={h} className={`absolute w-3 h-3 bg-white border border-[color:var(--green-600)] rounded-sm ${hpos[h]}`}
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); drag.current = { mode: h, sx: e.clientX, sy: e.clientY, start: rect } }} />
              ))}
            </div>
          </div>

          {out && (
            <div className="flex items-center gap-4 border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-4" data-testid="crop-result">
              <img src={out.url} alt="" className="w-24 h-24 object-contain rounded bg-sand-100 flex-none" />
              <div className="flex flex-col gap-1">
                <span className="text-ink font-semibold">{s.output}: <span className="font-mono">{out.w}×{out.h}</span> px</span>
                <span className="text-ink-soft text-[0.9rem] font-mono">{out.size < 1048576 ? `${(out.size / 1024).toFixed(1)} KB` : `${(out.size / 1048576).toFixed(2)} MB`}</span>
              </div>
            </div>
          )}

          {format !== 'image/png' && (
            <Field label={`${s.quality} · ${Math.round(quality * 100)}%`} className="max-w-xs">
              <input type="range" min={0.1} max={1} step={0.02} value={quality} onChange={(e) => setQuality(+e.target.value)} /></Field>
          )}

          <div className="flex gap-2">
            <Button variant="primary" href={out?.url ?? ''} download={`${src.name}-crop.${EXT[format]}`} data-testid="crop-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={() => { setSrc(null); setOut(null) }}>{s.another}</Button>
          </div>
        </>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
