import { describe, expect, it } from 'vitest'
import { LIMITS, coolOff, initialGov, stepGov, type LinkSample } from './videoGovernor'

const good: LinkSample[] = [{ loss: 0, rttMs: 60, limited: false, fps: 24 }]
const bad: LinkSample[] = [{ loss: 0.2, rttMs: 300, limited: true, fps: 5 }]

/** Run the governor tick by tick (every 2s) over a stretch of time. */
function run(st = initialGov(), from: number, to: number, peers: number, samples: LinkSample[]) {
  for (let t = from; t <= to; t += 2000) st = stepGov(st, t, peers, samples)
  return st
}

describe('video governor', () => {
  it('leaves a healthy small call alone', () => {
    const st = run(undefined, 0, 120_000, 2, good)
    expect(st.paused).toBe(false)
  })

  it('a crowd pauses at once and resumes at once, with no cool-off', () => {
    let st = stepGov(initialGov(), 0, LIMITS.maxVideoPeers + 1, good)
    expect(st).toMatchObject({ paused: true, reason: 'crowd' })
    st = stepGov(st, 2000, LIMITS.maxVideoPeers, good)
    expect(st.paused).toBe(false)
  })

  it('a short glitch does not pause; a sustained one does', () => {
    let st = run(undefined, 0, 6000, 2, bad)
    expect(st.paused).toBe(false)
    st = run(st, 8000, 10_000, 2, good)
    st = run(st, 12_000, 30_000, 2, bad)
    expect(st).toMatchObject({ paused: true, reason: 'quality', strikes: 1 })
  })

  it('stays off for the cool-off even if the link heals at once', () => {
    let st = run(undefined, 0, 10_000, 2, bad)
    expect(st.paused).toBe(true)
    st = run(st, 12_000, 10_000 + LIMITS.baseCoolMs - 2000, 2, good)
    expect(st.paused).toBe(true)
    st = run(st, 10_000 + LIMITS.baseCoolMs, 10_000 + LIMITS.baseCoolMs + 4000, 2, good)
    expect(st.paused).toBe(false)
  })

  it('does not resume while the link is still poor after the cool-off', () => {
    let st = run(undefined, 0, 10_000, 2, bad)
    st = run(st, 12_000, 10_000 + LIMITS.baseCoolMs * 3, 2, bad)
    expect(st.paused).toBe(true)
  })

  it('needs a healthy stretch, not one good sample, to resume', () => {
    let st = run(undefined, 0, 10_000, 2, bad)
    const end = 10_000 + LIMITS.baseCoolMs
    st = run(st, 12_000, end - 2000, 2, bad)
    st = stepGov(st, end, 2, good)
    expect(st.paused).toBe(true)
  })

  it('the cool-off doubles on each repeat, up to a ceiling', () => {
    expect([1, 2, 3, 4, 5, 9].map(coolOff)).toEqual([60_000, 120_000, 240_000, 480_000, 480_000, 480_000])
    let st = run(undefined, 0, 10_000, 2, bad)
    st = run(st, 12_000, 80_000, 2, good)
    expect(st.paused).toBe(false)
    st = run(st, 82_000, 100_000, 2, bad)
    expect(st).toMatchObject({ paused: true, strikes: 2 })
    expect(st.until - 92_000).toBe(coolOff(2))
  })

  it('long healthy video forgives the strikes', () => {
    let st = run(undefined, 0, 10_000, 2, bad)
    st = run(st, 12_000, 12_000 + LIMITS.baseCoolMs + LIMITS.forgiveAfterMs + 20_000, 2, good)
    expect(st).toMatchObject({ paused: false, strikes: 0 })
  })

  it('a quality pause that ends in a crowd stays paused, as a crowd', () => {
    let st = run(undefined, 0, 10_000, 2, bad)
    st = run(st, 12_000, 10_000 + LIMITS.baseCoolMs + 12_000, LIMITS.maxVideoPeers + 2, good)
    expect(st).toMatchObject({ paused: true, reason: 'crowd' })
  })

  it('with nothing measured yet, nothing is poor', () => {
    expect(run(undefined, 0, 60_000, 2, []).paused).toBe(false)
  })
})
