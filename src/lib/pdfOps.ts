// Promise client for pdfOps.worker.ts (#154) — same shape as ImageEncoder:
// one worker per tool instance, dispose on unmount, null = failed/locked.
import type { PdfRequest, PdfResponse, PdfFailure, PageSource, OutPage, ImageFit } from './pdfOps.worker'
export type { PageSource, OutPage, ImageFit } from './pdfOps.worker'

export class PdfOps {
  private worker: Worker | null = null
  private seq = 0
  private pending = new Map<number, (r: PdfResponse) => void>()

  /**
   * Why the last op returned null. Read it straight after a null result.
   *
   * Kept as a field rather than folded into every return type because every
   * caller already treats null as "it did not work"; only the ones that want to
   * say something better need to look, and none of them had to change shape.
   */
  lastFailure: PdfFailure | null = null

  private post(req: PdfRequest, resolve: (r: PdfResponse) => void) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./pdfOps.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e: MessageEvent<PdfResponse>) => {
        this.lastFailure = e.data.why ?? null
        this.pending.get(e.data.id)?.(e.data)
        this.pending.delete(e.data.id)
      }
      // A worker that dies posts nothing; answer everything still waiting, or
      // the page sits on "saving" for ever with nothing to report or retry.
      this.worker.onerror = () => {
        this.lastFailure = 'unreadable'
        for (const [id, done] of this.pending) done({ id, op: 'organise', blob: null, why: 'unreadable' })
        this.pending.clear()
      }
    }
    this.pending.set(req.id, resolve)
    this.worker.postMessage(req)
  }

  /**
   * Build one PDF from pages of several sources, in one pass.
   *
   * `pages` is the OUTPUT order: each entry names its source, the page within
   * it, and how much further to turn it. A deleted page is simply not listed.
   */
  organise(sources: PageSource[], pages: OutPage[], fit: ImageFit): Promise<Blob | null> {
    const id = ++this.seq
    return new Promise((res) => this.post({ id, op: 'organise', sources, pages, fit }, (r) => res(r.blob)))
  }

  dispose() { this.worker?.terminate(); this.worker = null; this.pending.clear() }
}
