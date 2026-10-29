import { describe, it, expect } from 'vitest'
import { SeqDoc, type SeqModel } from './seqDoc'
import { CollabSession, LocalHub } from './session'

// A list of rows, each a map of cells. Setting a cell is idempotent; inserting a
// row is not — exactly the split the spreadsheet has.
type Op = { k: 'set'; row: number; col: string; v: string } | { k: 'insert'; at: number }
class Rows implements SeqModel<Op> {
  rows: Record<string, string>[] = [{}, {}, {}]
  apply(op: Op) {
    if (op.k === 'insert') { if (op.at < 0 || op.at > this.rows.length) throw new Error('bad'); this.rows.splice(op.at, 0, {}) }
    else { if (!this.rows[op.row]) throw new Error('gone'); this.rows[op.row][op.col] = op.v }
  }
  idempotent(op: Op) { return op.k === 'set' }
  snapshot() { return JSON.parse(JSON.stringify(this.rows)) }
  load(s: unknown) { this.rows = JSON.parse(JSON.stringify(s || [])) }
}
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)) }

function peer(hub: LocalHub, id: string, owner: boolean) {
  const t = hub.transport(id)
  const model = new Rows()
  const doc = new SeqDoc<Op>(model, owner)
  const s = new CollabSession(t.tx, doc, {}, { owner, name: id })
  doc.bind(s)
  t.bind(s.handlers())
  return { model, doc, s }
}

describe('SeqDoc', () => {
  it('without a session it is just a document', () => {
    const m = new Rows()
    const d = new SeqDoc<Op>(m, true)
    expect(d.edit({ k: 'set', row: 0, col: 'A', v: '1' })).toBe(true)
    expect(d.edit({ k: 'set', row: 99, col: 'A', v: '1' })).toBe(false)
    expect(m.rows[0].A).toBe('1')
  })

  it('idempotent edits are optimistic, structural ones wait for the owner', async () => {
    const hub = new LocalHub()
    const o = peer(hub, 'o', true); o.s.start()
    const g = peer(hub, 'g', false); g.s.start()
    await flush()
    g.doc.edit({ k: 'set', row: 0, col: 'A', v: 'mine' })
    expect(g.model.rows[0].A).toBe('mine') // instantly
    g.doc.edit({ k: 'insert', at: 0 })
    expect(g.model.rows).toHaveLength(3) // not yet
    await flush()
    expect(g.model.rows).toHaveLength(4)
    expect(g.model.rows).toEqual(o.model.rows)
    expect(g.doc.pendingCount).toBe(0)
  })

  it('a concurrent remote edit to the same cell resolves in the OWNER order on every side', async () => {
    const hub = new LocalHub()
    const o = peer(hub, 'o', true); o.s.start()
    const g = peer(hub, 'g', false); g.s.start()
    await flush()
    // Guest types; before its edit reaches the owner, the owner types the same cell.
    g.doc.edit({ k: 'set', row: 1, col: 'B', v: 'guest' })
    o.doc.edit({ k: 'set', row: 1, col: 'B', v: 'owner' })
    await flush()
    // Owner saw its own first, then the guest's — so "guest" is the truth everywhere.
    expect(o.model.rows[1].B).toBe('guest')
    expect(g.model.rows[1].B).toBe('guest')
  })

  it('a refused optimistic edit is rolled back by a resync', async () => {
    const hub = new LocalHub()
    const o = peer(hub, 'o', true); o.s.defaultRole = 'view'; o.s.start()
    const g = peer(hub, 'g', false); g.s.start()
    await flush()
    ;(g.s as unknown as { role: string }).role = 'edit' // a guest that thinks it may edit
    g.doc.edit({ k: 'set', row: 0, col: 'Z', v: 'sneaky' })
    expect(g.model.rows[0].Z).toBe('sneaky')
    await flush(10)
    expect(o.model.rows[0].Z).toBeUndefined()
    expect(g.model.rows[0].Z).toBeUndefined()
    expect(g.doc.refusals).toBe(1)
  })

  it('a resend after a reconnect is never applied twice', async () => {
    const hub = new LocalHub()
    const o = peer(hub, 'o', true); o.s.start()
    const g = peer(hub, 'g', false); g.s.start()
    await flush()
    g.doc.edit({ k: 'insert', at: 0 })
    await flush()
    expect(o.model.rows).toHaveLength(4)
    // Pretend the commit was lost and the guest resends everything it thinks is pending.
    ;(g.doc as unknown as { pending: unknown[] }).pending.push({ op: { k: 'insert', at: 0 }, id: (o.doc as unknown as { recent: string[] }).recent[0], applied: false })
    g.doc.resend()
    await flush(10)
    expect(o.model.rows).toHaveLength(4)
    expect(g.model.rows).toEqual(o.model.rows)
  })

  it.each([99, 7, 1234, 42, 2026, 31337, 5, 808])('converges under random interleavings of three guests and the owner (seed %i)', async (seed0) => {
    let seed = seed0
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const hub = new LocalHub()
    const queue: (() => void)[] = []
    hub.deliver = (fn) => queue.push(fn)
    const o = peer(hub, 'o', true); o.s.start()
    const gs = [peer(hub, 'g1', false), peer(hub, 'g2', false), peer(hub, 'g3', false)]
    for (const g of gs) g.s.start()
    while (queue.length) queue.shift()!()
    for (let step = 0; step < 500; step++) {
      const actor = rnd() < 0.25 ? o : gs[Math.floor(rnd() * 3)]
      const r = rnd()
      if (r < 0.45) actor.doc.edit({ k: 'set', row: Math.floor(rnd() * 5), col: 'ABC'[Math.floor(rnd() * 3)], v: String(step) })
      else if (r < 0.52) actor.doc.edit({ k: 'insert', at: Math.floor(rnd() * 3) })
      // Deliver a random number of queued messages, out of the actors' control.
      const n = Math.floor(rnd() * 4)
      for (let i = 0; i < n && queue.length; i++) queue.shift()!()
    }
    let guard = 0
    while (queue.length && guard++ < 100000) queue.shift()!()
    for (const g of gs) {
      expect(g.model.rows).toEqual(o.model.rows)
      expect(g.doc.pendingCount).toBe(0)
      expect(g.doc.version).toBe(o.doc.version)
    }
  })
})
