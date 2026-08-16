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
 * sounds and reshape the spectrum, which makes a sound meter read a level that
 * is not there.
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
