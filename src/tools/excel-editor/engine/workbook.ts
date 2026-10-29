// The reactive workbook — INCREMENTAL.
//
// The engine this was ported from recalculated every cell of every sheet on every
// keystroke, which is fine for a sheet somebody typed and hopeless for one they
// imported: a 30,000-cell workbook with a few thousand formulas is a visible
// pause per edit. So this one keeps a dependency graph and recomputes LAZILY:
//
// - Every formula is parsed once and its references indexed — single cells in a
//   reverse map, ranges in a per-sheet list (a range is not expanded into the
//   index, or `SUM(A:A)` would be a million entries).
// - An edit invalidates the edited cell and, transitively, everything that reads
//   it — and nothing else. Values are recomputed only when something ASKS (the
//   grid reading a visible cell, or a formula reading a cell it depends on), so a
//   change to a cell three sheets away from what is on screen costs almost
//   nothing until somebody looks.
// - Volatile functions (NOW, TODAY, RAND, RANDBETWEEN) are invalidated on every
//   edit, which is what Excel does.
// - Cycles are caught by the same guard as before and render as #CIRC!.
//
// The public API is the old engine's, so the ported engine tests run against
// this one unchanged — they are the regression suite for the rewrite.
import { evaluate, MAX_RANGE_CELLS, parse, rangeArea, WHOLE, type EvalCtx, type Node } from './formula'
import { cellKey, ERR, isError, matchesCond, sheetConds, parseRange, type Addr, type Cell, type CellFormat, type CellValue, type CondRule, type ChartSpec, type ScaleRule, type SheetData, type WhatIfSpec, type DefinedName } from './model'

type Key = string // `${sheet}\u0000${row},${col}`
const gk = (sheet: string, row: number, col: number): Key => `${sheet}\u0000${row},${col}`
const VOLATILE = /\b(NOW|TODAY|RAND|RANDBETWEEN)\s*\(/i

interface Formula { ast: Node | null; err?: boolean; volatile: boolean; refs: Key[]; ranges: { sheet: string; r0: number; c0: number; r1: number; c1: number }[] }

export class Workbook {
  private sheets = new Map<string, SheetData>()
  private order: string[] = []
  private values = new Map<Key, CellValue>()
  private formulas = new Map<Key, Formula>()
  private rev = new Map<Key, Set<Key>>()
  private rangeDeps = new Map<string, { key: Key; r0: number; c0: number; r1: number; c1: number }[]>()
  private volatile = new Set<Key>()
  private extents = new Map<string, { rows: number; cols: number }>()
  private names = new Map<string, Node>()
  private nameDefs: DefinedName[] = []
  private batching = 0
  private pendingDirty = new Set<Key>()

  constructor(sheets: SheetData[], names: DefinedName[] = []) {
    for (const s of sheets) {
      this.sheets.set(s.name, s)
      this.order.push(s.name)
    }
    this.nameDefs = names
    this.rebuild()
  }

  sheetNames(): string[] { return [...this.order] }
  sheet(name: string): SheetData | undefined { return this.sheets.get(name) }
  snapshot(): SheetData[] { return this.order.map((n) => this.sheets.get(n)!) }
  definedNames(): DefinedName[] { return this.nameDefs }

  input(sheet: string, addr: Addr): string {
    return this.sheets.get(sheet)?.cells[cellKey(addr.row, addr.col)]?.input ?? ''
  }

  value(sheet: string, addr: Addr): CellValue {
    if (!this.sheets.has(sheet)) return ERR.ref()
    return this.compute(sheet, addr.row, addr.col, new Set())
  }

  /** Several edits as one recalculation (a paste, a fill, a remote batch). */
  batch(fn: () => void): void {
    this.batching++
    try { fn() } finally {
      this.batching--
      if (!this.batching) { this.invalidate(this.pendingDirty); this.pendingDirty.clear() }
    }
  }

  setInput(sheet: string, addr: Addr, input: string): void {
    const s = this.sheets.get(sheet)
    if (!s) return
    const key = cellKey(addr.row, addr.col)
    const existing = s.cells[key]
    if (input === '' && !existing?.fmt && !existing?.note && !existing?.link) delete s.cells[key]
    else s.cells[key] = { ...(existing ?? {}), input }
    const g = gk(sheet, addr.row, addr.col)
    this.unindex(g)
    if (input.startsWith('=')) this.index(sheet, addr.row, addr.col, input)
    this.grow(sheet, addr.row, addr.col)
    if (this.batching) this.pendingDirty.add(g)
    else this.invalidate(new Set([g]))
  }

  format(sheet: string, addr: Addr): CellFormat | undefined {
    return this.sheets.get(sheet)?.cells[cellKey(addr.row, addr.col)]?.fmt
  }
  cell(sheet: string, addr: Addr): Cell | undefined { return this.sheets.get(sheet)?.cells[cellKey(addr.row, addr.col)] }
  setFormat(sheet: string, addr: Addr, patch: CellFormat): void {
    const s = this.sheets.get(sheet)
    if (!s) return
    const key = cellKey(addr.row, addr.col)
    const cell = s.cells[key] ?? { input: '' }
    const fmt: CellFormat = { ...cell.fmt, ...patch }
    for (const k of Object.keys(fmt) as (keyof CellFormat)[]) if (fmt[k] === undefined) delete fmt[k]
    cell.fmt = Object.keys(fmt).length ? fmt : undefined
    s.cells[key] = cell
  }

  cond(sheet: string): CondRule | undefined { return this.conds(sheet)[0] }
  conds(sheet: string): CondRule[] { const s = this.sheets.get(sheet); return sheetConds(s?.cond, s?.conds) }
  setCond(sheet: string, rule: CondRule | null): void { this.setConds(sheet, rule ? [rule] : []) }
  setConds(sheet: string, rules: CondRule[]): void { const s = this.sheets.get(sheet); if (!s) return; s.conds = rules; delete s.cond }
  condFill(sheet: string, addr: Addr): string | undefined {
    const rules = this.conds(sheet)
    if (!rules.length) return undefined
    const v = this.value(sheet, addr)
    const hit = rules.find((r) => matchesCond(r, v))
    return hit ? (hit.bg ?? '#d6e7c8') : undefined
  }
  condMatches(sheet: string, addr: Addr): boolean { return this.condFill(sheet, addr) !== undefined }
  scales(sheet: string): ScaleRule[] { return this.sheets.get(sheet)?.scales ?? [] }
  charts(sheet: string): ChartSpec[] { return this.sheets.get(sheet)?.charts ?? [] }
  whatIfs(sheet: string): WhatIfSpec[] { return this.sheets.get(sheet)?.whatIfs ?? [] }
  setScales(sheet: string, rules: ScaleRule[]): void { const s = this.sheets.get(sheet); if (s) s.scales = rules }

  addSheet(name: string): string {
    const s: SheetData = { name, cells: {}, rows: 100, cols: 26 }
    this.sheets.set(name, s)
    this.order.push(name)
    this.extents.set(name, { rows: 0, cols: 0 })
    // A formula that referred to this name while it did not exist was #REF!; now it is not.
    this.rebuild()
    return name
  }
  /** Replace everything — after an import, a structural edit, a sheet rename or a remote snapshot. */
  reset(sheets: SheetData[], names: DefinedName[] = this.nameDefs): void {
    this.sheets.clear()
    this.order = []
    for (const s of sheets) { this.sheets.set(s.name, s); this.order.push(s.name) }
    this.nameDefs = names
    this.rebuild()
  }

  /** The used extent of a sheet (rows, cols — one past the last non-empty). */
  extent(sheet: string): { rows: number; cols: number } { return this.extents.get(sheet) ?? { rows: 0, cols: 0 } }

  // ---- the graph ---------------------------------------------------------------

  private rebuild() {
    this.values.clear()
    this.formulas.clear()
    this.rev.clear()
    this.rangeDeps.clear()
    this.volatile.clear()
    this.extents.clear()
    this.names.clear()
    for (const n of this.nameDefs) {
      try {
        const node = parse(n.ref.replace(/^=/, ''))
        this.names.set((n.sheet ? `${n.sheet}!` : '') + n.name.toUpperCase(), node)
      } catch { /* an unparseable name stays #NAME? */ }
    }
    for (const name of this.order) {
      const s = this.sheets.get(name)!
      let rows = 0
      let cols = 0
      for (const [k, cell] of Object.entries(s.cells)) {
        const comma = k.indexOf(',')
        const row = +k.slice(0, comma)
        const col = +k.slice(comma + 1)
        if (cell.input !== '') { rows = Math.max(rows, row + 1); cols = Math.max(cols, col + 1) }
        if (cell.input.startsWith('=')) this.index(name, row, col, cell.input)
      }
      this.extents.set(name, { rows, cols })
    }
  }

  private grow(sheet: string, row: number, col: number) {
    const e = this.extents.get(sheet) || { rows: 0, cols: 0 }
    if (row + 1 > e.rows || col + 1 > e.cols) {
      this.extents.set(sheet, { rows: Math.max(e.rows, row + 1), cols: Math.max(e.cols, col + 1) })
      // A whole-column range now reaches further: anything reading one must recompute.
      for (const [sh, list] of this.rangeDeps) if (sh === sheet) for (const r of list) if (r.r1 >= WHOLE || r.c1 >= WHOLE) this.values.delete(r.key)
    }
  }

  private resolveNames(node: Node, sheet: string): Node {
    switch (node.k) {
      case 'name': {
        const local = this.names.get(`${sheet}!${node.v.toUpperCase()}`)
        const global = this.names.get(node.v.toUpperCase())
        return local ?? global ?? node
      }
      case 'unary': return { ...node, x: this.resolveNames(node.x, sheet) }
      case 'binary': return { ...node, a: this.resolveNames(node.a, sheet), b: this.resolveNames(node.b, sheet) }
      case 'func': return { ...node, args: node.args.map((a) => this.resolveNames(a, sheet)) }
      default: return node
    }
  }

  private index(sheet: string, row: number, col: number, input: string) {
    const key = gk(sheet, row, col)
    const f: Formula = { ast: null, volatile: VOLATILE.test(input), refs: [], ranges: [] }
    try {
      f.ast = this.resolveNames(parse(input.slice(1)), sheet)
    } catch {
      f.err = true
    }
    if (f.ast) this.collect(f.ast, sheet, f)
    this.formulas.set(key, f)
    for (const r of f.refs) {
      let set = this.rev.get(r)
      if (!set) { set = new Set(); this.rev.set(r, set) }
      set.add(key)
    }
    for (const r of f.ranges) {
      let list = this.rangeDeps.get(r.sheet)
      if (!list) { list = []; this.rangeDeps.set(r.sheet, list) }
      list.push({ key, r0: r.r0, c0: r.c0, r1: r.r1, c1: r.c1 })
    }
    if (f.volatile) this.volatile.add(key)
  }

  private collect(n: Node, sheet: string, f: Formula) {
    switch (n.k) {
      case 'ref': f.refs.push(gk(n.sheet ?? sheet, n.addr.row, n.addr.col)); break
      case 'range': f.ranges.push({ sheet: n.sheet ?? sheet, r0: Math.min(n.from.row, n.to.row), c0: Math.min(n.from.col, n.to.col), r1: Math.max(n.from.row, n.to.row), c1: Math.max(n.from.col, n.to.col) }); break
      case 'unary': this.collect(n.x, sheet, f); break
      case 'binary': this.collect(n.a, sheet, f); this.collect(n.b, sheet, f); break
      case 'func': for (const a of n.args) this.collect(a, sheet, f); break
      case 'array': for (const r of n.rows) for (const x of r) this.collect(x, sheet, f); break
    }
  }

  private unindex(key: Key) {
    const f = this.formulas.get(key)
    if (!f) return
    for (const r of f.refs) this.rev.get(r)?.delete(key)
    for (const r of f.ranges) {
      const list = this.rangeDeps.get(r.sheet)
      if (list) this.rangeDeps.set(r.sheet, list.filter((x) => x.key !== key))
    }
    this.volatile.delete(key)
    this.formulas.delete(key)
  }

  /** Drop the cached value of these cells and of everything that (transitively) reads them. */
  private invalidate(seeds: Set<Key>) {
    const stack = [...seeds, ...this.volatile]
    const seen = new Set<Key>()
    while (stack.length) {
      const k = stack.pop()!
      if (seen.has(k)) continue
      seen.add(k)
      this.values.delete(k)
      const direct = this.rev.get(k)
      if (direct) for (const d of direct) stack.push(d)
      const nul = k.indexOf('\u0000')
      const sheet = k.slice(0, nul)
      const list = this.rangeDeps.get(sheet)
      if (list) {
        const comma = k.indexOf(',', nul)
        const row = +k.slice(nul + 1, comma)
        const col = +k.slice(comma + 1)
        for (const r of list) if (row >= r.r0 && row <= r.r1 && col >= r.c0 && col <= r.c1) stack.push(r.key)
      }
    }
  }

  private ctx(sheet: string, guard: Set<Key>, self: Addr): EvalCtx {
    const cellVal = (sn: string | undefined, addr: Addr): CellValue => {
      const name = sn ?? sheet
      if (!this.sheets.has(name)) return ERR.ref()
      return this.compute(name, addr.row, addr.col, guard)
    }
    return {
      self: { sheet, addr: self },
      cell: cellVal,
      clamp: (sn, from, to) => {
        const e = this.extent(sn ?? sheet)
        const r1 = to.row >= WHOLE ? Math.max(0, e.rows - 1) : to.row
        const c1 = to.col >= WHOLE ? Math.max(0, e.cols - 1) : to.col
        return { from: { row: Math.min(from.row, r1), col: Math.min(from.col, c1) }, to: { row: r1, col: c1 } }
      },
      range: (sn, from, to) => {
        if (rangeArea(from, to) > MAX_RANGE_CELLS) throw ERR.num()
        const name = sn ?? sheet
        if (!this.sheets.has(name)) throw ERR.ref()
        const out: CellValue[] = []
        for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r++)
          for (let c = Math.min(from.col, to.col); c <= Math.max(from.col, to.col); c++)
            out.push(this.compute(name, r, c, guard))
        return out
      },
    }
  }

  private compute(sheet: string, row: number, col: number, guard: Set<Key>): CellValue {
    const key = gk(sheet, row, col)
    const hit = this.values.get(key)
    if (hit !== undefined) return hit
    if (guard.has(key)) return ERR.circ()
    const raw = this.sheets.get(sheet)?.cells[cellKey(row, col)]?.input ?? ''
    let result: CellValue
    if (raw.startsWith('=')) {
      let f = this.formulas.get(key)
      if (!f) { this.index(sheet, row, col, raw); f = this.formulas.get(key)! }
      if (!f.ast) result = ERR.value()
      else {
        guard.add(key)
        try {
          result = evaluate(f.ast, this.ctx(sheet, guard, { row, col }))
        } catch (e) {
          result = isError(e) ? e : ERR.value()
        }
        guard.delete(key)
      }
    } else {
      result = literal(raw)
    }
    if (typeof result === 'number' && !Number.isFinite(result)) result = ERR.num()
    this.values.set(key, result)
    return result
  }

  /** Cells that (transitively) read the given cell — for "trace dependents". */
  dependents(sheet: string, addr: Addr): string[] {
    const out = new Set<Key>()
    const stack: Key[] = [gk(sheet, addr.row, addr.col)]
    while (stack.length) {
      const k = stack.pop()!
      for (const d of this.rev.get(k) || []) if (!out.has(d)) { out.add(d); stack.push(d) }
      const nul = k.indexOf('\u0000')
      const list = this.rangeDeps.get(k.slice(0, nul))
      if (list) {
        const comma = k.indexOf(',', nul)
        const row = +k.slice(nul + 1, comma)
        const col = +k.slice(comma + 1)
        for (const r of list) if (row >= r.r0 && row <= r.r1 && col >= r.c0 && col <= r.c1 && !out.has(r.key)) { out.add(r.key); stack.push(r.key) }
      }
    }
    return [...out].map((k) => k.replace('\u0000', '!'))
  }
  /** Direct precedents of a formula cell, for "trace precedents". */
  precedents(sheet: string, addr: Addr): { refs: string[]; ranges: string[] } {
    const f = this.formulas.get(gk(sheet, addr.row, addr.col))
    if (!f) return { refs: [], ranges: [] }
    return { refs: f.refs.map((k) => k.replace('\u0000', '!')), ranges: f.ranges.map((r) => `${r.sheet}!${r.r0},${r.c0}:${r.r1},${r.c1}`) }
  }
}

/** A raw (non-formula) input becomes a number if it looks like one, else text. */
export function literal(raw: string): CellValue {
  if (raw === '') return ''
  const up = raw.toUpperCase()
  if (up === 'TRUE') return true
  if (up === 'FALSE') return false
  if (/^-?\d*\.?\d+(e[+-]?\d+)?%$/i.test(raw)) return parseFloat(raw) / 100
  if (/^-?\d*\.?\d+(e[+-]?\d+)?$/i.test(raw)) return Number(raw)
  // A leading apostrophe forces text, as in Excel: '0501234567 keeps its zero.
  if (raw.startsWith("'")) return raw.slice(1)
  return raw
}

export function displayValue(v: CellValue): string {
  if (isError(v)) return v.kind
  if (v === '' || v == null) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e10) / 1e10)
  return v
}

/** Is `addr` inside one of the merged ranges, and which? */
export function mergeAt(merges: string[] | undefined, row: number, col: number): { r0: number; c0: number; r1: number; c1: number } | null {
  for (const m of merges || []) {
    const b = parseRange(m)
    if (b && row >= b.r0 && row <= b.r1 && col >= b.c0 && col <= b.c1) return b
  }
  return null
}
