import { describe, it, expect } from 'vitest'
import { applyEvent, dmId, markReadBy, deliverySummary, sweepExpired, tally, dayKey, matchesSearch, preview, clampDisappear, dedupeMembers, fmtDur, type ConvState, type Envelope, type Message, type Conversation } from './model'

const ME = 'me0000000'
const BOB = 'bob000000'
const CAT = 'cat000000'
const ctx = (viewing = false, now = 1_000_000) => ({ me: ME, now, viewing })

function conv(kind: Conversation['kind'] = 'dm', members = [{ code: ME, name: 'Me' }, { code: BOB, name: 'Bob' }]): ConvState {
  return { conv: { id: kind === 'group' ? 'g:1' : dmId(ME, BOB), kind, title: 'x', members, createdAt: 0, updatedAt: 0, unread: 0, owner: ME }, msgs: new Map(), held: [] }
}
let n = 0
function env(e: Partial<Envelope> & Pick<Envelope, 'type'>, from = BOB, at = 100): Envelope {
  return { v: 1, eid: 'e' + n++, conv: 'c', from, name: from === BOB ? 'Bob' : 'Me', at, ...e } as Envelope
}
const msg = (id: string, text = 'hi', at = 100, from = BOB): Message => ({ id, conv: 'c', from, name: '', at, kind: 'text', text })

describe('applyEvent', () => {
  it('dm ids are symmetric; a self conversation is distinct', () => {
    expect(dmId('a', 'b')).toBe(dmId('b', 'a'))
    expect(dmId('a', 'a')).toBe('self:a')
  })

  it('a message arriving twice (push, then P2P) lands once and counts unread once', () => {
    const st = conv()
    const e = env({ type: 'msg', msg: msg('m1') })
    applyEvent(st, e, ctx())
    applyEvent(st, { ...e, eid: 'other-road' }, ctx())
    expect(st.msgs.size).toBe(1)
    expect(st.conv.unread).toBe(1)
    expect(st.conv.lastPreview).toBe('Bob: hi')
  })

  it("the sender's local-only state does not ride along", () => {
    const st = conv()
    applyEvent(st, env({ type: 'msg', msg: { ...msg('f1'), kind: 'file', starred: true, delivery: { [ME]: 'read' }, readAt: 5, file: { id: 'x', name: 'a', size: 1, mime: 'text/plain', have: true } } }), ctx())
    const m = st.msgs.get('f1')!
    expect(m.file?.have).toBe(false)
    expect(m.starred).toBeUndefined()
    expect(m.delivery).toBeUndefined()
    expect(m.readAt).toBeUndefined()
  })

  it('a message read on arrival when the thread is open', () => {
    const st = conv()
    applyEvent(st, env({ type: 'msg', msg: msg('m1') }), ctx(true))
    expect(st.conv.unread).toBe(0)
    expect(st.msgs.get('m1')?.readAt).toBe(1_000_000)
  })

  it('the envelope sender wins over a forged msg.from', () => {
    const st = conv()
    applyEvent(st, env({ type: 'msg', msg: { ...msg('m1'), from: ME } }), ctx())
    expect(st.msgs.get('m1')?.from).toBe(BOB)
  })

  it('an edit before its message is held and applied once the message arrives', () => {
    const st = conv()
    applyEvent(st, env({ type: 'edit', msgId: 'm1', text: 'fixed', at: 200 }), ctx())
    applyEvent(st, env({ type: 'react', msgId: 'm1', emoji: '👍', on: true }), ctx())
    expect(st.held).toHaveLength(2)
    applyEvent(st, env({ type: 'msg', msg: msg('m1', 'typo') }), ctx())
    expect(st.msgs.get('m1')).toMatchObject({ text: 'fixed', edited: 200, reactions: { '👍': [BOB] } })
    expect(st.held).toHaveLength(0)
  })

  it('only the author may edit or delete; an older edit never overwrites a newer one', () => {
    const st = conv()
    applyEvent(st, env({ type: 'msg', msg: msg('m1', 'orig') }), ctx())
    applyEvent(st, env({ type: 'edit', msgId: 'm1', text: 'hijack', at: 300 }, ME), ctx())
    expect(st.msgs.get('m1')?.text).toBe('orig')
    applyEvent(st, env({ type: 'edit', msgId: 'm1', text: 'v2', at: 300 }), ctx())
    applyEvent(st, env({ type: 'edit', msgId: 'm1', text: 'v1-late', at: 250 }), ctx())
    expect(st.msgs.get('m1')?.text).toBe('v2')
    applyEvent(st, env({ type: 'del', msgId: 'm1' }, ME), ctx())
    expect(st.msgs.get('m1')?.deleted).toBeFalsy()
    applyEvent(st, env({ type: 'del', msgId: 'm1' }), ctx())
    expect(st.msgs.get('m1')).toMatchObject({ deleted: true, text: '' })
    applyEvent(st, env({ type: 'edit', msgId: 'm1', text: 'zombie', at: 400 }), ctx())
    expect(st.msgs.get('m1')?.text).toBe('')
  })

  it('reactions toggle per person', () => {
    const st = conv('group', [{ code: ME, name: 'Me' }, { code: BOB, name: 'Bob' }, { code: CAT, name: 'Cat' }])
    applyEvent(st, env({ type: 'msg', msg: msg('m1') }), ctx())
    applyEvent(st, env({ type: 'react', msgId: 'm1', emoji: '❤️', on: true }), ctx())
    applyEvent(st, env({ type: 'react', msgId: 'm1', emoji: '❤️', on: true }, CAT), ctx())
    applyEvent(st, env({ type: 'react', msgId: 'm1', emoji: '❤️', on: true }), ctx()) // idempotent
    expect(st.msgs.get('m1')?.reactions?.['❤️']).toEqual([BOB, CAT])
    applyEvent(st, env({ type: 'react', msgId: 'm1', emoji: '❤️', on: false }), ctx())
    applyEvent(st, env({ type: 'react', msgId: 'm1', emoji: '❤️', on: false }, CAT), ctx())
    expect(st.msgs.get('m1')?.reactions).toEqual({})
  })

  it('polls: single choice replaces, multi choice accumulates, closed polls ignore votes, foreign options are dropped', () => {
    const st = conv('group', [{ code: ME, name: 'Me' }, { code: BOB, name: 'Bob' }, { code: CAT, name: 'Cat' }])
    const poll = { ...msg('p1'), kind: 'poll' as const, poll: { q: 'Lunch?', multi: false, options: [{ id: 'a', text: 'Kabsa' }, { id: 'b', text: 'Shawarma' }] } }
    applyEvent(st, env({ type: 'msg', msg: poll }), ctx())
    applyEvent(st, env({ type: 'vote', msgId: 'p1', options: ['a', 'b', 'zzz'] }), ctx())
    expect(st.msgs.get('p1')?.votes).toEqual({ a: [BOB] })
    applyEvent(st, env({ type: 'vote', msgId: 'p1', options: ['b'] }), ctx())
    applyEvent(st, env({ type: 'vote', msgId: 'p1', options: ['b'] }, CAT), ctx())
    expect(tally(st.msgs.get('p1')!)).toEqual([{ id: 'a', text: 'Kabsa', n: 0, share: 0 }, { id: 'b', text: 'Shawarma', n: 2, share: 1 }])
    applyEvent(st, env({ type: 'poll-close', msgId: 'p1' }, CAT), ctx()) // not the author
    expect(st.msgs.get('p1')?.poll?.closed).toBeFalsy()
    applyEvent(st, env({ type: 'poll-close', msgId: 'p1' }), ctx())
    applyEvent(st, env({ type: 'vote', msgId: 'p1', options: ['a'] }), ctx())
    expect(st.msgs.get('p1')?.votes).toEqual({ b: [BOB, CAT] })
  })

  it('groups: non-members cannot post; only the owner may change members; removal marks us as left', () => {
    const st = conv('group', [{ code: ME, name: 'Me' }, { code: BOB, name: 'Bob' }])
    applyEvent(st, env({ type: 'msg', msg: msg('x') }, CAT), ctx())
    expect(st.msgs.size).toBe(0)
    applyEvent(st, env({ type: 'meta', members: [{ code: BOB, name: 'Bob' }] }), ctx()) // Bob is not owner
    expect(st.conv.members).toHaveLength(2)
    applyEvent(st, env({ type: 'meta', title: 'Family 👨‍👩‍👧' }), ctx())
    expect(st.conv.title).toBe('Family 👨‍👩‍👧')
    applyEvent(st, env({ type: 'meta', members: [{ code: BOB, name: 'Bob' }, { code: BOB, name: 'dup' }] }, ME), ctx())
    expect(st.conv.members).toEqual([{ code: BOB, name: 'dup' }])
    expect(st.conv.left).toBe(true)
  })

  it('leave removes the sender; pins toggle', () => {
    const st = conv('group', [{ code: ME, name: 'Me' }, { code: BOB, name: 'Bob' }])
    applyEvent(st, env({ type: 'msg', msg: msg('m1') }), ctx())
    applyEvent(st, env({ type: 'pin', msgId: 'm1', on: true }), ctx())
    expect(st.conv.pins).toEqual(['m1'])
    applyEvent(st, env({ type: 'pin', msgId: 'm1', on: false }), ctx())
    expect(st.conv.pins).toEqual([])
    applyEvent(st, env({ type: 'leave' }), ctx())
    expect(st.conv.members.map((m) => m.code)).toEqual([ME])
  })

  it('disappearing messages: stamped on arrival, an already-expired one is not stored, the sweep removes them', () => {
    const st = conv()
    applyEvent(st, env({ type: 'meta', disappearMs: 120_000 }), ctx())
    expect(st.conv.disappearMs).toBe(120_000)
    applyEvent(st, env({ type: 'msg', msg: msg('m1', 'x', 999_000) }), ctx())
    expect(st.msgs.get('m1')?.expiresAt).toBe(1_119_000)
    applyEvent(st, env({ type: 'msg', msg: msg('m2', 'x', 1) }), ctx())
    expect(st.msgs.has('m2')).toBe(false)
    expect(sweepExpired(st.msgs, 1_200_000)).toEqual(['m1'])
    expect(clampDisappear(5)).toBe(60_000)
    expect(clampDisappear(-1)).toBe(0)
  })

  it('read receipts and the delivery summary', () => {
    const mine = [msg('a', 'x', 10, ME), msg('b', 'x', 20, ME), msg('c', 'x', 30, ME), msg('d', 'x', 15, BOB)]
    for (const m of mine) m.delivery = { [BOB]: 'delivered', [CAT]: 'pushed' }
    expect(markReadBy(mine, ME, BOB, 20).map((m) => m.id)).toEqual(['a', 'b'])
    expect(deliverySummary(mine[0])).toBe('pushed')
    mine[0].delivery = { [BOB]: 'read' }
    expect(deliverySummary(mine[0])).toBe('read')
    expect(deliverySummary(msg('z'))).toBeUndefined()
  })

  it('previews, durations, day keys, search', () => {
    expect(preview({ ...msg('f'), kind: 'file', name: 'Bob', file: { id: 'x', name: 'cv.pdf', size: 1, mime: 'application/pdf' } })).toBe('Bob: 📎 cv.pdf')
    expect(preview({ ...msg('d'), deleted: true })).toBe('🚫')
    expect(fmtDur(75)).toBe('1:15')
    const now = new Date(2026, 9, 29, 12).getTime()
    expect(dayKey(now - 3600_000, now)).toBe('today')
    expect(dayKey(now - 86400_000, now)).toBe('yesterday')
    expect(dayKey(new Date(2026, 0, 2).getTime(), now)).toBe('2026-01-02')
    expect(matchesSearch({ ...msg('s'), text: 'الإجتماع غداً' }, 'الاجتماع')).toBe(true)
    expect(matchesSearch({ ...msg('s'), text: 'Budget for Q3' }, 'q3 budget')).toBe(true)
    expect(matchesSearch({ ...msg('s'), text: 'Budget' }, '')).toBe(false)
    expect(dedupeMembers([{ code: '', name: 'x' }, { code: 'a', name: 'A' }])).toEqual([{ code: 'a', name: 'A' }])
  })
})
