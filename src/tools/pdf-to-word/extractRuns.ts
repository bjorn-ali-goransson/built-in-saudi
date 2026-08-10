// pdf.js → positioned, sized, bold-flagged runs.
//
// `pdf-to-text/extract.ts` deliberately throws away everything but the
// characters, which is right for its job and useless for this one: without the
// size there is no heading and without the font there is no bold, so the Word
// document would be one long undifferentiated paragraph.
//
// It is a SEPARATE function rather than a second return value on the existing
// one, because the two answer different questions and the encryption handling
// is the only part worth sharing — which it does, by matching its contract
// exactly.

import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Run } from './pdfBlocks'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Same reasoning as the other pdf.js callers: hand it the whole buffer, because
// its streaming paths need `for await (… of ReadableStream)`, which some
// iOS/in-app WebViews do not have.
const PDF_OPTS = { disableStream: true, disableAutoFetch: true } as const

export interface ExtractedRuns {
  pages: Run[][]
  looksScanned: boolean
  encrypted: boolean
  wrongPassword?: boolean
}

interface Item {
  str: string
  transform: number[]
  fontName?: string
  height?: number
}

/**
 * Whether a font is bold.
 *
 * The `fontName` on a text item is an internal handle like `g_d0_f1`, not a
 * name — the real one lives in the page's `commonObjs`, and reading it is the
 * only way to know. Falling back to the handle would report every font as not
 * bold, which is the silent-wrong answer: the document converts, and every
 * bold heading in it is plain.
 */
function isBold(page: { commonObjs: { has(k: string): boolean; get(k: string): unknown } }, fontName?: string): boolean {
  if (!fontName) return false
  try {
    if (!page.commonObjs.has(fontName)) return false
    const font = page.commonObjs.get(fontName) as { name?: string; fallbackName?: string } | null
    const name = `${font?.name ?? ''} ${font?.fallbackName ?? ''}`.toLowerCase()
    // `semibold`, `black` and `heavy` are bold to a reader, and `700`+ is how
    // a subset font usually says so when the name carries no word at all.
    return /bold|black|heavy|semib|[7-9]00/.test(name)
  } catch {
    return false
  }
}

export async function extractRuns(file: File, password?: string): Promise<ExtractedRuns> {
  const data = await file.arrayBuffer()
  let doc
  try {
    doc = await pdfjs.getDocument({ data, ...PDF_OPTS, ...(password ? { password } : {}) }).promise
  } catch (e) {
    const err = e as { name?: string; code?: number }
    if (err?.name === 'PasswordException') {
      return { pages: [], looksScanned: false, encrypted: true, wrongPassword: err.code === 2 }
    }
    throw e
  }

  const pages: Run[][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    // **`getOperatorList()` before `getTextContent()`, and this line is the
    // whole reason bold works.** Text extraction does not load fonts, so
    // `commonObjs` is EMPTY during it and every `commonObjs.get` misses — which
    // reads as "no font is bold" rather than as a failure, so the document
    // converts and every bold heading in it comes out plain. Building the
    // operator list is what loads the faces; only then does the font object
    // exist to be asked. It costs a second parse of the page's content stream,
    // entirely on this device, which is the right price for not silently
    // losing half the structure.
    //
    // The obvious diagnosis was WRONG and cost a detour worth recording: pdf.js
    // logs "Ensure that the standardFontDataUrl API parameter is provided",
    // which is true, and irrelevant. Serving pdf.js's 800KB of substitute fonts
    // from our own origin changed nothing; this one call fixed it with the
    // fonts absent. A warning that is true is not therefore the cause.
    await page.getOperatorList()
    const content = await page.getTextContent()
    const runs: Run[] = []
    for (const raw of content.items as Item[]) {
      if (!raw.str) continue
      const [a, , , d, x, y] = raw.transform
      // The vertical scale of the text matrix is the rendered size. `height` is
      // present but is 0 for some producers, so it is a fallback and not the
      // source — a size of 0 makes every line a heading or none.
      const size = Math.abs(d) || Math.abs(a) || raw.height || 12
      runs.push({ text: raw.str, size, bold: isBold(page, raw.fontName), x, y })
    }
    pages.push(runs)
  }

  const chars = pages.reduce((n, p) => n + p.reduce((m, r) => m + r.text.replace(/\s/g, '').length, 0), 0)
  return {
    pages,
    looksScanned: pages.length > 0 && chars / pages.length < 10,
    encrypted: false,
  }
}
