// Warping and cleaning a page off the main thread (#154).
//
// Every output pixel is sampled from the source through the inverse transform,
// so the work is width × height multiply-adds — a couple of million for a page,
// which is exactly the sort of thing that freezes a phone if it runs where the
// scroll does.

import { apply, homography, outputSize, type Point } from '../../lib/homography'

export interface ScanReq {
  id: number
  bitmap: ImageBitmap
  /** The four corners of the page IN THE SOURCE IMAGE, clockwise from top-left. */
  corners: Point[]
  /** 0 = leave the colours alone, 1 = full clean-up. */
  clean: number
}

export interface ScanRes {
  id: number
  blob?: Blob
  width?: number
  height?: number
  error?: string
}

self.onmessage = async (e: MessageEvent<ScanReq>) => {
  const { id, bitmap, corners, clean } = e.data
  try {
    const { w, h } = outputSize(corners)
    // DESTINATION to SOURCE: sampling walks the output and asks where each
    // pixel came from. The forward direction leaves holes wherever the
    // transform stretches.
    const inv = homography([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], corners)
    if (!inv) { ;(self as unknown as Worker).postMessage({ id, error: 'degenerate' } as ScanRes); return }

    const src = new OffscreenCanvas(bitmap.width, bitmap.height)
    const sctx = src.getContext('2d')!
    sctx.drawImage(bitmap, 0, 0)
    const sdata = sctx.getImageData(0, 0, bitmap.width, bitmap.height).data

    const out = new OffscreenCanvas(w, h)
    const octx = out.getContext('2d')!
    const odata = octx.createImageData(w, h)
    const px = odata.data

    let sum = 0
    let count = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = apply(inv, { x: x + 0.5, y: y + 0.5 })
        const sx = Math.round(p.x)
        const sy = Math.round(p.y)
        const o = (y * w + x) * 4
        if (sx < 0 || sy < 0 || sx >= bitmap.width || sy >= bitmap.height) {
          px[o] = px[o + 1] = px[o + 2] = 255
          px[o + 3] = 255
          continue
        }
        const s = (sy * bitmap.width + sx) * 4
        px[o] = sdata[s]
        px[o + 1] = sdata[s + 1]
        px[o + 2] = sdata[s + 2]
        px[o + 3] = 255
        // Luma, for the normalisation pass below.
        sum += 0.299 * sdata[s] + 0.587 * sdata[s + 1] + 0.114 * sdata[s + 2]
        count++
      }
    }

    if (clean > 0 && count) {
      // What makes a photo look like a scan is not resolution — it is that the
      // paper becomes white and the ink becomes black. A photograph of a page
      // under room light has its paper somewhere around 60% grey with a
      // gradient across it, which is why it looks like a photograph and why it
      // is several times larger than it needs to be.
      //
      // The mean luma stands in for "the paper", and everything above it is
      // pushed towards white and below it towards black, by `clean`.
      const mean = sum / count
      const lo = mean * 0.72
      const hi = mean * 1.06
      for (let i = 0; i < px.length; i += 4) {
        const luma = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
        const t = Math.max(0, Math.min(1, (luma - lo) / Math.max(1, hi - lo)))
        const v = Math.round(t * 255)
        px[i] = px[i] + (v - px[i]) * clean
        px[i + 1] = px[i + 1] + (v - px[i + 1]) * clean
        px[i + 2] = px[i + 2] + (v - px[i + 2]) * clean
      }
    }

    octx.putImageData(odata, 0, 0)
    // JPEG: a cleaned page is mostly flat white, which is exactly what a
    // photographic codec compresses best, and it is the size claim the tool
    // makes.
    const blob = await out.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
    ;(self as unknown as Worker).postMessage({ id, blob, width: w, height: h } as ScanRes)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) } as ScanRes)
  }
}
