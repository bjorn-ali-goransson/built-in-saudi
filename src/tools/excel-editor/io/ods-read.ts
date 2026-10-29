// OpenDocument spreadsheets (.ods) — LibreOffice's native format, and what a lot
// of government and university machines save by default. Read here; written by
// ods-write.ts, so a sheet can go back where it came from.
//
// Four things the format does differently from .xlsx, all of which otherwise
// corrupt the import quietly:
//
// - **Repetition.** An empty run of 1,000 columns is ONE element with
//   `number-columns-repeated="1000"`, and a sheet commonly ends in a row
//   repeated 1,048,000 times. Expanding naively allocates a million rows; a
//   repeated EMPTY cell or row is skipped, and repeated content is capped.
// - **Formulas are OpenFormula**, `of:=SUM([.A1:.B2])` with sheet references as
//   `[$Sheet2.A1]` — translated in openformula.ts, both directions together.
// - **Values are typed by attribute**, not by the text: the visible text of a
//   date cell is "07/09/26", its value is in `office:date-value`.
// - **A cell's look can come from three places**: its own style, the row's
//   default, or the COLUMN's `default-cell-style-name`. A header row coloured by
//   column default is a coloured row only if the column default is consulted.
import { unzipText } from './unzip-text'
import { parseXml, kids, attr, textOf, isEl, type XEl } from '../../../lib/xml'
import { cellKey, type CellBorders, type CellFormat, type DefinedName, type SheetData, type WorkbookData } from '../engine/model'
import { dateToSerial } from '../engine/dates'
import { textInput } from './xlsx-read'
import { fromOpenFormula } from './openformula'

const T = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0'
const O = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0'
const TX = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
const ST = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0'
const FO = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0'
const NUM = 'urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0'
const XL = 'http://www.w3.org/1999/xlink'
const CFG = 'urn:oasis:names:tc:opendocument:xmlns:config:1.0'

export { fromOpenFormula } from './openformula'

/** A length as screen pixels (the editor's unit for widths and heights). */
function px(v: string | undefined): number | undefined {
  if (!v) return undefined
  const m = v.trim().match(/^(-?[\d.]+)(cm|mm|in|pt|pc|px)?$/)
  if (!m) return undefined
  const n = +m[1]
  const pt = m[2] === 'cm' ? n * 28.3465 : m[2] === 'mm' ? n * 2.83465 : m[2] === 'in' ? n * 72 : m[2] === 'pc' ? n * 12 : m[2] === 'px' ? n * 0.75 : n
  return Math.round(pt / 0.75)
}
const ptOf = (v: string | undefined) => { const m = v?.match(/^([\d.]+)pt$/); return m ? +m[1] : undefined }
const hex = (c: string | undefined) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : undefined)

interface OStyle { family: string; parent?: string; dataStyle?: string; props: Record<string, string> }
type NumInfo = Pick<CellFormat, 'numFmt' | 'decimals' | 'currency'>

class Styles {
  styles = new Map<string, OStyle>()
  data = new Map<string, NumInfo>()
  defaultSize = 10
  read(root: XEl | null) {
    if (!root) return
    const visit = (el: XEl) => {
      for (const c of el.children) {
        if (!isEl(c)) continue
        if (c.ns === ST && c.local === 'style') {
          const props: Record<string, string> = {}
          for (const p of kids(c)) for (const [k, v] of Object.entries(p.attrs)) props[k.replace(/^.*:/, '')] = v
          this.styles.set(`${attr(c, 'family', ST)}:${attr(c, 'name', ST)}`, { family: attr(c, 'family', ST) || '', parent: attr(c, 'parent-style-name', ST), dataStyle: attr(c, 'data-style-name', ST), props })
        } else if (c.ns === ST && c.local === 'default-style' && attr(c, 'family', ST) === 'table-cell') {
          const s = ptOf(attr(kids(c, ST, 'text-properties')[0], 'font-size', FO))
          if (s) this.defaultSize = s
        } else if (c.ns === NUM && /-style$/.test(c.local)) this.readData(c)
        else visit(c)
      }
    }
    visit(root)
  }
  /** A data style → our number preset. Only what maps exactly; the rest stays General. */
  readData(el: XEl) {
    const name = attr(el, 'name', ST)!
    const n = kids(el, NUM, 'number')[0]
    const dec = n ? +(attr(n, 'decimal-places', NUM) || '0') : undefined
    const group = attr(n, 'grouping', NUM) === 'true'
    const text = kids(el, NUM, 'text').map(textOf).join('').trim()
    const sym = kids(el, NUM, 'currency-symbol').map(textOf).join('').trim()
    let info: NumInfo | null = null
    if (el.local === 'percentage-style') info = { numFmt: 'percent', decimals: dec }
    else if (el.local === 'date-style') info = { numFmt: 'date' }
    else if (el.local === 'currency-style' || /^[A-Z]{3}$/.test(text)) info = { numFmt: 'currency', decimals: dec, currency: /^[A-Z]{3}$/.test(sym) ? sym : /^[A-Z]{3}$/.test(text) ? text : sym === '$' ? 'USD' : sym === '€' ? 'EUR' : 'SAR' }
    else if (el.local === 'number-style' && n) info = group ? { numFmt: 'thousands', decimals: dec } : { numFmt: 'number', decimals: dec }
    if (info) this.data.set(name, info)
  }
  /** A cell style, resolved through its parents, as our format. */
  format(name: string | undefined): CellFormat | undefined {
    if (!name) return undefined
    const chain: OStyle[] = []
    // The chain stops at `Default`: what every cell inherits from it is the sheet's
    // baseline (Calibri 11 in a file that began as .xlsx), not formatting anybody chose.
    for (let nm: string | undefined = name, n = 0; nm && nm !== 'Default' && n < 20; n++) {
      const s = this.styles.get(`table-cell:${nm}`)
      if (!s) break
      chain.push(s)
      nm = s.parent
    }
    if (!chain.length) return undefined
    const base = this.styles.get('table-cell:Default')?.props || {}
    const g = (k: string) => { for (const s of chain) if (s.props[k] !== undefined) return s.props[k]; return undefined }
    const f: CellFormat = {}
    const w = g('font-weight'); if (w === 'bold' || (w && +w >= 600)) f.bold = true
    if (g('font-style') === 'italic') f.italic = true
    const u = g('text-underline-style'); if (u && u !== 'none') f.underline = true
    const lt = g('text-line-through-style'); if (lt && lt !== 'none') f.strike = true
    const size = ptOf(g('font-size')); if (size && size !== this.defaultSize && size !== ptOf(base['font-size'])) f.fontSize = size
    const color = hex(g('color')); if (color && color !== '#000000') f.color = color
    const fam = (g('font-family') || g('font-name'))?.replace(/^'|'$/g, '')
    if (fam && fam !== (base['font-family'] || base['font-name'])?.replace(/^'|'$/g, '') && !/^Liberation Sans$|^Arial$/i.test(fam)) f.fontFamily = fam
    const bg = hex(g('background-color')); if (bg) f.bg = bg
    if (g('wrap-option') === 'wrap') f.wrap = true
    // Bottom is every spreadsheet's default, as the .xlsx reader treats it too.
    const va = g('vertical-align'); if (va === 'top' || va === 'middle') f.valign = va
    const ta = g('text-align'); if (ta === 'center') f.align = 'center'; else if (ta === 'end' || ta === 'right') f.align = 'end'; else if (ta === 'start' || ta === 'left') f.align = 'start'
    const ind = ptOf(g('margin-left')); if (ind) f.indent = Math.round(ind / 9)
    const rot = g('rotation-angle'); if (rot && +rot) f.rotate = ((+rot + 180) % 360) - 180
    const side = (k: string) => { const v = g(k) ?? g('border'); return !!v && v !== 'none' && !/^0(\.0+)?(pt|cm|in|mm)?\s/.test(v) }
    const b: CellBorders = {}
    if (side('border-top')) b.t = true
    if (side('border-right')) b.r = true
    if (side('border-bottom')) b.b = true
    if (side('border-left')) b.l = true
    if (Object.keys(b).length) f.border = b.t && b.r && b.b && b.l ? true : b
    const ds = chain.find((s) => s.dataStyle)?.dataStyle
    if (ds && this.data.has(ds)) Object.assign(f, this.data.get(ds))
    return Object.keys(f).length ? f : undefined
  }
  prop(family: string, name: string | undefined, key: string): string | undefined {
    for (let s = name ? this.styles.get(`${family}:${name}`) : undefined, n = 0; s && n < 20; s = s.parent ? this.styles.get(`${family}:${s.parent}`) : undefined, n++) if (s.props[key] !== undefined) return s.props[key]
    return undefined
  }
}

export async function readOds(buf: ArrayBuffer): Promise<{ book: WorkbookData; loss: { what: string; count: number }[] }> {
  const parts = await unzipText(buf, (n) => n === 'content.xml' || n === 'styles.xml' || n === 'settings.xml' || n === 'mimetype')
  const mt = parts.get('mimetype')
  if (mt !== undefined && !/opendocument\.spreadsheet/.test(mt)) throw new Error('not-ods')
  const xml = parts.get('content.xml')
  if (!xml) throw new Error('not-ods')
  const root = parseXml(xml)
  const st = new Styles()
  if (parts.get('styles.xml')) st.read(parseXml(parts.get('styles.xml')!))
  st.read(root)
  const body = kids(root, O, 'body')[0]
  const ss = kids(body, O, 'spreadsheet')[0]
  const sheets: SheetData[] = []
  const loss = new Map<string, number>()
  const lose = (w: string, n = 1) => loss.set(w, (loss.get(w) || 0) + n)
  for (const table of kids(ss, T, 'table')) {
    const name = attr(table, 'name', T) || `Sheet${sheets.length + 1}`
    const cells: SheetData['cells'] = {}
    const merges: string[] = []
    const colWidths: Record<number, number> = {}
    const rowHeights: Record<number, number> = {}
    const hiddenCols: number[] = []
    const hiddenRows: number[] = []
    const colDefault: (string | undefined)[] = []
    // Columns: widths, visibility, and the style their otherwise unstyled cells take.
    let ci = 0
    const cols = (el: XEl): XEl[] => kids(el).flatMap((c) => (c.local === 'table-column' ? [c] : c.local === 'table-columns' || c.local === 'table-header-columns' || c.local === 'table-column-group' ? cols(c) : []))
    for (const c of cols(table)) {
      const rep = Math.min(+(attr(c, 'number-columns-repeated', T) || '1'), 1024)
      const w = px(st.prop('table-column', attr(c, 'style-name', T), 'column-width'))
      const hid = attr(c, 'visibility', T) === 'collapse'
      const def = attr(c, 'default-cell-style-name', T)
      for (let j = 0; j < rep; j++) {
        // A width over a long run is the sheet's default column, not a choice about a column.
        if (w && rep <= 50 && Math.abs(w - 96) > 2 && ci + j < 200) colWidths[ci + j] = w
        if (hid && ci + j < 1024) hiddenCols.push(ci + j)
        colDefault[ci + j] = def === 'Default' ? undefined : def
      }
      ci += rep
    }
    let r = 0
    let maxC = 0
    let capped = 0
    for (const row of collectRows(table)) {
      const rep = Math.min(Number(attr(row, 'number-rows-repeated', T) || 1), 10_000)
      const rs = attr(row, 'style-name', T)
      const h = st.prop('table-row', rs, 'use-optimal-row-height') === 'false' ? px(st.prop('table-row', rs, 'row-height')) : undefined
      const hid = attr(row, 'visibility', T) === 'collapse'
      const cellEls = kids(row).filter((c) => c.ns === T && (c.local === 'table-cell' || c.local === 'covered-table-cell'))
      const empty = cellEls.every((c) => !c.children.length && !attr(c, 'value-type', O) && !attr(c, 'formula', T) && !hasLook(st, attr(c, 'style-name', T)))
      if (empty) {
        const n = Number(attr(row, 'number-rows-repeated', T) || 1)
        if (n < 1000) for (let k = 0; k < n; k++) { if (h && Math.abs(h - 24) > 2) rowHeights[r + k] = h; if (hid) hiddenRows.push(r + k) }
        r += n
        continue
      }
      if (rep > 1) capped++
      const rowDefault = attr(row, 'default-cell-style-name', T)
      for (let k = 0; k < rep; k++) {
        if (h && Math.abs(h - 24) > 2) rowHeights[r] = h
        if (hid) hiddenRows.push(r)
        let c = 0
        for (const cell of cellEls) {
          const crep = Number(attr(cell, 'number-columns-repeated', T) || 1)
          if (cell.local === 'table-cell') {
            const input = cellInput(cell)
            const styleName = attr(cell, 'style-name', T) || rowDefault || colDefault[c]
            const fmt = st.format(styleName === 'Default' ? undefined : styleName)
            const note = kids(cell, O, 'annotation').map((a) => kids(a, TX, 'p').map(textOf).join('\n')).join('\n').trim()
            const a = kids(cell, TX, 'p').flatMap((p) => findLinks(p))[0]
            const link = a && (/^(https?:|mailto:)/i.test(a) ? a : a.startsWith('#') ? '#' + a.slice(1).replace(/^\$/, '').replace('.', '!') : undefined)
            // A styled empty cell is kept when the run is short: a coloured header band
            // is part of the sheet. A styled run of a thousand is a whole-column style.
            const keep = input !== '' || note || (fmt && crep <= 64)
            if (keep) {
              for (let j = 0; j < Math.min(crep, 1000); j++) {
                const v: SheetData['cells'][string] = { input }
                if (fmt) v.fmt = fmt
                if (note) v.note = note
                if (link) v.link = link
                cells[cellKey(r, c + j)] = v
                maxC = Math.max(maxC, c + j + 1)
              }
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
    if (capped) lose('very long repeated rows (capped)', capped)
    const tstyle = attr(table, 'style-name', T)
    const sheet: SheetData = { name, cells, rows: Math.max(100, r + 20), cols: Math.max(26, maxC + 4) }
    if (merges.length) sheet.merges = merges
    if (Object.keys(colWidths).length) sheet.colWidths = colWidths
    if (Object.keys(rowHeights).length) sheet.rowHeights = rowHeights
    if (hiddenCols.length && hiddenCols.length < 1000) sheet.hiddenCols = hiddenCols
    if (hiddenRows.length) sheet.hiddenRows = hiddenRows
    if (st.prop('table', tstyle, 'writing-mode')?.startsWith('rl')) sheet.rtl = true
    if (st.prop('table', tstyle, 'display') === 'false') sheet.hidden = true
    const tab = hex(st.prop('table', tstyle, 'tab-color')); if (tab) sheet.tabColor = tab
    const shapes = kids(table, T, 'shapes')[0]
    if (shapes) for (const f of kids(shapes)) lose(kids(f).some((c) => c.local === 'object') ? 'charts' : 'pictures and drawings')
    if (kids(table).some((c) => c.local === 'conditional-formats')) lose('conditional formatting')
    sheets.push(sheet)
  }
  // Frozen panes and the open sheet are Calc's view settings, not part of the content.
  let active: number | undefined
  const settings = parts.get('settings.xml')
  if (settings) {
    const items = (el: XEl) => Object.fromEntries(kids(el, CFG, 'config-item').map((i) => [attr(i, 'name', CFG), textOf(i)]))
    const walk = (el: XEl) => {
      for (const c of kids(el)) {
        if (c.local === 'config-item-map-named' && attr(c, 'name', CFG) === 'Tables') {
          for (const e of kids(c, CFG, 'config-item-map-entry')) {
            const sh = sheets.find((s) => s.name === attr(e, 'name', CFG))
            const it = items(e)
            const fc = it.HorizontalSplitMode === '2' ? +it.HorizontalSplitPosition || 0 : 0
            const fr = it.VerticalSplitMode === '2' ? +it.VerticalSplitPosition || 0 : 0
            if (sh && (fc || fr)) sh.freeze = { rows: fr, cols: fc }
          }
        } else if (c.local === 'config-item' && attr(c, 'name', CFG) === 'ActiveTable') {
          const i = sheets.findIndex((s) => s.name === textOf(c))
          if (i > 0) active = i
        } else walk(c)
      }
    }
    walk(parseXml(settings))
  }
  // Named ranges and expressions.
  const names: DefinedName[] = []
  for (const ne of kids(ss, T, 'named-expressions')) {
    for (const n of kids(ne)) {
      const nm = attr(n, 'name', T)
      const ref = n.local === 'named-range' ? attr(n, 'cell-range-address', T) : attr(n, 'expression', T)
      if (!nm || !ref) continue
      names.push({ name: nm, ref: fromOpenFormula(n.local === 'named-range' ? `[${ref}]` : ref) })
    }
  }
  const book: WorkbookData = { sheets: sheets.length ? sheets : [{ name: 'Sheet1', cells: {}, rows: 100, cols: 26 }] }
  if (names.length) book.names = names
  if (active !== undefined) book.active = active
  return { book, loss: [...loss].map(([what, count]) => ({ what, count })) }
}

/** Whether a style changes how an empty cell LOOKS — what makes it worth keeping. */
function hasLook(st: Styles, name: string | undefined): boolean {
  if (!name || name === 'Default') return false
  const f = st.format(name)
  return !!(f && (f.bg || f.border))
}

function findLinks(el: XEl): string[] {
  const out: string[] = []
  for (const c of kids(el)) {
    if (c.ns === TX && c.local === 'a') { const h = attr(c, 'href', XL); if (h) out.push(h) }
    else out.push(...findLinks(c))
  }
  return out
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
