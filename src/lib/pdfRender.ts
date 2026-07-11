// Shared client-side PDF rasteriser for the interactive PDF tools (sign / fill).
// Renders each page to a PNG data URL *and* reports the page's size in PDF points
// (getViewport scale 1 === points at 72dpi), which the tools need to map on-screen
// placements back to pdf-lib coordinates on export. Heavy (pdf.js), so lazy-import.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface RenderedPage {
  url: string
  /** Page width/height in PDF points (origin bottom-left in the actual PDF). */
  wPt: number
  hPt: number
}

/** Rasterise every page. `scale` trades sharpness for memory (2 ≈ crisp on retina). */
export async function renderPdf(data: ArrayBuffer, scale = 2): Promise<RenderedPage[]> {
  const doc = await pdfjs.getDocument({ data }).promise
  const out: RenderedPage[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const pts = page.getViewport({ scale: 1 })
    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(vp.width)
    canvas.height = Math.ceil(vp.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
    out.push({ url: canvas.toDataURL('image/png'), wPt: pts.width, hPt: pts.height })
  }
  return out
}
