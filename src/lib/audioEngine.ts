// Shared Web Audio plumbing for the sound tools.
//
// Two things here are non-obvious and both are the difference between a toy and
// a usable instrument:
//
// 1. A metronome CANNOT be driven by setInterval. Timer callbacks drift by tens
//    of milliseconds under load and stop entirely in a background tab, which at
//    120bpm is audibly wrong within a few bars. The fix is the standard one:
//    a slow timer that looks AHEAD and schedules notes on the audio clock, which
//    is sample-accurate and runs on its own thread.
//
// 2. Autoplay policy blocks an AudioContext created before a user gesture. So
//    the context is made lazily on first play and resumed explicitly, and the
//    tools never construct one just to sit idle.

let ctx: AudioContext | null = null

/** The shared context, created on first use (needs a gesture) and resumed. */
export function audioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext
      || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function closeAudio() {
  ctx?.close().catch(() => {})
  ctx = null
}

/** A short percussive click — the metronome's voice. */
export function click(at: number, accent: boolean, gain = 0.5) {
  const c = audioContext()
  const osc = c.createOscillator()
  const env = c.createGain()
  // A downbeat is a higher, slightly louder click. Same envelope, so it reads as
  // the same instrument rather than two different sounds.
  osc.frequency.value = accent ? 1600 : 1000
  osc.connect(env)
  env.connect(c.destination)
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(accent ? gain : gain * 0.7, at + 0.001)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
  osc.start(at)
  osc.stop(at + 0.06)
}

export interface SchedulerOptions {
  /** Called for each note; returns nothing. `at` is an audio-clock time. */
  onNote: (at: number, index: number) => void
  /** Seconds between notes — read fresh each tick so tempo changes apply live. */
  interval: () => number
}

/**
 * The look-ahead scheduler. A 25ms timer queues everything falling due in the
 * next 100ms onto the audio clock; the timer may be late without the audio being
 * late, because each note already has its exact start time.
 */
export class Scheduler {
  private timer = 0
  private nextTime = 0
  private index = 0
  private running = false

  constructor(private o: SchedulerOptions) {}

  start() {
    if (this.running) return
    const c = audioContext()
    this.running = true
    this.index = 0
    this.nextTime = c.currentTime + 0.1
    const tick = () => {
      if (!this.running) return
      const now = audioContext().currentTime
      while (this.nextTime < now + 0.1) {
        this.o.onNote(this.nextTime, this.index)
        this.index++
        this.nextTime += this.o.interval()
      }
      this.timer = window.setTimeout(tick, 25)
    }
    tick()
  }

  stop() {
    this.running = false
    window.clearTimeout(this.timer)
  }

  get isRunning() { return this.running }
  get beatIndex() { return this.index }
}

// ── Microphone ──────────────────────────────────────────────────────────────

export interface MicStream {
  analyser: AnalyserNode
  stop: () => void
}

/**
 * Open the microphone with the browser's own processing OFF. Echo cancellation
 * and noise suppression are designed for speech on a call: they gate quiet
 * sounds and reshape the spectrum, which makes a tuner read the wrong pitch and
 * a sound meter read a level that is not there.
 */
export async function openMic(fftSize = 2048): Promise<MicStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })
  const c = audioContext()
  const source = c.createMediaStreamSource(stream)
  const analyser = c.createAnalyser()
  analyser.fftSize = fftSize
  analyser.smoothingTimeConstant = 0
  source.connect(analyser)
  return {
    analyser,
    stop: () => {
      // Stopping the TRACKS is what releases the mic and clears the recording
      // indicator — disconnecting the node alone leaves the light on.
      stream.getTracks().forEach((t) => t.stop())
      source.disconnect()
    },
  }
}

/**
 * Fundamental frequency by autocorrelation. FFT peak-picking is the obvious
 * approach and it is wrong for instruments: the loudest partial is often the
 * second or third harmonic, so a guitar's low E reads an octave high.
 * Autocorrelation finds the repeating PERIOD, which is the fundamental even
 * when it is quieter than its overtones.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const size = buffer.length
  let rms = 0
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i]
  rms = Math.sqrt(rms / size)
  // Too quiet to be a note rather than a room.
  if (rms < 0.008) return null

  // Trim leading and trailing near-silence so the correlation is over signal.
  const threshold = 0.2
  let start = 0
  let end = size - 1
  while (start < size / 2 && Math.abs(buffer[start]) < threshold) start++
  while (end > size / 2 && Math.abs(buffer[end]) < threshold) end--
  const trimmed = buffer.slice(start, end)
  const n = trimmed.length
  if (n < 128) return null

  const c = new Float32Array(n).fill(0)
  for (let lag = 0; lag < n; lag++) {
    for (let i = 0; i < n - lag; i++) c[lag] += trimmed[i] * trimmed[i + lag]
  }

  // Skip the zero-lag peak, then take the first maximum after the dip.
  let d = 0
  while (d < n - 1 && c[d] > c[d + 1]) d++
  let maxVal = -1
  let maxPos = -1
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i }
  }
  if (maxPos <= 0) return null

  // Parabolic interpolation around the peak: without it the reading quantises to
  // whole samples, which near the top of the range is several cents of error.
  const y1 = c[maxPos - 1] ?? c[maxPos]
  const y2 = c[maxPos]
  const y3 = c[maxPos + 1] ?? c[maxPos]
  const a = (y1 + y3 - 2 * y2) / 2
  const b = (y3 - y1) / 2
  const period = a ? maxPos - b / (2 * a) : maxPos

  const freq = sampleRate / period
  return freq > 20 && freq < 5000 ? freq : null
}

// ── Notes ───────────────────────────────────────────────────────────────────

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

export interface Note { name: string; octave: number; cents: number; midi: number }

/** Nearest note, and how far off in cents. A440 is configurable — orchestras
 *  and older instruments do not all agree on it. */
export function toNote(freq: number, a4 = 440): Note {
  const midiFloat = 69 + 12 * Math.log2(freq / a4)
  const midi = Math.round(midiFloat)
  return {
    name: NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: Math.round((midiFloat - midi) * 100),
    midi,
  }
}

export function noteFrequency(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12)
}

/** Peak and RMS level of a buffer, in dBFS. */
export function levels(buffer: Float32Array): { peak: number; rms: number } {
  let peak = 0
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    const v = Math.abs(buffer[i])
    if (v > peak) peak = v
    sum += buffer[i] * buffer[i]
  }
  const rms = Math.sqrt(sum / buffer.length)
  const db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity)
  return { peak: db(peak), rms: db(rms) }
}
