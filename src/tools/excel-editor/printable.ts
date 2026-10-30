// The sheet as printed pages: its used range as a table at the column widths and
// row heights the author set, with merged cells, cell formatting and gridlines,
// laid out by the shared paginator. Wider than a portrait page turns the page
// landscape; wider than that scales it down — Excel's "fit all columns on one
// page", which is what almost everybody printing a sheet wants.
import { paginate, MM, type Printable } from '../../components/office/print'
import { cellKey, parseRange, validRuns, type SheetData, type CellValue } from './engine/model'
import { tableBoxes, tableLookAt } from './ui/tableStyle'
import { runCss } from './ui/runs'
import { cellLook } from './ui/cellStyle'
import { DEFAULT_COL_W, DEFAULT_ROW_H } from './ui/geometry'
import type { CSSProperties } from 'react'

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function css(st: CSSProperties): string {
  return Object.entries(st).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${String(v).replace(/[<>"]/g, '')}`).join(';')
}
const A1 = /^([A-Z]+)(\d+)$/
function rc(a: string): { row: number; col: number } | null {
  const m = A1.exec(a.replace(/\$/g, '').toUpperCase())
  if (!m) return null
  let col = 0
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { row: +m[2] - 1, col: col - 1 }
}

export function sheetHtml(sheet: SheetData, value: (r: number, c: number) => CellValue): { body: string; width: number } {
  let rows = 0
  let cols = 0
  for (const k of Object.keys(sheet.cells)) { const [r, c] = k.split(',').map(Number); rows = Math.max(rows, r + 1); cols = Math.max(cols, c + 1) }
  for (const im of sheet.images || []) { rows = Math.max(rows, im.anchor.row + 1); cols = Math.max(cols, im.anchor.col + 1) }
  rows = Math.min(rows, 20000)
  cols = Math.min(cols, 256)
  const hiddenR = new Set(sheet.hiddenRows || [])
  const hiddenC = new Set(sheet.hiddenCols || [])
  // A merge: the top-left cell spans, the rest are not drawn.
  const span = new Map<string, { rs: number; cs: number }>()
  const covered = new Set<string>()
  for (const m of sheet.merges || []) {
    const [a, b] = m.split(':').map(rc)
    if (!a || !b) continue
    span.set(cellKey(a.row, a.col), { rs: b.row - a.row + 1, cs: b.col - a.col + 1 })
    for (let r = a.row; r <= b.row; r++) for (let c = a.col; c <= b.col; c++) if (r !== a.row || c !== a.col) covered.add(cellKey(r, c))
  }
  const tables = tableBoxes(sheet.tables, parseRange)
  const visCols = Array.from({ length: cols }, (_, c) => c).filter((c) => !hiddenC.has(c))
  const width = visCols.reduce((w, c) => w + (sheet.colWidths?.[c] ?? DEFAULT_COL_W), 0)
  let body = `<table class="xp${sheet.showGrid === false ? '' : ' grid'}" style="width:${width}px"><colgroup>${visCols.map((c) => `<col style="width:${sheet.colWidths?.[c] ?? DEFAULT_COL_W}px">`).join('')}</colgroup>`
  for (let r = 0; r < rows; r++) {
    if (hiddenR.has(r)) continue
    body += `<tr style="height:${sheet.rowHeights?.[r] ?? DEFAULT_ROW_H}px">`
    for (const c of visCols) {
      const k = cellKey(r, c)
      if (covered.has(k)) continue
      const cell = sheet.cells[k]
      const sp = span.get(k)
      const attrs = sp ? `${sp.cs > 1 ? ` colspan="${sp.cs}"` : ''}${sp.rs > 1 ? ` rowspan="${sp.rs}"` : ''}` : ''
      const tl = tables.length ? tableLookAt(tables, r, c) : null
      const tcss: CSSProperties = tl ? { background: tl.bg, color: tl.color, fontWeight: tl.bold ? 700 : undefined, borderTop: tl.borderTop, borderBottom: tl.borderBottom } : {}
      if (!cell) { body += `<td${attrs}${tl ? ` style="${css(tcss)}"` : ''}></td>`; continue }
      const v = value(r, c)
      const look = cellLook(v, cell.fmt, { zoom: 1 })
      const st: CSSProperties = { ...tcss, ...look.style, textAlign: look.align }
      if (cell.fmt?.wrap) st.whiteSpace = 'pre-wrap'
      const runs = typeof v === 'string' ? validRuns(cell.fmt, look.text) : null
      const inner = runs ? runs.map((x) => `<span style="${css(runCss(x))}">${esc(x.t)}</span>`).join('') : esc(look.text)
      body += `<td${attrs} style="${css(st)}" dir="auto">${inner}</td>`
    }
    body += '</tr>'
  }
  body += '</table>'
  return { body, width }
}

const SHEET_CSS = `body{font-family:"IBM Plex Sans Arabic",Calibri,Arial,sans-serif;font-size:10pt;color:#111}
table.xp{border-collapse:collapse;table-layout:fixed}
table.xp td{padding:1px 4px;overflow:hidden;white-space:pre;vertical-align:bottom;box-sizing:border-box}
table.xp.grid td{border:1px solid #d4d4d4}`

export async function printable(sheet: SheetData, value: (r: number, c: number) => CellValue, title: string): Promise<Printable> {
  const { body, width } = sheetHtml(sheet, value)
  const margins = { top: 15, right: 12, bottom: 15, left: 12 }
  const portraitW = (210 - margins.left - margins.right) * MM
  return paginate({
    title, css: SHEET_CSS, body, dir: sheet.rtl ? 'rtl' : 'ltr', fitWidth: true,
    page: { width: 210, height: 297, landscape: width > portraitW * 1.05, margins },
    footer: '{page} / {pages}',
  })
}
