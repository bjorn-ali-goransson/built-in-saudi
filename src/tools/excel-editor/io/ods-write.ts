// The editor's workbook → .ods (OpenDocument spreadsheet). Runs in a Web Worker.
//
// For LibreOffice Calc and the many government and university machines that
// save .ods by default — so a sheet can go back to where it came from in the
// format it arrived in. Built the way xlsx-write.ts is: generated from the
// model, never patched into somebody's file, and RECALCULATED here so every
// formula carries its value for a reader that does not recalculate.
//
// What the format insists on, each of which otherwise gives a file Calc calls
// corrupt or opens wrong:
//
// - **`mimetype` is the FIRST entry and STORED**, exactly as in an EPUB: it is
//   how a reader identifies the package without inflating anything.
// - **Every cell in a row is written, in order.** There are no addresses in ODF;
//   a cell's column is its position, so a gap is an empty cell with
//   `number-columns-repeated`, and a merge's hidden cells are explicit
//   `covered-table-cell`s — leave them out and every cell after a merge shifts.
// - **Formulas are OpenFormula** (`openformula.ts`), with `;` between
//   arguments and references in brackets. Writing Excel syntax gives `Err:508`
//   in every formula cell.
// - **A cell's TYPE is an attribute.** A date is `office:value-type="date"` with
//   an ISO `office:date-value`; written as a float it opens as 46275.
import { zipFile } from '../../../lib/zip'
import { x, xmlDoc, type Xml, type XChild } from '../../../lib/xml'
import { Workbook } from '../engine/workbook'
import { isError, parseRange, borderSides, type Cell, type CellFormat, type CellValue, type SheetData, type WorkbookData } from '../engine/model'
import { formatCell } from '../engine/numfmt'
import { serialToParts } from '../engine/dates'
import { DEFAULT_COL_W, DEFAULT_ROW_H } from '../ui/geometry'
import { toOpenFormula } from './openformula'

const MIME = 'application/vnd.oasis.opendocument.spreadsheet'
const NSA: Record<string, string> = {
  'xmlns:office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  'xmlns:style': 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  'xmlns:text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  'xmlns:table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  'xmlns:fo': 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  'xmlns:number': 'urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0',
  'xmlns:xlink': 'http://www.w3.org/1999/xlink',
  'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
  'xmlns:meta': 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0',
  'xmlns:of': 'urn:oasis:names:tc:opendocument:xmlns:of:1.2',
  'xmlns:config': 'urn:oasis:names:tc:opendocument:xmlns:config:1.0',
  'xmlns:tableooo': 'http://openoffice.org/2009/table',
  'office:version': '1.3',
}
/** Screen pixels → points, the unit the file is written in. */
const pt = (px: number) => `${Math.round(px * 0.75 * 100) / 100}pt`
const css = (c: string | undefined) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : c && /^#[0-9a-f]{3}$/i.test(c) ? '#' + c.slice(1).split('').map((d) => d + d).join('').toLowerCase() : undefined)

export interface OdsExport { blob: Blob; loss: { what: string; count: number }[] }

/** Number formats as ODF data styles, named N<n>, shared by every cell that uses one. */
class DataStyles {
  styles = new Map<string, { name: string; xml: Xml }>()
  constructor(private lose: (w: string) => void) {}
  /** The data style for a cell's format, and the value type it implies. */
  of(f: CellFormat | undefined): { name?: string; type: 'float' | 'percentage' | 'date' } {
    if (!f) return { type: 'float' }
    const code = f.numCode ? simpleCode(f.numCode) : null
    if (f.numCode && !code) { this.lose('number formats this file cannot describe (shown as plain numbers)'); return { type: 'float' } }
    const kind = code?.kind ?? f.numFmt
    const dec = code?.decimals ?? f.decimals
    const num = (d: number, group: boolean) => x('number:number', { 'number:decimal-places': d, 'number:min-decimal-places': d, 'number:min-integer-digits': 1, 'number:grouping': group || undefined })
    switch (kind) {
      case 'number': return this.add(`n:${dec ?? 2}`, 'number:number-style', [num(dec ?? 2, false)], 'float')
      case 'thousands': return this.add(`t:${dec ?? 0}`, 'number:number-style', [num(dec ?? 0, true)], 'float')
      case 'percent': return this.add(`p:${dec ?? 0}`, 'number:percentage-style', [num(dec ?? 0, false), x('number:text', null, '%')], 'percentage')
      case 'currency': {
        const cur = f.currency || 'SAR'
        return this.add(`c:${dec ?? 2}:${cur}`, 'number:number-style', [num(dec ?? 2, true), x('number:text', null, ` ${cur}`)], 'float')
      }
      case 'date':
        return this.add('d', 'number:date-style', [x('number:year', { 'number:style': 'long' }), x('number:text', null, '-'), x('number:month', { 'number:style': 'long' }), x('number:text', null, '-'), x('number:day', { 'number:style': 'long' })], 'date')
      default: return { type: 'float' }
    }
  }
  private add(key: string, tag: string, kids: Xml[], type: 'float' | 'percentage' | 'date') {
    let s = this.styles.get(key)
    if (!s) { const name = `N${this.styles.size + 1}`; s = { name, xml: x(tag, { 'style:name': name }, kids) }; this.styles.set(key, s) }
    return { name: s.name, type }
  }
}

/** The plain number codes that have an exact ODF equivalent: #,##0.00 · 0.0% · 0. */
function simpleCode(code: string): { kind: 'number' | 'thousands' | 'percent'; decimals: number } | null {
  const m = /^(#,##)?0(?:\.(0+))?(%)?$/.exec(code.trim())
  if (!m) return null
  return { kind: m[3] ? 'percent' : m[1] ? 'thousands' : 'number', decimals: m[2]?.length ?? 0 }
}

/** Cell styles, deduplicated, named ce<n>. */
class CellStyles {
  styles = new Map<string, { name: string; xml: Xml }>()
  constructor(private data: DataStyles) {}
  name(f: CellFormat | undefined): { style?: string; type: 'float' | 'percentage' | 'date' } {
    const ds = this.data.of(f)
    if (!f) return { type: ds.type }
    const text: Record<string, string | number | undefined> = {}
    if (f.bold) Object.assign(text, { 'fo:font-weight': 'bold', 'style:font-weight-asian': 'bold', 'style:font-weight-complex': 'bold' })
    if (f.italic) Object.assign(text, { 'fo:font-style': 'italic', 'style:font-style-asian': 'italic', 'style:font-style-complex': 'italic' })
    if (f.underline) Object.assign(text, { 'style:text-underline-style': 'solid', 'style:text-underline-width': 'auto', 'style:text-underline-color': 'font-color' })
    if (f.strike) Object.assign(text, { 'style:text-line-through-style': 'solid' })
    if (f.fontSize) Object.assign(text, { 'fo:font-size': `${f.fontSize}pt`, 'style:font-size-asian': `${f.fontSize}pt`, 'style:font-size-complex': `${f.fontSize}pt` })
    if (css(f.color)) text['fo:color'] = css(f.color)
    if (f.fontFamily) text['fo:font-family'] = f.fontFamily
    const cell: Record<string, string | number | undefined> = {}
    if (css(f.bg)) cell['fo:background-color'] = css(f.bg)
    if (f.wrap) cell['fo:wrap-option'] = 'wrap'
    if (f.valign) cell['style:vertical-align'] = f.valign
    if (f.rotate && f.rotate !== 255) cell['style:rotation-angle'] = ((f.rotate % 360) + 360) % 360
    const sides = borderSides(f.border)
    const line = (side: 't' | 'r' | 'b' | 'l') => {
      const d = f.bd?.[side]
      if (!sides[side] && !d) return undefined
      const color = css(d?.c) || '#000000'
      const st = d?.s
      return st === 'thick' ? `2.5pt solid ${color}` : st === 'medium' ? `1.5pt solid ${color}` : st === 'double' ? `2.5pt double ${color}` : st?.includes('dash') ? `0.75pt dashed ${color}` : st?.includes('dot') ? `0.75pt dotted ${color}` : `0.75pt solid ${color}`
    }
    const b = { t: line('t'), r: line('r'), b: line('b'), l: line('l') }
    if (b.t && b.t === b.r && b.r === b.b && b.b === b.l) cell['fo:border'] = b.t
    else { cell['fo:border-top'] = b.t; cell['fo:border-right'] = b.r; cell['fo:border-bottom'] = b.b; cell['fo:border-left'] = b.l }
    const para: Record<string, string | undefined> = {}
    if (f.align) para['fo:text-align'] = f.align
    if (f.indent) para['fo:margin-left'] = `${f.indent * 9}pt`
    const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Record<string, string>
    const t = clean(text), c = clean(cell), p = clean(para)
    if (!Object.keys(t).length && !Object.keys(c).length && !Object.keys(p).length && !ds.name) return { type: ds.type }
    const key = JSON.stringify([t, c, p, ds.name])
    let s = this.styles.get(key)
    if (!s) {
      const name = `ce${this.styles.size + 1}`
      s = { name, xml: x('style:style', { 'style:name': name, 'style:family': 'table-cell', 'style:parent-style-name': 'Default', 'style:data-style-name': ds.name },
        Object.keys(c).length ? x('style:table-cell-properties', c) : null,
        Object.keys(p).length ? x('style:paragraph-properties', p) : null,
        Object.keys(t).length ? x('style:text-properties', t) : null) }
      this.styles.set(key, s)
    }
    return { style: s.name, type: ds.type }
  }
}

/** A serial day number (and fraction) → the ISO stamp ODF stores a date as. */
function isoOf(serial: number): string {
  const { year, month, day } = serialToParts(Math.floor(serial))
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  const secs = Math.round((serial - Math.floor(serial)) * 86400)
  const date = `${p(year, 4)}-${p(month)}-${p(day)}`
  return secs ? `${date}T${p(Math.floor(secs / 3600))}:${p(Math.floor(secs / 60) % 60)}:${p(secs % 60)}` : date
}

/** Text that may hold line breaks → paragraphs; a link wraps the text. */
function paras(text: string, link?: string): Xml[] {
  return text.split('\n').map((line, i) => {
    const content: XChild = link && i === 0 ? x('text:a', { 'xlink:type': 'simple', 'xlink:href': link.startsWith('#') ? '#' + link.slice(1).replace('!', '.') : link }, line) : line
    return x('text:p', null, content)
  })
}

function cellXml(cell: Cell | undefined, v: CellValue | undefined, styles: CellStyles, span: { c: number; r: number } | null, covered: boolean): Xml {
  if (covered) return x('table:covered-table-cell')
  const spanAttrs = span ? { 'table:number-columns-spanned': span.c > 1 ? span.c : undefined, 'table:number-rows-spanned': span.r > 1 ? span.r : undefined } : {}
  if (!cell) return x('table:table-cell', spanAttrs)
  const st = styles.name(cell.fmt)
  const note = cell.note ? x('office:annotation', null, x('dc:creator', null, 'Built in Saudi'), paras(cell.note)) : null
  const base = { 'table:style-name': st.style, ...spanAttrs }
  const input = cell.input
  const isFormula = input.startsWith('=') && input.length > 1
  const formula = isFormula ? toOpenFormula(input) : undefined
  if (v === undefined || v === '' && !isFormula) return x('table:table-cell', base, note)
  if (isError(v)) return x('table:table-cell', { ...base, 'table:formula': formula, 'office:value-type': 'string', 'office:string-value': '' }, note, paras(String(v)))
  if (typeof v === 'boolean') return x('table:table-cell', { ...base, 'table:formula': formula, 'office:value-type': 'boolean', 'office:boolean-value': String(v) }, note, paras(v ? 'TRUE' : 'FALSE', cell.link))
  if (typeof v === 'number') {
    const shown = formatCell(v, cell.fmt)
    if (st.type === 'date') return x('table:table-cell', { ...base, 'table:formula': formula, 'office:value-type': 'date', 'office:date-value': isoOf(v) }, note, paras(shown, cell.link))
    return x('table:table-cell', { ...base, 'table:formula': formula, 'office:value-type': st.type, 'office:value': String(v) }, note, paras(shown, cell.link))
  }
  const s = String(v)
  return x('table:table-cell', { ...base, 'table:formula': formula, 'office:value-type': 'string', 'office:string-value': isFormula ? s : undefined }, note, paras(s, cell.link))
}

function tableXml(sheet: SheetData, outName: string, engine: Workbook, styles: CellStyles, auto: Map<string, Xml>, lose: (w: string, n?: number) => void): Xml {
  // Merges: the top-left cell carries the span, the rest are covered.
  const spans = new Map<string, { c: number; r: number }>()
  const covered = new Set<string>()
  for (const m of sheet.merges || []) {
    const b = parseRange(m)
    if (!b) continue
    spans.set(`${b.r0},${b.c0}`, { c: b.c1 - b.c0 + 1, r: b.r1 - b.r0 + 1 })
    for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) if (r !== b.r0 || c !== b.c0) covered.add(`${r},${c}`)
  }
  let maxR = 0, maxC = 0
  for (const k of [...Object.keys(sheet.cells), ...spans.keys(), ...covered]) {
    const [r, c] = k.split(',').map(Number)
    maxR = Math.max(maxR, r + 1); maxC = Math.max(maxC, c + 1)
  }
  for (const r of [...Object.keys(sheet.rowHeights || {}).map(Number), ...(sheet.hiddenRows || [])]) maxR = Math.max(maxR, r + 1)
  for (const c of [...Object.keys(sheet.colWidths || {}).map(Number), ...(sheet.hiddenCols || [])]) maxC = Math.max(maxC, c + 1)
  maxC = Math.max(maxC, 1)

  // Columns: a style per distinct width, runs of equal columns written once.
  const colStyle = (px: number) => {
    const name = `co-${px}`
    if (!auto.has(name)) auto.set(name, x('style:style', { 'style:name': name, 'style:family': 'table-column' }, x('style:table-column-properties', { 'fo:break-before': 'auto', 'style:column-width': pt(px) })))
    return name
  }
  const hiddenC = new Set(sheet.hiddenCols || [])
  const cols: Xml[] = []
  for (let c = 0; c < maxC;) {
    const w = sheet.colWidths?.[c] ?? DEFAULT_COL_W
    const hid = hiddenC.has(c)
    let n = 1
    while (c + n < maxC && (sheet.colWidths?.[c + n] ?? DEFAULT_COL_W) === w && hiddenC.has(c + n) === hid) n++
    cols.push(x('table:table-column', { 'table:style-name': colStyle(w), 'table:number-columns-repeated': n > 1 ? n : undefined, 'table:visibility': hid ? 'collapse' : undefined, 'table:default-cell-style-name': 'Default' }))
    c += n
  }

  const rowStyle = (px: number) => {
    const name = `ro-${px}`
    if (!auto.has(name)) auto.set(name, x('style:style', { 'style:name': name, 'style:family': 'table-row' }, x('style:table-row-properties', { 'style:row-height': pt(px), 'fo:break-before': 'auto', 'style:use-optimal-row-height': px === DEFAULT_ROW_H ? 'true' : 'false' })))
    return name
  }
  const byRow = new Map<number, number[]>()
  for (const k of [...Object.keys(sheet.cells), ...spans.keys(), ...covered]) { const [r, c] = k.split(',').map(Number); (byRow.get(r) || byRow.set(r, []).get(r)!).push(c) }
  const hiddenR = new Set(sheet.hiddenRows || [])
  const rows: Xml[] = []
  for (let r = 0; r < maxR;) {
    const h = sheet.rowHeights?.[r] ?? DEFAULT_ROW_H
    const cells = byRow.get(r)
    if (!cells) {
      // A run of empty rows of the same height is one element.
      let n = 1
      while (r + n < maxR && !byRow.has(r + n) && (sheet.rowHeights?.[r + n] ?? DEFAULT_ROW_H) === h && hiddenR.has(r + n) === hiddenR.has(r)) n++
      rows.push(x('table:table-row', { 'table:style-name': rowStyle(h), 'table:number-rows-repeated': n > 1 ? n : undefined, 'table:visibility': hiddenR.has(r) ? 'collapse' : undefined }, x('table:table-cell', { 'table:number-columns-repeated': maxC > 1 ? maxC : undefined })))
      r += n
      continue
    }
    const out: Xml[] = []
    const set = new Set(cells)
    for (let c = 0; c < maxC;) {
      const key = `${r},${c}`
      if (!set.has(c)) {
        let n = 1
        while (c + n < maxC && !set.has(c + n)) n++
        out.push(x('table:table-cell', { 'table:number-columns-repeated': n > 1 ? n : undefined }))
        c += n
        continue
      }
      const cell = sheet.cells[key]
      const v = cell ? engine.value(sheet.name, { row: r, col: c }) : undefined
      out.push(cellXml(cell, v, styles, spans.get(key) || null, covered.has(key)))
      c++
    }
    rows.push(x('table:table-row', { 'table:style-name': rowStyle(h), 'table:visibility': hiddenR.has(r) ? 'collapse' : undefined }, out))
    r++
  }
  if (!rows.length) rows.push(x('table:table-row', { 'table:style-name': rowStyle(DEFAULT_ROW_H) }, x('table:table-cell')))

  // What a sheet holds that this file does not carry — said, never silently dropped.
  if (sheet.charts?.length) lose('charts', sheet.charts.length)
  if ((sheet.conds?.length || 0) + (sheet.scales?.length || 0) + (sheet.cond ? 1 : 0)) lose('conditional formatting')
  if (sheet.images?.length) lose('pictures', sheet.images.length)
  if (sheet.validations?.length || Object.values(sheet.cells).some((c) => c.fmt?.control?.kind === 'dropdown')) lose('drop-down lists and validation rules')
  if (sheet.whatIfs?.length) lose('what-if tables (their values are kept)')

  const tableStyle = `ta-${sheet.rtl ? 'r' : 'l'}${sheet.hidden ? 'h' : ''}${sheet.tabColor ? css(sheet.tabColor) || '' : ''}`
  if (!auto.has(tableStyle)) auto.set(tableStyle, x('style:style', { 'style:name': tableStyle, 'style:family': 'table', 'style:master-page-name': 'Default' },
    x('style:table-properties', { 'table:display': sheet.hidden ? 'false' : 'true', 'style:writing-mode': sheet.rtl ? 'rl-tb' : 'lr-tb', 'tableooo:tab-color': css(sheet.tabColor) })))
  return x('table:table', { 'table:name': outName, 'table:style-name': tableStyle }, cols, rows)
}

/**
 * Frozen panes, and which sheet was open, live in settings.xml as Calc's own view
 * settings. Read back by ods-read.ts; NOT confirmed against Calc itself, because
 * headless LibreOffice (the only one a test can drive) has no view to apply them to.
 */
function settingsXml(book: WorkbookData): string {
  const item = (name: string, type: string, v: string | number) => x('config:config-item', { 'config:name': name, 'config:type': type }, String(v))
  const active = book.sheets[Math.min(book.active || 0, book.sheets.length - 1)]?.name || ''
  const tables = book.sheets.filter((s) => s.freeze && (s.freeze.rows || s.freeze.cols)).map((s) => {
    const f = s.freeze!
    return x('config:config-item-map-entry', { 'config:name': s.name },
      item('HorizontalSplitMode', 'short', f.cols ? 2 : 0), item('VerticalSplitMode', 'short', f.rows ? 2 : 0),
      item('HorizontalSplitPosition', 'int', f.cols || 0), item('VerticalSplitPosition', 'int', f.rows || 0),
      item('ActiveSplitRange', 'short', f.rows ? 2 : 3), item('PositionLeft', 'int', 0), item('PositionRight', 'int', f.cols || 0),
      item('PositionTop', 'int', 0), item('PositionBottom', 'int', f.rows || 0))
  })
  return xmlDoc(x('office:document-settings', { ...NSA, 'office:version': '1.3' },
    x('office:settings', null, x('config:config-item-set', { 'config:name': 'ooo:view-settings' },
      x('config:config-item-map-indexed', { 'config:name': 'Views' }, x('config:config-item-map-entry', null,
        item('ViewId', 'string', 'view1'),
        tables.length ? x('config:config-item-map-named', { 'config:name': 'Tables' }, tables) : null,
        item('ActiveTable', 'string', active)))))))
}

export async function writeOds(book: WorkbookData, meta: { title?: string } = {}): Promise<OdsExport> {
  const engine = new Workbook(book.sheets.map((s) => ({ ...s, cells: { ...s.cells } })), book.names || [])
  const loss = new Map<string, number>()
  const lose = (what: string, n = 1) => loss.set(what, (loss.get(what) || 0) + n)
  const data = new DataStyles(lose)
  const styles = new CellStyles(data)
  const auto = new Map<string, Xml>()
  // Sheet names: unique, and free of what a reference cannot contain. The engine
  // keeps the originals, because that is what the formulas and lookups use.
  const used = new Set<string>()
  const outNames = book.sheets.map((s) => {
    // []*?:/\\ are refused anywhere and an apostrophe only at either end; one inside is quoted.
    let name = (s.name || 'Sheet').replace(/[[\]*?:/\\]/g, '_').replace(/^'+|'+$/g, '_').slice(0, 100) || 'Sheet'
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${name.replace(/ \(\d+\)$/, '')} (${i})`
    used.add(name.toLowerCase())
    if (name !== s.name) lose('sheet names with characters a reference cannot hold (renamed)')
    return name
  })
  const tables = book.sheets.map((s, i) => tableXml(s, outNames[i], engine, styles, auto, lose))
  const named = (book.names || []).filter((n) => n.name && n.ref).map((n) => {
    const of = toOpenFormula(n.ref.replace(/^=/, '')).replace(/^of:=/, '')
    // A named range is written `$Sheet.$A$1`, without the brackets a formula uses.
    const bare = /^\[[^\]]+\]$/.test(of) ? of.slice(1, -1) : null
    return bare ? x('table:named-range', { 'table:name': n.name, 'table:base-cell-address': bare.split(':')[0], 'table:cell-range-address': bare }) : x('table:named-expression', { 'table:name': n.name, 'table:expression': `of:=${of}` })
  })
  if ((book.names || []).some((n) => n.sheet)) lose('names limited to one sheet (made workbook-wide)')
  // Styles are collected while the tables are built, so the tables come first.
  const body = xmlDoc(x('office:document-content', NSA,
    x('office:font-face-decls'),
    x('office:automatic-styles', null, [...data.styles.values()].map((s) => s.xml), [...auto.values()], [...styles.styles.values()].map((s) => s.xml)),
    x('office:body', null, x('office:spreadsheet', null, tables, named.length ? x('table:named-expressions', null, named) : null))))
  const styleDoc = xmlDoc(x('office:document-styles', NSA,
    x('office:styles', null,
      x('style:default-style', { 'style:family': 'table-cell' }, x('style:text-properties', { 'fo:font-size': '10pt', 'style:font-name': 'Liberation Sans' })),
      x('style:style', { 'style:name': 'Default', 'style:family': 'table-cell' })),
    x('office:automatic-styles', null, x('style:page-layout', { 'style:name': 'pm1' })),
    x('office:master-styles', null, x('style:master-page', { 'style:name': 'Default', 'style:page-layout-name': 'pm1' }))))
  const metaDoc = xmlDoc(x('office:document-meta', NSA, x('office:meta', null,
    x('meta:generator', null, 'Built in Saudi'),
    meta.title ? x('dc:title', null, meta.title) : null)))
  const manifest = xmlDoc(x('manifest:manifest', { 'xmlns:manifest': 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0', 'manifest:version': '1.3' },
    x('manifest:file-entry', { 'manifest:full-path': '/', 'manifest:version': '1.3', 'manifest:media-type': MIME }),
    ['content.xml', 'styles.xml', 'meta.xml', 'settings.xml'].map((p) => x('manifest:file-entry', { 'manifest:full-path': p, 'manifest:media-type': 'text/xml' }))))
  const enc = new TextEncoder()
  const blob = await zipFile([
    { name: 'mimetype', bytes: enc.encode(MIME), store: true },
    { name: 'META-INF/manifest.xml', bytes: enc.encode(manifest) },
    { name: 'content.xml', bytes: enc.encode(body) },
    { name: 'styles.xml', bytes: enc.encode(styleDoc) },
    { name: 'meta.xml', bytes: enc.encode(metaDoc) },
    { name: 'settings.xml', bytes: enc.encode(settingsXml({ ...book, sheets: book.sheets.map((s, i) => ({ ...s, name: outNames[i] })) })) },
  ])
  return { blob: new Blob([blob], { type: MIME }), loss: [...loss].map(([what, count]) => ({ what, count })) }
}

