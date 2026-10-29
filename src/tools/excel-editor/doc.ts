// The spreadsheet as an editable document: every change is an OPERATION.
//
// One path for all of them — typing, a paste, the ribbon, undo, and a
// collaborator's edit arriving from the owner — so there is exactly one place a
// change can go wrong, and every change can be undone, sent to a peer and
// replayed. Each op knows whether it is idempotent (setting a cell, a format, a
// width) or not (inserting a row, adding a sheet); the collaboration sequencer
// (lib/collab/seqDoc.ts) applies the first kind optimistically and makes the
// second wait for the owner.
//
// Undo is by INVERSE OP, computed when the op is applied, rather than by
// snapshot: in a shared document "undo" must take back MY last change without
// rewinding the edits a colleague made since, and an inverse op is precisely
// that. Deleting rows captures the cells it removes, so undoing it puts them
// back.
import { Workbook } from './engine/workbook'
import { applyStructuralChange, type Axis } from './engine/structure'
import { renameSheetRefs } from './engine/formula'
import { cellKey, movedIndex, movedSpan, parseRange, colToLetters, type Cell, type CellFormat, type SheetData, type WorkbookData, type DefinedName } from './engine/model'
import type { SeqModel } from '../../lib/collab/seqDoc'

export type CellPatch = { r: number; c: number; input?: string; fmt?: CellFormat | null; note?: string | null; link?: string | null }
export type Box = { r0: number; c0: number; r1: number; c1: number }
type SheetProps = Omit<SheetData, 'name' | 'cells'>

export type XOp =
  | { k: 'cells'; sheet: string; cells: CellPatch[] }
  | { k: 'fmt'; sheet: string; box: Box; patch: CellFormat }
  | { k: 'clear'; sheet: string; box: Box; what: 'all' | 'contents' | 'formats' }
  | { k: 'props'; sheet: string; patch: Partial<SheetProps> }
  | { k: 'struct'; sheet: string; axis: Axis; at: number; delta: number; restore?: CellPatch[]; formulas?: { sheet: string; cells: CellPatch[] }[]; names?: DefinedName[] }
  | { k: 'sheet-add'; name: string; at?: number; data?: SheetData }
  | { k: 'sheet-del'; name: string }
  | { k: 'sheet-ren'; from: string; to: string }
  | { k: 'sheet-move'; name: string; to: number }
  | { k: 'names'; names: DefinedName[] }
  | { k: 'replace'; book: WorkbookData }

export const MAX_FMT_BOX = 250_000

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

export class SheetModel implements SeqModel<XOp> {
  book: WorkbookData
  engine: Workbook
  /** Bumps on every applied op, so React can re-render cheaply. */
  rev = 0
  private listeners = new Set<() => void>()

  constructor(book: WorkbookData) {
    this.book = book
    if (!this.book.sheets.length) this.book.sheets.push(blankSheet('Sheet1'))
    if (!this.book.names) this.book.names = []
    this.engine = new Workbook(this.book.sheets, this.book.names || [])
  }

  subscribe(f: () => void): () => void { this.listeners.add(f); return () => this.listeners.delete(f) }
  private changed() { this.rev++; for (const f of this.listeners) f() }

  sheet(name: string): SheetData {
    const s = this.book.sheets.find((x) => x.name === name)
    if (!s) throw new Error('no-sheet')
    return s
  }

  idempotent(op: XOp): boolean {
    return op.k === 'cells' || op.k === 'fmt' || op.k === 'clear' || op.k === 'props' || op.k === 'names' || op.k === 'sheet-ren'
  }

  snapshot(): unknown { return clone(this.book) }
  load(snap: unknown): void {
    if (!snap || typeof snap !== 'object' || !Array.isArray((snap as WorkbookData).sheets)) return
    this.book = clone(snap as WorkbookData)
    this.engine.reset(this.book.sheets, this.book.names || [])
    this.changed()
  }

  /** The op that undoes `op`, computed against the CURRENT state (call before applying). */
  inverse(op: XOp): XOp | null {
    switch (op.k) {
      case 'cells': {
        const s = this.sheet(op.sheet)
        return { k: 'cells', sheet: op.sheet, cells: op.cells.map((p) => prior(s, p.r, p.c, p)) }
      }
      case 'fmt': case 'clear': {
        const s = this.sheet(op.sheet)
        const b = op.box
        if ((b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1) > MAX_FMT_BOX) return null
        const cells: CellPatch[] = []
        for (const [k, cell] of Object.entries(s.cells)) {
          const comma = k.indexOf(',')
          const r = +k.slice(0, comma)
          const c = +k.slice(comma + 1)
          if (r < b.r0 || r > b.r1 || c < b.c0 || c > b.c1) continue
          cells.push({ r, c, input: cell.input, fmt: cell.fmt ? clone(cell.fmt) : null, note: cell.note ?? null, link: cell.link ?? null })
        }
        // Cells that were empty before a format get "no format" back.
        if (op.k === 'fmt') {
          const had = new Set(cells.map((p) => `${p.r},${p.c}`))
          const area = (b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1)
          if (area <= 20_000) for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) if (!had.has(`${r},${c}`)) cells.push({ r, c, input: '', fmt: null })
        }
        return { k: 'cells', sheet: op.sheet, cells }
      }
      case 'props': {
        const s = this.sheet(op.sheet) as unknown as Record<string, unknown>
        const back: Record<string, unknown> = {}
        for (const key of Object.keys(op.patch)) back[key] = s[key] === undefined ? null : clone(s[key])
        return { k: 'props', sheet: op.sheet, patch: back as Partial<SheetProps> }
      }
      case 'struct': {
        if (op.delta > 0) return { k: 'struct', sheet: op.sheet, axis: op.axis, at: op.at, delta: -op.delta }
        // A delete: put the removed cells back after re-inserting.
        const s = this.sheet(op.sheet)
        const restore: CellPatch[] = []
        const lo = op.at
        const hi = op.at - op.delta - 1
        for (const [k, cell] of Object.entries(s.cells)) {
          const [r, c] = k.split(',').map(Number)
          const idx = op.axis === 'row' ? r : c
          if (idx >= lo && idx <= hi) restore.push({ r, c, input: cell.input, fmt: cell.fmt ? clone(cell.fmt) : null, note: cell.note ?? null, link: cell.link ?? null })
        }
        // A delete also rewrites formulas ELSEWHERE — a range shrinks, a reference becomes
        // #REF! — and re-inserting the rows cannot know what they said. Capture every
        // formula as it is now; after the re-insert each one is back at this position.
        const formulas: { sheet: string; cells: CellPatch[] }[] = []
        for (const sh of this.book.sheets) {
          const cells: CellPatch[] = []
          for (const [k, cell] of Object.entries(sh.cells)) {
            if (!cell.input.startsWith('=')) continue
            const [r, c] = k.split(',').map(Number)
            const idx = op.axis === 'row' ? r : c
            if (sh === s && idx >= lo && idx <= hi) continue
            cells.push({ r, c, input: cell.input })
          }
          if (cells.length) formulas.push({ sheet: sh.name, cells })
        }
        return { k: 'struct', sheet: op.sheet, axis: op.axis, at: op.at, delta: -op.delta, restore, formulas, names: clone(this.book.names || []) }
      }
      case 'sheet-add': return { k: 'sheet-del', name: op.name }
      case 'sheet-del': {
        const i = this.book.sheets.findIndex((s) => s.name === op.name)
        return i < 0 ? null : { k: 'sheet-add', name: op.name, at: i, data: clone(this.book.sheets[i]) }
      }
      case 'sheet-ren': return { k: 'sheet-ren', from: op.to, to: op.from }
      case 'sheet-move': {
        const i = this.book.sheets.findIndex((s) => s.name === op.name)
        return { k: 'sheet-move', name: op.name, to: i }
      }
      case 'names': return { k: 'names', names: clone(this.book.names || []) }
      case 'replace': return { k: 'replace', book: clone(this.book) }
    }
  }

  apply(op: XOp): void {
    switch (op.k) {
      case 'cells': {
        const s = this.sheet(op.sheet)
        this.engine.batch(() => {
          for (const p of op.cells) {
            const key = cellKey(p.r, p.c)
            const cur: Cell = s.cells[key] ? { ...s.cells[key] } : { input: '' }
            if (p.fmt !== undefined) cur.fmt = p.fmt === null ? undefined : { ...p.fmt }
            if (p.note !== undefined) cur.note = p.note === null ? undefined : p.note
            if (p.link !== undefined) cur.link = p.link === null ? undefined : p.link
            const input = p.input !== undefined ? p.input : cur.input
            cur.input = input
            if (!cur.input && !cur.fmt && !cur.note && !cur.link) delete s.cells[key]
            else s.cells[key] = cleanCell(cur)
            this.engine.setInput(op.sheet, { row: p.r, col: p.c }, input)
            if (s.cells[key]) s.cells[key] = cleanCell({ ...s.cells[key], fmt: cur.fmt, note: cur.note, link: cur.link })
            if (p.r + 1 > s.rows) s.rows = p.r + 20
            if (p.c + 1 > s.cols) s.cols = p.c + 4
          }
        })
        break
      }
      case 'fmt': {
        const s = this.sheet(op.sheet)
        const b = op.box
        if ((b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1) > MAX_FMT_BOX) throw new Error('too-big')
        for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) {
          const key = cellKey(r, c)
          const cur = s.cells[key] || { input: '' }
          const fmt: CellFormat = { ...(cur.fmt || {}), ...op.patch }
          for (const k of Object.keys(fmt) as (keyof CellFormat)[]) if (fmt[k] === undefined || fmt[k] === null) delete fmt[k]
          const next = cleanCell({ ...cur, fmt: Object.keys(fmt).length ? fmt : undefined })
          if (!next.input && !next.fmt && !next.note && !next.link) delete s.cells[key]
          else s.cells[key] = next
        }
        break
      }
      case 'clear': {
        const s = this.sheet(op.sheet)
        const b = op.box
        this.engine.batch(() => {
          for (const k of Object.keys(s.cells)) {
            const comma = k.indexOf(',')
            const r = +k.slice(0, comma)
            const c = +k.slice(comma + 1)
            if (r < b.r0 || r > b.r1 || c < b.c0 || c > b.c1) continue
            const cur = s.cells[k]
            if (op.what === 'all') { delete s.cells[k]; this.engine.setInput(op.sheet, { row: r, col: c }, '') }
            else if (op.what === 'contents') {
              const next = cleanCell({ ...cur, input: '' })
              if (!next.fmt && !next.note && !next.link) delete s.cells[k]
              else s.cells[k] = next
              this.engine.setInput(op.sheet, { row: r, col: c }, '')
              if (next.fmt || next.note || next.link) s.cells[k] = next
            } else {
              const next = cleanCell({ ...cur, fmt: undefined })
              if (!next.input && !next.note && !next.link) delete s.cells[k]
              else s.cells[k] = next
            }
          }
        })
        break
      }
      case 'props': {
        const s = this.sheet(op.sheet) as unknown as Record<string, unknown>
        for (const [k, v] of Object.entries(op.patch)) {
          if (k === 'name' || k === 'cells') continue
          if (v === null || v === undefined) delete s[k]
          else s[k] = clone(v)
        }
        break
      }
      case 'struct': {
        this.sheet(op.sheet)
        const next = applyStructuralChange(this.book.sheets, op.sheet, op.axis, op.at, op.delta)
        this.book.sheets = next
        const s = this.sheet(op.sheet)
        moveSheetExtras(s, op.axis, op.at, op.delta)
        if (op.axis === 'row') s.rows = Math.max(1, s.rows + op.delta)
        else s.cols = Math.max(1, s.cols + op.delta)
        // Defined names follow the rows they point at, like formulas.
        this.engine.reset(this.book.sheets, this.book.names || [])
        if (op.names) { this.book.names = clone(op.names); this.engine.reset(this.book.sheets, this.book.names) }
        if (op.restore?.length) this.apply({ k: 'cells', sheet: op.sheet, cells: op.restore })
        for (const f of op.formulas || []) if (this.book.sheets.some((x) => x.name === f.sheet)) this.apply({ k: 'cells', sheet: f.sheet, cells: f.cells })
        break
      }
      case 'sheet-add': {
        if (this.book.sheets.some((s) => s.name.toLowerCase() === op.name.toLowerCase())) throw new Error('exists')
        const data = op.data ? { ...clone(op.data), name: op.name } : blankSheet(op.name)
        const at = op.at === undefined ? this.book.sheets.length : Math.max(0, Math.min(op.at, this.book.sheets.length))
        this.book.sheets.splice(at, 0, data)
        this.engine.reset(this.book.sheets, this.book.names || [])
        break
      }
      case 'sheet-del': {
        if (this.book.sheets.length <= 1) throw new Error('last-sheet')
        const i = this.book.sheets.findIndex((s) => s.name === op.name)
        if (i < 0) throw new Error('no-sheet')
        this.book.sheets.splice(i, 1)
        if ((this.book.active || 0) >= this.book.sheets.length) this.book.active = this.book.sheets.length - 1
        this.engine.reset(this.book.sheets, this.book.names || [])
        break
      }
      case 'sheet-ren': {
        const s = this.book.sheets.find((x) => x.name === op.from)
        if (!s) { if (this.book.sheets.some((x) => x.name === op.to)) break; throw new Error('no-sheet') }
        if (op.from === op.to) break
        if (this.book.sheets.some((x) => x !== s && x.name.toLowerCase() === op.to.toLowerCase())) throw new Error('exists')
        s.name = op.to
        // Every formula that named the old sheet names the new one.
        for (const sh of this.book.sheets) for (const cell of Object.values(sh.cells)) if (cell.input.startsWith('=')) cell.input = renameSheetRefs(cell.input, op.from, op.to)
        for (const n of this.book.names || []) { n.ref = renameSheetRefs(n.ref.startsWith('=') ? n.ref : '=' + n.ref, op.from, op.to); if (n.sheet === op.from) n.sheet = op.to }
        this.engine.reset(this.book.sheets, this.book.names || [])
        break
      }
      case 'sheet-move': {
        const i = this.book.sheets.findIndex((s) => s.name === op.name)
        if (i < 0) throw new Error('no-sheet')
        const [s] = this.book.sheets.splice(i, 1)
        this.book.sheets.splice(Math.max(0, Math.min(op.to, this.book.sheets.length)), 0, s)
        this.engine.reset(this.book.sheets, this.book.names || [])
        break
      }
      case 'names': {
        this.book.names = clone(op.names)
        this.engine.reset(this.book.sheets, this.book.names)
        break
      }
      case 'replace': {
        this.book = clone(op.book)
        if (!this.book.sheets.length) this.book.sheets.push(blankSheet('Sheet1'))
        this.engine.reset(this.book.sheets, this.book.names || [])
        break
      }
    }
    this.changed()
  }
}

function cleanCell(c: Cell): Cell {
  const out: Cell = { input: c.input ?? '' }
  if (c.fmt && Object.keys(c.fmt).length) out.fmt = c.fmt
  if (c.note) out.note = c.note
  if (c.link) out.link = c.link
  return out
}

function prior(s: SheetData, r: number, c: number, p: CellPatch): CellPatch {
  const cur = s.cells[cellKey(r, c)]
  const back: CellPatch = { r, c }
  if (p.input !== undefined) back.input = cur?.input ?? ''
  if (p.fmt !== undefined) back.fmt = cur?.fmt ? clone(cur.fmt) : null
  if (p.note !== undefined) back.note = cur?.note ?? null
  if (p.link !== undefined) back.link = cur?.link ?? null
  return back
}

export function blankSheet(name: string): SheetData {
  return { name, cells: {}, rows: 100, cols: 26 }
}

/** Merges, sizes, hidden rows/cols, pictures, validations and the filter range follow a structural edit. */
function moveSheetExtras(s: SheetData, axis: Axis, at: number, delta: number) {
  const a1 = (r: number, c: number) => `${colToLetters(c)}${r + 1}`
  const moveRange = (ref: string): string | null => {
    const b = parseRange(ref)
    if (!b) return ref
    const span = axis === 'row' ? movedSpan(b.r0, b.r1, at, delta) : movedSpan(b.c0, b.c1, at, delta)
    if (!span) return null
    return axis === 'row' ? `${a1(span.lo, b.c0)}:${a1(span.hi, b.c1)}` : `${a1(b.r0, span.lo)}:${a1(b.r1, span.hi)}`
  }
  if (s.merges) s.merges = s.merges.map(moveRange).filter((m): m is string => !!m && parseRange(m)!.r0 !== undefined)
  const moveMap = (m: Record<number, number> | undefined) => {
    if (!m) return m
    const out: Record<number, number> = {}
    for (const [k, v] of Object.entries(m)) { const n = movedIndex(+k, at, delta); if (n !== null) out[n] = v }
    return out
  }
  const moveList = (l: number[] | undefined) => l?.map((i) => movedIndex(i, at, delta)).filter((i): i is number => i !== null)
  if (axis === 'row') { s.rowHeights = moveMap(s.rowHeights); s.hiddenRows = moveList(s.hiddenRows) }
  else { s.colWidths = moveMap(s.colWidths); s.hiddenCols = moveList(s.hiddenCols) }
  if (s.autoFilter) s.autoFilter = moveRange(s.autoFilter) || undefined
  if (s.validations) s.validations = s.validations.map((v) => ({ ...v, range: v.range.split(/\s+/).map(moveRange).filter(Boolean).join(' ') })).filter((v) => v.range)
  if (s.images) for (const img of s.images) {
    const n = movedIndex(axis === 'row' ? img.anchor.row : img.anchor.col, at, delta)
    const v = n === null ? at : n
    if (axis === 'row') img.anchor.row = v
    else img.anchor.col = v
  }
}
