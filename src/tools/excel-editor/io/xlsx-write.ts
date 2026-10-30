// The editor's workbook → .xlsx. Runs in a Web Worker.
//
// Generated from the model, never patched into somebody else's file, so every
// part is one this code wrote and can vouch for. The workbook is RECALCULATED
// here (the engine is pure and runs in the worker too) so every formula carries
// its cached value — a file opened by something that does not recalculate
// (a phone preview, a mail client, a converter) shows the totals rather than
// blank cells.
//
// The parts Excel is strict about, each of which produces "We found a problem
// with some content" when wrong:
//
// - The styles part must have `none` at fill 0 and `gray125` at fill 1, and a
//   cellXfs entry 0 that everything defaults to.
// - Two sheets with the same name, or a name longer than 31 characters, or one
//   containing []:*?/\ — the workbook refuses to open.
// - A comment needs a VML shape as well as the comments part, or Excel drops it.
// - Shared strings must be counted (`count`/`uniqueCount`) or some readers
//   allocate the wrong table size.
import { PackageWriter, REL, NS, writeDocProps, parseDataUrl, sniffImage, pxToEmu } from '../../../lib/office/opc'
import { classicImage } from '../../../lib/office/optimiseImage'
import { x, raw, xmlDoc, type Xml, type XChild } from '../../../lib/xml'
import { Workbook } from '../engine/workbook'
import { colToLetters, parseA1, parseRange, isError, borderSides, validRuns, type CellFormat, type TextRun, type Protection, type SheetData, type SheetPrint, type WorkbookData, type CellValue, type ChartSpec } from '../engine/model'
import { toExcelNumFmt, type NumFmtId } from '../engine/numfmt'

const MDW = 7
const pxToChars = (px: number) => Math.max(0.5, Math.round(((px - 5) / MDW) * 100) / 100)
const pxToPt = (px: number) => Math.round(px * 0.75 * 100) / 100
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const CT = {
  main: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
  sheet: 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
  styles: 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml',
  sst: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml',
  table: 'application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml',
  comments: 'application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml',
  vml: 'application/vnd.openxmlformats-officedocument.vmlDrawing',
  drawing: 'application/vnd.openxmlformats-officedocument.drawing+xml',
  chart: 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml',
  theme: 'application/vnd.openxmlformats-officedocument.theme+xml',
}

export function safeSheetName(name: string, used: Set<string>): string {
  let base = (name || 'Sheet').replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Sheet'
  let n = base
  let i = 2
  while (used.has(n.toLowerCase())) { const suffix = ` (${i++})`; n = base.slice(0, 31 - suffix.length) + suffix }
  used.add(n.toLowerCase())
  base = n
  return base
}

// ---- styles -------------------------------------------------------------------------

const REL_TABLE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/table'

class StyleTable {
  fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>']
  fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']
  borders: string[] = ['<border><left/><right/><top/><bottom/><diagonal/></border>']
  numFmts = new Map<string, number>()
  xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']
  dxfs: string[] = []
  private memo = new Map<string, number>()
  private idx(list: string[], s: string): number { const i = list.indexOf(s); if (i >= 0) return i; list.push(s); return list.length - 1 }

  numFmtId(code: string): number {
    const builtin: Record<string, number> = { General: 0, '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10, '0.00E+00': 11, '@': 49 }
    if (code in builtin) return builtin[code]
    let id = this.numFmts.get(code)
    if (id === undefined) { id = 164 + this.numFmts.size; this.numFmts.set(code, id) }
    return id
  }

  xf(fmt: CellFormat | undefined, quote = false): number {
    if (fmt?.runs) { const { runs, ...rest } = fmt; void runs; fmt = Object.keys(rest).length ? rest : undefined }
    if (!fmt && !quote) return 0
    const key = JSON.stringify([fmt, quote])
    const hit = this.memo.get(key)
    if (hit !== undefined) return hit
    const f = fmt || {}
    const font = x('font', null,
      f.bold ? x('b') : null, f.italic ? x('i') : null, f.strike ? x('strike') : null, f.underline ? x('u') : null,
      x('sz', { val: f.fontSize || 11 }),
      f.color ? x('color', { rgb: 'FF' + hex6(f.color) }) : null,
      x('name', { val: f.fontFamily || 'Calibri' }), x('family', { val: 2 })).s
    const fontId = this.idx(this.fonts, font)
    const fillId = f.bg ? this.idx(this.fills, x('fill', null, x('patternFill', { patternType: 'solid' }, x('fgColor', { rgb: 'FF' + hex6(f.bg) }), x('bgColor', { indexed: 64 }))).s) : 0
    const sides = borderSides(f.border)
    let borderId = 0
    if (sides.t || sides.r || sides.b || sides.l) {
      const side = (tag: string, k: 't' | 'r' | 'b' | 'l') => {
        const d = f.bd?.[k]
        if (!sides[k] && !d) return x(tag)
        return x(tag, { style: d?.s || 'thin' }, x('color', d?.c ? { rgb: 'FF' + hex6(d.c) } : { auto: 1 }))
      }
      borderId = this.idx(this.borders, x('border', null, side('left', 'l'), side('right', 'r'), side('top', 't'), side('bottom', 'b'), x('diagonal')).s)
    }
    const code = f.numCode || toExcelNumFmt(f.numFmt as NumFmtId | undefined, f.currency, f.decimals)
    const numFmtId = code ? this.numFmtId(code) : 0
    const h = f.align === 'center' ? 'center' : f.align === 'end' ? 'right' : f.align === 'start' ? 'left' : undefined
    const v = f.valign === 'middle' ? 'center' : f.valign === 'top' ? 'top' : undefined
    const hasAlign = h || v || f.wrap || f.indent || f.rotate
    const align = hasAlign ? x('alignment', { horizontal: h, vertical: v, wrapText: f.wrap ? 1 : undefined, indent: f.indent || undefined, textRotation: f.rotate || undefined }) : null
    const prot = f.unlocked || f.hideFormula ? x('protection', { locked: f.unlocked ? 0 : undefined, hidden: f.hideFormula ? 1 : undefined }) : null
    const xf = x('xf', {
      numFmtId, fontId, fillId, borderId, xfId: 0,
      applyNumberFormat: numFmtId ? 1 : undefined, applyFont: fontId ? 1 : undefined, applyFill: fillId ? 1 : undefined, applyBorder: borderId ? 1 : undefined, applyAlignment: hasAlign ? 1 : undefined,
      applyProtection: prot ? 1 : undefined, quotePrefix: quote ? 1 : undefined,
    }, align, prot).s
    const id = this.idx(this.xfs, xf)
    this.memo.set(key, id)
    return id
  }

  dxf(bg?: string): number {
    const s = x('dxf', null, bg ? x('fill', null, x('patternFill', null, x('bgColor', { rgb: 'FF' + hex6(bg) }))) : null).s
    return this.idx(this.dxfs, s)
  }

  xml(): string {
    return xmlDoc(x('styleSheet', { xmlns: NS.s },
      this.numFmts.size ? x('numFmts', { count: this.numFmts.size }, [...this.numFmts].map(([code, id]) => x('numFmt', { numFmtId: id, formatCode: code }))) : null,
      x('fonts', { count: this.fonts.length }, raw(this.fonts.join(''))),
      x('fills', { count: this.fills.length }, raw(this.fills.join(''))),
      x('borders', { count: this.borders.length }, raw(this.borders.join(''))),
      x('cellStyleXfs', { count: 1 }, x('xf', { numFmtId: 0, fontId: 0, fillId: 0, borderId: 0 })),
      x('cellXfs', { count: this.xfs.length }, raw(this.xfs.join(''))),
      x('cellStyles', { count: 1 }, x('cellStyle', { name: 'Normal', xfId: 0, builtinId: 0 })),
      x('dxfs', { count: this.dxfs.length }, raw(this.dxfs.join(''))),
    ))
  }
}

export function hex6(c: string): string {
  const h = c.replace('#', '').trim()
  if (/^[0-9a-fA-F]{6}$/.test(h)) return h.toUpperCase()
  if (/^[0-9a-fA-F]{3}$/.test(h)) return h.split('').map((ch) => ch + ch).join('').toUpperCase()
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c)
  if (m) return [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase()
  return '000000'
}

// ---- shared strings ---------------------------------------------------------------------

class Strings {
  list: (string | TextRun[])[] = []
  map = new Map<string, number>()
  count = 0
  id(s: string | TextRun[]): number {
    this.count++
    const key = typeof s === 'string' ? 's' + s : 'r' + JSON.stringify(s)
    let i = this.map.get(key)
    if (i === undefined) { i = this.list.length; this.list.push(s); this.map.set(key, i) }
    return i
  }
  xml(): string {
    const t = (s: string) => x('t', /^\s|\s$|\n/.test(s) ? { 'xml:space': 'preserve' } : null, s)
    return xmlDoc(x('sst', { xmlns: NS.s, count: this.count, uniqueCount: this.list.length },
      this.list.map((s) => x('si', null, typeof s === 'string' ? t(s) : s.map((r) => x('r', null, runPr(r), t(r.t)))))))
  }
}

/** A rich-text run's properties, in the order Excel writes them. */
function runPr(r: TextRun): Xml | null {
  const k: Xml[] = []
  if (r.font) k.push(x('rFont', { val: r.font }))
  if (r.b) k.push(x('b'))
  if (r.i) k.push(x('i'))
  if (r.s) k.push(x('strike'))
  if (r.color) k.push(x('color', { rgb: 'FF' + hex6(r.color) }))
  if (r.size) k.push(x('sz', { val: r.size }))
  if (r.u) k.push(x('u'))
  if (r.sup) k.push(x('vertAlign', { val: 'superscript' }))
  else if (r.sub) k.push(x('vertAlign', { val: 'subscript' }))
  return k.length ? x('rPr', null, k) : null
}

/** Protection as the file writes it: the hash back as it came, and 1 for each action still forbidden. */
function protectionAttrs(p: Protection, kind: 'sheet' | 'workbook'): Record<string, string | number | undefined> {
  const pre = kind === 'workbook'
  const a: Record<string, string | number | undefined> = {}
  if (p.hash) {
    a[pre ? 'workbookAlgorithmName' : 'algorithmName'] = p.hash.algorithm
    a[pre ? 'workbookHashValue' : 'hashValue'] = p.hash.value
    a[pre ? 'workbookSaltValue' : 'saltValue'] = p.hash.salt
    a[pre ? 'workbookSpinCount' : 'spinCount'] = p.hash.spin
  }
  if (p.legacy) a[pre ? 'workbookPassword' : 'password'] = p.legacy
  if (pre) a.lockStructure = 1
  else {
    a.sheet = 1
    for (const [k, v] of Object.entries(p.allow || {})) a[k] = v ? 0 : 1
    // Objects and scenarios are protected with the sheet, as Excel's default does.
    a.objects = 1
    a.scenarios = 1
  }
  return a
}

// ---- the workbook ---------------------------------------------------------------------------

export interface XlsxExport { blob: Blob; loss: { what: string; count: number }[] }

export async function writeXlsx(book: WorkbookData, meta: { title?: string } = {}): Promise<XlsxExport> {
  book = await classicPictures(book)
  const w = new PackageWriter()
  const engine = new Workbook(book.sheets.map((s) => ({ ...s, cells: { ...s.cells } })), book.names || [])
  const styles = new StyleTable()
  const sst = new Strings()
  const used = new Set<string>()
  const names = book.sheets.map((s) => safeSheetName(s.name, used))
  const loss = new Map<string, number>()
  const lose = (what: string, n = 1) => loss.set(what, (loss.get(what) || 0) + n)
  let drawings = 0
  let charts = 0
  let comments = 0
  let images = 0
  let tables = 0

  book.sheets.forEach((sheet, i) => {
    const part = `xl/worksheets/sheet${i + 1}.xml`
    const body = sheetXml(sheet, engine, styles, sst, w, part, lose, () => ++drawings, () => ++charts, () => ++comments, () => ++images, names, () => ++tables)
    w.add(part, body, CT.sheet)
    w.rel('xl/workbook.xml', { type: REL.worksheet, target: part })
  })

  const definedNames = (book.names || []).filter((n) => n.name && n.ref).map((n) => {
    const local = n.sheet ? book.sheets.findIndex((s) => s.name === n.sheet) : -1
    return x('definedName', { name: n.name, localSheetId: local >= 0 ? local : undefined }, n.ref.replace(/^=/, ''))
  })
  // Auto-filters are a defined name as well as a sheet element in Excel's own files.
  book.sheets.forEach((s, i) => {
    if (!s.autoFilter) return
    const b = parseRange(s.autoFilter)
    if (b) definedNames.push(x('definedName', { name: '_xlnm._FilterDatabase', localSheetId: i, hidden: 1 }, `'${names[i].replace(/'/g, "''")}'!$${colToLetters(b.c0)}$${b.r0 + 1}:$${colToLetters(b.c1)}$${b.r1 + 1}`))
  })
  const active = Math.min(book.active || 0, book.sheets.length - 1)
  w.add('xl/workbook.xml', xmlDoc(x('workbook', { xmlns: NS.s, 'xmlns:r': NS.r },
    x('workbookPr', { defaultThemeVersion: 164011 }),
    book.protect ? x('workbookProtection', protectionAttrs(book.protect, 'workbook')) : null,
    x('bookViews', null, x('workbookView', { activeTab: active > 0 ? active : undefined, firstSheet: 0 })),
    x('sheets', null, book.sheets.map((s, i) => x('sheet', { name: names[i], sheetId: i + 1, state: s.hidden && i !== active ? 'hidden' : undefined, 'r:id': `rId${i + 1}` }))),
    definedNames.length ? x('definedNames', null, definedNames) : null,
    x('calcPr', { calcId: 191029, fullCalcOnLoad: 1 }),
  )), CT.main)
  w.rel('', { type: REL.officeDocument, target: 'xl/workbook.xml' })
  w.add('xl/theme/theme1.xml', THEME, CT.theme)
  w.rel('xl/workbook.xml', { type: REL.theme, target: 'xl/theme/theme1.xml' })
  w.add('xl/styles.xml', styles.xml(), CT.styles)
  w.rel('xl/workbook.xml', { type: REL.styles, target: 'xl/styles.xml' })
  w.add('xl/sharedStrings.xml', sst.xml(), CT.sst)
  w.rel('xl/workbook.xml', { type: REL.sharedStrings, target: 'xl/sharedStrings.xml' })
  writeDocProps(w, { title: meta.title, app: 'Built in Saudi — Excel Editor' })
  void drawings; void charts; void comments; void images; void tables
  return { blob: await w.toBlob(MIME), loss: [...loss].map(([what, count]) => ({ what, count })) }
}

function cellValueXml(r: string, v: CellValue, input: string, s: number, sst: Strings, runs?: TextRun[] | null): Xml | null {
  const sAttr = s || undefined
  if (input.startsWith('=')) {
    const f = input.slice(1)
    if (isError(v)) return x('c', { r, s: sAttr, t: 'e' }, x('f', null, f), x('v', null, v.kind === '#CIRC!' ? '#VALUE!' : v.kind))
    if (typeof v === 'number') return x('c', { r, s: sAttr }, x('f', null, f), x('v', null, numText(v)))
    if (typeof v === 'boolean') return x('c', { r, s: sAttr, t: 'b' }, x('f', null, f), x('v', null, v ? '1' : '0'))
    return x('c', { r, s: sAttr, t: 'str' }, x('f', null, f), x('v', null, String(v ?? '')))
  }
  if (v === '' || v == null) return s ? x('c', { r, s }) : null
  if (typeof v === 'number') return x('c', { r, s: sAttr }, x('v', null, numText(v)))
  if (typeof v === 'boolean') return x('c', { r, s: sAttr, t: 'b' }, x('v', null, v ? '1' : '0'))
  if (isError(v)) return x('c', { r, s: sAttr, t: 'e' }, x('v', null, v.kind))
  return x('c', { r, s: sAttr, t: 's' }, x('v', null, String(sst.id(runs || String(v)))))
}
function numText(v: number): string {
  // Full precision, no exponent where Excel would not use one.
  return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(15)))
}

function sheetXml(sheet: SheetData, engine: Workbook, styles: StyleTable, sst: Strings, w: PackageWriter, part: string, lose: (w: string, n?: number) => void,
  nextDrawing: () => number, nextChart: () => number, nextComments: () => number, nextImage: () => number, names: string[], nextTable: () => number): string {
  const rows = new Map<number, { c: number; xml: Xml }[]>()
  let maxR = 0
  let maxC = 0
  const notes: { ref: string; text: string; row: number; col: number }[] = []
  const links: { ref: string; target: string }[] = []
  const listValidations = new Map<string, string[]>()
  for (const [k, cell] of Object.entries(sheet.cells)) {
    const comma = k.indexOf(',')
    const row = +k.slice(0, comma)
    const col = +k.slice(comma + 1)
    const ref = colToLetters(col) + (row + 1)
    const quote = cell.input.startsWith("'")
    const s = styles.xf(cell.fmt ? { ...cell.fmt, control: undefined } : undefined, quote)
    const v = engine.value(sheet.name, { row, col })
    const xml = cellValueXml(ref, v, cell.input, s, sst, typeof v === 'string' ? validRuns(cell.fmt, v) : null)
    if (xml) {
      let list = rows.get(row)
      if (!list) { list = []; rows.set(row, list) }
      list.push({ c: col, xml })
      maxR = Math.max(maxR, row + 1)
      maxC = Math.max(maxC, col + 1)
    }
    if (cell.note) notes.push({ ref, text: cell.note, row, col })
    if (cell.link) links.push({ ref, target: cell.link })
    const ctl = cell.fmt?.control
    if (ctl?.kind === 'dropdown' && ctl.options.length) {
      const key = ctl.options.join('\u0000')
      listValidations.set(key, [...(listValidations.get(key) || []), ref])
    }
  }
  const rowIdx = new Set<number>([...rows.keys(), ...Object.keys(sheet.rowHeights || {}).map(Number), ...(sheet.hiddenRows || [])])
  const hiddenRows = new Set(sheet.hiddenRows || [])
  const sheetRows = [...rowIdx].sort((a, b) => a - b).map((r) => {
    const cells = (rows.get(r) || []).sort((a, b) => a.c - b.c)
    const ht = sheet.rowHeights?.[r]
    return x('row', { r: r + 1, ht: ht ? pxToPt(ht) : undefined, customHeight: ht ? 1 : undefined, hidden: hiddenRows.has(r) ? 1 : undefined }, cells.map((c) => c.xml))
  })
  // Columns.
  const colSet = new Set<number>([...Object.keys(sheet.colWidths || {}).map(Number), ...(sheet.hiddenCols || [])])
  const hiddenCols = new Set(sheet.hiddenCols || [])
  const cols = [...colSet].sort((a, b) => a - b).map((c) => {
    const px = sheet.colWidths?.[c]
    return x('col', { min: c + 1, max: c + 1, width: px ? pxToChars(px) : 8.43, customWidth: px ? 1 : undefined, hidden: hiddenCols.has(c) ? 1 : undefined })
  })
  const fr = sheet.freeze && (sheet.freeze.rows || sheet.freeze.cols) ? sheet.freeze : null
  const pane = fr ? x('pane', {
    xSplit: fr.cols || undefined, ySplit: fr.rows || undefined,
    topLeftCell: colToLetters(fr.cols) + (fr.rows + 1),
    activePane: fr.rows && fr.cols ? 'bottomRight' : fr.rows ? 'bottomLeft' : 'topRight', state: 'frozen',
  }) : null
  const view = x('sheetView', { workbookViewId: 0, rightToLeft: sheet.rtl ? 1 : undefined, showGridLines: sheet.showGrid === false ? 0 : undefined, tabSelected: undefined }, pane)
  // Conditional formats.
  const cfs: Xml[] = []
  let prio = 1
  const used = maxR && maxC ? `A1:${colToLetters(maxC - 1)}${maxR}` : 'A1'
  for (const c of sheet.conds || []) {
    const dxf = styles.dxf(c.bg || '#d6e7c8')
    if (c.op === '>' || c.op === '<' || c.op === '=') cfs.push(x('conditionalFormatting', { sqref: used }, x('cfRule', { type: 'cellIs', dxfId: dxf, priority: prio++, operator: c.op === '>' ? 'greaterThan' : c.op === '<' ? 'lessThan' : 'equal' }, x('formula', null, String(c.value)))))
    else if (c.op === 'contains') cfs.push(x('conditionalFormatting', { sqref: used }, x('cfRule', { type: 'containsText', dxfId: dxf, priority: prio++, operator: 'containsText', text: String(c.value) }, x('formula', null, `NOT(ISERROR(SEARCH("${String(c.value).replace(/"/g, '""')}",A1)))`))))
    else if (c.op === 'eqText') cfs.push(x('conditionalFormatting', { sqref: used }, x('cfRule', { type: 'cellIs', dxfId: dxf, priority: prio++, operator: 'equal' }, x('formula', null, `"${String(c.value).replace(/"/g, '""')}"`))))
  }
  for (const sc of sheet.scales || []) {
    const ref = `${colToLetters(sc.box.c0)}${sc.box.r0 + 1}:${colToLetters(sc.box.c1)}${sc.box.r1 + 1}`
    if (sc.kind === 'databar') cfs.push(x('conditionalFormatting', { sqref: ref }, x('cfRule', { type: 'dataBar', priority: prio++ }, x('dataBar', null, x('cfvo', { type: 'min' }), x('cfvo', { type: 'max' }), x('color', { rgb: 'FF638EC6' })))))
    else cfs.push(x('conditionalFormatting', { sqref: ref }, x('cfRule', { type: 'colorScale', priority: prio++ }, x('colorScale', null,
      x('cfvo', { type: 'min' }), sc.kind === 'scale3' ? x('cfvo', { type: 'percentile', val: 50 }) : null, x('cfvo', { type: 'max' }),
      x('color', { rgb: 'FFF8696B' }), sc.kind === 'scale3' ? x('color', { rgb: 'FFFFEB84' }) : null, x('color', { rgb: 'FF63BE7B' })))))
  }
  // Data validation: dropdown controls, then any imported rules.
  const dvs: Xml[] = []
  for (const [key, refs] of listValidations) {
    const opts = key.split('\u0000')
    const formula = `"${opts.join(',').replace(/"/g, '""')}"`
    if (formula.length > 257) { lose('dropdown lists longer than Excel allows inline'); continue }
    dvs.push(x('dataValidation', { type: 'list', allowBlank: 1, showInputMessage: 1, showErrorMessage: 1, sqref: refs.join(' ') }, x('formula1', null, formula)))
  }
  for (const v of sheet.validations || []) {
    if (v.kind === 'list' && v.list) continue // already written from the controls
    if (v.kind === 'list' && v.source) dvs.push(x('dataValidation', { type: 'list', allowBlank: v.allowBlank ? 1 : undefined, sqref: v.range }, x('formula1', null, v.source.replace(/^=/, ''))))
    else if (v.kind !== 'list') dvs.push(x('dataValidation', { type: v.kind, operator: v.op, allowBlank: v.allowBlank ? 1 : undefined, sqref: v.range, prompt: v.prompt, error: v.error }, v.f1 ? x('formula1', null, v.f1) : null, v.f2 ? x('formula2', null, v.f2) : null))
  }
  // Hyperlinks.
  const hl = links.map((l) => {
    if (l.target.startsWith('#')) return x('hyperlink', { ref: l.ref, location: l.target.slice(1), display: l.target.slice(1) })
    const id = w.rel(part, { type: REL.hyperlink, target: l.target, external: true })
    return x('hyperlink', { ref: l.ref, 'r:id': id })
  })
  // Comments: the comments part plus the VML Excel draws them with.
  let legacy: Xml | null = null
  if (notes.length) {
    const n = nextComments()
    const cpart = `xl/comments${n}.xml`
    w.add(cpart, xmlDoc(x('comments', { xmlns: NS.s }, x('authors', null, x('author', null, 'Built in Saudi')),
      x('commentList', null, notes.map((c) => x('comment', { ref: c.ref, authorId: 0 }, x('text', null, x('r', null, x('t', { 'xml:space': 'preserve' }, c.text)))))))), CT.comments)
    w.rel(part, { type: REL.comments, target: cpart })
    const vpart = `xl/drawings/vmlDrawing${n}.vml`
    w.add(vpart, vml(notes), CT.vml)
    const vid = w.rel(part, { type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing', target: vpart })
    legacy = x('legacyDrawing', { 'r:id': vid })
  }
  // Drawing: pictures and charts.
  let drawing: Xml | null = null
  if ((sheet.images?.length || 0) + (sheet.charts?.length || 0) > 0) {
    const d = nextDrawing()
    const dpart = `xl/drawings/drawing${d}.xml`
    const anchors: Xml[] = []
    let id = 1
    for (const img of sheet.images || []) {
      const parsed = parseDataUrl(img.src)
      const kind = parsed && sniffImage(parsed.bytes)
      if (!parsed || !kind) { lose('pictures that could not be read'); continue }
      const mpart = `xl/media/image${nextImage()}.${kind.ext}`
      w.add(mpart, parsed.bytes)
      const rid = w.rel(dpart, { type: REL.image, target: mpart })
      anchors.push(oneCell(img.anchor, img.size, x('xdr:pic', null,
        x('xdr:nvPicPr', null, x('xdr:cNvPr', { id: id++, name: `Picture ${id}`, descr: img.alt }), x('xdr:cNvPicPr', null, x('a:picLocks', { noChangeAspect: 1 }))),
        x('xdr:blipFill', null, x('a:blip', { 'r:embed': rid }), x('a:stretch', null, x('a:fillRect'))),
        x('xdr:spPr', null, x('a:xfrm', null, x('a:off', { x: 0, y: 0 }), x('a:ext', { cx: pxToEmu(img.size.w), cy: pxToEmu(img.size.h) })), x('a:prstGeom', { prst: 'rect' }, x('a:avLst'))))))
    }
    for (const ch of sheet.charts || []) {
      const cn = nextChart()
      const cpart = `xl/charts/chart${cn}.xml`
      const chartXml = chartPart(ch, sheet, engine, names[0] ? names : [sheet.name])
      if (!chartXml) { lose('charts whose range could not be written'); continue }
      w.add(cpart, chartXml, CT.chart)
      const rid = w.rel(dpart, { type: REL.chart, target: cpart })
      const anchor = ch.anchor || { row: 0, col: 0 }
      const size = ch.size || { w: 360, h: 240 }
      anchors.push(oneCell(anchor, size, x('xdr:graphicFrame', { macro: '' },
        x('xdr:nvGraphicFramePr', null, x('xdr:cNvPr', { id: id++, name: `Chart ${id}` }), x('xdr:cNvGraphicFramePr')),
        x('xdr:xfrm', null, x('a:off', { x: 0, y: 0 }), x('a:ext', { cx: 0, cy: 0 })),
        x('a:graphic', null, x('a:graphicData', { uri: NS.c }, x('c:chart', { 'xmlns:c': NS.c, 'r:id': rid }))))))
    }
    w.add(dpart, xmlDoc(x('xdr:wsDr', { 'xmlns:xdr': NS.xdr, 'xmlns:a': NS.a, 'xmlns:r': NS.r }, anchors)), CT.drawing)
    const rid = w.rel(part, { type: REL.drawing, target: dpart })
    drawing = x('drawing', { 'r:id': rid })
  }
  const merges = (sheet.merges || []).filter((m) => parseRange(m))
  // Tables: their own part each. A column's name must be its header cell's text, or Excel
  // "repairs" the file; and names must be unique within the table.
  const tableParts: Xml[] = []
  const tableBoxes: { r0: number; c0: number; r1: number; c1: number }[] = []
  for (const t of sheet.tables || []) {
    const b = parseRange(t.ref)
    if (!b) continue
    tableBoxes.push(b)
    const n = nextTable()
    const tpart = `xl/tables/table${n}.xml`
    const seen = new Set<string>()
    const cols = Array.from({ length: b.c1 - b.c0 + 1 }, (_, i) => {
      let name = t.header ? String(engine.value(sheet.name, { row: b.r0, col: b.c0 + i }) ?? '').trim() : ''
      if (!name) name = t.columns[i] || `Column${i + 1}`
      let u = name
      for (let k = 2; seen.has(u.toLowerCase()); k++) u = `${name}${k}`
      seen.add(u.toLowerCase())
      return x('tableColumn', { id: i + 1, name: u })
    })
    const safe = t.name.replace(/[^\p{L}\p{N}_.]/gu, '_').replace(/^([^\p{L}_])/u, '_$1') || `Table${n}`
    w.add(tpart, xmlDoc(x('table', { xmlns: NS.s, id: n, name: safe, displayName: safe, ref: t.ref, headerRowCount: t.header ? undefined : 0, totalsRowCount: t.totals ? 1 : undefined, totalsRowShown: t.totals ? undefined : 0 },
      t.header ? x('autoFilter', { ref: t.totals ? `${colToLetters(b.c0)}${b.r0 + 1}:${colToLetters(b.c1)}${b.r1}` : t.ref }) : null,
      x('tableColumns', { count: cols.length }, cols),
      x('tableStyleInfo', { name: t.style || 'TableStyleMedium2', showFirstColumn: t.firstCol ? 1 : 0, showLastColumn: t.lastCol ? 1 : 0, showRowStripes: t.rowStripes ? 1 : 0, showColumnStripes: t.colStripes ? 1 : 0 }))), CT.table)
    tableParts.push(x('tablePart', { 'r:id': w.rel(part, { type: REL_TABLE, target: tpart }) }))
  }
  // The sheet's own filter, with the criteria it was saved with — unless a table already
  // filters that range, which Excel refuses as an overlap.
  const af = sheet.autoFilter ? parseRange(sheet.autoFilter) : null
  const overlaps = af && tableBoxes.some((t) => !(t.r1 < af.r0 || t.r0 > af.r1 || t.c1 < af.c0 || t.c0 > af.c1))
  const autoFilter = af && !overlaps ? x('autoFilter', { ref: sheet.autoFilter },
    (sheet.savedFilter || []).filter((f) => f.col >= af.c0 && f.col <= af.c1).map((f) => x('filterColumn', { colId: f.col - af.c0 },
      x('filters', { blank: f.keep.includes('') ? 1 : undefined }, f.keep.filter((v) => v !== '').map((v) => x('filter', { val: v })))))) : null
  return xmlDoc(x('worksheet', { xmlns: NS.s, 'xmlns:r': NS.r },
    sheet.tabColor || sheet.print?.fit ? x('sheetPr', null, sheet.tabColor ? x('tabColor', { rgb: 'FF' + hex6(sheet.tabColor) }) : null, sheet.print?.fit ? x('pageSetUpPr', { fitToPage: 1 }) : null) : null,
    x('dimension', { ref: used }),
    x('sheetViews', null, view),
    x('sheetFormatPr', { defaultRowHeight: 15 }),
    cols.length ? x('cols', null, cols) : null,
    x('sheetData', null, sheetRows),
    sheet.protect ? x('sheetProtection', protectionAttrs(sheet.protect, 'sheet')) : null,
    autoFilter,
    merges.length ? x('mergeCells', { count: merges.length }, merges.map((m) => x('mergeCell', { ref: m }))) : null,
    cfs,
    dvs.length ? x('dataValidations', { count: dvs.length }, dvs) : null,
    hl.length ? x('hyperlinks', null, hl) : null,
    ...printXml(sheet.print),
    drawing,
    legacy,
    tableParts.length ? x('tableParts', { count: tableParts.length }, tableParts) : null,
  ))
}

/** printOptions, pageMargins, pageSetup and headerFooter, in that (schema) order. */
function printXml(p: SheetPrint | undefined): (Xml | null)[] {
  const m = p?.margins || { l: 0.7, r: 0.7, t: 0.75, b: 0.75, header: 0.3, footer: 0.3 }
  // A header picture (&G) needs a drawing part this writer does not carry: the code goes with it.
  const code = (v?: string) => (v ? v.replace(/&G/g, '') : undefined)
  const hf = p && [p.header, p.footer, p.firstHeader, p.firstFooter, p.evenHeader, p.evenFooter].some(Boolean)
  return [
    p && (p.gridLines || p.headings || p.centerH || p.centerV) ? x('printOptions', { horizontalCentered: p.centerH ? 1 : undefined, verticalCentered: p.centerV ? 1 : undefined, headings: p.headings ? 1 : undefined, gridLines: p.gridLines ? 1 : undefined }) : null,
    x('pageMargins', { left: m.l, right: m.r, top: m.t, bottom: m.b, header: m.header, footer: m.footer }),
    p && (p.paper || p.landscape || p.scale || p.fit) ? x('pageSetup', { paperSize: p.paper, scale: p.scale, fitToWidth: p.fit ? p.fit.w : undefined, fitToHeight: p.fit ? p.fit.h : undefined, orientation: p.landscape ? 'landscape' : 'portrait' }) : null,
    hf ? x('headerFooter', { differentOddEven: p!.differentOddEven ? 1 : undefined, differentFirst: p!.differentFirst ? 1 : undefined },
      p!.header ? x('oddHeader', null, code(p!.header)) : null, p!.footer ? x('oddFooter', null, code(p!.footer)) : null,
      p!.evenHeader ? x('evenHeader', null, code(p!.evenHeader)) : null, p!.evenFooter ? x('evenFooter', null, code(p!.evenFooter)) : null,
      p!.firstHeader ? x('firstHeader', null, code(p!.firstHeader)) : null, p!.firstFooter ? x('firstFooter', null, code(p!.firstFooter)) : null) : null,
  ]
}

function oneCell(anchor: { row: number; col: number; dx?: number; dy?: number }, size: { w: number; h: number }, content: Xml): Xml {
  return x('xdr:oneCellAnchor', null,
    x('xdr:from', null, x('xdr:col', null, String(anchor.col)), x('xdr:colOff', null, String(pxToEmu(anchor.dx || 0))), x('xdr:row', null, String(anchor.row)), x('xdr:rowOff', null, String(pxToEmu(anchor.dy || 0)))),
    x('xdr:ext', { cx: pxToEmu(size.w), cy: pxToEmu(size.h) }),
    content,
    x('xdr:clientData'))
}

function vml(notes: { row: number; col: number }[]): string {
  const shapes = notes.map((n, i) => `<v:shape id="_x0000_s${1025 + i}" type="#_x0000_t202" style="position:absolute;margin-left:80pt;margin-top:5pt;width:108pt;height:59.25pt;z-index:${i + 1};visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:AutoFill>False</x:AutoFill><x:Row>${n.row}</x:Row><x:Column>${n.col}</x:Column></x:ClientData></v:shape>`).join('')
  return `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>${shapes}</xml>`
}

/** Series for a chart: explicit ones, or derived from `range` (first column = categories). */
export function chartSeries(ch: ChartSpec, sheetName: string): { name?: string; cat?: string; val: string; color?: string }[] {
  if (ch.series?.length) return ch.series
  const b = parseRange(ch.range)
  if (!b) return []
  const q = `'${sheetName.replace(/'/g, "''")}'!`
  const abs = (c: number, r: number) => `$${colToLetters(c)}$${r + 1}`
  const hasHeader = b.r1 > b.r0
  const r0 = hasHeader ? b.r0 + 1 : b.r0
  const out = []
  for (let c = b.c0 + (b.c1 > b.c0 ? 1 : 0); c <= b.c1; c++) {
    out.push({
      name: hasHeader ? `=${q}${abs(c, b.r0)}` : undefined,
      cat: b.c1 > b.c0 ? `${q}${abs(b.c0, r0)}:${abs(b.c0, b.r1)}` : undefined,
      val: `${q}${abs(c, r0)}:${abs(c, b.r1)}`,
    })
  }
  return out
}

function refValues(ref: string, engine: Workbook, sheetName: string): CellValue[] {
  const m = /^(?:'?((?:[^']|'')+?)'?!)?(\$?[A-Z]+\$?\d+)(?::(\$?[A-Z]+\$?\d+))?$/.exec(ref.replace(/^=/, ''))
  if (!m) return []
  const sheet = (m[1] || sheetName).replace(/''/g, "'")
  const a = parseA1(m[2])
  const b = m[3] ? parseA1(m[3]) : a
  if (!a || !b || !engine.sheet(sheet)) return []
  const out: CellValue[] = []
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++)
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) out.push(engine.value(sheet, { row: r, col: c }))
  return out
}

function chartPart(ch: ChartSpec, sheet: SheetData, engine: Workbook, _names: string[]): string | null {
  const series = chartSeries(ch, sheet.name)
  if (!series.length) return null
  const C = (tag: string, a?: Record<string, string | number | undefined> | null, ...k: XChild[]) => x('c:' + tag, a, ...k)
  const v = (tag: string, val: string | number) => C(tag, { val })
  const numCache = (vals: CellValue[]) => C('numCache', null, C('formatCode', null, 'General'), v('ptCount', vals.length), vals.map((y, i) => (typeof y === 'number' ? C('pt', { idx: i }, C('v', null, String(y))) : null)))
  const strCache = (vals: CellValue[]) => C('strCache', null, v('ptCount', vals.length), vals.map((y, i) => C('pt', { idx: i }, C('v', null, isError(y) ? y.kind : String(y ?? '')))))
  const palette = ['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '264478', '9E480E']
  const sers = series.map((s, i) => {
    const vals = refValues(s.val, engine, sheet.name)
    const cats = s.cat ? refValues(s.cat, engine, sheet.name) : []
    const nameRef = s.name?.startsWith('=') ? s.name.slice(1) : undefined
    const nameVal = nameRef ? refValues(nameRef, engine, sheet.name)[0] : s.name
    const color = s.color ? hex6(s.color) : palette[i % palette.length]
    const catIsNum = cats.length > 0 && cats.every((y) => typeof y === 'number')
    const isScatter = ch.kind === 'scatter'
    return C('ser', null, v('idx', i), v('order', i),
      nameRef ? C('tx', null, C('strRef', null, C('f', null, nameRef), strCache([nameVal ?? '']))) : nameVal !== undefined ? C('tx', null, C('v', null, String(nameVal))) : null,
      ch.kind === 'pie' || ch.kind === 'doughnut' ? null : C('spPr', null, ch.kind === 'line' || isScatter ? x('a:ln', { w: 28575 }, x('a:solidFill', null, x('a:srgbClr', { val: color }))) : x('a:solidFill', null, x('a:srgbClr', { val: color }))),
      ch.kind === 'line' ? C('marker', null, v('symbol', 'none')) : null,
      s.cat ? C(isScatter ? 'xVal' : 'cat', null, catIsNum ? C('numRef', null, C('f', null, s.cat), numCache(cats)) : C('strRef', null, C('f', null, s.cat), strCache(cats))) : null,
      C(isScatter ? 'yVal' : 'val', null, C('numRef', null, C('f', null, s.val.replace(/^=/, '')), numCache(vals))),
      ch.kind === 'line' || isScatter ? v('smooth', 0) : null)
  })
  const axIds = [v('axId', 111), v('axId', 222)]
  let plot: Xml
  const grouping = ch.stacked ? 'stacked' : ch.kind === 'line' || ch.kind === 'area' ? 'standard' : 'clustered'
  switch (ch.kind) {
    case 'pie': plot = C('pieChart', null, v('varyColors', 1), sers, v('firstSliceAng', 0)); break
    case 'doughnut': plot = C('doughnutChart', null, v('varyColors', 1), sers, v('firstSliceAng', 0), v('holeSize', 50)); break
    case 'line': plot = C('lineChart', null, v('grouping', grouping), v('varyColors', 0), sers, C('marker', { val: 1 }), axIds); break
    case 'area': plot = C('areaChart', null, v('grouping', grouping), v('varyColors', 0), sers, axIds); break
    case 'scatter': plot = C('scatterChart', null, v('scatterStyle', 'lineMarker'), v('varyColors', 0), sers, axIds); break
    default: plot = C('barChart', null, v('barDir', ch.kind === 'bar' ? 'bar' : 'col'), v('grouping', grouping), v('varyColors', 0), sers, ch.stacked ? v('overlap', 100) : null, v('gapWidth', 150), axIds)
  }
  const axes = ch.kind === 'pie' || ch.kind === 'doughnut' ? [] : [
    C(ch.kind === 'scatter' ? 'valAx' : 'catAx', null, v('axId', 111), C('scaling', null, v('orientation', 'minMax')), v('delete', 0), v('axPos', ch.kind === 'bar' ? 'l' : 'b'), v('tickLblPos', 'nextTo'), v('crossAx', 222), v('crosses', 'autoZero')),
    C('valAx', null, v('axId', 222), C('scaling', null, v('orientation', 'minMax')), v('delete', 0), v('axPos', ch.kind === 'bar' ? 'b' : 'l'), C('majorGridlines'), v('tickLblPos', 'nextTo'), v('crossAx', 111), v('crosses', 'autoZero')),
  ]
  const title = ch.title ? C('title', null, C('tx', null, C('rich', null, x('a:bodyPr'), x('a:p', null, x('a:r', null, x('a:t', null, ch.title))))), v('overlay', 0)) : null
  return xmlDoc(x('c:chartSpace', { 'xmlns:c': NS.c, 'xmlns:a': NS.a, 'xmlns:r': NS.r },
    v('roundedCorners', 0),
    C('chart', null, title, v('autoTitleDeleted', ch.title ? 0 : 1), C('plotArea', null, C('layout'), plot, axes), ch.legend !== false && (series.length > 1 || ch.kind === 'pie' || ch.kind === 'doughnut') ? C('legend', null, v('legendPos', 'b'), v('overlay', 0)) : null, v('plotVisOnly', 1))))
}

// A minimal Office theme, so the file has the part every Excel-made file has.
const THEME = xmlDoc(raw(`<a:theme xmlns:a="${NS.a}" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`))

export { MIME as XLSX_MIME }

/** WebP pictures as JPEG or PNG, which every Excel opens; the workbook itself is left as it is. */
async function classicPictures(book: WorkbookData): Promise<WorkbookData> {
  if (!book.sheets.some((s) => s.images?.length)) return book
  const sheets = await Promise.all(book.sheets.map(async (s) => {
    if (!s.images?.length) return s
    const images = await Promise.all(s.images.map(async (im) => {
      const p = parseDataUrl(im.src)
      const c = p ? await classicImage(p.bytes) : null
      if (!c) return im
      let b = ''
      for (let i = 0; i < c.bytes.length; i += 0x8000) b += String.fromCharCode(...c.bytes.subarray(i, i + 0x8000))
      return { ...im, src: `data:${c.mime};base64,${btoa(b)}` }
    }))
    return { ...s, images }
  }))
  return { ...book, sheets }
}
