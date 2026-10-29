import { describe, it, expect } from 'vitest'
import { toOpenFormula, fromOpenFormula } from './openformula'

// Each pair is what LibreOffice 24 itself writes for that Excel formula when it
// converts an .xlsx to .ods — checked once with soffice, recorded here.
const PAIRS: [string, string][] = [
  ['=SUM(A:A)', 'of:=SUM([.A:.A])'],
  ['=SUM(2:2)', 'of:=SUM([.2:.2])'],
  ["='My Data'!B2*2", "of:=[$'My Data'.B2]*2"],
  ['=SUM($A$1:A3)', 'of:=SUM([.$A$1:.A3])'],
  ['=IF(A1>2,"a,b;c",A2%)', 'of:=IF([.A1]>2;"a,b;c";[.A2]%)'],
  ['=SUM({1,2;3,4})', 'of:=SUM({1;2|3;4})'],
  ['=Main!A1&" x"', 'of:=[$Main.A1]&" x"'],
  ['=ROUND(AVERAGE(A1:A5),2)', 'of:=ROUND(AVERAGE([.A1:.A5]);2)'],
  ['=-A1^2', 'of:=-[.A1]^2'],
  ['=LOG10(100)', 'of:=LOG10(100)'],
]

describe('OpenFormula', () => {
  it.each(PAIRS)('%s → %s, as LibreOffice writes it', (excel, of) => {
    expect(toOpenFormula(excel)).toBe(of)
  })
  it.each(PAIRS)('and %s comes back from it', (excel, of) => {
    expect('=' + fromOpenFormula(of)).toBe(excel)
  })
  it('a function whose name looks like a cell is a function, and a name is left alone', () => {
    expect(toOpenFormula('=LOG10(A1)+TaxRate*AB12C')).toBe('of:=LOG10([.A1])+TaxRate*AB12C')
  })
  it('a quote in a sheet name is doubled, and survives the trip', () => {
    expect(toOpenFormula("='Omar''s'!A1")).toBe("of:=[$'Omar''s'.A1]")
    expect(fromOpenFormula("of:=[$'Omar''s'.A1]")).toBe("'Omar''s'!A1")
  })
  it('a range on another sheet names the sheet once', () => {
    expect(toOpenFormula('=SUM(Data!A1:B3)')).toBe('of:=SUM([$Data.A1:.B3])')
    expect(fromOpenFormula('of:=SUM([$Data.A1:.B3])')).toBe('SUM(Data!A1:B3)')
  })
})
