import { inflateRawSync, deflateSync } from 'node:zlib'
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

/** Every entry of a ZIP, decompressed (read from the local headers, as zipPart does). */
export function zipEntries(buf: Buffer): { name: string; data: Buffer }[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const out: { name: string; data: Buffer }[] = []
  let i = 0
  while (i + 30 <= buf.length && dv.getUint32(i, true) === 0x04034b50) {
    const method = dv.getUint16(i + 8, true)
    const packed = dv.getUint32(i + 18, true)
    const nlen = dv.getUint16(i + 26, true)
    const elen = dv.getUint16(i + 28, true)
    const name = new TextDecoder('utf-8').decode(buf.subarray(i + 30, i + 30 + nlen))
    const start = i + 30 + nlen + elen
    const data = buf.subarray(start, start + packed)
    out.push({ name, data: Buffer.from(method === 8 ? inflateRawSync(data) : data) })
    i = start + packed
  }
  return out
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
function crc32(b: Buffer): number { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

/** A store-only ZIP of these entries — enough to hand an editor a doctored real file. */
export function makeZip(entries: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let off = 0
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8')
    const crc = crc32(e.data)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8)
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(e.data.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(name.length, 26)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8)
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(e.data.length, 20); ch.writeUInt32LE(e.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42)
    locals.push(lh, name, e.data)
    centrals.push(ch, name)
    off += 30 + name.length + e.data.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16)
  return Buffer.concat([...locals, cd, end])
}

/** A real file with one part swapped for other bytes. */
export function replaceInZip(buf: Buffer, name: string, data: Buffer): Buffer {
  const all = zipEntries(buf)
  if (!all.some((e) => e.name === name)) throw new Error(`replaceInZip: ${name} not in archive`)
  return makeZip(all.map((e) => (e.name === name ? { name, data } : e)))
}

/**
 * A photograph-like PNG: smooth gradients with noise on top. Noise is what makes
 * a camera picture big — the deflater cannot predict it — so this is the hard
 * case for a size limit, at several megabytes for a modest size.
 */
export function noisyPng(w: number, h: number, seed = 1): Buffer {
  let s = seed
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < w; x++) {
      const i = row + 1 + x * 3
      raw[i] = Math.min(255, (x / w) * 200 + rnd() * 55)
      raw[i + 1] = Math.min(255, (y / h) * 200 + rnd() * 55)
      raw[i + 2] = Math.min(255, 120 + rnd() * 80)
    }
  }
  const chunk = (t: string, d: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))])
}
