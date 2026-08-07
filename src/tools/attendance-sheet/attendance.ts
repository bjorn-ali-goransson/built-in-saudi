import { A4, A4_LANDSCAPE, newPage, pagesToPdf, type Page } from '../../lib/printPdf'
import { formatHijri } from '../prayer-times/islamic'

// Attendance and mark sheets.
//
// The detail every generic register gets wrong here is the week. The Saudi
// school week runs Sunday to Thursday, so a sheet built on the Anglo assumption
// of a Saturday-Sunday weekend prints two columns nobody will ever tick and
// leaves out two teaching days. The weekend is therefore a setting, defaulted to
// Friday and Saturday rather than hard-coded either way.

export type Mode = 'dates' | 'sessions' | 'custom'

export interface SheetOptions {
  names: string[]
  mode: Mode
  start: string
  columns: number
  /** Day numbers (0 = Sunday) that are not school days. */
  weekend: number[]
  customHeadings: string
  total: boolean
  hijri: boolean
  landscape: boolean
  title: string
}

export const DEFAULTS: SheetOptions = {
  names: [],
  mode: 'dates',
  start: '',
  columns: 10,
  weekend: [5, 6], // Friday, Saturday
  customHeadings: '',
  total: true,
  hijri: false,
  landscape: true,
  title: '',
}

export interface Column { label: string; sub: string; date: Date | null }

export function columnsFor(o: SheetOptions, locale: 'en' | 'ar'): Column[] {
  const n = Math.max(1, Math.min(40, o.columns))
  if (o.mode === 'custom') {
    const parts = o.customHeadings.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)
    return (parts.length ? parts : Array.from({ length: n }, (_, i) => `${i + 1}`))
      .slice(0, 40)
      .map((label) => ({ label, sub: '', date: null }))
  }
  if (o.mode === 'sessions') {
    return Array.from({ length: n }, (_, i) => ({ label: String(i + 1), sub: '', date: null }))
  }

  const out: Column[] = []
  const d = new Date(`${o.start || new Date().toISOString().slice(0, 10)}T12:00:00`)
  if (isNaN(d.getTime())) return []
  let guard = 0
  while (out.length < n && guard++ < 400) {
    if (!o.weekend.includes(d.getDay())) {
      out.push({
        label: String(d.getDate()),
        sub: o.hijri
          ? formatHijri(d, locale)
          : d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { month: 'short' }),
        date: new Date(d),
      })
    }
    d.setDate(d.getDate() + 1)
  }
  return out
}

const INK = '#1a1a1a'
const FAINT = '#8a8a8a'

export async function buildSheetPdf(
  names: string[],
  cols: Column[],
  o: SheetOptions,
  labels: { title: string; name: string; no: string; total: string; teacher: string },
  locale: 'en' | 'ar',
): Promise<Blob> {
  const size = o.landscape ? A4_LANDSCAPE : A4
  const rtl = locale === 'ar'
  const perPage = o.landscape ? 22 : 34
  const pages: Page[] = []

  for (let p = 0; p < Math.max(1, Math.ceil(names.length / perPage)); p++) {
    const page = newPage(size)
    const { ctx, px } = page
    const slice = names.slice(p * perPage, (p + 1) * perPage)
    const M = 12
    const right = page.wMm - M

    ctx.direction = rtl ? 'rtl' : 'ltr'
    ctx.textAlign = rtl ? 'right' : 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = INK
    ctx.font = `600 ${Math.round(6 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
    ctx.fillText(o.title || labels.title, rtl ? right * px : M * px, 8 * px)
    ctx.fillStyle = FAINT
    ctx.font = `400 ${Math.round(3.2 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
    ctx.fillText(`${labels.teacher} ______________________`, rtl ? right * px : M * px, 16 * px)

    const top = 24
    const noW = 8
    const nameW = o.landscape ? 46 : 40
    const totalW = o.total ? 14 : 0
    const gridW = page.wMm - M * 2 - noW - nameW - totalW
    const colW = cols.length ? gridW / cols.length : gridW
    const rowH = Math.min(8, (page.hMm - top - 18) / Math.max(slice.length + 1, 1))

    // Header row.
    ctx.strokeStyle = '#bbbbbb'
    ctx.lineWidth = Math.max(1, 0.25 * px)
    const xOf = (i: number) => M + noW + nameW + i * colW
    ctx.textAlign = 'center'
    ctx.fillStyle = FAINT
    ctx.font = `500 ${Math.round(2.7 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
    cols.forEach((c, i) => {
      ctx.fillText(c.label, (xOf(i) + colW / 2) * px, (top + 1) * px, colW * px)
      if (c.sub) ctx.fillText(c.sub, (xOf(i) + colW / 2) * px, (top + 4) * px, colW * px)
    })
    if (o.total) ctx.fillText(labels.total, (M + noW + nameW + gridW + totalW / 2) * px, (top + 2.5) * px, totalW * px)

    // Rows.
    ctx.textAlign = rtl ? 'right' : 'left'
    slice.forEach((name, r) => {
      const y = top + 8 + r * rowH
      ctx.fillStyle = FAINT
      ctx.font = `400 ${Math.round(2.9 * px)}px "Hanken Grotesk", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(String(p * perPage + r + 1), (M + noW / 2) * px, (y + rowH / 2 - 1.5) * px)

      ctx.fillStyle = INK
      ctx.direction = /[؀-ۿ]/.test(name) ? 'rtl' : 'ltr'
      ctx.textAlign = /[؀-ۿ]/.test(name) ? 'right' : 'left'
      ctx.font = `400 ${Math.round(3.2 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
      const nx = /[؀-ۿ]/.test(name) ? (M + noW + nameW - 2) : (M + noW + 2)
      ctx.fillText(name, nx * px, (y + rowH / 2 - 1.7) * px, (nameW - 4) * px)

      ctx.strokeStyle = '#dddddd'
      ctx.beginPath()
      ctx.moveTo(M * px, (y + rowH) * px)
      ctx.lineTo((page.wMm - M) * px, (y + rowH) * px)
      ctx.stroke()
    })

    // Vertical rules for the tick columns.
    ctx.strokeStyle = '#cccccc'
    const gridTop = top
    const gridBottom = top + 8 + slice.length * rowH
    for (let i = 0; i <= cols.length; i++) {
      const x = xOf(i) * px
      ctx.beginPath(); ctx.moveTo(x, gridTop * px); ctx.lineTo(x, gridBottom * px); ctx.stroke()
    }
    if (o.total) {
      const x = (M + noW + nameW + gridW + totalW) * px
      ctx.beginPath(); ctx.moveTo(x, gridTop * px); ctx.lineTo(x, gridBottom * px); ctx.stroke()
    }
    // Box the whole table so the header row is closed at the top.
    ctx.strokeRect(M * px, gridTop * px, (page.wMm - M * 2) * px, (gridBottom - gridTop) * px)
    ctx.beginPath()
    ctx.moveTo(M * px, (top + 8) * px)
    ctx.lineTo((page.wMm - M) * px, (top + 8) * px)
    ctx.stroke()

    pages.push(page)
  }

  return pagesToPdf(pages)
}
