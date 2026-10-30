/**
 * Kafani-native spreadsheet model — our own format, not OOXML. A workbook is a
 * list of sheets; a sheet is a sparse map of cells keyed by "row,col" (0-based).
 * A cell holds a raw input string; the engine derives its computed value.
 *
 * See CLAUDE.md "Write / Tables": we own this format, so there is no round-trip
 * fidelity problem. Import/export to .xlsx is an explicit, lossy conversion.
 */

export type CellValue = number | string | boolean | CellError

/** Excel-style error sentinels. `kind` renders in the cell; the engine propagates. */
export class CellError {
  constructor(public readonly kind: string) {}
  toString() {
    return this.kind
  }
}
export const ERR = {
  div0: () => new CellError('#DIV/0!'),
  ref: () => new CellError('#REF!'),
  value: () => new CellError('#VALUE!'),
  name: () => new CellError('#NAME?'),
  circ: () => new CellError('#CIRC!'),
  na: () => new CellError('#N/A'),
  /** Non-finite result (√ of a negative, overflow, etc.) — never leak NaN/Infinity. */
  num: () => new CellError('#NUM!'),
}
export const isError = (v: unknown): v is CellError => v instanceof CellError

export type Cell = {
  /** What the user typed: "42", "hello", or "=A1+B2". */
  input: string
  /** Optional presentation, expanded later (bold, align, number format, borders). */
  fmt?: CellFormat
  /** A note attached to the cell (Excel's comment / note). */
  note?: string
  /** A hyperlink target (http(s), mailto, or `#Sheet!A1`). */
  link?: string
}

/**
 * A form control rendered IN a cell (#214): a checkbox (the cell holds TRUE/FALSE, which the
 * engine already treats as a boolean, so formulas can read it) or a spin button (the cell
 * holds a number the up/down steppers change within optional bounds). The control is a
 * presentation+interaction layer over the cell's ordinary value — no separate storage.
 */
export type CellControl =
  | { kind: 'checkbox' }
  | { kind: 'spin'; min?: number; max?: number; step?: number }
  /** A dropdown / data-validation list — the cell value must be one of `options` (#315). */
  | { kind: 'dropdown'; options: string[] }

/** One stretch of a cell's text with its own formatting — Excel's "rich text" in a cell. */
export type TextRun = { t: string; b?: boolean; i?: boolean; u?: boolean; s?: boolean; color?: string; size?: number; font?: string; sup?: boolean; sub?: boolean }

/**
 * Sheet or workbook protection, as the file stated it. The password is never
 * known: only its hash, which is what is checked when somebody unprotects, and
 * what is written back so the file stays protected the same way.
 */
export type Protection = {
  hash?: { algorithm: string; value: string; salt: string; spin: number }
  /** The pre-2010 16-bit password hash, as four hex digits. */
  legacy?: string
  /** What the protection still ALLOWS, by the file's own attribute names (formatCells, insertRows …). */
  allow?: Record<string, boolean>
}

/** An Excel table: a named range with a header row and a style. */
export type SheetTable = { name: string; ref: string; style?: string; header: boolean; totals?: boolean; rowStripes?: boolean; colStripes?: boolean; firstCol?: boolean; lastCol?: boolean; columns: string[] }

export type CellFormat = {
  /**
   * Mixed formatting within the cell's text. It applies only while the runs spell
   * exactly the cell's text: editing the cell retires them without anything having
   * to notice, so stale styling can never be drawn on new words.
   */
  runs?: TextRun[]
  /** Excel's cell protection: cells are LOCKED unless this says otherwise. It only bites on a protected sheet. */
  unlocked?: boolean
  /** Hide the formula on a protected sheet. */
  hideFormula?: boolean
  /**
   * THE FOUR TEXT MARKS. Bold shipped alone for a long time, which made a sheet the one surface in
   * the suite where a person could not italicise a note in a cell or strike a cancelled line
   * through — both ordinary spreadsheet work, and both already read from `.xlsx` files we import.
   * They are four independent booleans rather than a set, because that is how `.xlsx` stores them
   * and how every picker a person has used behaves: bold AND italic is a normal cell.
   */
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /**
   * Font size in POINTS (#1361). Points because that is what `.xlsx` stores and what every picker
   * a person has used shows them; absent means the sheet's own default.
   */
  fontSize?: number
  align?: 'start' | 'center' | 'end'
  /**
   * Wrap the cell's text onto as many lines as it needs, growing THIS row — the Excel button.
   * Without it a long line is truncated at the column edge, which is the right default for a grid
   * and the wrong one for the note column every real sheet has.
   */
  wrap?: boolean
  /** Vertical alignment within the cell. */
  valign?: 'top' | 'middle' | 'bottom'
  /** e.g. '#,##0' | '0.00' | '0%' — a tiny subset, expanded as needed. */
  numFmt?: string
  /** ISO 4217 code paired with the 'currency' numFmt (defaults to SAR). */
  currency?: string
  /**
   * Decimal places for the number formats. Absent means the format's own default — and for
   * `currency` that default is the CURRENCY's (`Intl` knows a yen has none), which is why this is
   * optional rather than a number with a fixed fallback (`numfmt.ts`).
   */
  decimals?: number
  /** Cell borders. Legacy `true` = all four sides; the object form is per-side. */
  border?: boolean | CellBorders
  /** Cell fill colour (any CSS colour), picked from the palette. */
  bg?: string
  /** Text colour (any CSS colour). */
  color?: string
  /** An in-cell form control over this cell's value (#214). */
  control?: CellControl
  /** An Excel number-format CODE (`#,##0.00;[Red]-#,##0.00`). Wins over `numFmt` when set. */
  numCode?: string
  fontFamily?: string
  /** Indent level, as Excel counts it (about 3 character widths each). */
  indent?: number
  /** Text rotation in degrees (-90..90), or 255 for stacked. */
  rotate?: number
  /** Border detail — style and colour per side — kept alongside the simple `border` flags. */
  bd?: Partial<Record<'t' | 'r' | 'b' | 'l', { s: string; c?: string }>>
}

/**
 * A value-driven visual: a 2-/3-colour scale (gradient by value) or a data bar
 * (in-cell bar proportional to value), applied to a rectangular range (#97). Unlike
 * match rules, these read the range's own min/max.
 */
export type ScaleKind = 'scale3' | 'scale2' | 'databar'
export type ScaleRule = { box: { r0: number; c0: number; r1: number; c1: number }; kind: ScaleKind }

/**
 * A chart rendered FROM a range of the sheet's own computed values (#215). Charts are
 * a derived view — they hold no data of their own, only a reference to the range and how
 * to draw it — so they recompute live as the cells behind them change, exactly like
 * conditional formats. Kept deliberately small: three business chart types over a
 * rectangular range, first column = category labels, remaining columns = series.
 */
export type ChartKind = 'bar' | 'column' | 'line' | 'pie' | 'area' | 'scatter' | 'doughnut'
export type ChartSpec = {
  /** Stable id (assigned on insert) so a chart can be re-typed/removed without reordering. */
  id: string
  kind: ChartKind
  /** The source range in A1 notation on this sheet, e.g. "A1:B6". */
  range: string
  /** Optional heading; falls back to the first series' name or "Chart". */
  title?: string
  /** Where the chart floats on the sheet: pinned to a cell (top-left), so it scrolls with the
   *  grid and stays near its data. Absent → derived from the range (placed just below it). */
  anchor?: { row: number; col: number }
  /** Chart box size in BASE pixels (at zoom 1); rendered scaled by the live zoom. Absent → default. */
  size?: { w: number; h: number }
  /**
   * Explicit series, as an imported chart states them (each its own category and value range,
   * possibly on another sheet). Absent → derived from `range`: first column categories, the rest
   * series.
   */
  series?: { name?: string; cat?: string; val: string; color?: string }[]
  stacked?: boolean
  legend?: boolean
}

/** Default on-sheet chart box (base px) — ~3 columns wide, a readable aspect. */
export const CHART_DEFAULT_SIZE = { w: 360, h: 240 }

/** The chart's anchor cell — explicit, or derived from its range (one row below the data). */
export function chartAnchor(spec: ChartSpec): { row: number; col: number } {
  if (spec.anchor) return spec.anchor
  const box = parseRange(spec.range)
  if (!box) return { row: 0, col: 0 }
  return { row: box.r1 + 1, col: box.c0 }
}

/**
 * A LIVE what-if / sensitivity table (#324). Like a chart, it holds no values of its own — only
 * the references that define it — and its output block is a DERIVED overlay the workbook recomputes
 * on every recalc (substitute each input, recompute, read the result). Stored in sheet meta so it
 * survives reloads and syncs to collaborators, and so editing the model updates it live.
 *
 * One-variable: sweep `input` across the values in range `values` (a single row or column) and read
 * `result`; the results land in the column/row immediately after `values`.
 * Two-variable (`twoVar`): `input` varies across `values` (the block's top row) and `input2` across
 * `values2` (its left column); the grid is written at `output` (its top-left corner).
 */
export type WhatIfSpec = {
  /** Stable id (assigned on insert) so a table can be removed without reordering. */
  id: string
  /** A1 of the formula cell being observed. */
  result: string
  /** A1 of the (row) input cell substituted. */
  input: string
  /** A1 range of input values — a single row or column. */
  values: string
  twoVar?: boolean
  /** Two-variable: A1 of the column input cell. */
  input2?: string
  /** Two-variable: A1 range of the column-input values (a single row or column). */
  values2?: string
  /** Two-variable: A1 of the output block's top-left corner. */
  output?: string
}

/** Per-side cell borders (top/right/bottom/left). */
export type CellBorders = { t?: boolean; r?: boolean; b?: boolean; l?: boolean }

/** Normalise the `border` field to explicit sides. `true` → all four. */
export function borderSides(b: boolean | CellBorders | undefined): CellBorders {
  if (b === true) return { t: true, r: true, b: true, l: true }
  if (!b) return {}
  return b
}

/**
 * One conditional-format rule. Numeric ops (`>`,`<`,`=`) compare a numeric cell to
 * `value`; text ops (`contains`,`eqText`) match the cell's text (case-insensitive).
 * A matching cell takes the rule's `bg` fill.
 */
export type CondOp = '>' | '<' | '=' | 'contains' | 'eqText'
export type CondRule = { op: CondOp; value: number | string; bg?: string }

/** Legacy single-rule `cond` + the multi-rule `conds` → one ordered list. */
export function sheetConds(
  cond: CondRule | null | undefined,
  conds: CondRule[] | null | undefined,
): CondRule[] {
  if (conds && conds.length) return conds
  return cond ? [cond] : []
}

/** Does a cell value satisfy a rule? First-match wins in the list. */
export function matchesCond(rule: CondRule, value: unknown): boolean {
  if (rule.op === '>' || rule.op === '<' || rule.op === '=') {
    if (typeof value !== 'number') return false
    const n = typeof rule.value === 'number' ? rule.value : Number(rule.value)
    return rule.op === '>' ? value > n : rule.op === '<' ? value < n : value === n
  }
  const hay = String(value ?? '').toLowerCase()
  const needle = String(rule.value ?? '').toLowerCase()
  if (needle === '') return false
  return rule.op === 'contains' ? hay.includes(needle) : hay === needle
}

export type SheetData = {
  name: string
  /** Sparse: key is `${row},${col}`. Missing = empty cell. */
  cells: Record<string, Cell>
  rows: number
  cols: number
  /** Legacy single conditional rule — read for back-compat, superseded by `conds`. */
  cond?: CondRule
  /** Sheet-level conditional formatting rules, applied in order (first match wins). */
  conds?: CondRule[]
  /** Colour-scale / data-bar visuals over ranges. */
  scales?: ScaleRule[]
  /** Charts drawn from ranges of this sheet (#215). */
  charts?: ChartSpec[]
  /** Live what-if / sensitivity tables (#324) — derived output blocks, recomputed each recalc. */
  whatIfs?: WhatIfSpec[]
  /**
   * Per-column widths in BASE pixels — at zoom 1, keyed by 0-based column (#1353).
   *
   * Sparse and optional: a column with no entry uses the default, so every document written before
   * this reads back identically and nothing has to be migrated. In the DOCUMENT rather than in the
   * browser because a width is a property of the sheet — a colleague opening it must see the columns
   * the author sized, and a `.xlsx` carries them too.
   */
  colWidths?: Record<number, number>
  /**
   * Frozen panes, CARRIED BETWEEN A FILE AND THE STORE ONLY (#1507). `SheetStore.snapshot()` never
   * emits it — freeze lives in its own Y.Map precisely so it stays out of version hashing — so
   * import fills it, `replaceAll` stores it, and export is handed it beside the snapshot.
   * Absent = the file said nothing (CSV): the sheet keeps the header-row convention.
   */
  freeze?: { rows: number; cols: number }
  /** Merged ranges, in A1 (`B2:D4`). The top-left cell holds the value. */
  merges?: string[]
  /** Per-row heights in base pixels, sparse like colWidths. */
  rowHeights?: Record<number, number>
  hiddenRows?: number[]
  hiddenCols?: number[]
  /** The sheet reads right-to-left (Excel's "Sheet right-to-left"), as Arabic workbooks do. */
  rtl?: boolean
  showGrid?: boolean
  tabColor?: string
  /** Data validation lists and rules, by A1 range. */
  validations?: Validation[]
  /** The auto-filter range, if the sheet has one. */
  autoFilter?: string
  /** Pictures floating over the sheet. */
  images?: SheetImage[]
  /** How the sheet prints: what the file said, kept and written back, and used by the print preview. */
  print?: SheetPrint
  /** Sheet visibility. */
  hidden?: boolean
  /** Locked cells cannot be changed while this is set. */
  protect?: Protection
  /** Excel tables on this sheet. */
  tables?: SheetTable[]
  /**
   * The filter the FILE was saved with, by column: the values left visible. The
   * editor's own filters are a personal view (engine/filter.ts); this is what opens
   * applied, and what is written back.
   */
  savedFilter?: { col: number; keep: string[] }[]
}

/** The runs, if they still spell the cell's text — otherwise none. */
export function validRuns(fmt: CellFormat | undefined, text: string): TextRun[] | null {
  const r = fmt?.runs
  if (!r || r.length < 2) return null
  return r.map((x) => x.t).join('') === text ? r : null
}

export type Validation = {
  range: string
  kind: 'list' | 'whole' | 'decimal' | 'date' | 'textLength' | 'custom'
  /** For `list`: the options, or a range reference like `=$A$1:$A$5`. */
  list?: string[]
  source?: string
  op?: string
  f1?: string
  f2?: string
  allowBlank?: boolean
  prompt?: string
  error?: string
}

/**
 * A sheet's page setup. Margins in inches, as the file stores them. Header and footer are kept in
 * Excel's own code form (`&L…&C…&R…`, `&P` page, `&N` pages, `&D` date) so nothing in them is lost.
 */
export type SheetPrint = {
  margins?: { l: number; r: number; t: number; b: number; header: number; footer: number }
  landscape?: boolean
  /** Excel's paper code: 9 is A4, 1 Letter. */
  paper?: number
  /** Percent. Ignored when `fit` is on, as in Excel. */
  scale?: number
  /** Fit to this many pages wide / tall (0 = as many as it takes). */
  fit?: { w: number; h: number }
  header?: string
  footer?: string
  firstHeader?: string
  firstFooter?: string
  evenHeader?: string
  evenFooter?: string
  differentFirst?: boolean
  differentOddEven?: boolean
  gridLines?: boolean
  headings?: boolean
  centerH?: boolean
  centerV?: boolean
}

export type SheetImage = {
  id: string
  /** data: URL. */
  src: string
  anchor: { row: number; col: number; dx?: number; dy?: number }
  size: { w: number; h: number }
  alt?: string
}

/** A workbook-level name (`TaxRate` → `Settings!$B$2`). `sheet` scopes it to one sheet. */
export type DefinedName = { name: string; ref: string; sheet?: string }

/** The whole document as the editor stores it. */
export type WorkbookData = {
  sheets: SheetData[]
  /** Workbook structure protection: sheets cannot be added, removed, renamed or moved. */
  protect?: Protection
  names?: DefinedName[]
  /** Index of the sheet that was active when saved. */
  active?: number
}

/** Parse an A1 range like "A1:B6" (or a single "A1") to a normalised 0-based box. */
export function parseRange(range: string): { r0: number; c0: number; r1: number; c1: number } | null {
  const [a, b] = range.split(':')
  const p0 = parseA1(a ?? '')
  if (!p0) return null
  const p1 = b ? parseA1(b) : p0
  if (!p1) return null
  return {
    r0: Math.min(p0.row, p1.row),
    c0: Math.min(p0.col, p1.col),
    r1: Math.max(p0.row, p1.row),
    c1: Math.max(p0.col, p1.col),
  }
}

/**
 * Where an index lands when `delta` rows/columns are inserted (positive) or removed (negative) at
 * `at`. `null` means the index was inside the removed span — the thing it named is gone (#1341).
 */
export function movedIndex(idx: number, at: number, delta: number): number | null {
  if (delta > 0) return idx >= at ? idx + delta : idx
  const removed = -delta
  if (idx < at) return idx
  if (idx < at + removed) return null
  return idx - removed
}

/**
 * The same, for a SPAN — and it is a different rule, not a pair of `movedIndex` calls.
 *
 * Deleting a row inside `SUM(B2:B3)` must NARROW it to `SUM(B2:B2)`, which is what Excel does and
 * what anybody deleting a line from a budget expects. Treating the endpoints independently makes
 * the deleted one `#REF!` and breaks the total instead — technically defensible, useless in
 * practice, and the commonest structural edit there is.
 *
 * `null` only when the span is entirely inside the removal, which is the one case where there
 * genuinely is nothing left to point at.
 */
export function movedSpan(lo: number, hi: number, at: number, delta: number): { lo: number; hi: number } | null {
  if (delta > 0) return { lo: lo >= at ? lo + delta : lo, hi: hi >= at ? hi + delta : hi }
  const n = -delta
  const nlo = lo < at ? lo : lo >= at + n ? lo - n : at
  const nhi = hi < at ? hi : hi >= at + n ? hi - n : at - 1
  return nhi < nlo ? null : { lo: nlo, hi: nhi }
}

export const cellKey = (row: number, col: number) => `${row},${col}`

// ---- A1 addressing ---------------------------------------------------------

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function colToLetters(col: number): string {
  let s = ''
  let n = col
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

/** "A" → 0, "AA" → 26. */
export function lettersToCol(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export type Addr = { row: number; col: number }

/** Parse "A1" / "$A$1" (0-based). Returns null if not a cell reference. */
export function parseA1(ref: string): Addr | null {
  const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(ref.trim())
  if (!m) return null
  return { col: lettersToCol(m[1]), row: parseInt(m[2], 10) - 1 }
}

export const toA1 = (a: Addr) => `${colToLetters(a.col)}${a.row + 1}`
