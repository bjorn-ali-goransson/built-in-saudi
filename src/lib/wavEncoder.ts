import type { Decoded } from './audio'
import type { WavRequest, WavResponse } from './wav.worker'

// Thin client for wav.worker.ts: one worker per caller, requests matched by id
// so a stale response (the user re-trimmed while the last encode was running)
// is dropped instead of downloaded.
export class WavEncoder {
  private worker: Worker | null = null
  private next = 1
  private pending = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void }>()

  private ensure(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./wav.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e: MessageEvent<WavResponse>) => {
        const entry = this.pending.get(e.data.id)
        if (!entry) return // stale — the caller moved on
        this.pending.delete(e.data.id)
        if (e.data.error || !e.data.wav) entry.reject(new Error(e.data.error || 'encode failed'))
        else entry.resolve(new Blob([e.data.wav], { type: 'audio/wav' }))
      }
    }
    return this.worker
  }

  encode(d: Decoded): Promise<Blob> {
    const worker = this.ensure()
    const id = this.next++
    // Copy before transferring: the caller still needs its channel data to draw
    // the waveform and to encode again after the next edit.
    const buffers = d.channels.map((c) => c.slice().buffer)
    return new Promise<Blob>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const req: WavRequest = { id, channels: buffers, sampleRate: d.sampleRate }
      worker.postMessage(req, buffers)
    })
  }

  /** Drop everything still in flight — call on unmount. */
  terminate() {
    this.worker?.terminate()
    this.worker = null
    this.pending.clear()
  }
}
