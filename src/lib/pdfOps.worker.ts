// pdf-lib operations off the main thread (#154). pdf-lib's load/copy/save are
// pure-JS CPU work that used to run on the UI thread; here they run in a
// worker, with pdf-lib lazy-loaded into the worker bundle on first use.
// Driven via PdfOps (pdfOps.ts); one worker instance per tool instance.
//
// ONE op, because merging, putting pictures into a PDF and reordering pages are
// one job: say which page of which source goes where, turned how far. They were
// three tools until November 2026 and three ops before that.

/** Where pages come from: a PDF, or a picture that becomes one page. */
export type PageSource =
  | { kind: 'pdf'; file: File }
  /** PNG or JPEG bytes; anything else is converted to PNG on the page first. */
  | { kind: 'image'; bytes: ArrayBuffer; jpeg: boolean }

/** One page of the output: which source, which page of it, and how much further to turn it. */
export interface OutPage { src: number; from: number; rotate: number }

/** How a picture is laid on its page. */
export interface ImageFit { size: 'fit' | 'a4' | 'letter'; margin: number }

export type PdfRequest =
  | { id: number; op: 'organise'; sources: PageSource[]; pages: OutPage[]; fit: ImageFit }
// The reason and the sniff live in `lib/pdfFailure.ts`, because the seven tools
// that load pdf-lib directly need exactly the same answer and a second copy of
// the rule is a second chance to disagree with this one.
import { pdfFailure, type PdfFailure } from './pdfFailure'
export type { PdfFailure } from './pdfFailure'

export type PdfResponse =
  | { id: number; op: 'organise'; blob: Blob | null; why?: PdfFailure }

let lib: typeof import('pdf-lib') | null = null
const pdf = async () => (lib ??= await import('pdf-lib'))

const asPdfBlob = (bytes: Uint8Array) => new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })

const PAPER: Record<'a4' | 'letter', [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] }

self.onmessage = async (e: MessageEvent<PdfRequest>) => {
  const req = e.data
  try {
    const { PDFDocument, degrees } = await pdf()
    const out = await PDFDocument.create()
    const turnOf = (r: number) => ((r % 360) + 360) % 360

    // Copy every page wanted from a source in ONE copyPages call. Copying page
    // by page duplicates the fonts and images the pages share, once per page,
    // and the file comes out several times the size it should be.
    const copied = new Map<string, import('pdf-lib').PDFPage>()
    for (const [si, src] of req.sources.entries()) {
      if (src.kind !== 'pdf') continue
      const wanted = [...new Set(req.pages.filter((p) => p.src === si).map((p) => p.from))]
      if (!wanted.length) continue
      const doc = await PDFDocument.load(await src.file.arrayBuffer())
      const pages = await out.copyPages(doc, wanted)
      wanted.forEach((from, k) => copied.set(`${si}:${from}`, pages[k]))
    }
    const images = new Map<number, import('pdf-lib').PDFImage>()

    for (const p of req.pages) {
      const src = req.sources[p.src]
      const turn = turnOf(p.rotate)
      if (src.kind === 'pdf') {
        // A page used twice must be copied twice; pdf-lib will not add one page object to a document twice.
        let page = copied.get(`${p.src}:${p.from}`)
        if (!page) {
          const doc = await PDFDocument.load(await src.file.arrayBuffer())
          ;[page] = await out.copyPages(doc, [p.from])
        } else copied.delete(`${p.src}:${p.from}`)
        // Rotation ADDS to whatever the page already carried: a page saved at
        // 90° that the user turns 90° more must end up at 180°, not 90°.
        if (turn) page.setRotation(degrees((page.getRotation().angle + turn) % 360))
        out.addPage(page)
      } else {
        let img = images.get(p.src)
        if (!img) {
          const bytes = new Uint8Array(src.bytes)
          img = src.jpeg ? await out.embedJpg(bytes) : await out.embedPng(bytes)
          images.set(p.src, img)
        }
        let page
        if (req.fit.size === 'fit') {
          page = out.addPage([img.width, img.height])
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
        } else {
          const [bw, bh] = PAPER[req.fit.size]
          const landscape = img.width > img.height
          const pw = landscape ? bh : bw, ph = landscape ? bw : bh
          page = out.addPage([pw, ph])
          const m = req.fit.margin
          const scale = Math.min((pw - m * 2) / img.width, (ph - m * 2) / img.height)
          const w = img.width * scale, h = img.height * scale
          page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
        }
        if (turn) page.setRotation(degrees(turn))
      }
    }
    postMessage({ id: req.id, op: 'organise', blob: asPdfBlob(await out.save()) } satisfies PdfResponse)
  } catch (e) {
    const why: PdfFailure = pdfFailure(e)
    postMessage({ id: req.id, op: req.op, blob: null, why } satisfies PdfResponse)
  }
}

