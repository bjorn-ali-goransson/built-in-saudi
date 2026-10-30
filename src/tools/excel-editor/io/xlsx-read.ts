// .xlsx → the editor's workbook. Runs in a Web Worker (no DOM): opc.ts unzips,
// xml.ts parses, nothing here touches `document`.
//
// It is an EXPLICIT, LOSSY conversion, and it says what it lost. The ledger is
// not an apology, it is the contract: a pivot table, a macro or a sparkline that
// silently vanished is a workbook somebody trusts and should not.
//
// The traps worth knowing, each of which reads as a correct import and is not:
//
// - **Shared formulas.** Excel writes a formula ONCE for a filled column and
//   leaves every other cell in the block pointing at it by `si` with no text.
//   Read only the cells with text and nine tenths of a filled column imports as
//   plain numbers — the cached values, frozen, no longer formulas at all.
// - **Text that looks like a number.** "0501234567" stored as a string must stay
//   a string; written into a cell as an input it would re-parse as 501234567.
//   Such cells get the leading apostrophe Excel itself uses.
// - **The 1904 date system.** A workbook made on an old Mac counts days from
//   1904, 1,462 days later than everyone else. Ignore the flag and every date in
//   it is four years and a day out.
// - **Theme colours.** A fill is usually "accent 1, 40% lighter", not a hex; a
//   reader that ignores the theme paints every heading black on white.
import { Package, NS, REL, relIs, sniffImage, dataUrl, emuToPx, OpcError } from '../../../lib/office/opc'
import { kids, kid, find, findAll, attr, numAttr, textOf, isEl, type XEl } from '../../../lib/xml'
import { DEFAULT_THEME, THEME_ORDER, INDEXED, applyTint, argb, sheetThemeColor, type ThemeColors } from '../../../lib/office/color'
import { cellKey, parseA1, parseRange, colToLetters, type Cell, type CellFormat, type SheetData, type WorkbookData, type CondRule, type ScaleRule, type ChartSpec, type Validation, type SheetImage, type SheetPrint, type DefinedName, type TextRun, type Protection } from '../engine/model'
import { shiftFormula } from '../engine/formula'
import { BUILTIN_FORMATS, isDateCode } from '../engine/fmtcode'

export interface Loss { what: string; count: number }
export interface XlsxImport { book: WorkbookData; loss: Loss[]; title: string }

const S = NS.s
const R = NS.r
const MDW = 7 // Excel's maximum-digit width of the default font, in px
const charsToPx = (w: number) => Math.round(w * MDW + 5)
const ptToPx = (pt: number) => Math.round((pt * 96) / 72)

interface Font { b?: boolean; i?: boolean; u?: boolean; strike?: boolean; sz?: number; color?: string; name?: string }
interface Border { t?: { s: string; c?: string }; r?: { s: string; c?: string }; b?: { s: string; c?: string }; l?: { s: string; c?: string } }
interface Xf { numFmtId: number; fontId: number; fillId: number; borderId: number; align?: XEl | null; prot?: XEl | null }
interface Styles { numFmts: Map<number, string>; fonts: Font[]; fills: (string | undefined)[]; borders: Border[]; xfs: Xf[]; dxfs: { bg?: string; color?: string; b?: boolean }[]; cache: Map<number, CellFormat | undefined> }

/** The schema a part uses: transitional or strict. Lookups try both. */
function sNs(el: XEl): string { return el.ns === NS.sStrict ? NS.sStrict : S }

export async function readXlsx(buf: ArrayBuffer): Promise<XlsxImport> {
  const pkg = await Package.open(buf)
  const main = await pkg.mainPart()
  const ct = pkg.contentType(main)
  if (ct && !/sheet\.main|template\.main|macroEnabled\.main/.test(ct)) throw new OpcError('not-ooxml', 'not a spreadsheet')
  const loss = new Map<string, number>()
  const lose = (what: string, n = 1) => { if (n > 0) loss.set(what, (loss.get(what) || 0) + n) }

  const wb = await pkg.xml(main)
  const ns = sNs(wb)
  const theme = await readTheme(pkg, main)
  const styles = await readStyles(pkg, main, theme)
  const sst = await readSharedStrings(pkg, main, theme)
  const date1904 = ['1', 'true'].includes(attr(kid(wb, ns, 'workbookPr'), 'date1904') || '')
  if (pkg.names().some((n) => /vbaProject\.bin$/i.test(n))) lose('macros (VBA)')
  if (pkg.names().some((n) => /pivotTable/i.test(n))) lose('pivot tables', pkg.names().filter((n) => /pivotTables\/pivotTable\d+\.xml$/i.test(n)).length)
  if (pkg.names().some((n) => /externalLink/i.test(n))) lose('links to other workbooks', pkg.names().filter((n) => /externalLinks\/externalLink\d+\.xml$/i.test(n)).length)
  if (pkg.names().some((n) => /slicer/i.test(n))) lose('slicers')
  const wbp = find(wb, ns, 'workbookProtection')
  const bookProtect = wbp && (attr(wbp, 'lockStructure') === '1' || attr(wbp, 'lockStructure') === 'true') ? protectionOf(wbp, 'workbook') : undefined

  const sheetEls = kids(kid(wb, ns, 'sheets'), ns, 'sheet')
  const names: DefinedName[] = []
  const sheetNames = sheetEls.map((s) => attr(s, 'name') || 'Sheet')
  for (const dn of kids(kid(wb, ns, 'definedNames'), ns, 'definedName')) {
    const name = attr(dn, 'name') || ''
    const ref = cleanFormula(textOf(dn))
    if (!name || name.startsWith('_xlnm.')) {
      if (name === '_xlnm.Print_Area' || name === '_xlnm.Print_Titles') lose('print areas')
      continue
    }
    const local = attr(dn, 'localSheetId')
    names.push({ name, ref: '=' + ref, sheet: local !== undefined ? sheetNames[Number(local)] : undefined })
  }
  let active = numAttr(kid(kid(wb, ns, 'bookViews'), ns, 'workbookView'), 'activeTab', 0)

  const sheets: SheetData[] = []
  for (let i = 0; i < sheetEls.length; i++) {
    const se = sheetEls[i]
    const rid = attr(se, 'id', R) ?? attr(se, 'id', NS.rStrict)
    const rel = rid ? await pkg.relById(main, rid) : undefined
    if (!rel) continue
    if (relIs(rel.type, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartsheet')) { lose('chart sheets'); continue }
    if (!relIs(rel.type, REL.worksheet)) { lose('dialog or macro sheets'); continue }
    const sheet = await readSheet(pkg, rel.target, sheetNames[i], styles, sst, date1904, theme, lose)
    if (attr(se, 'state') === 'hidden' || attr(se, 'state') === 'veryHidden') sheet.hidden = true
    sheets.push(sheet)
  }
  if (!sheets.length) sheets.push({ name: 'Sheet1', cells: {}, rows: 100, cols: 26 })
  if (active >= sheets.length) active = 0
  const title = await readCoreTitle(pkg)
  return { book: { sheets, names, active, ...(bookProtect ? { protect: bookProtect } : {}) }, loss: [...loss].map(([what, count]) => ({ what, count })), title }
}

async function readCoreTitle(pkg: Package): Promise<string> {
  const core = await pkg.tryXml('docProps/core.xml')
  if (!core) return ''
  const t = find(core, NS.dc, 'title')
  return t ? textOf(t).trim() : ''
}

// ---- theme, styles, strings ---------------------------------------------------------

async function readTheme(pkg: Package, main: string): Promise<ThemeColors> {
  const rel = (await pkg.relsOfType(main, REL.theme))[0]
  const el = await pkg.tryXml(rel?.target)
  if (!el) return DEFAULT_THEME
  const scheme = find(el, NS.a, 'clrScheme')
  const out: ThemeColors = { ...DEFAULT_THEME }
  for (const name of THEME_ORDER) {
    const c = kid(scheme, NS.a, name)
    const srgb = kid(c, NS.a, 'srgbClr')
    const sys = kid(c, NS.a, 'sysClr')
    const v = srgb ? attr(srgb, 'val') : sys ? attr(sys, 'lastClr') : undefined
    if (v && /^[0-9a-fA-F]{6}$/.test(v)) out[name] = '#' + v.toLowerCase()
  }
  return out
}

const on = (v: string | undefined) => v === '1' || v === 'true'
/** A sheet's page setup, as written: margins, paper, orientation, scale or fit, header and footer, print options. */
function readPrint(el: XEl, ns: string, pr: XEl | null): SheetPrint | undefined {
  const out: SheetPrint = {}
  const m = kid(el, ns, 'pageMargins')
  if (m) out.margins = { l: numAttr(m, 'left', 0.7), r: numAttr(m, 'right', 0.7), t: numAttr(m, 'top', 0.75), b: numAttr(m, 'bottom', 0.75), header: numAttr(m, 'header', 0.3), footer: numAttr(m, 'footer', 0.3) }
  const ps = kid(el, ns, 'pageSetup')
  if (ps) {
    if (attr(ps, 'orientation') === 'landscape') out.landscape = true
    const paper = attr(ps, 'paperSize'); if (paper) out.paper = Number(paper)
    const scale = attr(ps, 'scale'); if (scale && scale !== '100') out.scale = Number(scale)
    if (on(attr(kid(pr, ns, 'pageSetUpPr'), 'fitToPage'))) out.fit = { w: Number(attr(ps, 'fitToWidth') ?? 1), h: Number(attr(ps, 'fitToHeight') ?? 1) }
  }
  const hf = kid(el, ns, 'headerFooter')
  if (hf) {
    const t = (k: string) => { const v = textOf(kid(hf, ns, k)); return v || undefined }
    out.header = t('oddHeader'); out.footer = t('oddFooter')
    out.firstHeader = t('firstHeader'); out.firstFooter = t('firstFooter')
    out.evenHeader = t('evenHeader'); out.evenFooter = t('evenFooter')
    if (on(attr(hf, 'differentFirst'))) out.differentFirst = true
    if (on(attr(hf, 'differentOddEven'))) out.differentOddEven = true
  }
  const po = kid(el, ns, 'printOptions')
  if (po) {
    if (on(attr(po, 'gridLines'))) out.gridLines = true
    if (on(attr(po, 'headings'))) out.headings = true
    if (on(attr(po, 'horizontalCentered'))) out.centerH = true
    if (on(attr(po, 'verticalCentered'))) out.centerV = true
  }
  for (const k of Object.keys(out) as (keyof SheetPrint)[]) if (out[k] === undefined) delete out[k]
  return Object.keys(out).length ? out : undefined
}

function colorOf(el: XEl | null, theme: ThemeColors): string | undefined {
  if (!el) return undefined
  const tint = Number(attr(el, 'tint') || 0)
  let c: string | undefined
  if (attr(el, 'rgb')) c = argb(attr(el, 'rgb'))
  else if (attr(el, 'theme') !== undefined) c = sheetThemeColor(theme, Number(attr(el, 'theme')))
  else if (attr(el, 'indexed') !== undefined) {
    const i = Number(attr(el, 'indexed'))
    if (i === 64 || i === 65) return undefined // "system foreground/background" = automatic
    c = INDEXED[i]
  } else if (attr(el, 'auto') === '1') return undefined
  return c && tint ? applyTint(c, tint) : c
}

async function readStyles(pkg: Package, main: string, theme: ThemeColors): Promise<Styles> {
  const rel = (await pkg.relsOfType(main, REL.styles))[0]
  const el = await pkg.tryXml(rel?.target)
  const st: Styles = { numFmts: new Map(), fonts: [], fills: [], borders: [], xfs: [], dxfs: [], cache: new Map() }
  if (!el) return st
  const ns = sNs(el)
  for (const nf of kids(kid(el, ns, 'numFmts'), ns, 'numFmt')) st.numFmts.set(numAttr(nf, 'numFmtId', -1), attr(nf, 'formatCode') || 'General')
  for (const f of kids(kid(el, ns, 'fonts'), ns, 'font')) {
    const on = (n: string) => { const k = kid(f, ns, n); if (!k) return undefined; const v = attr(k, 'val'); return v === undefined ? true : !(v === '0' || v === 'false' || v === 'none') }
    st.fonts.push({
      b: on('b'), i: on('i'), u: on('u'), strike: on('strike'),
      sz: kid(f, ns, 'sz') ? Number(attr(kid(f, ns, 'sz'), 'val')) : undefined,
      color: colorOf(kid(f, ns, 'color'), theme),
      name: attr(kid(f, ns, 'name'), 'val'),
    })
  }
  for (const f of kids(kid(el, ns, 'fills'), ns, 'fill')) {
    const pf = kid(f, ns, 'patternFill')
    const gf = kid(f, ns, 'gradientFill')
    if (pf && attr(pf, 'patternType') && attr(pf, 'patternType') !== 'none') st.fills.push(colorOf(kid(pf, ns, 'fgColor'), theme) || colorOf(kid(pf, ns, 'bgColor'), theme))
    else if (gf) st.fills.push(colorOf(kid(find(gf, ns, 'stop'), ns, 'color'), theme))
    else st.fills.push(undefined)
  }
  for (const b of kids(kid(el, ns, 'borders'), ns, 'border')) {
    const side = (n: string) => {
      const k = kid(b, ns, n)
      const s = attr(k, 'style')
      return s && s !== 'none' ? { s, c: colorOf(kid(k, ns, 'color'), theme) } : undefined
    }
    st.borders.push({ t: side('top'), r: side('right'), b: side('bottom'), l: side('left') })
  }
  for (const x of kids(kid(el, ns, 'cellXfs'), ns, 'xf')) {
    st.xfs.push({ numFmtId: numAttr(x, 'numFmtId', 0), fontId: numAttr(x, 'fontId', 0), fillId: numAttr(x, 'fillId', 0), borderId: numAttr(x, 'borderId', 0), align: kid(x, ns, 'alignment'), prot: kid(x, ns, 'protection') })
  }
  for (const d of kids(kid(el, ns, 'dxfs'), ns, 'dxf')) {
    const pf = find(d, ns, 'patternFill')
    st.dxfs.push({ bg: colorOf(kid(pf, ns, 'bgColor'), theme) || colorOf(kid(pf, ns, 'fgColor'), theme), color: colorOf(find(d, ns, 'color'), theme), b: !!find(d, ns, 'b') })
  }
  return st
}

/** The editor's cell format for a style index. Memoised — a sheet reuses a handful of styles. */
function fmtOf(st: Styles, s: number): CellFormat | undefined {
  if (st.cache.has(s)) return st.cache.get(s)
  const xf = st.xfs[s]
  if (!xf) { st.cache.set(s, undefined); return undefined }
  const out: CellFormat = {}
  const font = st.fonts[xf.fontId]
  const base = st.fonts[0]
  if (font) {
    if (font.b) out.bold = true
    if (font.i) out.italic = true
    if (font.u) out.underline = true
    if (font.strike) out.strike = true
    if (font.sz && font.sz !== (base?.sz ?? 11)) out.fontSize = font.sz
    if (font.color && font.color !== '#000000') out.color = font.color
    if (font.name && font.name !== base?.name) out.fontFamily = font.name
  }
  const fill = st.fills[xf.fillId]
  if (fill && xf.fillId > 1) out.bg = fill
  const bd = st.borders[xf.borderId]
  if (bd && (bd.t || bd.r || bd.b || bd.l)) {
    out.border = { t: !!bd.t, r: !!bd.r, b: !!bd.b, l: !!bd.l }
    out.bd = {}
    for (const k of ['t', 'r', 'b', 'l'] as const) if (bd[k]) out.bd[k] = bd[k]!
  }
  if (xf.numFmtId) {
    const code = st.numFmts.get(xf.numFmtId) ?? BUILTIN_FORMATS[xf.numFmtId]
    if (code && code !== 'General') {
      out.numCode = code
      if (isDateCode(code)) out.numFmt = 'date'
    }
  }
  const al = xf.align
  if (al) {
    const h = attr(al, 'horizontal')
    if (h === 'center' || h === 'centerContinuous') out.align = 'center'
    else if (h === 'right') out.align = 'end'
    else if (h === 'left') out.align = 'start'
    const v = attr(al, 'vertical')
    if (v === 'center') out.valign = 'middle'
    else if (v === 'top') out.valign = 'top'
    if (attr(al, 'wrapText') === '1' || attr(al, 'wrapText') === 'true') out.wrap = true
    if (attr(al, 'indent')) out.indent = Number(attr(al, 'indent'))
    if (attr(al, 'textRotation')) out.rotate = Number(attr(al, 'textRotation'))
  }
  const pr = xf.prot
  if (pr) {
    if (attr(pr, 'locked') === '0' || attr(pr, 'locked') === 'false') out.unlocked = true
    if (attr(pr, 'hidden') === '1' || attr(pr, 'hidden') === 'true') out.hideFormula = true
  }
  const res = Object.keys(out).length ? out : undefined
  st.cache.set(s, res)
  return res
}

/** A shared string: its text, and its runs when it mixes formatting. */
interface Sst { text: string; runs?: TextRun[] }

async function readSharedStrings(pkg: Package, main: string, theme: ThemeColors): Promise<Sst[]> {
  const rel = (await pkg.relsOfType(main, REL.sharedStrings))[0]
  const el = await pkg.tryXml(rel?.target)
  if (!el) return []
  const ns = sNs(el)
  return kids(el, ns, 'si').map((si) => {
    const t = kid(si, ns, 't')
    if (t) return { text: textOf(t) }
    // Rich text. Phonetic guides (<rPh>) are not text.
    const runs = kids(si, ns, 'r').map((r) => runOf(r, ns, theme))
    const text = runs.map((r) => r.t).join('')
    return runs.length > 1 && runs.some((r) => Object.keys(r).length > 1) ? { text, runs } : { text }
  })
}

/** One rich-text run: its text and the font properties it sets. */
export function runOf(r: XEl, ns: string, theme: ThemeColors): TextRun {
  const out: TextRun = { t: textOf(kid(r, ns, 't')) }
  const rp = kid(r, ns, 'rPr')
  if (!rp) return out
  const on = (n: string) => { const k = kid(rp, ns, n); if (!k) return false; const v = attr(k, 'val'); return v === undefined || !(v === '0' || v === 'false' || v === 'none') }
  if (on('b')) out.b = true
  if (on('i')) out.i = true
  if (on('u')) out.u = true
  if (on('strike')) out.s = true
  const va = attr(kid(rp, ns, 'vertAlign'), 'val')
  if (va === 'superscript') out.sup = true
  else if (va === 'subscript') out.sub = true
  const sz = attr(kid(rp, ns, 'sz'), 'val')
  if (sz) out.size = Number(sz)
  const c = colorOf(kid(rp, ns, 'color'), theme)
  if (c && c !== '#000000') out.color = c
  const f = attr(kid(rp, ns, 'rFont'), 'val')
  if (f) out.font = f
  return out
}

/** Protection from sheetProtection or workbookProtection: the hash, and what is still allowed. */
function protectionOf(el: XEl, kind: 'sheet' | 'workbook'): Protection {
  const p: Protection = {}
  const pre = kind === 'workbook' ? 'workbook' : ''
  const alg = attr(el, pre ? 'workbookAlgorithmName' : 'algorithmName')
  const value = attr(el, pre ? 'workbookHashValue' : 'hashValue')
  if (alg && value) p.hash = { algorithm: alg, value, salt: attr(el, pre ? 'workbookSaltValue' : 'saltValue') || '', spin: Number(attr(el, pre ? 'workbookSpinCount' : 'spinCount') || 0) }
  const legacy = attr(el, pre ? 'workbookPassword' : 'password')
  if (legacy) p.legacy = legacy
  if (kind === 'sheet') {
    const allow: Record<string, boolean> = {}
    // In the file, an attribute set to 1 means that action is PROTECTED (forbidden),
    // except the two selection ones, whose defaults run the other way. Store what is ALLOWED.
    for (const k of ['formatCells', 'formatColumns', 'formatRows', 'insertColumns', 'insertRows', 'insertHyperlinks', 'deleteColumns', 'deleteRows', 'sort', 'autoFilter', 'pivotTables']) {
      const v = attr(el, k)
      allow[k] = v === '0' || v === 'false'
    }
    p.allow = allow
  }
  return p
}

// ---- a worksheet -----------------------------------------------------------------------

/** Strip Excel's future-function prefixes and the leading `=`. */
export function cleanFormula(f: string): string {
  return f.replace(/^=/, '').replace(/_xlfn\._xlws\./g, '').replace(/_xlfn\./g, '').replace(/_xludf\./g, '').replace(/_xlpm\./g, '')
}

/** Text that would re-parse as something else gets Excel's apostrophe. */
export function textInput(s: string): string {
  if (/^-?\d*\.?\d+(e[+-]?\d+)?%?$/i.test(s) || /^(true|false)$/i.test(s) || s.startsWith('=') || s.startsWith("'")) return "'" + s
  return s
}

/** Excel's serial in the 1904 system is 1,462 days behind ours. */
const D1904 = 1462

async function readSheet(pkg: Package, part: string, name: string, st: Styles, sst: Sst[], date1904: boolean, theme: ThemeColors, lose: (w: string, n?: number) => void): Promise<SheetData> {
  const el = await pkg.xml(part)
  const ns = sNs(el)
  const cells: Record<string, Cell> = {}
  const sheet: SheetData = { name, cells, rows: 100, cols: 26 }
  // Views: freeze panes, right-to-left, gridlines.
  const view = kid(kid(el, ns, 'sheetViews'), ns, 'sheetView')
  if (view) {
    if (attr(view, 'rightToLeft') === '1' || attr(view, 'rightToLeft') === 'true') sheet.rtl = true
    if (attr(view, 'showGridLines') === '0' || attr(view, 'showGridLines') === 'false') sheet.showGrid = false
    const pane = kid(view, ns, 'pane')
    if (pane && /frozen/.test(attr(pane, 'state') || '')) sheet.freeze = { rows: Math.round(numAttr(pane, 'ySplit', 0)), cols: Math.round(numAttr(pane, 'xSplit', 0)) }
    else if (pane) lose('split panes')
  }
  const pr = kid(el, ns, 'sheetPr')
  const tab = colorOf(kid(pr, ns, 'tabColor'), theme)
  if (tab) sheet.tabColor = tab
  const print = readPrint(el, ns, pr)
  if (print) sheet.print = print
  if (/&G/.test(print?.header || '') || /&G/.test(print?.footer || '')) lose('pictures in the page header or footer')
  // Column widths and hidden columns.
  const fmtPr = kid(el, ns, 'sheetFormatPr')
  const defaultRowPx = fmtPr && attr(fmtPr, 'defaultRowHeight') ? ptToPx(Number(attr(fmtPr, 'defaultRowHeight'))) : 20
  const colFmt = new Map<number, number>()
  for (const c of kids(kid(el, ns, 'cols'), ns, 'col')) {
    const min = numAttr(c, 'min', 1) - 1
    const max = Math.min(numAttr(c, 'max', 1) - 1, min + 16383)
    const w = attr(c, 'width')
    const hidden = attr(c, 'hidden') === '1' || attr(c, 'hidden') === 'true'
    if (max - min > 1000 && !hidden && !w) continue
    for (let i = min; i <= max && i - min < 2000; i++) {
      if (w && attr(c, 'customWidth') !== '0') (sheet.colWidths ||= {})[i] = charsToPx(Number(w))
      if (hidden) (sheet.hiddenCols ||= []).push(i)
      if (attr(c, 'style')) colFmt.set(i, Number(attr(c, 'style')))
    }
  }
  // Cells.
  const shared = new Map<string, { f: string; row: number; col: number }>()
  let maxR = 0
  let maxC = 0
  let tooMany = 0
  let count = 0
  const sd = kid(el, ns, 'sheetData')
  let implicitRow = 0
  for (const row of kids(sd, ns, 'row')) {
    const r = attr(row, 'r') ? Number(attr(row, 'r')) - 1 : implicitRow
    implicitRow = r + 1
    if (attr(row, 'ht') && (attr(row, 'customHeight') === '1' || Math.abs(ptToPx(Number(attr(row, 'ht'))) - defaultRowPx) > 2)) (sheet.rowHeights ||= {})[r] = ptToPx(Number(attr(row, 'ht')))
    if (attr(row, 'hidden') === '1' || attr(row, 'hidden') === 'true') (sheet.hiddenRows ||= []).push(r)
    let implicitCol = 0
    for (const c of kids(row, ns, 'c')) {
      const ref = attr(c, 'r')
      const a = ref ? parseA1(ref) : { row: r, col: implicitCol }
      if (!a) continue
      implicitCol = a.col + 1
      if (a.row > 1_048_575 || a.col > 16383) continue
      const t = attr(c, 't') || 'n'
      const s = attr(c, 's')
      const fmt = fmtOf(st, s !== undefined ? Number(s) : colFmt.get(a.col) ?? 0)
      const fEl = kid(c, ns, 'f')
      const vEl = kid(c, ns, 'v')
      let input = ''
      let runs: TextRun[] | undefined
      if (fEl) {
        const ft = attr(fEl, 't')
        let ftext = textOf(fEl)
        if (ft === 'shared') {
          const si = attr(fEl, 'si') || ''
          if (ftext) shared.set(si, { f: ftext, row: a.row, col: a.col })
          else {
            const m = shared.get(si)
            if (m) ftext = shiftFormula('=' + cleanFormula(m.f), a.row - m.row, a.col - m.col).slice(1)
          }
        } else if (ft === 'array' && ftext) lose('array formulas (kept as ordinary formulas)')
        else if (ft === 'dataTable') { lose('what-if data tables'); ftext = '' }
        if (ftext) input = '=' + cleanFormula(ftext)
      }
      if (!input) {
        const v = vEl ? textOf(vEl) : ''
        switch (t) {
          case 's': { const e = sst[Number(v)]; input = textInput(e?.text ?? ''); runs = e?.runs; break }
          case 'inlineStr': {
            const is = find(c, ns, 'is')
            const rr = is ? kids(is, ns, 'r') : []
            if (rr.length > 1) { const list = rr.map((x) => runOf(x, ns, theme)); runs = list; input = textInput(list.map((x) => x.t).join('')) }
            else input = textInput(textOf(is))
            break
          }
          case 'str': input = textInput(v); break
          case 'b': input = v === '1' ? 'TRUE' : 'FALSE'; break
          case 'e': input = '=' + v; break
          case 'd': input = v; break // ISO date-time; the engine reads ISO dates as dates
          default:
            if (v !== '') {
              let n = Number(v)
              if (date1904 && fmt?.numFmt === 'date') n += D1904
              input = Number.isFinite(n) ? String(n) : v
            }
        }
      }
      if (!input && !fmt) continue
      if (count >= 400_000) { tooMany++; continue }
      count++
      const f2 = runs ? { ...(fmt || {}), runs } : fmt
      cells[cellKey(a.row, a.col)] = f2 ? { input, fmt: f2 } : { input }
      if (input) { maxR = Math.max(maxR, a.row + 1); maxC = Math.max(maxC, a.col + 1) }
    }
  }
  if (tooMany) lose('cells beyond the editor\'s 400,000-cell limit', tooMany)
  sheet.rows = Math.max(100, maxR + 20)
  sheet.cols = Math.max(26, maxC + 4)
  // Merges.
  for (const m of kids(kid(el, ns, 'mergeCells'), ns, 'mergeCell')) { const ref = attr(m, 'ref'); if (ref && parseRange(ref)) (sheet.merges ||= []).push(ref) }
  // Auto-filter.
  const af = kid(el, ns, 'autoFilter')
  if (af && attr(af, 'ref')) {
    sheet.autoFilter = attr(af, 'ref')
    const box = parseRange(sheet.autoFilter!)
    // A filterColumn can be nothing but a hidden button (showButton="0"): that is not a filter.
    for (const fc of kids(af, ns, 'filterColumn')) {
      const col = (box?.c0 ?? 0) + numAttr(fc, 'colId', 0)
      const list = kid(fc, ns, 'filters')
      if (list) {
        const keep = kids(list, ns, 'filter').map((f) => attr(f, 'val') || '')
        if (attr(list, 'blank') === '1' || attr(list, 'blank') === 'true') keep.push('')
        ;(sheet.savedFilter ||= []).push({ col, keep })
      } else if (fc.children.some((x) => isEl(x))) lose('filter rules other than a list of values')
    }
  }
  // Conditional formatting.
  readConditional(el, ns, st, theme, sheet, lose)
  // Data validation.
  for (const dv of kids(kid(el, ns, 'dataValidations'), ns, 'dataValidation')) {
    const type = attr(dv, 'type') || ''
    const sqref = attr(dv, 'sqref') || ''
    const f1 = textOf(kid(dv, ns, 'formula1'))
    const f2 = textOf(kid(dv, ns, 'formula2'))
    for (const range of sqref.split(/\s+/).filter(Boolean)) {
      const v: Validation = { range, kind: 'custom', allowBlank: attr(dv, 'allowBlank') === '1', prompt: attr(dv, 'prompt'), error: attr(dv, 'error') }
      if (type === 'list') {
        v.kind = 'list'
        if (/^".*"$/s.test(f1)) v.list = f1.slice(1, -1).split(',').map((x) => x.trim())
        else v.source = '=' + cleanFormula(f1)
        // A short literal list becomes an in-cell dropdown control, the same as one made here.
        const box = parseRange(range)
        if (box && v.list && (box.r1 - box.r0 + 1) * (box.c1 - box.c0 + 1) <= 5000) {
          for (let rr = box.r0; rr <= box.r1; rr++) for (let cc = box.c0; cc <= box.c1; cc++) {
            const k = cellKey(rr, cc)
            const cur = cells[k] || { input: '' }
            cells[k] = { ...cur, fmt: { ...(cur.fmt || {}), control: { kind: 'dropdown', options: v.list } } }
          }
        }
      } else if (['whole', 'decimal', 'date', 'textLength', 'custom', 'time'].includes(type)) {
        v.kind = type === 'time' ? 'custom' : (type as Validation['kind'])
        v.op = attr(dv, 'operator') || 'between'
        v.f1 = f1 ? cleanFormula(f1) : undefined
        v.f2 = f2 ? cleanFormula(f2) : undefined
      } else continue
      ;(sheet.validations ||= []).push(v)
    }
  }
  // Hyperlinks.
  for (const h of kids(kid(el, ns, 'hyperlinks'), ns, 'hyperlink')) {
    const ref = attr(h, 'ref')
    const a = ref ? parseA1(ref.split(':')[0]) : null
    if (!a) continue
    const rid = attr(h, 'id', R)
    let target = ''
    if (rid) target = (await pkg.relById(part, rid))?.target || ''
    else if (attr(h, 'location')) target = '#' + attr(h, 'location')
    if (!target) continue
    const k = cellKey(a.row, a.col)
    cells[k] = { ...(cells[k] || { input: '' }), link: target }
  }
  // Comments (notes).
  for (const rel of await pkg.relsOfType(part, REL.comments)) {
    const cm = await pkg.tryXml(rel.target)
    if (!cm) continue
    const cns = sNs(cm)
    for (const c of findAll(cm, cns, 'comment')) {
      const a = parseA1(attr(c, 'ref') || '')
      if (!a) continue
      const text = findAll(c, cns, 't').map(textOf).join('').trim()
      const k = cellKey(a.row, a.col)
      cells[k] = { ...(cells[k] || { input: '' }), note: text }
    }
  }
  if ((await pkg.relsOfType(part, 'http://schemas.microsoft.com/office/2017/10/relationships/threadedComment')).length) lose('threaded comment replies (kept as notes)')
  // Drawings: pictures and charts.
  for (const rel of await pkg.relsOfType(part, REL.drawing)) await readDrawing(pkg, rel.target, sheet, theme, lose)
  const sp = find(el, ns, 'sheetProtection')
  if (sp && attr(sp, 'sheet') !== '0' && attr(sp, 'sheet') !== 'false') sheet.protect = protectionOf(sp, 'sheet')
  if (find(el, NS.x14, 'sparklineGroups')) lose('sparklines')
  for (const tp of kids(kid(el, ns, 'tableParts'), ns, 'tablePart')) {
    const rid = attr(tp, 'id', R)
    const rel = rid ? await pkg.relById(part, rid) : null
    const t = rel ? await pkg.tryXml(rel.target) : null
    if (!t || !attr(t, 'ref')) continue
    const tns = sNs(t)
    const si = kid(t, tns, 'tableStyleInfo')
    const yes = (e: XEl | null, k: string) => attr(e, k) === '1' || attr(e, k) === 'true'
    ;(sheet.tables ||= []).push({
      name: attr(t, 'displayName') || attr(t, 'name') || `Table${(sheet.tables?.length || 0) + 1}`,
      ref: attr(t, 'ref')!,
      style: attr(si, 'name'),
      header: attr(t, 'headerRowCount') !== '0',
      totals: Number(attr(t, 'totalsRowCount') || 0) > 0,
      rowStripes: yes(si, 'showRowStripes'), colStripes: yes(si, 'showColumnStripes'),
      firstCol: yes(si, 'showFirstColumn'), lastCol: yes(si, 'showLastColumn'),
      columns: kids(kid(t, tns, 'tableColumns'), tns, 'tableColumn').map((c) => attr(c, 'name') || ''),
    })
  }
  return sheet
}

function readConditional(el: XEl, ns: string, st: Styles, theme: ThemeColors, sheet: SheetData, lose: (w: string, n?: number) => void) {
  const conds: CondRule[] = []
  const scales: ScaleRule[] = []
  let dropped = 0
  for (const cf of kids(el, ns, 'conditionalFormatting')) {
    const ranges = (attr(cf, 'sqref') || '').split(/\s+/).filter(Boolean)
    for (const rule of kids(cf, ns, 'cfRule')) {
      const type = attr(rule, 'type')
      const dxf = st.dxfs[numAttr(rule, 'dxfId', -1)]
      if (type === 'colorScale' || type === 'dataBar') {
        const kind: ScaleRule['kind'] = type === 'dataBar' ? 'databar' : kids(kid(rule, ns, 'colorScale'), ns, 'cfvo').length === 3 ? 'scale3' : 'scale2'
        for (const r of ranges) { const box = parseRange(r); if (box) scales.push({ box, kind }) }
        continue
      }
      if (type === 'cellIs') {
        const op = attr(rule, 'operator')
        const f = textOf(kid(rule, ns, 'formula'))
        const map: Record<string, CondRule['op']> = { greaterThan: '>', lessThan: '<', equal: '=' }
        const our = op ? map[op] : undefined
        if (our && f !== '') {
          const n = Number(f)
          if (Number.isFinite(n)) { conds.push({ op: our, value: n, bg: dxf?.bg }); continue }
          if (our === '=' && /^".*"$/.test(f)) { conds.push({ op: 'eqText', value: f.slice(1, -1), bg: dxf?.bg }); continue }
        }
      }
      if (type === 'containsText' && attr(rule, 'text')) { conds.push({ op: 'contains', value: attr(rule, 'text')!, bg: dxf?.bg }); continue }
      dropped++
    }
  }
  if (conds.length) sheet.conds = conds
  if (scales.length) sheet.scales = scales
  if (dropped) lose('conditional formatting rules of other kinds', dropped)
  void theme
}

async function readDrawing(pkg: Package, part: string, sheet: SheetData, theme: ThemeColors, lose: (w: string, n?: number) => void) {
  const el = await pkg.tryXml(part)
  if (!el) return
  const X = NS.xdr
  const anchors = [...kids(el, X, 'twoCellAnchor'), ...kids(el, X, 'oneCellAnchor'), ...kids(el, X, 'absoluteAnchor')]
  let shapes = 0
  for (const an of anchors) {
    const from = kid(an, X, 'from')
    const to = kid(an, X, 'to')
    const at = (p: XEl | null) => ({ row: Number(textOf(kid(p, X, 'row')) || 0), col: Number(textOf(kid(p, X, 'col')) || 0), dx: Math.round(emuToPx(Number(textOf(kid(p, X, 'colOff')) || 0))), dy: Math.round(emuToPx(Number(textOf(kid(p, X, 'rowOff')) || 0))) })
    const anchor = from ? at(from) : { row: 0, col: 0, dx: 0, dy: 0 }
    const ext = kid(an, X, 'ext')
    let size = { w: 360, h: 240 }
    if (ext) size = { w: Math.round(emuToPx(numAttr(ext, 'cx', 0))), h: Math.round(emuToPx(numAttr(ext, 'cy', 0))) }
    else if (to) {
      const t = at(to)
      const colW = (c: number) => sheet.colWidths?.[c] ?? 100
      const rowH = (r: number) => sheet.rowHeights?.[r] ?? 20
      let w = -anchor.dx + t.dx
      for (let c = anchor.col; c < t.col; c++) w += colW(c)
      let h = -anchor.dy + t.dy
      for (let r = anchor.row; r < t.row; r++) h += rowH(r)
      size = { w: Math.max(20, w), h: Math.max(20, h) }
    }
    const pic = kid(an, X, 'pic')
    const frame = kid(an, X, 'graphicFrame')
    if (pic) {
      const blip = find(pic, NS.a, 'blip')
      const rid = attr(blip, 'embed', NS.r)
      const rel = rid ? await pkg.relById(part, rid) : undefined
      if (!rel || rel.external) { lose('linked pictures'); continue }
      const bytes = await pkg.bytes(rel.target).catch(() => null)
      const kind = bytes && sniffImage(bytes)
      if (!bytes || !kind || kind.ext === 'emf' || kind.ext === 'wmf') { lose('pictures in formats a browser cannot show (EMF/WMF)'); continue }
      const img: SheetImage = { id: 'img' + ((sheet.images?.length || 0) + 1), src: dataUrl(bytes, kind.mime), anchor, size, alt: attr(find(pic, X, 'cNvPr'), 'descr') }
      ;(sheet.images ||= []).push(img)
      continue
    }
    if (frame) {
      const chartRef = find(frame, NS.c, 'chart')
      const rid = attr(chartRef, 'id', NS.r)
      const rel = rid ? await pkg.relById(part, rid) : undefined
      if (!rel) { lose('embedded objects'); continue }
      const spec = await readChart(pkg, rel.target, sheet.name, anchor, size, theme)
      if (spec) (sheet.charts ||= []).push(spec)
      else lose('charts of other kinds')
      continue
    }
    shapes++
  }
  if (shapes) lose('shapes and text boxes', shapes)
}

async function readChart(pkg: Package, part: string, sheetName: string, anchor: { row: number; col: number }, size: { w: number; h: number }, theme: ThemeColors): Promise<ChartSpec | null> {
  const el = await pkg.tryXml(part)
  if (!el) return null
  const C = NS.c
  const plot = find(el, C, 'plotArea')
  if (!plot) return null
  const pick = (n: string) => kid(plot, C, n)
  let kind: ChartSpec['kind'] | null = null
  let group: XEl | null = null
  for (const [tag, k] of [['barChart', 'column'], ['bar3DChart', 'column'], ['lineChart', 'line'], ['line3DChart', 'line'], ['pieChart', 'pie'], ['pie3DChart', 'pie'], ['doughnutChart', 'doughnut'], ['areaChart', 'area'], ['scatterChart', 'scatter']] as const) {
    const g = pick(tag)
    if (g) { group = g; kind = k; break }
  }
  if (!group || !kind) return null
  if (kind === 'column' && attr(kid(group, C, 'barDir'), 'val') === 'bar') kind = 'bar'
  const grouping = attr(kid(group, C, 'grouping'), 'val')
  const series: NonNullable<ChartSpec['series']> = []
  for (const ser of kids(group, C, 'ser')) {
    const valF = textOf(find(kid(ser, C, kind === 'scatter' ? 'yVal' : 'val'), C, 'f'))
    const catF = textOf(find(kid(ser, C, kind === 'scatter' ? 'xVal' : 'cat'), C, 'f'))
    const txF = textOf(find(kid(ser, C, 'tx'), C, 'f'))
    const txV = textOf(find(kid(ser, C, 'tx'), C, 'v'))
    if (!valF) continue
    const srgb = find(kid(ser, C, 'spPr'), NS.a, 'srgbClr')
    const scheme = find(kid(ser, C, 'spPr'), NS.a, 'schemeClr')
    const color = srgb ? '#' + (attr(srgb, 'val') || '').toLowerCase() : scheme ? theme[(attr(scheme, 'val') || 'accent1') as keyof ThemeColors] : undefined
    series.push({ name: txV || (txF ? '=' + cleanFormula(txF) : undefined), cat: catF ? cleanFormula(catF) : undefined, val: cleanFormula(valF), color })
  }
  if (!series.length) return null
  const title = findAll(find(el, C, 'title'), NS.a, 't').map(textOf).join('')
  const legend = !!find(el, C, 'legend')
  // A single contiguous block on THIS sheet becomes a plain range, so it edits like one made here.
  const local = (ref: string) => { const m = /^(?:'?(.*?)'?!)?(\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?)$/.exec(ref); return m ? { sheet: m[1] || sheetName, a1: m[2].replace(/\$/g, '') } : null }
  let range = ''
  const cat = series[0].cat ? local(series[0].cat) : null
  const vals = series.map((s) => local(s.val))
  if (vals.every((v) => v && v.sheet === sheetName) && (!cat || cat.sheet === sheetName)) {
    const boxes = [cat, ...vals].filter(Boolean).map((v) => parseRange(v!.a1)!).filter(Boolean)
    if (boxes.length) {
      const r0 = Math.min(...boxes.map((b) => b.r0)), r1 = Math.max(...boxes.map((b) => b.r1))
      const c0 = Math.min(...boxes.map((b) => b.c0)), c1 = Math.max(...boxes.map((b) => b.c1))
      range = `${colToLetters(c0)}${Math.max(1, r0)}:${colToLetters(c1)}${r1 + 1}`
    }
  }
  return {
    id: 'ch' + Math.random().toString(36).slice(2, 8),
    kind,
    range: range || series[0].val,
    title: title || undefined,
    anchor: { row: anchor.row, col: anchor.col },
    size,
    series,
    stacked: grouping === 'stacked' || grouping === 'percentStacked',
    legend,
  }
}

/** Sanity: a workbook's used cells as A1 → input, for tests. */
export function dumpSheet(s: SheetData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, c] of Object.entries(s.cells)) {
    const [r, col] = k.split(',').map(Number)
    if (c.input) out[`${colToLetters(col)}${r + 1}`] = c.input
  }
  return out
}
