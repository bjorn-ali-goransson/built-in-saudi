// Shared audio decode/encode for the audio tools.
//
// Decoding leans entirely on the browser: `decodeAudioData` handles every
// container it can play — mp3, m4a/aac, wav, ogg, flac, and the audio track
// inside an mp4/webm video — so there is no demuxer dependency here. What the
// browser cannot decode, we say so about rather than shipping a megabyte of
// wasm to cover the last few percent.
//
// Encoding is WAV, deliberately. Re-encoding to mp3 would need a real encoder
// dependency and would lose quality a second time; WAV is lossless, universal
// and needs no library. The tools say plainly that the result is uncompressed.

export interface Decoded {
  channels: Float32Array[]
  sampleRate: number
  duration: number
}

/** Decode any audio the browser can play. Throws if it cannot. */
export async function decodeAudio(file: File): Promise<Decoded> {
  const buf = await file.arrayBuffer()
  // OfflineAudioContext, not AudioContext: it needs no user gesture and never
  // opens the speakers just to decode.
  const Ctx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
  const ctx = new Ctx(1, 1, 44100)
  const audio = await ctx.decodeAudioData(buf)
  const channels: Float32Array[] = []
  for (let c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c).slice())
  return { channels, sampleRate: audio.sampleRate, duration: audio.duration }
}

/** Cut [start, end] in seconds out of a decode, with optional fades. */
export function slice(d: Decoded, start: number, end: number, fadeMs = 0): Decoded {
  const from = Math.max(0, Math.floor(start * d.sampleRate))
  const to = Math.min(d.channels[0].length, Math.ceil(end * d.sampleRate))
  const len = Math.max(0, to - from)
  const fade = Math.min(Math.floor((fadeMs / 1000) * d.sampleRate), Math.floor(len / 2))
  const channels = d.channels.map((ch) => {
    const out = ch.slice(from, to)
    // A hard cut mid-waveform is an audible click; a few ms of ramp removes it.
    for (let i = 0; i < fade; i++) {
      out[i] *= i / fade
      out[len - 1 - i] *= i / fade
    }
    return out
  })
  return { channels, sampleRate: d.sampleRate, duration: len / d.sampleRate }
}

/** Peak pairs per bucket, for drawing a waveform without touching every sample twice. */
export function peaks(d: Decoded, buckets: number): { min: number; max: number }[] {
  const ch = d.channels[0]
  const per = Math.max(1, Math.floor(ch.length / buckets))
  const out: { min: number; max: number }[] = []
  for (let b = 0; b < buckets; b++) {
    const start = b * per
    const stop = Math.min(ch.length, start + per)
    let min = 0, max = 0
    // Stride on very long files: a 3-hour recording is 500M samples and the
    // pixel is 2px wide — reading every sample buys nothing visible.
    const step = Math.max(1, Math.floor((stop - start) / 800))
    for (let i = start; i < stop; i += step) {
      const v = ch[i]
      if (v < min) min = v
      if (v > max) max = v
    }
    out.push({ min, max })
  }
  return out
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}.${ms}`
}

/** Rough size of the WAV this decode would produce. */
export function wavBytes(d: Decoded): number {
  return 44 + d.channels.length * d.channels[0].length * 2
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}
