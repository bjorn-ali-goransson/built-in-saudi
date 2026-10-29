/**
 * INSERTING AND DELETING ROWS AND COLUMNS (#1341).
 *
 * The product had no way to do either. A sheet was created at a fixed 24×8 and nothing ever changed
 * those two numbers — the Insert ribbon offers a sheet, a chart and three cell controls, and no
 * row. So a customer who imported a 24-row budget and wanted a 25th line could not have one, which
 * is a wall you hit within a minute of real use.
 *
 * Everything here is PURE — sheets in, sheets out. The Yjs store and the UI sit on top; keeping the
 * arithmetic out of both is what lets the awkward cases (a formula on another sheet, a chart's
 * range, a deleted reference) be tested without a browser or a document.
 *
 * WHAT MOVES, AND WHY EACH ONE MATTERS
 *
 *  - the CELLS, by their key;
 *  - the sheet's row/column COUNT, or the grid paints the old shape;
 *  - every FORMULA on EVERY sheet, via `adjustRefsForStructure` — a formula in Summary that reads
 *    `Budget!B5` has to follow Budget's row down, and the same formula must not move when some
 *    other sheet changes;
 *  - the range-shaped extras that would otherwise keep pointing at rows that have moved out from
 *    under them: colour SCALES (a numeric box), CHARTS (an A1 range plus a cell anchor) and
 *    WHAT-IF blocks (several A1 addresses). These are cheap to carry and expensive to notice: a
 *    chart quietly plotting the wrong rows looks like a data problem, not a bug in insert.
 */
import { adjustRefsForStructure } from './formula'
import { cellKey, colToLetters, movedIndex, movedSpan, parseA1, parseRange, type SheetData } from './model'

export type Axis = 'row' | 'col'

/** Both shared with the formula rewriter, so a range on a chart and a range in a formula cannot
 *  disagree about where a row went — the kind of drift that shows up as a chart plotting one set of
 *  rows while the total beside it sums another. */
const moved = movedIndex

const a1 = (row: number, col: number) => `${colToLetters(col)}${row + 1}`

function movedA1(ref: string, axis: Axis, at: number, delta: number): string | null {
  const p = parseA1(ref)
  if (!p) return ref
  const m = moved(axis === 'row' ? p.row : p.col, at, delta)
  if (m === null) return null
  return axis === 'row' ? a1(m, p.col) : a1(p.row, m)
}

function movedA1Range(range: string, axis: Axis, at: number, delta: number): string | null {
  const b = parseRange(range)
  if (!b) return range
  const span = axis === 'row' ? movedSpan(b.r0, b.r1, at, delta) : movedSpan(b.c0, b.c1, at, delta)
  if (!span) return null // the whole range was deleted
  return axis === 'row' ? `${a1(span.lo, b.c0)}:${a1(span.hi, b.c1)}` : `${a1(b.r0, span.lo)}:${a1(b.r1, span.hi)}`
}

/**
 * Apply an insert (`delta > 0`) or delete (`delta < 0`) of rows/columns at `at` on `target`.
 *
 * Returns a NEW array; nothing is mutated, so a caller can diff or discard it. Sheets other than the
 * target keep their cells and only have their formulas rewritten.
 */
export function applyStructuralChange(
  sheets: SheetData[],
  target: string,
  axis: Axis,
  at: number,
  delta: number,
): SheetData[] {
  if (delta === 0 || at < 0) return sheets
  return sheets.map((sheet) => {
    const isTarget = sheet.name === target
    const cells: SheetData['cells'] = {}
    for (const [key, cell] of Object.entries(sheet.cells)) {
      const [r, c] = key.split(',').map(Number)
      let row = r
      let col = c
      if (isTarget) {
        const m = moved(axis === 'row' ? r : c, at, delta)
        if (m === null) continue // this cell was in the deleted span
        if (axis === 'row') row = m
        else col = m
      }
      const input = adjustRefsForStructure(cell.input ?? '', {
        formulaSheet: sheet.name,
        targetSheet: target,
        axis,
        at,
        delta,
      })
      cells[cellKey(row, col)] = input === cell.input ? cell : { ...cell, input }
    }

    if (!isTarget) return { ...sheet, cells }

    // A sheet never shrinks below something usable — deleting every row must not leave a grid with
    // nothing to click on, which would be a dead end rather than an empty sheet.
    const grown = (n: number) => Math.max(1, n + delta)
    const out: SheetData = {
      ...sheet,
      cells,
      rows: axis === 'row' ? grown(sheet.rows) : sheet.rows,
      cols: axis === 'col' ? grown(sheet.cols) : sheet.cols,
    }

    if (sheet.scales?.length) {
      out.scales = sheet.scales.flatMap((s) => {
        const span = axis === 'row' ? movedSpan(s.box.r0, s.box.r1, at, delta) : movedSpan(s.box.c0, s.box.c1, at, delta)
        if (!span) return []
        const box = axis === 'row' ? { ...s.box, r0: span.lo, r1: span.hi } : { ...s.box, c0: span.lo, c1: span.hi }
        return [{ ...s, box }]
      })
    }

    if (sheet.charts?.length) {
      out.charts = sheet.charts.flatMap((ch) => {
        const range = movedA1Range(ch.range, axis, at, delta)
        if (range === null) return [] // its data is gone; a chart of nothing is worse than no chart
        const anchor = ch.anchor
          ? (() => {
              const m = moved(axis === 'row' ? ch.anchor.row : ch.anchor.col, at, delta)
              if (m === null) return undefined // it was pinned to a deleted row — fall back to derived
              return axis === 'row' ? { ...ch.anchor, row: m } : { ...ch.anchor, col: m }
            })()
          : undefined
        return [{ ...ch, range, ...(anchor ? { anchor } : {}) }]
      })
    }

    /**
     * COLUMN WIDTHS MOVE WITH THEIR COLUMNS (#1353). Insert a column and every width after it belongs
     * one column further along; leave them behind and the sheet silently re-sizes the wrong columns,
     * which reads as the insert having corrupted the layout.
     */
    if (axis === 'col' && sheet.colWidths && Object.keys(sheet.colWidths).length) {
      const next: Record<number, number> = {}
      for (const [key, px] of Object.entries(sheet.colWidths)) {
        const moved = movedIndex(Number(key), at, delta)
        if (moved !== null) next[moved] = px // a deleted column takes its width with it
      }
      out.colWidths = next
    }

    if (sheet.whatIfs?.length) {
      out.whatIfs = sheet.whatIfs.flatMap((w) => {
        const result = movedA1(w.result, axis, at, delta)
        const input = movedA1(w.input, axis, at, delta)
        const values = movedA1Range(w.values, axis, at, delta)
        // A what-if block whose formula, input or value range was deleted has nothing left to
        // compute. Dropping it beats leaving a live overlay pointed at the wrong cells.
        if (result === null || input === null || values === null) return []
        const input2 = w.input2 ? movedA1(w.input2, axis, at, delta) : undefined
        const values2 = w.values2 ? movedA1Range(w.values2, axis, at, delta) : undefined
        if (input2 === null || values2 === null) return []
        return [{ ...w, result, input, values, ...(input2 ? { input2 } : {}), ...(values2 ? { values2 } : {}) }]
      })
    }

    return out
  })
}
