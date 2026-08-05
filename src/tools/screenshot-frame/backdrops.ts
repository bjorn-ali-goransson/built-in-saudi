// Backdrops for the screenshot framer.
//
// The repo's design system says no gradients by default. This is the exception
// it allows for: here the backdrop IS the product — the whole reason to run a
// screenshot through a framer is to sit it on something that looks deliberate —
// so a small curated set earns its place. They are drawn on the export canvas,
// not applied as CSS chrome.

export interface Backdrop {
  id: string
  en: string
  ar: string
  /** Solid fill, or two stops drawn as a diagonal gradient. */
  stops: [string] | [string, string]
}

export const BACKDROPS: Backdrop[] = [
  { id: 'sand', en: 'Sand', ar: 'رملي', stops: ['#e8dcc8'] },
  { id: 'paper', en: 'Paper', ar: 'ورقي', stops: ['#f6f1e7'] },
  { id: 'palm', en: 'Palm', ar: 'نخيلي', stops: ['#1f5c3d'] },
  { id: 'ink', en: 'Ink', ar: 'حبري', stops: ['#22271f'] },
  { id: 'brass', en: 'Brass', ar: 'نحاسي', stops: ['#c2903a'] },
  { id: 'dusk', en: 'Dusk', ar: 'غسق', stops: ['#2b3a55', '#6a4a6e'] },
  { id: 'dune', en: 'Dune', ar: 'كثبان', stops: ['#e5c07b', '#c2703a'] },
  { id: 'oasis', en: 'Oasis', ar: 'واحة', stops: ['#1f5c3d', '#3f8f6d'] },
  { id: 'none', en: 'Transparent', ar: 'شفاف', stops: ['transparent'] },
]

export interface FrameOptions {
  padding: number      // share of the longest edge
  radius: number       // px on the screenshot corners
  shadow: number       // 0–1
  backdrop: Backdrop
  ratio: string        // 'auto' | 'w:h'
  scale: number        // export multiplier
}

export const RATIOS = ['auto', '1:1', '4:3', '3:2', '16:9', '9:16', '4:5'] as const

function fill(ctx: CanvasRenderingContext2D, b: Backdrop, w: number, h: number) {
  if (b.stops[0] === 'transparent') return
  if (b.stops.length === 2) {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, b.stops[0])
    g.addColorStop(1, b.stops[1])
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = b.stops[0]
  }
  ctx.fillRect(0, 0, w, h)
}

/** Rounded rect path — Path2D.roundRect is not in every engine we support. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

/** Output dimensions without drawing anything — the label needs the numbers, not a canvas. */
export function frameSize(w: number, h: number, o: FrameOptions): { w: number; h: number } {
  const iw = w * o.scale
  const ih = h * o.scale
  const pad = Math.round(Math.max(iw, ih) * o.padding)
  let cw = iw + pad * 2
  let ch = ih + pad * 2
  if (o.ratio !== 'auto') {
    const [rw, rh] = o.ratio.split(':').map(Number)
    const target = rw / rh
    if (cw / ch < target) cw = Math.round(ch * target)
    else ch = Math.round(cw / target)
  }
  return { w: Math.round(cw), h: Math.round(ch) }
}

export function renderFrame(
  img: CanvasImageSource & { width: number; height: number },
  o: FrameOptions,
): HTMLCanvasElement {
  const iw = img.width * o.scale
  const ih = img.height * o.scale
  const pad = Math.round(Math.max(iw, ih) * o.padding)

  let cw = iw + pad * 2
  let ch = ih + pad * 2
  if (o.ratio !== 'auto') {
    const [rw, rh] = o.ratio.split(':').map(Number)
    const target = rw / rh
    // Grow the short side rather than cropping — a screenshot that loses its
    // edges to a ratio is worse than one with more padding on one axis.
    if (cw / ch < target) cw = Math.round(ch * target)
    else ch = Math.round(cw / target)
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(cw)
  canvas.height = Math.round(ch)
  const ctx = canvas.getContext('2d')!
  fill(ctx, o.backdrop, canvas.width, canvas.height)

  const x = Math.round((canvas.width - iw) / 2)
  const y = Math.round((canvas.height - ih) / 2)

  if (o.shadow > 0) {
    ctx.save()
    ctx.shadowColor = `rgba(0,0,0,${0.45 * o.shadow})`
    ctx.shadowBlur = Math.round(pad * 0.6 * o.shadow) || 1
    ctx.shadowOffsetY = Math.round(pad * 0.18 * o.shadow)
    ctx.fillStyle = '#000'
    roundRect(ctx, x, y, iw, ih, o.radius * o.scale)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  roundRect(ctx, x, y, iw, ih, o.radius * o.scale)
  ctx.clip()
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, x, y, iw, ih)
  ctx.restore()

  return canvas
}
