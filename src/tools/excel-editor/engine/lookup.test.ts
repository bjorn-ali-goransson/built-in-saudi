/**
 * LOOKUPS AND THE PLURAL CONDITIONAL AGGREGATES (#1356).
 *
 * The engine had 23 functions and none of them could answer "what is this product's price". A
 * business spreadsheet without VLOOKUP or INDEX/MATCH is not one, and every sheet imported from
 * Excel that used them showed `#NAME?` down a whole column.
 *
 * Why these are in scope at all, since CLAUDE.md cuts hard here: the exclusion it states is
 * INDIRECT/OFFSET and array/spill, for one reason — those make the dependency graph DYNAMIC,
 * unknowable without evaluating, which is the one thing a statically-extracting engine cannot do.
 * A lookup's ranges are written into the formula, so nothing about them is dynamic. The prompt and
 * two tests had generalised that rule into "no lookup functions"; this is the correction.
 *
 * The cases below are mostly about the ways a lookup is quietly WRONG rather than absent — an
 * off-by-one column, an approximate match landing on a neighbouring row, a criterion range one
 * short. Those produce a plausible number in a cell nobody re-checks, which is the expensive kind.
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
function calc(cells: Record<string, string>, formula: string): string {
  const s = [sheet('S', { ...cells, Z1: formula })]
  return displayValue(new Workbook(s).value('S', parseA1('Z1')!))
}

/** A price list: code, name, price, region — the shape every lookup in the wild has. */
const PRICES = {
  A1: 'SKU', B1: 'Name', C1: 'Price', D1: 'Region',
  A2: 'A-100', B2: 'Filter', C2: '250', D2: 'Riyadh',
  A3: 'B-200', B3: 'Pump', C3: '1400', D3: 'Jeddah',
  A4: 'C-300', B4: 'Valve', C4: '620', D4: 'Riyadh',
}

describe('VLOOKUP', () => {
  it('finds a row by its key and returns the column asked for', () => {
    expect(calc(PRICES, '=VLOOKUP("B-200",A2:D4,3,FALSE)')).toBe('1400')
    expect(calc(PRICES, '=VLOOKUP("B-200",A2:D4,2,FALSE)')).toBe('Pump')
    expect(calc(PRICES, '=VLOOKUP("B-200",A2:D4,4,FALSE)')).toBe('Jeddah')
  })

  it('matches text without regard to case, as Excel does', () => {
    expect(calc(PRICES, '=VLOOKUP("b-200",A2:D4,3,FALSE)')).toBe('1400')
  })

  it('is #N/A when the key is not there, never a neighbouring row', () => {
    expect(calc(PRICES, '=VLOOKUP("Z-999",A2:D4,3,FALSE)')).toBe('#N/A')
  })

  /**
   * The column index is 1-based and counts from the table's OWN first column, not from column A of
   * the sheet. A table starting at B would be off by one under the obvious wrong implementation,
   * and every value returned would be from the column next door — plausible, and wrong.
   */
  it('counts columns from the table, not from the sheet', () => {
    expect(calc(PRICES, '=VLOOKUP("Pump",B2:D4,2,FALSE)')).toBe('1400')
  })

  it('refuses a column outside the table rather than returning blank', () => {
    expect(calc(PRICES, '=VLOOKUP("B-200",A2:D4,9,FALSE)')).toBe('#REF!')
    expect(calc(PRICES, '=VLOOKUP("B-200",A2:D4,0,FALSE)')).toBe('#VALUE!')
  })

  /**
   * The approximate form — "the largest value not greater than this" — over an ascending column.
   * This is the tax-bracket / volume-discount shape, and it is also the DEFAULT when the fourth
   * argument is omitted, which is why an imported sheet depends on it being right.
   */
  it('approximates over a sorted column, and that is the default', () => {
    const brackets = { A1: '0', B1: 'none', A2: '1000', B2: 'bronze', A3: '5000', B3: 'silver', A4: '20000', B4: 'gold' }
    expect(calc(brackets, '=VLOOKUP(7000,A1:B4,2,TRUE)')).toBe('silver')
    expect(calc(brackets, '=VLOOKUP(7000,A1:B4,2)')).toBe('silver')
    expect(calc(brackets, '=VLOOKUP(5000,A1:B4,2,TRUE)'), 'an exact hit must win over the row below').toBe('silver')
    expect(calc(brackets, '=VLOOKUP(999999,A1:B4,2,TRUE)')).toBe('gold')
    // Below the whole range there is no "largest not greater", so #N/A rather than the first row.
    expect(calc(brackets, '=VLOOKUP(-5,A1:B4,2,TRUE)')).toBe('#N/A')
  })
})

describe('HLOOKUP', () => {
  it('is VLOOKUP with the axes swapped', () => {
    const across = { A1: 'Q1', B1: 'Q2', C1: 'Q3', A2: '100', B2: '200', C2: '300' }
    expect(calc(across, '=HLOOKUP("Q2",A1:C2,2,FALSE)')).toBe('200')
    expect(calc(across, '=HLOOKUP("Q9",A1:C2,2,FALSE)')).toBe('#N/A')
  })
})

describe('INDEX and MATCH', () => {
  it('addresses a rectangle by row and column', () => {
    expect(calc(PRICES, '=INDEX(A2:D4,2,3)')).toBe('1400')
    expect(calc(PRICES, '=INDEX(A2:D4,3,2)')).toBe('Valve')
  })

  it('takes a single index along a one-dimensional range, either way round', () => {
    expect(calc(PRICES, '=INDEX(C2:C4,3)')).toBe('620')
    expect(calc(PRICES, '=INDEX(A1:D1,3)')).toBe('Price')
  })

  it('is #REF! outside the range rather than an empty cell', () => {
    expect(calc(PRICES, '=INDEX(A2:D4,9,1)')).toBe('#REF!')
  })

  it('reports a position, and #N/A when there is none', () => {
    expect(calc(PRICES, '=MATCH("C-300",A2:A4,0)')).toBe('3')
    expect(calc(PRICES, '=MATCH("Z-999",A2:A4,0)')).toBe('#N/A')
  })

  /** The pairing that makes lookups safe against an inserted column — worth proving it composes. */
  it('composes as INDEX(range, MATCH(...)), which is the reason both exist', () => {
    expect(calc(PRICES, '=INDEX(C2:C4,MATCH("C-300",A2:A4,0))')).toBe('620')
  })
})

describe('XLOOKUP', () => {
  it('takes the two ranges directly, with no column counting', () => {
    expect(calc(PRICES, '=XLOOKUP("B-200",A2:A4,C2:C4)')).toBe('1400')
  })

  /** Its whole point over VLOOKUP: a miss is exact and can carry its own answer. */
  it('is exact by default and returns the fallback when given one', () => {
    expect(calc(PRICES, '=XLOOKUP("Z-999",A2:A4,C2:C4)')).toBe('#N/A')
    expect(calc(PRICES, '=XLOOKUP("Z-999",A2:A4,C2:C4,0)')).toBe('0')
    expect(calc(PRICES, '=XLOOKUP("Z-999",A2:A4,C2:C4,"not stocked")')).toBe('not stocked')
  })
})

describe('SUMIFS / COUNTIFS / AVERAGEIFS', () => {
  const SALES = {
    A1: 'Riyadh', A2: 'Jeddah', A3: 'Riyadh', A4: 'Riyadh',
    B1: 'Q1', B2: 'Q1', B3: 'Q2', B4: 'Q1',
    C1: '100', C2: '200', C3: '400', C4: '50',
  }

  /** Two conditions is the moment the singular form stops being enough, which is immediately. */
  it('applies every condition, not just the first', () => {
    expect(calc(SALES, '=SUMIFS(C1:C4,A1:A4,"Riyadh",B1:B4,"Q1")')).toBe('150')
    expect(calc(SALES, '=COUNTIFS(A1:A4,"Riyadh",B1:B4,"Q1")')).toBe('2')
    expect(calc(SALES, '=AVERAGEIFS(C1:C4,A1:A4,"Riyadh",B1:B4,"Q1")')).toBe('75')
  })

  it('takes the same operator-in-a-string criteria as SUMIF', () => {
    expect(calc(SALES, '=SUMIFS(C1:C4,C1:C4,">=100")')).toBe('700')
    expect(calc(SALES, '=COUNTIFS(A1:A4,"Riyadh",C1:C4,"<100")')).toBe('1')
  })

  /**
   * The argument order FLIPS between SUMIF and SUMIFS — sum range last and optional in one, first
   * and required in the other. That is Excel's own inconsistency and the commonest way these are
   * written wrong, so both shapes are asserted side by side.
   */
  it('puts the summed range first, where SUMIF puts it last', () => {
    expect(calc(SALES, '=SUMIF(A1:A4,"Riyadh",C1:C4)')).toBe('550')
    expect(calc(SALES, '=SUMIFS(C1:C4,A1:A4,"Riyadh")')).toBe('550')
  })

  it('is #DIV/0! when an average matched nothing, not zero', () => {
    expect(calc(SALES, '=AVERAGEIFS(C1:C4,A1:A4,"Nowhere")')).toBe('#DIV/0!')
    expect(calc(SALES, '=AVERAGEIF(A1:A4,"Nowhere",C1:C4)')).toBe('#DIV/0!')
  })

  it('refuses a criterion with no range to go with it', () => {
    expect(calc(SALES, '=SUMIFS(C1:C4,A1:A4)')).toBe('#VALUE!')
    expect(calc(SALES, '=COUNTIFS(A1:A4)')).toBe('#VALUE!')
  })
})

describe('the everyday arithmetic and text functions', () => {
  it('rounds up, down and toward minus infinity', () => {
    expect(calc({}, '=ROUNDUP(2.111,1)')).toBe('2.2')
    expect(calc({}, '=ROUNDDOWN(2.999,1)')).toBe('2.9')
    expect(calc({}, '=ROUNDUP(-2.1,0)'), 'ROUNDUP is away from zero').toBe('-3')
    // INT floors, which is NOT truncation for a negative — the classic quiet error.
    expect(calc({}, '=INT(-2.5)')).toBe('-3')
  })

  /** MOD takes the sign of the DIVISOR, where JavaScript's % takes the sign of the dividend. */
  it('gives MOD the divisor’s sign, as Excel and arithmetic do', () => {
    expect(calc({}, '=MOD(-3,2)')).toBe('1')
    expect(calc({}, '=MOD(3,-2)')).toBe('-1')
    expect(calc({}, '=MOD(3,0)')).toBe('#DIV/0!')
  })

  it('steps to a multiple, and raises a power', () => {
    expect(calc({}, '=CEILING(7,5)')).toBe('10')
    expect(calc({}, '=FLOOR(7,5)')).toBe('5')
    expect(calc({}, '=POWER(2,10)')).toBe('1024')
  })

  it('takes a median of both an odd and an even count', () => {
    expect(calc({ A1: '1', A2: '9', A3: '2' }, '=MEDIAN(A1:A3)')).toBe('2')
    expect(calc({ A1: '1', A2: '9', A3: '2', A4: '4' }, '=MEDIAN(A1:A4)')).toBe('3')
  })

  /** Every position is 1-based — the single commonest off-by-one when these are reimplemented. */
  it('slices text from 1-based positions', () => {
    const t = { A1: 'Riyadh' }
    expect(calc(t, '=LEFT(A1,3)')).toBe('Riy')
    expect(calc(t, '=RIGHT(A1,3)')).toBe('adh')
    expect(calc(t, '=MID(A1,2,3)')).toBe('iya')
    expect(calc(t, '=FIND("y",A1)')).toBe('3')
  })

  it('separates FIND from SEARCH on case, and says so when there is no match', () => {
    const t = { A1: 'Riyadh' }
    expect(calc(t, '=SEARCH("RIY",A1)')).toBe('1')
    expect(calc(t, '=FIND("RIY",A1)')).toBe('#VALUE!')
  })

  it('substitutes every occurrence', () => {
    expect(calc({ A1: 'a-b-c' }, '=SUBSTITUTE(A1,"-","/")')).toBe('a/b/c')
  })
})
