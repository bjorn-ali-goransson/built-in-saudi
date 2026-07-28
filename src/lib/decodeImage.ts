// One way in for "turn this picked file into an ImageBitmap" (#226).
//
// Every image tool routes through here, so HEIC support lands in all of them at
// once. The browser is tried first — it's instant for PNG/JPEG/WebP and free — and
// only a failure on a file that actually IS HEIC pays for the wasm decoder.
import { isHeicBuffer } from './heicDecode'
import type { HeicRequest, HeicResponse } from './heic.worker'

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (b: ImageBitmap) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./heic.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<HeicResponse>) => {
      const p = pending.get(e.data.id)
      if (!p) return // a stale reply for a file the user has already moved on from
      pending.delete(e.data.id)
      if (e.data.bitmap) p.resolve(e.data.bitmap)
      else p.reject(new Error(e.data.error || 'HEIC decode failed'))
    }
    worker.onerror = () => {
      // The wasm bundle failed to load at all — fail every waiter rather than hang.
      for (const [, p] of pending) p.reject(new Error('HEIC decoder unavailable'))
      pending.clear()
    }
  }
  return worker
}

function decodeHeicInWorker(file: File): Promise<ImageBitmap> {
  const id = ++seq
  return new Promise<ImageBitmap>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, file } satisfies HeicRequest)
  })
}

/** Decode a picked file, transparently handling HEIC. Returns null if it genuinely
 *  can't be read, so callers can show a reason instead of failing silently. */
export async function decodeImage(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file)
  } catch {
    // Only reach for the multi-megabyte decoder when the bytes say HEIC.
    try {
      const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
      if (!isHeicBuffer(head)) return null
      return await decodeHeicInWorker(file)
    } catch { return null }
  }
}

/** Free the decoder worker (and its wasm) — call when a tool unmounts. */
export function disposeImageDecoder() {
  worker?.terminate()
  worker = null
  pending.clear()
}
