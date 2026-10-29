import { describe, it, expect } from 'vitest'
import { SheetModel, blankSheet } from './doc'
import {
  borderPatches, mergeOps, currentRegion, hasHeader, sortPatches, autosumFor, autosumBelow, fillPatches, fillSelection,
  findAll, replaceIn, dedupePatches, splitPatches, fitWidth, selectionStats, freeSheetName, validSheetName, validName, clampToUsed, boxRef,
} from './actions'
import type { WorkbookData } from './engine/model'

function setup(rows: string[][]) {
  const book: WorkbookData = { sheets: [blankSheet('S')], names: [] }
  const m = new SheetModel(book)
  const cells = rows.flatMap((row, r) => row.map((input, c) => ({ r, c, input })).filter((x) => x.input !== ''))
  m.apply({ k: 'cells', sheet: 'S', cells })
  const v = (r: number, c: number) => m.engine.value('S', { row: r, col: c })
  return { m, s: m.sheet('S'), v }
}

describe('ribbon actions', () => {
  it('borders: all, outer, bottom, none', () => {
    const { s } = setup([['1', '2'], ['3', '4']])
    const b = { r0: 0, c0: 0, r1: 1, c1: 1 }
    expect(borderPatches(s, b, 'all').every((p) => p.fmt && p.fmt.bd?.t && p.fmt.bd?.l)).toBe(true)
    const outer = borderPatches(s, b, 'outer')
    expect(outer.find((p) => p.r === 0 && p.c === 0)!.fmt!.bd).toEqual({ t: { s: 'thin', c: '#000000' }, l: { s: 'thin', c: '#000000' } })
    expect(outer.find((p) => p.r === 1 && p.c === 1)!.fmt!.bd).toEqual({ b: { s: 'thin', c: '#000000' }, r: { s: 'thin', c: '#000000' } })
    expect(borderPatches(s, b, 'bottom').filter((p) => p.fmt?.bd?.b)).toHaveLength(2)
    expect(borderPatches(s, b, 'none').every((p) => p.fmt === null)).toBe(true)
  })

  it('merge keeps the top-left value and replaces overlapping merges; unmerge removes them', () => {
    const { m, s } = setup([['a', 'b'], ['c', 'd']])
    for (const op of mergeOps(s, { r0: 0, c0: 0, r1: 1, c1: 1 }, true)) m.apply(op)
    expect(m.sheet('S').merges).toEqual(['A1:B2'])
    expect(Object.keys(m.sheet('S').cells)).toEqual(['0,0'])
    for (const op of mergeOps(m.sheet('S'), { r0: 0, c0: 0, r1: 0, c1: 0 }, false)) m.apply(op)
    expect(m.sheet('S').merges).toEqual([])
    expect(mergeOps(s, { r0: 3, c0: 3, r1: 3, c1: 3 }, true)).toEqual([])
  })

  it('current region grows over a contiguous block, including diagonal touches', () => {
    const { s } = setup([['a', 'b', ''], ['c', '', ''], ['', '', ''], ['', '', 'x']])
    const filled = (r: number, c: number) => !!s.cells[`${r},${c}`]
    expect(currentRegion(filled, 1, 0, 99, 25)).toEqual({ r0: 0, c0: 0, r1: 1, c1: 1 })
    expect(currentRegion(filled, 3, 2, 99, 25)).toEqual({ r0: 3, c0: 2, r1: 3, c1: 2 })
  })

  it('sorts by a column, keeps the header, moves formulas with their rows, blanks last', () => {
    const { m, s, v } = setup([['Name', 'Score', 'Double'], ['Omar', '7', '=B2*2'], ['Noura', '9', '=B3*2'], ['', '', ''], ['Ali', '3', '=B5*2']])
    const region = { r0: 0, c0: 0, r1: 4, c1: 2 }
    expect(hasHeader(v, region)).toBe(true)
    m.apply({ k: 'cells', sheet: 'S', cells: sortPatches(s, region, 1, 'desc', v, true) })
    const col = (c: number) => [1, 2, 3, 4].map((r) => m.engine.value('S', { row: r, col: c }))
    expect(col(0)).toEqual(['Noura', 'Omar', 'Ali', ''])
    expect(col(2)).toEqual([18, 14, 6, ''])
    expect(m.sheet('S').cells['0,0'].input).toBe('Name')
  })

  it('a region whose first row is numbers has no header', () => {
    const { v } = setup([['1', '2'], ['3', '4']])
    expect(hasHeader(v, { r0: 0, c0: 0, r1: 1, c1: 1 })).toBe(false)
  })

  it('AutoSum looks up, then left, and sums under a selection', () => {
    const { v } = setup([['1', '5'], ['2', '6'], ['3', ''], ['', '']])
    expect(autosumFor(v, 3, 0)).toBe('=SUM(A1:A3)')
    expect(autosumFor(v, 0, 2)).toBe('=SUM(A1:B1)')
    expect(autosumFor(v, 9, 9)).toBeNull()
    expect(autosumBelow({ r0: 0, c0: 0, r1: 2, c1: 1 }).map((p) => p.input)).toEqual(['=SUM(A1:A3)', '=SUM(B1:B3)'])
  })

  it('fills down a series and copies formats, and fills up and sideways', () => {
    const { m, s } = setup([['1', 'Mon'], ['2', '']])
    m.apply({ k: 'fmt', sheet: 'S', box: { r0: 0, c0: 0, r1: 0, c1: 0 }, patch: { bold: true } })
    const down = fillPatches(m.sheet('S'), { r0: 0, c0: 0, r1: 1, c1: 0 }, { r0: 0, c0: 0, r1: 4, c1: 0 })
    expect(down.map((p) => p.input)).toEqual(['3', '4', '5'])
    expect(down[0].fmt).toEqual({ bold: true })
    expect(down[1].fmt).toBeNull()
    const right = fillPatches(s, { r0: 0, c0: 1, r1: 0, c1: 1 }, { r0: 0, c0: 1, r1: 0, c1: 3 })
    expect(right.map((p) => [p.c, p.input])).toEqual([[2, 'Tue'], [3, 'Wed']])
    const up = fillPatches(s, { r0: 5, c0: 0, r1: 5, c1: 0 }, { r0: 3, c0: 0, r1: 5, c1: 0 })
    expect(up.map((p) => p.r)).toEqual([4, 3])
  })

  it('Ctrl+Enter writes one input everywhere, formulas moved', () => {
    expect(fillSelection('=A1+1', { row: 0, col: 1 }, { r0: 0, c0: 1, r1: 1, c1: 2 }).map((p) => p.input)).toEqual(['=A1+1', '=B1+1', '=A2+1', '=B2+1'])
  })

  it('find in values or formulas, whole cell, match case, across sheets', () => {
    const { m } = setup([['Riyadh', '=1+1'], ['riyadh city', 'x']])
    m.apply({ k: 'sheet-add', name: 'T' })
    m.apply({ k: 'cells', sheet: 'T', cells: [{ r: 0, c: 0, input: 'Riyadh' }] })
    const d = (sh: string, r: number, c: number) => String(m.engine.value(sh, { row: r, col: c }))
    expect(findAll(m.book, 'S', 'riyadh', {}, d)).toHaveLength(2)
    expect(findAll(m.book, 'S', 'Riyadh', { matchCase: true }, d)).toHaveLength(1)
    expect(findAll(m.book, 'S', 'riyadh', { whole: true }, d)).toHaveLength(1)
    expect(findAll(m.book, 'S', 'riyadh', { allSheets: true }, d)).toHaveLength(3)
    expect(findAll(m.book, 'S', '2', {}, d)).toHaveLength(1)
    expect(findAll(m.book, 'S', '1+1', { formulas: true }, d)).toHaveLength(1)
    expect(findAll(m.book, 'S', '', {}, d)).toEqual([])
  })

  it('replace is literal (no regex), case-insensitive unless asked', () => {
    expect(replaceIn('a.b.A', 'a', 'x', {})).toBe('x.b.x')
    expect(replaceIn('a.b.A', '.', '-', {})).toBe('a-b-A')
    expect(replaceIn('a.b.A', 'a', 'x', { matchCase: true })).toBe('x.b.A')
    expect(replaceIn('abc', 'ABC', 'z', { whole: true })).toBe('z')
    expect(replaceIn('abcd', 'abc', 'z', { whole: true })).toBe('abcd')
    expect(replaceIn('price $5', '$5', '$6', {})).toBe('price $6')
  })

  it('removes duplicate rows, keeping the first and the header', () => {
    const { m, s, v } = setup([['Name', 'City'], ['a', 'x'], ['b', 'y'], ['a', 'x'], ['c', 'z'], ['b', 'y']])
    const { patches, removed } = dedupePatches(s, { r0: 0, c0: 0, r1: 5, c1: 1 }, v, true)
    expect(removed).toBe(2)
    m.apply({ k: 'cells', sheet: 'S', cells: patches })
    expect([1, 2, 3, 4, 5].map((r) => m.engine.value('S', { row: r, col: 0 }))).toEqual(['a', 'b', 'c', '', ''])
    expect(dedupePatches(s, { r0: 0, c0: 0, r1: 0, c1: 1 }, v, false).removed).toBe(0)
  })

  it('splits text to columns and leaves formulas alone', () => {
    const { s } = setup([['a, b ,c'], ['=1+1'], ['solo']])
    expect(splitPatches(s, { r0: 0, c0: 0, r1: 2, c1: 0 }, ',').map((p) => [p.r, p.c, p.input])).toEqual([[0, 0, 'a'], [0, 1, 'b'], [0, 2, 'c'], [2, 0, 'solo']])
    expect(splitPatches(s, { r0: 0, c0: 0, r1: 0, c1: 0 }, '')).toEqual([])
  })

  it('fits a width to the widest line, within bounds', () => {
    expect(fitWidth(['ab', 'abcdef\nx'], (t) => t.length * 10)).toBe(74)
    expect(fitWidth([], (t) => t.length)).toBe(40)
    expect(fitWidth(['x'.repeat(1000)], (t) => t.length * 10)).toBe(600)
  })

  it('status bar statistics count values and sum numbers only', () => {
    const { s, v } = setup([['1', 'x'], ['2', '=A1+A2']])
    expect(selectionStats(s, { r0: 0, c0: 0, r1: 1, c1: 1 }, v)).toEqual({ sum: 6, count: 4, nums: 3, min: 1, max: 3 })
  })

  it('names: free sheet names, valid sheet and range names', () => {
    const book: WorkbookData = { sheets: [blankSheet('Data'), blankSheet('Data 2')] }
    expect(freeSheetName(book, 'Data')).toBe('Data 3')
    expect(freeSheetName(book, 'New:Sheet?')).toBe('NewSheet')
    expect(validSheetName('Q1 / Q2')).toBe(false)
    expect(validSheetName('x'.repeat(32))).toBe(false)
    expect(validSheetName('المبيعات')).toBe(true)
    expect(validName('TaxRate')).toBe(true)
    expect(validName('A1')).toBe(false)
    expect(validName('1abc')).toBe(false)
    expect(validName('نسبة_الضريبة')).toBe(true)
  })

  it('a whole-column selection clamps to the used area', () => {
    expect(clampToUsed({ r0: 0, c0: 2, r1: 1_048_575, c1: 2 }, { rows: 40, cols: 6 })).toEqual({ r0: 0, c0: 2, r1: 39, c1: 2 })
    expect(boxRef({ r0: 0, c0: 0, r1: 0, c1: 0 })).toBe('A1')
    expect(boxRef({ r0: 1, c0: 1, r1: 3, c1: 27 })).toBe('B2:AB4')
  })
})
