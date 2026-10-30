import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { Axis, expandForMerges, jump, normBox } from './geometry'
import { parseTsv, toTsv, toHtml, readPayload, parseHtmlTable, pastePatches, textPayload, type ClipPayload } from './clipboard'
import { extendSeries } from './fill'

describe('Axis', () => {
  it('offsets and hit-testing agree for uniform sizes', () => {
    const a = new Axis(1000, () => 20)
    expect(a.offset(0)).toBe(0)
    expect(a.offset(10)).toBe(200)
    expect(a.total).toBe(20000)
    expect(a.at(199)).toBe(9)
    expect(a.at(200)).toBe(10)
    expect(a.at(-5)).toBe(0)
    expect(a.at(1e9)).toBe(999)
  })

  it('handles hidden (zero-size) lines and a million rows lazily', () => {
    const a = new Axis(1_048_576, (i) => (i % 2 ? 0 : 10))
    expect(a.offset(4)).toBe(20)
    expect(a.at(25)).toBe(4)
    expect(a.offset(1_000_000)).toBe(5_000_000)
  })

  it('at(offset(i)) is i for every visible line (property)', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 900 }), fc.nat(), (sizes, k) => {
      const a = new Axis(sizes.length, (i) => sizes[i])
      const i = k % sizes.length
      if (sizes[i] === 0) return true
      return a.at(a.offset(i)) === i && a.at(a.offset(i) + sizes[i] - 1) === i
    }))
  })

  it('range includes overscan and clamps', () => {
    const a = new Axis(100, () => 10)
    expect(a.range(100, 200, 2)).toEqual([8, 22])
    expect(a.range(0, 30, 5)).toEqual([0, 8])
  })
})

describe('selection helpers', () => {
  it('normBox orders corners', () => expect(normBox({ row: 5, col: 1 }, { row: 2, col: 4 })).toEqual({ r0: 2, c0: 1, r1: 5, c1: 4 }))
  it('a selection that cuts a merge grows to contain it, transitively', () => {
    const merges = [{ r0: 2, c0: 2, r1: 3, c1: 4 }, { r0: 3, c0: 4, r1: 6, c1: 5 }]
    expect(expandForMerges({ r0: 0, c0: 0, r1: 2, c1: 2 }, merges)).toEqual({ r0: 0, c0: 0, r1: 6, c1: 5 })
  })
  it('Ctrl+Arrow runs to the edge of a data block, then to the next block, then to the sheet edge', () => {
    const filled = new Set(['0,0', '1,0', '2,0', '6,0'])
    const f = (r: number, c: number) => filled.has(`${r},${c}`)
    expect(jump(f, 0, 0, 1, 0, 99, 9)).toEqual({ row: 2, col: 0 })
    expect(jump(f, 2, 0, 1, 0, 99, 9)).toEqual({ row: 6, col: 0 })
    expect(jump(f, 6, 0, 1, 0, 99, 9)).toEqual({ row: 99, col: 0 })
    expect(jump(f, 6, 0, -1, 0, 99, 9)).toEqual({ row: 2, col: 0 })
    expect(jump(f, 0, 0, 0, -1, 99, 9)).toEqual({ row: 0, col: 0 })
  })
})

describe('clipboard', () => {
  it('TSV round-trips tabs, newlines and quotes', () => {
    fc.assert(fc.property(fc.array(fc.array(fc.string(), { minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 4 }), (rows) => {
      const width = rows[0].length
      const grid = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
      // A trailing empty row is indistinguishable from the newline Excel ends every copy with.
      if (grid[grid.length - 1].every((v) => v === '')) return true
      expect(parseTsv(toTsv(grid))).toEqual(grid)
      return true
    }))
  })
  it('reads Excel-style CRLF text', () => expect(parseTsv('a\tb\r\nc\td\r\n')).toEqual([['a', 'b'], ['c', 'd']]))

  it('our HTML carries our cells; a foreign table reads as text', () => {
    const p: ClipPayload = { v: 1, rows: 1, cols: 2, cells: [{ r: 0, c: 0, input: '=B1*2', fmt: { bold: true } }, { r: 0, c: 1, input: 'نص' }], o: [3, 3] }
    const html = toHtml([['4', 'نص']], p)
    expect(readPayload(html)).toEqual(p)
    expect(parseHtmlTable(html)).toEqual([['4', 'نص']])
    expect(parseHtmlTable('<meta charset=utf-8><table><tr><th>A &amp; B</th><td colspan="2">x<br>y</td></tr><tr><td>&nbsp;1</td></tr></table>')).toEqual([['A & B', 'x\ny', ''], ['1']])
    expect(readPayload('<table><tr><td>1</td></tr></table>')).toBeNull()
    expect(parseHtmlTable('<p>no table</p>')).toBeNull()
  })

  it('a pasted formula moves by the distance pasted; after a cut it does not', () => {
    const p: ClipPayload = { v: 1, rows: 1, cols: 1, cells: [{ r: 0, c: 0, input: '=A1+$B$1' }], o: [0, 2] }
    expect(pastePatches(p, { row: 2, col: 3 })[0].input).toBe('=B3+$B$1')
    expect(pastePatches({ ...p, cut: { sheet: 'S' } }, { row: 2, col: 3 })[0].input).toBe('=A1+$B$1')
  })

  it('tiles a block over a selection that is a multiple of it', () => {
    const p = textPayload([['1', '2']])
    const out = pastePatches(p, { row: 0, col: 0 }, { rows: 3, cols: 4 })
    expect(out).toHaveLength(12)
    expect(out.filter((x) => x.input === '2')).toHaveLength(6)
  })

  it('paste values / formats only', () => {
    const p: ClipPayload = { v: 1, rows: 1, cols: 1, cells: [{ r: 0, c: 0, input: '=1+1', fmt: { italic: true } }], o: [0, 0] }
    expect(pastePatches(p, { row: 0, col: 0 }, undefined, { valuesOnly: true, values: () => '2' })[0]).toEqual({ r: 0, c: 0, input: '2' })
    expect(pastePatches(p, { row: 0, col: 0 }, undefined, { formatsOnly: true })[0]).toEqual({ r: 0, c: 0, fmt: { italic: true } })
  })
  it('empty cells in the copied block clear the target', () => {
    const p = textPayload([['a', ''], ['', 'b']])
    expect(pastePatches(p, { row: 0, col: 0 }).map((x) => x.input)).toEqual(['a', '', '', 'b'])
  })
})

describe('fill series', () => {
  const S = { dRow: 1, dCol: 0 }
  it('numbers continue their trend; one number copies', () => {
    expect(extendSeries(['1', '3'], 3, S)).toEqual(['5', '7', '9'])
    expect(extendSeries(['0.5', '1'], 2, S)).toEqual(['1.5', '2'])
    expect(extendSeries(['10', '8', '6'], 2, S)).toEqual(['4', '2'])
    expect(extendSeries(['7'], 3, S)).toEqual(['7', '7', '7'])
  })
  it('text with a number counts on, keeping zero padding', () => {
    expect(extendSeries(['Item 1'], 3, S)).toEqual(['Item 2', 'Item 3', 'Item 4'])
    expect(extendSeries(['Q-009'], 2, S)).toEqual(['Q-010', 'Q-011'])
    expect(extendSeries(['Week 2', 'Week 4'], 2, S)).toEqual(['Week 6', 'Week 8'])
  })
  it('days and months continue, in English and Arabic', () => {
    expect(extendSeries(['Friday'], 3, S)).toEqual(['Saturday', 'Sunday', 'Monday'])
    expect(extendSeries(['JAN'], 2, S)).toEqual(['FEB', 'MAR'])
    expect(extendSeries(['الخميس'], 2, S)).toEqual(['الجمعة', 'السبت'])
    expect(extendSeries(['شعبان'], 2, S)).toEqual(['رمضان', 'شوال'])
  })
  it('dates step by a day, or by the step two dates set, or by month', () => {
    expect(extendSeries(['2026-02-27'], 3, S)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02'])
    expect(extendSeries(['2026-01-01', '2026-01-08'], 2, S)).toEqual(['2026-01-15', '2026-01-22'])
    expect(extendSeries(['2026-11-01', '2026-12-01'], 2, S)).toEqual(['2027-01-01', '2027-02-01'])
  })
  it('formulas move their relative references by how far each copy is', () => {
    expect(extendSeries(['=A1*2'], 2, S)).toEqual(['=A2*2', '=A3*2'])
    expect(extendSeries(['=A1', '=B1'], 3, { dRow: 0, dCol: 1 })).toEqual(['=C1', '=D1', '=E1'])
  })
  it('anything else repeats', () => expect(extendSeries(['x', 'y'], 3, S)).toEqual(['x', 'y', 'x']))
  it('nothing to extend', () => { expect(extendSeries([], 3, S)).toEqual([]); expect(extendSeries(['1'], 0, S)).toEqual([]) })
})

describe('Axis offsets, against a plain running sum', () => {
  it('agree for every line, with hidden lines and odd sizes, across block boundaries', () => {
    const size = (i: number) => (i % 7 === 3 ? 0 : 10 + (i % 5))
    const a = new Axis(1000, size)
    let o = 0
    for (let i = 0; i <= 1000; i++) {
      expect(a.offset(i)).toBe(o)
      if (i < 1000) {
        // Every pixel inside a visible line maps back to that line.
        if (size(i) > 0) { expect(a.at(o)).toBe(i); expect(a.at(o + size(i) - 1)).toBe(i) }
        o += size(i)
      }
    }
    expect(a.total).toBe(o)
    expect(a.at(o + 50)).toBe(999)
  })
})
