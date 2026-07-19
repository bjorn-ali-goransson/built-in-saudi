// PDF Edit's heavy pdf-lib work runs here off the main thread (#154):
// 'load' parses the content streams (loadEditable), 'save' rebuilds the PDF
// with edits + added text. PageContent/Set/Map all survive structured clone.
import type { PageContent, ImgXf } from './contentStream'

export interface EditText { page: number; x: number; y: number; w: number; size: number; text: string }
export type EditRequest =
  | { id: number; op: 'load'; buf: ArrayBuffer }
  | { id: number; op: 'save'; file: File; pc: PageContent[]; deleted: Set<string>; xf: Map<string, ImgXf>; texts: EditText[] }
export type EditResponse =
  | { id: number; op: 'load'; pages: PageContent[] | null }
  | { id: number; op: 'save'; blob: Blob | null }

self.onmessage = async (e: MessageEvent<EditRequest>) => {
  const req = e.data
  try {
    if (req.op === 'load') {
      const { loadEditable } = await import('./contentStream')
      const { pages } = await loadEditable(req.buf)
      postMessage({ id: req.id, op: 'load', pages } satisfies EditResponse)
      return
    }
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
    const { applyEdits, writePage } = await import('./contentStream')
    const pdf = await PDFDocument.load(await req.file.arrayBuffer())
    for (const page of req.pc) {
      const hasEdit = page.objects.some((o) => req.deleted.has(o.id) || req.xf.has(o.id))
      if (hasEdit) writePage(pdf, page.page, applyEdits(page, req.deleted, req.xf))
    }
    if (req.texts.some((t) => t.text.trim())) {
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      const pgs = pdf.getPages()
      for (const t of req.texts) {
        const page = pgs[t.page]; if (!page || !t.text.trim()) continue
        const W = page.getWidth(), H = page.getHeight()
        // eslint-disable-next-line no-control-regex
        const safe = t.text.replace(/[^\x00-\xFF]/g, '')
        page.drawText(safe, { x: t.x * W, y: H - t.y * H - t.size, size: t.size, font, color: rgb(0.05, 0.05, 0.05), maxWidth: t.w * W, lineHeight: t.size * 1.2 })
      }
    }
    const bytes = await pdf.save()
    postMessage({ id: req.id, op: 'save', blob: new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }) } satisfies EditResponse)
  } catch {
    postMessage(req.op === 'load'
      ? ({ id: req.id, op: 'load', pages: null } satisfies EditResponse)
      : ({ id: req.id, op: 'save', blob: null } satisfies EditResponse))
  }
}
