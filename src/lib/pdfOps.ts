// Promise client for pdfOps.worker.ts (#154) — same shape as ImageEncoder:
// one worker per tool instance, dispose on unmount, null = failed/locked.
import type { PdfRequest, PdfResponse } from './pdfOps.worker'

export class PdfOps {
  private worker: Worker | null = null
  private seq = 0
  private pending = new Map<number, (r: PdfResponse) => void>()

  private post(req: PdfRequest, resolve: (r: PdfResponse) => void) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./pdfOps.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e: MessageEvent<PdfResponse>) => {
        this.pending.get(e.data.id)?.(e.data)
        this.pending.delete(e.data.id)
      }
    }
    this.pending.set(req.id, resolve)
    this.worker.postMessage(req)
  }

  /** Page count, or null if the PDF is locked/unreadable. */
  pageCount(file: File): Promise<number | null> {
    const id = ++this.seq
    return new Promise((res) => this.post({ id, op: 'pageCount', file }, (r) => res(r.op === 'pageCount' ? r.pages : null)))
  }

  merge(files: File[]): Promise<Blob | null> {
    const id = ++this.seq
    return new Promise((res) => this.post({ id, op: 'merge', files }, (r) => res(r.op === 'merge' ? r.blob : null)))
  }

  /** Extract the given 0-based page indices into a new PDF. */
  extract(file: File, indices: number[]): Promise<Blob | null> {
    const id = ++this.seq
    return new Promise((res) => this.post({ id, op: 'extract', file, indices }, (r) => res(r.op === 'extract' ? r.blob : null)))
  }

  /** Split into one PDF per page; resolves the raw bytes per page. */
  burst(file: File): Promise<ArrayBuffer[] | null> {
    const id = ++this.seq
    return new Promise((res) => this.post({ id, op: 'burst', file }, (r) => res(r.op === 'burst' ? r.pages : null)))
  }

  dispose() { this.worker?.terminate(); this.worker = null; this.pending.clear() }
}
