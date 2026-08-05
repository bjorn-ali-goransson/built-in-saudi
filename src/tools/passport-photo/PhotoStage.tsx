import { useEffect, useRef } from 'react'
import type { Spec } from './specs'
import type { Transform } from './render'

/**
 * The interactive preview: the photo at the spec's aspect ratio, draggable, with
 * the head-height and eye-line guides drawn over it. This is an on-DOM
 * interactive canvas, which CLAUDE.md exempts from the worker rule — the export
 * path in render.ts is the one that does real work, and it runs once on click.
 */
export function PhotoStage({
  image, spec, transform, onTransform, guides, whiteBg,
}: {
  image: ImageBitmap
  spec: Spec
  transform: Transform
  onTransform: (t: Transform) => void
  guides: boolean
  whiteBg: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const cssW = canvas.clientWidth
      if (!cssW) return
      const cssH = Math.round(cssW * (spec.hmm / spec.wmm))
      const dpr = window.devicePixelRatio || 1
      canvas.style.height = `${cssH}px`
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      if (whiteBg) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cssW, cssH) }

      // Identical maths to drawPhoto, in CSS pixels — so what you position is
      // exactly what gets exported.
      const cover = Math.max(cssW / image.width, cssH / image.height)
      const scale = cover * transform.zoom
      const dw = image.width * scale
      const dh = image.height * scale
      ctx.drawImage(image, (cssW - dw) / 2 + transform.x * cssW, (cssH - dh) / 2 + transform.y * cssH, dw, dh)

      if (guides) {
        const [minHead, maxHead] = spec.head
        // Head band: crown at the top line, chin at the bottom one. Centred on
        // the eye line, since that is the other fixed reference.
        const eyeY = spec.eyes * cssH
        const headH = ((minHead + maxHead) / 2) * cssH
        const crown = eyeY - headH * 0.42
        const chin = crown + headH

        ctx.strokeStyle = 'rgba(31,92,61,0.85)'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(0, crown); ctx.lineTo(cssW, crown); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, chin); ctx.lineTo(cssW, chin); ctx.stroke()

        ctx.strokeStyle = 'rgba(194,144,58,0.9)'
        ctx.setLineDash([6, 5])
        ctx.beginPath(); ctx.moveTo(0, eyeY); ctx.lineTo(cssW, eyeY); ctx.stroke()
        ctx.setLineDash([])

        // A faint oval where the face should sit reads faster than lines alone.
        ctx.strokeStyle = 'rgba(31,92,61,0.35)'
        ctx.beginPath()
        ctx.ellipse(cssW / 2, (crown + chin) / 2, headH * 0.34, headH / 2, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [image, spec, transform, guides, whiteBg])

  return (
    <canvas
      ref={ref}
      data-testid="pp-stage"
      className="w-full max-w-[22rem] border border-[color:var(--line)] rounded-md touch-none cursor-move"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, ox: transform.x, oy: transform.y }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const rect = e.currentTarget.getBoundingClientRect()
        onTransform({
          ...transform,
          x: drag.current.ox + (e.clientX - drag.current.x) / rect.width,
          y: drag.current.oy + (e.clientY - drag.current.y) / rect.height,
        })
      }}
      onPointerUp={(e) => {
        drag.current = null
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* released */ }
      }}
      onPointerCancel={() => { drag.current = null }}
    />
  )
}
