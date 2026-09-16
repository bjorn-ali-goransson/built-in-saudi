import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Field, Stack, FileError } from '../../components/ui'
import { UploadIcon, DownloadIcon, ShareIcon, TrashIcon, RefreshIcon, ImageIcon } from '../../components/icons'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { setWorkInProgress } from '../../lib/workInProgress'

const STR = {
  en: {
    drop: 'Drop a screenshot or photo, or tap to choose',
    hint: 'Drag on the image to cut out a piece, or add another image. Then drag it to move, or use its handles to turn and resize.',
    another: 'Choose another', save: 'Save PNG', share: 'Share', clear: 'Start over',
    remove: 'Remove piece', fill: 'Fill left behind', pieces: 'Pieces',
    add: 'Add an image',
    rotate: 'Rotate', none: 'Nothing on it yet — drag a rectangle to cut a piece, or add an image.',
    privacy: 'Edited on your device — nothing is ever uploaded.',
    shareFail: 'Sharing isn’t available here — use Save instead.',
  },
  ar: {
    drop: 'أفلت لقطة شاشة أو صورة، أو اضغط للاختيار',
    hint: 'اسحب على الصورة لاقتطاع جزء، أو أضِف صورة أخرى. ثم اسحبها لتحريكها، أو استخدم المقابض لتدويرها وتغيير حجمها.',
    another: 'اختر صورة أخرى', save: 'حفظ PNG', share: 'مشاركة', clear: 'ابدأ من جديد',
    remove: 'احذف الجزء', fill: 'لون الفراغ', pieces: 'الأجزاء',
    add: 'أضِف صورة',
    rotate: 'تدوير', none: 'لا شيء عليها بعد — اسحب مستطيلًا لاقتطاع جزء، أو أضِف صورة.',
    privacy: 'يُحرَّر على جهازك — لا يُرفع أي شيء أبدًا.',
    shareFail: 'المشاركة غير متاحة هنا — استخدم الحفظ بدلًا منها.',
  },
}

/**
 * Something sitting on the canvas.
 *
 * Two kinds, and the difference between them is ONE property: a CUT was lifted
 * out of the base picture, so it leaves a hole behind; an ADDED image came from
 * outside and leaves nothing. Everything else — moving, turning, resizing,
 * exporting — is the same code for both, which is why they are one type.
 *
 * `src` + `sx/sy/sw/sh` is where the pixels come from; `x/y/w/h` is where they
 * are drawn. Those were the same numbers while every piece was a 1:1 cut, and
 * separating them is what makes both resizing and placing an image of any size
 * possible at all.
 */
interface Piece {
  id: number
  src: ImageBitmap
  sx: number; sy: number; sw: number; sh: number
  x: number; y: number; w: number; h: number
  rot: number // radians
  /** Punch the hole? True for a cut, false for an added image. */
  cut: boolean
}

const HANDLE = 14 // handle radius, in SCREEN pixels — see `handleR`
const MIN_SIDE = 8 // a piece may not be resized into nothing
/** An added image is fitted to at most this share of the base's longest side. */
const FIT = 0.4

export default function ImageRearrangeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [fill, setFill] = useState('#ffffff')
  const [err, setErr] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nextId = useRef(1)
  // What the current pointer gesture is doing. Kept in a ref: it changes every
  // pointermove and must not re-render on its own.
  const drag = useRef<
    | { kind: 'cut'; x0: number; y0: number; x1: number; y1: number }
    | { kind: 'move'; id: number; dx: number; dy: number }
    | { kind: 'rotate'; id: number }
    | { kind: 'resize'; id: number; w0: number; h0: number; d0: number }
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

  /**
   * Put another picture on top of the open one.
   *
   * It goes through `decodeImage` like the first file does, so a HEIC added to
   * a PNG works — every path that touches the user's bytes has to, not just the
   * one that greets them.
   *
   * It is FITTED on arrival, and that is the decision worth keeping: a phone
   * photo is several times the size of the screenshot it is being dropped onto,
   * so placed at its natural size it covers the picture completely and its
   * handles are off the canvas — the tool looks broken on its commonest input.
   * It is never enlarged, though: a 16px icon blown up to fill the frame is
   * pixels with no detail added, the honesty `print-size` already applies to
   * paper. Growing it is one drag away.
   */
  async function onAdd(f: File | undefined) {
    if (!f || !bitmap) return
    setErr('')
    const bmp = await decodeImage(f)
    if (!bmp) { setErr(await whyUnreadable(f, locale)); return }
    const k = Math.min(1, (Math.max(bitmap.width, bitmap.height) * FIT) / Math.max(bmp.width, bmp.height))
    const w = Math.max(MIN_SIDE, bmp.width * k), h = Math.max(MIN_SIDE, bmp.height * k)
    const id = nextId.current++
    setPieces((ps) => [...ps, {
      id, src: bmp, sx: 0, sy: 0, sw: bmp.width, sh: bmp.height,
      x: (bitmap.width - w) / 2, y: (bitmap.height - h) / 2, w, h, rot: 0, cut: false,
    }])
    setSelected(id)
  }

  /** Draw the composite: source, holes punched where CUT pieces came from, then
   *  every piece at its current position, angle and size. Shared by the canvas
   *  and the export so what you save is exactly what you saw. */
  const paint = useCallback((ctx: CanvasRenderingContext2D, list: Piece[], preview: boolean) => {
    if (!bitmap) return
    ctx.clearRect(0, 0, bitmap.width, bitmap.height)
    ctx.drawImage(bitmap, 0, 0)
    // Holes first, so a piece dropped over its own origin still covers the fill.
    // An ADDED image is skipped: filling a rectangle it happens to sit on would
    // punch a hole in picture the reader never asked to remove.
    ctx.fillStyle = fill
    for (const p of list) if (p.cut) ctx.fillRect(p.sx, p.sy, p.sw, p.sh)
    for (const p of list) {
      ctx.save()
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2)
      ctx.rotate(p.rot)
      ctx.drawImage(p.src, p.sx, p.sy, p.sw, p.sh, -p.w / 2, -p.h / 2, p.w, p.h)
      if (preview && p.id === selected) {
        const hr = handleR()
        ctx.strokeStyle = '#127a54'; ctx.lineWidth = Math.max(2, bitmap.width / 400)
        ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h)
        // Turn handle above the top edge, resize handle on the bottom-right
        // corner — both in the piece's OWN frame, so they travel with it.
        ctx.fillStyle = '#127a54'
        ctx.beginPath()
        ctx.arc(0, -p.h / 2 - hr * 1.6, hr, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(p.w / 2, p.h / 2, hr, 0, Math.PI * 2)
        ctx.fill()
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

  /**
   * The handle radius in SOURCE pixels, so that it is a constant size on screen.
   *
   * It used to be a fixed count of source pixels, which is the same control at
   * two useless extremes: ~4 screen pixels on a phone photo shown at a third of
   * its size — too small to put a finger on — and 40% of the picture on a small
   * screenshot, where it swallows everything under it. Clamped so it can never
   * take more than a sixth of the shorter side whatever the zoom.
   */
  function handleR(): number {
    const c = canvasRef.current
    if (!c || !bitmap) return HANDLE
    const r = c.getBoundingClientRect()
    const scale = r.width > 0 ? c.width / r.width : 1
    return Math.min(HANDLE * scale, Math.min(bitmap.width, bitmap.height) / 6)
  }

  /** Pointer position in source-image pixels. */
  function at(e: React.PointerEvent): { x: number; y: number } {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }

  /**
   * What is under this point (topmost first), accounting for rotation.
   *
   * The handles are only tested on the SELECTED piece, because they are only
   * DRAWN on the selected piece — an invisible control that steals a drag is
   * worse than no control, and there are two of them now.
   */
  function hit(x: number, y: number): { id: number; grab: 'body' | 'rotate' | 'resize' } | null {
    const hr = handleR()
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i]
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2
      // Rotate the point into the piece's own frame.
      const c = Math.cos(-p.rot), sn = Math.sin(-p.rot)
      const lx = (x - cx) * c - (y - cy) * sn
      const ly = (x - cx) * sn + (y - cy) * c
      if (p.id === selected) {
        if (Math.hypot(lx, ly - (-p.h / 2 - hr * 1.6)) <= hr * 1.4) return { id: p.id, grab: 'rotate' }
        if (Math.hypot(lx - p.w / 2, ly - p.h / 2) <= hr * 1.4) return { id: p.id, grab: 'resize' }
      }
      if (Math.abs(lx) <= p.w / 2 && Math.abs(ly) <= p.h / 2) return { id: p.id, grab: 'body' }
    }
    return null
  }

  function down(e: React.PointerEvent) {
    if (!bitmap) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const { x, y } = at(e)
    const h = hit(x, y)
    if (h) {
      const p = pieces.find((q) => q.id === h.id)!
      setSelected(h.id)
      if (h.grab === 'rotate') drag.current = { kind: 'rotate', id: h.id }
      else if (h.grab === 'resize') {
        // Scale about the CENTRE, from how far the pointer is out of it — the
        // same anchor the turn handle orbits, so the piece stays where it is
        // put and only grows.
        const d0 = Math.max(1, Math.hypot(x - (p.x + p.w / 2), y - (p.y + p.h / 2)))
        drag.current = { kind: 'resize', id: h.id, w0: p.w, h0: p.h, d0 }
      } else drag.current = { kind: 'move', id: h.id, dx: x - p.x, dy: y - p.y }
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
    } else if (d.kind === 'resize') {
      setPieces((ps) => ps.map((p) => {
        if (p.id !== d.id) return p
        const k = Math.hypot(x - (p.x + p.w / 2), y - (p.y + p.h / 2)) / d.d0
        // Uniform: the proportions of the picture are not ours to change, and a
        // stretched photo is a different tool.
        const w = Math.max(MIN_SIDE, d.w0 * k), h = Math.max(MIN_SIDE, d.h0 * k)
        return { ...p, x: p.x + (p.w - w) / 2, y: p.y + (p.h - h) / 2, w, h }
      }))
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
    if (w < MIN_SIDE || h < MIN_SIDE) { // a tap, not a drag
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) paint(ctx, pieces, true)
      return
    }
    if (!bitmap) return
    const id = nextId.current++
    setPieces((ps) => [...ps, { id, src: bitmap, sx: x, sy: y, sw: w, sh: h, x, y, w, h, rot: 0, cut: true }])
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
          <input ref={fileRef} type="file" data-testid="rearr-file" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <p className="text-[0.85rem] text-ink-faint">{s.hint}</p>
          <canvas ref={canvasRef} data-testid="rearr-canvas"
            className="max-w-full h-auto rounded-md border border-[color:var(--line-soft)] touch-none cursor-crosshair mx-auto"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={() => addRef.current?.click()} data-testid="rearr-add">
              <ImageIcon /> {s.add}
            </Button>
            {/* Dropping onto the canvas is the crop gesture, so the second image
                comes in through its own control rather than a second dropzone. */}
            <input ref={addRef} type="file" data-testid="rearr-add-file" className="absolute w-px h-px opacity-0"
              onChange={(e) => { onAdd(e.target.files?.[0]); e.target.value = '' }} />
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
