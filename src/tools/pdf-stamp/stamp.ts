import { renderTextImage, toPngBytes, fontFor } from '../../lib/textImage'

// Page numbers, headers, footers and watermarks — added WITHOUT rasterising the
// document. Unlike redaction, where destroying the text is the point, here the
// original must stay selectable and searchable, so the stamp is drawn on top of
// the existing page content rather than over a flattened image of it.

export type Corner =
  | 'bottom-center' | 'bottom-right' | 'bottom-left'
  | 'top-center' | 'top-right' | 'top-left'

export type NumberFormat = 'n' | 'n-of-total' | 'page-n' | 'page-n-of-total' | 'arabic-indic'

export interface StampOptions {
  numbers: boolean
  numberFormat: NumberFormat
  position: Corner
  /** Page index (1-based) at which numbering begins; earlier pages are untouched. */
  startAt: number
  /** The number printed on the first numbered page — a title page often is not 1. */
  firstNumber: number
  headerText: string
  footerText: string
  watermarkText: string
  watermarkOpacity: number
  fontSize: number
  margin: number
}

export const DEFAULTS: StampOptions = {
  numbers: true, numberFormat: 'n', position: 'bottom-center',
  startAt: 1, firstNumber: 1,
  headerText: '', footerText: '', watermarkText: '',
  watermarkOpacity: 0.12, fontSize: 10, margin: 28,
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const toArabicIndic = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d])

export function formatNumber(n: number, total: number, fmt: NumberFormat, locale: 'en' | 'ar'): string {
  const of = locale === 'ar' ? 'من' : 'of'
  const page = locale === 'ar' ? 'صفحة' : 'Page'
  switch (fmt) {
    case 'n-of-total': return `${n} ${of} ${total}`
    case 'page-n': return `${page} ${n}`
    case 'page-n-of-total': return `${page} ${n} ${of} ${total}`
    case 'arabic-indic': return toArabicIndic(n)
    default: return String(n)
  }
}

/** Where a stamp of this size sits on a page of that size. */
function place(corner: Corner, pw: number, ph: number, w: number, h: number, margin: number) {
  const top = corner.startsWith('top')
  const y = top ? ph - margin - h : margin
  const x = corner.endsWith('center') ? (pw - w) / 2
    : corner.endsWith('right') ? pw - margin - w
      : margin
  return { x, y }
}

export async function stamp(file: File, o: StampOptions, locale: 'en' | 'ar'): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.load(await file.arrayBuffer())
  const pages = doc.getPages()
  const total = pages.length

  // The watermark is one image reused on every page — embedding it per page
  // would multiply the file size by the page count for no benefit.
  let watermark: { png: Awaited<ReturnType<typeof doc.embedPng>>; w: number; h: number } | null = null
  if (o.watermarkText.trim()) {
    const first = pages[0]
    const size = Math.max(48, Math.min(first.getWidth(), first.getHeight()) / 6)
    const img = renderTextImage({
      text: o.watermarkText,
      font: fontFor(o.watermarkText, 700, size),
      colour: '#000000',
      maxWidth: Math.max(first.getWidth(), first.getHeight()) * 1.1,
      align: 'center',
      rotate: -35,
      opacity: o.watermarkOpacity,
    })
    watermark = { png: await doc.embedPng(await toPngBytes(img.canvas)), w: img.width, h: img.height }
  }

  for (let i = 0; i < total; i++) {
    const page = pages[i]
    const pw = page.getWidth()
    const ph = page.getHeight()

    if (watermark) {
      // Fit the diagonal image inside the page and centre it.
      const scale = Math.min(pw / watermark.w, ph / watermark.h) * 0.95
      page.drawImage(watermark.png, {
        x: (pw - watermark.w * scale) / 2,
        y: (ph - watermark.h * scale) / 2,
        width: watermark.w * scale,
        height: watermark.h * scale,
      })
    }

    const stamps: { text: string; corner: Corner }[] = []
    if (o.numbers && i + 1 >= o.startAt) {
      const shown = o.firstNumber + (i + 1 - o.startAt)
      const numbered = total - o.startAt + 1
      stamps.push({
        text: formatNumber(shown, numbered + o.firstNumber - 1, o.numberFormat, locale),
        corner: o.position,
      })
    }
    if (o.headerText.trim()) stamps.push({ text: o.headerText, corner: 'top-center' })
    if (o.footerText.trim() && o.position !== 'bottom-center') {
      stamps.push({ text: o.footerText, corner: 'bottom-center' })
    } else if (o.footerText.trim()) {
      stamps.push({ text: o.footerText, corner: 'bottom-left' })
    }

    for (const st of stamps) {
      const img = renderTextImage({
        text: st.text,
        font: fontFor(st.text, 500, o.fontSize * 4), // 4× then scaled down, so it stays crisp
        colour: '#333333',
        maxWidth: pw * 4,
        align: 'center',
      })
      const png = await doc.embedPng(await toPngBytes(img.canvas))
      const h = o.fontSize * 1.4
      const w = (img.width / img.height) * h
      const { x, y } = place(st.corner, pw, ph, w, h, o.margin)
      page.drawImage(png, { x, y, width: w, height: h })
    }
  }

  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}
