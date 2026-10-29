import { describe, it, expect } from 'vitest'
import { Authority, Replica, type Applier, type Committed } from './oplog'

// A toy document: a map of cells plus a list of row ids, enough to exercise
// concurrent sets, a delete that invalidates a pending edit, and resends.
type S = { cells: Record<string, string>; rows: string[] }
type O = { k: 'set'; row: string; v: string } | { k: 'del'; row: string } | { k: 'add'; row: string }
const ap: Applier<S, O> = {
  apply(s, o) {
    if (o.k === 'add') { if (s.rows.includes(o.row)) throw new Error('dup'); return { ...s, rows: [...s.rows, o.row] } }
    if (!s.rows.includes(o.row)) throw new Error('gone')
    if (o.k === 'del') { const cells = { ...s.cells }; delete cells[o.row]; return { cells, rows: s.rows.filter((r) => r !== o.row) } }
    return { ...s, cells: { ...s.cells, [o.row]: o.v } }
  },
}
const start = (): S => ({ cells: {}, rows: ['a', 'b'] })

describe('Authority', () => {
  it('numbers commits, rejects ops that do not apply and never applies a resend twice', () => {
    const a = new Authority(start(), ap)
    expect(a.submit({ k: 'set', row: 'a', v: '1' }, 'g1', 'x1')?.v).toBe(1)
    expect(a.submit({ k: 'set', row: 'zz', v: '1' }, 'g1', 'x2')).toBeNull()
    expect(a.submit({ k: 'set', row: 'a', v: '1' }, 'g1', 'x1')).toBeNull()
    expect(a.version).toBe(1)
  })
  it('serves the commits since a version, and admits when its log no longer reaches', () => {
    const a = new Authority(start(), ap, 3)
    for (let i = 0; i < 5; i++) a.submit({ k: 'set', row: 'a', v: String(i) }, 'o', 'i' + i)
    expect(a.since(5)).toEqual([])
    expect(a.since(3)?.map((c) => c.v)).toEqual([4, 5])
    expect(a.since(0)).toBeNull() // trimmed: snapshot needed
    expect(a.since(9)).toBeNull()
    a.reset(start())
    expect(a.version).toBe(6)
    expect(a.since(5)).toBeNull()
  })
})

describe('Replica', () => {
  it('shows local edits immediately and drops them from pending when confirmed', () => {
    const a = new Authority(start(), ap)
    const r = new Replica(a.state, a.version, ap)
    expect(r.local({ k: 'set', row: 'a', v: 'mine' }, 'm1')).toBe(true)
    expect(r.view.cells.a).toBe('mine')
    const c = a.submit(r.pending[0].op, 'g', 'm1')!
    expect(r.receive(c)).toBe('ok')
    expect(r.pending).toHaveLength(0)
    expect(r.view).toEqual(a.state)
  })

  it("the owner's order wins: a concurrent edit lands first and ours is replayed on top", () => {
    const a = new Authority(start(), ap)
    const g = new Replica(a.state, a.version, ap)
    g.local({ k: 'set', row: 'a', v: 'guest' }, 'g1')
    const ownerEdit = a.submit({ k: 'set', row: 'b', v: 'owner' }, 'o', 'o1')!
    g.receive(ownerEdit)
    expect(g.view.cells).toEqual({ a: 'guest', b: 'owner' })
    const guestEdit = a.submit({ k: 'set', row: 'a', v: 'guest' }, 'g', 'g1')!
    g.receive(guestEdit)
    expect(g.view).toEqual(a.state)
  })

  it('a pending edit invalidated by a concurrent delete is discarded, not forced', () => {
    const a = new Authority(start(), ap)
    const g = new Replica(a.state, a.version, ap)
    g.local({ k: 'set', row: 'b', v: 'typed' }, 'g1')
    g.receive(a.submit({ k: 'del', row: 'b' }, 'o', 'o1')!)
    expect(g.pending).toHaveLength(0)
    expect(g.dropped).toBe(1)
    expect(g.view).toEqual(a.state)
    // And the owner would refuse it too, so the two agree.
    expect(a.submit({ k: 'set', row: 'b', v: 'typed' }, 'g', 'g1')).toBeNull()
  })

  it('reports a gap instead of guessing, and recovers from a snapshot', () => {
    const a = new Authority(start(), ap)
    const g = new Replica(a.state, a.version, ap)
    const c1 = a.submit({ k: 'set', row: 'a', v: '1' }, 'o', 'o1')!
    const c2 = a.submit({ k: 'set', row: 'a', v: '2' }, 'o', 'o2')!
    expect(g.receive(c2)).toBe('gap')
    expect(g.receive({ ...c1, v: 0 } as Committed<O>)).toBe('stale')
    g.local({ k: 'add', row: 'c' }, 'g1')
    g.resync(a.state, a.version)
    expect(g.view.cells.a).toBe('2')
    expect(g.view.rows).toContain('c') // still pending on top
  })

  it('a local op that does not even apply locally is refused', () => {
    const g = new Replica(start(), 0, ap)
    expect(g.local({ k: 'set', row: 'nope', v: '' }, 'z')).toBe(false)
    expect(g.pending).toHaveLength(0)
  })

  it('converges under a randomised interleaving of three guests', () => {
    let seed = 7
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const a = new Authority<S, O>({ cells: {}, rows: ['r0', 'r1', 'r2', 'r3'] }, ap)
    const guests = [0, 1, 2].map(() => ({ r: new Replica(a.state, a.version, ap), outbox: [] as { op: O; id: string }[], inbox: [] as Committed<O>[] }))
    let n = 0
    for (let step = 0; step < 600; step++) {
      const g = guests[Math.floor(rnd() * 3)]
      const roll = rnd()
      if (roll < 0.4) {
        const row = 'r' + Math.floor(rnd() * 6)
        const op: O = rnd() < 0.15 ? { k: 'del', row } : rnd() < 0.2 ? { k: 'add', row } : { k: 'set', row, v: String(n) }
        const id = 'op' + n++
        if (g.r.local(op, id)) g.outbox.push({ op, id })
      } else if (roll < 0.7 && g.outbox.length) {
        const p = g.outbox.shift()!
        const c = a.submit(p.op, 'g', p.id)
        if (c) for (const h of guests) h.inbox.push(c)
      } else if (g.inbox.length) {
        g.r.receive(g.inbox.shift()!)
      }
    }
    // Drain everything.
    for (const g of guests) while (g.outbox.length) { const p = g.outbox.shift()!; const c = a.submit(p.op, 'g', p.id); if (c) for (const h of guests) h.inbox.push(c) }
    for (const g of guests) while (g.inbox.length) g.r.receive(g.inbox.shift()!)
    for (const g of guests) {
      // Anything still pending was refused by the owner; the confirmed state is the truth.
      expect(g.r.confirmed).toEqual(a.state)
      expect(g.r.version).toBe(a.version)
    }
  })
})
