import type { Decoded } from '../../lib/audio'

// Resampling and channel mixing, both handed to the browser.
//
// `OfflineAudioContext` created AT THE TARGET RATE resamples on render, and its
// resampler is properly band-limited. Writing the obvious linear interpolation
// instead would alias badly on the case this tool exists for — downsampling to
// 16 kHz — folding everything above 8 kHz back down as a metallic whine. The
// platform already has a correct implementation; there is no reason to ship a
// worse one.
//
// The same context does the channel mixing: asking for one channel applies the
// spec's own down-mix (average of L and R), rather than dropping one side and
// silently losing whatever was panned there.

/** Sample rates worth offering, with the reason each exists. */
export const RATES = [8000, 16000, 22050, 44100, 48000] as const
export type Rate = (typeof RATES)[number]

/**
 * Chrome accepts 3000–768000, but nothing outside this range is a sensible ask
 * from a converter, and an out-of-range value throws rather than degrading.
 */
export const MIN_RATE = 3000
export const MAX_RATE = 768000

export interface Target {
  /** null keeps the source rate. */
  sampleRate: number | null
  /** null keeps the source channel count. */
  channels: 1 | 2 | null
}

export async function convert(d: Decoded, t: Target): Promise<Decoded> {
  const sampleRate = t.sampleRate ?? d.sampleRate
  const channels = t.channels ?? Math.min(2, d.channels.length) as 1 | 2
  if (sampleRate === d.sampleRate && channels === d.channels.length) return d
  if (sampleRate < MIN_RATE || sampleRate > MAX_RATE) throw new Error('rate-range')

  const frames = Math.max(1, Math.round(d.duration * sampleRate))
  const ctx = new OfflineAudioContext(channels, frames, sampleRate)

  // The source buffer must be created at the SOURCE rate, so the context has
  // something to resample from. Creating it at the target rate would relabel
  // the samples instead of converting them — the file would play at the wrong
  // speed and pitch, which is the classic way to get this wrong.
  const src = ctx.createBuffer(d.channels.length, d.channels[0].length, d.sampleRate)
  // copyToChannel wants a Float32Array over a plain ArrayBuffer; a decoded
  // channel is typed as ArrayBufferLike, which includes SharedArrayBuffer.
  for (let i = 0; i < d.channels.length; i++) src.getChannelData(i).set(d.channels[i])

  const node = ctx.createBufferSource()
  node.buffer = src
  node.connect(ctx.destination)
  node.start()
  const out = await ctx.startRendering()

  return {
    channels: Array.from({ length: out.numberOfChannels }, (_, i) => out.getChannelData(i)),
    sampleRate: out.sampleRate,
    duration: out.duration,
  }
}

/** How big the WAV will be, so the choice can be made before waiting for it. */
export const sizeOf = (frames: number, channels: number) => 44 + frames * channels * 2

export function estimate(d: Decoded, t: Target): number {
  const rate = t.sampleRate ?? d.sampleRate
  const ch = t.channels ?? Math.min(2, d.channels.length)
  return sizeOf(Math.round(d.duration * rate), ch)
}
