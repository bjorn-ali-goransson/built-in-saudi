// Drawing the sheet onto a page, then wrapping it in a PDF.
//
// The canvas route, for the reason `lib/printPdf.ts` records: pdf-lib cannot
// shape Arabic or reorder bidi text, and a wall chart is layout rather than
// selectable prose. It is also why `columnOrder` is computed rather than left
// to CSS — a canvas has no `direction` to inherit, so a grid that looked right
// on screen would print backwards.
//
// The ARTWORK is not redrawn here: `illustrations.ts` hands the same SVG to an
// `<img>` on screen and to `drawImage` on the canvas, so the printed sheet
// cannot slowly stop looking like the one that was edited.

import { A4_LANDSCAPE, newPage, pagesToPdf, toPng } from '../../lib/printPdf'
import { FOOTER_BAND, FOOTER_URL, HEADER_BAND, HEADER_URL } from './illustrations'
import { planQr, QUIET, type QrPlan } from './qr'
import {
  DAY_LABEL, DAY_TINT, SNAP, columnOrder, fmt, fmtSpan, itemsOn, layoutDay,
  type Schedule,
} from './schedule'

const INK = '#12211b'
const TITLE_INK = '#2f4f3e'
const SOFT = '#40514a'
const FAINT = '#6b7a72'
const PAPER = '#fbf7ef'

const EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'

/**
 * Times are set in IBM Plex Sans Arabic in BOTH locales, matching the screen.
 *
 * Not a monospace: a schedule is not code, and a typewriter face in the middle
 * of a warm editorial sheet reads as a mistake. Plex is the one loaded family
 * that sets Latin and Arabic digits evenly, which is what a column of times
 * actually needs.
 */
const TIME_FONT = '"IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif'

export interface DrawStrings {
  /** Printed under the QR. */
  scanToEdit: string
}

/** Shrink `text` until it fits, with an ellipsis if it had to. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let out = text
  while (out.length > 1 && ctx.measureText(out + '…').width > max) out = out.slice(0, -1)
  return out + '…'
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('illustration failed to load'))
    img.src = url
  })
}

/**
 * The band CONTAINED in its strip and centred — never cropped, never stretched.
 *
 * `object-fit: contain` is what the screen does, so anything else here would
 * be the one place the two renderings differ, and it would differ in the way
 * hardest to notice: the same picture, slightly clipped.
 */
function drawBand(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const scale = Math.min(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
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

export interface SheetPdf {
  blob: Blob
  qr: QrPlan
}

/**
 * The sheet as a PDF, with the QR that reopens it for editing.
 *
 * `link` is the full share URL. When it cannot become a scannable code the
 * page is still produced — a schedule you can print is the point, and the QR
 * is the extra — and the reason comes back in `qr` so the caller can say which
 * half of the limit was hit rather than leaving a blank corner.
 */
export async function schedulePdf(
  s: Schedule, locale: 'en' | 'ar', link: string, str: DrawStrings,
): Promise<SheetPdf> {
  const rtl = locale === 'ar'
  const page = newPage(A4_LANDSCAPE)
  const { ctx, px } = page
  const W = page.canvas.width
  const H = page.canvas.height
  // The same face in both languages, matching the screen. See `Sheet.tsx`:
  // this is a printed bilingual artefact and a sheet in two families is two
  // sheets. Plex is also the one loaded family that sets Latin and Arabic
  // digits evenly, which a column of times needs.
  const font = TIME_FONT

  // Web fonts are loaded lazily; drawing before they arrive silently falls
  // back to a system face, which on the Arabic side is the difference between
  // a sheet and a row of boxes.
  try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready } catch { /* ignore */ }

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)

  const qr = planQr(link)
  const [headerArt, footerArt] = s.art
    ? await Promise.all([loadImage(HEADER_URL), loadImage(FOOTER_URL)])
    : [null, null]

  const margin = 8 * px
  const headH = s.art ? (W * HEADER_BAND) / 100 : 0
  const artFootH = s.art ? (W * FOOTER_BAND) / 100 : 0
  const qrSide = qr.ok ? qr.sizeMm * px : 0
  const captionH = qr.ok ? 5 * px : 0
  const footH = Math.max(artFootH, qrSide + captionH + 6.8 * px)

  if (headerArt) drawBand(ctx, headerArt, 0, 0, W, headH)
  if (footerArt) drawBand(ctx, footerArt, 0, H - artFootH, W, artFootH)

  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Title block: the same banner, pill and class line the screen shows.
  let y = headH + 4 * px
  ctx.font = `700 ${Math.round(6.4 * px)}px ${font}`
  const title = fit(ctx, s.title, W - margin * 2 - 16 * px)
  const titleW = ctx.measureText(title).width + 14 * px
  const titleH = 11 * px
  ctx.fillStyle = '#fdf3de'
  roundRect(ctx, (W - titleW) / 2, y, titleW, titleH, 3 * px); ctx.fill()
  ctx.fillStyle = TITLE_INK
  ctx.fillText(title, W / 2, y + titleH / 2)
  y += titleH + 2.5 * px

  if (s.note.trim()) {
    ctx.font = `${Math.round(3.3 * px)}px ${font}`
    const note = fit(ctx, s.note, W - margin * 2 - 12 * px)
    const noteW = ctx.measureText(note).width + 10 * px
    const noteH = 6.4 * px
    ctx.fillStyle = '#fdf3de'
    roundRect(ctx, (W - noteW) / 2, y, noteW, noteH, noteH / 2); ctx.fill()
    ctx.fillStyle = SOFT
    ctx.fillText(note, W / 2, y + noteH / 2)
    y += noteH + 1.6 * px
  }
  if (s.group.trim()) {
    ctx.fillStyle = TITLE_INK
    ctx.font = `700 ${Math.round(4 * px)}px ${font}`
    ctx.fillText(fit(ctx, s.group, W - margin * 2), W / 2, y + 2.4 * px)
    y += 6 * px
  }

  // The grid: one time axis, and the days beside it.
  //
  // The axis is on the side the reader starts from — the right in Arabic —
  // and `columnOrder` reverses the day columns, because a canvas has no
  // reading direction to inherit. `lib/week.ts` records why that reversal is
  // for the canvas ONLY and must never be applied to the HTML.
  const days = columnOrder(s.days, rtl)
  const gridTop = y + 2 * px
  const gridBottom = H - footH - 2 * px
  const gridW = W - margin * 2
  const axisW = 13 * px
  const gap = 1.6 * px
  const headRow = 7 * px
  const bodyTop = gridTop + headRow
  const bodyH = Math.max(20 * px, gridBottom - bodyTop)

  const span = Math.max(SNAP, s.to - s.from)
  const perMinute = bodyH / span
  const at = (minutes: number) => bodyTop + (minutes - s.from) * perMinute

  const colW = (gridW - axisW - gap * days.length) / days.length
  // Days run left to right from the far edge; the axis takes the near one.
  const daysLeft = margin + (rtl ? 0 : axisW + gap)
  const axisLeft = rtl ? margin + gridW - axisW : margin

  // The axis labels, every half hour.
  const LABEL_EVERY = 30
  const marks: number[] = []
  for (let t = Math.ceil(s.from / LABEL_EVERY) * LABEL_EVERY; t <= s.to; t += LABEL_EVERY) marks.push(t)

  ctx.save()
  ctx.direction = 'ltr'
  ctx.textAlign = rtl ? 'left' : 'right'
  ctx.font = `${Math.round(2.9 * px)}px ${TIME_FONT}`
  for (const t of marks) {
    ctx.fillStyle = t % 60 === 0 ? SOFT : FAINT
    ctx.fillText(fmt(t), rtl ? axisLeft + 1.2 * px : axisLeft + axisW - 1.2 * px, at(t))
  }
  ctx.restore()
  ctx.textAlign = 'center'

  days.forEach((day, i) => {
    const x = daysLeft + (colW + gap) * i
    const tint = DAY_TINT[day]
    const pad = 1 * px

    // The column is the day's solid colour, and that is the only fill it has:
    // no border, no alternating bands, no hour rules. The white cards on it
    // are the structure.
    ctx.fillStyle = tint.solid
    roundRect(ctx, x, gridTop, colW, headRow + bodyH, 3 * px); ctx.fill()

    ctx.save()
    roundRect(ctx, x, gridTop, colW, headRow + bodyH, 3 * px); ctx.clip()
    ctx.fillStyle = tint.head
    ctx.fillRect(x, gridTop, colW, headRow)
    ctx.restore()

    ctx.fillStyle = TITLE_INK
    ctx.font = `700 ${Math.round(3.8 * px)}px ${font}`
    ctx.fillText(fit(ctx, DAY_LABEL[day][locale], colW - 4 * px), x + colW / 2, gridTop + headRow / 2)

    for (const { item, col, cols } of layoutDay(itemsOn(s, day))) {
      const top = at(item.start) + 0.6 * px
      const h = Math.max(3.5 * px, (item.end - item.start) * perMinute) - 0.8 * px
      const w = (colW - pad * 2) / cols
      const bx = x + pad + w * col

      ctx.fillStyle = '#ffffff'
      roundRect(ctx, bx + 0.3 * px, top, w - 0.6 * px, h, 2 * px); ctx.fill()

      const icon = item.icon.trim()
      const tall = h >= 8 * px
      const nameY = top + (tall ? h / 2 - 1.6 * px : h / 2)

      // Icon and name read as one line, centred together — the sheet is seen
      // from across a room, where a name pinned to one edge is harder to find.
      ctx.font = `600 ${Math.round(3.1 * px)}px ${font}`
      const name = fit(ctx, item.name, w - pad * 2 - (icon ? 5 * px : 0))
      const nameW = ctx.measureText(name).width
      const iconW = icon ? 4.4 * px : 0
      const total = nameW + iconW
      const startX = bx + w / 2 - total / 2

      if (icon) {
        ctx.save()
        ctx.direction = 'ltr'
        ctx.textAlign = 'center'
        ctx.font = `${Math.round(3.3 * px)}px ${EMOJI}`
        ctx.fillText(icon, rtl ? startX + total - iconW / 2 : startX + iconW / 2, nameY)
        ctx.restore()
      }
      ctx.fillStyle = INK
      ctx.font = `600 ${Math.round(3.1 * px)}px ${font}`
      ctx.fillText(name, rtl ? startX + nameW / 2 : startX + iconW + nameW / 2, nameY)

      if (tall) {
        ctx.save()
        ctx.direction = 'ltr'
        ctx.fillStyle = FAINT
        ctx.font = `${Math.round(2.6 * px)}px ${TIME_FONT}`
        ctx.fillText(fit(ctx, fmtSpan(item), w - pad * 2), bx + w / 2, nameY + 3.4 * px)
        ctx.restore()
      }
    }
  })

  if (qr.ok) {
    // The code and its caption sit on a card of their own, because the footer
    // band is an illustration: black modules over grass are still scannable
    // (the quiet zone is white) but the CAPTION over it is not readable, and a
    // caption nobody reads leaves a large unexplained square on the sheet.
    const pad = 2.4 * px
    const cardW = qrSide + pad * 2
    const cardH = qrSide + captionH + pad * 2
    const cx = rtl ? margin : W - margin - cardW
    const cy = H - cardH - 2 * px
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, cx, cy, cardW, cardH, 2.4 * px); ctx.fill()

    // The code goes on as its OWN image, not into the page raster: at 150dpi a
    // module here is 2.5 pixels and a decoder needs about five, so the version
    // drawn on the canvas was unreadable however correct it looked. Measured
    // with jsQR against the composed page, which is the only way to find it.
    page.overlays.push({
      png: await qrPng(qr.matrix),
      xMm: (cx + pad) / px, yMm: (cy + pad) / px,
      wMm: qrSide / px, hMm: qrSide / px,
    })

    ctx.direction = rtl ? 'rtl' : 'ltr'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = SOFT
    ctx.font = `600 ${Math.round(3 * px)}px ${font}`
    ctx.fillText(
      fit(ctx, str.scanToEdit, cardW - pad),
      cx + cardW / 2, cy + pad + qrSide + captionH / 2,
    )
  }

  return { blob: await pagesToPdf([page]), qr }
}

/**
 * How many image pixels each module gets.
 *
 * Measured rather than chosen: at 2.5 px/module — what the 150dpi page raster
 * gives — jsQR cannot read the code at all, and at 5 it can. 8 is that with
 * room to spare, and costs nothing, because the overlay is embedded at its own
 * size instead of being part of the page.
 */
const QR_MODULE_PX = 8

/**
 * The modules are deep palm green, not black.
 *
 * What a decoder needs is CONTRAST, not black: the threshold is a light/dark
 * decision per module, and #0b3d2e against white is a contrast ratio of about
 * 13:1, far above the ~3:1 where readers start to struggle. Black on a sheet
 * of pastel day columns and a drawn footer is the one hard element on the
 * page, and it reads as a sticker somebody else put there. Verified by
 * decoding the rendered PDF, not by assuming.
 */
const QR_INK = '#0b3d2e'

/**
 * The code as a standalone PNG, one module to an exact block of pixels.
 *
 * Integer module size is the other half of the fix. When the step is
 * fractional the obvious `fillRect(c * step, …, ceil(step), ceil(step))`
 * paints each module wider than its own pitch — a 21% overlap at 2.48px,
 * compounding across the symbol until the finder patterns are the wrong shape.
 * With an integer size there is no rounding left to get wrong: no overlap, no
 * hairline gaps a camera reads as light, and no anti-aliasing to grey.
 *
 * The quiet zone is part of the code, not padding around it — a reader that
 * cannot find four clear modules on every side will not attempt the symbol,
 * and this one is landing on an illustrated footer.
 */
async function qrPng(m: { size: number; get(x: number, y: number): boolean }): Promise<Uint8Array> {
  const across = m.size + QUIET * 2
  const canvas = document.createElement('canvas')
  canvas.width = across * QR_MODULE_PX
  canvas.height = across * QR_MODULE_PX
  const c2 = canvas.getContext('2d')!
  c2.fillStyle = '#ffffff'
  c2.fillRect(0, 0, canvas.width, canvas.height)
  c2.fillStyle = QR_INK
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (!m.get(c, r)) continue
      c2.fillRect(
        (c + QUIET) * QR_MODULE_PX, (r + QUIET) * QR_MODULE_PX,
        QR_MODULE_PX, QR_MODULE_PX,
      )
    }
  }
  return toPng(canvas)
}
