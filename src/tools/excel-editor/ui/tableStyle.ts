// How an Excel table is drawn: its header row, banded rows and total row, from
// the table's named style. Pure, so the grid and the printout share it.
//
// Excel ships sixty-odd named styles (TableStyleLight1 … TableStyleDark11). They
// follow a pattern — a family (Light, Medium, Dark) and, within it, an accent
// colour that cycles through "none" and the theme's six accents — and that
// pattern is what is reproduced here, from the Office theme's accents. Not every
// border of every style is copied; the header, the bands and the total row are
// what make a table read as a table, and what people choose a style for.
import type { SheetTable } from '../engine/model'

export interface TableLook { bg?: string; color?: string; bold?: boolean; borderTop?: string; borderBottom?: string }

const ACCENTS = ['#000000', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47']

function mix(hex: string, toward: string, k: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = p(hex)
  const b = p(toward)
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('')
}
const tint = (c: string, k: number) => mix(c, '#ffffff', k)
const shade = (c: string, k: number) => mix(c, '#000000', k)

export function tableStyleParts(style: string | undefined): { header: TableLook; band?: string; body?: TableLook; total: TableLook; rule: string } {
  const m = /^TableStyle(Light|Medium|Dark)(\d+)$/.exec(style || 'TableStyleMedium2') || ['', 'Medium', '2']
  const fam = m[1]
  const n = Math.max(1, Number(m[2]))
  const accent = ACCENTS[(n - 1) % 7]
  const block = Math.floor((n - 1) / 7)
  const none = accent === '#000000'
  const rule = `1px solid ${none ? '#7f7f7f' : accent}`
  if (fam === 'Light') {
    if (block === 1) return { header: { bg: accent, color: '#ffffff', bold: true }, band: undefined, total: { bold: true, borderTop: `3px double ${accent}` }, rule }
    return { header: { bold: true, borderBottom: rule }, band: none ? '#d9d9d9' : tint(accent, 0.8), total: { bold: true, borderTop: `3px double ${accent}` }, rule }
  }
  if (fam === 'Dark') {
    const base = none ? '#404040' : shade(accent, 0.25)
    return { header: { bg: '#000000', color: '#ffffff', bold: true }, body: { bg: base, color: '#ffffff' }, band: shade(base, 0.2), total: { bg: '#000000', color: '#ffffff', bold: true }, rule }
  }
  // Medium: the commonest, and Excel's default (Medium2).
  return { header: { bg: none ? '#000000' : accent, color: '#ffffff', bold: true }, band: none ? '#d9d9d9' : tint(accent, 0.8), total: { bold: true, borderTop: `3px double ${none ? '#000' : accent}` }, rule }
}

export interface TableBox { t: SheetTable; r0: number; c0: number; r1: number; c1: number; parts: ReturnType<typeof tableStyleParts> }

/** The table look for one cell, or null when the cell is in no table. */
export function tableLookAt(tables: TableBox[], r: number, c: number): TableLook | null {
  for (const b of tables) {
    if (r < b.r0 || r > b.r1 || c < b.c0 || c > b.c1) continue
    const { t, parts } = b
    if (t.header && r === b.r0) return parts.header
    if (t.totals && r === b.r1) return parts.total
    const first = b.r0 + (t.header ? 1 : 0)
    const look: TableLook = { ...(parts.body || {}) }
    if (t.rowStripes !== false && parts.band && (r - first) % 2 === 0) look.bg = parts.band
    if (t.colStripes && parts.band && (c - b.c0) % 2 === 0) look.bg = parts.band
    if ((t.firstCol && c === b.c0) || (t.lastCol && c === b.c1)) look.bold = true
    return look
  }
  return null
}

export function tableBoxes(tables: SheetTable[] | undefined, parse: (ref: string) => { r0: number; c0: number; r1: number; c1: number } | null): TableBox[] {
  const out: TableBox[] = []
  for (const t of tables || []) { const b = parse(t.ref); if (b) out.push({ t, ...b, parts: tableStyleParts(t.style) }) }
  return out
}
