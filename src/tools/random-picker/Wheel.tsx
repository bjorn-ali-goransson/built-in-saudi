import type { RefObject } from 'react'
import { SPIN_TRANSITION } from './useSpinWheel'

const COLORS = ['#1f3d2b', '#2f6b45', '#c8a24b', '#8a6d2b', '#3a7d5d', '#b07a3c', '#4c8a63', '#9a8548']
const R = 150, C = 160

function slice(i: number, n: number): string {
  const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
  const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${C} ${C} L ${C + R * Math.cos(a0)} ${C + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${C + R * Math.cos(a1)} ${C + R * Math.sin(a1)} Z`
}

interface WheelProps {
  options: string[]
  rot: number
  spinning: boolean
  svgRef: RefObject<SVGSVGElement>
  /** Called when the spin's transform transition finishes. */
  onSettled: () => void
}

export function Wheel({ options, rot, spinning, svgRef, onSettled }: WheelProps) {
  const n = options.length
  return (
    <div className="relative shrink-0">
      <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 text-[1.4rem]" aria-hidden="true">▼</div>
      <svg ref={svgRef} width={C * 2} height={C * 2} viewBox={`0 0 ${C * 2} ${C * 2}`} className="max-w-[320px] w-full h-auto"
        onTransitionEnd={(e) => { if (e.propertyName === 'transform') onSettled() }}
        style={{ transform: `rotate(${rot}deg)`, transition: spinning ? SPIN_TRANSITION : 'none' }}>
        {options.map((opt, i) => {
          const mid = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2
          const tx = C + R * 0.62 * Math.cos(mid), ty = C + R * 0.62 * Math.sin(mid)
          return (
            <g key={i}>
              <path d={slice(i, n)} fill={COLORS[i % COLORS.length]} stroke="var(--paper)" strokeWidth={1.5} />
              <text x={tx} y={ty} fill="#fff" fontSize={13} fontWeight={600}
                textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(mid * 180) / Math.PI + 90} ${tx} ${ty})`}>
                {opt.length > 12 ? opt.slice(0, 11) + '…' : opt}
              </text>
            </g>
          )
        })}
        <circle cx={C} cy={C} r={16} fill="var(--paper)" stroke="var(--line)" />
      </svg>
    </div>
  )
}
