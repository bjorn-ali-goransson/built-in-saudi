import { renderTextImage, toPngBytes, fontFor } from '../../lib/textImage'

// Label sheets. The measurements are the published ones for each stock; getting
// them approximately right is useless, because a millimetre of drift compounds
// across a column and the last label prints off its backing.
//
// The feature that matters and that most generators omit: STARTING AT A GIVEN
// LABEL. Nobody throws away a sheet with twelve labels left on it, so a
// generator that always starts at position 1 gets used once.

const MM = 72 / 25.4

export interface Stock {
  id: string
  en: string
  ar: string
  /** Page size in mm. */
  page: [number, number]
  cols: number
  rows: number
  /** Label size in mm. */
  label: [number, number]
  /** Margin from the page edge to the first label, in mm. */
  margin: [number, number]
  /** Gap between labels, in mm. */
  gap: [number, number]
}

export const STOCKS: Stock[] = [
  {
    id: 'a4-3x7', en: 'A4 · 21 labels (63.5 × 38.1 mm)', ar: 'A4 · ٢١ ملصقًا (٦٣٫٥ × ٣٨٫١ مم)',
    page: [210, 297], cols: 3, rows: 7, label: [63.5, 38.1], margin: [7.25, 15.15], gap: [2.5, 0],
  },
  {
    id: 'a4-2x7', en: 'A4 · 14 labels (99.1 × 38.1 mm)', ar: 'A4 · ١٤ ملصقًا (٩٩٫١ × ٣٨٫١ مم)',
    page: [210, 297], cols: 2, rows: 7, label: [99.1, 38.1], margin: [4.65, 15.15], gap: [2.5, 0],
  },
  {
    id: 'a4-2x8', en: 'A4 · 16 labels (99.1 × 33.9 mm)', ar: 'A4 · ١٦ ملصقًا (٩٩٫١ × ٣٣٫٩ مم)',
    page: [210, 297], cols: 2, rows: 8, label: [99.1, 33.9], margin: [4.65, 12.7], gap: [2.5, 0],
  },
  {
    id: 'a4-1x8', en: 'A4 · 8 labels (99.1 × 67.7 mm)', ar: 'A4 · ٨ ملصقات (٩٩٫١ × ٦٧٫٧ مم)',
    page: [210, 297], cols: 2, rows: 4, label: [99.1, 67.7], margin: [4.65, 13.1], gap: [2.5, 0],
  },
  {
    id: 'a4-4x10', en: 'A4 · 40 small labels (45.7 × 25.4 mm)', ar: 'A4 · ٤٠ ملصقًا صغيرًا (٤٥٫٧ × ٢٥٫٤ مم)',
    page: [210, 297], cols: 4, rows: 10, label: [45.7, 25.4], margin: [9.8, 21.5], gap: [2.5, 0],
  },
  {
    id: 'letter-3x10', en: 'US Letter · 30 labels (66.7 × 25.4 mm)', ar: 'Letter · ٣٠ ملصقًا (٦٦٫٧ × ٢٥٫٤ مم)',
    page: [215.9, 279.4], cols: 3, rows: 10, label: [66.7, 25.4], margin: [4.8, 12.7], gap: [3.2, 0],
  },
]

export interface LabelOptions {
  stock: Stock
  /** 1-based position of the first label to print on — the rest of a used sheet. */
  startAt: number
  fontSize: number
  align: 'start' | 'center'
  /** Repeat one label to fill the sheet, rather than printing a list. */
  repeat: boolean
  outline: boolean
}

export function perSheet(stock: Stock): number {
  return stock.cols * stock.rows
}

/** Top-left of label `i` (0-based), in PDF points from the page's bottom-left. */
export function labelRect(stock: Stock, i: number) {
  const col = i % stock.cols
  const row = Math.floor(i / stock.cols)
  const x = (stock.margin[0] + col * (stock.label[0] + stock.gap[0])) * MM
  const yTop = (stock.margin[1] + row * (stock.label[1] + stock.gap[1])) * MM
  const pageH = stock.page[1] * MM
  return {
    x,
    y: pageH - yTop - stock.label[1] * MM,
    w: stock.label[0] * MM,
    h: stock.label[1] * MM,
  }
}

export async function buildLabels(entries: string[], o: LabelOptions): Promise<Blob> {
  const { PDFDocument, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const per = perSheet(o.stock)
  const start = Math.max(1, Math.min(per, o.startAt)) - 1

  const items = o.repeat && entries.length
    ? Array.from({ length: per - start }, () => entries[0])
    : entries

  const totalSlots = start + items.length
  const sheets = Math.max(1, Math.ceil(totalSlots / per))

  for (let sheet = 0; sheet < sheets; sheet++) {
    const page = doc.addPage([o.stock.page[0] * MM, o.stock.page[1] * MM])
    for (let i = 0; i < per; i++) {
      const slot = sheet * per + i
      if (slot < start) continue                 // leave the used part of the sheet alone
      const item = items[slot - start]
      const rect = labelRect(o.stock, i)

      if (o.outline) {
        page.drawRectangle({
          x: rect.x, y: rect.y, width: rect.w, height: rect.h,
          borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.4,
        })
      }
      if (item === undefined) continue

      // Rendered through the canvas so Arabic shapes and reorders correctly.
      const padPx = 10
      const img = renderTextImage({
        text: item,
        font: fontFor(item, 500, o.fontSize * 4),
        colour: '#111111',
        maxWidth: (rect.w / MM) * 4 * (MM / 1) , // 4× the label width in points
        align: o.align,
        padding: padPx,
      })
      const png = await doc.embedPng(await toPngBytes(img.canvas))
      // Fit inside the label, never overflowing it.
      const scale = Math.min(rect.w / img.width, rect.h / img.height)
      const w = img.width * scale
      const h = img.height * scale
      page.drawImage(png, {
        x: rect.x + (o.align === 'center' ? (rect.w - w) / 2 : 0),
        y: rect.y + (rect.h - h) / 2,
        width: w,
        height: h,
      })
    }
  }

  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}
