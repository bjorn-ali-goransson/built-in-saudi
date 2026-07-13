import { useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Button, FieldLabel } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

const STR = {
  en: { presets: 'Presets', value: 'CSS value', copy: 'Copy', copied: 'Copied!', play: 'Play', privacy: 'Runs in your browser — nothing is uploaded.' },
  ar: { presets: 'قوالب', value: 'قيمة CSS', copy: 'نسخ', copied: 'تم النسخ!', play: 'تشغيل', privacy: 'يعمل في متصفحك — لا يُرفع أي شيء.' },
}

const PRESETS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1], linear: [0, 0, 1, 1],
}

const SZ = 300, PAD = 40, SPAN = SZ - PAD * 2

export default function CubicBezierTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [pts, setPts] = useState<[number, number, number, number]>([0.42, 0, 0.58, 1])
  const [copied, setCopied] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<0 | 1 | null>(null)

  // model (x,y in [0..1], y can exceed) → svg coords (y flipped, top=1)
  const toSvg = (x: number, y: number): [number, number] => [PAD + x * SPAN, PAD + (1 - y) * SPAN]
  const [x1, y1, x2, y2] = pts
  const [c1x, c1y] = toSvg(x1, y1), [c2x, c2y] = toSvg(x2, y2)
  const [ox, oy] = toSvg(0, 0), [ex, ey] = toSvg(1, 1)
  const value = `cubic-bezier(${pts.map((n) => Math.round(n * 100) / 100).join(', ')})`

  function move(e: React.PointerEvent) {
    if (drag.current === null || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left - PAD) / SPAN))
    const y = Math.min(1.6, Math.max(-0.6, 1 - (e.clientY - r.top - PAD) / SPAN))
    setPts((p) => (drag.current === 0 ? [x, y, p[2], p[3]] : [p[0], p[1], x, y]))
  }

  async function copy() { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }

  return (
    <Stack data-testid="cubic-bezier">
      <div>
        <FieldLabel>{s.presets}</FieldLabel>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(PRESETS).map(([name, p]) => (
            <button key={name} type="button" onClick={() => setPts(p)} data-testid={`cb-preset-${name}`}
              className="px-3 py-1 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft text-[0.82rem] font-mono cursor-pointer hover:border-green-500">{name}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-6 items-start">
        <svg ref={svgRef} width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`} className="border border-[color:var(--line)] rounded-md bg-[var(--surface)] touch-none max-w-full"
          onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}>
          <rect x={PAD} y={PAD} width={SPAN} height={SPAN} fill="none" stroke="color-mix(in srgb, var(--ink) 10%, transparent)" />
          <line x1={ox} y1={oy} x2={c1x} y2={c1y} stroke="var(--green-500)" strokeWidth={1.5} />
          <line x1={ex} y1={ey} x2={c2x} y2={c2y} stroke="var(--gold-500)" strokeWidth={1.5} />
          <path d={`M ${ox} ${oy} C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`} fill="none" stroke="var(--ink)" strokeWidth={2.5} />
          <circle cx={c1x} cy={c1y} r={8} fill="var(--green-600)" className="cursor-grab" onPointerDown={(e) => { drag.current = 0; e.currentTarget.setPointerCapture(e.pointerId) }} data-testid="cb-p1" />
          <circle cx={c2x} cy={c2y} r={8} fill="var(--gold-500)" className="cursor-grab" onPointerDown={(e) => { drag.current = 1; e.currentTarget.setPointerCapture(e.pointerId) }} data-testid="cb-p2" />
        </svg>

        <div className="flex flex-col gap-3 min-w-[200px] flex-1">
          <div className="h-2 bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] rounded-full relative overflow-hidden">
            <span key={animKey} className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-green-600"
              style={{ animation: `bis-cb 1.4s ${value} infinite alternate` }} />
          </div>
          <style>{`@keyframes bis-cb{from{left:0}to{left:calc(100% - 1rem)}}`}</style>
          <Button onClick={() => setAnimKey((k) => k + 1)} className="self-start">{s.play}</Button>
        </div>
      </div>

      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.value}</FieldLabel>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-[0.95rem] bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-3 py-2" dir="ltr" data-testid="cb-output">{value}</code>
          <Button onClick={copy} data-testid="cb-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
        </div></label>

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
