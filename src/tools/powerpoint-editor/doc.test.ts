import { describe, it, expect } from 'vitest'
import { DeckModel, wire, type SOp } from './doc'
import { SeqDoc } from '../../lib/collab/seqDoc'
import { CollabSession, LocalHub } from '../../lib/collab/session'
import { blankDeck, newSlide, body, para, type DeckData, type ShapeEl } from './model'
import { between, spread, ordAfter, ordEnd } from './order'

const box = (id: string, x = 10, ord?: string): ShapeEl => ({ id, ord, kind: 'shape', geom: 'rect', x, y: 10, w: 100, h: 50, fill: { type: 'solid', color: 'accent1' } })
function deck(): DeckData {
  const d = blankDeck(false)
  const [a, b, c] = spread(3)
  d.slides = [{ id: 'A', ord: a, elements: [box('a1', 10, 'm')] }, { id: 'B', ord: b, elements: [] }, { id: 'C', ord: c, elements: [] }]
  return d
}
const ids = (m: DeckModel) => m.deck.slides.map((s) => s.id).join('')

describe('order keys', () => {
  it('between always lands strictly between, never ending in 0', () => {
    let seed = 7
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const keys = [between(null, null)]
    for (let i = 0; i < 3000; i++) {
      const j = Math.floor(rnd() * (keys.length + 1))
      const k = between(keys[j - 1] ?? null, keys[j] ?? null)
      if (j > 0) expect(k > keys[j - 1]).toBe(true)
      if (j < keys.length) expect(k < keys[j]).toBe(true)
      expect(k.endsWith('0')).toBe(false)
      keys.splice(j, 0, k)
    }
    expect([...keys].sort()).toEqual(keys)
    // Inserting always at the same spot does not explode the length.
    let lo = 'a'
    const hi = 'b'
    for (let i = 0; i < 200; i++) lo = between(lo, hi)
    expect(lo.length).toBeLessThan(80)
  })
  it('spread gives increasing keys and ordAfter puts things where asked', () => {
    const ks = spread(250)
    expect([...ks].sort()).toEqual(ks)
    expect(new Set(ks).size).toBe(250)
    const list = ['p', 'q', 'r'].map((id, i) => ({ id, ord: ks[i] }))
    const k = ordAfter(list, 'p')
    expect(k > list[0].ord && k < list[1].ord).toBe(true)
    expect(ordAfter(list, null) < list[0].ord).toBe(true)
    expect(ordEnd(list) > list[2].ord).toBe(true)
  })
})

describe('DeckModel ops', () => {
  it('adds and moves are idempotent', () => {
    const m = new DeckModel(deck())
    const add: SOp = { k: 'slide-add', slide: { id: 'X', ord: ordAfter(m.deck.slides, 'A'), elements: [] } }
    m.apply(add); m.apply(add)
    expect(ids(m)).toBe('AXBC')
    const mv: SOp = { k: 'slide-move', id: 'C', ord: ordAfter(m.deck.slides, null) }
    m.apply(mv); m.apply(mv)
    expect(ids(m)).toBe('CAXB')
  })

  it('deletes forgive, and edits to a deleted element do nothing', () => {
    const m = new DeckModel(deck())
    m.apply({ k: 'el-del', slide: 'A', ids: ['a1'] })
    m.apply({ k: 'el-del', slide: 'A', ids: ['a1'] })
    m.apply({ k: 'el-set', slide: 'A', id: 'a1', patch: { x: 99 } })
    m.apply({ k: 'slide-del', id: 'B' }); m.apply({ k: 'slide-del', id: 'B' })
    expect(m.deck.slides.find((s) => s.id === 'A')!.elements).toEqual([])
    expect(ids(m)).toBe('AC')
  })

  it('removing a field survives the trip as JSON', () => {
    const m = new DeckModel(deck())
    m.apply({ k: 'el-set', slide: 'A', id: 'a1', patch: { rot: 30 } })
    const op = JSON.parse(JSON.stringify(wire({ k: 'el-set', slide: 'A', id: 'a1', patch: { rot: undefined, x: 5 } })))
    m.apply(op)
    expect('rot' in m.el('A', 'a1')!).toBe(false)
    expect(m.el('A', 'a1')!.x).toBe(5)
  })

  it.each<[string, SOp]>([
    ['add slide', { k: 'slide-add', slide: { id: 'X', ord: 'zz', elements: [box('x1')] } }],
    ['delete slide', { k: 'slide-del', id: 'A' }],
    ['move slide', { k: 'slide-move', id: 'A', ord: 'zz' }],
    ['slide notes', { k: 'slide-set', id: 'B', patch: { notes: 'hello', hidden: true } }],
    ['clear notes', { k: 'slide-set', id: 'B', patch: {}, unset: ['notes'] }],
    ['add element', { k: 'el-add', slide: 'B', el: box('b1', 1, 'a') }],
    ['replace element', { k: 'el-add', slide: 'A', el: box('a1', 300, 'm') }],
    ['delete elements', { k: 'el-del', slide: 'A', ids: ['a1', 'a2'] }],
    ['set element', { k: 'el-set', slide: 'A', id: 'a1', patch: { x: 400, text: body([para('hi')]) } }],
    ['raise element', { k: 'el-z', slide: 'A', id: 'a1', ord: 'zz' }],
    ['theme', { k: 'deck-set', patch: { theme: { name: 'X', colors: { ...deck().theme.colors, accent1: '#ff0000' }, fonts: { major: 'A', minor: 'B' } } } }],
  ])('inverse undoes %s exactly', (_n, op) => {
    const m = new DeckModel(deck())
    m.apply({ k: 'el-add', slide: 'A', el: box('a2', 50, 'n') })
    m.apply({ k: 'slide-set', id: 'B', patch: { notes: 'was here' } })
    const before = JSON.stringify(m.deck)
    const inv = m.inverse(op)
    m.apply(op)
    expect(JSON.stringify(m.deck)).not.toBe(before)
    for (const o of inv) m.apply(o)
    expect(JSON.stringify(m.deck)).toBe(before)
  })

  it('a new slide of a layout has empty placeholders — the prompt is never content', () => {
    const s = newSlide('titleContent', { size: { w: 960, h: 540 }, rtl: true })
    const phs = s.elements.filter((e) => e.kind === 'shape' && e.ph) as ShapeEl[]
    expect(phs.map((p) => p.ph)).toEqual(['title', 'body'])
    for (const p of phs) expect(p.text!.paras.map((x) => x.runs.length)).toEqual([0])
    expect(phs[0].text!.paras[0].rtl).toBe(true)
  })
})

describe('DeckModel under the collaboration sequencer', () => {
  const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)) }
  function peer(hub: LocalHub, id: string, owner: boolean, seed?: DeckData) {
    const t = hub.transport(id)
    const model = new DeckModel(seed || deck())
    const doc = new SeqDoc<SOp>(model, owner)
    const s = new CollabSession(t.tx, doc, {}, { owner, name: id })
    doc.bind(s)
    t.bind(s.handlers())
    return { model, doc, s }
  }

  it('a guest joining receives the owner deck', async () => {
    const hub = new LocalHub()
    const seed = deck()
    seed.slides[1].notes = 'speaker notes'
    const o = peer(hub, 'o', true, seed); o.s.start()
    const g = peer(hub, 'g', false, blankDeck(false)); g.s.start()
    await flush()
    expect(g.model.deck).toEqual(o.model.deck)
  })

  it.each([3, 29, 777, 31337, 5, 123456])('converges with concurrent slide and element edits (seed %i)', async (seed0) => {
    let seed = seed0
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const hub = new LocalHub()
    const queue: (() => void)[] = []
    hub.deliver = (fn) => queue.push(fn)
    const o = peer(hub, 'o', true); o.s.start()
    const gs = [peer(hub, 'g1', false), peer(hub, 'g2', false)]
    for (const g of gs) g.s.start()
    while (queue.length) queue.shift()!()
    let n = 0
    for (let step = 0; step < 400; step++) {
      const actor = rnd() < 0.3 ? o : gs[Math.floor(rnd() * 2)]
      const slides = actor.model.deck.slides
      const pick = () => slides[Math.floor(rnd() * slides.length)]
      const r = rnd()
      const s = pick()
      if (!s) { actor.doc.edit({ k: 'slide-add', slide: { id: 'n' + n++, ord: ordEnd(slides), elements: [] } }); continue }
      const anchor = rnd() < 0.2 ? null : pick()?.id ?? null
      const els = s.elements
      const pickEl = () => els[Math.floor(rnd() * els.length)]
      if (r < 0.12) actor.doc.edit({ k: 'slide-add', slide: { id: 'n' + n++, ord: ordAfter(slides, anchor), elements: [] } })
      else if (r < 0.18 && slides.length > 1) actor.doc.edit({ k: 'slide-del', id: s.id })
      else if (r < 0.3) actor.doc.edit({ k: 'slide-move', id: s.id, ord: ordAfter(slides, anchor === s.id ? null : anchor, s.id) })
      else if (r < 0.45) actor.doc.edit({ k: 'el-add', slide: s.id, el: box('e' + n++, Math.floor(rnd() * 900), ordAfter(els, els.length ? pickEl().id : null)) })
      else if (r < 0.55 && els.length) actor.doc.edit({ k: 'el-del', slide: s.id, ids: [pickEl().id] })
      else if (r < 0.8 && els.length) actor.doc.edit(wire({ k: 'el-set', slide: s.id, id: pickEl().id, patch: { x: step, rot: rnd() < 0.3 ? undefined : step, text: body([para('t' + step)]) } }))
      else if (r < 0.88 && els.length > 1) { const e = pickEl(); actor.doc.edit({ k: 'el-z', slide: s.id, id: e.id, ord: ordEnd(els) }) }
      else actor.doc.edit({ k: 'slide-set', id: s.id, patch: { notes: 'n' + step } })
      const k = Math.floor(rnd() * 4)
      for (let i = 0; i < k && queue.length; i++) queue.shift()!()
    }
    let guard = 0
    while (queue.length && guard++ < 200000) queue.shift()!()
    for (const g of gs) {
      expect(g.model.deck).toEqual(o.model.deck)
      expect(g.doc.pendingCount).toBe(0)
    }
  })
})
