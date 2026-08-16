// A radix-2 FFT, a Hann window, and the one measurement this tool exists for.
//
// `lib/audio.ts` already decodes anything the browser can play — mp3, m4a, ogg,
// flac, wav and the audio track of a video — and three tools use it without any
// of them ever looking at the FREQUENCY content. `AnalyserNode` is the
// platform's own FFT and is used by `sound-meter`, but it only
// works on live playback: there is no way to ask it about a file without
// playing the file through in real time. Hence this.
//
// The tool exists for one checkable insight: **a lossy encoder throws away
// everything above a cutoff, and that cutoff is visible.** A 128 kbps MP3 stops
// dead around 16 kHz; 192 around 19; 320 and lossless run to about 20 or to the
// Nyquist limit. So a file "converted to 320" from a 128 source has a 16 kHz
// wall and is not what it says it is — a thing you cannot hear and can see in
// two seconds.

/**
 * In-place iterative radix-2 Cooley-Tukey.
 *
 * `re` and `im` are modified. Length must be a power of two — the caller pads,
 * because a check that throws in a worker on the last partial frame is a bad
 * trade for the caller simply not producing one.
 */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr
      const ti = im[i]; im[i] = im[j]; im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k]
        const br = re[i + k + len / 2], bi = im[i + k + len / 2]
        const tr = br * cr - bi * ci
        const ti = br * ci + bi * cr
        re[i + k] = ar + tr; im[i + k] = ai + ti
        re[i + k + len / 2] = ar - tr; im[i + k + len / 2] = ai - ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

/**
 * A Hann window, precomputed once per size.
 *
 * Without a window every frame is a rectangular slice, and the discontinuity at
 * its edges smears energy across the whole spectrum — spectral leakage. On this
 * tool that is not cosmetic: leakage fills the band above a lossy encoder's
 * cutoff, and the wall the tool exists to show disappears into a haze.
 */
export function hann(size: number): Float32Array {
  const w = new Float32Array(size)
  for (let i = 0; i < size; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)))
  return w
}

/** Magnitudes for the first half of the spectrum (the rest is a mirror). */
export function magnitudes(samples: Float32Array, window: Float32Array): Float32Array {
  const n = window.length
  const re = new Float32Array(n)
  const im = new Float32Array(n)
  for (let i = 0; i < n; i++) re[i] = (samples[i] ?? 0) * window[i]
  fft(re, im)
  const half = n >> 1
  const out = new Float32Array(half)
  for (let i = 0; i < half; i++) out[i] = Math.hypot(re[i], im[i])
  return out
}

/**
 * The highest frequency still carrying real energy.
 *
 * Measured against the loudest bin rather than an absolute level, because the
 * file's overall volume is irrelevant to where its content stops. `-60 dB`
 * relative is quiet enough to ignore the noise floor and dither, and loud
 * enough that a genuine 20 kHz cymbal still counts.
 *
 * Scanning DOWN from the top and stopping at the first bin above the threshold
 * is what makes this a cutoff rather than a peak: a lossy file has plenty of
 * energy below the wall and none above it.
 */
export function cutoffHz(avg: Float32Array, sampleRate: number): number {
  let peak = 0
  for (const v of avg) if (v > peak) peak = v
  if (peak <= 0) return 0
  const floor = peak * Math.pow(10, -60 / 20)
  for (let i = avg.length - 1; i >= 0; i--) {
    if (avg[i] > floor) return (i * sampleRate) / (avg.length * 2)
  }
  return 0
}

export interface Verdict { key: 'lossless' | 'high' | 'medium' | 'low' | 'unknown'; khz: number }

/**
 * What a cutoff suggests about where the file came from.
 *
 * Deliberately worded as a suggestion in the UI: a quiet recording with no
 * high-frequency content of its own — a spoken-word file, a bass line — has a
 * low cutoff and was never lossy. The measurement is exact; the inference is
 * not, and conflating them would be the dishonest half.
 */
export function verdict(hz: number): Verdict {
  const khz = hz / 1000
  if (khz >= 20) return { key: 'lossless', khz }
  if (khz >= 18.5) return { key: 'high', khz }
  if (khz >= 17) return { key: 'medium', khz }
  if (khz >= 1) return { key: 'low', khz }
  return { key: 'unknown', khz }
}
