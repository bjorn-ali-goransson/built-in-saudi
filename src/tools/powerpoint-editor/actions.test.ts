import { describe, it, expect } from 'vitest'
import { DeckModel, type SOp } from './doc'
import { blankDeck, newSlide, para, plainText, type DeckData, type ShapeEl, type TableEl } from './model'
import { addSlide, duplicateSlide, relayout, zOrder, align, newTable, tableEdit, findAll, replaceHits, resizeDeck, copyEls } from './actions'
import { spread } from './order'

const box = (id: string, x: number, y: number, w = 100, h = 50, ord?: string): ShapeEl => ({ id, ord, kind: 'shape', geom: 'rect', x, y, w, h })
function deck(): DeckData {
  const d = blankDeck(false)
  const s = newSlide('titleContent', d)
  ;(s.elements[0] as ShapeEl).text!.paras = [para('Plan')]
  ;(s.elements[1] as ShapeEl).text!.paras = [para('first', { bullet: 'bullet' }), para('second', { bullet: 'bullet' })]
  const k = spread(5)
  s.elements[0].ord = k[0]; s.elements[1].ord = k[1]
  s.elements.push(box('a', 100, 100, 100, 50, k[2]), box('b', 400, 300, 100, 50, k[3]), box('c', 700, 200, 50, 50, k[4]))
  d.slides = [s]
  return d
}
const apply = (d: DeckData, ops: SOp[]) => { const m = new DeckModel(JSON.parse(JSON.stringify(d))); for (const o of ops) m.apply(o); return m.deck }
const S = (d: DeckData) => d.slides[0]

describe('slide operations', () => {
  it('adds a slide after the current one, keeping its backdrop', () => {
    const d = deck()
    S(d).master = 'L1'
    const { ops, newId } = addSlide(d, S(d).id, 'blank')
    const out = apply(d, ops)
    expect(out.slides.map((s) => s.id)).toEqual([S(d).id, newId])
    expect(out.slides[1].master).toBe('L1')
  })
  it('duplicates with fresh ids', () => {
    const d = deck()
    const { ops, newId } = duplicateSlide(d, S(d).id)
    const out = apply(d, ops)
    expect(out.slides).toHaveLength(2)
    expect(out.slides[1].id).toBe(newId)
    const a = new Set(out.slides[0].elements.map((e) => e.id))
    expect(out.slides[1].elements.some((e) => a.has(e.id))).toBe(false)
  })
  it('a layout change keeps the title and body text, and the other shapes', () => {
    const d = deck()
    const out = apply(d, relayout(d, S(d).id, 'twoContent'))
    const phs = S(out).elements.filter((e): e is ShapeEl => e.kind === 'shape' && !!e.ph)
    expect(phs.map((p) => [p.ph, plainText(p.text)])).toEqual([['title', 'Plan'], ['body', 'first\nsecond'], ['body', '']])
    expect(S(out).elements.filter((e) => !(e.kind === 'shape' && e.ph)).map((e) => e.id).sort()).toEqual(['a', 'b', 'c'])
    expect(S(out).layout).toBe('twoContent')
  })
  it('a layout with no room for the body keeps the text as a plain box', () => {
    const d = deck()
    const out = apply(d, relayout(d, S(d).id, 'titleOnly'))
    expect(S(out).elements.some((e) => e.kind === 'shape' && !e.ph && plainText(e.text) === 'first\nsecond')).toBe(true)
  })
})

describe('arranging', () => {
  it('front, back, forward and backward', () => {
    const d = deck()
    const order = (dd: DeckData) => S(dd).elements.filter((e) => ['a', 'b', 'c'].includes(e.id)).map((e) => e.id).join('')
    expect(order(apply(d, zOrder(S(d), ['a'], 'front')))).toBe('bca')
    expect(order(apply(d, zOrder(S(d), ['c'], 'back')))).toBe('cab')
    expect(order(apply(d, zOrder(S(d), ['a'], 'forward')))).toBe('bac')
    expect(order(apply(d, zOrder(S(d), ['c'], 'backward')))).toBe('acb')
    expect(S(apply(d, zOrder(S(d), ['a'], 'back'))).elements[0].id).toBe('a')
  })
  it('one element aligns to the slide, several to the box around them, three distribute evenly', () => {
    const d = deck()
    const one = S(apply(d, align(d, S(d), ['a'], 'centreH'))).elements.find((e) => e.id === 'a')!
    expect(one.x).toBe(430)
    const many = S(apply(d, align(d, S(d), ['a', 'b', 'c'], 'top'))).elements.filter((e) => ['a', 'b', 'c'].includes(e.id))
    expect(many.map((e) => e.y)).toEqual([100, 100, 100])
    const dist = S(apply(d, align(d, S(d), ['a', 'b', 'c'], 'distH'))).elements.filter((e) => ['a', 'b', 'c'].includes(e.id))
    const gaps = [dist[1].x - (dist[0].x + dist[0].w), dist[2].x - (dist[1].x + dist[1].w)]
    expect(gaps[0]).toBeCloseTo(gaps[1], 6)
  })
  it('copies paste on top, offset, in order', () => {
    const d = deck()
    const c = copyEls(S(d), S(d).elements.filter((e) => e.id === 'a' || e.id === 'b'))
    expect(c.map((e) => [e.x, e.y])).toEqual([[112, 112], [412, 312]])
    expect(c[0].ord! > S(d).elements[S(d).elements.length - 1].ord!).toBe(true)
    expect(c[1].ord! > c[0].ord!).toBe(true)
  })
})

describe('tables', () => {
  it('rows and columns grow and shrink the table; merge keeps the text; split undoes it', () => {
    const d = deck()
    let t: TableEl = newTable(d, 2, 3)
    t.rows[0].cells[0].text.paras = [para('A')]
    t.rows[0].cells[1].text.paras = [para('B')]
    t = { ...t, ...tableEdit(t, 'rowBelow', [0, 0])! }
    expect(t.rows).toHaveLength(3)
    t = { ...t, ...tableEdit(t, 'colAfter', [0, 2])! }
    expect(t.cols).toHaveLength(4)
    expect(t.rows.every((r) => r.cells.length === 4)).toBe(true)
    t = { ...t, ...tableEdit(t, 'merge', [0, 0], [0, 1])! }
    expect(t.rows[0].cells[0].span).toEqual([1, 2])
    expect(t.rows[0].cells[1].merged).toBe(true)
    expect(plainText(t.rows[0].cells[0].text)).toBe('A\nB')
    t = { ...t, ...tableEdit(t, 'split', [0, 0])! }
    expect(t.rows[0].cells[0].span).toBeUndefined()
    expect(t.rows[0].cells[1].merged).toBeUndefined()
    t = { ...t, ...tableEdit(t, 'deleteCol', [0, 3])! }
    expect(t.cols).toHaveLength(3)
    expect(tableEdit({ ...t, cols: [100] , rows: t.rows.map((r) => ({ ...r, cells: r.cells.slice(0, 1) })) }, 'deleteCol', [0, 0])).toBeNull()
  })
})

describe('find, replace and resizing', () => {
  it('finds across shapes and tables, and replaces', () => {
    const d = deck()
    const t = newTable(d, 1, 1)
    t.rows[0].cells[0].text.paras = [para('second hand')]
    S(d).elements.push(t)
    const hits = findAll(d, 'SECOND')
    expect(hits).toHaveLength(2)
    expect(findAll(d, 'SECOND', true)).toHaveLength(0)
    const out = apply(d, replaceHits(d, hits, 'next'))
    expect(plainText((S(out).elements.find((e) => e.kind === 'shape' && e.ph === 'body') as ShapeEl).text)).toBe('first\nnext')
    expect(plainText((S(out).elements.find((e) => e.kind === 'table') as TableEl).rows[0].cells[0].text)).toBe('next hand')
  })
  it('16:9 → 4:3 scales horizontally so nothing falls off', () => {
    const d = deck()
    const out = apply(d, resizeDeck(d, { w: 720, h: 540 }))
    expect(out.size).toEqual({ w: 720, h: 540 })
    expect(Math.max(...S(out).elements.map((e) => e.x + e.w))).toBeLessThanOrEqual(720)
    expect(S(out).elements.find((e) => e.id === 'c')!.x).toBe(525)
  })
})
