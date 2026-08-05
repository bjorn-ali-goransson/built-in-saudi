import { pixelSize, tileCount, type Sheet, type Spec } from './specs'

// The photo is defined by three numbers the user controls: a zoom, and an x/y
// offset of the source image inside the frame. Everything else — head guides,
// print sheets — is derived from those, so there is one source of truth and the
// preview cannot drift from the exported file.

export interface Transform { zoom: number; x: number; y: number }

export const IDENTITY: Transform = { zoom: 1, x: 0, y: 0 }

/**
 * Draw the source into a spec-sized canvas. `cover` scaling first, then the
 * user's zoom and offset on top, so zoom 1 always fills the frame regardless of
 * the source aspect ratio.
 */
export function drawPhoto(
  source: CanvasImageSource & { width: number; height: number },
  spec: Spec,
  dpi: number,
  t: Transform,
  background: string,
): HTMLCanvasElement {
  const { w, h } = pixelSize(spec, dpi)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  // A white base matters: a transparent PNG (very likely, since the background
  // remover feeds this tool) would otherwise print black.
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)

  const cover = Math.max(w / source.width, h / source.height)
  const scale = cover * t.zoom
  const dw = source.width * scale
  const dh = source.height * scale
  const dx = (w - dw) / 2 + t.x * w
  const dy = (h - dh) / 2 + t.y * h
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, dx, dy, dw, dh)
  return canvas
}

/** Tile the finished photo across a print sheet, with cut gaps. */
export function drawSheet(photo: HTMLCanvasElement, spec: Spec, sheet: Sheet, dpi: number, gapMm: number): HTMLCanvasElement {
  const mmToPx = (mm: number) => Math.round((mm / 25.4) * dpi)
  const canvas = document.createElement('canvas')
  canvas.width = mmToPx(sheet.wmm)
  canvas.height = mmToPx(sheet.hmm)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const { cols, rows } = tileCount(sheet, spec, gapMm)
  const pw = mmToPx(spec.wmm)
  const ph = mmToPx(spec.hmm)
  const gap = mmToPx(gapMm)
  const totalW = cols * pw + (cols - 1) * gap
  const totalH = rows * ph + (rows - 1) * gap
  const originX = Math.round((canvas.width - totalW) / 2)
  const originY = Math.round((canvas.height - totalH) / 2)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = originX + c * (pw + gap)
      const y = originY + r * (ph + gap)
      ctx.drawImage(photo, x, y, pw, ph)
      // Hairline cut guides — without them people cut by eye and lose the margin.
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1)
    }
  }
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality)
  })
}
