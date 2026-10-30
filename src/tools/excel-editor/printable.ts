// The sheet as printed pages: its used range as a table at the column widths and
// row heights the author set, with merged cells, cell formatting and gridlines,
// laid out by the shared paginator. Wider than a portrait page turns the page
// landscape; wider than that scales it down — Excel's "fit all columns on one
// page", which is what almost everybody printing a sheet wants.
import { paginate, MM, type Printable, type Running } from '../../components/office/print'
import { cellKey, parseRange, validRuns, type SheetData, type SheetPrint, type CellValue } from './engine/model'
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
  // Gridlines print only when the sheet says so ("Print gridlines"), as in Excel — not because they show on screen.
  let body = `<table class="xp${sheet.print?.gridLines ? ' grid' : ''}" style="width:${width}px"><colgroup>${visCols.map((c) => `<col style="width:${sheet.colWidths?.[c] ?? DEFAULT_COL_W}px">`).join('')}</colgroup>`
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

const PAPER: Record<number, [number, number]> = { 1: [215.9, 279.4], 5: [215.9, 355.6], 8: [297, 420], 9: [210, 297], 11: [148, 210] }

/**
 * Excel's header and footer codes as text: &L, &C and &R start the three parts; &P and &N are the
 * page and the page count; &D, &T, &A and &F the date, time, sheet and file; font, size, colour and
 * on/off codes are dropped, and && is a literal ampersand.
 */
export function excelRunning(code: string | undefined, sheet: string, title: string): Running | undefined {
  if (!code) return undefined
  const parts: Record<'l' | 'c' | 'r', string> = { l: '', c: '', r: '' }
  let cur: 'l' | 'c' | 'r' = 'c'
  const now = new Date()
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (ch !== '&') { parts[cur] += ch; continue }
    const n = code[i + 1]
    if (n === undefined) break
    if (n === '&') { parts[cur] += '&'; i++; continue }
    if (n === '"') { const end = code.indexOf('"', i + 2); i = end < 0 ? code.length : end; continue }
    if (/\d/.test(n)) { while (/\d/.test(code[i + 1] || '')) i++; continue }
    if (n === 'K') { i += /^[0-9A-Fa-f]{6}/.test(code.slice(i + 2)) ? 7 : 5; continue }
    i++
    if (n === 'L' || n === 'C' || n === 'R') cur = n.toLowerCase() as 'l' | 'c' | 'r'
    else if (n === 'P') parts[cur] += '{page}'
    else if (n === 'N') parts[cur] += '{pages}'
    else if (n === 'D') parts[cur] += now.toLocaleDateString()
    else if (n === 'T') parts[cur] += now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    else if (n === 'A') parts[cur] += sheet
    else if (n === 'F') parts[cur] += title
  }
  return parts.l || parts.c || parts.r ? (parts.l || parts.r ? parts : parts.c) : undefined
}

export async function printable(sheet: SheetData, value: (r: number, c: number) => CellValue, title: string): Promise<Printable> {
  const { body, width } = sheetHtml(sheet, value)
  const p: SheetPrint = sheet.print || {}
  const IN = 25.4
  const margins = p.margins ? { top: p.margins.t * IN, right: p.margins.r * IN, bottom: p.margins.b * IN, left: p.margins.l * IN } : { top: 15, right: 12, bottom: 15, left: 12 }
  const [pw, ph] = PAPER[p.paper || 9] || PAPER[9]
  const portraitW = (pw - margins.left - margins.right) * MM
  return paginate({
    title, css: SHEET_CSS, body, dir: sheet.rtl ? 'rtl' : 'ltr',
    // The sheet's own setup where it has one; otherwise what almost everybody wants: all the columns on the page.
    fitWidth: p.fit ? p.fit.w > 0 : !p.scale,
    scale: p.fit ? undefined : p.scale ? p.scale / 100 : undefined,
    page: { width: pw, height: ph, landscape: p.landscape ?? (!sheet.print && width > portraitW * 1.05), margins },
    header: excelRunning(p.header, sheet.name, title),
    footer: sheet.print ? excelRunning(p.footer, sheet.name, title) : '{page} / {pages}',
  })
}
