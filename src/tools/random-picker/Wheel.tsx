import type { RefObject } from 'react'
import { SPIN_TRANSITION } from './useSpinWheel'

const COLORS = ['#1f3d2b', '#2f6b45', '#c8a24b', '#8a6d2b', '#3a7d5d', '#b07a3c', '#4c8a63', '#9a8548']

const RADIUS = 150
const CENTER = 160 // RADIUS + breathing room, so slice strokes aren't clipped at the edge
const SIZE = CENTER * 2
const LABEL_DISTANCE = RADIUS * 0.62 // labels sit roughly two-thirds out from the hub
const TOP = -Math.PI / 2 // SVG's angle 0 points at 3 o'clock; the pointer is at 12

/** Angle of the point `fraction` of a full turn clockwise from the pointer. */
function angleAt(fraction: number): number {
  return fraction * 2 * Math.PI + TOP
}

/** [x, y] on a circle of `radius` around the wheel's centre. */
function pointAt(angle: number, radius: number): [number, number] {
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)]
}

/** Pie-slice path for option `i` of `n`: centre → arc start → arc → back. */
function slicePath(i: number, n: number): string {
  const [x0, y0] = pointAt(angleAt(i / n), RADIUS)
  const [x1, y1] = pointAt(angleAt((i + 1) / n), RADIUS)
  const largeArc = n < 2 ? 1 : 0 // a lone option's slice spans more than half the circle
  return `M ${CENTER} ${CENTER} L ${x0} ${y0} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x1} ${y1} Z`
}

function shorten(label: string): string {
  return label.length > 12 ? label.slice(0, 11) + '…' : label
}

interface WheelProps {
  options: string[]
  /** Accumulated rotation in degrees — only ever grows, so the wheel never rewinds. */
  rot: number
  spinning: boolean
  /** Lets useSpinWheel read the rendered rotation back to time the tick sounds. */
  svgRef: RefObject<SVGSVGElement>
}

export function Wheel({ options, rot, spinning, svgRef }: WheelProps) {
  const n = options.length
  return (
    <div className="relative shrink-0">
      {/* fixed pointer at 12 o'clock; the wheel turns beneath it */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 text-[1.4rem]" aria-hidden="true">▼</div>
      <svg ref={svgRef} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="max-w-[320px] w-full h-auto"
        style={{ transform: `rotate(${rot}deg)`, transition: spinning ? SPIN_TRANSITION : 'none' }}>
        {options.map((label, i) => {
          const mid = angleAt((i + 0.5) / n) // middle of this option's slice
          const [x, y] = pointAt(mid, LABEL_DISTANCE)
          const alongRadius = (mid * 180) / Math.PI + 90 // text reads outward along the slice
          return (
            <g key={i}>
              <path d={slicePath(i, n)} fill={COLORS[i % COLORS.length]} stroke="var(--paper)" strokeWidth={1.5} />
              <text x={x} y={y} transform={`rotate(${alongRadius} ${x} ${y})`} fill="#fff" fontSize={13}
                fontWeight={600} textAnchor="middle" dominantBaseline="middle">
                {shorten(label)}
              </text>
            </g>
          )
        })}
        <circle cx={CENTER} cy={CENTER} r={16} fill="var(--paper)" stroke="var(--line)" />
      </svg>
    </div>
  )
}
