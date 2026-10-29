import { describe, it, expect } from 'vitest'
import { Workbook, displayValue } from './engine'
import { cellKey, parseA1, type SheetData, type Cell } from './model'
import { dateToSerial } from './dates'

function wb(cells: Record<string, string>, extra: SheetData[] = [], names: { name: string; ref: string; sheet?: string }[] = []) {
  const c: Record<string, Cell> = {}
  for (const [a, input] of Object.entries(cells)) { const p = parseA1(a)!; c[cellKey(p.row, p.col)] = { input } }
  return new Workbook([{ name: 'Sheet1', cells: c, rows: 50, cols: 12 }, ...extra], names)
}
const v = (w: Workbook, a: string, sheet = 'Sheet1') => w.value(sheet, parseA1(a)!)
const d = (w: Workbook, a: string) => displayValue(v(w, a))

describe('new syntax', () => {
  it('whole-column ranges read only what the column holds, and grow with it', () => {
    const w = wb({ A1: '1', A2: '2', A3: '3', B1: '=SUM(A:A)', C1: '=COUNT(A:A)' })
    expect(v(w, 'B1')).toBe(6)
    w.setInput('Sheet1', parseA1('A40')!, '10')
    expect(v(w, 'B1')).toBe(16)
    expect(v(w, 'C1')).toBe(4)
  })
  it('whole-row ranges', () => {
    const w = wb({ A2: '5', B2: '7', C2: '=A2*0', A5: '=SUM(2:2)' })
    expect(v(w, 'A5')).toBe(12)
  })
  it('error literals', () => {
    const w = wb({ A1: '=#N/A', A2: '=IFNA(A1,"none")', A3: '=ISNA(#N/A)', A4: '=#REF!+1' })
    expect(d(w, 'A1')).toBe('#N/A')
    expect(v(w, 'A2')).toBe('none')
    expect(v(w, 'A3')).toBe(true)
    expect(d(w, 'A4')).toBe('#REF!')
  })
  it('array constants', () => {
    const w = wb({ A1: '=SUM({1,2;3,4})', A2: '=SUMPRODUCT({1,2,3},{4,5,6})', A3: '=INDEX({10,20;30,40},2,1)' })
    expect(v(w, 'A1')).toBe(10)
    expect(v(w, 'A2')).toBe(32)
    expect(v(w, 'A3')).toBe(30)
  })
  it('defined names, global and sheet-scoped, and an unknown name is #NAME?', () => {
    const w = wb({ A1: '0.15', A2: '200', B1: '=A2*TaxRate', B2: '=Undefined+1', B3: '=SUM(Prices)' }, [], [
      { name: 'TaxRate', ref: 'Sheet1!$A$1' },
      { name: 'Prices', ref: '=Sheet1!$A$1:$A$2' },
    ])
    expect(v(w, 'B1')).toBe(30)
    expect(d(w, 'B2')).toBe('#NAME?')
    expect(v(w, 'B3')).toBeCloseTo(200.15)
    // A name is a real dependency: changing what it points at updates the result.
    w.setInput('Sheet1', parseA1('A1')!, '0.1')
    expect(v(w, 'B1')).toBe(20)
  })
  it('ROW and COLUMN, with and without arguments', () => {
    const w = wb({ C5: '=ROW()', D7: '=COLUMN()', A1: '=ROW(B9)', A2: '=COLUMNS(A1:D1)', A3: '=ROWS(A1:A10)' })
    expect(v(w, 'C5')).toBe(5)
    expect(v(w, 'D7')).toBe(4)
    expect(v(w, 'A1')).toBe(9)
    expect(v(w, 'A2')).toBe(4)
    expect(v(w, 'A3')).toBe(10)
  })
  it('a leading apostrophe keeps a number as text', () => {
    const w = wb({ A1: "'0501234567", A2: '=ISTEXT(A1)' })
    expect(v(w, 'A1')).toBe('0501234567')
    expect(v(w, 'A2')).toBe(true)
  })
  it('implicit intersection: =A:A in row 3 reads A3', () => {
    const w = wb({ A3: '42', B3: '=A:A*2' })
    expect(v(w, 'B3')).toBe(84)
  })
})

describe('new functions', () => {
  it.each([
    ['=SUMPRODUCT(A1:A3,B1:B3)', 1 * 4 + 2 * 5 + 3 * 6],
    ['=LARGE(A1:A3,1)', 3],
    ['=SMALL(A1:A3,2)', 2],
    ['=RANK(2,A1:A3)', 2],
    ['=MEDIAN(A1:A3)', 2],
    ['=MODE(1,2,2,3)', 2],
    ['=STDEV.P(2,4,4,4,5,5,7,9)', 2],
    ['=VAR.S(1,2,3,4)', 1.6666666667],
    ['=PERCENTILE(A1:A3,0.5)', 2],
    ['=QUARTILE(A1:A3,1)', 1.5],
    ['=MAXIFS(B1:B3,A1:A3,">1")', 6],
    ['=MINIFS(B1:B3,A1:A3,">1")', 5],
    ['=COUNTBLANK(C1:C3)', 3],
    ['=IFS(A1>5,"big",A1>0,"small")', 'small'],
    ['=SWITCH(A2,1,"one",2,"two","other")', 'two'],
    ['=CHOOSE(3,"a","b","c")', 'c'],
    ['=XOR(TRUE,FALSE)', true],
    ['=TEXTJOIN(", ",TRUE,"a","","b")', 'a, b'],
    ['=PROPER("hello wORLD")', 'Hello World'],
    ['=REPT("ab",3)', 'ababab'],
    ['=VALUE("1,234.5")', 1234.5],
    ['=VALUE("15%")', 0.15],
    ['=TEXT(0.256,"0.0%")', '25.6%'],
    ['=TEXT(1234.5,"#,##0.00")', '1,234.50'],
    ['=EXACT("A","a")', false],
    ['=REPLACE("abcdef",2,3,"X")', 'aXef'],
    ['=TRUNC(-2.789,1)', -2.7],
    ['=MROUND(17,5)', 15],
    ['=GCD(12,18)', 6],
    ['=LCM(4,6)', 12],
    ['=QUOTIENT(7,2)', 3],
    ['=LOG(8,2)', 3],
    ['=FACT(5)', 120],
    ['=EVEN(3)', 4],
    ['=ODD(4)', 5],
    ['=SIGN(-3)', -1],
    ['=ISEVEN(4)', true],
    ['=TYPE("x")', 2],
    ['=HOUR(TIME(13,45,10))', 13],
    ['=MINUTE(TIME(13,45,10))', 45],
    ['=SECOND(TIME(13,45,10))', 10],
    ['=NPV(0.1,-100,60,60)', -100 / 1.1 + 60 / 1.21 + 60 / 1.331],
    ['=LOOKUP(2.5,A1:A3,B1:B3)', 5],
    ['=CORREL(A1:A3,B1:B3)', 1],
  ])('%s', (f, want) => {
    const w = wb({ A1: '1', A2: '2', A3: '3', B1: '4', B2: '5', B3: '6', Z1: f })
    const got = v(w, 'Z1')
    if (typeof want === 'number') expect(got as number).toBeCloseTo(want, 6)
    else expect(got).toBe(want)
  })

  it('IRR finds the rate where NPV is zero', () => {
    const w = wb({ A1: '-1000', A2: '300', A3: '400', A4: '500', B1: '=IRR(A1:A4)', B2: '=IRR({1,2,3})' })
    const r = v(w, 'B1') as number
    expect(-1000 + 300 / (1 + r) + 400 / (1 + r) ** 2 + 500 / (1 + r) ** 3).toBeCloseTo(0, 6)
    expect(d(w, 'B2')).toBe('#NUM!')
  })

  it('NETWORKDAYS knows the Saudi weekend (code 7 = Friday + Saturday)', () => {
    const sun = dateToSerial(2026, 9, 6) // a Sunday
    const sat = dateToSerial(2026, 9, 12)
    const w = wb({ A1: String(sun), A2: String(sat), B1: '=NETWORKDAYS(A1,A2)', B2: '=NETWORKDAYS.INTL(A1,A2,7)', B3: '=WORKDAY.INTL(A1,5,7)' })
    expect(v(w, 'B1')).toBe(5) // Mon-Fri
    expect(v(w, 'B2')).toBe(5) // Sun-Thu
    expect(v(w, 'B3')).toBe(dateToSerial(2026, 9, 13)) // next Sunday
  })

  it('DATEDIF, YEARFRAC, WEEKNUM, ISOWEEKNUM', () => {
    const a = dateToSerial(2020, 2, 15), b = dateToSerial(2026, 9, 7)
    const w = wb({ A1: String(a), A2: String(b), B1: '=DATEDIF(A1,A2,"Y")', B2: '=DATEDIF(A1,A2,"YM")', B3: '=DATEDIF(A1,A2,"MD")', B4: '=ISOWEEKNUM(A2)', B5: '=YEARFRAC(A1,A2,1)' })
    expect(v(w, 'B1')).toBe(6)
    expect(v(w, 'B2')).toBe(6)
    expect(v(w, 'B3')).toBe(23)
    expect(v(w, 'B4')).toBe(37)
    expect(v(w, 'B5') as number).toBeCloseTo(6.56, 1)
  })

  it('loan functions are deliberately absent', () => {
    const w = wb({ A1: '=PMT(0.05,12,1000)', A2: '=RATE(12,-100,1000)' })
    expect(d(w, 'A1')).toBe('#NAME?')
    expect(d(w, 'A2')).toBe('#NAME?')
  })
})

describe('incremental recalculation', () => {
  it('matches a full recalculation under random edits (fuzz)', () => {
    let seed = 42
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const cols = 'ABCDEF'
    const addrs: string[] = []
    for (const c of cols) for (let r = 1; r <= 8; r++) addrs.push(c + r)
    const inputs: Record<string, string> = {}
    const w = wb({})
    const pick = () => addrs[Math.floor(rnd() * addrs.length)]
    for (let step = 0; step < 400; step++) {
      const a = pick()
      const roll = rnd()
      let input: string
      if (roll < 0.35) input = String(Math.floor(rnd() * 100))
      else if (roll < 0.5) input = ''
      else if (roll < 0.7) input = `=${pick()}+${pick()}`
      else if (roll < 0.85) input = `=SUM(${pick()}:${pick()})`
      else if (roll < 0.95) input = `=IF(${pick()}>50,${pick()},0)`
      else input = `=SUM(${cols[Math.floor(rnd() * cols.length)]}:${cols[Math.floor(rnd() * cols.length)]})`
      inputs[a] = input
      w.setInput('Sheet1', parseA1(a)!, input)
      if (step % 20 === 0) {
        // Read a few values mid-stream so the cache is warm when the next edit invalidates it.
        for (let k = 0; k < 6; k++) v(w, pick())
      }
    }
    const fresh = wb(Object.fromEntries(Object.entries(inputs).filter(([, x]) => x !== '')))
    for (const a of addrs) expect(d(w, a), a).toBe(d(fresh, a))
  })

  it('a batch recalculates once and lands the same', () => {
    const w = wb({ A1: '1', B1: '=A1*2' })
    w.batch(() => {
      w.setInput('Sheet1', parseA1('A1')!, '5')
      w.setInput('Sheet1', parseA1('A2')!, '=B1+1')
    })
    expect(v(w, 'A2')).toBe(11)
  })

  it('cross-sheet dependencies invalidate, and adding a sheet heals #REF!', () => {
    const w = wb({ A1: '=Data!A1*2' })
    expect(d(w, 'A1')).toBe('#REF!')
    w.addSheet('Data')
    w.setInput('Data', parseA1('A1')!, '21')
    expect(v(w, 'A1')).toBe(42)
  })

  it('cycles are #CIRC! and recover when broken', () => {
    const w = wb({ A1: '=B1', B1: '=A1' })
    expect(d(w, 'A1')).toBe('#CIRC!')
    w.setInput('Sheet1', parseA1('B1')!, '3')
    expect(v(w, 'A1')).toBe(3)
  })

  it('volatile functions recompute on any edit', () => {
    const w = wb({ A1: '=RAND()' })
    const first = v(w, 'A1')
    w.setInput('Sheet1', parseA1('Z9')!, '1')
    expect(v(w, 'A1')).not.toBe(first)
  })

  it('reports dependents and precedents', () => {
    const w = wb({ A1: '1', B1: '=A1+1', C1: '=SUM(A1:B1)' })
    expect(w.dependents('Sheet1', parseA1('A1')!).sort()).toEqual(['Sheet1!0,1', 'Sheet1!0,2'])
    expect(w.precedents('Sheet1', parseA1('C1')!).ranges).toEqual(['Sheet1!0,0:0,1'])
  })

  it('a 50,000-cell workbook loads lazily and an edit is fast', () => {
    const cells: Record<string, string> = {}
    for (let r = 1; r <= 10000; r++) { cells[`A${r}`] = String(r); cells[`B${r}`] = `=A${r}*2`; cells[`C${r}`] = `=B${r}+A${r}` }
    cells.D1 = '=SUM(C:C)'
    const t0 = performance.now()
    const w = wb(cells)
    const t1 = performance.now()
    expect(v(w, 'D1')).toBe(3 * (10000 * 10001) / 2)
    const t2 = performance.now()
    w.setInput('Sheet1', parseA1('A5000')!, '0')
    expect(v(w, 'D1')).toBe(3 * (10000 * 10001) / 2 - 15000)
    const t3 = performance.now()
    expect(t1 - t0).toBeLessThan(3000)
    expect(t3 - t2).toBeLessThan(t2 - t1 + 200) // the edit is no slower than the first full read
  })
})
