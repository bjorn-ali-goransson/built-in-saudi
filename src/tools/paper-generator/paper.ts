// Printable paper. Everything is drawn in PDF points (1pt = 1/72in) so what
// prints matches the millimetres asked for — a PNG at "300dpi" is at the mercy
// of whatever the print dialog decides to scale it by, which is why these are
// PDFs rather than images.

export type Kind = 'graph' | 'dot' | 'ruled' | 'isometric' | 'cornell' | 'arabic' | 'music' | 'blank'

export interface PageSize { id: string; en: string; ar: string; w: number; h: number }

const MM = 72 / 25.4

export const SIZES: PageSize[] = [
  { id: 'a4', en: 'A4', ar: 'A4', w: 210 * MM, h: 297 * MM },
  { id: 'a5', en: 'A5', ar: 'A5', w: 148 * MM, h: 210 * MM },
  { id: 'letter', en: 'US Letter', ar: 'Letter', w: 8.5 * 72, h: 11 * 72 },
  { id: 'a3', en: 'A3', ar: 'A3', w: 297 * MM, h: 420 * MM },
]

export const KINDS: { id: Kind; en: string; ar: string }[] = [
  { id: 'graph', en: 'Graph paper', ar: 'ورق مربعات' },
  { id: 'dot', en: 'Dot grid', ar: 'ورق نقاط' },
  { id: 'ruled', en: 'Ruled lines', ar: 'ورق مسطّر' },
  { id: 'isometric', en: 'Isometric', ar: 'متساوي القياس' },
  { id: 'cornell', en: 'Cornell notes', ar: 'ملاحظات كورنيل' },
  { id: 'arabic', en: 'Arabic handwriting practice', ar: 'تدريب الخط العربي' },
  { id: 'music', en: 'Music staves', ar: 'مدرّج موسيقي' },
  { id: 'blank', en: 'Blank with margin', ar: 'فارغ بهامش' },
]

export interface Options {
  kind: Kind
  size: PageSize
  landscape: boolean
  /** Grid/line spacing in millimetres. */
  spacing: number
  margin: number
  ink: [number, number, number]
  lineWidth: number
  pages: number
  /** Arabic practice sheets are right-to-left, and the guide lines differ. */
  rtl: boolean
}

export const DEFAULTS: Omit<Options, 'size'> = {
  kind: 'graph', landscape: false, spacing: 5, margin: 10,
  ink: [0.55, 0.62, 0.58], lineWidth: 0.4, pages: 1, rtl: true,
}

export interface Line { x1: number; y1: number; x2: number; y2: number; width?: number; alpha?: number }
export interface Dot { x: number; y: number; r: number }

export interface Drawing { lines: Line[]; dots: Dot[]; width: number; height: number }

/** Build the geometry for one page. Kept pure so it can be unit-tested and so
 *  the on-screen preview and the PDF are guaranteed to agree. */
export function build(o: Options): Drawing {
  const width = o.landscape ? o.size.h : o.size.w
  const height = o.landscape ? o.size.w : o.size.h
  const m = o.margin * MM
  const step = o.spacing * MM
  const lines: Line[] = []
  const dots: Dot[] = []
  const left = m, right = width - m, bottom = m, top = height - m

  if (o.kind === 'graph') {
    // Every fifth line darker, which is what makes graph paper readable.
    let i = 0
    for (let x = left; x <= right + 0.01; x += step, i++) {
      lines.push({ x1: x, y1: bottom, x2: x, y2: top, width: i % 5 === 0 ? o.lineWidth * 2 : o.lineWidth })
    }
    i = 0
    for (let y = bottom; y <= top + 0.01; y += step, i++) {
      lines.push({ x1: left, y1: y, x2: right, y2: y, width: i % 5 === 0 ? o.lineWidth * 2 : o.lineWidth })
    }
  } else if (o.kind === 'dot') {
    for (let x = left; x <= right + 0.01; x += step) {
      for (let y = bottom; y <= top + 0.01; y += step) dots.push({ x, y, r: o.lineWidth * 1.6 })
    }
  } else if (o.kind === 'ruled') {
    for (let y = bottom; y <= top + 0.01; y += step) lines.push({ x1: left, y1: y, x2: right, y2: y })
  } else if (o.kind === 'isometric') {
    // Three families of lines at 0°, 60° and 120°, which is what makes it read
    // as a 3-D grid rather than diamonds.
    const dy = step * Math.sin(Math.PI / 3)
    for (let y = bottom; y <= top + 0.01; y += dy) lines.push({ x1: left, y1: y, x2: right, y2: y, alpha: 0.5 })
    const span = (top - bottom) / Math.tan(Math.PI / 3)
    for (let x = left - span; x <= right + span; x += step) {
      lines.push({ x1: x, y1: bottom, x2: x + span, y2: top })
      lines.push({ x1: x, y1: bottom, x2: x - span, y2: top })
    }
  } else if (o.kind === 'cornell') {
    const cueX = o.rtl ? right - 60 * MM : left + 60 * MM
    const summaryY = bottom + 50 * MM
    lines.push({ x1: left, y1: top, x2: right, y2: top, width: o.lineWidth * 2 })
    lines.push({ x1: cueX, y1: summaryY, x2: cueX, y2: top, width: o.lineWidth * 2 })
    lines.push({ x1: left, y1: summaryY, x2: right, y2: summaryY, width: o.lineWidth * 2 })
    for (let y = summaryY + step; y < top - 1; y += step) {
      lines.push({ x1: o.rtl ? left : cueX, y1: y, x2: o.rtl ? cueX : right, y2: y, alpha: 0.5 })
    }
  } else if (o.kind === 'arabic') {
    // Four-line guides: baseline, x-height, ascender and descender — Arabic
    // letters sit ON the baseline with a large descender well, so the gaps are
    // not symmetrical the way Latin practice paper is.
    const band = step * 4
    for (let base = top - band; base >= bottom; base -= band * 1.6) {
      lines.push({ x1: left, y1: base, x2: right, y2: base, width: o.lineWidth * 2 })        // baseline
      lines.push({ x1: left, y1: base + step * 1.4, x2: right, y2: base + step * 1.4, alpha: 0.55 })
      lines.push({ x1: left, y1: base + step * 3, x2: right, y2: base + step * 3, alpha: 0.35 })
      lines.push({ x1: left, y1: base - step * 1.8, x2: right, y2: base - step * 1.8, alpha: 0.35 })
    }
  } else if (o.kind === 'music') {
    const staffGap = step
    const staffHeight = staffGap * 4
    for (let base = top - staffHeight; base >= bottom; base -= staffHeight + step * 3) {
      for (let n = 0; n < 5; n++) {
        lines.push({ x1: left, y1: base + n * staffGap, x2: right, y2: base + n * staffGap })
      }
    }
  } else {
    lines.push({ x1: left, y1: bottom, x2: right, y2: bottom, alpha: 0.4 })
    lines.push({ x1: left, y1: top, x2: right, y2: top, alpha: 0.4 })
    lines.push({ x1: left, y1: bottom, x2: left, y2: top, alpha: 0.4 })
    lines.push({ x1: right, y1: bottom, x2: right, y2: top, alpha: 0.4 })
  }

  return { lines, dots, width, height }
}

export async function toPdf(o: Options): Promise<Blob> {
  // pdf-lib is already a dependency for the PDF tools and loads lazily.
  const { PDFDocument, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const drawing = build(o)
  const colour = rgb(o.ink[0], o.ink[1], o.ink[2])
  for (let p = 0; p < Math.max(1, o.pages); p++) {
    const page = doc.addPage([drawing.width, drawing.height])
    for (const l of drawing.lines) {
      page.drawLine({
        start: { x: l.x1, y: l.y1 },
        end: { x: l.x2, y: l.y2 },
        thickness: l.width ?? o.lineWidth,
        color: colour,
        opacity: l.alpha ?? 1,
      })
    }
    for (const d of drawing.dots) {
      page.drawCircle({ x: d.x, y: d.y, size: d.r, color: colour })
    }
  }
  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}
