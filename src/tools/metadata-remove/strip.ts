// Strips metadata WITHOUT re-encoding, so a photo loses its GPS trail and its
// camera serial but not a single pixel of quality. Re-drawing through a canvas
// would be five lines instead of this, but it re-compresses a JPEG — the user
// asked to remove data, not to degrade the image.
//
// Anything we can't parse structurally falls back to a canvas re-encode, which
// is flagged in the UI so the trade-off is the user's to see.

export type StripResult = {
  blob: Blob
  /** Metadata segments actually found and dropped, for showing what was in there. */
  removed: string[]
  /** True when we had to re-encode (lossy) rather than strip structurally. */
  reencoded: boolean
}

const JPEG_APP: Record<number, string> = {
  0xe1: 'EXIF / XMP', 0xe2: 'ICC colour profile', 0xe3: 'Camera data', 0xe4: 'Camera data',
  0xe5: 'Camera data', 0xe6: 'Camera data', 0xe7: 'Camera data', 0xe8: 'Camera data',
  0xe9: 'Camera data', 0xea: 'Camera data', 0xeb: 'Camera data', 0xec: 'Picture info',
  0xed: 'IPTC / Photoshop', 0xee: 'Adobe data', 0xef: 'Camera data', 0xfe: 'Comment',
}

/** Walk JPEG segments and copy everything except APPn (bar APP0/JFIF) and COM. */
function stripJpeg(buf: Uint8Array): StripResult | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
  const keep: Uint8Array[] = [buf.subarray(0, 2)]
  const removed = new Set<string>()
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null // not a marker where one must be — bail out
    const marker = buf[i + 1]
    // Start of scan: the rest is entropy-coded image data, copy it verbatim.
    if (marker === 0xda) { keep.push(buf.subarray(i)); break }
    if (marker === 0xd9) { keep.push(buf.subarray(i, i + 2)); break }
    const len = (buf[i + 2] << 8) | buf[i + 3]
    if (!len || i + 2 + len > buf.length) return null
    const isApp = marker >= 0xe0 && marker <= 0xef
    // APP0/JFIF carries density, not identity — dropping it can change how the
    // image is displayed, so it stays.
    const drop = (isApp && marker !== 0xe0) || marker === 0xfe
    if (drop) removed.add(JPEG_APP[marker] || `APP${marker - 0xe0}`)
    else keep.push(buf.subarray(i, i + 2 + len))
    i += 2 + len
  }
  return { blob: new Blob(keep as BlobPart[], { type: 'image/jpeg' }), removed: [...removed], reencoded: false }
}

const PNG_META: Record<string, string> = {
  tEXt: 'Text comment', zTXt: 'Compressed text', iTXt: 'XMP / text', eXIf: 'EXIF',
  tIME: 'Last-modified time', pHYs: '', iCCP: 'ICC colour profile', dSIG: 'Digital signature',
}

/** Copy PNG chunks, dropping the ancillary ones that carry metadata. */
function stripPng(buf: Uint8Array): StripResult | null {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (SIG.some((b, n) => buf[n] !== b)) return null
  const keep: Uint8Array[] = [buf.subarray(0, 8)]
  const removed = new Set<string>()
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let i = 8
  while (i + 8 <= buf.length) {
    const len = dv.getUint32(i)
    const type = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7])
    const end = i + 12 + len
    if (end > buf.length) return null
    const label = PNG_META[type]
    // Only drop chunks we know are metadata — an unknown ancillary chunk might
    // be doing something we don't understand, and pixels must survive intact.
    if (label !== undefined && label !== '') { removed.add(label) } else { keep.push(buf.subarray(i, end)) }
    i = end
    if (type === 'IEND') break
  }
  return { blob: new Blob(keep as BlobPart[], { type: 'image/png' }), removed: [...removed], reencoded: false }
}

/** Last resort: repaint through a canvas. Drops everything, costs quality. */
async function reencode(file: File, bmp: ImageBitmap): Promise<StripResult> {
  const c = document.createElement('canvas')
  c.width = bmp.width; c.height = bmp.height
  const ctx = c.getContext('2d')
  if (ctx) ctx.drawImage(bmp, 0, 0)
  const type = file.type === 'image/webp' ? 'image/webp' : 'image/png'
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b || new Blob()), type, 0.95))
  return { blob, removed: ['All metadata'], reencoded: true }
}

export async function stripMetadata(file: File, bmp: ImageBitmap): Promise<StripResult> {
  const buf = new Uint8Array(await file.arrayBuffer())
  return stripJpeg(buf) || stripPng(buf) || (await reencode(file, bmp))
}
