import { describe, it, expect } from 'vitest'
import { SheetModel, blankSheet, type XOp } from './doc'
import type { WorkbookData } from './engine/model'
import { SeqDoc } from '../../lib/collab/seqDoc'
import { CollabSession, LocalHub } from '../../lib/collab/session'

const book = (): WorkbookData => ({ sheets: [{ ...blankSheet('Sheet1') }, { ...blankSheet('Data') }] })
const v = (m: SheetModel, sheet: string, r: number, c: number) => m.engine.value(sheet, { row: r, col: c })

/** Apply op, then its inverse, and require the book to be exactly what it was. */
function roundTrip(m: SheetModel, op: XOp) {
  const before = JSON.stringify(m.book)
  const inv = m.inverse(op)
  m.apply(op)
  expect(inv).not.toBeNull()
  m.apply(inv!)
  expect(JSON.parse(JSON.stringify(m.book))).toEqual(JSON.parse(before))
}

describe('SheetModel ops', () => {
  it('sets cells and recalculates dependents', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: '2' }, { r: 0, c: 1, input: '=A1*21' }] })
    expect(v(m, 'Sheet1', 0, 1)).toBe(42)
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: '3' }] })
    expect(v(m, 'Sheet1', 0, 1)).toBe(63)
  })

  it('a cells op that changes only the format keeps the input', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 1, c: 1, input: '7' }] })
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 1, c: 1, fmt: { bold: true } }] })
    expect(m.book.sheets[0].cells['1,1']).toEqual({ input: '7', fmt: { bold: true } })
  })

  it('clearing a cell to nothing removes it', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: 'x' }] })
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: '' }] })
    expect(m.book.sheets[0].cells).toEqual({})
  })

  it('keeps a note on an otherwise empty cell', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, note: 'remember' }] })
    expect(m.book.sheets[0].cells['0,0']).toEqual({ input: '', note: 'remember' })
  })

  it('grows the sheet when writing past its edge', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 500, c: 40, input: '1' }] })
    expect(m.book.sheets[0].rows).toBeGreaterThan(500)
    expect(m.book.sheets[0].cols).toBeGreaterThan(40)
  })

  const OPS: XOp[] = [
    { k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: 'new' }, { r: 3, c: 3, input: '=A1', fmt: { italic: true } }] },
    { k: 'fmt', sheet: 'Sheet1', box: { r0: 0, c0: 0, r1: 2, c1: 2 }, patch: { bold: true, bg: '#ff0000' } },
    { k: 'clear', sheet: 'Sheet1', box: { r0: 0, c0: 0, r1: 5, c1: 5 }, what: 'all' },
    { k: 'clear', sheet: 'Sheet1', box: { r0: 0, c0: 0, r1: 5, c1: 5 }, what: 'contents' },
    { k: 'clear', sheet: 'Sheet1', box: { r0: 0, c0: 0, r1: 5, c1: 5 }, what: 'formats' },
    { k: 'props', sheet: 'Sheet1', patch: { freeze: { rows: 2, cols: 0 }, showGrid: false } },
    { k: 'struct', sheet: 'Sheet1', axis: 'row', at: 1, delta: 2 },
    { k: 'struct', sheet: 'Sheet1', axis: 'row', at: 1, delta: -2 },
    { k: 'struct', sheet: 'Sheet1', axis: 'col', at: 0, delta: -1 },
    { k: 'sheet-add', name: 'Extra', at: 1 },
    { k: 'sheet-del', name: 'Data' },
    { k: 'sheet-ren', from: 'Data', to: 'Numbers' },
    { k: 'sheet-move', name: 'Data', to: 0 },
    { k: 'names', names: [{ name: 'Rate', ref: 'Sheet1!$A$1' }] },
  ]
  it.each(OPS)('inverse of $k undoes it exactly', (op) => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [
      { r: 0, c: 0, input: '5', fmt: { bold: true } },
      { r: 1, c: 1, input: 'text', note: 'n' },
      { r: 2, c: 2, input: '=A1+1' },
      { r: 4, c: 0, input: '=SUM(A1:A3)' },
    ] })
    m.apply({ k: 'cells', sheet: 'Data', cells: [{ r: 0, c: 0, input: '=Sheet1!A1*2' }] })
    roundTrip(m, op)
  })

  it('inserting a row moves the cells and rewrites formulas', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: '1' }, { r: 1, c: 0, input: '2' }, { r: 2, c: 0, input: '=SUM(A1:A2)' }] })
    m.apply({ k: 'struct', sheet: 'Sheet1', axis: 'row', at: 1, delta: 1 })
    const s = m.sheet('Sheet1')
    expect(s.cells['2,0'].input).toBe('2')
    expect(s.cells['3,0'].input).toBe('=SUM(A1:A3)')
    expect(v(m, 'Sheet1', 3, 0)).toBe(3)
  })

  it('deleting a referenced row gives #REF!, and undo brings the value back', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: '10' }, { r: 2, c: 0, input: '=A1' }] })
    const op: XOp = { k: 'struct', sheet: 'Sheet1', axis: 'row', at: 0, delta: -1 }
    const inv = m.inverse(op)!
    m.apply(op)
    expect(String(v(m, 'Sheet1', 1, 0))).toContain('#REF!')
    m.apply(inv)
    expect(m.sheet('Sheet1').cells['0,0'].input).toBe('10')
  })

  it('structural edits carry merges, sizes, hidden rows and pictures with them', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'props', sheet: 'Sheet1', patch: {
      merges: ['A3:B4'], rowHeights: { 5: 40 }, hiddenRows: [6], autoFilter: 'A3:C10',
      images: [{ id: 'i', src: 'data:image/png;base64,AA==', anchor: { row: 8, col: 1 }, w: 10, h: 10 }],
    } as never })
    m.apply({ k: 'struct', sheet: 'Sheet1', axis: 'row', at: 0, delta: 2 })
    const s = m.sheet('Sheet1')
    expect(s.merges).toEqual(['A5:B6'])
    expect(s.rowHeights).toEqual({ 7: 40 })
    expect(s.hiddenRows).toEqual([8])
    expect(s.autoFilter).toBe('A5:C12')
    expect(s.images![0].anchor.row).toBe(10)
  })

  it('deleting the rows a merge lives in removes the merge', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'props', sheet: 'Sheet1', patch: { merges: ['A2:B2'] } })
    m.apply({ k: 'struct', sheet: 'Sheet1', axis: 'row', at: 1, delta: -1 })
    expect(m.sheet('Sheet1').merges).toEqual([])
  })

  it('renaming a sheet rewrites the formulas that name it, and defined names', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Data', cells: [{ r: 0, c: 0, input: '4' }] })
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: '=Data!A1*10' }] })
    m.apply({ k: 'names', names: [{ name: 'Base', ref: 'Data!$A$1' }] })
    m.apply({ k: 'sheet-ren', from: 'Data', to: 'My Data' })
    expect(m.sheet('Sheet1').cells['0,0'].input).toBe("='My Data'!A1*10")
    expect(v(m, 'Sheet1', 0, 0)).toBe(40)
    expect(m.book.names![0].ref).toContain("'My Data'")
  })

  it('a rename that has already happened is a no-op (idempotent)', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'sheet-ren', from: 'Data', to: 'X' })
    expect(() => m.apply({ k: 'sheet-ren', from: 'Data', to: 'X' })).not.toThrow()
    expect(m.book.sheets.map((s) => s.name)).toEqual(['Sheet1', 'X'])
  })

  it('refuses a duplicate sheet name, deleting the last sheet, and an oversized format', () => {
    const m = new SheetModel(book())
    expect(() => m.apply({ k: 'sheet-add', name: 'data' })).toThrow('exists')
    expect(() => m.apply({ k: 'sheet-ren', from: 'Sheet1', to: 'DATA' })).toThrow('exists')
    m.apply({ k: 'sheet-del', name: 'Data' })
    expect(() => m.apply({ k: 'sheet-del', name: 'Sheet1' })).toThrow('last-sheet')
    expect(() => m.apply({ k: 'fmt', sheet: 'Sheet1', box: { r0: 0, c0: 0, r1: 1_000_000, c1: 10 }, patch: { bold: true } })).toThrow('too-big')
  })

  it('a deleted sheet referenced elsewhere shows #REF!', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: '=Data!A1' }] })
    m.apply({ k: 'sheet-del', name: 'Data' })
    expect(String(v(m, 'Sheet1', 0, 0))).toContain('#REF!')
  })

  it('replace swaps the whole book, and its inverse restores it', () => {
    const m = new SheetModel(book())
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: 'old' }] })
    roundTrip(m, { k: 'replace', book: { sheets: [{ ...blankSheet('Only'), cells: { '0,0': { input: '1' } } }] } })
  })

  it('load ignores garbage and accepts a real snapshot', () => {
    const m = new SheetModel(book())
    m.load(null)
    m.load({ nope: 1 })
    expect(m.book.sheets).toHaveLength(2)
    m.load({ sheets: [{ ...blankSheet('Z'), cells: { '0,0': { input: '=1+1' } } }] })
    expect(v(m, 'Z', 0, 0)).toBe(2)
  })

  it('notifies subscribers and bumps rev', () => {
    const m = new SheetModel(book())
    let n = 0
    const off = m.subscribe(() => n++)
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: '1' }] })
    off()
    m.apply({ k: 'cells', sheet: 'Sheet1', cells: [{ r: 0, c: 0, input: '2' }] })
    expect(n).toBe(1)
    expect(m.rev).toBe(2)
  })
})

describe('SheetModel under the collaboration sequencer', () => {
  const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)) }
  function peer(hub: LocalHub, id: string, owner: boolean, seed?: WorkbookData) {
    const t = hub.transport(id)
    const model = new SheetModel(seed || book())
    const doc = new SeqDoc<XOp>(model, owner)
    const s = new CollabSession(t.tx, doc, {}, { owner, name: id })
    doc.bind(s)
    t.bind(s.handlers())
    return { model, doc, s }
  }

  it('a guest joining receives the owner workbook, formulas evaluate on its side', async () => {
    const hub = new LocalHub()
    const seed = book()
    seed.sheets[0].cells['0,0'] = { input: '6' }
    seed.sheets[0].cells['0,1'] = { input: '=A1*7' }
    const o = peer(hub, 'o', true, seed); o.s.start()
    const g = peer(hub, 'g', false); g.s.start()
    await flush()
    expect(v(g.model, 'Sheet1', 0, 1)).toBe(42)
  })

  it.each([1, 17, 404, 9001])('converges with mixed cell edits and row inserts (seed %i)', async (seed0) => {
    let seed = seed0
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const hub = new LocalHub()
    const queue: (() => void)[] = []
    hub.deliver = (fn) => queue.push(fn)
    const o = peer(hub, 'o', true); o.s.start()
    const gs = [peer(hub, 'g1', false), peer(hub, 'g2', false)]
    for (const g of gs) g.s.start()
    while (queue.length) queue.shift()!()
    for (let step = 0; step < 200; step++) {
      const actor = rnd() < 0.3 ? o : gs[Math.floor(rnd() * 2)]
      const r = rnd()
      const row = Math.floor(rnd() * 6)
      if (r < 0.5) actor.doc.edit({ k: 'cells', sheet: 'Sheet1', cells: [{ r: row, c: Math.floor(rnd() * 3), input: rnd() < 0.3 ? `=A1+${step}` : String(step) }] })
      else if (r < 0.6) actor.doc.edit({ k: 'fmt', sheet: 'Sheet1', box: { r0: row, c0: 0, r1: row, c1: 1 }, patch: { bold: rnd() < 0.5 } })
      else if (r < 0.68) actor.doc.edit({ k: 'struct', sheet: 'Sheet1', axis: 'row', at: row, delta: rnd() < 0.5 ? 1 : -1 })
      const n = Math.floor(rnd() * 4)
      for (let i = 0; i < n && queue.length; i++) queue.shift()!()
    }
    let guard = 0
    while (queue.length && guard++ < 100000) queue.shift()!()
    for (const g of gs) {
      expect(g.model.book).toEqual(o.model.book)
      expect(g.doc.pendingCount).toBe(0)
    }
  })
})
