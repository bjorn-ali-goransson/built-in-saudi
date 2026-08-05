import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Same reasoning as cv-generator/extract.ts: we always hand pdf.js the whole
// buffer, and its streaming paths lean on `for await (… of ReadableStream)`,
// which some iOS/in-app WebViews don't support.
const PDF_OPTS = { disableStream: true, disableAutoFetch: true } as const

export interface Page { n: number; text: string }
export interface Extracted {
  pages: Page[]
  /** True when the PDF has pages but almost no extractable text — i.e. a scan. */
  looksScanned: boolean
  encrypted: boolean
}

interface Item { str: string; transform: number[]; hasEOL?: boolean }

/**
 * Rebuild lines from positioned glyph runs. A PDF has no concept of a line — it
 * has text placed at coordinates — so the y position is the only reliable
 * separator, and items on the same y need a space only when they are actually
 * apart (otherwise "Sha" + "rjah" becomes "Sha rjah").
 */
function itemsToText(items: Item[]): string {
  const out: string[] = []
  let line = ''
  let lastY: number | null = null
  let lastEndX: number | null = null
  for (const item of items) {
    if (!item.str) continue
    const [, , , , x, y] = item.transform
    const width = item.str.length // approximate; only used for gap detection
    if (lastY !== null && Math.abs(y - lastY) > 3) {
      out.push(line.trimEnd())
      line = ''
      lastEndX = null
    }
    if (line !== '' && lastEndX !== null && x - lastEndX > 1 && !line.endsWith(' ') && !item.str.startsWith(' ')) {
      line += ' '
    }
    line += item.str
    lastY = y
    lastEndX = x + width
  }
  if (line.trim()) out.push(line.trimEnd())
  return out.join('\n')
}

export async function extractPdf(file: File): Promise<Extracted> {
  const data = await file.arrayBuffer()
  let doc
  try {
    doc = await pdfjs.getDocument({ data, ...PDF_OPTS }).promise
  } catch (e) {
    const name = (e as { name?: string })?.name
    if (name === 'PasswordException') return { pages: [], looksScanned: false, encrypted: true }
    throw e
  }
  const pages: Page[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push({ n: i, text: itemsToText(content.items as Item[]) })
  }
  const chars = pages.reduce((n, p) => n + p.text.replace(/\s/g, '').length, 0)
  // A born-digital page carries hundreds of characters; a scan carries none.
  // Below ~10 per page, telling the user to use OCR is more useful than handing
  // them an empty box.
  return { pages, looksScanned: pages.length > 0 && chars / pages.length < 10, encrypted: false }
}

export function joinPages(pages: Page[], separators: boolean, locale: 'en' | 'ar'): string {
  if (!separators) return pages.map((p) => p.text).join('\n\n')
  const label = locale === 'ar' ? 'صفحة' : 'Page'
  return pages.map((p) => `--- ${label} ${p.n} ---\n${p.text}`).join('\n\n')
}
