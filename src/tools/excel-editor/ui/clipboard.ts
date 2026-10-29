// Copy and paste, inside the sheet and with the rest of the world.
//
// The system clipboard carries two things at once: tab-separated text, which is
// what every other program pastes, and an HTML table carrying OUR cells (inputs
// and formats) in a data attribute. Pasting back into a sheet reads the table
// first, so a copied formula pastes as a formula rather than as the number it
// showed — and a paste from Excel or a web page reads its HTML table.
import { shiftFormula } from '../engine/formula'
import { decodeEntities } from '../../../lib/xml'
import type { CellFormat } from '../engine/model'
import type { CellPatch } from '../doc'

export interface ClipCell { r: number; c: number; input: string; fmt?: CellFormat }
/** `o` is where the block came from — a formula pasted elsewhere shifts by the distance moved. */
export interface ClipPayload { v: 1; rows: number; cols: number; cells: ClipCell[]; o?: [number, number]; cut?: { sheet: string } }

const needsQuote = /[\t\n\r"]/

export function toTsv(rows: string[][]): string {
  return rows.map((r) => r.map((v) => (needsQuote.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join('\t')).join('\n')
}

/** Tab-separated text, with quoted cells that may contain tabs, newlines and quotes. */
export function parseTsv(text: string): string[][] {
  const s = text.replace(/\r\n?/g, '\n').replace(/\n$/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let i = 0
  let quoted = false
  let start = true
  while (i < s.length) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 2; continue }
        quoted = false; i++; continue
      }
      cell += ch; i++; continue
    }
    if (start && ch === '"') { quoted = true; start = false; i++; continue }
    start = false
    if (ch === '\t') { row.push(cell); cell = ''; start = true; i++; continue }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; start = true; i++; continue }
    cell += ch; i++
  }
  row.push(cell)
  rows.push(row)
  return rows
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
const unb64 = (s: string) => decodeURIComponent(escape(atob(s)))

export function toHtml(rows: string[][], payload: ClipPayload): string {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')
  return `<table data-bis-cells="${b64(JSON.stringify(payload))}">${body}</table>`
}

/** Our own payload, when the HTML came from a sheet on this site. */
export function readPayload(html: string): ClipPayload | null {
  const m = html.match(/data-bis-cells="([A-Za-z0-9+/=]+)"/)
  if (!m) return null
  try {
    const p = JSON.parse(unb64(m[1])) as ClipPayload
    return p && p.v === 1 && Array.isArray(p.cells) ? p : null
  } catch { return null }
}

/** Rows of text out of the first HTML table, for a paste from Excel, Sheets or a web page. */
export function parseHtmlTable(html: string): string[][] | null {
  const t = html.match(/<table[\s\S]*?<\/table>/i)
  if (!t) return null
  const rows: string[][] = []
  for (const tr of t[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row: string[] = []
    for (const td of tr[1].matchAll(/<t([dh])([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
      const text = decodeEntities(td[3].replace(/&nbsp;/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/ /g, ' ').trim()
      row.push(text)
      const span = td[2].match(/colspan\s*=\s*["']?(\d+)/i)
      for (let k = 1; k < (span ? Math.min(+span[1], 50) : 1); k++) row.push('')
    }
    rows.push(row)
  }
  return rows.length ? rows : null
}

/**
 * The cells a paste writes. A formula moves with the paste — `=A1` copied one
 * row down becomes `=A2`, the way every spreadsheet behaves — except after a CUT,
 * where the cells are moved rather than duplicated and keep pointing where they
 * pointed. A selection that is a whole multiple of the copied block is tiled
 * (copy one cell, select a column, paste: the column is filled).
 */
export function pastePatches(p: ClipPayload, at: { row: number; col: number }, sel?: { rows: number; cols: number }, opts: { valuesOnly?: boolean; formatsOnly?: boolean; values?: (c: ClipCell) => string } = {}): CellPatch[] {
  const tr = sel && sel.rows % p.rows === 0 && sel.rows > p.rows ? sel.rows / p.rows : 1
  const tc = sel && sel.cols % p.cols === 0 && sel.cols > p.cols ? sel.cols / p.cols : 1
  const out: CellPatch[] = []
  const filled = new Map<string, ClipCell>()
  for (const c of p.cells) filled.set(`${c.r},${c.c}`, c)
  for (let ti = 0; ti < tr; ti++) for (let tj = 0; tj < tc; tj++) {
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
      const src = filled.get(`${r},${c}`)
      const row = at.row + ti * p.rows + r
      const col = at.col + tj * p.cols + c
      if (row < 0 || col < 0) continue
      if (opts.formatsOnly) { out.push({ r: row, c: col, fmt: src?.fmt ? { ...src.fmt } : null }); continue }
      let input = src?.input ?? ''
      if (opts.valuesOnly && src) input = opts.values ? opts.values(src) : input
      else if (input.startsWith('=') && !p.cut && p.o) input = shiftFormula(input, row - (p.o[0] + r), col - (p.o[1] + c))
      const patch: CellPatch = { r: row, c: col, input }
      if (!opts.valuesOnly) patch.fmt = src?.fmt ? { ...src.fmt } : null
      out.push(patch)
    }
  }
  return out
}

/** A plain grid of text as a payload, so external pastes go through the same path. */
export function textPayload(rows: string[][]): ClipPayload {
  const cells: ClipCell[] = []
  let cols = 0
  rows.forEach((row, r) => { cols = Math.max(cols, row.length); row.forEach((v, c) => { if (v !== '') cells.push({ r, c, input: v }) }) })
  return { v: 1, rows: rows.length, cols: Math.max(1, cols), cells }
}
