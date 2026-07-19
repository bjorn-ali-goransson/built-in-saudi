// Shared image-encode worker (#154). Holds one decoded bitmap and does
// crop/scale/encode off the main thread — the compressor, format converter and
// cropper re-encode the full-size image on every slider/drag change, which
// visibly janked the UI when it ran on the main thread. Driven via ImageEncoder
// (imageEncoder.ts); one worker instance per tool instance.
export interface EncodeJob {
  crop?: { sx: number; sy: number; sw: number; sh: number }
  maxWidth?: number
  format: string
  quality?: number
  bg?: string // fill behind transparency (JPEG has no alpha)
}
export type EncodeRequest =
  | { id: number; op: 'load'; file: File }
  | { id: number; op: 'encode'; job: EncodeJob }
export type EncodeResponse =
  | { id: number; op: 'load'; width: number; height: number; error?: boolean }
  | { id: number; op: 'encode'; blob: Blob | null }

let bitmap: ImageBitmap | null = null

self.onmessage = async (e: MessageEvent<EncodeRequest>) => {
  const req = e.data
  if (req.op === 'load') {
    try {
      bitmap?.close()
      bitmap = await createImageBitmap(req.file)
      postMessage({ id: req.id, op: 'load', width: bitmap.width, height: bitmap.height } satisfies EncodeResponse)
    } catch {
      bitmap = null
      postMessage({ id: req.id, op: 'load', width: 0, height: 0, error: true } satisfies EncodeResponse)
    }
    return
  }
  if (!bitmap) { postMessage({ id: req.id, op: 'encode', blob: null } satisfies EncodeResponse); return }
  const { crop, maxWidth, format, quality, bg } = req.job
  const sx = crop?.sx ?? 0, sy = crop?.sy ?? 0
  const sw = crop?.sw ?? bitmap.width, sh = crop?.sh ?? bitmap.height
  let ow = sw, oh = sh
  if (maxWidth && ow > maxWidth) { oh = Math.max(1, Math.round(oh * (maxWidth / ow))); ow = maxWidth }
  const c = new OffscreenCanvas(Math.max(1, ow), Math.max(1, oh))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height) }
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, ow, oh)
  const blob = await c.convertToBlob({ type: format, quality }).catch(() => null)
  postMessage({ id: req.id, op: 'encode', blob } satisfies EncodeResponse)
}
