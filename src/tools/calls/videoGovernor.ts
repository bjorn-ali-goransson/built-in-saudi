// When to stop sending your own video, and when to send it again.
//
// This is a MESH: every person uploads a separate copy of their camera to every
// other person, so upstream grows with the call and a phone on a weak link is
// the first thing to fail. Audio is what a call cannot lose, so video is what
// gives way. Two triggers, deliberately different:
//
// - **Crowd**: more people in the call than a mesh can carry video for. That is
//   a property of the room, not of this link, so it has no cool-off: video comes
//   back the moment the room is small enough again.
// - **Quality**: the link has been poor for a sustained stretch (loss, delay, or
//   an encoder starved of bandwidth or CPU). Video goes off for a cool-off that
//   DOUBLES each time it happens again, and comes back only after the link has
//   been healthy for a stretch too. Without the doubling, a link on the edge
//   flaps — on, poor, off, on, poor, off — which is worse than either state.
//
// Pure, with time passed in, so the whole policy is unit-tested without a call.

export interface LinkSample {
  /** Fraction of packets lost on what we send, 0..1 (remote-inbound-rtp). */
  loss: number
  /** Round-trip time in ms, or null when unknown. */
  rttMs: number | null
  /** The encoder says bandwidth or CPU is what is holding it back. */
  limited: boolean
  /** Frames per second actually sent, or null when no video is going out. */
  fps: number | null
}

export type PauseReason = 'crowd' | 'quality'

export interface GovState {
  paused: boolean
  reason: PauseReason | null
  /** When a quality pause may end (ms epoch); 0 when not in a cool-off. */
  until: number
  /** Quality pauses so far; sets the length of the next cool-off. */
  strikes: number
  poorSince: number | null
  healthySince: number | null
  resumedAt: number | null
}

export const LIMITS = {
  /** Others in the call beyond which nobody sends video. */
  maxVideoPeers: 5,
  poorForMs: 10_000,
  healthyForMs: 10_000,
  baseCoolMs: 60_000,
  maxCoolMs: 8 * 60_000,
  /** Healthy video for this long forgives the strikes. */
  forgiveAfterMs: 5 * 60_000,
}

export const initialGov = (): GovState => ({ paused: false, reason: null, until: 0, strikes: 0, poorSince: null, healthySince: null, resumedAt: null })

export function isPoor(samples: LinkSample[]): boolean {
  return samples.some((s) => s.loss > 0.08 || (s.rttMs != null && s.rttMs > 800) || (s.limited && s.fps != null && s.fps < 10))
}

export const coolOff = (strikes: number) => Math.min(LIMITS.maxCoolMs, LIMITS.baseCoolMs * 2 ** Math.max(0, strikes - 1))

export function stepGov(st: GovState, now: number, peers: number, samples: LinkSample[]): GovState {
  const poor = samples.length > 0 && isPoor(samples)
  const s: GovState = {
    ...st,
    poorSince: poor ? st.poorSince ?? now : null,
    healthySince: poor ? null : st.healthySince ?? now,
  }
  const crowd = peers > LIMITS.maxVideoPeers

  if (s.paused && s.reason === 'quality') {
    // A quality pause outlasts a crowd: the link was bad regardless.
    const healed = now >= s.until && s.healthySince != null && now - s.healthySince >= LIMITS.healthyForMs
    if (!healed) return s
    return crowd ? { ...s, reason: 'crowd', until: 0 } : { ...s, paused: false, reason: null, until: 0, resumedAt: now }
  }

  if (crowd) return { ...s, paused: true, reason: 'crowd', until: 0 }
  if (s.paused && s.reason === 'crowd') return { ...s, paused: false, reason: null, resumedAt: now }

  if (s.poorSince != null && now - s.poorSince >= LIMITS.poorForMs) {
    const strikes = s.strikes + 1
    return { ...s, paused: true, reason: 'quality', strikes, until: now + coolOff(strikes) }
  }
  if (s.strikes > 0 && s.resumedAt != null && s.healthySince != null && now - s.resumedAt >= LIMITS.forgiveAfterMs && now - s.healthySince >= LIMITS.forgiveAfterMs) {
    return { ...s, strikes: 0 }
  }
  return s
}
