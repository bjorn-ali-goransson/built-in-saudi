import { useEffect, useRef } from 'react'

const INK = '#1a53d0' // pen blue

interface Pt { x: number; y: number; t: number }

/** A finger/mouse signature pad with a velocity-tapered blue brush (slower =
 *  thicker, like a real pen). Emits a *trimmed* transparent PNG on each stroke
 *  end, plus its pixel size so the placer can keep the aspect ratio. */
export default function SignaturePad({ onChange, label, clearLabel }: {
  onChange: (sig: { url: string; w: number; h: number } | null) => void
  label: string
  clearLabel: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const pts = useRef<Pt[]>([])
  const inked = useRef(false)

  // Size the canvas to its box at device resolution (crisp lines, correct coords).
  useEffect(() => {
    const cv = canvasRef.current, wrap = wrapRef.current
    if (!cv || !wrap) return
    const fit = () => {
      const r = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      cv.width = Math.round(r.width * dpr)
      cv.height = Math.round(r.height * dpr)
      const ctx = cv.getContext('2d')
      if (ctx) { ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  function pos(e: React.PointerEvent): Pt {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp }
  }

  function down(e: React.PointerEvent) {
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    drawing.current = true
    pts.current = [pos(e)]
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    const arr = pts.current
    const prev = arr[arr.length - 1]
    const dist = Math.hypot(p.x - prev.x, p.y - prev.y)
    const dt = Math.max(1, p.t - prev.t)
    const speed = dist / dt // px/ms
    const width = Math.max(1.1, Math.min(3.4, 3.4 - speed * 2.2))
    // Smooth via a quadratic through the midpoint of the last two points.
    ctx.beginPath()
    ctx.lineWidth = width
    if (arr.length >= 2) {
      const p0 = arr[arr.length - 2]
      const m1 = { x: (p0.x + prev.x) / 2, y: (p0.y + prev.y) / 2 }
      const m2 = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 }
      ctx.moveTo(m1.x, m1.y)
      ctx.quadraticCurveTo(prev.x, prev.y, m2.x, m2.y)
    } else {
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
    arr.push(p)
    inked.current = true
  }

  function up() {
    if (!drawing.current) return
    drawing.current = false
    if (inked.current) onChange(trim(canvasRef.current!))
  }

  function clear() {
    const cv = canvasRef.current!
    cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height)
    inked.current = false
    pts.current = []
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={wrapRef} className="relative h-[42vw] max-h-[240px] min-h-[150px] rounded-md border-2 border-dashed border-[color:var(--line)] bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          data-testid="sign-pad"
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[0.82rem] text-ink-faint select-none">{label}</span>
      </div>
      <button type="button" onClick={clear} data-testid="sign-clear"
        className="self-start text-[0.85rem] text-ink-soft hover:text-green-700 bg-transparent border-0 cursor-pointer underline underline-offset-2">
        {clearLabel}
      </button>
    </div>
  )
}

/** Crop transparent margins so the placed signature hugs the ink. */
function trim(cv: HTMLCanvasElement): { url: string; w: number; h: number } {
  const ctx = cv.getContext('2d')!
  const { width, height } = cv
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width, minY = height, maxX = 0, maxY = 0, found = false
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        found = true
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
  }
  if (!found) return { url: cv.toDataURL('image/png'), w: width, h: height }
  const pad = 6
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad)
  const w = maxX - minX + 1, h = maxY - minY + 1
  const out = document.createElement('canvas')
  out.width = w; out.height = h
  out.getContext('2d')!.drawImage(cv, minX, minY, w, h, 0, 0, w, h)
  return { url: out.toDataURL('image/png'), w, h }
}
