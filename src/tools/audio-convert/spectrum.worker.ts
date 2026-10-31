import { cutoffHz, hann, magnitudes } from './fft'

// The STFT runs off the main thread (#154): a three-minute track at 44.1 kHz is
// about 7,700 frames of a 2048-point FFT, which visibly freezes a page.
//
// The AUDIO IS DECODED ON THE MAIN THREAD and only the samples are transferred,
// because `decodeAudioData` needs an AudioContext and a worker has none. That is
// the opposite arrangement to `imageEncode.worker.ts`, where the decode is the
// part that moves — worth knowing before copying either as a pattern.

export interface SpectrumRequest {
  id: number
  /** Mono samples, transferred. */
  samples: Float32Array
  sampleRate: number
  /** Number of columns to produce; the render width, so no frame is wasted. */
  columns: number
}

export interface SpectrumResponse {
  id: number
  /** columns × bins, magnitudes in dB relative to the loudest bin. */
  image: Float32Array
  bins: number
  columns: number
  /** The average spectrum across the whole file, for the cutoff. */
  cutoff: number
}

const SIZE = 2048

self.onmessage = (e: MessageEvent<SpectrumRequest>) => {
  const { id, samples, sampleRate, columns } = e.data
  const win = hann(SIZE)
  const bins = SIZE >> 1
  const image = new Float32Array(columns * bins)
  const avg = new Float32Array(bins)

  // One frame per COLUMN rather than a fixed hop: the picture is the output, so
  // computing thousands of frames to average them into 900 pixels is work
  // thrown away. The average that feeds the cutoff is over these same frames,
  // which is a sample of the file rather than all of it — stated in the UI.
  const last = Math.max(0, samples.length - SIZE)
  for (let c = 0; c < columns; c++) {
    const start = columns > 1 ? Math.floor((c / (columns - 1)) * last) : 0
    const mags = magnitudes(samples.subarray(start, start + SIZE), win)
    for (let b = 0; b < bins; b++) {
      avg[b] += mags[b]
      // dB, floored: a spectrogram in linear magnitude is a black rectangle,
      // because hearing is logarithmic and so is everything interesting here.
      image[c * bins + b] = 20 * Math.log10(mags[b] + 1e-12)
    }
  }
  for (let b = 0; b < bins; b++) avg[b] /= columns

  const res: SpectrumResponse = {
    id, image, bins, columns, cutoff: cutoffHz(avg, sampleRate),
  }
  ;(postMessage as (m: SpectrumResponse, t: Transferable[]) => void)(res, [image.buffer])
}
