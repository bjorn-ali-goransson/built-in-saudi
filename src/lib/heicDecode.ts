// HEIC/HEIF decoding (#226).
//
// No browser engine outside Safari can decode HEIC, so every iPhone photo picked on
// Android used to be a dead end. libheif compiled to wasm fills the gap — but it's
// several megabytes, so it is **dynamically imported and only ever fetched when a
// HEIC is actually picked**. Nobody converting a PNG pays for it.
//
// This module is context-agnostic: it uses ImageData + createImageBitmap and no DOM,
// so it runs unchanged on the main thread or inside a worker.

/** Is this a HEIC/HEIF file? Read the ISO-BMFF brand from the bytes rather than
 *  trusting the MIME type, which Android frequently doesn't set. */
export function isHeicBuffer(head: Uint8Array): boolean {
  if (head.length < 12) return false
  if (String.fromCharCode(...head.slice(4, 8)) !== 'ftyp') return false
  const brand = String.fromCharCode(...head.slice(8, 12))
  return ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand)
}

interface HeifImage {
  get_width(): number
  get_height(): number
  display(data: ImageData, cb: (out: ImageData | null) => void): void
}
interface HeifDecoderCtor { new (): { decode(buf: Uint8Array): HeifImage[] } }

let libPromise: Promise<HeifDecoderCtor> | null = null
/** Fetch the wasm bundle once, on first actual use. */
function loadLib(): Promise<HeifDecoderCtor> {
  libPromise ??= import('libheif-js/wasm-bundle')
    .then((m) => ((m as unknown as { default?: { HeifDecoder: HeifDecoderCtor } }).default ?? (m as unknown as { HeifDecoder: HeifDecoderCtor })).HeifDecoder)
  return libPromise
}

/** Decode a HEIC file to an ImageBitmap. Throws if it isn't decodable. */
export async function decodeHeic(file: File | Blob): Promise<ImageBitmap> {
  const HeifDecoder = await loadLib()
  const buf = new Uint8Array(await file.arrayBuffer())
  const images = new HeifDecoder().decode(buf)
  if (!images || !images.length) throw new Error('no images in HEIC container')
  // A HEIC can hold a burst or a live-photo sequence; the first image is the one
  // the user thinks of as "the photo".
  const img = images[0]
  const w = img.get_width(), h = img.get_height()
  if (!w || !h) throw new Error('HEIC image has no dimensions')
  const data = new ImageData(w, h)
  await new Promise<void>((resolve, reject) => {
    img.display(data, (out) => (out ? resolve() : reject(new Error('HEIC display failed'))))
  })
  return createImageBitmap(data)
}
