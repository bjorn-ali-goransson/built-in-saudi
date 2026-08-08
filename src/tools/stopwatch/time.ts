// Stopwatch and timer arithmetic, kept out of the component so it can be
// reasoned about (and tested) without a clock ticking.
//
// The important decision is that **elapsed time is derived from timestamps, not
// accumulated per tick**. A counter that adds 10ms on every interval drifts,
// and — worse — stops entirely when the tab is backgrounded, because browsers
// throttle timers and pause requestAnimationFrame. Someone who starts a timer
// and switches apps comes back to a clock that lost the intervening minutes.
// Recording *when* it started and subtracting on each frame is correct however
// irregularly the frames arrive, and correct after the tab was never painted at
// all.

export interface Running {
  /** performance.now() at the moment the clock last started. */
  since: number
  /** Milliseconds banked from previous runs, before the current start. */
  banked: number
}

/** Elapsed milliseconds, running or paused. */
export function elapsed(state: Running | null, banked: number, now: number): number {
  return state ? banked + (now - state.since) : banked
}

/** mm:ss.t — the format a stopwatch is read at a glance. */
export function format(ms: number): string {
  const clamped = Math.max(0, ms)
  const total = Math.floor(clamped / 100)
  const tenths = total % 10
  const secs = Math.floor(total / 10) % 60
  const mins = Math.floor(total / 600) % 60
  const hours = Math.floor(total / 36000)
  const mm = String(mins).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}.${tenths}` : `${mm}:${ss}.${tenths}`
}

/** Lap splits from cumulative marks: each lap is the gap from the one before. */
export function splits(marks: number[]): { lap: number; total: number }[] {
  return marks.map((total, i) => ({ total, lap: total - (marks[i - 1] ?? 0) }))
}

/** Milliseconds for a minutes/seconds pair, guarding against nonsense input. */
export const durationMs = (minutes: number, seconds: number) =>
  Math.max(0, Math.floor(minutes || 0)) * 60_000 + Math.max(0, Math.floor(seconds || 0)) * 1000
