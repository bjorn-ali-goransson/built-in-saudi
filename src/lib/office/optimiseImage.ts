// Pictures, made modern and small: every raster picture an editor takes in is
// re-encoded as WebP and kept at or under MAX_IMAGE_BYTES.
//
// Why both: documents live in this browser's storage and travel peer-to-peer in
// a live session, and a deck that arrives with forty camera photos at 5MB each
// is 200MB in IndexedDB and in every guest's memory. A slide never needs that
// many pixels; nobody can see the difference between a 5MB and an 800KB photo
// at the size it is shown.
//
// The order of attempts is what keeps quality where it matters:
//  1. A lossless source (PNG, GIF, BMP — usually a diagram, a logo or a
//     screenshot) tries LOSSLESS WebP first, which is typically a quarter
//     smaller than the PNG with not a pixel changed.
//  2. Otherwise, and for photos, lossy WebP from quality 0.86 down to 0.6.
//  3. Only then are the pixels reduced, a quarter at a time, until it fits.
// A picture is never made LARGER: if WebP comes out bigger than the original and
// the original is already under the limit, the original stays.
//
// Left alone, on purpose: SVG (vector, and already a modern format), animated
// GIF (a canvas keeps one frame — the animation would be lost), and formats a
// browser cannot decode (EMF, WMF, TIFF), which the importers report on their own.
//
// Needs OffscreenCanvas; where there is none (Node, an old browser) it changes
// nothing, which is a correct if unoptimised result rather than a failure.

export const MAX_IMAGE_BYTES = 800 * 1024
/** Longest side, in pixels: more than any page or slide shows at any zoom. */
export const MAX_IMAGE_SIDE = 3200

export interface Optimised { bytes: Uint8Array; mime: string; changed: boolean }

const canRun = () => typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function'

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  if (b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && /^(avif|avis)$/.test(String.fromCharCode(b[8], b[9], b[10], b[11]))) return 'image/avif'
  return null
}

/** More than one image in a GIF: an animation, which a canvas would flatten to its first frame. */
function animatedGif(b: Uint8Array): boolean {
  let frames = 0
  for (let i = 0; i < b.length - 2 && frames < 2; i++) if (b[i] === 0x21 && b[i + 1] === 0xf9 && b[i + 2] === 0x04) frames++
  return frames > 1
}

export async function optimiseImage(bytes: Uint8Array, mimeHint = ''): Promise<Optimised> {
  const same: Optimised = { bytes, mime: mimeHint, changed: false }
  const mime = sniff(bytes)
  if (!mime || !canRun()) return same
  // Already modern and already small: nothing to gain.
  if ((mime === 'image/webp' || mime === 'image/avif') && bytes.length <= MAX_IMAGE_BYTES) return { ...same, mime }
  if (mime === 'image/gif' && animatedGif(bytes)) return { ...same, mime }
  let bmp: ImageBitmap
  try { bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime })) } catch { return same }
  try {
    const lossless = mime === 'image/png' || mime === 'image/gif' || mime === 'image/bmp'
    let scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bmp.width, bmp.height))
    for (let round = 0; round < 8; round++) {
      const w = Math.max(1, Math.round(bmp.width * scale))
      const h = Math.max(1, Math.round(bmp.height * scale))
      const c = new OffscreenCanvas(w, h)
      const g = c.getContext('2d')!
      g.imageSmoothingQuality = 'high'
      g.drawImage(bmp, 0, 0, w, h)
      const qualities = lossless && round === 0 && scale === 1 ? [1, 0.9, 0.82, 0.72, 0.6] : [0.86, 0.78, 0.7, 0.6]
      for (const q of qualities) {
        const blob = await c.convertToBlob({ type: 'image/webp', quality: q })
        // A browser that cannot encode WebP hands back a PNG instead: stop rather than bloat.
        if (blob.type !== 'image/webp') return same
        if (blob.size > MAX_IMAGE_BYTES) continue
        const out = new Uint8Array(await blob.arrayBuffer())
        if (out.length >= bytes.length && bytes.length <= MAX_IMAGE_BYTES) return { ...same, mime }
        return { bytes: out, mime: 'image/webp', changed: true }
      }
      scale *= 0.75
    }
    return same
  } finally { bmp.close() }
}

// ---- data: URLs anywhere in a document ---------------------------------------------------

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,/i

function b64ToBytes(s: string): Uint8Array { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u }
function bytesToB64(u: Uint8Array): string { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }

export async function optimiseDataUrl(url: string): Promise<string> {
  const m = DATA_URL.exec(url)
  if (!m || m[1].toLowerCase() === 'image/svg+xml') return url
  const r = await optimiseImage(b64ToBytes(url.slice(m[0].length)), m[1])
  return r.changed ? `data:${r.mime};base64,${bytesToB64(r.bytes)}` : url
}

/**
 * Every picture in a document, wherever the model keeps it (an image node's src,
 * a slide's media table, a sheet's pictures), optimised in place. Pictures are
 * found by VALUE rather than by field name, so all three editors share it and a
 * new place to keep a picture cannot be missed.
 */
export async function optimiseImagesIn<T>(doc: T): Promise<{ doc: T; changed: number; before: number; after: number }> {
  let changed = 0
  let before = 0
  let after = 0
  const cache = new Map<string, string>()
  const walk = async (v: unknown): Promise<unknown> => {
    if (typeof v === 'string') {
      if (!DATA_URL.test(v)) return v
      let out = cache.get(v)
      if (out === undefined) { out = await optimiseDataUrl(v); cache.set(v, out) }
      before += v.length
      after += out.length
      if (out !== v) changed++
      return out
    }
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = await walk(v[i]); return v }
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) (v as Record<string, unknown>)[k] = await walk((v as Record<string, unknown>)[k]); return v }
    return v
  }
  await walk(doc)
  return { doc, changed, before: Math.round(before * 0.75), after: Math.round(after * 0.75) }
}

/**
 * For export to Word, Excel and PowerPoint files: WebP and AVIF become JPEG, or
 * PNG where the picture has transparency. Office 2016 and earlier show a red
 * cross for a WebP, and the file is for whoever opens it next, on whatever they
 * have — so inside the editor the picture is modern, and on the way out it is
 * the format every reader has.
 */
export async function classicImage(bytes: Uint8Array): Promise<{ bytes: Uint8Array; mime: string; ext: string } | null> {
  const mime = sniff(bytes)
  if (mime !== 'image/webp' && mime !== 'image/avif') return null
  if (!canRun()) return null
  try {
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }))
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(bmp, 0, 0)
    bmp.close()
    // Transparent anywhere? Sampled on a grid: a full scan of a large picture is slow and a
    // transparent region big enough to matter is never smaller than the grid.
    const d = g.getImageData(0, 0, c.width, c.height).data
    const step = Math.max(1, Math.floor((c.width * c.height) / 40000)) * 4
    let alpha = false
    for (let i = 3; i < d.length; i += step) if (d[i] < 250) { alpha = true; break }
    const blob = await c.convertToBlob(alpha ? { type: 'image/png' } : { type: 'image/jpeg', quality: 0.9 })
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: alpha ? 'image/png' : 'image/jpeg', ext: alpha ? 'png' : 'jpeg' }
  } catch { return null }
}
