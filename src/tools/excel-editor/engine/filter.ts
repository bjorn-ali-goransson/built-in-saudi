import type { SheetData } from './model'

/**
 * FILTER ROWS BY VALUE — and the decision that shapes everything else: **it is a VIEW, not an edit**.
 *
 * Sorting rewrites the document; filtering hides rows and touches nothing. That difference decides
 * three things:
 *
 *  1. **Nothing is deleted.** A filtered-out row is still in the sheet, still in the file, still
 *     counted by `SUM`. A filter that removed rows would be a data-loss feature wearing a funnel.
 *  2. **It belongs to the PERSON, not the document.** A shared filter would yank rows out from
 *     under a collaborator mid-sentence, and the rows are still there for them anyway. Same call
 *     the live-sheet what-ifs make (`sheetEmbed.ts`): a way of looking is not a change to the data.
 *  3. **It has to be OBVIOUS.** The one real danger of a filter is forgetting it is on and
 *     concluding the data is gone, so the row numbers keep their original values — the gaps are the
 *     tell — and the status bar says how many rows are hidden with one click to clear it.
 */

/** A column's filter: the set of values that stay VISIBLE. An absent entry means "no filter". */
export type ColumnFilter = { col: number; keep: string[] }
export type SheetFilters = ColumnFilter[]

/** How a value is keyed for matching — the DISPLAYED text, which is what the person ticked. */
export const filterKey = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/**
 * The distinct values in a column, in the order they first appear, with blanks folded into one
 * entry. First-seen order rather than sorted: the list reads like the column it came from, and a
 * person scanning for "the one that says Cancelled" finds it where they remember seeing it.
 */
export function distinctValues(
  sheet: SheetData,
  col: number,
  value: (row: number, col: number) => unknown,
  headerRows = 1,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const last = lastRowWithData(sheet)
  for (let r = headerRows; r <= last; r++) {
    const key = filterKey(value(r, col))
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

/** The last row holding anything — the rows below it are empty and are never filtered away. */
export function lastRowWithData(sheet: SheetData): number {
  let last = -1
  for (const key of Object.keys(sheet.cells)) {
    const r = Number(key.split(',')[0])
    if (Number.isFinite(r) && (sheet.cells[key]?.input ?? '') !== '' && r > last) last = r
  }
  return last
}

/**
 * Which rows are hidden. Every filter must pass — several columns filtered at once narrow each
 * other, which is what a person expects and what every spreadsheet does.
 *
 * The HEADER is never hidden, and neither are the empty rows past the data: hiding the blank space
 * under a filtered sheet would make the grid end abruptly at the last match, with nowhere to type.
 */
export function hiddenRows(
  sheet: SheetData,
  filters: SheetFilters,
  value: (row: number, col: number) => unknown,
  headerRows = 1,
): Set<number> {
  const hidden = new Set<number>()
  const active = filters.filter((f) => f.keep.length > 0)
  if (!active.length) return hidden
  const last = lastRowWithData(sheet)
  for (let r = headerRows; r <= last; r++) {
    const keep = active.every((f) => f.keep.includes(filterKey(value(r, f.col))))
    if (!keep) hidden.add(r)
  }
  return hidden
}

/** Is this column filtered? — what the funnel on the header reads from. */
export const isFiltered = (filters: SheetFilters, col: number): boolean =>
  filters.some((f) => f.col === col && f.keep.length > 0)

/** Set (or clear, with null) one column's filter, leaving the others alone. */
export function withFilter(filters: SheetFilters, col: number, keep: string[] | null): SheetFilters {
  const rest = filters.filter((f) => f.col !== col)
  return keep && keep.length ? [...rest, { col, keep }] : rest
}

/**
 * A filter's values can go stale — somebody edits a cell to a value nothing kept, or deletes the
 * row entirely. The filter is NOT repaired here: a value that no longer exists simply matches
 * nothing, which is correct, and silently widening a filter because the data changed would be a
 * filter that quietly stops filtering.
 */
export function filteredCount(hidden: Set<number>): number {
  return hidden.size
}

/** The key a person's filters are remembered under — per document AND per sheet. */
export const filterStoreKey = (docId: string, sheet: string): string => `kafani:tables-filter:${docId}:${sheet}`

/** Read a remembered filter, tolerating anything at all in the store. */
export function readFilters(raw: string | null): SheetFilters {
  try {
    const parsed = JSON.parse(raw ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((f) => {
      const o = f as ColumnFilter
      if (typeof o?.col !== 'number' || !Array.isArray(o?.keep)) return []
      return [{ col: o.col, keep: o.keep.filter((k): k is string => typeof k === 'string') }]
    })
  } catch {
    return []
  }
}
