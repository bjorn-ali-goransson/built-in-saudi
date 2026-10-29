// Turning a chart's references into numbers to draw. Pure, so it is tested
// without a DOM; the SVG lives in Chart.tsx.
import { isError, parseRange, colToLetters, type ChartSpec, type CellValue } from '../engine/model'

export interface ChartSeries { name: string; values: number[]; color?: string; xs?: number[] }
export interface ChartData { categories: string[]; series: ChartSeries[] }

export type ValueAt = (sheet: string, r: number, c: number) => CellValue

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const text = (v: unknown) => (v == null || isError(v) ? '' : String(v))

/** `Sheet 2!$B$2:$B$9` → sheet + box. A bare range is on `home`. */
export function splitRef(ref: string, home: string): { sheet: string; box: { r0: number; c0: number; r1: number; c1: number } } | null {
  let r = ref.trim().replace(/^=/, '')
  let sheet = home
  const bang = r.lastIndexOf('!')
  if (bang >= 0) {
    sheet = r.slice(0, bang).replace(/^'(.*)'$/, '$1').replace(/''/g, "'")
    r = r.slice(bang + 1)
  }
  const box = parseRange(r.replace(/\$/g, ''))
  return box ? { sheet, box } : null
}

function cellsOf(ref: string, home: string, value: ValueAt): CellValue[] {
  const s = splitRef(ref, home)
  if (!s) return []
  const out: CellValue[] = []
  const { r0, c0, r1, c1 } = s.box
  // Cap a runaway range (a whole column) at something drawable.
  for (let r = r0; r <= Math.min(r1, r0 + 4999); r++) for (let c = c0; c <= Math.min(c1, c0 + 4999); c++) out.push(value(s.sheet, r, c))
  return out
}

export function readChart(spec: ChartSpec, sheet: string, value: ValueAt): ChartData {
  if (spec.series?.length) {
    const series: ChartSeries[] = spec.series.map((s, i) => {
      const vals = cellsOf(s.val, sheet, value)
      return {
        name: s.name || `Series ${i + 1}`,
        values: vals.map((v) => (isNum(v) ? v : 0)),
        color: s.color,
        xs: spec.kind === 'scatter' && s.cat ? cellsOf(s.cat, sheet, value).map((v) => (isNum(v) ? v : 0)) : undefined,
      }
    })
    const first = spec.series.find((s) => s.cat)
    const n = Math.max(0, ...series.map((s) => s.values.length))
    const cats = first?.cat ? cellsOf(first.cat, sheet, value).map(text) : []
    return { categories: Array.from({ length: n }, (_, i) => cats[i] || String(i + 1)), series }
  }
  const box = parseRange(spec.range)
  if (!box) return { categories: [], series: [] }
  const { r0, c0, r1, c1 } = box
  const v = (r: number, c: number) => value(sheet, r, c)
  const labelCol = c1 > c0
  const vc0 = labelCol ? c0 + 1 : c0
  let header = r1 > r0
  let sawText = false
  for (let c = vc0; c <= c1; c++) { const x = v(r0, c); if (isNum(x)) header = false; else if (text(x)) sawText = true }
  header = header && sawText
  const d0 = header ? r0 + 1 : r0
  const categories: string[] = []
  for (let r = d0; r <= r1; r++) categories.push(labelCol ? text(v(r, c0)) || String(r - d0 + 1) : String(r - d0 + 1))
  const series: ChartSeries[] = []
  for (let c = vc0; c <= c1; c++) {
    const values: number[] = []
    for (let r = d0; r <= r1; r++) { const x = v(r, c); values.push(isNum(x) ? x : 0) }
    series.push({ name: header ? text(v(r0, c)) || colToLetters(c) : `Series ${c - vc0 + 1}`, values })
  }
  if (spec.kind === 'scatter' && labelCol) {
    const xs: number[] = []
    for (let r = d0; r <= r1; r++) { const x = v(r, c0); xs.push(isNum(x) ? x : r - d0 + 1) }
    for (const s of series) s.xs = xs
  }
  return { categories, series }
}

/** Round axis ticks covering [lo, hi], about `n` of them, including zero when the range spans it. */
export function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1]
  if (lo === hi) { if (lo === 0) return [0, 1]; lo = Math.min(0, lo); hi = Math.max(0, hi) }
  const span = hi - lo
  const raw = span / Math.max(1, n)
  const pow = 10 ** Math.floor(Math.log10(raw))
  const m = raw / pow
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * pow
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  const out: number[] = []
  for (let t = start; t <= end + step / 2; t += step) out.push(+t.toPrecision(12))
  return out
}

/** The value range a chart's axis must cover — stacked charts stack positives and negatives separately. */
export function valueExtent(d: ChartData, stacked: boolean): [number, number] {
  let lo = 0
  let hi = 0
  if (stacked) {
    const n = d.categories.length
    for (let i = 0; i < n; i++) {
      let pos = 0
      let neg = 0
      for (const s of d.series) { const v = s.values[i] || 0; if (v >= 0) pos += v; else neg += v }
      hi = Math.max(hi, pos); lo = Math.min(lo, neg)
    }
  } else for (const s of d.series) for (const v of s.values) { hi = Math.max(hi, v); lo = Math.min(lo, v) }
  return [lo, hi]
}

export const PALETTE = ['#0b6e4f', '#c8963e', '#3b5bdb', '#c2255c', '#0c8599', '#e8590c', '#5f3dc4', '#2b8a3e', '#a61e4d', '#495057']

export function fmtTick(n: number, locale: string): string {
  const a = Math.abs(n)
  const f = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en', a >= 1e6 ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: a >= 100 ? 0 : 2 })
  return f.format(n)
}
