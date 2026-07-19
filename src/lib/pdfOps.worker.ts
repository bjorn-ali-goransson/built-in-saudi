// pdf-lib operations off the main thread (#154). pdf-lib's load/copy/save are
// pure-JS CPU work that used to run on the UI thread; here they run in a
// worker, with pdf-lib lazy-loaded into the worker bundle on first use.
// Driven via PdfOps (pdfOps.ts); one worker instance per tool instance.
export type PdfRequest =
  | { id: number; op: 'pageCount'; file: File }
  | { id: number; op: 'merge'; files: File[] }
  | { id: number; op: 'extract'; file: File; indices: number[] }
  | { id: number; op: 'burst'; file: File }
export type PdfResponse =
  | { id: number; op: 'pageCount'; pages: number | null }
  | { id: number; op: 'merge'; blob: Blob | null }
  | { id: number; op: 'extract'; blob: Blob | null }
  | { id: number; op: 'burst'; pages: ArrayBuffer[] | null }

let lib: typeof import('pdf-lib') | null = null
const pdf = async () => (lib ??= await import('pdf-lib'))

const asPdfBlob = (bytes: Uint8Array) => new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })

self.onmessage = async (e: MessageEvent<PdfRequest>) => {
  const req = e.data
  try {
    const { PDFDocument } = await pdf()
    if (req.op === 'pageCount') {
      const doc = await PDFDocument.load(await req.file.arrayBuffer())
      postMessage({ id: req.id, op: 'pageCount', pages: doc.getPageCount() } satisfies PdfResponse)
    } else if (req.op === 'merge') {
      const merged = await PDFDocument.create()
      for (const f of req.files) {
        const src = await PDFDocument.load(await f.arrayBuffer())
        const pages = await merged.copyPages(src, src.getPageIndices())
        pages.forEach((p) => merged.addPage(p))
      }
      postMessage({ id: req.id, op: 'merge', blob: asPdfBlob(await merged.save()) } satisfies PdfResponse)
    } else if (req.op === 'extract') {
      const doc = await PDFDocument.load(await req.file.arrayBuffer())
      const out = await PDFDocument.create()
      const copied = await out.copyPages(doc, req.indices)
      copied.forEach((p) => out.addPage(p))
      postMessage({ id: req.id, op: 'extract', blob: asPdfBlob(await out.save()) } satisfies PdfResponse)
    } else {
      const doc = await PDFDocument.load(await req.file.arrayBuffer())
      const pages: ArrayBuffer[] = []
      for (let i = 0; i < doc.getPageCount(); i++) {
        const out = await PDFDocument.create()
        const [p] = await out.copyPages(doc, [i])
        out.addPage(p)
        const bytes = await out.save()
        pages.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      }
      // transfer the page buffers — no copy back to the main thread
      ;(postMessage as (m: PdfResponse, t: Transferable[]) => void)({ id: req.id, op: 'burst', pages }, pages)
    }
  } catch {
    const nulls = { pageCount: { pages: null }, merge: { blob: null }, extract: { blob: null }, burst: { pages: null } } as const
    postMessage({ id: req.id, op: req.op, ...nulls[req.op] } as PdfResponse)
  }
}
