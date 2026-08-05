// Printable sheets: compose each page on a canvas at print resolution, then
// wrap the pages in a PDF.
//
// Same reasoning as `textImage.ts` — pdf-lib cannot shape Arabic or reorder
// bidi text, and a worksheet or a bingo card is mostly *layout*, not selectable
// prose. Drawing the page with the browser's own text engine gets Arabic right
// for free and keeps the layout code in one place instead of two coordinate
// systems.

export const MM_TO_PT = 72 / 25.4

export interface Page {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  /** Pixels per millimetre at the chosen DPI — multiply every mm measurement. */
  px: number
  wMm: number
  hMm: number
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
  return { canvas, ctx, px, wMm, hMm }
}

/** Wrap `pages` into a PDF at their true physical size. */
export async function pagesToPdf(pages: Page[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  for (const p of pages) {
    const png = await doc.embedPng(await toPng(p.canvas))
    const page = doc.addPage([p.wMm * MM_TO_PT, p.hMm * MM_TO_PT])
    page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
  }
  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

async function toPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
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
