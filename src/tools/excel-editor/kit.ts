// How the spreadsheet editor reads and writes files. Every conversion runs in
// the shared office worker, so a 20MB workbook unzips without freezing the page.
import { office } from '../../lib/office/officeClient'
import type { EditorKit } from '../../components/office/hooks'
import type { SheetData, WorkbookData } from './engine/model'
import { lossText, XL_STR } from './strings'
import { blankSheet } from './doc'
import { Workbook } from './engine/workbook'
import { cellLook } from './ui/cellStyle'

type Loss = { what: string; count: number }

const extOf = (n: string) => (n.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase()

export function excelKit(locale: 'en' | 'ar'): EditorKit<WorkbookData> {
  const s = XL_STR[locale]
  return {
    kind: 'excel',
    tool: 'excel-editor',
    formats: [{ ext: '.xlsx', label: s.xlsx }, { ext: '.ods', label: s.ods }, { ext: '.csv', label: s.csvSheet }],
    accepts: ['.xlsx', '.xlsm', '.ods', '.csv', '.tsv', '.txt'],
    blank: () => ({ sheets: [blankSheet(s.sheetN(1))], names: [] }),
    async exportAs(book, ext, title) {
      if (ext === '.csv') {
        const sheet = book.sheets[Math.min(book.active || 0, book.sheets.length - 1)]?.name || book.sheets[0].name
        const text = await office<string>('csv-write', { data: book, opts: { sheet, delimiter: ',' } })
        // A byte-order mark, so Excel opens Arabic as Arabic rather than mojibake.
        return { blob: new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), loss: book.sheets.length > 1 ? [locale === 'ar' ? 'الأوراق الأخرى (CSV يحمل ورقة واحدة)' : 'the other sheets (a CSV holds one sheet)'] : [] }
      }
      const r = await office<{ blob: Blob; loss: Loss[] }>(ext === '.ods' ? 'ods-write' : 'xlsx-write', { data: book, opts: { title } })
      return { blob: r.blob, loss: r.loss.map((l) => lossText(l, locale)) }
    },
    async importFile(file) {
      const buf = await file.arrayBuffer()
      const ext = extOf(file.name)
      const op = ext === '.ods' ? 'ods-read' : ext === '.csv' || ext === '.tsv' || ext === '.txt' ? 'csv-read' : 'xlsx-read'
      const r = await office<{ book: WorkbookData; loss: Loss[]; title?: string }>(op, { buf, opts: { name: file.name.replace(/\.[^.]+$/, '').slice(0, 31) || 'Sheet1' } })
      return { data: r.book, loss: r.loss.map((l) => lossText(l, locale)), title: r.title }
    },
    thumb: (book) => thumbnail(book),
    async renderThumb(book) {
      const [{ printable }, { pageThumbnail }] = await Promise.all([import('./printable'), import('../../components/office/print')])
      const sheet = book.sheets[book.active || 0] || book.sheets[0]
      if (!sheet) return undefined
      const wb = new Workbook(book.sheets, book.names || [])
      return pageThumbnail(await printable(sheet, (r, c) => wb.value(sheet.name, { row: r, col: c }), 'sheet'))
    },
  }
}

/** A tiny picture of the first sheet's top-left corner, for the library. */
export function thumbnail(book: WorkbookData): string | undefined {
  const sheet = book.sheets[book.active || 0] || book.sheets[0]
  if (!sheet) return undefined
  let wb: Workbook
  try { wb = new Workbook([sheet], book.names || []) } catch { return undefined }
  const W = 240
  const H = 180
  const cw = 60
  const rh = 18
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/>`
  for (let r = 0; r <= H / rh; r++) svg += `<line x1="0" x2="${W}" y1="${r * rh}" y2="${r * rh}" stroke="#e3e6e3"/>`
  for (let c = 0; c <= W / cw; c++) svg += `<line y1="0" y2="${H}" x1="${c * cw}" x2="${c * cw}" stroke="#e3e6e3"/>`
  for (let r = 0; r < H / rh; r++) for (let c = 0; c < W / cw; c++) {
    const cell = sheet.cells[`${r},${c}`]
    if (!cell) continue
    const look = cellLook(wb.value(sheet.name, { row: r, col: c }), cell.fmt, { zoom: 1 })
    if (cell.fmt?.bg) svg += `<rect x="${c * cw}" y="${r * rh}" width="${cw}" height="${rh}" fill="${esc(cell.fmt.bg)}"/>`
    if (look.text) svg += `<text x="${c * cw + 3}" y="${r * rh + 13}" font-size="10" font-family="sans-serif" fill="${esc(cell.fmt?.color || '#222')}"${cell.fmt?.bold ? ' font-weight="700"' : ''}>${esc(look.text.slice(0, 10))}</text>`
  }
  svg += '</svg>'
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

export function sheetsOf(book: WorkbookData): SheetData[] { return book.sheets }
