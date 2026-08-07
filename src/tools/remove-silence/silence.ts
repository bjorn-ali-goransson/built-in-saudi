import type { Decoded } from '../../lib/audio'

// Cutting the silence out of a recording.
//
// The thing that separates this from a naive gate is the PADDING. Detect a
// silent stretch, cut exactly where it starts and ends, and you clip the breath
// before a word and the tail of the one before it — the result sounds chopped,
// which is worse than the silence was. So a margin is kept on each side, and the
// cut only happens when what remains is still long enough to be worth removing.
//
// Everything is measured in RMS over short windows rather than sample peaks: one
// stray click in an otherwise silent second should not keep the whole second.

export interface SilenceOptions {
  /** Anything quieter than this counts as silence, in dBFS. */
  thresholdDb: number
  /** Ignore silences shorter than this, in seconds. */
  minSilence: number
  /** Keep this much of the silence at each edge, in seconds. */
  padding: number
}

export const DEFAULTS: SilenceOptions = { thresholdDb: -45, minSilence: 0.5, padding: 0.12 }

export interface Region { start: number; end: number }

const WINDOW = 0.02 // 20ms — short enough for speech, long enough to be stable

/** RMS per window, in dBFS. */
export function windowLevels(d: Decoded): { levels: Float32Array; windowSec: number } {
  const size = Math.max(1, Math.round(WINDOW * d.sampleRate))
  const count = Math.ceil(d.channels[0].length / size)
  const levels = new Float32Array(count)
  for (let w = 0; w < count; w++) {
    const from = w * size
    const to = Math.min(from + size, d.channels[0].length)
    let sum = 0
    let n = 0
    for (const ch of d.channels) {
      for (let i = from; i < to; i++) { sum += ch[i] * ch[i]; n++ }
    }
    const rms = n ? Math.sqrt(sum / n) : 0
    levels[w] = rms > 0 ? 20 * Math.log10(rms) : -Infinity
  }
  return { levels, windowSec: size / d.sampleRate }
}

/** The stretches that will be cut out. */
export function findSilences(d: Decoded, o: SilenceOptions): Region[] {
  const { levels, windowSec } = windowLevels(d)
  const out: Region[] = []
  let runStart = -1
  for (let i = 0; i <= levels.length; i++) {
    const silent = i < levels.length && levels[i] < o.thresholdDb
    if (silent && runStart < 0) runStart = i
    if (!silent && runStart >= 0) {
      const start = runStart * windowSec
      const end = i * windowSec
      if (end - start >= o.minSilence) {
        // Keep a margin at each edge so a breath or a word's tail survives; if
        // the padding would swallow the whole silence there is nothing to cut.
        const from = start + o.padding
        const to = end - o.padding
        if (to - from > 0.02) out.push({ start: from, end: to })
      }
      runStart = -1
    }
  }
  return out
}

/** The audio that survives, as regions to keep. */
export function keptRegions(duration: number, cuts: Region[]): Region[] {
  const kept: Region[] = []
  let at = 0
  for (const c of cuts) {
    if (c.start > at) kept.push({ start: at, end: c.start })
    at = Math.max(at, c.end)
  }
  if (at < duration) kept.push({ start: at, end: duration })
  return kept.filter((r) => r.end - r.start > 0.001)
}

/** Concatenate the kept regions into one buffer. */
export function applyCuts(d: Decoded, kept: Region[]): Decoded {
  const total = kept.reduce((n, r) => n + Math.round((r.end - r.start) * d.sampleRate), 0)
  const channels = d.channels.map(() => new Float32Array(total))
  let write = 0
  for (const r of kept) {
    const from = Math.max(0, Math.round(r.start * d.sampleRate))
    const to = Math.min(d.channels[0].length, Math.round(r.end * d.sampleRate))
    const len = Math.max(0, to - from)
    d.channels.forEach((ch, c) => channels[c].set(ch.subarray(from, to), write))
    write += len
  }
  return { channels, sampleRate: d.sampleRate, duration: total / d.sampleRate }
}

export const totalCut = (cuts: Region[]) => cuts.reduce((n, r) => n + (r.end - r.start), 0)
