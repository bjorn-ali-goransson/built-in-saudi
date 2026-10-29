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
  numId?: string; ilvl?: number; pageBreakBefore?: boolean; outline?: number
}
interface Style { id: string; name: string; type: string; basedOn?: string; run: RunProps; para: ParaProps }
interface Level { fmt: string; start: number; text: string }
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
  numbering: Numbering = { abstracts: new Map(), nums: new Map() }
  loss = new Map<string, number>()
  footnotes = new Map<string, string>()
  endnotes = new Map<string, string>()
  counters = new Map<string, number[]>()
  images = 0
  imageBytes = 0

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
      const ascii = attr(f, 'ascii', this.W) || attr(f, 'hAnsi', this.W)
      const cs = attr(f, 'cs', this.W)
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
      if (line !== undefined && (!rule || rule === 'auto')) p.line = Math.round((Number(line) / 240) * 100) / 100
    }
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
    return p
  }
  async readStyles() {
    const rel = (await this.pkg.relsOfType(this.main, REL.styles))[0]
    const root = rel ? await this.pkg.tryXml(rel.target) : null
    if (!root) return
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
      })
    }
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
        levels[i] = { fmt: this.val(this.w(l, 'numFmt')) || 'decimal', start: Number(this.val(this.w(l, 'start')) || 1), text: this.val(this.w(l, 'lvlText')) || '' }
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
    const items: { node: PMNode; list?: { numId: string; ilvl: number; level: Level } }[] = []
    const children = this.flatten(parent)
    for (const c of children) {
      if (c.ns !== this.W) continue
      if (c.local === 'p') {
        for (const it of await this.paragraph(c, partPath)) items.push(it)
      } else if (c.local === 'tbl') items.push({ node: await this.table(c, partPath) })
      else if (c.local === 'sectPr') continue
    }
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

  nestLists(items: { node: PMNode; list?: { numId: string; ilvl: number; level: Level } }[], out: PMNode[]) {
    type Open = { level: number; list: PMNode; numId: string }
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
        const list: PMNode = { type, attrs, content: [] }
        if (top) {
          const parentItem = top.list.content![top.list.content!.length - 1]
          parentItem.content!.push(list)
        } else out.push(list)
        stack.push({ level: ilvl, list, numId })
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

  async paragraph(p: XEl, partPath: string): Promise<{ node: PMNode; list?: { numId: string; ilvl: number; level: Level } }[]> {
    const pPr = this.w(p, 'pPr')
    const styleId = this.val(this.w(pPr, 'pStyle'))
    const own = this.paraProps(pPr)
    const st = this.chain(styleId)
    const pp: ParaProps = { ...this.defaultPara, ...st.para, ...own }
    const heading = this.headingLevel(styleId, pp)
    const baseRun: RunProps = heading ? {} : { ...st.run }
    const inlines = await this.inlines(p, partPath, baseRun)
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
    if (pp.left && !pp.numId) attrs.indent = Math.min(8, Math.round(pp.left / 720))
    if (pp.firstLine && !pp.numId) attrs.firstLine = Math.round(pp.firstLine / 20)
    if (pp.before !== undefined) attrs.spaceBefore = pp.before
    if (pp.after !== undefined) attrs.spaceAfter = pp.after
    if (pp.line && pp.line !== 1) attrs.lineHeight = pp.line
    const out: { node: PMNode; list?: { numId: string; ilvl: number; level: Level } }[] = []
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
      out.push(lv ? { node, list: { numId: pp.numId!, ilvl: pp.ilvl ?? 0, level: lv } } : { node })
    })
    void breaks
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
    const baseSize = rtl ? this.defaultRun.sizeCs ?? this.defaultRun.size : this.defaultRun.size
    const font = rtl ? r.fontCs ?? r.font : r.font
    const baseFont = rtl ? this.defaultRun.fontCs ?? this.defaultRun.font : this.defaultRun.font
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
        const pick = kid(c, NS.mc, 'Fallback') || kid(c, NS.mc, 'Choice')
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

  async image(rid: string | undefined, partPath: string, w: number, h: number, alt: string | null, out: PMNode[]) {
    if (!rid) return
    const rel = await this.pkg.relById(partPath, rid)
    if (!rel || rel.external) { this.lose('linked (not embedded) pictures'); return }
    const path = rel.target
    if (!this.pkg.has(path)) return
    const bytes = await this.pkg.bytes(path)
    const kind = sniffImage(bytes)
    if (!kind || !/png|jpeg|gif|webp|svg|bmp/.test(kind.mime)) { this.lose('pictures in a format browsers cannot show (EMF, WMF, TIFF)'); return }
    if (this.imageBytes + bytes.length > 60 * 1024 * 1024) { this.lose('pictures beyond 60MB in total'); return }
    this.imageBytes += bytes.length
    this.images++
    out.push({ type: 'image', attrs: { src: dataUrl(bytes, kind.mime), alt, title: null, width: w ? Math.round(w) : null, height: h ? Math.round(h) : null } })
  }

  async drawing(d: XEl, out: PMNode[], partPath: string) {
    const holder = kid(d, NS.wp, 'inline') || kid(d, NS.wp, 'anchor')
    if (!holder) return
    if (holder.local === 'anchor') this.lose('floating pictures (placed in the text)')
    const ext = kid(holder, NS.wp, 'extent')
    const w = Number(attr(ext, 'cx') || 0) / EMU_PER_PX
    const h = Number(attr(ext, 'cy') || 0) / EMU_PER_PX
    const docPr = kid(holder, NS.wp, 'docPr')
    const alt = attr(docPr, 'descr') || attr(docPr, 'title') || null
    const gd = kid(kid(holder, NS.a, 'graphic'), NS.a, 'graphicData')
    const uri = attr(gd, 'uri') || ''
    if (/chart/.test(uri)) { this.lose('charts'); return }
    if (/diagram/.test(uri)) { this.lose('SmartArt diagrams'); return }
    if (/wordprocessingShape|wps/.test(uri)) {
      // A text box: keep its words, as paragraphs would lose their place.
      this.lose('text boxes and shapes (their text is kept)')
      const t = this.plain(gd!).trim()
      if (t) out.push({ type: 'text', text: ' ' + t + ' ' })
      return
    }
    const pic = kid(gd, NS.pic, 'pic')
    const blip = kid(kid(pic, NS.pic, 'blipFill'), NS.a, 'blip')
    await this.image(attr(blip, 'embed', this.R) ?? attr(blip, 'embed', NS.rStrict), partPath, w, h, alt, out)
  }

  async vml(el: XEl, out: PMNode[], partPath: string) {
    const find = (e: XEl): XEl | null => { for (const c of e.children) { if (!isEl(c)) continue; if (c.local === 'imagedata') return c; const f = find(c); if (f) return f } return null }
    const img = find(el)
    if (img) {
      const shape = el.children.find((c) => isEl(c) && c.local === 'shape') as XEl | undefined
      const style = attr(shape, 'style') || ''
      const px = (k: string) => { const m = style.match(new RegExp(k + ':\\s*([\\d.]+)(pt|px|in)?')); if (!m) return 0; const v = +m[1]; return m[2] === 'in' ? v * 96 : m[2] === 'px' ? v : v * (96 / 72) }
      await this.image(attr(img, 'id', this.R), partPath, px('width'), px('height'), attr(img, 'title') || null, out)
    } else if (el.local === 'object') this.lose('embedded objects')
    else this.lose('text boxes and shapes (their text is kept)')
  }

  async table(t: XEl, partPath: string): Promise<PMNode> {
    const grid = this.ws(this.w(t, 'tblGrid'), 'gridCol').map((g) => Math.round(Number(attr(g, 'w', this.W) || 0) / 15))
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
    return { type: 'table', content: rows }
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
    if (m) page.margins = { top: mm('top', 25.4), right: mm('right', 25.4), bottom: mm('bottom', 25.4), left: mm('left', 25.4) }
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
  const content = await r.blocks(body, main)
  const sect = r.w(body, 'sectPr')
  const sections = findAllLocal(body, 'sectPr').length
  if (sections > 1) r.lose('section breaks (the first page setup is kept)', sections - 1)
  const page = r.pageSetup(sect)
  const header = await r.headerFooter(sect, 'headerReference')
  const footer = await r.headerFooter(sect, 'footerReference')
  const paras = content.filter((n) => n.type === 'paragraph' || n.type === 'heading')
  const rtl = paras.length > 0 && paras.filter((n) => n.attrs?.dir === 'rtl').length > paras.length / 2
  const doc: PMNode = { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
  void relIs
  return {
    data: { doc, page, header, footer, rtl, lang: rtl ? 'ar-SA' : 'en-US' },
    loss: [...r.loss].map(([what, count]) => ({ what, count })),
    title: await readTitle(pkg),
  }
}

function findAllLocal(e: XEl, local: string, out: XEl[] = []): XEl[] {
  for (const c of e.children) if (isEl(c)) { if (c.local === local) out.push(c); findAllLocal(c, local, out) }
  return out
}
