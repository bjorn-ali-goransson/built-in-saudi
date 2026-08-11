// Imposition off the main thread (#154).
//
// Measured before this existed, on a desktop and with pdf-lib on synthetic
// text-only PDFs:
//
//   | pages | load | mutate every page | save | total |
//   |-------|------|-------------------|------|-------|
//   |  20   | 21ms |   6ms             | 33ms |  60ms |
//   | 100   | 66ms |  20ms             |164ms | 249ms |
//
// A phone is three to six times slower, so a hundred-page booklet froze the
// page for **three quarters of a second to a second and a half** — during which
// nothing scrolls, no spinner turns, and the tool looks broken rather than
// busy. Imposition also embeds every source page into a new document, so the
// real figure is worse than the table.
//
// `impose.ts` is unchanged and imported as it stands: it is pure pdf-lib with
// no canvas and no DOM, which is exactly why this tool was the one to move
// first. The others in the family draw a watermark, a signature or a
// re-encoded image through a canvas, and moving them needs `OffscreenCanvas`
// in `textImage.ts` — a larger change that this one does not block.

import { impose, pageCount, type ImposeOptions } from './impose'

export interface ImposeReq {
  id: number
  /** `File` handles are passed, not bytes: the read happens here. */
  file: File
  /** Omitted for a page count. */
  options?: ImposeOptions
}

export interface ImposeRes {
  id: number
  blob?: Blob
  count?: number
  error?: string
}

// A rejection that escapes the handler below posts nothing, and the caller
// then waits for ever — which is how the blank-page bug presented once the work
// moved in here. Reported rather than swallowed: a stuck spinner is worse than
// an error, because there is nothing to retry.
let current = 0
self.addEventListener('unhandledrejection', (ev) => {
  ;(self as unknown as Worker).postMessage({ id: current, error: String((ev as PromiseRejectionEvent).reason) } as ImposeRes)
})

self.onmessage = async (e: MessageEvent<ImposeReq>) => {
  const { id, file, options } = e.data
  current = id
  try {
    const out: ImposeRes = options
      ? { id, blob: await impose(file, options) }
      : { id, count: await pageCount(file) }
    ;(self as unknown as Worker).postMessage(out)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) } as ImposeRes)
  }
}
