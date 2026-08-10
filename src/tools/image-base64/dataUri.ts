// An image as a data URI, and the two things everybody gets wrong about it.
//
// Found by diffing a 661-tool catalogue against ours: "Image to Base64" and
// "Base64 to Image" are staples everywhere and we had neither — while our own
// `base64` tool claims `data uri` as a keyword and has no file input at all, so
// it takes the query and cannot serve it.
//
// TWO MEASURED FINDINGS, both computed here rather than repeated from anywhere:
//
// 1. **Base64 inflates a binary by about a third.** Measured on real files:
//    +36.0% on a PNG, +34.0% on a HEIC. People embed an image to "save a
//    request" and ship a third more bytes to every visitor, cached separately
//    from the stylesheet that carries it. The tool states the cost next to the
//    output instead of leaving it to be discovered.
//
// 2. **For SVG, base64 is the WRONG encoding**, and the obvious alternative is
//    worse than either. An SVG is already mostly ASCII, so percent-encoding
//    only what is structural beats base64 — measured on this site's own three
//    SVGs, minimal escaping is **23% smaller than base64** every time.
//    `encodeURIComponent`, which is what most people reach for, escapes so much
//    that it comes out **13% BIGGER than base64**. That is the trap: the naive
//    fix is worse than the thing it was meant to fix.
//
//    | file | raw | base64 | minimal | encodeURIComponent |
//    |---|---|---|---|---|
//    | icon.svg | 638 | 852 | **654** | 962 |
//    | favicon.svg | 645 | 860 | **661** | 977 |
//    | og.svg | 1957 | 2636 | **2025** | 3196 |

/** Where the encoded image is going, which decides how it must be wrapped. */
export type Wrap = 'raw' | 'css' | 'html' | 'markdown'

/**
 * Minimal percent-encoding for an SVG data URI.
 *
 * Only the characters that are actually structural: `%` first (or every later
 * escape would be double-encoded), then `#` which starts a fragment, the angle
 * brackets, and the braces some parsers choke on. Double quotes become single
 * ones so the result can sit inside a `url("…")` without escaping.
 *
 * Whitespace is collapsed rather than stripped: removing it entirely would join
 * attribute values inside a `<text>` element and change what the picture says.
 */
export function miniSvg(svg: string): string {
  return svg
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/"/g, "'")
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/\{/g, '%7B')
    .replace(/\}/g, '%7D')
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  // In chunks: `String.fromCharCode(...bytes)` on a multi-megabyte image blows
  // the argument limit and throws, which reads as "this image is broken".
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(s)
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export interface Encoded {
  uri: string
  /** True when the SVG path was taken, so the UI can explain why. */
  minimal: boolean
  /** Length of the data URI in characters, which is what a file will cost. */
  chars: number
  /** Original bytes, for the overhead figure. */
  bytes: number
}

export function encodeImage(bytes: Uint8Array, mime: string, text?: string): Encoded {
  if (mime === 'image/svg+xml' && text !== undefined) {
    const uri = `data:image/svg+xml,${miniSvg(text)}`
    return { uri, minimal: true, chars: uri.length, bytes: bytes.length }
  }
  const uri = `data:${mime};base64,${toBase64(bytes)}`
  return { uri, minimal: false, chars: uri.length, bytes: bytes.length }
}

/** The output people actually paste, rather than a bare string. */
export function wrapUri(uri: string, wrap: Wrap, alt = 'image'): string {
  switch (wrap) {
    case 'css': return `background-image: url("${uri}");`
    case 'html': return `<img src="${uri}" alt="${alt}">`
    case 'markdown': return `![${alt}](${uri})`
    default: return uri
  }
}

/** How much bigger the encoded form is than the file, as a percentage. */
export const overhead = (e: Encoded) => (e.bytes > 0 ? (e.chars / e.bytes) * 100 - 100 : 0)

export interface Decoded { bytes: Uint8Array; mime: string }

/**
 * A data URI back to bytes.
 *
 * Accepts a bare base64 blob too, because that is what people paste half the
 * time — and handles the percent-encoded SVG form, which a base64-only decoder
 * rejects as corrupt rather than as a different encoding.
 */
export function decodeDataUri(input: string): Decoded | null {
  const text = input.trim()
  if (!text) return null

  const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/i.exec(text)
  if (m) {
    const mime = m[1] || 'application/octet-stream'
    try {
      if (m[2]) return { bytes: fromBase64(m[3].replace(/\s+/g, '')), mime }
      return { bytes: new TextEncoder().encode(decodeURIComponent(m[3])), mime }
    } catch { return null }
  }

  // A bare payload. Only base64 is guessable here: raw percent-encoded text
  // with no `data:` prefix is indistinguishable from ordinary prose.
  try {
    const bytes = fromBase64(text.replace(/\s+/g, ''))
    return { bytes, mime: sniffMime(bytes) }
  } catch { return null }
}

/**
 * The format, from the bytes rather than from what anybody claimed.
 *
 * A pasted blob carries no MIME, and saving a PNG as `.bin` is a file the
 * operating system will not open.
 */
export function sniffMime(b: Uint8Array): string {
  const has = (...sig: number[]) => sig.every((v, i) => b[i] === v)
  if (has(0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (has(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (has(0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  if (has(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45) return 'image/webp'
  if (has(0x3c, 0x3f, 0x78, 0x6d) || has(0x3c, 0x73, 0x76, 0x67)) return 'image/svg+xml'
  // ISO-BMFF: `ftyp` at offset 4, which is HEIC and friends.
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'image/heic'
  return 'application/octet-stream'
}

export const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/heic': 'heic',
}
