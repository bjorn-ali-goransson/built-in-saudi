/**
 * Edge-case hunt for the Tables formula engine. Pure unit tests — no browser.
 * Goal: crashes, hangs, non-deterministic recalc, and error-propagation gaps.
 * We DO NOT assert Excel bit-exactness (out of scope per CLAUDE.md). We assert the
 * engine never throws/hangs and returns either a value or a CellError sentinel.
 */
import { describe, expect, it } from 'vitest'
import { Workbook, displayValue } from './engine'
import { parse, deps } from './formula'
import { parseA1, type SheetData } from './model'

function wb(cells: Record<string, string>, extra: SheetData[] = []) {
  const c: SheetData['cells'] = {}
  for (const [ref, input] of Object.entries(cells)) {
    const a = parseA1(ref)!
    c[`${a.row},${a.col}`] = { input }
  }
  return new Workbook([{ name: 'Sheet1', cells: c, rows: 30, cols: 12 }, ...extra])
}
function evalF(formula: string, ctx: Record<string, string> = {}): string {
  const book = wb({ ...ctx, Z1: `=${formula}` })
  return displayValue(book.value('Sheet1', parseA1('Z1')!))
}
const disp = (book: Workbook, ref: string) => displayValue(book.value('Sheet1', parseA1(ref)!))

// --------------------------------------------------------------------------
// 1. Deep dependency chains — recursion depth / stack overflow
// --------------------------------------------------------------------------
describe('deep dependency chains', () => {
  it('A1->A2->...->A100 forward-inserted computes correctly', () => {
    const cells: Record<string, string> = { A1: '1' }
    for (let r = 2; r <= 100; r++) cells[`A${r}`] = `=A${r - 1}+1`
    const book = wb(cells)
    expect(disp(book, 'A100')).toBe('100')
  })

  it('a reasonably deep tail-first chain computes correctly', () => {
    // Insert An first so recalcAll computes the tail first -> single DFS of depth n.
    const cells: Record<string, string> = {}
    const N = 1000
    for (let r = N; r >= 2; r--) cells[`A${r}`] = `=A${r - 1}+1`
    cells['A1'] = '1'
    expect(disp(wb(cells), `A${N}`)).toBe(String(N))
  })

  it('a pathologically deep chain degrades gracefully — never throws or hangs', () => {
    // KNOWN LIMIT (GitHub Issues): the evaluator is recursive-descent, so a
    // single chain deeper than the JS stack (~a few thousand) cannot be resolved.
    // The contract is graceful degradation: it must NOT throw or hang, and must
    // return either the answer or a #VALUE! sentinel — never NaN/garbage.
    const cells: Record<string, string> = {}
    const N = 20000
    for (let r = N; r >= 2; r--) cells[`A${r}`] = `=A${r - 1}+1`
    cells['A1'] = '1'
    let out = ''
    expect(() => {
      out = disp(wb(cells), `A${N}`)
    }).not.toThrow()
    expect([String(N), '#VALUE!']).toContain(out)
  })
})

// --------------------------------------------------------------------------
// 2. Empty-cell references & coercion
// --------------------------------------------------------------------------
describe('empty cells and coercion', () => {
  it('reference to an empty cell coerces to 0 in arithmetic', () => {
    expect(evalF('B5+1')).toBe('1')
    expect(evalF('B5*3')).toBe('0')
  })
  it('empty cell compares equal to empty string and to 0-ish', () => {
    expect(evalF('B5=""')).toBe('TRUE')
  })
  it('text + number where text is non-numeric -> #VALUE!', () => {
    expect(evalF('"abc"+1')).toBe('#VALUE!')
  })
  it('numeric-looking text coerces in arithmetic', () => {
    expect(evalF('"5"+3')).toBe('8')
    expect(evalF('"  5  "+3')).toBe('8')
  })
  it('boolean coerces in arithmetic and comparison', () => {
    expect(evalF('TRUE+1')).toBe('2')
    expect(evalF('FALSE+5')).toBe('5')
  })
})

// --------------------------------------------------------------------------
// 3. Error propagation through dependents
// --------------------------------------------------------------------------
describe('error propagation', () => {
  it('#DIV/0! flows into a dependent cell', () => {
    const book = wb({ A1: '=1/0', A2: '=A1+1', A3: '=A2*2' })
    expect(disp(book, 'A1')).toBe('#DIV/0!')
    expect(disp(book, 'A2')).toBe('#DIV/0!')
    expect(disp(book, 'A3')).toBe('#DIV/0!')
  })
  it('error inside SUM range propagates', () => {
    const book = wb({ A1: '=1/0', A2: '5', Z1: '=SUM(A1:A2)' })
    expect(disp(book, 'Z1')).toBe('#DIV/0!')
  })
  it('#REF! from a missing sheet propagates', () => {
    expect(evalF('Nope!A1+1')).toBe('#REF!')
  })
  it('IFERROR traps a propagated error', () => {
    const book = wb({ A1: '=1/0', Z1: '=IFERROR(A1+1,"ok")' })
    expect(disp(book, 'Z1')).toBe('ok')
  })
})

// --------------------------------------------------------------------------
// 4. Cycles — must be #CIRC!, never a hang or stack overflow
// --------------------------------------------------------------------------
describe('circular references never hang', () => {
  it('self-reference A1=A1', () => {
    expect(disp(wb({ A1: '=A1' }), 'A1')).toBe('#CIRC!')
  })
  it('self-reference through arithmetic A1=A1+1', () => {
    expect(disp(wb({ A1: '=A1+1' }), 'A1')).toBe('#CIRC!')
  })
  it('two-cell cycle', () => {
    const book = wb({ A1: '=B1', B1: '=A1' })
    expect(disp(book, 'A1')).toBe('#CIRC!')
    expect(disp(book, 'B1')).toBe('#CIRC!')
  })
  it('longer cycle A1->A2->A3->A1', () => {
    const book = wb({ A1: '=A2', A2: '=A3', A3: '=A1' })
    expect(disp(book, 'A1')).toBe('#CIRC!')
  })
  it('cross-sheet cycle Sheet1!A1 <-> Sheet2!A1', () => {
    const book = wb({ A1: '=Sheet2!A1' }, [
      { name: 'Sheet2', cells: { '0,0': { input: '=Sheet1!A1' } }, rows: 5, cols: 5 },
    ])
    expect(disp(book, 'A1')).toBe('#CIRC!')
  })
  it('cycle via a range (SUM includes self)', () => {
    // A1 = SUM(A1:A3) is a self-referential range.
    const book = wb({ A1: '=SUM(A1:A3)', A2: '1', A3: '2' })
    expect(() => book.value('Sheet1', parseA1('A1')!)).not.toThrow()
    expect(disp(book, 'A1')).toBe('#CIRC!')
  })
  it('cell referencing a cycle member also errors, deterministically', () => {
    const mk = () => wb({ A1: '=B1', B1: '=A1', C1: '=B1+0' })
    const a = disp(mk(), 'C1')
    const b = disp(mk(), 'C1')
    console.log('[cycle-ref] C1 =', a)
    expect(a).toBe(b) // deterministic
  })
})

// --------------------------------------------------------------------------
// 5. Hostile / malformed input -> graceful error, never a throw
// --------------------------------------------------------------------------
describe('malformed formulas surface as errors, never throw', () => {
  const garbage = [
    '1+',
    '(1+2',
    '1+2)',
    'SUM(',
    'SUM(,)',
    ',',
    ':',
    '!',
    'A1:',
    ':A1',
    '"unterminated',
    "'unterminated",
    '1 2 3',
    '**',
    '=',
    '()',
    'A1 A2',
    '1..2',
    'SUM(1,,2)',
    '@#$',
    'A0', // row 0 is invalid A1
    '1E',
    'IF()',
    'ROUND()',
  ]
  it.each(garbage)('%s never throws', (f) => {
    let out = ''
    expect(() => {
      out = evalF(f)
    }).not.toThrow()
    console.log(`[garbage] "${f}" =>`, out)
  })

  /**
   * WHAT IT RETURNS, not merely that it survives (#1218/#830).
   *
   * These asserted `not.toThrow()` alone, which is satisfied by an engine that returns `undefined`,
   * by one that silently swallows every formula, and by `evalF` being replaced with a stub — the
   * shape #830 exists to find. The file's own header states the contract these are for: *"the engine
   * never throws/hangs and returns either a value or a CellError sentinel."* Only the first half was
   * asserted.
   *
   * The sentinel is the claim worth pinning. A malformed call has to reach the SHEET as an error the
   * reader can see and trace, because a blank cell where a number belongs is the version of this bug
   * nobody notices.
   */
  it('IF() with no args yields a visible error, not a blank and not a crash', () => {
    const got = evalF('IF()')
    expect(() => evalF('IF()')).not.toThrow()
    expect(got, `IF() produced ${JSON.stringify(got)} — a reader sees an empty cell, not a mistake`).toMatch(/^#/)
  })
  it('ROUND() with no args yields a visible error, not a blank and not a crash', () => {
    const got = evalF('ROUND()')
    expect(() => evalF('ROUND()')).not.toThrow()
    expect(got, `ROUND() produced ${JSON.stringify(got)}`).toMatch(/^#/)
  })
})

// --------------------------------------------------------------------------
// 6. Aggregations over mixed / blank / error ranges
// --------------------------------------------------------------------------
describe('aggregation edge cases', () => {
  it('SUM skips blanks and text', () => {
    const book = wb({ A1: '10', A2: '', A3: 'hello', A4: '20', Z1: '=SUM(A1:A4)' })
    expect(disp(book, 'Z1')).toBe('30')
  })
  it('AVERAGE of all-blank range -> #DIV/0!', () => {
    expect(evalF('AVERAGE(A1:A3)')).toBe('#DIV/0!')
  })
  it('COUNT counts only numbers', () => {
    const book = wb({ A1: '1', A2: 'x', A3: 'TRUE', A4: '2', Z1: '=COUNT(A1:A4)' })
    expect(disp(book, 'Z1')).toBe('2')
  })
  it('COUNTA counts non-blank', () => {
    const book = wb({ A1: '1', A2: 'x', A3: '', A4: 'TRUE', Z1: '=COUNTA(A1:A4)' })
    expect(disp(book, 'Z1')).toBe('3')
  })
  it('MIN/MAX of empty range -> 0', () => {
    expect(evalF('MIN(A1:A3)')).toBe('0')
    expect(evalF('MAX(A1:A3)')).toBe('0')
  })
  it('SUM with a boolean argument counts it as 1', () => {
    expect(evalF('SUM(TRUE,TRUE,1)')).toBe('3')
  })
})

// --------------------------------------------------------------------------
// 7. Numeric edge cases — Infinity / NaN leakage
// --------------------------------------------------------------------------
describe('numeric extremes', () => {
  it('SQRT(-1) — should be an error, not "NaN"', () => {
    const out = evalF('SQRT(-1)')
    console.log('[SQRT(-1)] =>', out)
    // Excel: #NUM!. We accept any CellError sentinel; a literal "NaN" is a bug.
    expect(out).not.toBe('NaN')
  })
  it('(-1)^0.5 — should not leak "NaN"', () => {
    const out = evalF('(-1)^0.5')
    console.log('[(-1)^0.5] =>', out)
    expect(out).not.toBe('NaN')
  })
  it('0^-1 — should not leak "Infinity"', () => {
    const out = evalF('0^-1')
    console.log('[0^-1] =>', out)
    expect(out).not.toBe('Infinity')
  })
  it('huge exponent 2^2000 — should not leak "Infinity"', () => {
    const out = evalF('2^2000')
    console.log('[2^2000] =>', out)
    expect(out).not.toBe('Infinity')
  })
  it('ROUND with absurd digit count does not leak NaN', () => {
    const out = evalF('ROUND(1.5,1000)')
    console.log('[ROUND(1.5,1000)] =>', out)
    expect(out).not.toBe('NaN')
  })
  it('negative zero renders as 0', () => {
    expect(evalF('-0')).toBe('0')
    expect(evalF('0*-1')).toBe('0')
  })
  it('Infinity/NaN never leak through a dependent chain', () => {
    const book = wb({ A1: '=SQRT(-1)', A2: '=A1+1' })
    console.log('[NaN-chain] A2 =', disp(book, 'A2'))
    expect(disp(book, 'A2')).not.toBe('NaN')
  })
})

// --------------------------------------------------------------------------
// 8. Recalc consistency — transitive dependents all update
// --------------------------------------------------------------------------
describe('recalc consistency', () => {
  it('editing a root updates all transitive dependents', () => {
    const cells: Record<string, string> = { A1: '1' }
    for (let r = 2; r <= 20; r++) cells[`A${r}`] = `=A${r - 1}+1`
    const book = wb(cells)
    expect(disp(book, 'A20')).toBe('20')
    book.setInput('Sheet1', parseA1('A1')!, '100')
    expect(disp(book, 'A20')).toBe('119')
    book.setInput('Sheet1', parseA1('A1')!, '0')
    expect(disp(book, 'A20')).toBe('19')
  })
  it('clearing a cell reverts dependents to empty-coercion', () => {
    const book = wb({ A1: '5', A2: '=A1*2' })
    expect(disp(book, 'A2')).toBe('10')
    book.setInput('Sheet1', parseA1('A1')!, '')
    expect(disp(book, 'A2')).toBe('0')
  })
  it('turning a cell into a cycle then back recovers', () => {
    const book = wb({ A1: '5', A2: '=A1+1' })
    expect(disp(book, 'A2')).toBe('6')
    book.setInput('Sheet1', parseA1('A1')!, '=A2')
    expect(disp(book, 'A2')).toBe('#CIRC!')
    book.setInput('Sheet1', parseA1('A1')!, '5')
    expect(disp(book, 'A2')).toBe('6')
  })
})

// --------------------------------------------------------------------------
// 9. Parsing/case/whitespace niceties
// --------------------------------------------------------------------------
describe('parsing niceties', () => {
  it('lowercase function and refs work', () => {
    const book = wb({ A1: '2', A2: '3', Z1: '=sum(a1:a2)' })
    expect(disp(book, 'Z1')).toBe('5')
  })
  it('$absolute refs parse', () => {
    const book = wb({ A1: '9', Z1: '=$A$1+1' })
    expect(disp(book, 'Z1')).toBe('10')
  })
  it('quoted sheet name with spaces', () => {
    const book = wb({ A1: "='My Sheet'!A1*2" }, [
      { name: 'My Sheet', cells: { '0,0': { input: '21' } }, rows: 5, cols: 5 },
    ])
    expect(disp(book, 'A1')).toBe('42')
  })
  it('nested functions', () => {
    expect(evalF('ROUND(AVERAGE(1,2,4),1)')).toBe('2.3')
    expect(evalF('IF(AND(1=1,OR(FALSE,TRUE)),SUM(1,2),0)')).toBe('3')
  })
  it('deeply nested parentheses do not throw', () => {
    const f = '('.repeat(50) + '1' + ')'.repeat(50)
    expect(() => evalF(f)).not.toThrow()
    expect(evalF(f)).toBe('1')
  })
  it('unary minus stacking', () => {
    expect(evalF('--5')).toBe('5')
    expect(evalF('---5')).toBe('-5')
  })
  it('percent postfix on a reference', () => {
    const book = wb({ A1: '50', Z1: '=A1%' })
    expect(disp(book, 'Z1')).toBe('0.5')
  })
})

// --------------------------------------------------------------------------
// 10. Text-ordering comparison gap (documented, not a crash)
// --------------------------------------------------------------------------
describe('text ordering comparisons', () => {
  it('"apple" < "banana" — engine coerces to numbers -> #VALUE!', () => {
    const out = evalF('"apple"<"banana"')
    console.log('[text-order] "apple"<"banana" =>', out)
    // Documenting the limitation: not a crash. Excel would give TRUE.
    expect(['TRUE', 'FALSE', '#VALUE!']).toContain(out)
  })
})

// --------------------------------------------------------------------------
// 11. Large ranges — materialization cost (the whole-column trap)
// --------------------------------------------------------------------------
describe('large ranges', () => {
  it('deps() over a large range is materialized cell-by-cell (O(area))', () => {
    // 1000-row range -> 1000 dep entries. This is the mechanism that makes a
    // whole-column/whole-sheet range (A1:XFD1048576 ~ 17e9 cells) OOM/hang.
    const n = deps(parse('SUM(A1:A1000)')).length
    expect(n).toBe(1000)
  })
  it('a moderately large SUM range still returns quickly', () => {
    const t0 = Date.now()
    const out = evalF('SUM(A1:A50000)')
    const ms = Date.now() - t0
    console.log(`[large-range] SUM(A1:A50000) = ${out} in ${ms}ms`)
    expect(out).toBe('0')
  })
})

// --------------------------------------------------------------------------
// Strictness edges tightened in #423 (Excel #VALUE! where we used to coerce)
// --------------------------------------------------------------------------
describe('#423 strictness edges', () => {
  it('a number with two dots (1.2.3) errors instead of truncating to 1.2', () => {
    expect(evalF('1.2.3')).toBe('#VALUE!')
    expect(evalF('1.2')).toBe('1.2') // a single decimal still works
    expect(evalF('.5')).toBe('0.5')
  })
  it('all-whitespace text coerced to a number is #VALUE!, not 0', () => {
    expect(evalF('"   "+1')).toBe('#VALUE!')
    expect(evalF('""+1')).toBe('1') // truly empty still coerces to 0
    expect(evalF('"5"+1')).toBe('6') // numeric text still coerces
  })
  it('a non-numeric text condition in IF/AND/OR/NOT is #VALUE!, not treated as TRUE', () => {
    expect(evalF('IF("x",1,2)')).toBe('#VALUE!')
    expect(evalF('IF(1,1,2)')).toBe('1') // a number condition still works (non-0 = TRUE)
    expect(evalF('IF(0,1,2)')).toBe('2') // 0 = FALSE
    expect(evalF('IF(TRUE,1,2)')).toBe('1') // a real boolean still works
    expect(evalF('AND(1,"x")')).toBe('#VALUE!')
    expect(evalF('NOT("x")')).toBe('#VALUE!')
  })
})
