import { renderTextImage, toPngBytes, fontFor, isArabic } from '../../lib/textImage'

// Certificates, in bulk. One name per line produces one page each, which is the
// difference between a tool and a template — nobody wants to retype a name
// forty times, and that is exactly what a course coordinator has to do.
//
// The whole page is composed on a canvas at print resolution and embedded as a
// single image. That is what makes Arabic names render correctly (shaped and
// right-to-left) without a font-embedding dependency, and it also means the
// border and the layout are drawn once, in code we control.

const MM = 72 / 25.4

export interface CertOptions {
  title: string
  intro: string
  body: string
  signerLeft: string
  signerRight: string
  date: string
  /** Landscape A4 by default — a portrait certificate looks like a memo. */
  landscape: boolean
  accent: string
  border: 'sadu' | 'rule' | 'none'
}

export const DEFAULTS: CertOptions = {
  title: 'Certificate of Completion',
  intro: 'This is to certify that',
  body: 'has successfully completed the course',
  signerLeft: '',
  signerRight: '',
  date: '',
  landscape: true,
  accent: '#1f5c3d',
  border: 'sadu',
}

/** The Sadu triangle weave from the brand, drawn as a border band. */
function drawSadu(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string, scale: number) {
  const band = 26 * scale
  const step = 22 * scale
  ctx.save()
  ctx.fillStyle = accent
  for (const [y0, flip] of [[0, 1], [h - band, -1]] as const) {
    for (let x = 0; x < w; x += step) {
      ctx.beginPath()
      if (flip === 1) {
        ctx.moveTo(x, y0 + band); ctx.lineTo(x + step / 2, y0); ctx.lineTo(x + step, y0 + band)
      } else {
        ctx.moveTo(x, y0); ctx.lineTo(x + step / 2, y0 + band); ctx.lineTo(x + step, y0)
      }
      ctx.closePath()
      ctx.globalAlpha = (x / step) % 2 === 0 ? 0.9 : 0.45
      ctx.fill()
    }
  }
  ctx.restore()
}

/** Compose one certificate onto a canvas at print resolution. */
export function drawCertificate(name: string, o: CertOptions, dpi = 200): HTMLCanvasElement {
  const wMm = o.landscape ? 297 : 210
  const hMm = o.landscape ? 210 : 297
  const scale = dpi / 25.4
  const w = Math.round(wMm * scale)
  const h = Math.round(hMm * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  const px = (mm: number) => mm * scale
  const inset = px(14)

  if (o.border === 'sadu') drawSadu(ctx, w, h, o.accent, scale / (200 / 25.4) * 8)
  if (o.border === 'rule') {
    ctx.strokeStyle = o.accent
    ctx.lineWidth = px(1.2)
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2)
    ctx.lineWidth = px(0.3)
    ctx.strokeRect(inset + px(3), inset + px(3), w - (inset + px(3)) * 2, h - (inset + px(3)) * 2)
  }

  const contentW = w - inset * 4
  const centreX = w / 2
  let y = h * (o.border === 'sadu' ? 0.2 : 0.18)

  const put = (text: string, weight: number, sizeMm: number, colour: string, gapMm: number) => {
    if (!text.trim()) return
    const img = renderTextImage({
      text,
      font: fontFor(text, weight, px(sizeMm)),
      colour,
      maxWidth: contentW,
      align: 'center',
    })
    ctx.drawImage(img.canvas, centreX - img.width / 2, y)
    y += img.height + px(gapMm)
  }

  put(o.title, 700, 12, o.accent, 8)
  put(o.intro, 400, 5, '#555555', 4)
  // The name is the point of the document, so it is the largest thing on it.
  put(name, 700, 16, '#1a1a1a', 6)
  put(o.body, 400, 5.5, '#333333', 10)

  // Signature lines sit near the foot, with the date between them.
  const lineY = h - px(o.border === 'sadu' ? 42 : 36)
  const lineW = px(58)
  for (const [cx, label] of [
    [w * 0.28, o.signerLeft] as const,
    [w * 0.72, o.signerRight] as const,
  ]) {
    if (!label.trim()) continue
    ctx.strokeStyle = '#999999'
    ctx.lineWidth = px(0.3)
    ctx.beginPath()
    ctx.moveTo(cx - lineW / 2, lineY)
    ctx.lineTo(cx + lineW / 2, lineY)
    ctx.stroke()
    const img = renderTextImage({
      text: label, font: fontFor(label, 500, px(4)), colour: '#444444',
      maxWidth: lineW * 1.4, align: 'center',
    })
    ctx.drawImage(img.canvas, cx - img.width / 2, lineY + px(2))
  }

  if (o.date.trim()) {
    const img = renderTextImage({
      text: o.date, font: fontFor(o.date, 400, px(4)), colour: '#666666',
      maxWidth: contentW, align: 'center',
    })
    ctx.drawImage(img.canvas, centreX - img.width / 2, lineY - px(10))
  }

  return canvas
}

export async function buildCertificates(names: string[], o: CertOptions): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const wPt = (o.landscape ? 297 : 210) * MM
  const hPt = (o.landscape ? 210 : 297) * MM
  for (const name of names) {
    const canvas = drawCertificate(name, o)
    const png = await doc.embedPng(await toPngBytes(canvas))
    const page = doc.addPage([wPt, hPt])
    page.drawImage(png, { x: 0, y: 0, width: wPt, height: hPt })
  }
  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

export { isArabic }
