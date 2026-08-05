// True PDF redaction.
//
// The reason this tool exists: drawing a black rectangle over text in a PDF
// hides nothing. The text is still in the content stream, and anyone can select
// it, copy it, or run pdftotext. That mistake has leaked witness names, salaries
// and medical records from published documents repeatedly.
//
// The only approach that is safe without a full content-stream rewriter is to
// RASTERISE: render each page to an image, paint the redactions onto the image,
// and rebuild the PDF from those images. The text genuinely ceases to exist,
// because the page is now a picture of itself.
//
// The cost is real and stated in the UI: the output is no longer searchable or
// selectable, and the file is larger. That trade is the correct default for a
// redaction tool — a document that is smaller but still leaks is worthless.

export interface Box { page: number; x: number; y: number; w: number; h: number }

export interface RedactOptions {
  /** Render scale — higher keeps the page legible at the cost of file size. */
  dpi: number
  /** Also strip document metadata, which routinely names the author and tool. */
  stripMetadata: boolean
}

export interface Rendered { page: number; canvas: HTMLCanvasElement; width: number; height: number }

type Pdfjs = typeof import('pdfjs-dist')
let pdfjsPromise: Promise<Pdfjs> | null = null
async function loadPdfjs(): Promise<Pdfjs> {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  })()
  return pdfjsPromise
}

// Whole buffer, no streaming — the same iOS/in-app WebView constraint the other
// PDF tools work around.
const PDF_OPTS = { disableStream: true, disableAutoFetch: true } as const

/** Render every page to a canvas at the requested scale. */
export async function renderPages(file: File, dpi: number): Promise<Rendered[]> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), ...PDF_OPTS }).promise
  const out: Rendered[] = []
  const scale = dpi / 72
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    out.push({ page: i, canvas, width: canvas.width, height: canvas.height })
  }
  return out
}

/** Paint the boxes (given in 0–1 page-relative coordinates) onto the canvases. */
export function paintRedactions(pages: Rendered[], boxes: Box[]): void {
  for (const p of pages) {
    const ctx = p.canvas.getContext('2d')!
    ctx.fillStyle = '#000000'
    for (const b of boxes.filter((x) => x.page === p.page)) {
      ctx.fillRect(b.x * p.width, b.y * p.height, b.w * p.width, b.h * p.height)
    }
  }
}

/** Rebuild a PDF from the redacted page images. */
export async function buildPdf(pages: Rendered[], o: RedactOptions): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  for (const p of pages) {
    // JPEG at high quality: a scanned-looking page compresses far better as JPEG
    // than PNG, and the redaction is opaque either way.
    const dataUrl = p.canvas.toDataURL('image/jpeg', 0.92)
    const img = await doc.embedJpg(dataUrl)
    // Back to PDF points, so the page keeps its physical size.
    const scale = 72 / o.dpi
    const page = doc.addPage([p.width * scale, p.height * scale])
    page.drawImage(img, { x: 0, y: 0, width: p.width * scale, height: p.height * scale })
  }
  if (o.stripMetadata) {
    // A redacted document that still names its author in the metadata has not
    // been redacted. pdf-lib writes these on save unless they are cleared.
    doc.setTitle('')
    doc.setAuthor('')
    doc.setSubject('')
    doc.setKeywords([])
    doc.setProducer('')
    doc.setCreator('')
  }
  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

/** Was any text left behind? Re-extracts from the OUTPUT to prove the claim. */
export async function extractedTextLength(blob: Blob): Promise<number> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer(), ...PDF_OPTS }).promise
  let n = 0
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    for (const item of content.items as { str?: string }[]) n += (item.str ?? '').trim().length
  }
  return n
}
