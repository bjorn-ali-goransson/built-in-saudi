// Client-side PDF compressor. The big win for real-world PDFs (scans, photo-
// heavy exports) is re-rendering each page to a JPEG at a chosen DPI/quality and
// rebuilding the file — so we render with pdf.js and reassemble with pdf-lib.
// Trade-off (surfaced in the UI): pages become images, so text is no longer
// selectable. Nothing is uploaded.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface Level { scale: number; quality: number }
export type LevelKey = 'strong' | 'balanced' | 'light'

/** Page-render presets: render scale (≈ DPI/72) × JPEG quality. */
export const LEVELS: Record<LevelKey, Level> = {
  strong: { scale: 1.0, quality: 0.5 },
  balanced: { scale: 1.5, quality: 0.7 },
  light: { scale: 2.0, quality: 0.85 },
}

/** Image-recompress presets: cap the longest edge (px) × JPEG quality. */
export interface ImgLevel { maxEdge: number; quality: number }
export const IMG_LEVELS: Record<LevelKey, ImgLevel> = {
  strong: { maxEdge: 1000, quality: 0.5 },
  balanced: { maxEdge: 1600, quality: 0.66 },
  light: { maxEdge: 2400, quality: 0.82 },
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

/** Recompress only the embedded JPEG images (keeps text/vectors selectable).
 *  Finds DCTDecode image XObjects, downsamples/re-encodes each, and swaps it
 *  back in place. Leaves non-JPEG images, soft masks, and everything else
 *  untouched. Returns null if there were no recompressible JPEG images. */
export async function recompressImages(
  file: File,
  level: ImgLevel,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob | null> {
  const { PDFDocument, PDFName, PDFRawStream } = await import('pdf-lib')
  const doc = await PDFDocument.load(await file.arrayBuffer())
  const objs = doc.context.enumerateIndirectObjects()
  const asImage = (o: unknown) => (o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype'))?.toString() === '/Image' ? o : null)

  // Soft-mask targets must stay grayscale/alpha — never recompress them as RGB.
  const smaskKeys = new Set<string>()
  for (const [, o] of objs) {
    const im = asImage(o); if (!im) continue
    const sm = im.dict.get(PDFName.of('SMask')); if (sm) smaskKeys.add(sm.toString())
  }
  const jpegs = objs.filter(([ref, o]) => {
    const im = asImage(o)
    return im && !smaskKeys.has(ref.toString()) && String(im.dict.get(PDFName.of('Filter'))).includes('DCTDecode')
  })

  if (!jpegs.length) return null
  let done = 0, changed = 0
  for (const [ref, obj] of jpegs) {
    const st = asImage(obj)
    if (!st) continue
    onProgress?.(++done, jpegs.length)
    try {
      const bmp = await createImageBitmap(new Blob([st.contents as BlobPart], { type: 'image/jpeg' }))
      const f = Math.min(1, level.maxEdge / Math.max(bmp.width, bmp.height))
      const w = Math.max(1, Math.round(bmp.width * f)), h = Math.max(1, Math.round(bmp.height * f))
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d'); if (!ctx) { bmp.close?.(); continue }
      ctx.drawImage(bmp, 0, 0, w, h); bmp.close?.()
      const blob = await toBlob(canvas, level.quality)
      if (!blob) continue
      const nb = new Uint8Array(await blob.arrayBuffer())
      if (nb.length >= st.contents.length) continue // no gain — keep the original
      const d = st.dict
      d.set(PDFName.of('Width'), doc.context.obj(w))
      d.set(PDFName.of('Height'), doc.context.obj(h))
      d.set(PDFName.of('BitsPerComponent'), doc.context.obj(8))
      d.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'))
      d.set(PDFName.of('Filter'), PDFName.of('DCTDecode'))
      d.delete(PDFName.of('DecodeParms')); d.delete(PDFName.of('Decode'))
      d.set(PDFName.of('Length'), doc.context.obj(nb.length))
      doc.context.assign(ref, PDFRawStream.of(d, nb))
      changed++
    } catch { /* unsupported (e.g. CMYK) — skip this image */ }
  }
  if (!changed) return null
  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}
