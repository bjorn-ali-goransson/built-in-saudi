// What a thing LOOKS like, computed once for the screen and the exporter alike.
// A table's banding or a run's effective size worked out in two places is two
// opinions, and the file a person downloads would disagree with the slide they
// were looking at.
import { applyMods } from '../../lib/office/color'
import { paint, type Para, type Run, type TableEl, type TextBody, type Theme } from './model'

/** The size a run is drawn at, before any shrink-to-fit. */
export function runSize(run: Run | undefined, p: Para, b: TextBody): number {
  return run?.size ?? p.size ?? b.defaults?.levels?.[p.level || 0]?.size ?? (p.level ? undefined : b.defaults?.size) ?? b.defaults?.size ?? 18
}
export function runColor(run: Run | undefined, b: TextBody, theme: Theme): string {
  return paint(run?.color ?? b.defaults?.color ?? 'dk1', theme)
}
/** A font name: 'major'/'minor' resolve to the theme's. */
export function fontName(f: string | undefined, b: TextBody, theme: Theme): string {
  const v = f ?? b.defaults?.font ?? 'minor'
  return v === 'major' ? theme.fonts.major : v === 'minor' ? theme.fonts.minor : v
}
export const isBold = (run: Run | undefined, b: TextBody) => run?.b ?? !!b.defaults?.b

export interface CellLook { fill?: string; color?: string; bold?: boolean }
/** A table cell's fill and text colour: its own, else the table style's header and banding. */
export function cellLook(t: TableEl, r: number, c: number, theme: Theme): CellLook {
  const cell = t.rows[r]?.cells[c]
  const st = t.style
  const accent = paint(st?.accent || 'accent1', theme)
  let fill: string | undefined
  let color: string | undefined
  let bold: boolean | undefined
  if (st?.header && r === 0) { fill = accent; color = '#ffffff'; bold = true }
  else if (st?.banded) fill = (r - (st.header ? 1 : 0)) % 2 === 0 ? applyMods(accent, { lumMod: 20000, lumOff: 80000 }) : applyMods(accent, { lumMod: 40000, lumOff: 60000 })
  if (cell?.fill) fill = paint(cell.fill, theme)
  return { fill, color, bold }
}
export function borderColor(t: TableEl, theme: Theme): string {
  return t.style?.borders ? paint(t.style.borders, theme) : t.style ? '#ffffff' : '#9aa4a0'
}

/** Where a table's row and column boundaries fall, scaled to its box. */
export function tableGrid(t: TableEl): { xs: number[]; ys: number[] } {
  const cw = t.cols.reduce((a, b) => a + b, 0) || 1
  const xs = [0]
  for (const c of t.cols) xs.push(xs[xs.length - 1] + (c / cw) * t.w)
  const rh = t.rows.reduce((a, r) => a + (r.h || 0), 0)
  const ys = [0]
  for (const r of t.rows) ys.push(ys[ys.length - 1] + (rh ? (r.h / rh) * t.h : t.h / t.rows.length))
  return { xs, ys }
}

/** The character a bulleted paragraph shows, and the label of a numbered one. */
export function bulletLabel(p: Para, n: number, rtl: boolean): string {
  if (p.bullet === 'bullet') return p.char || ['•', '–', '▪', '•', '–'][Math.min(4, p.level || 0)]
  const s = p.scheme || 'arabicPeriod'
  const k = (p.start || 1) + n - 1
  const roman = (v: number) => { const m: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let o = ''; for (const [a, b] of m) while (v >= a) { o += b; v -= a } return o }
  const alpha = (v: number) => { let o = ''; while (v > 0) { v--; o = String.fromCharCode(97 + (v % 26)) + o; v = Math.floor(v / 26) } return o }
  const indic = (v: number) => String(v).replace(/\d/g, (d) => String.fromCharCode(0x660 + +d))
  let core = String(k)
  if (/^alphaLc/.test(s)) core = alpha(k)
  else if (/^alphaUc/.test(s)) core = alpha(k).toUpperCase()
  else if (/^romanLc/.test(s)) core = roman(k)
  else if (/^romanUc/.test(s)) core = roman(k).toUpperCase()
  else if (/^arabicDb|^hindi/.test(s)) core = indic(k)
  const end = /ParenBoth$/.test(s) ? `(${core})` : /ParenR$/.test(s) ? `${core})` : /Plain$/.test(s) ? core : `${core}.`
  return rtl && /^arabicDb|^hindi/.test(s) ? end.replace('.', '.') : end
}
