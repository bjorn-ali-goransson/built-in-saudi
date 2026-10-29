import { shiftFormula } from './formula'
import { cellKey, type SheetData } from './model'

/**
 * SORT A COLUMN — A→Z and Z→A, with the header row staying put.
 *
 * ## It moves whole ROWS, and there is no option not to
 *
 * Sorting the selected column's cells on their own would leave every other column where it was:
 * names against the wrong amounts, with the sheet still looking perfectly ordinary. Excel puts a
 * warning dialog in front of that choice; we simply do not offer it. A sort reorders rows.
 *
 * ## Row 0 is the header
 *
 * The grid already renders the first row bold as a header, and that is the row a person means when
 * they say "keep the header in place". A sheet whose first row is data loses one row from the sort,
 * which is visible and undoable — the opposite mistake (sorting the header into the middle of the
 * data) looks like corruption.
 *
 * ## The order
 *
 * Numbers before text, text compared with a locale-aware collator so Arabic sorts as Arabic and
 * case does not decide, then booleans and errors, and **blanks always last** — in BOTH directions.
 * A Z→A that floats every empty row to the top has buried the data under the emptiness, which is
 * never what the person pressing it wanted, and Excel agrees.
 */
export type SortDir = 'asc' | 'desc'

/** Where a value sits in the type order — the first key of the comparison. */
function rank(v: unknown): number {
  if (v === null || v === undefined || v === '') return 4 // blanks, always last
  if (typeof v === 'number' && Number.isFinite(v)) return 0
  if (typeof v === 'string') return 1
  if (typeof v === 'boolean') return 2
  return 3 // errors and anything else
}

const collator = new Intl.Collator(['ar', 'en'], { numeric: true, sensitivity: 'base' })

/** Compare two sort keys. Blanks are handled by the caller, which keeps them last either way. */
export function compareValues(a: unknown, b: unknown): number {
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if (ra === 0) return (a as number) - (b as number)
  if (ra === 1) return collator.compare(String(a), String(b))
  if (ra === 2) return Number(a) - Number(b)
  return String(a).localeCompare(String(b))
}

/**
 * The row order a sort produces: the indices of `keys`, sorted.
 *
 * Separated from the sheet so the ORDER can be tested without building one, and STABLE — two rows
 * with the same key keep the order they were in, so sorting by one column and then another is the
 * two-level sort people expect rather than a reshuffle.
 */
export function sortedOrder(keys: readonly unknown[], dir: SortDir): number[] {
  const blanks: number[] = []
  const filled: number[] = []
  keys.forEach((k, i) => (rank(k) === 4 ? blanks : filled).push(i))
  filled.sort((i, j) => {
    const c = compareValues(keys[i], keys[j])
    if (c !== 0) return dir === 'asc' ? c : -c
    return i - j // stable: equal keys keep their original order, in both directions
  })
  return [...filled, ...blanks]
}

/** The last row holding anything at all — the sort must not shuffle the empty rows below it. */
export function lastUsedRow(sheet: SheetData): number {
  let last = -1
  for (const key of Object.keys(sheet.cells)) {
    const r = Number(key.split(',')[0])
    const cell = sheet.cells[key]
    if (Number.isFinite(r) && (cell?.input ?? '') !== '' && r > last) last = r
  }
  return last
}

/**
 * Sort a sheet's rows by one column.
 *
 * `values` answers what each row's key IS — the DISPLAYED value, so a formula sorts by what it
 * computes rather than by the text "=B2*C2". The caller passes it in because the evaluated
 * workbook lives outside this module, which keeps this pure and testable.
 */
export function sortSheetRows(
  sheet: SheetData,
  col: number,
  dir: SortDir,
  values: (row: number, col: number) => unknown,
  headerRows = 1,
): SheetData {
  const last = lastUsedRow(sheet)
  const first = headerRows
  // Nothing to do: no data, or a single row under the header.
  if (last <= first) return sheet

  const rows: number[] = []
  for (let r = first; r <= last; r++) rows.push(r)
  const order = sortedOrder(
    rows.map((r) => values(r, col)),
    dir,
  ).map((i) => rows[i])

  // Unchanged order → unchanged sheet, so an idle sort does not churn the document for everyone.
  if (order.every((r, i) => r === rows[i])) return sheet

  const cells: SheetData['cells'] = {}
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [r, c] = key.split(',').map(Number)
    // Outside the sorted span (the header, or anything below the last used row) — untouched.
    if (r < first || r > last) {
      cells[key] = cell
      continue
    }
    const to = first + order.indexOf(r)
    /**
     * The row's formulas move WITH it, exactly as they do when a row is cut and pasted — a
     * `=B4*C4` that lands on row 7 becomes `=B7*C7`. Without this the sheet still looks right and
     * every total is now the total of different rows, which is the silent shape this whole editor's
     * tests exist to catch.
     */
    cells[cellKey(to, c)] = { ...cell, input: shiftFormula(cell.input ?? '', to - r, 0) }
  }
  return { ...sheet, cells }
}
