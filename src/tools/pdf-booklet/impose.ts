// Imposition: rearranging pages so that what comes off the printer folds into
// something readable.
//
// The two jobs people actually have are different and get conflated:
//   • n-up — put 2 or 4 pages side by side to save paper. Order is sequential.
//   • booklet — fold a stack in half and staple the spine. The page ORDER is not
//     sequential at all: the outermost sheet carries the last page next to the
//     first, and the sequence walks inwards from both ends at once.
// Getting the second one wrong produces a booklet whose pages are in a
// scrambled order, and you only find out after printing and folding it.

export type Mode = 'booklet' | 'nup2' | 'nup4'

export interface Sheet {
  /** Source page indices (0-based), or null for a blank. */
  slots: (number | null)[]
}

/**
 * Saddle-stitch order. Pages are padded to a multiple of 4 with blanks, then
 * each printed SIDE holds two pages: front is [last, first], back is
 * [second, second-last], and so on inwards.
 */
export function bookletOrder(pageCount: number): Sheet[] {
  const total = Math.ceil(pageCount / 4) * 4
  const idx = (n: number) => (n < pageCount ? n : null)
  const sheets: Sheet[] = []
  let left = total - 1
  let right = 0
  while (right < left) {
    sheets.push({ slots: [idx(left), idx(right)] })       // front of the sheet
    sheets.push({ slots: [idx(right + 1), idx(left - 1)] }) // its back
    right += 2
    left -= 2
  }
  return sheets
}

/** Straight n-up: sequential, filling each sheet left-to-right, top-to-bottom. */
export function nupOrder(pageCount: number, per: number): Sheet[] {
  const sheets: Sheet[] = []
  for (let i = 0; i < pageCount; i += per) {
    sheets.push({
      slots: Array.from({ length: per }, (_, k) => (i + k < pageCount ? i + k : null)),
    })
  }
  return sheets
}

export interface ImposeOptions {
  mode: Mode
  /** Right-to-left reading order — an Arabic booklet is bound on the other side. */
  rtl: boolean
  /** Gap between the placed pages, in points. */
  gutter: number
  /** Draw a thin line where the fold or cut goes. */
  marks: boolean
}

export async function impose(file: File, o: ImposeOptions): Promise<Blob> {
  const { PDFDocument, rgb } = await import('pdf-lib')
  const src = await PDFDocument.load(await file.arrayBuffer())
  const count = src.getPageCount()
  const sheets = o.mode === 'booklet' ? bookletOrder(count)
    : nupOrder(count, o.mode === 'nup2' ? 2 : 4)

  const out = await PDFDocument.create()
  const first = src.getPage(0)
  const pw = first.getWidth()
  const ph = first.getHeight()

  // 2-up and booklet lay two portrait pages on one landscape sheet; 4-up keeps
  // the sheet portrait and puts four on it.
  const perRow = o.mode === 'nup4' ? 2 : 2
  const perCol = o.mode === 'nup4' ? 2 : 1
  const sheetW = o.mode === 'nup4' ? pw : ph
  const sheetH = o.mode === 'nup4' ? ph : pw

  // Embed every source page once, then place the copies.
  const embedded = await out.embedPages(src.getPages())

  for (const sheet of sheets) {
    const page = out.addPage([sheetW, sheetH])
    const cellW = (sheetW - o.gutter * (perRow - 1)) / perRow
    const cellH = (sheetH - o.gutter * (perCol - 1)) / perCol
    const scale = Math.min(cellW / pw, cellH / ph)

    // RTL flips the slot order across the sheet, so an Arabic booklet folds and
    // reads the correct way round.
    const slots = o.rtl ? sheet.slots.map((_, i, a) => a[rowFlip(i, perRow)]) : sheet.slots

    slots.forEach((sourceIndex, i) => {
      if (sourceIndex === null) return
      const col = i % perRow
      const row = Math.floor(i / perRow)
      const x = col * (cellW + o.gutter) + (cellW - pw * scale) / 2
      // PDF's origin is bottom-left, so row 0 sits at the TOP of the sheet.
      const y = sheetH - (row + 1) * cellH - row * o.gutter + (cellH - ph * scale) / 2
      page.drawPage(embedded[sourceIndex], { x, y, xScale: scale, yScale: scale })
    })

    if (o.marks) {
      // A hairline where the fold or cut goes — without it people guess.
      const grey = rgb(0.7, 0.7, 0.7)
      for (let c = 1; c < perRow; c++) {
        const x = c * (cellW + o.gutter) - o.gutter / 2
        page.drawLine({ start: { x, y: 0 }, end: { x, y: sheetH }, thickness: 0.5, color: grey, dashArray: [3, 3] })
      }
      for (let r = 1; r < perCol; r++) {
        const y = sheetH - r * (cellH + o.gutter) + o.gutter / 2
        page.drawLine({ start: { x: 0, y }, end: { x: sheetW, y }, thickness: 0.5, color: grey, dashArray: [3, 3] })
      }
    }
  }

  const bytes = await out.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

/** Mirror an index within its row, for right-to-left placement. */
function rowFlip(i: number, perRow: number): number {
  const row = Math.floor(i / perRow)
  const col = i % perRow
  return row * perRow + (perRow - 1 - col)
}

export async function pageCount(file: File): Promise<number> {
  const { PDFDocument } = await import('pdf-lib')
  return (await PDFDocument.load(await file.arrayBuffer())).getPageCount()
}
