// Printable sheets: compose each page on a canvas at print resolution, then
// wrap the pages in a PDF.
//
// Same reasoning as `textImage.ts` — pdf-lib cannot shape Arabic or reorder
// bidi text, and a worksheet or a bingo card is mostly *layout*, not selectable
// prose. Drawing the page with the browser's own text engine gets Arabic right
// for free and keeps the layout code in one place instead of two coordinate
// systems.

export const MM_TO_PT = 72 / 25.4

/**
 * An image placed on the page at its OWN resolution, over the composed raster.
 *
 * The page is one 150dpi bitmap, which is right for a worksheet and wrong for
 * anything a machine has to read back. A QR code proved it: at 150dpi a
 * 105-module code in a 44mm square is 2.5 pixels per module, and a decoder
 * needs about five — so the printed code looked perfect and **could not be
 * scanned**. Raising the whole page to 300dpi would fix it by making an A4
 * canvas 35MB, to sharpen one square.
 *
 * An overlay is embedded in the PDF as its own image instead, so it can be as
 * fine as it needs to be while the page stays cheap. `y` is measured from the
 * TOP, like the canvas, not from the PDF's bottom-left origin — the caller is
 * already thinking in canvas coordinates and converting in two places is how
 * they end up disagreeing.
 */
export interface Overlay {
  png: Uint8Array
  xMm: number
  yMm: number
  wMm: number
  hMm: number
  /**
   * Make the overlay a link to this address.
   *
   * A QR code on a printed sheet is for a phone, and the same sheet is read
   * on a screen at least as often — where a camera is the wrong tool and
   * there is nothing to tap. The annotation costs a few bytes and makes the
   * two readings of the page equivalent.
   */
  href?: string
}

export interface Page {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  /** Pixels per millimetre at the chosen DPI — multiply every mm measurement. */
  px: number
  wMm: number
  hMm: number
  /** Images drawn over the page raster at their own resolution. */
  overlays: Overlay[]
}

export const A4: [number, number] = [210, 297]
export const A4_LANDSCAPE: [number, number] = [297, 210]

/**
 * A blank white page. 150dpi is the point where a laser print looks clean and
 * an A4 canvas is still ~1240×1754 — high enough to read, small enough that a
 * thirty-page worksheet does not exhaust memory on a phone.
 */
export function newPage([wMm, hMm]: [number, number], dpi = 150): Page {
  const px = dpi / 25.4
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(wMm * px)
  canvas.height = Math.round(hMm * px)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textBaseline = 'top'
  return { canvas, ctx, px, wMm, hMm, overlays: [] }
}

/** Wrap `pages` into a PDF at their true physical size. */
export async function pagesToPdf(pages: Page[]): Promise<Blob> {
  const { PDFDocument, PDFString } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  for (const p of pages) {
    const png = await doc.embedPng(await toPng(p.canvas))
    const page = doc.addPage([p.wMm * MM_TO_PT, p.hMm * MM_TO_PT])
    page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
    for (const o of p.overlays) {
      const img = await doc.embedPng(o.png)
      const x = o.xMm * MM_TO_PT
      // Canvas y runs down from the top; PDF y runs up from the bottom.
      const y = (p.hMm - o.yMm - o.hMm) * MM_TO_PT
      const w = o.wMm * MM_TO_PT
      const h = o.hMm * MM_TO_PT
      page.drawImage(img, { x, y, width: w, height: h })
      if (o.href) {
        // `Border: [0, 0, 0]` or the reader rings the QR in blue, which is
        // noise over a code a camera has to read.
        const annot = doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [x, y, x + w, y + h],
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'URI', URI: PDFString.of(o.href) },
        })
        page.node.addAnnot(doc.context.register(annot))
      }
    }
  }
  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

/** A canvas as PNG bytes — what an `Overlay` takes. */
export async function toPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('encode failed')
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Deterministic RNG (mulberry32) seeded from a string.
 *
 * This matters more than it looks: a teacher who prints a worksheet, hits a
 * paper jam and prints again must get the SAME sheet — otherwise the answer key
 * in their hand belongs to a different worksheet. So the seed is shown, and
 * re-generating is an explicit act rather than a side effect of a re-render.
 */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A short, readable seed to show in the UI. */
export function newSeed(): string {
  const b = new Uint8Array(3)
  crypto.getRandomValues(b)
  return [...b].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 6).toUpperCase()
}

/** Fisher-Yates, driven by a seeded RNG so a shuffle is reproducible. */
export function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
export const toArabicDigits = (s: string | number) =>
  String(s).replace(/\d/g, (d) => AR_DIGITS[Number(d)])
