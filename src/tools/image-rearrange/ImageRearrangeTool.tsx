import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Field, Stack, FileError } from '../../components/ui'
import { UploadIcon, DownloadIcon, ShareIcon, TrashIcon, RefreshIcon } from '../../components/icons'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { setWorkInProgress } from '../../lib/workInProgress'

const STR = {
  en: {
    drop: 'Drop a screenshot or photo, or tap to choose',
    hint: 'Drag on the image to cut out a piece. Then drag the piece to move it, or use its handle to rotate.',
    another: 'Choose another', save: 'Save PNG', share: 'Share', clear: 'Start over',
    remove: 'Remove piece', fill: 'Fill left behind', pieces: 'Pieces',
    rotate: 'Rotate', none: 'Nothing cut out yet — drag a rectangle on the image.',
    privacy: 'Edited on your device — the image is never uploaded.',
    shareFail: 'Sharing isn’t available here — use Save instead.',
  },
  ar: {
    drop: 'أفلت لقطة شاشة أو صورة، أو اضغط للاختيار',
    hint: 'اسحب على الصورة لاقتطاع جزء. ثم اسحب الجزء لتحريكه، أو استخدم المقبض لتدويره.',
    another: 'اختر صورة أخرى', save: 'حفظ PNG', share: 'مشاركة', clear: 'ابدأ من جديد',
    remove: 'احذف الجزء', fill: 'لون الفراغ', pieces: 'الأجزاء',
    rotate: 'تدوير', none: 'لم تقتطع شيئًا بعد — اسحب مستطيلًا على الصورة.',
    privacy: 'يُحرَّر على جهازك — لا تُرفع الصورة أبدًا.',
    shareFail: 'المشاركة غير متاحة هنا — استخدم الحفظ بدلًا منها.',
  },
}

/** A rectangle lifted out of the source image. `x/y` is where it now sits (top-left
 *  of its unrotated box); `sx/sy` is where it came from, which is also the hole. */
interface Piece {
  id: number
  sx: number; sy: number; w: number; h: number
  x: number; y: number
  rot: number // radians
}

const HANDLE = 16 // rotate-handle hit radius, in source pixels (scaled on screen)

export default function ImageRearrangeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [fill, setFill] = useState('#ffffff')
  const [err, setErr] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nextId = useRef(1)
  // What the current pointer gesture is doing. Kept in a ref: it changes every
  // pointermove and must not re-render on its own.
  const drag = useRef<
    | { kind: 'cut'; x0: number; y0: number; x1: number; y1: number }
    | { kind: 'move'; id: number; dx: number; dy: number }
    | { kind: 'rotate'; id: number }
    | null
  >(null)

  // Hold off the deploy auto-reload while an image is open — it can't be restored (#228).
  useEffect(() => {
    setWorkInProgress('image-rearrange', !!bitmap)
    return () => setWorkInProgress('image-rearrange', false)
  }, [bitmap])

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr('')
    const bmp = await decodeImage(f)
    if (!bmp) { setErr(await whyUnreadable(f, locale)); return }
    setBitmap(bmp); setPieces([]); setSelected(null); nextId.current = 1
  }

  /** Draw the composite: source, holes punched where pieces came from, then the
   *  pieces at their current position/rotation. Shared by the canvas and the export
   *  so what you save is exactly what you saw. */
  const paint = useCallback((ctx: CanvasRenderingContext2D, list: Piece[], preview: boolean) => {
    if (!bitmap) return
    ctx.clearRect(0, 0, bitmap.width, bitmap.height)
    ctx.drawImage(bitmap, 0, 0)
    // Holes first, so a piece dropped over its own origin still covers the fill.
    ctx.fillStyle = fill
    for (const p of list) ctx.fillRect(p.sx, p.sy, p.w, p.h)
    for (const p of list) {
      ctx.save()
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2)
      ctx.rotate(p.rot)
      ctx.drawImage(bitmap, p.sx, p.sy, p.w, p.h, -p.w / 2, -p.h / 2, p.w, p.h)
      if (preview && p.id === selected) {
        ctx.strokeStyle = '#127a54'; ctx.lineWidth = Math.max(2, bitmap.width / 400)
        ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h)
        // Rotate handle, above the piece's top edge.
        ctx.beginPath()
        ctx.arc(0, -p.h / 2 - HANDLE * 1.6, HANDLE, 0, Math.PI * 2)
        ctx.fillStyle = '#127a54'; ctx.fill()
      }
      ctx.restore()
    }
    const d = drag.current
    if (preview && d?.kind === 'cut') {
      ctx.strokeStyle = '#127a54'
      ctx.setLineDash([8, 6]); ctx.lineWidth = Math.max(2, bitmap.width / 400)
      ctx.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0))
      ctx.setLineDash([])
    }
  }, [bitmap, fill, selected])

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !bitmap) return
    c.width = bitmap.width; c.height = bitmap.height
    const ctx = c.getContext('2d')
    if (ctx) paint(ctx, pieces, true)
  }, [bitmap, pieces, paint])

  /** Pointer position in source-image pixels. */
  function at(e: React.PointerEvent): { x: number; y: number } {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }

  /** Which piece is under this point (topmost first), accounting for its rotation. */
  function hit(x: number, y: number): { id: number; handle: boolean } | null {
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i]
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2
      // Rotate the point into the piece's own frame.
      const c = Math.cos(-p.rot), sn = Math.sin(-p.rot)
      const lx = (x - cx) * c - (y - cy) * sn
      const ly = (x - cx) * sn + (y - cy) * c
      const hy = -p.h / 2 - HANDLE * 1.6
      if (Math.hypot(lx, ly - hy) <= HANDLE * 1.4) return { id: p.id, handle: true }
      if (Math.abs(lx) <= p.w / 2 && Math.abs(ly) <= p.h / 2) return { id: p.id, handle: false }
    }
    return null
  }

  function down(e: React.PointerEvent) {
    if (!bitmap) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const { x, y } = at(e)
    const h = hit(x, y)
    if (h?.handle) { setSelected(h.id); drag.current = { kind: 'rotate', id: h.id }; return }
    if (h) {
      const p = pieces.find((q) => q.id === h.id)!
      setSelected(h.id)
      drag.current = { kind: 'move', id: h.id, dx: x - p.x, dy: y - p.y }
      return
    }
    setSelected(null)
    drag.current = { kind: 'cut', x0: x, y0: y, x1: x, y1: y }
  }

  function move(e: React.PointerEvent) {
    const d = drag.current
    if (!d || !bitmap) return
    const { x, y } = at(e)
    if (d.kind === 'cut') {
      d.x1 = x; d.y1 = y
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) paint(ctx, pieces, true) // live dashed outline
    } else if (d.kind === 'move') {
      setPieces((ps) => ps.map((p) => (p.id === d.id ? { ...p, x: x - d.dx, y: y - d.dy } : p)))
    } else {
      setPieces((ps) => ps.map((p) => {
        if (p.id !== d.id) return p
        // Angle from the piece's centre to the pointer; the handle sits "up", so
        // offset by a quarter turn to keep the handle under the finger.
        return { ...p, rot: Math.atan2(y - (p.y + p.h / 2), x - (p.x + p.w / 2)) + Math.PI / 2 }
      }))
    }
  }

  function up() {
    const d = drag.current
    drag.current = null
    if (d?.kind !== 'cut') return
    const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1)
    const w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0)
    if (w < 8 || h < 8) { // a tap, not a drag
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) paint(ctx, pieces, true)
      return
    }
    const id = nextId.current++
    setPieces((ps) => [...ps, { id, sx: x, sy: y, w, h, x, y, rot: 0 }])
    setSelected(id)
  }

  /** Render at full source resolution, without the selection chrome. */
  function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!bitmap) return resolve(null)
      const c = document.createElement('canvas')
      c.width = bitmap.width; c.height = bitmap.height
      const ctx = c.getContext('2d')
      if (!ctx) return resolve(null)
      paint(ctx, pieces, false)
      c.toBlob(resolve, 'image/png')
    })
  }

  async function save() {
    const b = await toBlob()
    if (!b) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b); a.download = 'rearranged.png'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  async function share() {
    const b = await toBlob()
    if (!b) return
    const file = new File([b], 'rearranged.png', { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean }
    if (nav.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] } as ShareData); return } catch { return /* cancelled */ }
    }
    setErr(s.shareFail)
  }

  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <Stack data-testid="image-rearrange">
      <FileError message={err} />
      {!bitmap ? (
        <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)]"
          data-testid="rearr-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          {/* No `accept`: an image filter hides Downloads on Android (#225). */}
          <input ref={fileRef} type="file" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <p className="text-[0.85rem] text-ink-faint">{s.hint}</p>
          <canvas ref={canvasRef} data-testid="rearr-canvas"
            className="max-w-full h-auto rounded-md border border-[color:var(--line-soft)] touch-none cursor-crosshair mx-auto"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />

          <div className="flex items-center gap-3 flex-wrap">
            <Field label={s.fill}>
              <input type="color" value={fill} onChange={(e) => setFill(e.target.value)} data-testid="rearr-fill"
                className="w-10 h-9 rounded border border-[color:var(--line)] bg-transparent p-0" />
            </Field>
            <span className="text-[0.85rem] text-ink-faint" data-testid="rearr-count">
              {pieces.length ? `${s.pieces}: ${pieces.length}` : s.none}
            </span>
            <span className="flex-1" />
            {selected != null && (
              <Button onClick={() => { setPieces((ps) => ps.filter((p) => p.id !== selected)); setSelected(null) }} data-testid="rearr-remove">
                <TrashIcon /> {s.remove}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" onClick={save} data-testid="rearr-save"><DownloadIcon /> {s.save}</Button>
            {canShare && <Button onClick={share} data-testid="rearr-share"><ShareIcon /> {s.share}</Button>}
            <Button onClick={() => { setBitmap(null); setPieces([]); setSelected(null) }} data-testid="rearr-reset"><RefreshIcon /> {s.clear}</Button>
          </div>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint">{s.privacy}</p>
    </Stack>
  )
}
