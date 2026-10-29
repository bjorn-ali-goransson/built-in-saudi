// What the ribbon's buttons DO, as functions from the sheet to a list of cell
// changes. Kept out of the component so each one is tested on its own, and so
// every one of them reaches the document as an ordinary operation — which is
// what makes it undoable and what lets a collaborator see it.
import { cellKey, colToLetters, parseRange, isError, type CellFormat, type CellValue, type SheetData, type WorkbookData } from './engine/model'
import { shiftFormula } from './engine/formula'
import { compareValues } from './engine/sort'
import type { CellPatch, XOp } from './doc'
import type { Box } from './ui/geometry'
import { extendSeries } from './ui/fill'

export type ValueFn = (r: number, c: number) => CellValue
const a1 = (r: number, c: number) => `${colToLetters(c)}${r + 1}`
export const boxRef = (b: Box) => (b.r0 === b.r1 && b.c0 === b.c1 ? a1(b.r0, b.c0) : `${a1(b.r0, b.c0)}:${a1(b.r1, b.c1)}`)

/** Cells inside a box that actually hold something, so whole-column work stays cheap. */
export function* usedIn(sheet: SheetData, b: Box): Generator<[number, number]> {
  for (const k of Object.keys(sheet.cells)) {
    const i = k.indexOf(',')
    const r = +k.slice(0, i)
    const c = +k.slice(i + 1)
    if (r >= b.r0 && r <= b.r1 && c >= b.c0 && c <= b.c1) yield [r, c]
  }
}

/** A whole-row or whole-column selection, clamped to the part of the sheet in use. */
export function clampToUsed(b: Box, used: { rows: number; cols: number }, limit = { rows: 1_048_576, cols: 16_384 }): Box {
  const out = { ...b }
  if (b.r1 >= limit.rows - 1 || b.r1 - b.r0 > 5000) out.r1 = Math.max(b.r0, Math.min(b.r1, used.rows - 1))
  if (b.c1 >= limit.cols - 1 || b.c1 - b.c0 > 500) out.c1 = Math.max(b.c0, Math.min(b.c1, used.cols - 1))
  return out
}

export type BorderPreset = 'all' | 'outer' | 'bottom' | 'none' | 'thick-bottom'

export function borderPatches(sheet: SheetData, b: Box, preset: BorderPreset): CellPatch[] {
  const out: CellPatch[] = []
  const line = { s: 'thin', c: '#000000' }
  for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) {
    const cur = sheet.cells[cellKey(r, c)]?.fmt || {}
    const bd: NonNullable<CellFormat['bd']> = preset === 'none' ? {} : { ...(cur.bd || {}) }
    if (preset === 'all') { bd.t = line; bd.b = line; bd.l = line; bd.r = line }
    if (preset === 'outer') { if (r === b.r0) bd.t = line; if (r === b.r1) bd.b = line; if (c === b.c0) bd.l = line; if (c === b.c1) bd.r = line }
    if (preset === 'bottom' && r === b.r1) bd.b = line
    if (preset === 'thick-bottom' && r === b.r1) bd.b = { s: 'medium', c: '#000000' }
    const fmt: CellFormat = { ...cur }
    delete fmt.border
    if (Object.keys(bd).length) fmt.bd = bd
    else delete fmt.bd
    out.push({ r, c, fmt: Object.keys(fmt).length ? fmt : null })
  }
  return out
}

/** Merging keeps the top-left value and clears the rest, as Excel does — with the merge list updated. */
export function mergeOps(sheet: SheetData, b: Box, on: boolean): XOp[] {
  const merges = (sheet.merges || []).filter((m) => {
    const x = parseRange(m)
    return x && !(x.r0 <= b.r1 && x.r1 >= b.r0 && x.c0 <= b.c1 && x.c1 >= b.c0)
  })
  if (!on) return [{ k: 'props', sheet: sheet.name, patch: { merges } }]
  if (b.r0 === b.r1 && b.c0 === b.c1) return []
  const clear: CellPatch[] = []
  for (const [r, c] of usedIn(sheet, b)) if (r !== b.r0 || c !== b.c0) clear.push({ r, c, input: '' })
  const ops: XOp[] = []
  if (clear.length) ops.push({ k: 'cells', sheet: sheet.name, cells: clear })
  ops.push({ k: 'props', sheet: sheet.name, patch: { merges: [...merges, boxRef(b)] } })
  return ops
}

/**
 * The block of data around a cell: grow until surrounded by empty rows and
 * columns. What Ctrl+A selects first, what a sort or a chart uses when you have
 * only clicked one cell.
 */
export function currentRegion(filled: (r: number, c: number) => boolean, r: number, c: number, maxR: number, maxC: number): Box {
  let b: Box = { r0: r, c0: c, r1: r, c1: c }
  for (let pass = 0; pass < 200; pass++) {
    const grow = { ...b }
    const anyRow = (rr: number) => { for (let cc = Math.max(0, b.c0 - 1); cc <= Math.min(maxC, b.c1 + 1); cc++) if (filled(rr, cc)) return true; return false }
    const anyCol = (cc: number) => { for (let rr = Math.max(0, b.r0 - 1); rr <= Math.min(maxR, b.r1 + 1); rr++) if (filled(rr, cc)) return true; return false }
    if (b.r0 > 0 && anyRow(b.r0 - 1)) grow.r0--
    if (b.r1 < maxR && anyRow(b.r1 + 1)) grow.r1++
    if (b.c0 > 0 && anyCol(b.c0 - 1)) grow.c0--
    if (b.c1 < maxC && anyCol(b.c1 + 1)) grow.c1++
    if (grow.r0 === b.r0 && grow.r1 === b.r1 && grow.c0 === b.c0 && grow.c1 === b.c1) break
    b = grow
  }
  return b
}

/** Does the region's first row look like a header (text over at least one numeric column)? */
export function hasHeader(value: ValueFn, b: Box): boolean {
  if (b.r1 <= b.r0) return false
  let text = 0
  let numberBelow = false
  for (let c = b.c0; c <= b.c1; c++) {
    const top = value(b.r0, c)
    if (typeof top === 'string' && top !== '') text++
    else if (typeof top === 'number') return false
    if (typeof value(b.r0 + 1, c) === 'number') numberBelow = true
  }
  return text > 0 && (numberBelow || text === b.c1 - b.c0 + 1)
}

/** Sort the rows of a region by one column. Formulas move with their rows, as in Excel. */
export function sortPatches(sheet: SheetData, region: Box, col: number, dir: 'asc' | 'desc', value: ValueFn, header: boolean): CellPatch[] {
  const r0 = region.r0 + (header ? 1 : 0)
  if (region.r1 <= r0) return []
  const rows: number[] = []
  for (let r = r0; r <= region.r1; r++) rows.push(r)
  const keyed = rows.map((r) => ({ r, v: value(r, col) }))
  keyed.sort((x, y) => {
    // Blanks always last, whichever way.
    const xe = x.v === '' || x.v == null
    const ye = y.v === '' || y.v == null
    if (xe !== ye) return xe ? 1 : -1
    const d = compareValues(x.v, y.v)
    return (dir === 'asc' ? d : -d) || x.r - y.r
  })
  const out: CellPatch[] = []
  keyed.forEach(({ r: from }, i) => {
    const to = r0 + i
    for (let c = region.c0; c <= region.c1; c++) {
      const cell = sheet.cells[cellKey(from, c)]
      const input = cell?.input ?? ''
      out.push({ r: to, c, input: input.startsWith('=') && to !== from ? shiftFormula(input, to - from, 0) : input, fmt: cell?.fmt ? { ...cell.fmt } : null, note: cell?.note ?? null, link: cell?.link ?? null })
    }
  })
  return out
}

/** AutoSum: a SUM of the numbers above (or, failing that, to the start) of the active cell. */
export function autosumFor(value: ValueFn, r: number, c: number): string | null {
  const num = (rr: number, cc: number) => typeof value(rr, cc) === 'number'
  if (r > 0 && num(r - 1, c)) {
    let top = r - 1
    while (top > 0 && num(top - 1, c)) top--
    return `=SUM(${a1(top, c)}:${a1(r - 1, c)})`
  }
  if (c > 0 && num(r, c - 1)) {
    let left = c - 1
    while (left > 0 && num(r, left - 1)) left--
    return `=SUM(${a1(r, left)}:${a1(r, c - 1)})`
  }
  return null
}

/** AutoSum over a selection: a total under each column of it. */
export function autosumBelow(b: Box): CellPatch[] {
  const out: CellPatch[] = []
  for (let c = b.c0; c <= b.c1; c++) out.push({ r: b.r1 + 1, c, input: `=SUM(${a1(b.r0, c)}:${a1(b.r1, c)})` })
  return out
}

/** Drag-fill: extend `src` into `target` (which contains it). */
export function fillPatches(sheet: SheetData, src: Box, target: Box): CellPatch[] {
  const out: CellPatch[] = []
  const input = (r: number, c: number) => sheet.cells[cellKey(r, c)]?.input ?? ''
  const fmt = (r: number, c: number) => sheet.cells[cellKey(r, c)]?.fmt
  const vertical = target.c0 === src.c0 && target.c1 === src.c1
  if (vertical) {
    const down = target.r1 > src.r1
    const n = down ? target.r1 - src.r1 : src.r0 - target.r0
    for (let c = src.c0; c <= src.c1; c++) {
      const seq: string[] = []
      for (let r = src.r0; r <= src.r1; r++) seq.push(input(r, c))
      const vals = down ? extendSeries(seq, n, { dRow: 1, dCol: 0 }) : extendSeries(seq.slice().reverse(), n, { dRow: -1, dCol: 0 })
      vals.forEach((v, i) => {
        const r = down ? src.r1 + 1 + i : src.r0 - 1 - i
        const k = src.r1 - src.r0 + 1
        const fr = down ? src.r0 + (i % k) : src.r1 - (i % k)
        out.push({ r, c, input: v, fmt: fmt(fr, c) ? { ...fmt(fr, c)! } : null })
      })
    }
  } else {
    const right = target.c1 > src.c1
    const n = right ? target.c1 - src.c1 : src.c0 - target.c0
    for (let r = src.r0; r <= src.r1; r++) {
      const seq: string[] = []
      for (let c = src.c0; c <= src.c1; c++) seq.push(input(r, c))
      const vals = right ? extendSeries(seq, n, { dRow: 0, dCol: 1 }) : extendSeries(seq.slice().reverse(), n, { dRow: 0, dCol: -1 })
      vals.forEach((v, i) => {
        const c = right ? src.c1 + 1 + i : src.c0 - 1 - i
        const k = src.c1 - src.c0 + 1
        const fc = right ? src.c0 + (i % k) : src.c1 - (i % k)
        out.push({ r, c, input: v, fmt: fmt(r, fc) ? { ...fmt(r, fc)! } : null })
      })
    }
  }
  return out
}

/** Ctrl+Enter: the same input in every selected cell, formulas moved to each. */
export function fillSelection(input: string, at: { row: number; col: number }, b: Box): CellPatch[] {
  const out: CellPatch[] = []
  for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) out.push({ r, c, input: input.startsWith('=') ? shiftFormula(input, r - at.row, c - at.col) : input })
  return out
}

export interface FindOpts { matchCase?: boolean; whole?: boolean; formulas?: boolean; allSheets?: boolean }
export interface Match { sheet: string; r: number; c: number }

export function findAll(book: WorkbookData, sheetName: string, q: string, o: FindOpts, display: (sheet: string, r: number, c: number) => string): Match[] {
  if (!q) return []
  const needle = o.matchCase ? q : q.toLowerCase()
  const out: Match[] = []
  for (const sh of book.sheets) {
    if (!o.allSheets && sh.name !== sheetName) continue
    const keys = Object.keys(sh.cells).map((k) => k.split(',').map(Number) as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
    for (const [r, c] of keys) {
      const cell = sh.cells[cellKey(r, c)]
      const hay0 = o.formulas && cell.input.startsWith('=') ? cell.input : display(sh.name, r, c)
      const hay = o.matchCase ? hay0 : hay0.toLowerCase()
      if (o.whole ? hay === needle : hay.includes(needle)) out.push({ sheet: sh.name, r, c })
    }
  }
  return out
}

/** Replace in the cells' INPUTS — a formula's text, a value's digits — never in a computed result. */
export function replaceIn(input: string, q: string, w: string, o: FindOpts): string {
  if (o.whole) return (o.matchCase ? input === q : input.toLowerCase() === q.toLowerCase()) ? w : input
  if (o.matchCase) return input.split(q).join(w)
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return input.replace(re, () => w)
}

/** Remove rows that repeat an earlier row across the region's columns. Keeps the header. */
export function dedupePatches(sheet: SheetData, region: Box, value: ValueFn, header: boolean): { patches: CellPatch[]; removed: number } {
  const r0 = region.r0 + (header ? 1 : 0)
  const seen = new Set<string>()
  const keep: number[] = []
  for (let r = r0; r <= region.r1; r++) {
    const key: string[] = []
    for (let c = region.c0; c <= region.c1; c++) { const v = value(r, c); key.push(isError(v) ? v.kind : typeof v + ':' + String(v)) }
    const k = key.join('\u0001')
    if (seen.has(k)) continue
    seen.add(k)
    keep.push(r)
  }
  const removed = region.r1 - r0 + 1 - keep.length
  if (!removed) return { patches: [], removed: 0 }
  const out: CellPatch[] = []
  for (let i = 0; i <= region.r1 - r0; i++) {
    const to = r0 + i
    const from = keep[i]
    for (let c = region.c0; c <= region.c1; c++) {
      if (from === undefined) { out.push({ r: to, c, input: '', fmt: null }); continue }
      const cell = sheet.cells[cellKey(from, c)]
      const input = cell?.input ?? ''
      out.push({ r: to, c, input: input.startsWith('=') && from !== to ? shiftFormula(input, to - from, 0) : input, fmt: cell?.fmt ? { ...cell.fmt } : null })
    }
  }
  return { patches: out, removed }
}

/** Split one column of text into several, by a delimiter, writing to the right. */
export function splitPatches(sheet: SheetData, b: Box, delim: string): CellPatch[] {
  const out: CellPatch[] = []
  if (!delim) return out
  for (let r = b.r0; r <= b.r1; r++) {
    const input = sheet.cells[cellKey(r, b.c0)]?.input ?? ''
    if (!input || input.startsWith('=')) continue
    input.split(delim).forEach((part, i) => out.push({ r, c: b.c0 + i, input: part.trim() }))
  }
  return out
}

/** A column width that fits its widest content, in base pixels. */
export function fitWidth(texts: string[], measure: (t: string) => number, min = 40, max = 600): number {
  let w = min
  for (const t of texts) for (const line of t.split('\n')) w = Math.max(w, measure(line) + 14)
  return Math.min(max, Math.ceil(w))
}

/** Statistics for the status bar over a selection. */
export function selectionStats(sheet: SheetData, b: Box, value: ValueFn): { sum: number; count: number; nums: number; min: number; max: number } {
  let sum = 0
  let count = 0
  let nums = 0
  let min = Infinity
  let max = -Infinity
  const area = (b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1)
  const visit = (r: number, c: number) => {
    const v = value(r, c)
    if (v === '' || v == null) return
    count++
    if (typeof v === 'number') { nums++; sum += v; min = Math.min(min, v); max = Math.max(max, v) }
  }
  if (area < 50_000) { for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) visit(r, c) }
  else for (const [r, c] of usedIn(sheet, b)) visit(r, c)
  return { sum, count, nums, min, max }
}

/** A sheet name that is free, valid in Excel (≤31 chars, no []:*?/\), and not already used. */
export function freeSheetName(book: WorkbookData, base: string): string {
  const clean = base.replace(/[[\]:*?/\\]/g, '').slice(0, 31) || 'Sheet'
  const taken = new Set(book.sheets.map((s) => s.name.toLowerCase()))
  if (!taken.has(clean.toLowerCase())) return clean
  for (let i = 2; i < 10_000; i++) {
    const n = `${clean.slice(0, 31 - String(i).length - 1)} ${i}`
    if (!taken.has(n.toLowerCase())) return n
  }
  return clean + Date.now()
}

export const validSheetName = (n: string) => !!n.trim() && n.length <= 31 && !/[[\]:*?/\\]/.test(n) && !/^'|'$/.test(n)
export const validName = (n: string) => /^[A-Za-z_؀-ۿ][A-Za-z0-9_.؀-ۿ]*$/.test(n) && !/^[A-Z]{1,3}\d+$/i.test(n) && n.length <= 255
