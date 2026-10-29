import { describe, expect, it } from 'vitest'
import { renameSheetRefs, shiftFormula } from './formula'

/** Excel-style reference shifting for copy/paste (#206 — "Carry formulas"). */
describe('shiftFormula', () => {
  it('shifts a relative ref by the paste offset', () => {
    expect(shiftFormula('=B1*2', 1, 0)).toBe('=B2*2') // one row down
    expect(shiftFormula('=B1*2', 0, 1)).toBe('=C1*2') // one col right
    expect(shiftFormula('=A1+B1', 4, 0)).toBe('=A5+B5')
  })

  it('keeps $-anchored parts fixed', () => {
    expect(shiftFormula('=$A$1', 3, 3)).toBe('=$A$1')
    expect(shiftFormula('=$A1', 2, 2)).toBe('=$A3') // column locked, row moves
    expect(shiftFormula('=A$1', 2, 2)).toBe('=C$1') // row locked, column moves
  })

  it('does not touch function names or string literals', () => {
    expect(shiftFormula('=SUM(A1:A3)', 1, 0)).toBe('=SUM(A2:A4)')
    expect(shiftFormula('=IF(A1>0,"A1 here",B1)', 1, 0)).toBe('=IF(A2>0,"A1 here",B2)')
  })

  it('shifts cross-sheet references', () => {
    expect(shiftFormula('=Sheet2!B2+1', 1, 0)).toBe('=Sheet2!B3+1')
    expect(shiftFormula("='My Sheet'!B2", 0, 1)).toBe("='My Sheet'!C2")
  })

  it('emits #REF! when a ref shifts off the sheet', () => {
    expect(shiftFormula('=A1', -1, 0)).toBe('=#REF!') // row would be 0
    expect(shiftFormula('=A1', 0, -1)).toBe('=#REF!') // col would be 0
  })

  it('leaves non-formulas and zero offsets alone', () => {
    expect(shiftFormula('hello', 3, 3)).toBe('hello')
    expect(shiftFormula('42', 3, 3)).toBe('42')
    expect(shiftFormula('=A1', 0, 0)).toBe('=A1')
  })

  it('returns untokenizable input verbatim rather than throwing', () => {
    expect(shiftFormula('=A1 #? bad', 1, 0)).toBe('=A1 #? bad') // `#`/`?` fail to tokenize
  })
})

describe('renameSheetRefs', () => {
  it('rewrites cross-sheet references to the renamed sheet', () => {
    expect(renameSheetRefs('=Sheet1!A1+1', 'Sheet1', 'Budget')).toBe('=Budget!A1+1')
    expect(renameSheetRefs('=SUM(Sheet1!A1:A9)', 'Sheet1', 'Budget')).toBe('=SUM(Budget!A1:A9)')
  })

  it('quotes a new name that is not a bare identifier', () => {
    expect(renameSheetRefs('=Sheet1!A1', 'Sheet1', 'Q1 Budget')).toBe("='Q1 Budget'!A1")
    expect(renameSheetRefs('=Sheet1!A1', 'Sheet1', 'A1')).toBe("='A1'!A1") // a ref-shaped name must be quoted
  })

  it('renames a previously quoted sheet name too', () => {
    expect(renameSheetRefs("='Old Name'!B2", 'Old Name', 'New')).toBe('=New!B2')
  })

  it('leaves other sheets and non-formulas alone', () => {
    expect(renameSheetRefs('=Sheet2!A1', 'Sheet1', 'Budget')).toBe('=Sheet2!A1')
    expect(renameSheetRefs('plain text', 'Sheet1', 'Budget')).toBe('plain text')
  })
})
