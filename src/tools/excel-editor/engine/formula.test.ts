import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Workbook, displayValue } from './engine'
import { parseA1, type SheetData } from './model'

/** Build a one-sheet workbook from an { A1: input } map, plus optional extra sheets. */
function wb(cells: Record<string, string>, extra: SheetData[] = []) {
  const c: SheetData['cells'] = {}
  for (const [ref, input] of Object.entries(cells)) {
    const a = parseA1(ref)!
    c[`${a.row},${a.col}`] = { input }
  }
  return new Workbook([{ name: 'Sheet1', cells: c, rows: 30, cols: 12 }, ...extra])
}
/** Evaluate a single formula in isolation and return its displayed value. */
function evalF(formula: string, ctx: Record<string, string> = {}): string {
  const book = wb({ ...ctx, Z1: `=${formula}` })
  return displayValue(book.value('Sheet1', parseA1('Z1')!))
}

// ---- Layer 1: formula conformance -----------------------------------------

describe('formula conformance', () => {
  const cases: [string, string][] = [
    // arithmetic + precedence
    ['1+2*3', '7'],
    ['(1+2)*3', '9'],
    ['2^10', '1024'],
    ['2^2^3', '64'], // left-assoc, matching Excel/Sheets: (2^2)^3, NOT 2^(2^3)=256
    ['-3+2', '-1'],
    ['10/4', '2.5'],
    ['7-3-2', '2'], // left-assoc
    ['50%', '0.5'],
    // comparisons -> booleans
    ['3>2', 'TRUE'],
    ['2>=2', 'TRUE'],
    ['1<>1', 'FALSE'],
    ['"a"="A"', 'TRUE'], // case-insensitive text equality
    // text
    ['"foo"&"bar"', 'foobar'],
    ['CONCATENATE("x=",1+1)', 'x=2'],
    ['(0.1+0.2)&"x"', '0.3x'], // stringify rounds float fuzz like the display path
    ['ROUND(-2.5,0)', '-3'], // half away from zero, like Excel
    ['ROUND(2.5,0)', '3'],
    ['1e3+1', '1001'], // scientific-notation literal tokenizes
    ['LEN("hello")', '5'],
    ['UPPER("hi")', 'HI'],
    ['TRIM("  s  ")', 's'],
    // functions
    ['SUM(1,2,3)', '6'],
    ['AVERAGE(2,4,6)', '4'],
    // PRODUCT was named in the AI prompt and missing from the engine, so an AI-built sheet using it
    // rendered #NAME? (#747). Empty is 0 like Excel, not the mathematical empty product of 1.
    ['PRODUCT(2,3,4)', '24'],
    ['PRODUCT(5)', '5'],
    ['PRODUCT(2,-3)', '-6'],
    ['MIN(5,2,8)', '2'],
    ['MAX(5,2,8)', '8'],
    ['ROUND(10/3,2)', '3.33'],
    ['ABS(-7)', '7'],
    ['IF(3>2,"y","n")', 'y'],
    ['IF(1>2,"y","n")', 'n'],
    ['AND(TRUE,1=1)', 'TRUE'],
    ['OR(FALSE,1=2)', 'FALSE'],
    ['NOT(FALSE)', 'TRUE'],
    ['IFERROR(1/0,"safe")', 'safe'],
    // errors
    ['1/0', '#DIV/0!'],
    ['NOSUCHFUNC(1)', '#NAME?'],
    ['1+', '#VALUE!'], // syntax error -> #VALUE!
  ]
  it.each(cases)('%s = %s', (formula, expected) => {
    expect(evalF(formula)).toBe(expected)
  })

  it('ranges: SUM/AVERAGE/COUNT over A1:A3', () => {
    const ctx = { A1: '10', A2: '20', A3: '30' }
    expect(evalF('SUM(A1:A3)', ctx)).toBe('60')
    expect(evalF('AVERAGE(A1:A3)', ctx)).toBe('20')
    expect(evalF('COUNT(A1:A3)', ctx)).toBe('3')
  })

  it('cross-sheet references resolve', () => {
    const book = wb(
      { A1: '=Data!B2*2' },
      [{ name: 'Data', cells: { '1,1': { input: '21' } }, rows: 5, cols: 5 }],
    )
    expect(displayValue(book.value('Sheet1', parseA1('A1')!))).toBe('42')
  })

  it('detects circular references', () => {
    const book = wb({ A1: '=B1', B1: '=A1' })
    expect(displayValue(book.value('Sheet1', parseA1('A1')!))).toBe('#CIRC!')
  })

  it('reactively recalculates dependents on edit', () => {
    const book = wb({ A1: '10', A2: '=A1*2', A3: '=A2+1' })
    expect(displayValue(book.value('Sheet1', parseA1('A3')!))).toBe('21')
    book.setInput('Sheet1', parseA1('A1')!, '100')
    expect(displayValue(book.value('Sheet1', parseA1('A3')!))).toBe('201')
  })
})

// ---- Layer 2: parser fuzzing ----------------------------------------------

describe('parser never crashes on hostile input', () => {
  it('random strings always yield a value or a graceful error', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        /**
         * A VALUE COMES BACK, not merely no exception (#1218/#830).
         *
         * `not.toThrow()` alone is satisfied by an engine that returns `undefined` for everything —
         * and by `value()` being replaced with a stub. The file's contract is *"either a value or a
         * CellError sentinel"*, so the property is that something addressable arrives, whatever it
         * says. `undefined` is what a blank cell would show a reader who typed a formula.
         */
        const out = wb({ A1: `=${s}` }).value('Sheet1', parseA1('A1')!)
        expect(out, `=${s} evaluated to undefined — a reader sees an empty cell, not a mistake`).toBeDefined()
      }),
      { numRuns: 500 },
    )
  })

  it('formula-ish tokens never throw', () => {
    const tokens = ['A1', ':', '(', ')', ',', '+', 'SUM', '"', '1', '!', 'Sheet1']
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...tokens), { maxLength: 12 }), (parts) => {
        // Same as above: surviving is half the contract, answering is the other half.
        const out = wb({ A1: `=${parts.join('')}` }).value('Sheet1', parseA1('A1')!)
        expect(out, `=${parts.join('')} evaluated to undefined`).toBeDefined()
      }),
      { numRuns: 150 },
    )
  })
})

// ---- Layer 3: audit-round regressions (Excel-semantics fixes) --------------

describe('logical + equality semantics (round-8 audit)', () => {
  it('AND/OR skip blank cells in a range instead of treating them as FALSE', () => {
    // A3 is blank; Excel ignores it, so AND(A1:A3) with two TRUEs is TRUE.
    expect(evalF('AND(A1:A3)', { A1: '=TRUE', A2: '=TRUE' })).toBe('TRUE')
    expect(evalF('OR(A1:A3)', { A1: '=FALSE', A2: '=FALSE' })).toBe('FALSE')
    // A populated FALSE still counts.
    expect(evalF('AND(A1:A3)', { A1: '=TRUE', A2: '=FALSE' })).toBe('FALSE')
  })

  it('AND/OR over only blank cells is #VALUE! (no logical values)', () => {
    expect(evalF('AND(A1:A3)')).toBe('#VALUE!')
  })

  it('a blank cell equals 0 and "", consistently', () => {
    expect(evalF('A1=0')).toBe('TRUE') // blank behaves as 0
    expect(evalF('A1=""')).toBe('TRUE') // ...and as an empty string
    expect(evalF('A1=FALSE')).toBe('TRUE') // ...and as FALSE
  })

  it('a number never equals text of the same glyphs', () => {
    expect(evalF('1="1"')).toBe('FALSE')
    expect(evalF('0="0"')).toBe('FALSE')
  })
})
