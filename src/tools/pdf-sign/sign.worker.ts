// Stamping the signature into the PDF runs here off the main thread (#154):
// pdf-lib load + embedPng + save is pure-JS CPU work that scales with PDF size.
export interface SignPlacement { page: number; x: number; y: number; w: number }
export interface SignRequest { id: number; file: File; png: string; sigRatio: number; placements: SignPlacement[] }
export interface SignResponse { id: number; blob: Blob | null }

self.onmessage = async (e: MessageEvent<SignRequest>) => {
  const { id, file, png, sigRatio, placements } = e.data
  try {
    const { PDFDocument } = await import('pdf-lib')
    const pdf = await PDFDocument.load(await file.arrayBuffer())
    const embedded = await pdf.embedPng(png)
    const pgs = pdf.getPages()
    for (const pl of placements) {
      const page = pgs[pl.page]; if (!page) continue
      const W = page.getWidth(), H = page.getHeight()
      const w = pl.w * W, h = w * sigRatio
      page.drawImage(embedded, { x: pl.x * W, y: H - pl.y * H - h, width: w, height: h })
    }
    const bytes = await pdf.save()
    postMessage({ id, blob: new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }) } satisfies SignResponse)
  } catch {
    postMessage({ id, blob: null } satisfies SignResponse)
  }
}
