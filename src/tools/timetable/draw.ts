// Drawing the timetable onto a page, then wrapping it in a PDF.
//
// The canvas route, for the reason `lib/printPdf.ts` records: pdf-lib cannot
// shape Arabic or reorder bidi text, and a timetable is layout rather than
// selectable prose. It is also why the column order is computed here rather
// than left to CSS — a canvas has no `direction` to inherit, so a grid that
// looked right on screen would print backwards.

import { A4_LANDSCAPE, newPage, pagesToPdf } from '../../lib/printPdf'
import { DAY_LABEL, columnOrder, type Timetable } from './timetable'

const INK = '#1a1a18'
const RULE = '#c9c2b4'
const HEAD = '#f0ece2'

export async function timetablePdf(t: Timetable, locale: 'en' | 'ar'): Promise<Blob> {
  const rtl = locale === 'ar'
  const page = newPage(A4_LANDSCAPE)
  const { ctx, px } = page
  const font = rtl ? '"IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif' : '"Hanken Grotesk", sans-serif'

  const marginX = 12 * px
  const top = 14 * px
  const gridTop = top + 12 * px
  const width = page.canvas.width - marginX * 2
  const height = page.canvas.height - gridTop - 12 * px

  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = `700 ${Math.round(6.5 * px)}px ${font}`
  ctx.fillText(t.title, page.canvas.width / 2, top)

  const days = columnOrder(t.days, rtl)
  // The row-label column sits on the side the reader starts from.
  const labelW = 26 * px
  const cellW = (width - labelW) / days.length
  const rowH = height / (t.slots.length + 1)
  const gridLeft = marginX + (rtl ? 0 : labelW)
  const labelLeft = rtl ? marginX + width - labelW : marginX

  ctx.font = `600 ${Math.round(3.6 * px)}px ${font}`
  ctx.textBaseline = 'middle'

  // Header row.
  ctx.fillStyle = HEAD
  ctx.fillRect(marginX, gridTop, width, rowH)
  ctx.fillStyle = INK
  days.forEach((d, i) => {
    ctx.fillText(DAY_LABEL[d][locale], gridLeft + cellW * (i + 0.5), gridTop + rowH / 2)
  })

  ctx.font = `${Math.round(3.4 * px)}px ${font}`
  t.slots.forEach((slot, r) => {
    const y = gridTop + rowH * (r + 1)
    ctx.fillStyle = INK
    ctx.fillText(slot.label, labelLeft + labelW / 2, y + rowH / 2)
    days.forEach((d, i) => {
      const text = (slot.cells[d] ?? '').trim()
      if (text) ctx.fillText(text, gridLeft + cellW * (i + 0.5), y + rowH / 2)
    })
  })

  // Rules last, so the text never sits on top of a line.
  ctx.strokeStyle = RULE
  ctx.lineWidth = Math.max(1, 0.3 * px)
  for (let r = 0; r <= t.slots.length + 1; r++) {
    const y = gridTop + rowH * r
    ctx.beginPath(); ctx.moveTo(marginX, y); ctx.lineTo(marginX + width, y); ctx.stroke()
  }
  for (let c = 0; c <= days.length; c++) {
    const x = gridLeft + cellW * c
    ctx.beginPath(); ctx.moveTo(x, gridTop); ctx.lineTo(x, gridTop + rowH * (t.slots.length + 1)); ctx.stroke()
  }
  const edge = rtl ? marginX + width : marginX
  ctx.beginPath(); ctx.moveTo(edge, gridTop); ctx.lineTo(edge, gridTop + rowH * (t.slots.length + 1)); ctx.stroke()

  return pagesToPdf([page])
}
