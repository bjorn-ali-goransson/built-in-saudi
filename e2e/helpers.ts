import { inflateRawSync } from 'node:zlib'
import type { Page } from '@playwright/test'

/**
 * The origins allowed to receive a request BODY.
 *
 * Several specs assert that nothing on this site POSTs anywhere — the honest
 * form of "your file never leaves the page", since a body we cannot read is
 * still a body. Analytics is the one exception: counting page views is a
 * different claim from uploading your file, and it is allowlisted by ORIGIN and
 * separately asserted never to carry the user's own content.
 *
 * It lives here because it was a private constant in `privacy.spec.ts` when a
 * second analytics provider was added, and `password-breach.spec.ts` makes the
 * same assertion and was NOT updated — so the deploy failed on a spec nobody
 * associated with analytics. One definition; add a beacon host here and every
 * body assertion on the site learns about it at once.
 */
export const ANALYTICS =
  /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|analytics\.ali-web-services\.com/

/**
 * Read a number out of the UI, in either language.
 *
 * **`ar-SA` formats with Arabic-Indic digits** (`٧٩` rather than `79`), so the
 * obvious helper — strip everything that is not `[\d.]` — leaves an empty
 * string on every Arabic page and `Number('')` is **0**. An assertion like
 * `expect(await num(page, 'total')).toBeCloseTo(0)` then passes for the wrong
 * reason, and one that expects a real figure fails with a baffling "received
 * 0". Four specs had a private copy of that helper; this is the one that knows.
 */
export async function readNumber(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).innerText()
  const latin = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    // Converting the digits is not enough, and this cost a red test to learn:
    // ar-SA also uses its OWN separators — ٫ (U+066B) for the decimal point and
    // ٬ (U+066C) for thousands. Strip them as punctuation and ١٬٥٩٨٫٥ becomes
    // 15985, a number a hundred times too big that still looks like a number.
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
  return Number(latin.replace(/[^\d.-]/g, ''))
}

/**
 * The text of one part of a ZIP-based document (.docx, .xlsx, .epub), read off
 * the RAW BYTES of the archive.
 *
 * The specs used to grep the whole file as latin1, which worked only because
 * `lib/zip.ts` stored every entry uncompressed. Now that it deflates — measured
 * at 97.9% on OOXML — that grep finds nothing, and several specs broke. They
 * were right to break.
 *
 * The DISCIPLINE is preserved rather than abandoned: the point of grepping the
 * archive was never that it was uncompressed, it was that the XML is read
 * WITHOUT going through our own reader, since two hand-written implementations
 * agreeing is weaker evidence than one being right. Node's `inflateRawSync` is
 * somebody else's implementation, so it keeps that property.
 */
export function zipPart(buf: Buffer, name: string): string {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let i = 0
  while (i + 30 <= buf.length && dv.getUint32(i, true) === 0x04034b50) {
    const method = dv.getUint16(i + 8, true)
    const packed = dv.getUint32(i + 18, true)
    const nlen = dv.getUint16(i + 26, true)
    const elen = dv.getUint16(i + 28, true)
    const entry = new TextDecoder('utf-8').decode(buf.subarray(i + 30, i + 30 + nlen))
    const start = i + 30 + nlen + elen
    if (entry === name) {
      const data = buf.subarray(start, start + packed)
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8')
    }
    i = start + packed
  }
  throw new Error(`zipPart: ${name} not found in archive`)
}

/** Every part name in a ZIP, in file order. */
export function zipNames(buf: Buffer): string[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const out: string[] = []
  let i = 0
  while (i + 30 <= buf.length && dv.getUint32(i, true) === 0x04034b50) {
    const packed = dv.getUint32(i + 18, true)
    const nlen = dv.getUint16(i + 26, true)
    const elen = dv.getUint16(i + 28, true)
    out.push(new TextDecoder('utf-8').decode(buf.subarray(i + 30, i + 30 + nlen)))
    i += 30 + nlen + elen + packed
  }
  return out
}
