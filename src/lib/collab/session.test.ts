import { describe, it, expect } from 'vitest'
import { CollabSession, LocalHub, colorFor, type Member, type SessionState } from './session'
import { OpDoc } from './opDoc'
import type { Applier } from './oplog'

type S = Record<string, string>
type O = { k: string; v: string } | { del: string }
const ap: Applier<S, O> = {
  apply(s, o) {
    if ('del' in o) { if (!(o.del in s)) throw new Error('gone'); const n = { ...s }; delete n[o.del]; return n }
    return { ...s, [o.k]: o.v }
  },
}
const flush = () => new Promise((r) => setTimeout(r, 0))

function node(hub: LocalHub, id: string, owner: boolean, initial: S = {}) {
  const t = hub.transport(id)
  const doc = new OpDoc(ap, initial, owner)
  const events = { states: [] as SessionState[], roster: [] as Member[], chats: [] as string[], refused: 0, roles: [] as string[], presence: [] as unknown[] }
  const s = new CollabSession(t.tx, doc, {
    onState: (x) => events.states.push(x),
    onRoster: (m) => (events.roster = m),
    onChat: (c) => events.chats.push(`${c.name}:${c.text}`),
    onRefused: () => events.refused++,
    onRole: (r) => events.roles.push(r),
    onPresence: (_c, d) => events.presence.push(d),
  }, { owner, name: id, title: 'Budget', kind: 'excel' })
  doc.bind(s)
  t.bind(s.handlers())
  return { s, doc, events }
}

describe('CollabSession + OpDoc', () => {
  it('a guest receives the snapshot, and edits flow both ways through the owner', async () => {
    const hub = new LocalHub()
    const o = node(hub, 'owner', true, { a: '1' })
    o.s.start()
    const g = node(hub, 'guest', false)
    g.s.start()
    await flush(); await flush()
    expect(g.s.state).toBe('live')
    expect(g.doc.state).toEqual({ a: '1' })
    expect(g.s.title).toBe('Budget')
    expect(g.s.kind).toBe('excel')
    expect(o.events.roster.map((m) => m.client).sort()).toEqual(['guest', 'owner'])

    expect(g.doc.edit({ k: 'b', v: 'guest' })).toBe(true)
    expect(g.doc.state.b).toBe('guest') // optimistic
    o.doc.edit({ k: 'c', v: 'owner' })
    await flush(); await flush(); await flush()
    expect(o.doc.state).toEqual({ a: '1', b: 'guest', c: 'owner' })
    expect(g.doc.state).toEqual(o.doc.state)
    expect(g.doc.pendingCount).toBe(0)
  })

  it('a viewer is refused at the owner, not just in the UI', async () => {
    const hub = new LocalHub()
    const o = node(hub, 'owner', true)
    o.s.defaultRole = 'view'
    o.s.start()
    const g = node(hub, 'guest', false)
    g.s.start()
    await flush(); await flush()
    expect(g.s.canEdit).toBe(false)
    expect(g.doc.edit({ k: 'x', v: '1' })).toBe(false)
    // Even a hand-crafted submission past the client guard is refused.
    ;(g.s as unknown as { role: string }).role = 'edit'
    g.doc.edit({ k: 'x', v: '1' })
    await flush(); await flush()
    expect(o.doc.state).toEqual({})
    expect(o.events.refused).toBe(1)
    // Then promoted, it works.
    o.s.setRole('guest', 'edit')
    await flush(); await flush()
    expect(g.events.roles).toContain('edit')
    g.doc.edit({ k: 'y', v: '2' })
    await flush(); await flush(); await flush()
    expect(o.doc.state).toEqual({ y: '2' })
    expect(g.doc.state).toEqual({ y: '2' }) // the refused edit was rolled back on the guest too
  })

  it('a commit from a non-owner peer is ignored', async () => {
    const hub = new LocalHub()
    const o = node(hub, 'owner', true, { a: '1' })
    o.s.start()
    const g = node(hub, 'guest', false)
    g.s.start()
    await flush(); await flush()
    // A rogue peer joins and broadcasts a forged commit.
    const rogue = hub.transport('rogue')
    rogue.bind({})
    rogue.tx.start()
    await flush()
    rogue.tx.send('guest', { t: 'c-commit', p: { v: 1, op: { k: 'a', v: 'HACKED' }, by: 'x', id: 'z' } })
    rogue.tx.send('guest', { t: 'c-welcome', role: 'edit', snap: { a: 'HACKED' }, version: 0, title: '', kind: '', name: '', color: '' })
    await flush(); await flush()
    expect(g.doc.state).toEqual({ a: '1' })
  })

  it('owner leaving or ending is visible to guests; kick removes a guest', async () => {
    const hub = new LocalHub()
    const o = node(hub, 'owner', true)
    o.s.start()
    const g1 = node(hub, 'g1', false)
    const g2 = node(hub, 'g2', false)
    g1.s.start(); g2.s.start()
    await flush(); await flush(); await flush()
    o.s.kick('g2')
    await flush(); await flush()
    expect(g2.s.state).toBe('kicked')
    expect(o.s.roster().map((m) => m.client)).not.toContain('g2')
    o.s.stop()
    await flush(); await flush()
    expect(g1.s.state).toBe('owner-left')
    expect(g1.s.canEdit).toBe(false)
  })

  it('a gap triggers a resync, and an import resnapshots everyone', async () => {
    const hub = new LocalHub()
    const o = node(hub, 'owner', true, { a: '1' })
    o.s.start()
    const g = node(hub, 'guest', false)
    g.s.start()
    await flush(); await flush()
    // Drop one commit on the floor.
    const real = hub.deliver
    let dropped = false
    hub.deliver = (fn) => { if (!dropped) { dropped = true; return } real(fn) }
    o.doc.edit({ k: 'b', v: '2' })
    hub.deliver = real
    o.doc.edit({ k: 'c', v: '3' })
    await flush(); await flush(); await flush(); await flush()
    expect(g.doc.state).toEqual({ a: '1', b: '2', c: '3' })
    o.doc.reset({ z: 'new' })
    await flush(); await flush()
    expect(g.doc.state).toEqual({ z: 'new' })
  })

  it('chat and presence travel; colours are stable per id', async () => {
    const hub = new LocalHub()
    const o = node(hub, 'owner', true)
    o.s.start()
    const g = node(hub, 'guest', false)
    g.s.start()
    await flush(); await flush()
    g.s.chat('hello')
    g.s.presence({ cell: 'B2' })
    o.s.chat('hi back')
    await flush(); await flush()
    expect([...o.events.chats].sort()).toEqual(['guest:hello', 'owner:hi back'])
    expect([...g.events.chats].sort()).toEqual(['guest:hello', 'owner:hi back'])
    expect(o.events.presence).toEqual([{ cell: 'B2' }])
    expect(colorFor('abc')).toBe(colorFor('abc'))
  })
})
