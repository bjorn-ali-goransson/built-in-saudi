// A chart drawn from the sheet's computed values, in our own SVG: no chart
// library to ship, nothing to license, and it redraws as the cells change.
import type { ChartSpec } from '../engine/model'
import { niceTicks, valueExtent, PALETTE, fmtTick, type ChartData } from './chartData'

export function ChartSvg({ spec, data, w, h, locale }: { spec: ChartSpec; data: ChartData; w: number; h: number; locale: string }) {
  const title = spec.title ?? data.series[0]?.name ?? ''
  const legend = spec.legend !== false && (data.series.length > 1 || spec.kind === 'pie' || spec.kind === 'doughnut')
  const titleH = title ? 22 : 6
  const legendH = legend ? 20 : 0
  const color = (i: number) => data.series[i]?.color || PALETTE[i % PALETTE.length]
  const empty = !data.series.length || !data.categories.length
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={title || spec.kind} data-testid="chart-svg" data-kind={spec.kind} className="block select-none" style={{ fontFamily: 'var(--font-body)' }}>
      <rect x={0} y={0} width={w} height={h} fill="var(--surface)" />
      {title && <text x={w / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)" data-testid="chart-title">{title}</text>}
      {empty ? <text x={w / 2} y={h / 2} textAnchor="middle" fontSize={12} fill="var(--ink-faint)">—</text>
        : spec.kind === 'pie' || spec.kind === 'doughnut' ? <Pie data={data} x={0} y={titleH} w={w} h={h - titleH - legendH} hole={spec.kind === 'doughnut'} />
        : <Cartesian spec={spec} data={data} x={0} y={titleH} w={w} h={h - titleH - legendH} color={color} locale={locale} />}
      {legend && !empty && (
        <g transform={`translate(0 ${h - legendH + 4})`} data-testid="chart-legend">
          {(spec.kind === 'pie' || spec.kind === 'doughnut' ? data.categories : data.series.map((s) => s.name)).slice(0, 8).map((name, i, arr) => {
            const slot = w / arr.length
            return (
              <g key={i} transform={`translate(${slot * i + 6} 0)`}>
                <rect width={10} height={10} rx={2} fill={spec.kind === 'pie' || spec.kind === 'doughnut' ? PALETTE[i % PALETTE.length] : color(i)} />
                <text x={14} y={9} fontSize={10} fill="var(--ink-soft)">{trunc(name, Math.max(4, Math.floor(slot / 7) - 3))}</text>
              </g>
            )
          })}
        </g>
      )}
    </svg>
  )
}

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

function Cartesian({ spec, data, x, y, w, h, color, locale }: { spec: ChartSpec; data: ChartData; x: number; y: number; w: number; h: number; color: (i: number) => string; locale: string }) {
  const horizontal = spec.kind === 'bar'
  const stacked = !!spec.stacked && (spec.kind === 'bar' || spec.kind === 'column' || spec.kind === 'area')
  const scatter = spec.kind === 'scatter'
  const [lo, hi] = valueExtent(data, stacked)
  const ticks = niceTicks(lo, hi)
  const tlo = ticks[0]
  const thi = ticks[ticks.length - 1]
  const pad = { l: horizontal ? 64 : 44, r: 10, t: 6, b: horizontal ? 18 : 30 }
  const pw = Math.max(10, w - pad.l - pad.r)
  const ph = Math.max(10, h - pad.t - pad.b)
  const val = (v: number) => (v - tlo) / (thi - tlo || 1)
  const n = data.categories.length
  // Value axis position helpers.
  const vy = (v: number) => y + pad.t + ph - val(v) * ph
  const vx = (v: number) => x + pad.l + val(v) * pw
  let xlo = 0
  let xhi = 1
  if (scatter) {
    const xs = data.series.flatMap((s) => s.xs || s.values.map((_, i) => i + 1))
    xlo = Math.min(...xs); xhi = Math.max(...xs)
  }
  const xt = scatter ? niceTicks(xlo, xhi) : []
  const sx = (v: number) => x + pad.l + ((v - (xt[0] ?? 0)) / ((xt[xt.length - 1] ?? 1) - (xt[0] ?? 0) || 1)) * pw
  const band = (horizontal ? ph : pw) / Math.max(1, n)
  const cat = (i: number) => (horizontal ? y + pad.t + band * i : x + pad.l + band * i)
  const zero = Math.max(tlo, Math.min(thi, 0))
  const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((horizontal ? ph : pw) / 48))))

  const bars = () => {
    const out: JSX.Element[] = []
    const groupW = band * 0.74
    const k = stacked ? 1 : data.series.length
    const bw = groupW / k
    const pos = new Array(n).fill(0)
    const neg = new Array(n).fill(0)
    data.series.forEach((s, si) => s.values.forEach((v, i) => {
      let a = 0
      let b = v
      if (stacked) { if (v >= 0) { a = pos[i]; b = pos[i] + v; pos[i] = b } else { a = neg[i]; b = neg[i] + v; neg[i] = b } } else a = zero
      const off = cat(i) + band * 0.13 + (stacked ? 0 : bw * si)
      if (horizontal) {
        const x0 = vx(Math.min(a, b)); const x1 = vx(Math.max(a, b))
        out.push(<rect key={`${si}-${i}`} x={x0} y={off} width={Math.max(0.5, x1 - x0)} height={bw * 0.92} fill={color(si)} data-testid="chart-bar"><title>{`${s.name}: ${v}`}</title></rect>)
      } else {
        const y0 = vy(Math.max(a, b)); const y1 = vy(Math.min(a, b))
        out.push(<rect key={`${si}-${i}`} x={off} y={y0} width={bw * 0.92} height={Math.max(0.5, y1 - y0)} fill={color(si)} data-testid="chart-bar"><title>{`${s.name}: ${v}`}</title></rect>)
      }
    }))
    return out
  }
  const lines = (area: boolean) => {
    const acc = new Array(n).fill(0)
    return data.series.map((s, si) => {
      const pts = s.values.map((v, i) => {
        const base = stacked ? acc[i] : 0
        const top = base + v
        if (stacked) acc[i] = top
        return { x: cat(i) + band / 2, y: vy(top), y0: vy(stacked ? base : zero) }
      })
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('')
      const fill = area ? d + pts.slice().reverse().map((p) => `L${p.x.toFixed(1)},${p.y0.toFixed(1)}`).join('') + 'Z' : ''
      return (
        <g key={si} data-testid="chart-series">
          {area && <path d={fill} fill={color(si)} fillOpacity={0.35} />}
          <path d={d} fill="none" stroke={color(si)} strokeWidth={2} strokeLinejoin="round" />
          {!area && n <= 40 && pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.6} fill={color(si)}><title>{`${s.name}: ${s.values[i]}`}</title></circle>)}
        </g>
      )
    })
  }
  const points = () => data.series.map((s, si) => (
    <g key={si} data-testid="chart-series">
      {s.values.map((v, i) => <circle key={i} cx={sx(s.xs?.[i] ?? i + 1)} cy={vy(v)} r={3.2} fill={color(si)} fillOpacity={0.85}><title>{`(${s.xs?.[i] ?? i + 1}, ${v})`}</title></circle>)}
    </g>
  ))

  return (
    <g>
      {ticks.map((t) => horizontal ? (
        <g key={t}><line x1={vx(t)} x2={vx(t)} y1={y + pad.t} y2={y + pad.t + ph} stroke="var(--line-soft)" /><text x={vx(t)} y={y + pad.t + ph + 12} fontSize={9} textAnchor="middle" fill="var(--ink-faint)">{fmtTick(t, locale)}</text></g>
      ) : (
        <g key={t}><line x1={x + pad.l} x2={x + pad.l + pw} y1={vy(t)} y2={vy(t)} stroke="var(--line-soft)" /><text x={x + pad.l - 5} y={vy(t) + 3} fontSize={9} textAnchor="end" fill="var(--ink-faint)">{fmtTick(t, locale)}</text></g>
      ))}
      {scatter ? xt.map((t) => <text key={t} x={sx(t)} y={y + pad.t + ph + 14} fontSize={9} textAnchor="middle" fill="var(--ink-faint)">{fmtTick(t, locale)}</text>)
        : data.categories.map((c, i) => i % step ? null : horizontal
          ? <text key={i} x={x + pad.l - 5} y={cat(i) + band / 2 + 3} fontSize={9} textAnchor="end" fill="var(--ink-soft)">{trunc(c, 10)}</text>
          : <text key={i} x={cat(i) + band / 2} y={y + pad.t + ph + 14} fontSize={9} textAnchor="middle" fill="var(--ink-soft)">{trunc(c, Math.max(3, Math.floor((band * step) / 6)))}</text>)}
      {horizontal ? <line x1={vx(zero)} x2={vx(zero)} y1={y + pad.t} y2={y + pad.t + ph} stroke="var(--ink-faint)" /> : <line x1={x + pad.l} x2={x + pad.l + pw} y1={vy(zero)} y2={vy(zero)} stroke="var(--ink-faint)" />}
      {spec.kind === 'bar' || spec.kind === 'column' ? bars() : spec.kind === 'line' ? lines(false) : spec.kind === 'area' ? lines(true) : points()}
    </g>
  )
}

function Pie({ data, x, y, w, h, hole }: { data: ChartData; x: number; y: number; w: number; h: number; hole: boolean }) {
  const vals = (data.series[0]?.values || []).map((v) => Math.max(0, v))
  const total = vals.reduce((a, b) => a + b, 0)
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.max(8, Math.min(w, h) / 2 - 8)
  if (!total) return <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" />
  let a = -Math.PI / 2
  return (
    <g data-testid="chart-series">
      {vals.map((v, i) => {
        const frac = v / total
        const b = a + frac * Math.PI * 2
        const large = b - a > Math.PI ? 1 : 0
        const p = (t: number, rr: number) => `${(cx + rr * Math.cos(t)).toFixed(2)},${(cy + rr * Math.sin(t)).toFixed(2)}`
        const d = frac >= 0.9999
          ? `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`
          : `M${cx},${cy}L${p(a, r)}A${r},${r} 0 ${large} 1 ${p(b, r)}Z`
        const mid = (a + b) / 2
        a = b
        return (
          <g key={i}>
            <path d={d} fill={PALETTE[i % PALETTE.length]} stroke="var(--surface)" strokeWidth={1.5} data-testid="chart-slice"><title>{`${data.categories[i]}: ${v}`}</title></path>
            {frac > 0.06 && <text x={cx + r * 0.68 * Math.cos(mid)} y={cy + r * 0.68 * Math.sin(mid) + 3} fontSize={10} textAnchor="middle" fill="#fff" fontWeight={600}>{Math.round(frac * 100)}%</text>}
          </g>
        )
      })}
      {hole && <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--surface)" />}
    </g>
  )
}
