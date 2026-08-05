// Platform image sizes. Published dimensions as of 2026 — platforms move these
// around, so the tool exports at the stated pixel size rather than claiming any
// kind of certification, and every entry names what it is for.

export interface Size {
  id: string
  group: string
  en: string
  ar: string
  w: number
  h: number
}

export const SIZES: Size[] = [
  { id: 'ig-square', group: 'Instagram', en: 'Square post', ar: 'منشور مربع', w: 1080, h: 1080 },
  { id: 'ig-portrait', group: 'Instagram', en: 'Portrait post', ar: 'منشور طولي', w: 1080, h: 1350 },
  { id: 'ig-story', group: 'Instagram', en: 'Story / Reel', ar: 'ستوري / ريل', w: 1080, h: 1920 },
  { id: 'x-post', group: 'X', en: 'Post image', ar: 'صورة منشور', w: 1600, h: 900 },
  { id: 'x-header', group: 'X', en: 'Header', ar: 'غلاف', w: 1500, h: 500 },
  { id: 'li-post', group: 'LinkedIn', en: 'Post image', ar: 'صورة منشور', w: 1200, h: 627 },
  { id: 'li-cover', group: 'LinkedIn', en: 'Page cover', ar: 'غلاف الصفحة', w: 1128, h: 191 },
  { id: 'yt-thumb', group: 'YouTube', en: 'Thumbnail', ar: 'صورة مصغّرة', w: 1280, h: 720 },
  { id: 'fb-cover', group: 'Facebook', en: 'Cover', ar: 'غلاف', w: 1640, h: 856 },
  { id: 'snap', group: 'Snapchat', en: 'Snap', ar: 'سناب', w: 1080, h: 1920 },
  { id: 'wa-status', group: 'WhatsApp', en: 'Status', ar: 'حالة', w: 1080, h: 1920 },
  { id: 'og', group: 'Web', en: 'Open Graph / link preview', ar: 'معاينة الرابط', w: 1200, h: 630 },
]

export const GROUPS = [...new Set(SIZES.map((s) => s.group))]

export type Fit = 'cover' | 'contain'

/**
 * Draw the source at a target size. `cover` fills and crops from the centre;
 * `contain` fits the whole image and pads — which is the right default for a
 * logo or a chart, where losing the edges is worse than seeing the backdrop.
 */
export function renderSize(
  img: CanvasImageSource & { width: number; height: number },
  size: Size,
  fit: Fit,
  background: string,
  focusY = 0.5,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')!
  if (background !== 'transparent') {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, size.w, size.h)
  }
  const scale = fit === 'cover'
    ? Math.max(size.w / img.width, size.h / img.height)
    : Math.min(size.w / img.width, size.h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = (size.w - dw) / 2
  // Faces sit in the top half of most photos, so a cover crop that always cuts
  // from the centre decapitates people on tall targets. focusY lets the user move it.
  const dy = fit === 'cover' ? (size.h - dh) * focusY : (size.h - dh) / 2
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, dx, dy, dw, dh)
  return canvas
}

export function canvasBytes(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a))) : reject(new Error('encode failed'))),
      type,
      quality,
    )
  })
}
