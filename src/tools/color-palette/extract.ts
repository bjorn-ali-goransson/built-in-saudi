// Palette extraction by median cut. K-means gives slightly nicer centroids but
// needs several passes over every pixel and a random seed; median cut is one
// sort per split, deterministic, and produces the same answer every time — which
// matters when someone re-runs it expecting the palette they saw a minute ago.

export interface Swatch { r: number; g: number; b: number; share: number; hex: string }

interface Box { pixels: Uint8ClampedArray[]; }

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** Sample the image down before quantising — a 12MP photo is 12M pixels and the
 *  palette is identical from ~40k of them. */
function samplePixels(img: ImageBitmap, target = 40000): Uint8ClampedArray[] {
  const scale = Math.min(1, Math.sqrt(target / (img.width * img.height)))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const out: Uint8ClampedArray[] = []
  for (let i = 0; i < data.length; i += 4) {
    // Skip near-transparent pixels: a cut-out PNG is mostly nothing, and
    // averaging its alpha edge produces a grey that is not in the picture.
    if (data[i + 3] < 125) continue
    out.push(data.subarray(i, i + 3))
  }
  return out
}

function medianCut(pixels: Uint8ClampedArray[], depth: number): Box[] {
  if (depth === 0 || pixels.length === 0) return [{ pixels }]
  // Split along whichever channel has the widest spread — the axis carrying the
  // most information in this box.
  let widest = 0
  let widestRange = -1
  for (let c = 0; c < 3; c++) {
    let min = 255, max = 0
    for (const p of pixels) { if (p[c] < min) min = p[c]; if (p[c] > max) max = p[c] }
    if (max - min > widestRange) { widestRange = max - min; widest = c }
  }
  const sorted = [...pixels].sort((a, b) => a[widest] - b[widest])
  const mid = Math.floor(sorted.length / 2)
  return [
    ...medianCut(sorted.slice(0, mid), depth - 1),
    ...medianCut(sorted.slice(mid), depth - 1),
  ]
}

export function extractPalette(img: ImageBitmap, count = 6): Swatch[] {
  const pixels = samplePixels(img)
  if (!pixels.length) return []
  const depth = Math.max(1, Math.ceil(Math.log2(count)))
  const boxes = medianCut(pixels, depth).filter((b) => b.pixels.length)
  const total = boxes.reduce((n, b) => n + b.pixels.length, 0)
  const swatches = boxes.map((b) => {
    let r = 0, g = 0, bl = 0
    for (const p of b.pixels) { r += p[0]; g += p[1]; bl += p[2] }
    const n = b.pixels.length
    return { r: r / n, g: g / n, b: bl / n, share: n / total, hex: hex(r / n, g / n, bl / n) }
  })
  // Biggest share first, then trim to the requested count.
  return swatches.sort((a, b) => b.share - a.share).slice(0, count)
}

// ── Conversions for the copy formats ────────────────────────────────────────
export function toRgb(s: Swatch): string {
  return `rgb(${Math.round(s.r)}, ${Math.round(s.g)}, ${Math.round(s.b)})`
}

export function toHsl(s: Swatch): string {
  const r = s.r / 255, g = s.g / 255, b = s.b / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return `hsl(${Math.round(h)}, ${Math.round(sat * 100)}%, ${Math.round(l * 100)}%)`
}

/** Relative luminance, so the label on a swatch stays readable. */
export function isDark(s: Swatch): boolean {
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(s.r) + 0.7152 * lin(s.g) + 0.0722 * lin(s.b) < 0.4
}

export function asCss(swatches: Swatch[]): string {
  return ':root {\n' + swatches.map((s, i) => `  --color-${i + 1}: ${s.hex};`).join('\n') + '\n}'
}
export function asTailwind(swatches: Swatch[]): string {
  return 'colors: {\n' + swatches.map((s, i) => `  brand${i + 1}: '${s.hex}',`).join('\n') + '\n}'
}
export function asJson(swatches: Swatch[]): string {
  return JSON.stringify(swatches.map((s) => ({ hex: s.hex, rgb: toRgb(s), share: Math.round(s.share * 100) })), null, 2)
}
