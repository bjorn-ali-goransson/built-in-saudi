// OpenDocument spreadsheets (.ods) — LibreOffice's native format, and what a lot
// of government and university machines save by default.
//
// Read-only, and stated as such: the export is .xlsx, which LibreOffice opens.
// Three things the format does differently from .xlsx, all of which otherwise
// corrupt the import quietly:
//
// - **Repetition.** An empty run of 1,000 columns is ONE element with
//   `number-columns-repeated="1000"`, and a sheet commonly ends in a row
//   repeated 1,048,000 times. Expanding naively allocates a million rows; a
//   repeated EMPTY cell or row is skipped, and repeated content is capped.
// - **Formulas are OpenFormula**, `of:=SUM([.A1:.B2])` with sheet references as
//   `[$Sheet2.A1]`. The brackets and dots are rewritten to Excel syntax.
// - **Values are typed by attribute**, not by the text: the visible text of a
//   date cell is "07/09/26", its value is in `office:date-value`.
import { unzipText } from './unzip-text'
import { parseXml, kids, attr, textOf, type XEl } from '../../../lib/xml'
import { cellKey, type SheetData, type WorkbookData } from '../engine/model'
import { dateToSerial } from '../engine/dates'
import { textInput } from './xlsx-read'

const T = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0'
const O = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0'
const TX = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'

/** OpenFormula → Excel formula text. */
export function fromOpenFormula(f: string): string {
  let s = f.replace(/^(of|oooc|msoxl):/, '').replace(/^=/, '')
  // [$'Sheet 2'.A1:.B3] / [.A1] / [$Sheet2.$A$1]
  s = s.replace(/\[([^\]]+)\]/g, (_m, inner: string) => {
    return inner.split(':').map((part, i) => {
      const m = /^\$?(?:'((?:[^']|'')+)'|([^.]*))?\.(.+)$/.exec(part)
      if (!m) return part
      const sheet = m[1] ?? m[2]
      const ref = m[3]
      if (i > 0) return ref
      return sheet ? `${/^[A-Za-z_][\w.]*$/.test(sheet) ? sheet : `'${sheet}'`}!${ref}` : ref
    }).join(':')
  })
  // OpenFormula separates arguments with ';'.
  let out = ''
  let q = false
  for (const ch of s) {
    if (ch === '"') q = !q
    out += !q && ch === ';' ? ',' : ch
  }
  return out
}

export async function readOds(buf: ArrayBuffer): Promise<{ book: WorkbookData; loss: { what: string; count: number }[] }> {
  const parts = await unzipText(buf, (n) => n === 'content.xml' || n === 'mimetype')
  const mt = parts.get('mimetype')
  if (mt !== undefined && !/opendocument\.spreadsheet/.test(mt)) throw new Error('not-ods')
  const xml = parts.get('content.xml')
  if (!xml) throw new Error('not-ods')
  const root = parseXml(xml)
  const body = kids(root, O, 'body')[0]
  const ss = kids(body, O, 'spreadsheet')[0]
  const sheets: SheetData[] = []
  let capped = 0
  for (const table of kids(ss, T, 'table')) {
    const name = attr(table, 'name', T) || `Sheet${sheets.length + 1}`
    const cells: SheetData['cells'] = {}
    const merges: string[] = []
    let r = 0
    let maxC = 0
    const rows = collectRows(table)
    for (const row of rows) {
      const rep = Math.min(Number(attr(row, 'number-rows-repeated', T) || 1), 10_000)
      const cellEls = kids(row).filter((c) => c.ns === T && (c.local === 'table-cell' || c.local === 'covered-table-cell'))
      const empty = cellEls.every((c) => !c.children.length && !attr(c, 'value-type', O) && !attr(c, 'formula', T))
      if (empty) { r += Number(attr(row, 'number-rows-repeated', T) || 1); continue }
      if (rep > 1) capped++
      for (let k = 0; k < rep; k++) {
        let c = 0
        for (const cell of cellEls) {
          const crep = Number(attr(cell, 'number-columns-repeated', T) || 1)
          const input = cellInput(cell)
          if (cell.local === 'table-cell' && (input !== '')) {
            for (let j = 0; j < Math.min(crep, 1000); j++) {
              cells[cellKey(r, c + j)] = { input }
              maxC = Math.max(maxC, c + j + 1)
            }
            const span = Number(attr(cell, 'number-columns-spanned', T) || 1)
            const rspan = Number(attr(cell, 'number-rows-spanned', T) || 1)
            if (span > 1 || rspan > 1) merges.push(`${col(c)}${r + 1}:${col(c + span - 1)}${r + rspan}`)
          }
          c += crep
        }
        r++
      }
    }
    sheets.push({ name, cells, rows: Math.max(100, r + 20), cols: Math.max(26, maxC + 4), merges: merges.length ? merges : undefined })
  }
  return { book: { sheets: sheets.length ? sheets : [{ name: 'Sheet1', cells: {}, rows: 100, cols: 26 }] }, loss: [{ what: 'styles from OpenDocument files (values and formulas only)', count: 1 }, ...(capped ? [{ what: 'very long repeated rows (capped)', count: capped }] : [])].filter((l) => l.count) }
}

function collectRows(table: XEl): XEl[] {
  const out: XEl[] = []
  for (const c of kids(table)) {
    if (c.ns !== T) continue
    if (c.local === 'table-row') out.push(c)
    else if (c.local === 'table-rows' || c.local === 'table-header-rows' || c.local === 'table-row-group') out.push(...collectRows(c))
  }
  return out
}

function col(n: number): string { let s = ''; let x = n; do { s = String.fromCharCode(65 + (x % 26)) + s; x = Math.floor(x / 26) - 1 } while (x >= 0); return s }

function cellInput(cell: XEl): string {
  const f = attr(cell, 'formula', T)
  if (f) return '=' + fromOpenFormula(f)
  const type = attr(cell, 'value-type', O)
  switch (type) {
    case 'float': case 'percentage': case 'currency': return attr(cell, 'value', O) || ''
    case 'boolean': return attr(cell, 'boolean-value', O) === 'true' ? 'TRUE' : 'FALSE'
    case 'date': {
      const v = attr(cell, 'date-value', O) || ''
      const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/.exec(v)
      if (!m) return v
      const day = dateToSerial(+m[1], +m[2], +m[3])
      const t = m[4] ? (+m[4] * 3600 + +m[5] * 60 + +m[6]) / 86400 : 0
      return String(day + t)
    }
    case 'time': {
      const m = /PT(\d+)H(\d+)M(\d+(?:\.\d+)?)S/.exec(attr(cell, 'time-value', O) || '')
      return m ? String((+m[1] * 3600 + +m[2] * 60 + +m[3]) / 86400) : ''
    }
  }
  const text = kids(cell, TX, 'p').map(textOf).join('\n')
  return text ? textInput(text) : ''
}
