import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state'
import { schema } from './schema'
import { PMCollab, collabPlugin, type Host } from './collab'
import { CollabSession, LocalHub } from '../../lib/collab/session'
import { getVersion } from 'prosemirror-collab'

const flush = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)) }
const start = () => schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] })

function peer(hub: LocalHub, id: string, owner: boolean) {
  let state = EditorState.create({ doc: owner ? start() : schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph' }] }), plugins: [collabPlugin(0, id)] })
  let meta: unknown = { header: '' }
  const host: Host = {
    getState: () => state,
    apply: (tr: Transaction) => { state = state.apply(tr) },
    reset: (doc, version) => { state = EditorState.create({ doc, plugins: [collabPlugin(version, id)] }) },
    getMeta: () => meta,
    setMeta: (m) => { meta = m },
  }
  const pm = new PMCollab(schema, host, owner)
  const t = hub.transport(id)
  const s = new CollabSession(t.tx, pm, {}, { owner, name: id })
  pm.bind(s)
  t.bind(s.handlers())
  const edit = (f: (tr: Transaction) => Transaction | null) => { const tr = f(state.tr); if (!tr) return; state = state.apply(tr); pm.flush() }
  return { get state() { return state }, get meta() { return meta }, pm, s, edit }
}

describe('word processor co-editing (prosemirror-collab, owner as authority)', () => {
  it('a guest joins with the owner document, and edits flow both ways', async () => {
    const hub = new LocalHub()
    const o = peer(hub, 'o', true); o.s.start()
    const g = peer(hub, 'g', false); g.s.start()
    await flush()
    expect(g.state.doc.textContent).toBe('Hello world')
    g.edit((tr) => tr.insertText(' from guest', 12))
    await flush()
    expect(o.state.doc.textContent).toBe('Hello world from guest')
    o.edit((tr) => tr.insertText('Oh, ', 1))
    await flush()
    expect(g.state.doc.textContent).toBe('Oh, Hello world from guest')
    expect(getVersion(g.state)).toBe(getVersion(o.state))
  })

  it('concurrent edits from two guests are sequenced by the owner and converge', async () => {
    const hub = new LocalHub()
    const queue: (() => void)[] = []
    hub.deliver = (fn) => queue.push(fn)
    const o = peer(hub, 'o', true); o.s.start()
    const a = peer(hub, 'a', false); a.s.start()
    const b = peer(hub, 'b', false); b.s.start()
    const drain = async () => { let k = 0; while (queue.length && k++ < 10000) { queue.shift()!(); await Promise.resolve() } await flush(); while (queue.length && k++ < 20000) { queue.shift()!(); await Promise.resolve(); if (!queue.length) await flush() } }
    await drain()
    a.edit((tr) => tr.insertText('A', 1))
    b.edit((tr) => tr.insertText('B', 12))
    await drain()
    expect(o.state.doc.textContent).toBe('AHello worldB')
    expect(a.state.doc.textContent).toBe(o.state.doc.textContent)
    expect(b.state.doc.textContent).toBe(o.state.doc.textContent)
  })

  it.each([3, 77, 1001, 4242])('converges under random interleavings (seed %i)', async (seed0) => {
    let seed = seed0
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const hub = new LocalHub()
    const queue: (() => void)[] = []
    hub.deliver = (fn) => queue.push(fn)
    const o = peer(hub, 'o', true); o.s.start()
    const gs = [peer(hub, 'g1', false), peer(hub, 'g2', false)]
    for (const g of gs) g.s.start()
    const step = async () => { if (queue.length) queue.shift()!(); await Promise.resolve() }
    for (let i = 0; i < 60; i++) await step()
    await flush()
    while (queue.length) await step()
    for (let i = 0; i < 150; i++) {
      const who = rnd() < 0.3 ? o : gs[Math.floor(rnd() * 2)]
      who.edit((tr) => {
        const size = tr.doc.content.size
        const r = rnd()
        if (r < 0.55) { const pos = 1 + Math.floor(rnd() * Math.max(1, size - 2)); return tr.insertText(String.fromCharCode(97 + Math.floor(rnd() * 26)), Math.min(pos, size - 1)) }
        if (r < 0.75 && size > 4) { const from = 1 + Math.floor(rnd() * (size - 3)); return tr.delete(from, Math.min(from + 1 + Math.floor(rnd() * 2), size - 1)) }
        if (r < 0.85) { const pos = 1 + Math.floor(rnd() * Math.max(1, size - 2)); try { return tr.split(Math.min(pos, size - 1)) } catch { return null } }
        const from = 1 + Math.floor(rnd() * Math.max(1, size - 3))
        try { return tr.addMark(from, Math.min(from + 3, size - 1), schema.marks.bold.create()) } catch { return null }
      })
      for (let k = Math.floor(rnd() * 4); k > 0; k--) await step()
    }
    for (let k = 0; k < 50 && (queue.length || k < 5); k++) { while (queue.length) await step(); await flush() }
    for (const g of gs) {
      expect(g.state.doc.toJSON()).toEqual(o.state.doc.toJSON())
      expect(getVersion(g.state)).toBe(getVersion(o.state))
    }
  })

  it('a view-only guest cannot change the document', async () => {
    const hub = new LocalHub()
    const o = peer(hub, 'o', true); o.s.defaultRole = 'view'; o.s.start()
    const g = peer(hub, 'g', false); g.s.start()
    await flush()
    g.edit((tr) => tr.insertText('X', 1))
    await flush()
    expect(o.state.doc.textContent).toBe('Hello world')
  })

  it('page setup travels as meta, and a resync after a gap restores the truth', async () => {
    const hub = new LocalHub()
    const o = peer(hub, 'o', true); o.s.start()
    const g = peer(hub, 'g', false); g.s.start()
    await flush()
    o.pm.sendMeta({ header: 'Confidential' })
    await flush()
    expect(g.meta).toEqual({ header: 'Confidential' })
    g.pm.sendMeta({ header: 'Draft' })
    await flush()
    expect(o.meta).toEqual({ header: 'Draft' })
    // A commit that skips versions is a gap; the guest asks for the snapshot.
    expect(g.pm.commit({ v: 99, steps: [{}], clientIDs: ['x'] })).toBe('gap')
    g.s.requestResync()
    await flush()
    expect(g.state.doc.textContent).toBe(o.state.doc.textContent)
  })

  it('a malformed or stale submission is refused, not applied', () => {
    let state = EditorState.create({ doc: start(), plugins: [collabPlugin(0, 'o')] })
    const host: Host = { getState: () => state, apply: (tr) => { state = state.apply(tr) }, reset: () => {}, getMeta: () => null, setMeta: () => {} }
    const pm = new PMCollab(schema, host, true)
    expect(pm.accept({ v: 5, steps: [], clientID: 'g' }, 'g')).toBeNull()
    expect(pm.accept({ v: 0, steps: [{ stepType: 'nonsense' }], clientID: 'g' }, 'g')).toBeNull()
    expect(pm.accept({ v: 0, steps: [{ stepType: 'replace', from: 900, to: 901 }], clientID: 'g' }, 'g')).toBeNull()
    expect(state.doc.textContent).toBe('Hello world')
    void TextSelection
  })
})
