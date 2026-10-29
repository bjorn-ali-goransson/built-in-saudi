import { describe, expect, it } from 'vitest'
import { compareValues, lastUsedRow, sortSheetRows, sortedOrder } from './sort'
import { cellKey, type SheetData } from './model'

/**
 * SORT. The dangerous half is not the ordering — it is everything that has to travel WITH a row:
 * the other columns, each cell's formatting, and its formulas. A sort that reorders one column and
 * leaves the rest is the classic spreadsheet disaster, and the sheet looks perfectly ordinary
 * afterwards.
 */
describe('sortedOrder', () => {
  it('puts numbers in order, ascending and descending', () => {
    expect(sortedOrder([3, 1, 2], 'asc')).toEqual([1, 2, 0])
    expect(sortedOrder([3, 1, 2], 'desc')).toEqual([0, 2, 1])
  })

  it('sorts text without case deciding it', () => {
    expect(sortedOrder(['banana', 'Apple', 'cherry'], 'asc')).toEqual([1, 0, 2])
  })

  /** Arabic must sort as Arabic, not by code point — a collator, not `<`. */
  it('sorts Arabic in Arabic order', () => {
    const words = ['ثالث', 'أول', 'ثاني']
    const order = sortedOrder(words, 'asc').map((i) => words[i])
    expect(order[0], 'Arabic sorted by code point rather than by the language').toBe('أول')
  })

  it('puts numbers before text', () => {
    const keys = ['apple', 7, 'banana', 2]
    expect(sortedOrder(keys, 'asc').map((i) => keys[i])).toEqual([2, 7, 'apple', 'banana'])
  })

  /**
   * BLANKS LAST IN BOTH DIRECTIONS. A Z→A that floats every empty row to the top has buried the
   * data under the emptiness — never what the person pressing it wanted.
   */
  it('keeps blanks last whichever way it sorts', () => {
    const keys = ['b', '', 'a', null]
    expect(sortedOrder(keys, 'asc')).toEqual([2, 0, 1, 3])
    expect(sortedOrder(keys, 'desc')).toEqual([0, 2, 1, 3])
  })

  /** Stable: equal keys keep their order, which is what makes a two-column sort work. */
  it('is stable for equal keys, in both directions', () => {
    expect(sortedOrder([5, 5, 5], 'asc')).toEqual([0, 1, 2])
    expect(sortedOrder([5, 5, 5], 'desc')).toEqual([0, 1, 2])
  })
})

describe('compareValues', () => {
  it('ranks by type first: numbers, then text, then booleans, then errors', () => {
    expect(compareValues(1, 'a')).toBeLessThan(0)
    expect(compareValues('a', true)).toBeLessThan(0)
    expect(compareValues(true, { toString: () => '#REF!' })).toBeLessThan(0)
  })
})

/** A small sheet: a header, three rows, formatting and a formula that must travel with its row. */
function sheet(): SheetData {
  const cells: SheetData['cells'] = {
    [cellKey(0, 0)]: { input: 'Item' },
    [cellKey(0, 1)]: { input: 'Qty' },
    [cellKey(1, 0)]: { input: 'Cherry', fmt: { bold: true } },
    [cellKey(1, 1)]: { input: '3' },
    [cellKey(1, 2)]: { input: '=B2*2' },
    [cellKey(2, 0)]: { input: 'Apple', fmt: { italic: true } },
    [cellKey(2, 1)]: { input: '1' },
    [cellKey(2, 2)]: { input: '=B3*2' },
    [cellKey(3, 0)]: { input: 'Banana' },
    [cellKey(3, 1)]: { input: '2' },
    [cellKey(3, 2)]: { input: '=B4*2' },
  }
  return { name: 'S', rows: 10, cols: 4, cells }
}

/** The key for a row is its DISPLAYED value — a formula sorts by what it computes. */
const byInput = (s: SheetData) => (r: number, c: number) => {
  const raw = s.cells[cellKey(r, c)]?.input ?? ''
  const n = Number(raw)
  return raw !== '' && Number.isFinite(n) ? n : raw
}

describe('sortSheetRows', () => {
  it('leaves the header row exactly where it is', () => {
    const out = sortSheetRows(sheet(), 0, 'asc', byInput(sheet()))
    expect(out.cells[cellKey(0, 0)].input, 'the header was sorted into the data').toBe('Item')
    expect(out.cells[cellKey(0, 1)].input).toBe('Qty')
  })

  it('moves the WHOLE row, not just the sorted column', () => {
    const out = sortSheetRows(sheet(), 0, 'asc', byInput(sheet()))
    // Apple(1), Banana(2), Cherry(3) — each with its own quantity still beside it.
    expect([1, 2, 3].map((r) => out.cells[cellKey(r, 0)].input)).toEqual(['Apple', 'Banana', 'Cherry'])
    expect([1, 2, 3].map((r) => out.cells[cellKey(r, 1)].input), 'a row lost its own data').toEqual(['1', '2', '3'])
  })

  it('carries each cell’s formatting with its row', () => {
    const out = sortSheetRows(sheet(), 0, 'asc', byInput(sheet()))
    expect(out.cells[cellKey(1, 0)].fmt?.italic, 'the formatting stayed behind on the old row').toBe(true)
    expect(out.cells[cellKey(3, 0)].fmt?.bold).toBe(true)
  })

  /**
   * THE SILENT ONE. A formula left pointing at its old row still computes — the sheet looks right
   * and every total is the total of a different line.
   */
  it('rewrites a moved row’s formulas so they still point at their own row', () => {
    const out = sortSheetRows(sheet(), 0, 'asc', byInput(sheet()))
    expect(out.cells[cellKey(1, 2)].input, 'the formula did not follow its row').toBe('=B2*2')
    expect(out.cells[cellKey(2, 2)].input).toBe('=B3*2')
    expect(out.cells[cellKey(3, 2)].input).toBe('=B4*2')
  })

  it('sorts the other way too', () => {
    const out = sortSheetRows(sheet(), 0, 'desc', byInput(sheet()))
    expect([1, 2, 3].map((r) => out.cells[cellKey(r, 0)].input)).toEqual(['Cherry', 'Banana', 'Apple'])
  })

  it('sorts by any column, not only the first', () => {
    const out = sortSheetRows(sheet(), 1, 'desc', byInput(sheet()))
    expect([1, 2, 3].map((r) => out.cells[cellKey(r, 1)].input)).toEqual(['3', '2', '1'])
  })

  /** An unchanged order must not churn the document — everyone else gets that update too. */
  it('returns the same sheet when nothing moves', () => {
    const s = sortSheetRows(sheet(), 0, 'asc', byInput(sheet()))
    expect(sortSheetRows(s, 0, 'asc', byInput(s))).toBe(s)
  })

  it('does nothing on a sheet with only a header, or nothing at all', () => {
    const bare: SheetData = { name: 'S', rows: 5, cols: 3, cells: { [cellKey(0, 0)]: { input: 'Item' } } }
    expect(sortSheetRows(bare, 0, 'asc', byInput(bare))).toBe(bare)
    const empty: SheetData = { name: 'S', rows: 5, cols: 3, cells: {} }
    expect(sortSheetRows(empty, 0, 'asc', byInput(empty))).toBe(empty)
  })
})

describe('lastUsedRow', () => {
  it('ignores the empty rows below the data, so they are not shuffled into it', () => {
    expect(lastUsedRow(sheet())).toBe(3)
  })

  it('answers -1 for an empty sheet', () => {
    expect(lastUsedRow({ name: 'S', rows: 5, cols: 3, cells: {} })).toBe(-1)
  })
})
