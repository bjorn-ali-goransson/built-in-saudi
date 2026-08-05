import { useEffect, useRef } from 'react'

// Slice colours from the brand palette rather than a rainbow — the wheel should
// still look like it belongs to the rest of the site.
const COLOURS = ['#1f5c3d', '#c2903a', '#3f8f6d', '#a8722c', '#2b4a3c', '#d8b25e', '#6b8f5a', '#8a5a2b']

export function Wheel({ names, angle }: { names: string[]; angle: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const size = Math.min(canvas.clientWidth, 420)
      if (!size) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.height = `${size}px`
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)

      const cx = size / 2
      const cy = size / 2
      const r = size / 2 - 10

      if (names.length === 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
        return
      }

      const slice = (Math.PI * 2) / names.length
      names.forEach((name, i) => {
        const from = angle + i * slice
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, r, from, from + slice)
        ctx.closePath()
        ctx.fillStyle = COLOURS[i % COLOURS.length]
        ctx.fill()

        // Labels ride the slice; past ~28 names there is no room for text at all,
        // so the wheel stays colour-only rather than printing a smear.
        if (names.length <= 28) {
          ctx.save()
          ctx.translate(cx, cy)
          ctx.rotate(from + slice / 2)
          ctx.fillStyle = '#f6f1e7'
          ctx.font = `${Math.max(10, Math.min(16, r / 9))}px "Hanken Grotesk", system-ui, sans-serif`
          ctx.textAlign = 'right'
          ctx.textBaseline = 'middle'
          const label = name.length > 16 ? `${name.slice(0, 15)}…` : name
          ctx.fillText(label, r - 12, 0)
          ctx.restore()
        }
      })

      // Hub and pointer. The pointer sits at the top (-90°), which is what the
      // spin maths in the tool targets.
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2)
      ctx.fillStyle = '#f6f1e7'; ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2; ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(cx, 2)
      ctx.lineTo(cx - 12, 22)
      ctx.lineTo(cx + 12, 22)
      ctx.closePath()
      ctx.fillStyle = '#22271f'
      ctx.fill()
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [names, angle])

  return <canvas ref={ref} data-testid="sw-wheel" className="w-full max-w-[26rem] aspect-square" />
}
