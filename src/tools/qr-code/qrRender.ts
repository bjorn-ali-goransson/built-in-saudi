import QRCode from 'qrcode'

export type DotStyle = 'square' | 'dots' | 'rounded' | 'cube' | 'liquid' | 'emoji'
export const DOT_STYLES: DotStyle[] = ['square', 'dots', 'rounded', 'cube', 'liquid', 'emoji']
export type Frame = 'none' | 'card' | 'panel' | 'bubble' | 'ribbon' | 'corner' | 'circle'
export interface BorderStyle { width: number; style: 'solid' | 'dashed'; radius: number } // width/radius as fractions of the QR size
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif'

export interface RenderOpts {
  value: string
  size: number // approximate target pixel size for the QR itself
  margin: number // quiet zone, in modules
  fg: string
  bg: string
  dot: DotStyle
  emoji?: string
  ecLevel: 'L' | 'M' | 'Q' | 'H'
  logo?: HTMLImageElement | null
  frame?: Frame
  frameColor?: string
  label?: string
  border?: BorderStyle
}

function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const ch = [0, 2, 4].map((i) => Math.max(0, Math.min(255, parseInt(n.slice(i, i + 2), 16) + amt)))
  return '#' + ch.map((x) => x.toString(16).padStart(2, '0')).join('')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// A rect whose four corners have independent radii — used for the "liquid"
// style so adjacent modules merge (a corner only rounds when both of the cells
// touching it are empty).
function varRect(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tl: number, tr: number, br: number, bl: number) {
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + s - tr, y); ctx.arcTo(x + s, y, x + s, y + tr, tr)
  ctx.lineTo(x + s, y + s - br); ctx.arcTo(x + s, y + s, x + s - br, y + s, br)
  ctx.lineTo(x + bl, y + s); ctx.arcTo(x, y + s, x, y + s - bl, bl)
  ctx.lineTo(x, y + tl); ctx.arcTo(x, y, x + tl, y, tl)
  ctx.closePath()
}

/** Draw just the QR modules onto `canvas`, sized to fit `o.size`. Finder
 *  patterns stay solid squares for reliable scanning. Returns the pixel dim. */
function renderMatrix(canvas: HTMLCanvasElement, o: RenderOpts): number {
  const qr = QRCode.create(o.value, { errorCorrectionLevel: o.ecLevel })
  const count = qr.modules.size
  const data = qr.modules.data
  const total = count + o.margin * 2
  const cell = Math.max(2, Math.floor(o.size / total))
  const dim = cell * total
  canvas.width = dim
  canvas.height = dim
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = o.bg
  ctx.fillRect(0, 0, dim, dim)
  const off = o.margin * cell
  const light = shade(o.fg, 45)
  const dark = shade(o.fg, -55)
  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < count && c < count && !!data[r * count + c]
  const isFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7)
  const emoji = o.emoji || '⭐'
  if (o.dot === 'emoji') { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.round(cell * 1.05)}px ${EMOJI_FONT}` }

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!data[r * count + c]) continue
      const x = off + c * cell
      const y = off + r * cell
      const style = isFinder(r, c) ? 'square' : o.dot
      ctx.fillStyle = o.fg
      if (style === 'square') {
        ctx.fillRect(x, y, cell, cell)
      } else if (style === 'dots') {
        ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.46, 0, Math.PI * 2); ctx.fill()
      } else if (style === 'rounded') {
        roundRect(ctx, x + cell * 0.05, y + cell * 0.05, cell * 0.9, cell * 0.9, cell * 0.35); ctx.fill()
      } else if (style === 'liquid') {
        const up = on(r - 1, c), dn = on(r + 1, c), lf = on(r, c - 1), rt = on(r, c + 1)
        const R = cell * 0.5
        varRect(ctx, x, y, cell, up || lf ? 0 : R, up || rt ? 0 : R, dn || rt ? 0 : R, dn || lf ? 0 : R)
        ctx.fill()
      } else if (style === 'emoji') {
        ctx.fillText(emoji, x + cell / 2, y + cell / 2)
      } else {
        const d = cell * 0.3
        ctx.fillStyle = o.fg; ctx.fillRect(x, y + d, cell - d, cell - d)
        ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(x, y + d); ctx.lineTo(x + d, y); ctx.lineTo(x + cell, y); ctx.lineTo(x + cell - d, y + d); ctx.closePath(); ctx.fill()
        ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(x + cell - d, y + d); ctx.lineTo(x + cell, y); ctx.lineTo(x + cell, y + cell - d); ctx.lineTo(x + cell - d, y + cell); ctx.closePath(); ctx.fill()
      }
    }
  }

  if (o.logo && o.logo.complete && o.logo.naturalWidth) {
    const lw = dim * 0.22, lx = (dim - lw) / 2, ly = (dim - lw) / 2, pad = cell * 0.7
    ctx.fillStyle = o.bg
    roundRect(ctx, lx - pad, ly - pad, lw + pad * 2, lw + pad * 2, cell); ctx.fill()
    ctx.drawImage(o.logo, lx, ly, lw, lw)
  }
  return dim
}

/** Render the QR, optionally inside a decorative frame with a "SCAN ME" label. */
export function renderQR(canvas: HTMLCanvasElement, o: RenderOpts): number {
  if (!o.value) { canvas.width = canvas.height = 0; return 0 }
  const frame = o.frame ?? 'none'
  const fc = o.frameColor ?? o.fg
  const label = (o.label ?? '').trim()

  const qc = document.createElement('canvas')
  const q = renderMatrix(qc, o)
  const ctx = canvas.getContext('2d')!

  if (frame === 'none') {
    const b = o.border
    if (b && b.width > 0) {
      const lw = Math.max(1, Math.round(q * b.width))
      const pad = lw + Math.round(q * 0.015)
      const w = q + pad * 2
      canvas.width = w; canvas.height = w
      const rad = Math.round(q * b.radius) + pad
      ctx.fillStyle = o.bg
      roundRect(ctx, 0, 0, w, w, rad); ctx.fill()
      ctx.drawImage(qc, pad, pad)
      ctx.strokeStyle = fc
      ctx.lineWidth = lw
      if (b.style === 'dashed') ctx.setLineDash([lw * 2.4, lw * 1.7])
      roundRect(ctx, lw / 2, lw / 2, w - lw, w - lw, Math.max(0, rad - lw / 2))
      ctx.stroke(); ctx.setLineDash([])
      return w
    }
    canvas.width = q; canvas.height = q
    ctx.drawImage(qc, 0, 0)
    return q
  }

  const labelH = label ? Math.round(q * 0.16) : 0
  const label2 = label || 'SCAN ME'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Shared badge helpers: a rounded white QR card, a triangle, a centred label.
  const qcard = (x: number, y: number) => {
    ctx.save(); roundRect(ctx, x, y, q, q, Math.round(q * 0.06)); ctx.clip(); ctx.drawImage(qc, x, y); ctx.restore()
  }
  const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill()
  }
  const putLabel = (cx: number, cy: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.font = `800 ${Math.round(h * 0.58)}px "Hanken Grotesk", system-ui, sans-serif`
    ctx.fillText(label2, cx, cy)
  }

  if (frame === 'card') {
    const pad = Math.round(q * 0.09)
    const w = q + pad * 2
    const h = q + pad * 2 + labelH
    canvas.width = w; canvas.height = h
    ctx.fillStyle = fc
    roundRect(ctx, 0, 0, w, h, Math.round(q * 0.09)); ctx.fill()
    ctx.fillStyle = o.bg
    roundRect(ctx, pad, pad, q, q, Math.round(q * 0.05)); ctx.fill()
    ctx.drawImage(qc, pad, pad)
    if (label) {
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 ${Math.round(labelH * 0.5)}px "Hanken Grotesk", system-ui, sans-serif`
      ctx.fillText(label, w / 2, q + pad * 2 + labelH / 2)
    }
    return w
  }

  // Coloured panel with the label on a bar at the top.
  if (frame === 'panel') {
    const pad = Math.round(q * 0.09)
    const lblH = Math.round(q * 0.2)
    const w = q + pad * 2
    const h = q + pad * 2 + lblH
    canvas.width = w; canvas.height = h
    ctx.fillStyle = fc
    roundRect(ctx, 0, 0, w, h, Math.round(q * 0.1)); ctx.fill()
    qcard(pad, lblH + pad)
    putLabel(w / 2, pad / 2 + lblH / 2, lblH, '#ffffff')
    return w
  }

  // Speech bubble: label bar under the QR with a downward pointer tail.
  if (frame === 'bubble') {
    const pad = Math.round(q * 0.08)
    const lblH = Math.round(q * 0.2)
    const tail = Math.round(q * 0.1)
    const w = q + pad * 2
    const bodyH = q + pad * 2 + lblH
    canvas.width = w; canvas.height = bodyH + tail
    ctx.fillStyle = fc
    roundRect(ctx, 0, 0, w, bodyH, Math.round(q * 0.1)); ctx.fill()
    tri(w / 2 - tail, bodyH - 1, w / 2 + tail, bodyH - 1, w / 2, bodyH + tail)
    qcard(pad, pad)
    putLabel(w / 2, q + pad + (pad + lblH) / 2, lblH, '#ffffff')
    return w
  }

  // Fishtail ribbon banner across the lower part of the QR.
  if (frame === 'ribbon') {
    const ext = Math.round(q * 0.1)
    const bh = Math.round(q * 0.22)
    const notch = Math.round(bh * 0.42)
    const w = q + ext * 2
    const by = q - Math.round(bh * 0.4)
    canvas.width = w; canvas.height = by + bh
    qcard(ext, 0)
    ctx.fillStyle = fc
    ctx.beginPath()
    ctx.moveTo(0, by); ctx.lineTo(w, by)
    ctx.lineTo(w - notch, by + bh / 2); ctx.lineTo(w, by + bh)
    ctx.lineTo(0, by + bh); ctx.lineTo(notch, by + bh / 2)
    ctx.closePath(); ctx.fill()
    putLabel(w / 2, by + bh / 2, bh, '#ffffff')
    return w
  }

  // Corner brackets around the QR with the label beneath.
  if (frame === 'corner') {
    const m = Math.round(q * 0.09)
    const lblH = Math.round(q * 0.18)
    const w = q + m * 2
    const h = q + m + lblH + Math.round(q * 0.05)
    canvas.width = w; canvas.height = h
    ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h)
    qcard(m, m)
    const t = Math.max(2, Math.round(q * 0.03)), len = Math.round(q * 0.17), g = Math.round(q * 0.02)
    ctx.fillStyle = fc
    const Lx = m - g - t, Rx = m + q + g, Ty = m - g - t, By = m + q + g
    ctx.fillRect(Lx, Ty, len, t); ctx.fillRect(Lx, Ty, t, len)
    ctx.fillRect(Rx + t - len, Ty, len, t); ctx.fillRect(Rx, Ty, t, len)
    ctx.fillRect(Lx, By, len, t); ctx.fillRect(Lx, By + t - len, t, len)
    ctx.fillRect(Rx + t - len, By, len, t); ctx.fillRect(Rx, By + t - len, t, len)
    putLabel(w / 2, m + q + Math.round(q * 0.02) + lblH / 2, lblH, fc)
    return w
  }

  // circle badge — a generously sized disc so the white QR card sits fully
  // inside (its corners never poke past the edge); the card + label are centred
  // as one group, with the label riding the lower arc, text centred.
  const cardPad = Math.round(q * 0.05)
  const cardS = q + cardPad * 2
  const lh = label ? Math.round(q * 0.14) : 0
  const gap = label ? Math.round(q * 0.04) : 0
  const diam = Math.round(cardS * 1.46 + lh * 1.25)
  canvas.width = diam; canvas.height = diam
  ctx.fillStyle = fc
  ctx.beginPath(); ctx.arc(diam / 2, diam / 2, diam / 2, 0, Math.PI * 2); ctx.fill()
  const groupH = cardS + gap + lh
  const top = Math.round((diam - groupH) / 2)
  const cardX = Math.round((diam - cardS) / 2)
  ctx.fillStyle = o.bg
  roundRect(ctx, cardX, top, cardS, cardS, Math.round(q * 0.08)); ctx.fill()
  ctx.drawImage(qc, cardX + cardPad, top + cardPad)
  if (label) {
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 ${Math.round(lh * 0.72)}px "Hanken Grotesk", system-ui, sans-serif`
    ctx.fillText(label, diam / 2, top + cardS + gap + lh / 2)
  }
  return diam
}
