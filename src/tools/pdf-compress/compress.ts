// Client-side PDF compressor. The big win for real-world PDFs (scans, photo-
// heavy exports) is re-rendering each page to a JPEG at a chosen DPI/quality and
// rebuilding the file — so we render with pdf.js and reassemble with pdf-lib.
// Trade-off (surfaced in the UI): pages become images, so text is no longer
// selectable. Nothing is uploaded.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface Level { scale: number; quality: number }

/** Presets: render scale (≈ DPI/72) × JPEG quality. */
export const LEVELS: Record<'strong' | 'balanced' | 'light', Level> = {
  strong: { scale: 1.0, quality: 0.5 },
  balanced: { scale: 1.5, quality: 0.7 },
  light: { scale: 2.0, quality: 0.85 },
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
}

export async function compressPdf(
  file: File,
  level: Level,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const out = await PDFDocument.create()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const vp = page.getViewport({ scale: level.scale })
    canvas.width = Math.max(1, Math.ceil(vp.width))
    canvas.height = Math.max(1, Math.ceil(vp.height))
    // JPEG has no alpha — paint white so transparent areas don't turn black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
    const blob = await toBlob(canvas, level.quality)
    if (!blob) throw new Error('encode failed')
    const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
    const pts = page.getViewport({ scale: 1 }) // page size in points (keeps rotation)
    const p = out.addPage([pts.width, pts.height])
    p.drawImage(jpg, { x: 0, y: 0, width: pts.width, height: pts.height })
    onProgress?.(i, doc.numPages)
  }
  const bytes = await out.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}
