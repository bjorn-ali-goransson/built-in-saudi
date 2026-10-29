/**
 * COUNTIF and SUMIF.
 *
 * Both used to render `#NAME?`, including in a spreadsheet somebody had just imported from Excel,
 * and they are the two functions people reach for immediately after SUM. The interesting part is
 * not the arithmetic — it is the criterion, which Excel writes as a STRING with the operator inside
 * it (`">100"`, `"<>Riyadh"`, `"North*"`), so almost every case below is really a parsing case.
 */
import { describe, expect, it } from 'vitest'
import { Workbook, displayValue } from './engine'
import { parseA1, type SheetData } from './model'

function sheet(name: string, cells: Record<string, string>): SheetData {
  const c: SheetData['cells'] = {}
  for (const [ref, input] of Object.entries(cells)) {
    const a = parseA1(ref)!
    c[`${a.row},${a.col}`] = { input }
  }
  return { name, cells: c, rows: 30, cols: 10 }
}
/** Evaluate `formula` against a sheet of `cells`, and return what the grid would show. */
function calc(cells: Record<string, string>, formula: string): string {
  const s = [sheet('S', { ...cells, Z1: formula })]
  return displayValue(new Workbook(s).value('S', parseA1('Z1')!))
}

/** Unit prices down column A, regions down column B — the shape of a real sheet. */
const DATA = {
  A1: '4200', A2: '850', A3: '470', A4: '1200',
  B1: 'Riyadh', B2: 'Jeddah', B3: 'riyadh', B4: 'Dammam',
  C1: '3', C2: '5', C3: '5', C4: '2',
}

describe('COUNTIF', () => {
  it('counts with each comparison operator', () => {
    expect(calc(DATA, '=COUNTIF(A1:A4,">1000")')).toBe('2')
    expect(calc(DATA, '=COUNTIF(A1:A4,">=1200")')).toBe('2')
    expect(calc(DATA, '=COUNTIF(A1:A4,"<1000")')).toBe('2')
    expect(calc(DATA, '=COUNTIF(A1:A4,"<=850")')).toBe('2')
  })

  it('counts equality for numbers and for text', () => {
    expect(calc(DATA, '=COUNTIF(A1:A4,850)')).toBe('1')
    expect(calc(DATA, '=COUNTIF(A1:A4,"850")')).toBe('1')
    expect(calc(DATA, '=COUNTIF(B1:B4,"Dammam")')).toBe('1')
  })

  it('matches text without regard to case, as Excel does', () => {
    // "Riyadh" and "riyadh" are the same place; a case-sensitive count would say 1 and be wrong.
    expect(calc(DATA, '=COUNTIF(B1:B4,"riyadh")')).toBe('2')
  })

  it('counts everything that is not the excluded value', () => {
    expect(calc(DATA, '=COUNTIF(B1:B4,"<>Riyadh")')).toBe('2')
  })

  it('honours * and ? wildcards, and ~ escapes them', () => {
    expect(calc({ B1: 'North region', B2: 'Northgate', B3: 'South' }, '=COUNTIF(B1:B3,"North*")')).toBe('2')
    expect(calc({ B1: 'cat', B2: 'cot', B3: 'coat' }, '=COUNTIF(B1:B3,"c?t")')).toBe('2')
    expect(calc({ B1: 'a*b', B2: 'axb' }, '=COUNTIF(B1:B2,"a~*b")')).toBe('1')
  })

  it('takes its criterion from another cell', () => {
    // The common spreadsheet idiom: the threshold lives in a cell so it can be changed. The cell
    // holds `>1000` as typed — the quotes only exist when the criterion is written into the formula.
    expect(calc({ ...DATA, D1: '>1000' }, '=COUNTIF(A1:A4,D1)')).toBe('2')
  })

  it('does not count blanks in a comparison', () => {
    // A1:A9 is mostly empty; an empty cell is not "less than 1000".
    expect(calc({ A1: '4200', A2: '850' }, '=COUNTIF(A1:A9,"<1000")')).toBe('1')
  })

  /**
   * The behaviour that differs from SUM on purpose. A long column with one stale error in it is
   * normal, and a COUNTIF that refused to answer because of it would be unusable — the broken cell
   * is simply not one of the cells over 1000.
   */
  it('ignores an error in the range instead of propagating it', () => {
    const cells = { A1: '4200', A2: '=1/0', A3: '470' }
    expect(calc(cells, '=COUNTIF(A1:A3,">1000")')).toBe('1')
    expect(calc(cells, '=SUM(A1:A3)'), 'SUM should still refuse — the contrast is the point').toBe('#DIV/0!')
  })

  it('refuses the wrong number of arguments', () => {
    expect(calc(DATA, '=COUNTIF(A1:A4)')).toBe('#VALUE!')
    expect(calc(DATA, '=COUNTIF(A1:A4,">1",A1:A4)')).toBe('#VALUE!')
  })
})

describe('SUMIF', () => {
  it('sums the tested range itself when given two arguments', () => {
    expect(calc(DATA, '=SUMIF(A1:A4,">1000")')).toBe(String(4200 + 1200))
  })

  it('sums a different range, paired by position', () => {
    // "How many units did we buy in Riyadh?" — test column B, total column C.
    expect(calc(DATA, '=SUMIF(B1:B4,"Riyadh",C1:C4)')).toBe(String(3 + 5))
  })

  it('skips text in the summed range rather than failing', () => {
    expect(calc({ A1: '10', A2: '20', B1: 'x', B2: '5' }, '=SUMIF(A1:A2,">5",B1:B2)')).toBe('5')
  })

  /**
   * The mirror of COUNTIF's rule: a cell that is being ADDED and is an error makes the total
   * genuinely uncomputable, exactly as it does for SUM.
   */
  it('propagates an error from a cell it actually sums', () => {
    expect(calc({ A1: '4200', B1: '=1/0' }, '=SUMIF(A1:A1,">1000",B1:B1)')).toBe('#DIV/0!')
  })

  it('does not propagate an error from a row it skips', () => {
    expect(calc({ A1: '10', A2: '4200', B1: '=1/0', B2: '7' }, '=SUMIF(A1:A2,">1000",B1:B2)')).toBe('7')
  })

  it('is zero when nothing matches', () => {
    expect(calc(DATA, '=SUMIF(A1:A4,">99999")')).toBe('0')
  })

  it('refuses the wrong number of arguments', () => {
    expect(calc(DATA, '=SUMIF(A1:A4)')).toBe('#VALUE!')
  })
})

describe('the new functions behave like the old ones', () => {
  it('recalculates when an input changes, and nests inside arithmetic', () => {
    // A conditional aggregate is only useful if it is a first-class formula, not a special case.
    expect(calc(DATA, '=SUMIF(A1:A4,">1000")*2')).toBe(String((4200 + 1200) * 2))
    expect(calc(DATA, '=IF(COUNTIF(A1:A4,">1000")>1,"many","few")')).toBe('many')
    expect(calc(DATA, '=ROUND(SUMIF(A1:A4,">1000")/3,2)')).toBe(String(Math.round((5400 / 3) * 100) / 100))
  })
})
