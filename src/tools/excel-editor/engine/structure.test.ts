import { describe, expect, it } from 'vitest'
import { Workbook, displayValue } from './engine'
import { cellKey, parseA1, type SheetData } from './model'
import { applyStructuralChange } from './structure'

function sheet(name: string, cells: Record<string, string>, rows = 24, cols = 8): SheetData {
  const c: SheetData['cells'] = {}
  for (const [ref, input] of Object.entries(cells)) {
    const a = parseA1(ref)!
    c[`${a.row},${a.col}`] = { input }
  }
  return { name, cells: c, rows, cols }
}
const at = (s: SheetData, ref: string) => {
  const a = parseA1(ref)!
  return s.cells[cellKey(a.row, a.col)]?.input ?? ''
}
const by = (sheets: SheetData[], name: string) => sheets.find((s) => s.name === name)!
const value = (sheets: SheetData[], name: string, ref: string) =>
  displayValue(new Workbook(sheets).value(name, parseA1(ref)!))

/** A budget with a total, so a structural change has something that must stay correct. */
const budget = () =>
  sheet('Budget', { A1: 'Item', B1: 'Net', A2: 'Laptops', B2: '12600', A3: 'Desks', B3: '4250', B4: '=SUM(B2:B3)' })

describe('inserting a row', () => {
  it('moves the rows below down and leaves the ones above', () => {
    const [s] = applyStructuralChange([budget()], 'Budget', 'row', 2, 1)
    expect(at(s, 'A2'), 'the row above the insertion moved').toBe('Laptops')
    expect(at(s, 'A3'), 'the inserted row is not empty').toBe('')
    expect(at(s, 'A4')).toBe('Desks')
  })

  it('grows the sheet, or the new row has nowhere to be painted', () => {
    const [s] = applyStructuralChange([budget()], 'Budget', 'row', 2, 1)
    expect(s.rows).toBe(25)
  })

  /** The assertion the whole feature turns on: the total must still total the same things. */
  it('keeps the total correct after a row is inserted inside its range', () => {
    const before = value([budget()], 'Budget', 'B4')
    expect(before).toBe('16850')

    const after = applyStructuralChange([budget()], 'Budget', 'row', 2, 1)
    // The formula moved down with its row, and its range grew to cover the gap.
    expect(at(by(after, 'Budget'), 'B5')).toBe('=SUM(B2:B4)')
    expect(value(after, 'Budget', 'B5'), 'the total changed when a blank row was inserted').toBe('16850')
  })

  it('leaves a formula that reads the new blank row still adding up', () => {
    const after = applyStructuralChange([budget()], 'Budget', 'row', 2, 1)
    const withValue = after.map((s) =>
      s.name === 'Budget' ? { ...s, cells: { ...s.cells, [cellKey(2, 1)]: { input: '1000' } } } : s,
    )
    expect(value(withValue, 'Budget', 'B5'), 'a value typed into the inserted row is not counted').toBe('17850')
  })
})

describe('deleting a row', () => {
  it('removes its cells and pulls the rest up', () => {
    const [s] = applyStructuralChange([budget()], 'Budget', 'row', 1, -1) // delete row 2 (Laptops)
    expect(at(s, 'A2')).toBe('Desks')
    expect(s.rows).toBe(23)
  })

  it('keeps the total correct over what is left', () => {
    const after = applyStructuralChange([budget()], 'Budget', 'row', 1, -1)
    expect(value(after, 'Budget', 'B3'), 'the total did not follow the rows it sums').toBe('4250')
  })

  it('never shrinks a sheet out of existence', () => {
    const [s] = applyStructuralChange([budget()], 'Budget', 'row', 0, -99)
    expect(s.rows).toBeGreaterThanOrEqual(1)
  })
})

describe('columns', () => {
  it('moves cells sideways and widens the sheet', () => {
    const s0 = sheet('S', { A1: 'a', B1: 'b', C1: '=A1&B1' })
    const [s] = applyStructuralChange([s0], 'S', 'col', 1, 1)
    expect(at(s, 'A1')).toBe('a')
    expect(at(s, 'C1')).toBe('b')
    expect(at(s, 'D1')).toBe('=A1&C1')
    expect(s.cols).toBe(9)
  })
})

/**
 * THE CASE THAT MAKES THIS DANGEROUS IF GOT WRONG. Another sheet's formulas point INTO the one that
 * changed shape, and they have to follow — while their own cells stay exactly where they are.
 */
describe('other sheets', () => {
  const book = () => [budget(), sheet('Summary', { A1: 'Total', B1: '=Budget!B4', B2: '=A1' })]

  it('follows a reference into the sheet that changed', () => {
    const after = applyStructuralChange(book(), 'Budget', 'row', 2, 1)
    expect(at(by(after, 'Summary'), 'B1')).toBe('=Budget!B5')
    expect(value(after, 'Summary', 'B1'), 'the summary stopped reading the budget total').toBe('16850')
  })

  it('does not move the other sheet’s own cells or its own references', () => {
    const after = applyStructuralChange(book(), 'Budget', 'row', 2, 1)
    const sum = by(after, 'Summary')
    expect(at(sum, 'A1'), 'a bystander sheet had its cells moved').toBe('Total')
    expect(at(sum, 'B2'), 'a bystander sheet had its own reference rewritten').toBe('=A1')
    expect(sum.rows, 'a bystander sheet was resized').toBe(24)
  })
})

describe('the things that quietly point at ranges', () => {
  it('moves a chart’s range and its anchor', () => {
    const s0: SheetData = { ...budget(), charts: [{ id: 'c1', kind: 'bar', range: 'A2:B3', anchor: { row: 5, col: 0 } }] }
    const [s] = applyStructuralChange([s0], 'Budget', 'row', 0, 1)
    expect(s.charts![0].range, 'the chart kept plotting the rows that moved out from under it').toBe('A3:B4')
    expect(s.charts![0].anchor).toEqual({ row: 6, col: 0 })
  })

  it('grows a chart’s range when a row is inserted inside it', () => {
    const s0: SheetData = { ...budget(), charts: [{ id: 'c1', kind: 'bar', range: 'A2:B4' }] }
    const [s] = applyStructuralChange([s0], 'Budget', 'row', 2, 1)
    expect(s.charts![0].range).toBe('A2:B5')
  })

  it('drops a chart whose data was entirely deleted, rather than leaving it pointed at nothing', () => {
    const s0: SheetData = { ...budget(), charts: [{ id: 'c1', kind: 'bar', range: 'A2:B3' }] }
    const [s] = applyStructuralChange([s0], 'Budget', 'row', 1, -2)
    expect(s.charts).toEqual([])
  })

  it('moves a colour scale’s box', () => {
    const s0: SheetData = { ...budget(), scales: [{ box: { r0: 1, c0: 0, r1: 2, c1: 1 }, kind: 'scale3' }] }
    const [s] = applyStructuralChange([s0], 'Budget', 'row', 0, 1)
    expect(s.scales![0].box).toEqual({ r0: 2, c0: 0, r1: 3, c1: 1 })
  })
})

describe('column widths', () => {
  it('moves a width along with its column when one is inserted before it', () => {
    const s0: SheetData = { ...budget(), colWidths: { 0: 200, 1: 90 } }
    const [s] = applyStructuralChange([s0], 'Budget', 'col', 0, 1)
    // Both columns moved one along, so both widths did.
    expect(s.colWidths).toEqual({ 1: 200, 2: 90 })
  })

  it('leaves widths before the insertion where they are', () => {
    const s0: SheetData = { ...budget(), colWidths: { 0: 200, 3: 90 } }
    const [s] = applyStructuralChange([s0], 'Budget', 'col', 2, 1)
    expect(s.colWidths).toEqual({ 0: 200, 4: 90 })
  })

  it('a deleted column takes its width with it', () => {
    const s0: SheetData = { ...budget(), colWidths: { 0: 200, 1: 90, 2: 70 } }
    const [s] = applyStructuralChange([s0], 'Budget', 'col', 1, -1)
    expect(s.colWidths).toEqual({ 0: 200, 1: 70 })
  })

  it('is untouched by a ROW change — widths are a column property', () => {
    const s0: SheetData = { ...budget(), colWidths: { 0: 200 } }
    const [s] = applyStructuralChange([s0], 'Budget', 'row', 0, 1)
    expect(s.colWidths).toEqual({ 0: 200 })
  })
})

describe('doing nothing', () => {
  it('returns the sheets untouched for a zero-sized change', () => {
    const before = [budget()]
    expect(applyStructuralChange(before, 'Budget', 'row', 2, 0)).toBe(before)
  })

  it('ignores a change aimed at a sheet that is not there', () => {
    const after = applyStructuralChange([budget()], 'Nope', 'row', 0, 1)
    expect(at(by(after, 'Budget'), 'A2')).toBe('Laptops')
    expect(by(after, 'Budget').rows).toBe(24)
  })
})
