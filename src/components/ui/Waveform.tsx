import { useEffect, useRef } from 'react'
import { peaks, type Decoded } from '../../lib/audio'

/**
 * A waveform with a draggable selection. Canvas rather than SVG: a few thousand
 * peak bars as DOM nodes is slow to lay out and pointless — nothing here needs
 * to be individually hit-testable, since the drag maths comes from the pointer
 * x position alone.
 */
export function Waveform({
  audio, start, end, playhead, onSelect, className = '',
}: {
  audio: Decoded
  start: number
  end: number
  playhead?: number | null
  onSelect?: (start: number, end: number) => void
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<'start' | 'end' | 'new' | null>(null)
  const anchorRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      const styles = getComputedStyle(canvas)
      const ink = styles.getPropertyValue('--ink-faint').trim() || '#8a8a7a'
      const accent = styles.getPropertyValue('--primary').trim() || '#1f5c3d'

      const bars = peaks(audio, Math.max(1, Math.floor(w)))
      const mid = h / 2
      const dur = audio.duration || 1
      const sx = (start / dur) * w
      const ex = (end / dur) * w

      bars.forEach((p, i) => {
        const inSel = i >= sx && i <= ex
        ctx.fillStyle = inSel ? accent : ink
        ctx.globalAlpha = inSel ? 1 : 0.35
        const top = mid - Math.abs(p.max) * mid
        const bottom = mid + Math.abs(p.min) * mid
        ctx.fillRect(i, top, 1, Math.max(1, bottom - top))
      })
      ctx.globalAlpha = 1

      // Selection edges, so the handles are visible even on a quiet passage.
      ctx.fillStyle = accent
      ctx.fillRect(sx - 1, 0, 2, h)
      ctx.fillRect(ex - 1, 0, 2, h)

      if (playhead != null) {
        ctx.fillStyle = '#c2903a'
        ctx.fillRect((playhead / dur) * w - 1, 0, 2, h)
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [audio, start, end, playhead])

  function timeAt(e: React.PointerEvent): number {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    return ratio * audio.duration
  }

  function onDown(e: React.PointerEvent) {
    if (!onSelect) return
    const t = timeAt(e)
    const grab = audio.duration * 0.02 // ~2% of the width is close enough to a handle
    if (Math.abs(t - start) < grab) dragRef.current = 'start'
    else if (Math.abs(t - end) < grab) dragRef.current = 'end'
    else { dragRef.current = 'new'; anchorRef.current = t; onSelect(t, t) }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onMove(e: React.PointerEvent) {
    if (!onSelect || !dragRef.current) return
    const t = timeAt(e)
    if (dragRef.current === 'start') onSelect(Math.min(t, end), end)
    else if (dragRef.current === 'end') onSelect(start, Math.max(t, start))
    else onSelect(Math.min(anchorRef.current, t), Math.max(anchorRef.current, t))
  }

  function onUp(e: React.PointerEvent) {
    dragRef.current = null
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* already released */ }
  }

  return (
    <canvas
      ref={canvasRef}
      data-testid="waveform"
      className={`w-full h-28 border border-[color:var(--line)] rounded-md bg-[var(--surface)] touch-none ${onSelect ? 'cursor-ew-resize' : ''}${className ? ` ${className}` : ''}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  )
}
