// Draw text through the browser, then hand pdf-lib a picture of it.
//
// pdf-lib's standard fonts are Latin-only, and embedding a real TTF needs
// @pdf-lib/fontkit — a dependency we do not have and do not want for this. More
// importantly, even with a font embedded, pdf-lib draws glyphs in the order it
// is given them: it does not shape Arabic (initial/medial/final forms) and does
// not do the bidi reordering that mixed Arabic-and-Latin text needs. Text drawn
// that way comes out as disconnected letters in the wrong order.
//
// A canvas already does all of that, correctly, using the fonts the page has
// loaded. So anything with user text in it is rendered to a canvas and embedded
// as an image. The cost is that the text is not selectable in the PDF — which
// for a label, a certificate or a watermark is no cost at all.

export interface TextImageOptions {
  text: string
  /** CSS font shorthand, e.g. '600 48px "IBM Plex Sans Arabic", sans-serif'. */
  font: string
  colour: string
  /** Pixel width to wrap within; height grows to fit. */
  maxWidth: number
  lineHeight?: number
  align?: 'start' | 'center' | 'end'
  /** Right-to-left when the text is predominantly Arabic. */
  rtl?: boolean
  opacity?: number
  /** Degrees, for a diagonal watermark. */
  rotate?: number
  padding?: number
}

export interface TextImage { canvas: HTMLCanvasElement; width: number; height: number }

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/

export function isArabic(text: string): boolean {
  return ARABIC.test(text)
}

/** Wrap on whitespace, measuring with the real font so the break points are right. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { out.push(''); continue }
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate
      else { out.push(line); line = word }
    }
    out.push(line)
  }
  return out
}

export function renderTextImage(o: TextImageOptions): TextImage {
  const dpr = 1 // already rendering at print resolution; no extra scaling
  const pad = o.padding ?? 0
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = o.font
  const lines = wrap(measure, o.text, o.maxWidth - pad * 2)
  const size = parseFloat(o.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '16')
  const lh = o.lineHeight ?? size * 1.35
  const contentH = Math.max(lh, lines.length * lh)

  const w = Math.ceil(o.maxWidth)
  const h = Math.ceil(contentH + pad * 2)

  const canvas = document.createElement('canvas')
  const rot = ((o.rotate ?? 0) * Math.PI) / 180
  if (rot) {
    // Rotating needs a canvas big enough for the rotated bounding box.
    const cos = Math.abs(Math.cos(rot))
    const sin = Math.abs(Math.sin(rot))
    canvas.width = Math.ceil(w * cos + h * sin)
    canvas.height = Math.ceil(w * sin + h * cos)
  } else {
    canvas.width = w
    canvas.height = h
  }

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  if (rot) {
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(rot)
    ctx.translate(-w / 2, -h / 2)
  }
  ctx.globalAlpha = o.opacity ?? 1
  ctx.font = o.font
  ctx.fillStyle = o.colour
  ctx.textBaseline = 'top'
  // The canvas does the bidi work when direction is set and the text is RTL.
  ctx.direction = o.rtl ?? isArabic(o.text) ? 'rtl' : 'ltr'
  const align = o.align ?? 'start'
  ctx.textAlign = align === 'center' ? 'center' : align === 'end'
    ? (ctx.direction === 'rtl' ? 'left' : 'right')
    : (ctx.direction === 'rtl' ? 'right' : 'left')
  const x = align === 'center' ? w / 2 : align === 'end'
    ? (ctx.direction === 'rtl' ? pad : w - pad)
    : (ctx.direction === 'rtl' ? w - pad : pad)

  lines.forEach((line, i) => ctx.fillText(line, x, pad + i * lh))
  return { canvas, width: canvas.width, height: canvas.height }
}

/** PNG bytes, ready for pdf-lib's embedPng. */
export async function toPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('encode failed')
  return new Uint8Array(await blob.arrayBuffer())
}

/** The font stack to use, picking the Arabic face when the text needs it. */
export function fontFor(text: string, weight: number, px: number): string {
  return isArabic(text)
    ? `${weight} ${px}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
    : `${weight} ${px}px "Hanken Grotesk", system-ui, sans-serif`
}
