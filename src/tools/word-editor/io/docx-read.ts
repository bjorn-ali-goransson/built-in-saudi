// .docx → the editor's document, read straight from the Office Open XML.
//
// Worker-safe: no DOM, no mammoth, no HTML in between. Going through HTML is
// the usual shortcut and it loses exactly the things this reader exists to
// keep — a list's real numbering and start, merged table cells, a paragraph's
// direction — because the HTML step guesses and every later step inherits the
// guess.
//
// What does not come across is COUNTED, by kind, and handed back as a loss
// ledger the editor shows: comments, tracked deletions, text boxes, charts,
// equations. A converter that drops things silently is the failure to avoid.
import { Package, NS, REL, relIs, sniffImage, dataUrl, OpcError, readTitle, EMU_PER_PX } from '../../../lib/office/opc'
import { kids, kid, attr, textOf, isEl, type XEl } from '../../../lib/xml'
import type { Float, Borders, TabStop } from '../schema'
import { A4, type PMNode, type PMMark, type WordData, type PageSetup, type ListKind, isRtlText } from '../model'

export interface Loss { what: string; count: number }
export interface DocxImport { data: WordData; loss: Loss[]; title: string }

const TWIP_PER_MM = 1440 / 25.4

interface RunProps {
  b?: boolean; i?: boolean; u?: boolean; strike?: boolean; sup?: boolean; sub?: boolean
  color?: string; highlight?: string; size?: number; font?: string; fontCs?: string; sizeCs?: number; bCs?: boolean; iCs?: boolean; caps?: boolean
}
interface ParaProps {
  align?: string; bidi?: boolean; left?: number; firstLine?: number; before?: number; after?: number; line?: number
  /** A fixed line rule and its pitch in points; set together with `line` so one level overrides the other. */
  lineRule?: 'exact' | 'atLeast'; linePt?: number
  /** Word's "don't add space between paragraphs of the same style". */
  contextual?: boolean
  /** The space before is HTML auto spacing, which the first paragraph of a container does not get. */
  autoBefore?: boolean
  numId?: string; ilvl?: number; pageBreakBefore?: boolean; outline?: number
  borders?: Borders; tabs?: TabStop[]
}
interface Style { id: string; name: string; type: string; basedOn?: string; run: RunProps; para: ParaProps; grid?: boolean; cellMar?: (number | undefined)[] }
/** `left` is the level's text indent in twips, from the numbering definition. */
interface Level { fmt: string; start: number; text: string; left?: number }
interface Numbering { abstracts: Map<string, Level[]>; nums: Map<string, { abs: string; starts: Map<number, number> }> }

const HIGHLIGHT: Record<string, string> = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080',
  darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff',
}

const FMT_KIND: Record<string, ListKind> = {
  decimal: 'decimal', decimalZero: 'decimal', lowerLetter: 'lower-alpha', upperLetter: 'upper-alpha', lowerRoman: 'lower-roman', upperRoman: 'upper-roman',
  arabicAlpha: 'arabic-abjad', arabicAbjad: 'arabic-abjad', hindiNumbers: 'arabic-indic', hindiVowels: 'arabic-indic', arabicDecimal: 'arabic-indic',
}

class Reader {
  W: string = NS.w
  R: string = NS.r
  styles = new Map<string, Style>()
  defaultRun: RunProps = {}
  defaultPara: ParaProps = {}
  /** The style a paragraph with no pStyle has: the one marked w:default, "Normal" in practice. */
  defaultStyle: string | undefined
  defaultTable: string | undefined
  /** The run properties body text has with no formatting of its own — the document's font and size. */
  baseRun: RunProps = {}
  /** Theme fonts, for runs that name `minorHAnsi` rather than a face. */
  theme: { major?: string; minor?: string; majorCs?: string; minorCs?: string } = {}
  /** Whether there was a styles part: with none, the face is Calibri; with one that names none, Times New Roman. */
  hasStyles = false
  /** Automatic space before is not applied to the first paragraph of a document, cell or box. */
  firstInContainer = false
  /** The previous paragraph in this container, for contextual spacing. */
  lastPara: { node: PMNode; style: string; ctx: boolean } | null = null
  numbering: Numbering = { abstracts: new Map(), nums: new Map() }
  loss = new Map<string, number>()
  footnotes = new Map<string, string>()
  endnotes = new Map<string, string>()
  counters = new Map<string, number[]>()
  images = 0
  imageBytes = 0
  boxes = 0
  /** The text column, in CSS pixels — what a floating object's offset is measured against. */
  page: PageSetup = A4

  constructor(public pkg: Package, public main: string) {}

  lose(what: string, n = 1) { this.loss.set(what, (this.loss.get(what) || 0) + n) }
  w(el: XEl | null | undefined, local: string): XEl | null { return kid(el, this.W, local) }
  ws(el: XEl | null | undefined, local: string): XEl[] { return kids(el, this.W, local) }
  val(el: XEl | null | undefined): string | undefined { return attr(el, 'val', this.W) }
  on(el: XEl | null | undefined): boolean | undefined {
    if (!el) return undefined
    const v = this.val(el)
    return v === undefined ? true : !(v === '0' || v === 'false' || v === 'off' || v === 'none')
  }

  // ---- styles -----------------------------------------------------------------------
  runProps(rPr: XEl | null): RunProps {
    const p: RunProps = {}
    if (!rPr) return p
    const set = <K extends keyof RunProps>(k: K, v: RunProps[K] | undefined) => { if (v !== undefined) p[k] = v }
    set('b', this.on(this.w(rPr, 'b')))
    set('bCs', this.on(this.w(rPr, 'bCs')))
    set('i', this.on(this.w(rPr, 'i')))
    set('iCs', this.on(this.w(rPr, 'iCs')))
    const u = this.w(rPr, 'u')
    if (u) p.u = this.val(u) !== 'none'
    const st = this.on(this.w(rPr, 'strike')) ?? this.on(this.w(rPr, 'dstrike'))
    set('strike', st)
    const va = this.val(this.w(rPr, 'vertAlign'))
    if (va) { p.sup = va === 'superscript'; p.sub = va === 'subscript' }
    const color = this.val(this.w(rPr, 'color'))
    if (color && color !== 'auto' && /^[0-9a-f]{6}$/i.test(color)) p.color = '#' + color.toLowerCase()
    const hl = this.val(this.w(rPr, 'highlight'))
    if (hl && hl !== 'none' && HIGHLIGHT[hl]) p.highlight = HIGHLIGHT[hl]
    const shd = attr(this.w(rPr, 'shd'), 'fill', this.W)
    if (!p.highlight && shd && shd !== 'auto' && /^[0-9a-f]{6}$/i.test(shd)) p.highlight = '#' + shd.toLowerCase()
    const sz = Number(this.val(this.w(rPr, 'sz')))
    if (sz) p.size = sz / 2
    const szCs = Number(this.val(this.w(rPr, 'szCs')))
    if (szCs) p.sizeCs = szCs / 2
    const f = this.w(rPr, 'rFonts')
    if (f) {
      const th = (v: string | undefined) => (!v ? undefined : /^major/.test(v) ? (/Bidi$/.test(v) ? this.theme.majorCs : this.theme.major) : /^minor/.test(v) ? (/Bidi$/.test(v) ? this.theme.minorCs : this.theme.minor) : undefined)
      // A named face wins over a theme reference, as in Word; a theme reference is resolved to its face.
      const ascii = attr(f, 'ascii', this.W) || attr(f, 'hAnsi', this.W) || th(attr(f, 'asciiTheme', this.W) || attr(f, 'hAnsiTheme', this.W))
      const cs = attr(f, 'cs', this.W) || th(attr(f, 'cstheme', this.W))
      if (ascii) p.font = ascii
      if (cs) p.fontCs = cs
    }
    set('caps', this.on(this.w(rPr, 'caps')))
    return p
  }
  paraProps(pPr: XEl | null): ParaProps {
    const p: ParaProps = {}
    if (!pPr) return p
    const jc = this.val(this.w(pPr, 'jc'))
    if (jc) p.align = jc
    const bidi = this.on(this.w(pPr, 'bidi'))
    if (bidi !== undefined) p.bidi = bidi
    const ind = this.w(pPr, 'ind')
    if (ind) {
      const left = attr(ind, 'start', this.W) ?? attr(ind, 'left', this.W)
      if (left !== undefined) p.left = Number(left) || 0
      const fl = attr(ind, 'firstLine', this.W)
      const hang = attr(ind, 'hanging', this.W)
      if (fl !== undefined) p.firstLine = Number(fl) || 0
      else if (hang !== undefined) p.firstLine = -(Number(hang) || 0)
    }
    const sp = this.w(pPr, 'spacing')
    if (sp) {
      const b = attr(sp, 'before', this.W)
      const a = attr(sp, 'after', this.W)
      const line = attr(sp, 'line', this.W)
      const rule = attr(sp, 'lineRule', this.W)
      if (b !== undefined) p.before = Number(b) / 20
      if (a !== undefined) p.after = Number(a) / 20
      // A rule with no value (Google Docs writes `lineRule="auto"` alone) is single spacing, as
      // LibreOffice reads it — not the inherited multiple.
      if (line === undefined && rule) { p.line = 1; p.lineRule = undefined; p.linePt = undefined }
      if (line !== undefined) {
        // All three are written, so a paragraph's own rule replaces its style's rather than mixing with it.
        if (rule === 'exact' || rule === 'atLeast') { p.line = undefined; p.lineRule = rule; p.linePt = Math.round((Math.abs(Number(line)) / 20) * 100) / 100 }
        else { p.line = Math.round((Number(line) / 240) * 1000) / 1000; p.lineRule = undefined; p.linePt = undefined }
      }
      // "Auto" spacing is Word's HTML spacing: 14pt, whatever the number beside it says.
      if (attr(sp, 'beforeAutospacing', this.W) && /^(1|true|on)$/.test(attr(sp, 'beforeAutospacing', this.W)!)) { p.before = 14; p.autoBefore = true }
      if (attr(sp, 'afterAutospacing', this.W) && /^(1|true|on)$/.test(attr(sp, 'afterAutospacing', this.W)!)) p.after = 14
    }
    const ctx = this.on(this.w(pPr, 'contextualSpacing'))
    if (ctx !== undefined) p.contextual = ctx
    const num = this.w(pPr, 'numPr')
    if (num) {
      const id = this.val(this.w(num, 'numId'))
      if (id !== undefined) p.numId = id
      const l = this.val(this.w(num, 'ilvl'))
      if (l !== undefined) p.ilvl = Number(l) || 0
    }
    if (this.on(this.w(pPr, 'pageBreakBefore'))) p.pageBreakBefore = true
    const ol = this.val(this.w(pPr, 'outlineLvl'))
    if (ol !== undefined) p.outline = Number(ol)
    const bdr = this.w(pPr, 'pBdr')
    if (bdr) p.borders = this.borders(bdr)
    const tabs = this.w(pPr, 'tabs')
    if (tabs) {
      p.tabs = this.ws(tabs, 'tab').flatMap((t): TabStop[] => {
        const v = attr(t, 'val', this.W) || 'left'
        const pos = Number(attr(t, 'pos', this.W))
        if (v === 'clear' || v === 'bar' || !Number.isFinite(pos)) return []
        const align = v === 'right' || v === 'end' ? 'right' : v === 'center' ? 'center' : v === 'decimal' ? 'decimal' : 'left'
        const leader = attr(t, 'leader', this.W)
        return [{ pos: round1(pos / 20), align, ...(leader && leader !== 'none' ? { leader: leader === 'dot' || leader === 'middleDot' ? 'dot' : leader === 'hyphen' ? 'hyphen' : 'line' } : {}) }]
      })
    }
    return p
  }
  /** The four sides of a paragraph's border; a side that is none or nil is absent. Widths in points. */
  borders(bdr: XEl): Borders {
    const out: Borders = {}
    const side = (k: string) => {
      const e = this.w(bdr, k)
      const v = attr(e, 'val', this.W)
      if (!e || !v || v === 'none' || v === 'nil') return undefined
      const c = attr(e, 'color', this.W)
      return { w: Math.max(0.25, Number(attr(e, 'sz', this.W) || 4) / 8), c: c && /^[0-9a-f]{6}$/i.test(c) ? '#' + c.toLowerCase() : '#000000', s: Number(attr(e, 'space', this.W) || 0), ...(v === 'double' ? { d: true } : {}) }
    }
    const t = side('top'), b = side('bottom'), l = side('left') ?? side('start'), r = side('right') ?? side('end')
    if (t) out.t = t
    if (b) out.b = b
    if (l) out.l = l
    if (r) out.r = r
    return out
  }
  /** Whether a table draws lines: its own tblBorders, else its style's, else none (Word's "Normal Table"). */
  tableHasGrid(tblPr: XEl | null): boolean {
    const own = this.w(tblPr, 'tblBorders')
    if (own) return this.anyBorder(own)
    const st = this.val(this.w(tblPr, 'tblStyle'))
    let cur = st
    const seen = new Set<string>()
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      const s = this.styles.get(cur)
      if (!s) break
      if (s.grid !== undefined) return s.grid
      cur = s.basedOn
    }
    // A style named like Word's own grid, missing from styles.xml, still means lines.
    return !!st && /grid/i.test(st)
  }
  /** A tblCellMar as [top, right, bottom, left] in points, a side left undefined where it says nothing. */
  cellMar(el: XEl | null): (number | undefined)[] | undefined {
    if (!el) return undefined
    const side = (...names: string[]) => {
      for (const n of names) {
        const e = this.w(el, n)
        if (!e) continue
        const t = attr(e, 'type', this.W)
        const v = Number(attr(e, 'w', this.W))
        if (Number.isFinite(v) && (!t || t === 'dxa')) return v / 20
      }
      return undefined
    }
    return [side('top'), side('right', 'end'), side('bottom'), side('left', 'start')]
  }
  /**
   * The cell padding a table draws with: its own tblCellMar, else its style's, else Word's — 0 above
   * and below, 5.4pt at the sides. Padding the editor's own 3pt above and below made every row of a
   * real table six points taller than Word lays it, which on a long table is pages.
   */
  tablePad(tblPr: XEl | null): string {
    const out: (number | undefined)[] = [undefined, undefined, undefined, undefined]
    const fill = (m: (number | undefined)[] | undefined) => m?.forEach((v, i) => { if (out[i] === undefined && v !== undefined) out[i] = v })
    fill(this.cellMar(this.w(tblPr, 'tblCellMar')))
    let cur = this.val(this.w(tblPr, 'tblStyle'))
    const seen = new Set<string>()
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      const s = this.styles.get(cur)
      if (!s) break
      fill(s.cellMar)
      cur = s.basedOn
    }
    // The default table style (Normal Table) carries Word's defaults when nothing above did.
    if (this.defaultTable) fill(this.styles.get(this.defaultTable)?.cellMar)
    fill([0, 5.4, 0, 5.4])
    return out.map((v) => +(v as number).toFixed(2)).join(' ')
  }
  anyBorder(el: XEl): boolean {
    return kids(el).some((e) => e.ns === this.W && (() => { const v = attr(e, 'val', this.W); return !!v && v !== 'none' && v !== 'nil' })())
  }
  async readStyles() {
    const rel = (await this.pkg.relsOfType(this.main, REL.styles))[0]
    const root = rel ? await this.pkg.tryXml(rel.target) : null
    if (!root) return
    this.hasStyles = true
    await this.readTheme()
    const dd = this.w(root, 'docDefaults')
    this.defaultRun = this.runProps(this.w(this.w(dd, 'rPrDefault'), 'rPr'))
    this.defaultPara = this.paraProps(this.w(this.w(dd, 'pPrDefault'), 'pPr'))
    for (const s of this.ws(root, 'style')) {
      const id = attr(s, 'styleId', this.W)
      if (!id) continue
      this.styles.set(id, {
        id,
        name: this.val(this.w(s, 'name')) || id,
        type: attr(s, 'type', this.W) || 'paragraph',
        basedOn: this.val(this.w(s, 'basedOn')),
        run: this.runProps(this.w(s, 'rPr')),
        para: this.paraProps(this.w(s, 'pPr')),
        grid: (() => { const b = this.w(this.w(s, 'tblPr'), 'tblBorders'); return b ? this.anyBorder(b) : undefined })(),
        cellMar: this.cellMar(this.w(this.w(s, 'tblPr'), 'tblCellMar')),
      })
      if (attr(s, 'type', this.W) === 'paragraph' && /^(1|true|on)$/.test(attr(s, 'default', this.W) || '')) this.defaultStyle = id
      if (attr(s, 'type', this.W) === 'table' && /^(1|true|on)$/.test(attr(s, 'default', this.W) || '')) this.defaultTable = id
    }
    this.baseRun = { ...this.defaultRun, ...this.chain(this.defaultStyle).run }
  }
  async readTheme() {
    const rel = (await this.pkg.relsOfType(this.main, REL.theme))[0]
    const root = rel ? await this.pkg.tryXml(rel.target) : null
    if (!root) return
    const face = (local: string, script: string) => { const f = findLocal(root, local); const e = f ? kids(f).find((k) => k.local === script) : undefined; const t = e ? attr(e, 'typeface') : undefined; return t || undefined }
    this.theme = { major: face('majorFont', 'latin'), minor: face('minorFont', 'latin'), majorCs: face('majorFont', 'cs'), minorCs: face('minorFont', 'cs') }
  }
  /** A style's properties with everything it is based on underneath. */
  chain(id: string | undefined): { run: RunProps; para: ParaProps; names: string[] } {
    const list: Style[] = []
    const seen = new Set<string>()
    let cur = id
    while (cur && !seen.has(cur) && list.length < 20) {
      seen.add(cur)
      const s = this.styles.get(cur)
      if (!s) break
      list.unshift(s)
      cur = s.basedOn
    }
    const run: RunProps = {}
    const para: ParaProps = {}
    for (const s of list) { Object.assign(run, s.run); Object.assign(para, s.para) }
    return { run, para, names: list.map((s) => s.name) }
  }
  headingLevel(styleId: string | undefined, para: ParaProps): number {
    if (!styleId) return para.outline !== undefined && para.outline < 6 ? para.outline + 1 : 0
    const s = this.styles.get(styleId)
    const name = (s?.name || styleId).toLowerCase().replace(/\s+/g, ' ')
    const m = name.match(/^heading ?(\d)$/)
    if (m) return Math.min(6, Math.max(1, +m[1]))
    if (name === 'title') return 1
    if (name === 'subtitle') return 2
    const ch = this.chain(styleId)
    if (ch.para.outline !== undefined && ch.para.outline < 6) return ch.para.outline + 1
    for (const n of ch.names) { const mm = n.toLowerCase().match(/^heading ?(\d)$/); if (mm) return Math.min(6, +mm[1]) }
    return 0
  }
  styleNameIs(styleId: string | undefined, re: RegExp): boolean {
    if (!styleId) return false
    return this.chain(styleId).names.some((n) => re.test(n))
  }

  // ---- numbering --------------------------------------------------------------------
  async readNumbering() {
    const rel = (await this.pkg.relsOfType(this.main, REL.numbering))[0]
    const root = rel ? await this.pkg.tryXml(rel.target) : null
    if (!root) return
    const links: [string, string][] = []
    for (const a of this.ws(root, 'abstractNum')) {
      const id = attr(a, 'abstractNumId', this.W)
      if (id === undefined) continue
      const levels: Level[] = Array.from({ length: 9 }, () => ({ fmt: 'decimal', start: 1, text: '' }))
      for (const l of this.ws(a, 'lvl')) {
        const i = Number(attr(l, 'ilvl', this.W) || 0)
        if (i < 0 || i > 8) continue
        const ind = this.w(this.w(l, 'pPr'), 'ind')
        const left = attr(ind, 'start', this.W) ?? attr(ind, 'left', this.W)
        levels[i] = { fmt: this.val(this.w(l, 'numFmt')) || 'decimal', start: Number(this.val(this.w(l, 'start')) || 1), text: this.val(this.w(l, 'lvlText')) || '', ...(left !== undefined ? { left: Number(left) || 0 } : {}) }
      }
      this.numbering.abstracts.set(id, levels)
      const link = this.val(this.w(a, 'numStyleLink'))
      if (link) links.push([id, link])
    }
    for (const n of this.ws(root, 'num')) {
      const id = attr(n, 'numId', this.W)
      const abs = this.val(this.w(n, 'abstractNumId'))
      if (id === undefined || abs === undefined) continue
      const starts = new Map<number, number>()
      for (const o of this.ws(n, 'lvlOverride')) {
        const l = Number(attr(o, 'ilvl', this.W) || 0)
        const s = this.val(this.w(o, 'startOverride')) ?? this.val(this.w(this.w(o, 'lvl'), 'start'))
        if (s !== undefined) starts.set(l, Number(s))
      }
      this.numbering.nums.set(id, { abs, starts })
    }
    // An abstract list that only links to a numbering style takes that style's levels.
    for (const [aid, styleId] of links) {
      const numId = this.chain(styleId).para.numId
      const target = numId ? this.numbering.nums.get(numId)?.abs : undefined
      if (target && target !== aid && this.numbering.abstracts.has(target)) this.numbering.abstracts.set(aid, this.numbering.abstracts.get(target)!)
    }
  }
  level(numId: string, ilvl: number): Level | null {
    const n = this.numbering.nums.get(numId)
    if (!n) return null
    const lv = this.numbering.abstracts.get(n.abs)?.[ilvl]
    if (!lv) return null
    return { ...lv, start: n.starts.get(ilvl) ?? lv.start }
  }

  // ---- notes ------------------------------------------------------------------------
  async readNotes(type: string, into: Map<string, string>, tag: string) {
    const rel = (await this.pkg.relsOfType(this.main, type))[0]
    const root = rel ? await this.pkg.tryXml(rel.target) : null
    if (!root) return
    for (const n of this.ws(root, tag)) {
      const id = attr(n, 'id', this.W)
      const t = attr(n, 'type', this.W)
      if (id === undefined || (t && t !== 'normal')) continue
      into.set(id, this.ws(n, 'p').map((p) => this.plain(p)).join('\n').trim())
    }
  }
  plain(el: XEl): string {
    let s = ''
    const walk = (e: XEl) => {
      for (const c of e.children) {
        if (!isEl(c)) continue
        if (c.ns === this.W && c.local === 't') s += textOf(c)
        else if (c.ns === this.W && c.local === 'tab') s += '\t'
        else if (c.ns === this.W && (c.local === 'br' || c.local === 'cr')) s += '\n'
        else if (c.ns === this.W && (c.local === 'instrText' || c.local === 'delText')) continue
        else walk(c)
      }
    }
    walk(el)
    return s
  }

  // ---- blocks -----------------------------------------------------------------------
  async blocks(parent: XEl, partPath: string): Promise<PMNode[]> {
    const out: PMNode[] = []
    const items: { node: PMNode; list?: { numId: string; ilvl: number; level: Level; left?: number } }[] = []
    const children = this.flatten(parent)
    // Contextual spacing looks at the paragraph before, in THIS container: a cell's first
    // paragraph has none, and neither has the paragraph after a table.
    const outer = this.lastPara
    const outerFirst = this.firstInContainer
    this.lastPara = null
    this.firstInContainer = true
    for (const c of children) {
      if (c.ns !== this.W) continue
      if (c.local === 'p') {
        for (const it of await this.paragraph(c, partPath)) items.push(it)
      } else if (c.local === 'tbl') { items.push({ node: await this.table(c, partPath) }); this.lastPara = null }
      else if (c.local === 'sectPr') continue
    }
    this.lastPara = outer
    this.firstInContainer = outerFirst
    this.nestLists(items, out)
    return out
  }
  /** Unwrap containers that only group blocks: content controls, custom XML, alternate content. */
  flatten(parent: XEl): XEl[] {
    const out: XEl[] = []
    for (const c of parent.children) {
      if (!isEl(c)) continue
      if (c.ns === this.W && c.local === 'sdt') { const content = this.w(c, 'sdtContent'); if (content) out.push(...this.flatten(content)); continue }
      if (c.ns === this.W && (c.local === 'customXml' || c.local === 'smartTag')) { out.push(...this.flatten(c)); continue }
      if (c.ns === NS.mc && c.local === 'AlternateContent') { const pick = kid(c, NS.mc, 'Fallback') || kid(c, NS.mc, 'Choice'); if (pick) out.push(...this.flatten(pick)); continue }
      out.push(c)
    }
    return out
  }

  nestLists(items: { node: PMNode; list?: { numId: string; ilvl: number; level: Level; left?: number } }[], out: PMNode[]) {
    type Open = { level: number; list: PMNode; numId: string; left: number }
    const stack: Open[] = []
    for (const it of items) {
      if (!it.list) { stack.length = 0; out.push(it.node); continue }
      const { ilvl, level, numId } = it.list
      const bullet = level.fmt === 'bullet' || level.fmt === 'none'
      const type = bullet ? 'bullet_list' : 'ordered_list'
      while (stack.length && stack[stack.length - 1].level > ilvl) stack.pop()
      let top = stack[stack.length - 1]
      if (top && top.level === ilvl && (top.list.type !== type || (top.numId !== numId && ilvl === 0))) { stack.pop(); top = stack[stack.length - 1] }
      // Word numbers a list across interruptions: the same numId later on carries on counting.
      const counts = this.counters.get(numId) || []
      counts[ilvl] = (counts[ilvl] ?? level.start - 1) + 1
      for (let k = ilvl + 1; k < counts.length; k++) counts[k] = undefined as unknown as number
      this.counters.set(numId, counts)
      if (!top || top.level < ilvl) {
        const attrs: Record<string, unknown> = bullet ? {} : { order: counts[ilvl], kind: FMT_KIND[level.fmt] || 'decimal' }
        const checklist = bullet && /^[☐☑☒]/.test(firstText(it.node))
        if (checklist) attrs.checklist = true
        // The text indent the numbering gives this level (or the paragraph's own, which wins), as
        // padding relative to the list it sits in: lists here nest inside the item above them.
        const left = it.list.left ?? level.left
        if (left !== undefined) attrs.pad = Math.max(0, Math.round(((left - (top?.left ?? 0)) / 20) * 100) / 100)
        const list: PMNode = { type, attrs, content: [] }
        if (top) {
          const parentItem = top.list.content![top.list.content!.length - 1]
          parentItem.content!.push(list)
        } else out.push(list)
        stack.push({ level: ilvl, list, numId, left: it.list.left ?? level.left ?? (top?.left ?? 0) + 720 })
        top = stack[stack.length - 1]
      }
      const item: PMNode = { type: 'list_item', attrs: {}, content: [toParagraph(it.node)] }
      if (top.list.attrs?.checklist) {
        const t = firstText(it.node)
        item.attrs = { checked: /^[☑☒]/.test(t) }
        stripLeadingBox(item.content![0])
      }
      top.list.content!.push(item)
    }
  }

  async paragraph(p: XEl, partPath: string): Promise<{ node: PMNode; list?: { numId: string; ilvl: number; level: Level; left?: number } }[]> {
    const pPr = this.w(p, 'pPr')
    // A paragraph with no style of its own has the default one — and the default paragraph style
    // carries most documents' body spacing and face, which were being dropped on every such paragraph.
    const styleId = this.val(this.w(pPr, 'pStyle')) ?? this.defaultStyle
    const own = this.paraProps(pPr)
    const st = this.chain(styleId)
    const pp: ParaProps = { ...this.defaultPara, ...st.para, ...own }
    const heading = this.headingLevel(styleId, pp)
    // A heading keeps its style's look — colour, size, face — as well as its level. Dropping it
    // gave every imported heading this editor's house style instead of the document's own.
    const baseRun: RunProps = { ...st.run }
    const all = await this.inlines(p, partPath, baseRun)
    // A text box is a block; it arrives inside a run, so it is lifted out and set
    // just BEFORE the paragraph that anchors it — a float only affects what follows.
    const boxes = all.filter((n) => n.type === '__box').map((n) => n.attrs!.node as PMNode)
    const inlines = all.filter((n) => n.type !== '__box')
    // A page break inside a paragraph splits it in two around a page_break block.
    const segments: PMNode[][] = [[]]
    const breaks: boolean[] = []
    for (const n of inlines) {
      if (n.type === 'page_break') { segments.push([]); breaks.push(true); continue }
      segments[segments.length - 1].push(n)
    }
    const attrs: Record<string, unknown> = {}
    if (pp.align) {
      // Word's "left"/"right" are LOGICAL in a right-to-left paragraph from 2010 on
      // (start/end); both spellings arrive and both mean the same thing.
      const a = pp.align
      attrs.align = a === 'both' || a === 'distribute' ? 'justify' : a === 'center' ? 'center' : a === 'right' || a === 'end' ? 'right' : null
      if (pp.bidi && (a === 'left' || a === 'start')) attrs.align = null
    }
    const text = inlines.map((n) => n.text || '').join('')
    if (pp.bidi === true || (pp.bidi === undefined && isRtlText(text))) attrs.dir = 'rtl'
    else if (pp.bidi === false && isRtlText(text)) attrs.dir = 'ltr'
    // Exact, in half-inch steps: a 13pt indent is 0.36 of a step, and rounding it to whole steps put
    // hand-made bullets (a typed "•" in an indented paragraph) back at the margin.
    if (pp.left && !pp.numId) attrs.indent = Math.min(8, Math.round((pp.left / 720) * 100) / 100)
    if (pp.firstLine && !pp.numId) attrs.firstLine = Math.round(pp.firstLine / 20)
    // Every imported paragraph says what its spacing IS. Where the file says nothing, Word's own
    // default applies — single, nothing before or after — and leaving it unset handed the
    // paragraph to OUR default instead (1.15 lines, 8pt after), loosening every such document.
    attrs.spaceBefore = pp.autoBefore && this.firstInContainer ? 0 : pp.before ?? 0
    this.firstInContainer = false
    attrs.spaceAfter = pp.after ?? 0
    if (pp.lineRule === 'exact' && pp.linePt) attrs.lineExact = pp.linePt
    else if (pp.lineRule === 'atLeast' && pp.linePt) attrs.lineMin = pp.linePt
    else attrs.lineHeight = pp.line || 1
    // Contextual spacing: no space between two paragraphs of the same style when either asks.
    // Each flag drops ITS OWN side — the previous paragraph's after, this one's before.
    const last = this.lastPara
    if (last && last.style === (styleId || '')) {
      if (pp.contextual) attrs.spaceBefore = 0
      if (last.ctx) (last.node.attrs as Record<string, unknown>).spaceAfter = 0
    }
    const docSize = this.baseRun.size || 10
    if (!inlines.some((n) => n.text || n.type === 'image')) {
      const mark = { ...this.defaultRun, ...st.run, ...this.runProps(this.w(pPr, 'rPr')) }
      if (mark.size && mark.size !== docSize) attrs.paraSize = mark.size
      if (mark.font && mark.font !== this.baseRun.font && !/^\+/.test(mark.font)) attrs.paraFont = mark.font
    } else {
      // A line is as tall as the runs ON it in Word; in CSS it is never shorter than the paragraph
      // element's own size (its strut). A paragraph whose text is all smaller than the document's
      // size would have every line pushed up to the document's — so the paragraph takes the size of
      // its smallest run, and every run is marked relative to that.
      const sizeOf = (n: PMNode) => (n.marks?.find((m) => m.type === 'textStyle')?.attrs?.size as number | null | undefined) ?? docSize
      const texts = inlines.filter((n) => n.text && n.text.trim())
      const min = texts.length ? Math.min(...texts.map(sizeOf)) : docSize
      if (min < docSize) {
        attrs.paraSize = min
        for (const n of inlines) {
          if (!n.text) continue
          const size = sizeOf(n)
          const marks = (n.marks || []).filter((m) => m.type !== 'textStyle')
          const ts = n.marks?.find((m) => m.type === 'textStyle')
          const at = { color: null, highlight: null, font: null, ...(ts?.attrs || {}), size: size === min ? null : size }
          if (at.color || at.highlight || at.font || at.size) marks.push({ type: 'textStyle', attrs: at })
          if (marks.length) n.marks = marks
          else delete n.marks
        }
      }
    }
    if (pp.borders && Object.keys(pp.borders).length) attrs.borders = pp.borders
    if (pp.tabs?.length) attrs.tabs = pp.tabs
    const out: { node: PMNode; list?: { numId: string; ilvl: number; level: Level; left?: number } }[] = []
    for (const b of boxes) out.push({ node: b })
    if (pp.pageBreakBefore) out.push({ node: { type: 'page_break' } })
    const isCode = !heading && this.styleNameIs(styleId, /code|source|preformatted|html pre/i)
    const isQuote = !heading && this.styleNameIs(styleId, /^(quote|intense quote|block text)$/i)
    segments.forEach((seg, i) => {
      if (i > 0) out.push({ node: { type: 'page_break' } })
      if (i > 0 && !seg.length) return
      let node: PMNode
      if (heading) node = { type: 'heading', attrs: { level: heading, ...attrs }, content: seg }
      else if (isCode) node = { type: 'code_block', content: seg.some((x) => x.text) ? [{ type: 'text', text: seg.map((x) => (x.type === 'hard_break' ? '\n' : x.text || '')).join('') }] : [] }
      else node = { type: 'paragraph', attrs, content: seg }
      if (isQuote && i === 0) node = { type: 'blockquote', content: [node] }
      if (!node.content?.length) delete node.content
      const lv = pp.numId && pp.numId !== '0' && i === 0 && !heading ? this.level(pp.numId, pp.ilvl ?? 0) : null
      out.push(lv ? { node, list: { numId: pp.numId!, ilvl: pp.ilvl ?? 0, level: lv, left: own.left ?? st.para.left } } : { node })
    })
    void breaks
    const lastNode = [...out].reverse().find((o) => o.node.type === 'paragraph' || o.node.type === 'heading')?.node
    this.lastPara = lastNode?.attrs ? { node: lastNode, style: styleId || '', ctx: !!pp.contextual } : null
    return out
  }

  async inlines(p: XEl, partPath: string, baseRun: RunProps): Promise<PMNode[]> {
    const out: PMNode[] = []
    type Field = { instr: string; inResult: boolean; link?: string }
    let field: Field | null = null
    const fieldStack: (Field | null)[] = []
    const visit = async (el: XEl, link?: string, deleted = false) => {
      for (const c of el.children) {
        if (!isEl(c)) continue
        if (c.ns === NS.mc && c.local === 'AlternateContent') { const pick = kid(c, NS.mc, 'Fallback') || kid(c, NS.mc, 'Choice'); if (pick) await visit(pick, link, deleted); continue }
        if (c.ns !== this.W && !(c.ns === NS.mc)) {
          if (c.local === 'oMath' || c.local === 'oMathPara') { this.lose('equations (kept as plain text)'); const t = textOf(c); if (t) out.push(this.textNode(t, baseRun, {}, link)); continue }
          continue
        }
        switch (c.local) {
          case 'r': await this.run(c, out, baseRun, field && field.link && field.inResult ? field.link : link, deleted, (f) => {
            if (f.kind === 'begin') { fieldStack.push(field); field = { instr: '', inResult: false } }
            else if (f.kind === 'instr' && field) field.instr += f.text
            else if (f.kind === 'separate' && field) {
              field.inResult = true
              const m = field.instr.match(/HYPERLINK\s+"([^"]+)"/i)
              if (m) field.link = m[1]
            } else if (f.kind === 'end') field = fieldStack.pop() ?? null
          }, () => !!field && !field.inResult, partPath); break
          case 'hyperlink': {
            const rid = attr(c, 'id', this.R) ?? attr(c, 'id', NS.rStrict)
            let href = link
            if (rid) { const rel = await this.pkg.relById(partPath, rid); if (rel) href = rel.target }
            const anchor = attr(c, 'anchor', this.W)
            if (!rid && anchor) href = '#' + anchor
            await visit(c, href, deleted)
            break
          }
          case 'ins': case 'moveTo': this.lose('tracked changes (accepted as they stand)'); await visit(c, link, deleted); break
          case 'del': case 'moveFrom': this.lose('tracked changes (accepted as they stand)'); break
          case 'fldSimple': {
            const instr = attr(c, 'instr', this.W) || ''
            const m = instr.match(/HYPERLINK\s+"([^"]+)"/i)
            await visit(c, m ? m[1] : link, deleted)
            break
          }
          case 'smartTag': case 'customXml': case 'sdtContent': case 'dir': case 'bdo': await visit(c, link, deleted); break
          case 'sdt': { const content = this.w(c, 'sdtContent'); if (content) await visit(content, link, deleted); break }
          case 'commentRangeStart': this.lose('comments'); break
          default: break
        }
      }
    }
    await visit(p)
    return mergeText(out)
  }

  textNode(text: string, base: RunProps, rp: RunProps, link?: string): PMNode {
    const r = { ...this.defaultRun, ...base, ...rp }
    const rtl = isRtlText(text)
    const marks: PMMark[] = []
    if (link) marks.push({ type: 'link', attrs: { href: link, title: null } })
    if (rtl ? r.bCs ?? r.b : r.b) marks.push({ type: 'bold' })
    if (rtl ? r.iCs ?? r.i : r.i) marks.push({ type: 'italic' })
    if (r.u) marks.push({ type: 'underline' })
    if (r.strike) marks.push({ type: 'strike' })
    if (r.sup) marks.push({ type: 'sup' })
    else if (r.sub) marks.push({ type: 'sub' })
    const size = rtl ? r.sizeCs ?? r.size : r.size
    const baseSize = rtl ? this.baseRun.sizeCs ?? this.baseRun.size : this.baseRun.size
    const font = rtl ? r.fontCs ?? r.font : r.font
    const baseFont = rtl ? this.baseRun.fontCs ?? this.baseRun.font : this.baseRun.font
    const ts = {
      color: r.color && r.color !== '#000000' ? r.color : null,
      highlight: r.highlight || null,
      font: font && font !== baseFont && !/^\+/.test(font) ? font : null,
      size: size && size !== (baseSize || 11) ? size : null,
    }
    if (ts.color || ts.highlight || ts.font || ts.size) marks.push({ type: 'textStyle', attrs: ts })
    const node: PMNode = { type: 'text', text: r.caps ? text.toUpperCase() : text }
    if (marks.length) node.marks = marks
    return node
  }

  async run(r: XEl, out: PMNode[], base: RunProps, link: string | undefined, deleted: boolean, onField: (f: { kind: 'begin' | 'instr' | 'separate' | 'end'; text: string }) => void, inInstr: () => boolean, partPath: string) {
    if (deleted) return
    const rPr = this.w(r, 'rPr')
    const cs = this.val(this.w(rPr, 'rStyle'))
    const rp: RunProps = { ...(cs ? this.chain(cs).run : {}), ...this.runProps(rPr) }
    for (const c of r.children) {
      if (!isEl(c)) continue
      if (c.ns === NS.mc && c.local === 'AlternateContent') {
        const pick = this.pickAlternate(c)
        if (pick) await this.run({ ...r, children: pick.children }, out, base, link, deleted, onField, inInstr, partPath)
        continue
      }
      if (c.ns !== this.W) continue
      switch (c.local) {
        case 't': if (!inInstr()) { const t = textOf(c); if (t) out.push(this.textNode(t, base, rp, link)) } break
        case 'tab': if (!inInstr()) out.push(this.textNode('\t', base, rp, link)); break
        case 'noBreakHyphen': out.push(this.textNode('‑', base, rp, link)); break
        case 'sym': { const ch = attr(c, 'char', this.W); if (ch) { const code = parseInt(ch, 16); out.push(this.textNode(String.fromCodePoint(code >= 0xf000 ? code - 0xf000 : code), base, rp, link)) } break }
        case 'br': case 'cr': {
          const type = attr(c, 'type', this.W)
          if (type === 'page') out.push({ type: 'page_break' })
          else if (type === 'column') this.lose('column breaks')
          else out.push({ type: 'hard_break' })
          break
        }
        case 'lastRenderedPageBreak': break
        case 'fldChar': { const t = attr(c, 'fldCharType', this.W); if (t === 'begin' || t === 'separate' || t === 'end') onField({ kind: t, text: '' }); break }
        case 'instrText': onField({ kind: 'instr', text: textOf(c) }); break
        case 'drawing': await this.drawing(c, out, partPath); break
        case 'pict': case 'object': await this.vml(c, out, partPath); break
        case 'footnoteReference': case 'endnoteReference': {
          const id = attr(c, 'id', this.W) || ''
          const text = (c.local === 'footnoteReference' ? this.footnotes : this.endnotes).get(id) || ''
          out.push({ type: 'footnote', attrs: { text } })
          break
        }
        default: break
      }
    }
  }

  /**
   * Which branch of an mc:AlternateContent to read. The Fallback used to win
   * every time, and for a drawing that is the WORSE copy: Word and LibreOffice
   * write a floating picture or a text box as DrawingML in the Choice and as
   * legacy VML in the Fallback, and the VML is where the placement is vaguest.
   * A Choice is taken when everything it requires is a namespace this reader
   * understands; anything else (a w14 checkbox, a future shape) keeps the
   * Fallback, which is what the mechanism is for.
   */
  pickAlternate(c: XEl): XEl | null {
    const choice = kid(c, NS.mc, 'Choice')
    const req = (attr(choice, 'Requires') || '').split(/\s+/).filter(Boolean)
    if (choice && req.length && req.every((r) => r === 'wps' || r === 'wpg' || r === 'wp14')) return choice
    return kid(c, NS.mc, 'Fallback') || choice
  }

  /** Where Word placed a floating object, as the editor's three placements. */
  anchorFloat(a: XEl, wPx: number): Float {
    if (kid(a, NS.wp, 'wrapTopAndBottom')) return 'center'
    const ph = kid(a, NS.wp, 'positionH')
    const al = textOf(kid(ph, NS.wp, 'align') as XEl).trim()
    if (al === 'left' || al === 'inside') return 'left'
    if (al === 'right' || al === 'outside') return 'right'
    if (al === 'center') return 'center'
    const off = Number(textOf(kid(ph, NS.wp, 'posOffset') as XEl) || 0) / EMU_PER_PX
    return this.sideOf(off, wPx, attr(ph, 'relativeFrom') || 'column')
  }
  /** An offset from the page or the column, turned into the side it is nearer. */
  sideOf(off: number, wPx: number, rel: string): Float {
    const pw = (this.page.landscape ? Math.max(this.page.width, this.page.height) : this.page.width) * (96 / 25.4)
    const ml = this.page.margins.left * (96 / 25.4)
    const col = pw - ml - this.page.margins.right * (96 / 25.4)
    const x = (rel === 'page' || rel === 'leftMargin' ? off - ml : off) + wPx / 2
    if (Math.abs(x - col / 2) < col * 0.12) return 'center'
    return x < col / 2 ? 'left' : 'right'
  }

  /** A text box's paragraphs, as a block the paragraph that holds it hands up. */
  async textBox(content: XEl, partPath: string, attrs: { width: number | null; float: Float; fill: string | null; border: boolean }, out: PMNode[]) {
    const blocks = await this.blocks(content, partPath)
    if (!blocks.some((b) => plainOf(b).trim() || b.type === 'table' || hasImage(b))) { this.lose('drawn shapes (lines, arrows, empty boxes)'); return }
    this.boxes++
    out.push({ type: '__box', attrs: { node: { type: 'text_box', attrs, content: blocks } } })
  }

  private srcByPath = new Map<string, string | null>()
  async image(rid: string | undefined, partPath: string, w: number, h: number, alt: string | null, out: PMNode[], float: Float = null) {
    if (!rid) return
    const rel = await this.pkg.relById(partPath, rid)
    if (!rel || rel.external) { this.lose('linked (not embedded) pictures'); return }
    const path = rel.target
    if (!this.pkg.has(path)) return
    // A picture used on every page (a logo, a signature) is encoded once, not once per use.
    let src = this.srcByPath.get(path)
    if (src === undefined) {
      const bytes = await this.pkg.bytes(path)
      const kind = sniffImage(bytes)
      if (!kind || !/png|jpeg|gif|webp|svg|bmp/.test(kind.mime)) { this.lose('pictures in a format browsers cannot show (EMF, WMF, TIFF)'); this.srcByPath.set(path, null); return }
      if (this.imageBytes + bytes.length > 60 * 1024 * 1024) { this.lose('pictures beyond 60MB in total'); this.srcByPath.set(path, null); return }
      this.imageBytes += bytes.length
      src = dataUrl(bytes, kind.mime)
      this.srcByPath.set(path, src)
    }
    if (src === null) return
    this.images++
    const attrs: Record<string, unknown> = { src, alt, title: null, width: w ? Math.round(w) : null, height: h ? Math.round(h) : null }
    if (float) attrs.float = float
    out.push({ type: 'image', attrs })
  }

  async drawing(d: XEl, out: PMNode[], partPath: string) {
    const holder = kid(d, NS.wp, 'inline') || kid(d, NS.wp, 'anchor')
    if (!holder) return
    const ext = kid(holder, NS.wp, 'extent')
    const w = Number(attr(ext, 'cx') || 0) / EMU_PER_PX
    const h = Number(attr(ext, 'cy') || 0) / EMU_PER_PX
    // A floating object keeps its side. What cannot come across is LAYERING: a
    // picture behind or in front of the text sits beside it here instead.
    const float = holder.local === 'anchor' ? this.anchorFloat(holder, w) : null
    if (holder.local === 'anchor' && kid(holder, NS.wp, 'wrapNone')) this.lose('pictures behind or in front of text (placed beside it)')
    const docPr = kid(holder, NS.wp, 'docPr')
    const alt = attr(docPr, 'descr') || attr(docPr, 'title') || null
    const gd = kid(kid(holder, NS.a, 'graphic'), NS.a, 'graphicData')
    const uri = attr(gd, 'uri') || ''
    if (/chart/.test(uri)) { this.lose('charts'); return }
    if (/diagram/.test(uri)) { this.lose('SmartArt diagrams'); return }
    if (/wordprocessingGroup/.test(uri)) {
      // A group is commonly a filled box with words on it — a section bar, a callout — and a
      // PDF converted to Word is made of them. That much is a text box with a fill, which the
      // model has; anything else drawn in the group (a rule, an arrow) is the loss.
      const shapes: XEl[] = []
      const collect = (e: XEl) => { for (const c of e.children) if (isEl(c)) { if (c.local === 'wsp') shapes.push(c); else if (c.local === 'grpSp' || c.local === 'wgp') collect(c) } }
      collect(gd!)
      const texts = shapes.map((sh) => findLocal(sh, 'txbxContent')).filter((t): t is XEl => !!t)
      if (!texts.length) { this.lose('drawn shapes (lines, arrows, empty boxes)'); return }
      const fillOf = (sh: XEl) => { const spPr = sh.children.find((c) => isEl(c) && c.local === 'spPr') as XEl | undefined; const v = attr(findLocal(spPr && (spPr.children.find((c) => isEl(c) && c.local === 'solidFill') as XEl), 'srgbClr'), 'val'); return v && /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toLowerCase() : null }
      const area = (sh: XEl) => { const e = findLocal(sh, 'ext'); return Number(attr(e, 'cx') || 0) * Number(attr(e, 'cy') || 0) }
      // The fill is the biggest filled shape's — the box the words sit on — or the text box's own.
      const bg = shapes.filter((sh) => !findLocal(sh, 'txbxContent') && fillOf(sh)).sort((a, b) => area(b) - area(a))[0]
      const fill = (bg && fillOf(bg)) || texts.map((t) => { let p = t.parent; while (p && p.local !== 'wsp') p = p.parent; return p ? fillOf(p) : null }).find(Boolean) || null
      const drawn = shapes.filter((sh) => !findLocal(sh, 'txbxContent') && sh !== bg).length
      if (drawn) this.lose('lines and shapes drawn in a group (its box and text are kept)')
      const blocks: PMNode[] = []
      for (const t of texts) blocks.push(...(await this.blocks(t, partPath)))
      if (!blocks.some((b) => plainOf(b).trim() || b.type === 'table' || hasImage(b))) return
      this.boxes++
      out.push({ type: '__box', attrs: { node: { type: 'text_box', attrs: { width: w ? Math.round(w) : null, float: float ?? 'center', fill, border: false }, content: blocks } } })
      return
    }
    if (/wordprocessingShape/.test(uri)) {
      const wsp = gd!.children.find((c) => isEl(c) && c.local === 'wsp') as XEl | undefined
      const txbx = wsp && findLocal(wsp, 'txbxContent')
      if (!txbx) { this.lose('drawn shapes (lines, arrows, empty boxes)'); return }
      const spPr = wsp.children.find((c) => isEl(c) && c.local === 'spPr') as XEl | undefined
      const fillHex = attr(findLocal(spPr && (spPr.children.find((c) => isEl(c) && c.local === 'solidFill') as XEl), 'srgbClr'), 'val')
      const ln = spPr && (spPr.children.find((c) => isEl(c) && c.local === 'ln') as XEl | undefined)
      const border = !!ln && !ln.children.some((c) => isEl(c) && c.local === 'noFill')
      await this.textBox(txbx, partPath, { width: w ? Math.round(w) : null, float: float ?? 'center', fill: fillHex && /^[0-9a-f]{6}$/i.test(fillHex) ? '#' + fillHex.toLowerCase() : null, border }, out)
      return
    }
    const pic = kid(gd, NS.pic, 'pic')
    const blip = kid(kid(pic, NS.pic, 'blipFill'), NS.a, 'blip')
    await this.image(attr(blip, 'embed', this.R) ?? attr(blip, 'embed', NS.rStrict), partPath, w, h, alt, out, float)
  }

  async vml(el: XEl, out: PMNode[], partPath: string) {
    const find = (e: XEl): XEl | null => { for (const c of e.children) { if (!isEl(c)) continue; if (c.local === 'imagedata') return c; const f = find(c); if (f) return f } return null }
    const img = find(el)
    const shape = findLocal(el, 'shape') || findLocal(el, 'rect') || findLocal(el, 'roundrect')
    const style = attr(shape, 'style') || ''
    const px = (k: string) => { const m = style.match(new RegExp('(?:^|;)\\s*' + k + ':\\s*(-?[\\d.]+)(pt|px|in|cm|mm)?')); if (!m) return 0; const v = +m[1]; return m[2] === 'in' ? v * 96 : m[2] === 'px' ? v : m[2] === 'cm' ? v * 96 / 2.54 : m[2] === 'mm' ? v * 96 / 25.4 : v * (96 / 72) }
    // Legacy VML: absolute position means floating, and mso-position-horizontal names the side.
    const vmlFloat = (wPx: number): Float => {
      if (!/position:\s*absolute/.test(style)) return null
      const side = style.match(/mso-position-horizontal:\s*([a-z]+)/)?.[1]
      if (side === 'left' || side === 'inside') return 'left'
      if (side === 'right' || side === 'outside') return 'right'
      if (side === 'center') return 'center'
      return this.sideOf(px('margin-left'), wPx, style.match(/mso-position-horizontal-relative:\s*([a-z-]+)/)?.[1] === 'page' ? 'page' : 'column')
    }
    const txbx = findLocal(el, 'txbxContent')
    if (img) {
      await this.image(attr(img, 'id', this.R), partPath, px('width'), px('height'), attr(img, 'title') || null, out, vmlFloat(px('width')))
    } else if (el.local === 'object') this.lose('embedded objects')
    else if (txbx) {
      const fill = attr(shape, 'fillcolor')
      await this.textBox(txbx, partPath, { width: px('width') ? Math.round(px('width')) : null, float: vmlFloat(px('width')) ?? 'center', fill: fill && /^#[0-9a-f]{6}$/i.test(fill) && attr(shape, 'filled') !== 'f' ? fill.toLowerCase() : null, border: attr(shape, 'stroked') !== 'f' }, out)
    } else this.lose('drawn shapes (lines, arrows, empty boxes)')
  }

  async table(t: XEl, partPath: string): Promise<PMNode> {
    let grid = this.ws(this.w(t, 'tblGrid'), 'gridCol').map((g) => Math.round(Number(attr(g, 'w', this.W) || 0) / 15))
    // Some writers (pandoc, Google Docs exports) give a table a PERCENTAGE width and a grid of
    // placeholder columns a few points wide, which Word stretches. Kept literally, four 5pt
    // columns made a table a sliver nobody could read; the page width is the honest answer.
    const tw = this.w(this.w(t, 'tblPr'), 'tblW')
    if ((attr(tw, 'type', this.W) === 'pct' || /%$/.test(attr(tw, 'w', this.W) || '')) && grid.reduce((a, b) => a + b, 0) < 96) grid = []
    const tablePad = this.tablePad(this.w(t, 'tblPr'))
    const rows: PMNode[] = []
    // Per grid column, the cell a vertical merge started in.
    const origin = new Map<number, PMNode>()
    for (const tr of this.flatten(t).filter((e) => e.ns === this.W && e.local === 'tr')) {
      const trPr = this.w(tr, 'trPr')
      const header = !!this.on(this.w(trPr, 'tblHeader'))
      const cells: PMNode[] = []
      let col = Number(this.val(this.w(trPr, 'gridBefore')) || 0)
      for (const tc of this.flatten(tr).filter((e) => e.ns === this.W && e.local === 'tc')) {
        const tcPr = this.w(tc, 'tcPr')
        const span = Math.max(1, Number(this.val(this.w(tcPr, 'gridSpan')) || 1))
        const vm = this.w(tcPr, 'vMerge')
        const vmVal = vm ? this.val(vm) || 'continue' : null
        if (vmVal === 'continue') {
          const o = origin.get(col)
          if (o) { o.attrs!.rowspan = (o.attrs!.rowspan as number) + 1; col += span; continue }
        }
        const content = await this.blocks(tc, partPath)
        const fill = attr(this.w(tcPr, 'shd'), 'fill', this.W)
        const va = this.val(this.w(tcPr, 'vAlign'))
        const widths = grid.slice(col, col + span)
        const cell: PMNode = {
          type: header ? 'table_header' : 'table_cell',
          attrs: {
            colspan: span, rowspan: 1,
            colwidth: widths.length === span && widths.every((x) => x > 0) ? widths : null,
            background: fill && fill !== 'auto' && /^[0-9a-f]{6}$/i.test(fill) ? '#' + fill.toLowerCase() : null,
            valign: va === 'center' ? 'middle' : va === 'bottom' ? 'bottom' : null,
            pad: (() => {
              const own = this.cellMar(this.w(tcPr, 'tcMar'))
              if (!own || own.every((v) => v === undefined)) return null
              const base = tablePad.split(' ').map(Number)
              return own.map((v, i) => +(v ?? base[i]).toFixed(2)).join(' ')
            })(),
          },
          content: content.length ? content : [{ type: 'paragraph' }],
        }
        if (vmVal === 'restart') for (let k = 0; k < span; k++) origin.set(col + k, cell)
        else for (let k = 0; k < span; k++) origin.delete(col + k)
        cells.push(cell)
        col += span
      }
      if (cells.length) rows.push({ type: 'table_row', content: cells })
    }
    if (!rows.length) return { type: 'paragraph' }
    return { type: 'table', attrs: { grid: this.tableHasGrid(this.w(t, 'tblPr')), pad: tablePad }, content: rows }
  }

  pageSetup(sect: XEl | null): PageSetup {
    const page: PageSetup = { ...A4, margins: { ...A4.margins } }
    if (!sect) return page
    const sz = this.w(sect, 'pgSz')
    const w = Number(attr(sz, 'w', this.W))
    const h = Number(attr(sz, 'h', this.W))
    if (w && h) { page.width = round1(w / TWIP_PER_MM); page.height = round1(h / TWIP_PER_MM) }
    if (attr(sz, 'orient', this.W) === 'landscape' || (w && h && w > h)) page.landscape = true
    const m = this.w(sect, 'pgMar')
    const mm = (k: string, d: number) => { const v = attr(m, k, this.W); return v === undefined ? d : round1(Math.abs(Number(v)) / TWIP_PER_MM) }
    if (m) {
      page.margins = { top: mm('top', 25.4), right: mm('right', 25.4), bottom: mm('bottom', 25.4), left: mm('left', 25.4) }
      if (attr(m, 'header', this.W) !== undefined) page.headerAt = mm('header', 12.5)
      if (attr(m, 'footer', this.W) !== undefined) page.footerAt = mm('footer', 12.5)
      // A binding gutter is extra space on the inner edge; on a single-sided page that is the left.
      const gutter = mm('gutter', 0)
      if (gutter) page.margins.left = round1(page.margins.left + gutter)
    }
    const cols = Number(attr(this.w(sect, 'cols'), 'num', this.W) || 1)
    if (cols > 1) this.lose('multiple text columns')
    return page
  }

  async headerFooter(sect: XEl | null, which: 'headerReference' | 'footerReference'): Promise<string | undefined> {
    if (!sect) return undefined
    const refs = this.ws(sect, which)
    const ref = refs.find((r) => attr(r, 'type', this.W) === 'default') || refs[0]
    const rid = attr(ref, 'id', this.R)
    if (!rid) return undefined
    const rel = await this.pkg.relById(this.main, rid)
    if (!rel) return undefined
    const root = await this.pkg.tryXml(rel.target)
    if (!root) return undefined
    let s = ''
    const walk = (e: XEl, inInstr: { on: boolean; instr: string }) => {
      for (const c of e.children) {
        if (!isEl(c)) continue
        if (c.ns === this.W && c.local === 'fldSimple') {
          const ins = (attr(c, 'instr', this.W) || '').trim().toUpperCase()
          s += ins.startsWith('PAGE') ? '{page}' : ins.startsWith('NUMPAGES') ? '{pages}' : this.plain(c)
          continue
        }
        if (c.ns === this.W && c.local === 'fldChar') {
          const t = attr(c, 'fldCharType', this.W)
          if (t === 'begin') { inInstr.on = true; inInstr.instr = '' }
          if (t === 'separate' || t === 'end') {
            if (inInstr.on) { const ins = inInstr.instr.trim().toUpperCase(); if (ins.startsWith('PAGE')) s += '{page}'; else if (ins.startsWith('NUMPAGES')) s += '{pages}' }
            inInstr.on = false
          }
          continue
        }
        if (c.ns === this.W && c.local === 'instrText') { inInstr.instr += textOf(c); continue }
        if (c.ns === this.W && c.local === 't') { if (!inInstr.on && !s.endsWith('{page}') && !s.endsWith('{pages}')) s += textOf(c); else if (!inInstr.on) s += textOf(c).replace(/^\d+$/, ''); continue }
        if (c.ns === this.W && c.local === 'tab') { s += '\t'; continue }
        if (c.ns === this.W && c.local === 'p' && s && !s.endsWith('\n')) s += '\n'
        walk(c, inInstr)
      }
    }
    walk(root, { on: false, instr: '' })
    if (findIn(root, (e) => e.local === 'drawing' || e.local === 'pict')) this.lose('pictures in the header or footer')
    return s.trim() || undefined
  }
}

function findIn(e: XEl, pred: (e: XEl) => boolean): boolean {
  for (const c of e.children) if (isEl(c) && (pred(c) || findIn(c, pred))) return true
  return false
}

const round1 = (n: number) => Math.round(n * 10) / 10

function sameMarks(a?: PMMark[], b?: PMMark[]): boolean { return JSON.stringify(a || []) === JSON.stringify(b || []) }
function mergeText(nodes: PMNode[]): PMNode[] {
  const out: PMNode[] = []
  for (const n of nodes) {
    const prev = out[out.length - 1]
    if (n.type === 'text' && prev?.type === 'text' && sameMarks(prev.marks, n.marks)) prev.text += n.text!
    else if (n.type === 'text' && !n.text) continue
    else out.push(n)
  }
  return out
}
function firstText(n: PMNode): string { if (n.text) return n.text; for (const c of n.content || []) { const t = firstText(c); if (t) return t } return '' }
function stripLeadingBox(p: PMNode) {
  const first = p.content?.[0]
  if (first?.text) { first.text = first.text.replace(/^[☐☑☒]\s?/, ''); if (!first.text) p.content!.shift() }
}
function toParagraph(n: PMNode): PMNode {
  if (n.type === 'paragraph') return n
  if (n.type === 'heading') return { type: 'paragraph', attrs: { ...n.attrs, level: undefined }, content: n.content }
  if (n.type === 'blockquote') return toParagraph(n.content?.[0] || { type: 'paragraph' })
  return { type: 'paragraph', content: n.content?.filter((c) => c.text !== undefined) }
}

export async function readDocx(buf: ArrayBuffer): Promise<DocxImport> {
  const pkg = await Package.open(buf)
  const main = await pkg.mainPart()
  if (!/document\.xml$|document2\.xml$/i.test(main) && !/wordprocessingml/.test(pkg.contentType(main))) {
    throw new OpcError('not-ooxml', 'not a Word document')
  }
  const root = await pkg.xml(main)
  const r = new Reader(pkg, main)
  if (root.ns === NS.wStrict) { r.W = NS.wStrict; r.R = NS.rStrict }
  await r.readStyles()
  await r.readNumbering()
  await r.readNotes(REL.footnotes, r.footnotes, 'footnote')
  await r.readNotes(REL.endnotes, r.endnotes, 'endnote')
  const comments = (await pkg.relsOfType(main, REL.comments))[0]
  if (comments) {
    const croot = await pkg.tryXml(comments.target)
    const n = kids(croot, r.W, 'comment').length
    if (n) r.loss.set('comments', n)
  }
  const body = r.w(root, 'body')
  if (!body) throw new OpcError('missing-part', 'no body')
  const sect = r.w(body, 'sectPr')
  const page = r.pageSetup(sect)
  r.page = page
  const content = await r.blocks(body, main)
  const sections = findAllLocal(body, 'sectPr').length
  if (sections > 1) r.lose('section breaks (the first page setup is kept)', sections - 1)
  const settingsRel = (await pkg.relsOfType(main, REL.settings))[0]
  const settings = settingsRel ? await pkg.tryXml(settingsRel.target) : null
  // Adding the two spaces is what the compat flag asks for — and what LibreOffice does for a
  // package with no settings part at all, which the generators that write no styles also omit.
  const spaceSum = !settings || !!findLocal(settings, 'doNotUseHTMLParagraphAutoSpacing')
  const header = await r.headerFooter(sect, 'headerReference')
  const footer = await r.headerFooter(sect, 'footerReference')
  const paras = content.filter((n) => n.type === 'paragraph' || n.type === 'heading')
  const rtl = paras.length > 0 && paras.filter((n) => n.attrs?.dir === 'rtl').length > paras.length / 2
  const doc: PMNode = { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
  void relIs
  return {
    // The document's own face and size: body text carries no mark for them, so without these it
    // was drawn in the editor's face at 11pt — a Times 12 document reflowed on every line.
    data: { doc, page, header, footer, rtl, lang: rtl ? 'ar-SA' : 'en-US', ...defaultsOf(r.baseRun, r.hasStyles), ...(spaceSum ? { spaceSum } : {}) },
    loss: [...r.loss].map(([what, count]) => ({ what, count })),
    title: await readTitle(pkg),
  }
}

function defaultsOf(b: RunProps, hasStyles: boolean): Pick<WordData, 'font' | 'fontCs' | 'size'> {
  const out: Pick<WordData, 'font' | 'fontCs' | 'size'> = {}
  // A document that names no face is never drawn in the editor's own face. With no styles part at
  // all (generators write none) LibreOffice draws Calibri; with one that names no face, Word's and
  // LibreOffice's own default — Times New Roman.
  out.font = b.font && !/^\+/.test(b.font) ? b.font : hasStyles ? 'Times New Roman' : 'Calibri'
  if (b.fontCs && !/^\+/.test(b.fontCs)) out.fontCs = b.fontCs
  out.size = b.size || 10
  return out
}

function findAllLocal(e: XEl, local: string, out: XEl[] = []): XEl[] {
  for (const c of e.children) if (isEl(c)) { if (c.local === local) out.push(c); findAllLocal(c, local, out) }
  return out
}

function findLocal(e: XEl | null | undefined, local: string): XEl | null {
  if (!e) return null
  for (const c of e.children) if (isEl(c)) { if (c.local === local) return c; const f = findLocal(c, local); if (f) return f }
  return null
}
function plainOf(n: PMNode): string { return n.text ?? (n.content || []).map(plainOf).join('') }
function hasImage(n: PMNode): boolean { return n.type === 'image' || (n.content || []).some(hasImage) }
