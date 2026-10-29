import { describe, expect, it } from 'vitest'
import { cellKey, type SheetData } from './model'
import { distinctValues, hiddenRows, isFiltered, readFilters, withFilter } from './filter'

/**
 * A filter HIDES rows; it never removes them. These hold that line, and the cases where a filter
 * quietly does the wrong thing: hiding the header, hiding the empty space a person types into, or
 * widening itself because the data changed under it.
 */
function sheet(): SheetData {
  const rows: [string, string][] = [
    ['Item', 'Status'],
    ['Cherry', 'Open'],
    ['Apple', 'Done'],
    ['Banana', 'Open'],
    ['Damson', ''],
  ]
  const cells: SheetData['cells'] = {}
  rows.forEach(([a, b], r) => {
    cells[cellKey(r, 0)] = { input: a }
    if (b) cells[cellKey(r, 1)] = { input: b }
  })
  return { name: 'S', rows: 20, cols: 4, cells }
}
const val = (s: SheetData) => (r: number, c: number) => s.cells[cellKey(r, c)]?.input ?? ''

describe('distinctValues', () => {
  it('lists each value once, in the order the column shows them', () => {
    const s = sheet()
    expect(distinctValues(s, 1, val(s))).toEqual(['Open', 'Done', ''])
  })

  it('folds every blank into one entry', () => {
    const s = sheet()
    s.cells[cellKey(2, 1)] = { input: '' }
    expect(distinctValues(s, 1, val(s)).filter((v) => v === '')).toHaveLength(1)
  })
})

describe('hiddenRows', () => {
  it('hides the rows whose value was not kept', () => {
    const s = sheet()
    expect([...hiddenRows(s, [{ col: 1, keep: ['Open'] }], val(s))].sort()).toEqual([2, 4])
  })

  /** THE HEADER IS NEVER HIDDEN — a filtered sheet with no header is a sheet nobody can read. */
  it('never hides the header row', () => {
    const s = sheet()
    expect(hiddenRows(s, [{ col: 1, keep: ['Done'] }], val(s)).has(0)).toBe(false)
  })

  /** Nor the empty space below the data, or the grid would end at the last match. */
  it('leaves the empty rows below the data alone', () => {
    const s = sheet()
    const hidden = hiddenRows(s, [{ col: 1, keep: ['Open'] }], val(s))
    expect(hidden.has(9), 'an empty row past the data was hidden').toBe(false)
  })

  it('narrows when two columns are filtered at once', () => {
    const s = sheet()
    const both = hiddenRows(s, [{ col: 1, keep: ['Open'] }, { col: 0, keep: ['Cherry'] }], val(s))
    expect([...both].sort()).toEqual([2, 3, 4])
  })

  it('hides nothing when no filter is set, or a filter keeps nothing', () => {
    const s = sheet()
    expect(hiddenRows(s, [], val(s)).size).toBe(0)
    expect(hiddenRows(s, [{ col: 1, keep: [] }], val(s)).size).toBe(0)
  })

  /**
   * A value that no longer exists matches NOTHING, and that is correct: a filter that widened
   * itself because the data changed would be a filter that quietly stops filtering.
   */
  it('does not widen itself when the data moves on', () => {
    const s = sheet()
    expect(hiddenRows(s, [{ col: 1, keep: ['Blocked'] }], val(s)).size).toBe(4)
  })

  it('can keep the blanks, when that is what was ticked', () => {
    const s = sheet()
    expect([...hiddenRows(s, [{ col: 1, keep: [''] }], val(s))].sort()).toEqual([1, 2, 3])
  })
})

describe('withFilter', () => {
  it('sets, replaces and clears one column without touching the others', () => {
    let f = withFilter([], 1, ['Open'])
    expect(isFiltered(f, 1)).toBe(true)
    f = withFilter(f, 0, ['Cherry'])
    expect(f).toHaveLength(2)
    f = withFilter(f, 1, null)
    expect(isFiltered(f, 1)).toBe(false)
    expect(isFiltered(f, 0), 'clearing one column cleared another').toBe(true)
  })

  it('treats an empty selection as no filter, rather than "hide everything"', () => {
    expect(withFilter([], 1, [])).toEqual([])
  })
})

describe('readFilters', () => {
  it('reads what it wrote', () => {
    const f = withFilter([], 2, ['a', 'b'])
    expect(readFilters(JSON.stringify(f))).toEqual(f)
  })

  /** It comes from a browser store, so it can be anything at all. */
  it('survives rubbish without throwing', () => {
    expect(readFilters(null)).toEqual([])
    expect(readFilters('not json')).toEqual([])
    expect(readFilters('{"col":1}')).toEqual([])
    expect(readFilters('[{"col":"x","keep":[]},{"col":1,"keep":["a",5]}]')).toEqual([{ col: 1, keep: ['a'] }])
  })
})
