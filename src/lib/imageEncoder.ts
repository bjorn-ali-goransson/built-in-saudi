// Promise client for imageEncode.worker.ts (#154). Each tool creates one
// ImageEncoder (= one worker holding that tool's decoded bitmap) and disposes
// it on unmount. Callers keep their own stale-result guards, same as they did
// around canvas.toBlob.
import type { EncodeJob, EncodeRequest, EncodeResponse } from './imageEncode.worker'

export type { EncodeJob }

export class ImageEncoder {
  private worker: Worker | null = null
  private seq = 0
  private pending = new Map<number, (r: EncodeResponse) => void>()

  private post(req: EncodeRequest, resolve: (r: EncodeResponse) => void) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./imageEncode.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e: MessageEvent<EncodeResponse>) => {
        this.pending.get(e.data.id)?.(e.data)
        this.pending.delete(e.data.id)
      }
    }
    this.pending.set(req.id, resolve)
    this.worker.postMessage(req)
  }

  /** Decode a file into the worker-held bitmap. Resolves null if it can't be decoded. */
  load(file: File): Promise<{ width: number; height: number } | null> {
    const id = ++this.seq
    return new Promise((res) => this.post({ id, op: 'load', file }, (r) =>
      res(r.op === 'load' && !r.error ? { width: r.width, height: r.height } : null)))
  }

  /** Crop/scale/encode the loaded bitmap. Resolves null on failure. */
  encode(job: EncodeJob): Promise<Blob | null> {
    const id = ++this.seq
    return new Promise((res) => this.post({ id, op: 'encode', job }, (r) =>
      res(r.op === 'encode' ? r.blob : null)))
  }

  dispose() { this.worker?.terminate(); this.worker = null; this.pending.clear() }
}
