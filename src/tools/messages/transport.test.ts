import { describe, it, expect } from 'vitest'
import { keepNewLink, inboxRoom } from './transport'

// When two people visit each other's inboxes at the same moment, two links form
// between them and each side keeps one. Each side sends on the link it kept and
// used to ignore the other — so if the two kept DIFFERENT links, every message
// was dropped on arrival and re-sent on the same dead end for ever. Which link
// authenticates first differs per side and per run, so the choice must not
// depend on it.
describe('one link per person', () => {
  const A = 'aaaa1111', B = 'bbbb2222'
  const rooms = [inboxRoom(A), inboxRoom(B)]
  /** The room each side ends up keeping, given the order its two links authenticated in. */
  const kept = (me: string, them: string, first: string, second: string) => (keepNewLink(me, them, first, second) ? second : first)

  it('both sides keep the same connection, whichever order each one saw them finish in', () => {
    for (const [a1, a2] of [rooms, [...rooms].reverse()])
      for (const [b1, b2] of [rooms, [...rooms].reverse()])
        expect(kept(A, B, a1, a2)).toBe(kept(B, A, b1, b2))
  })
  it('and it is the one in the smaller address\'s inbox', () => {
    expect(kept(A, B, inboxRoom(B), inboxRoom(A))).toBe(inboxRoom(A))
    expect(kept(B, A, inboxRoom(A), inboxRoom(B))).toBe(inboxRoom(A))
  })
})
