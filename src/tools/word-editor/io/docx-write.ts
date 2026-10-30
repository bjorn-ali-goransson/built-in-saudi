// The editor's document → .docx.
//
// Things Word actually requires, each a file that opens wrong (or not at all)
// when missed — and each with a check in docx.test.ts read off the raw XML:
//  - Headings are STYLES with the built-in names, not big bold text, so the
//    navigation pane, a table of contents and screen readers find them.
//  - Every list gets its own w:num with a startOverride, or the second numbered
//    list continues the first (1, 2, 3 then 4, 5, 6).
//  - Merged cells: a rowspan becomes vMerge restart/continue placeholders in
//    the rows below, because OOXML has no rowspan — only a grid.
//  - Right-to-left text carries w:rtl and an Arabic w:lang on its RUNS, and the
//    complex-script twins (bCs, iCs, szCs) — Word formats Arabic from those,
//    so a bold Arabic word with only w:b comes out plain.
//  - xml:space="preserve" on every text run, or Word eats the space between two.
//  - A code block is one paragraph per LINE; Word breaks on paragraphs, not \n.
//  - A floating picture is a wp:anchor, whose children are a SEQUENCE (Word
//    calls the file damaged otherwise), and a text box is a DrawingML shape in
//    an mc:AlternateContent whose Requires prefix must be declared on the root.
import { PackageWriter, REL, NS, writeDocProps, parseDataUrl, sniffImage, pxToEmu } from '../../../lib/office/opc'
import { classicImage } from '../../../lib/office/optimiseImage'
import { x, raw, xmlDoc, stripInvalidXmlChars, type XChild, type Xml } from '../../../lib/xml'
import type { PMNode, PMMark, WordData } from '../model'
import type { Borders, BorderSide, TabStop } from '../schema'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const CT = {
  doc: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  styles: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
  numbering: 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
  settings: 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
  footnotes: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml',
  header: 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
  footer: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
}
const WPS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
const W_ATTRS = {
  'xmlns:w': NS.w, 'xmlns:r': NS.r, 'xmlns:wp': NS.wp, 'xmlns:a': NS.a, 'xmlns:pic': NS.pic,
  'xmlns:mc': NS.mc, 'xmlns:wps': WPS,
}
const TWIP_PER_MM = 1440 / 25.4
const RTL_CH = /[֐-ࣿיִ-﷿ﹰ-﻿]/
const LTR_CH = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/

export interface DocxExport { blob: Blob; loss: { what: string; count: number }[] }

const KIND_FMT: Record<string, string> = {
  decimal: 'decimal', 'lower-alpha': 'lowerLetter', 'upper-alpha': 'upperLetter', 'lower-roman': 'lowerRoman', 'upper-roman': 'upperRoman',
  'arabic-indic': 'hindiNumbers', 'arabic-abjad': 'arabicAbjad',
}
const BULLETS = ['•', '◦', '▪']

/** Split text where its direction changes, neutrals staying with what came before. */
export function splitBidi(text: string): { text: string; rtl: boolean }[] {
  type Piece = { text: string; rtl: boolean; decided: boolean }
  const out: Piece[] = []
  let cur: Piece | null = null
  for (const ch of text) {
    const strong = RTL_CH.test(ch) ? true : LTR_CH.test(ch) ? false : null
    if (!cur) { cur = { text: ch, rtl: strong ?? false, decided: strong !== null }; out.push(cur); continue }
    if (strong === null || strong === cur.rtl) { cur.text += ch; if (strong !== null) cur.decided = true; continue }
    // Leading neutrals (a quote mark, a digit) take the direction of the first letter after them.
    if (!cur.decided) { cur.rtl = strong; cur.decided = true; cur.text += ch; continue }
    cur = { text: ch, rtl: strong, decided: true }
    out.push(cur)
  }
  return out.map(({ text: t, rtl }) => ({ text: t, rtl }))
}

class Writer {
  w = new PackageWriter()
  loss = new Map<string, number>()
  numbers: { num: number; abs: number; start: number }[] = []
  abstracts: { id: number; levels: string[] }[] = []
  footnotes: Xml[] = []
  images = 0
  drawId = 1
  bookmark = 0
  constructor(public data: WordData, public part = 'word/document.xml') {}
  lose(what: string, n = 1) { this.loss.set(what, (this.loss.get(what) || 0) + n) }

  // ---- runs ---------------------------------------------------------------------------
  rPr(marks: PMMark[] | undefined, rtl: boolean, extra: XChild[] = []): Xml | null {
    const has = (t: string) => marks?.some((m) => m.type === t)
    const ts = marks?.find((m) => m.type === 'textStyle')?.attrs as { color?: string; highlight?: string; font?: string; size?: number } | undefined
    const link = has('link')
    const kids: XChild[] = [...extra]
    if (link) kids.unshift(x('w:rStyle', { 'w:val': 'Hyperlink' }))
    if (ts?.font) kids.push(x('w:rFonts', { 'w:ascii': ts.font, 'w:hAnsi': ts.font, 'w:cs': ts.font }))
    if (has('bold')) { kids.push(x('w:b')); kids.push(x('w:bCs')) }
    if (has('italic')) { kids.push(x('w:i')); kids.push(x('w:iCs')) }
    if (has('strike')) kids.push(x('w:strike'))
    if (ts?.color) kids.push(x('w:color', { 'w:val': hex(ts.color) }))
    if (has('code')) kids.push(x('w:rFonts', { 'w:ascii': 'Courier New', 'w:hAnsi': 'Courier New', 'w:cs': 'Courier New' }))
    if (ts?.size) { const hp = Math.round(Number(ts.size) * 2); kids.push(x('w:sz', { 'w:val': hp })); kids.push(x('w:szCs', { 'w:val': hp })) }
    if (has('underline')) kids.push(x('w:u', { 'w:val': 'single' }))
    if (ts?.highlight) kids.push(x('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': hex(ts.highlight) }))
    if (has('sup')) kids.push(x('w:vertAlign', { 'w:val': 'superscript' }))
    else if (has('sub')) kids.push(x('w:vertAlign', { 'w:val': 'subscript' }))
    // The BIDI language must be a right-to-left one whatever the document's own is;
    // Word formats the run's complex-script half by it.
    if (rtl) { kids.push(x('w:rtl')); kids.push(x('w:lang', { 'w:bidi': /^(ar|he|fa|ur|ps|yi)\b/i.test(this.data.lang || '') ? this.data.lang : 'ar-SA' })) }
    // CT_RPr is a SEQUENCE; Word tolerates disorder less than it admits. Order by the schema.
    const order = ['w:rStyle', 'w:rFonts', 'w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:strike', 'w:color', 'w:sz', 'w:szCs', 'w:u', 'w:shd', 'w:vertAlign', 'w:rtl', 'w:lang']
    const xs = kids.filter((k): k is Xml => !!k && typeof k === 'object' && !Array.isArray(k))
    // Two rFonts (code inside a styled run): keep the last.
    const seen = new Set<string>()
    const uniq = xs.reverse().filter((k) => { const t = tagOf(k); if (seen.has(t)) return false; seen.add(t); return true }).reverse()
    uniq.sort((a, b) => order.indexOf(tagOf(a)) - order.indexOf(tagOf(b)))
    return uniq.length ? x('w:rPr', null, uniq) : null
  }

  text(t: string, marks: PMMark[] | undefined): Xml[] {
    const out: Xml[] = []
    for (const piece of splitBidi(stripInvalidXmlChars(t))) {
      const rPr = this.rPr(marks, piece.rtl)
      // Tabs are their own element; a literal tab in w:t is not a tab to Word.
      const parts = piece.text.split('\t')
      const kids: XChild[] = [rPr]
      parts.forEach((p, i) => { if (i) kids.push(x('w:tab')); if (p) kids.push(x('w:t', { 'xml:space': 'preserve' }, p)) })
      out.push(x('w:r', null, kids))
    }
    return out
  }

  async inline(nodes: PMNode[] | undefined): Promise<XChild[]> {
    const out: XChild[] = []
    // Adjacent runs inside one link become one w:hyperlink.
    let linkHref: string | null = null
    let linkRuns: XChild[] = []
    const flush = () => {
      if (linkHref === null) return
      if (linkHref.startsWith('#')) out.push(x('w:hyperlink', { 'w:anchor': linkHref.slice(1) }, linkRuns))
      else out.push(x('w:hyperlink', { 'r:id': this.w.rel(this.part, { type: REL.hyperlink, target: linkHref, external: true }) }, linkRuns))
      linkHref = null
      linkRuns = []
    }
    for (const n of nodes || []) {
      const href = (n.marks?.find((m) => m.type === 'link')?.attrs?.href as string | undefined) ?? null
      if (href !== linkHref) flush()
      const target = href !== null ? linkRuns : out
      if (href !== null) linkHref = href
      if (n.type === 'text') target.push(...this.text(n.text || '', n.marks))
      else if (n.type === 'hard_break') target.push(x('w:r', null, x('w:br')))
      else if (n.type === 'image') target.push(await this.image(n))
      else if (n.type === 'footnote') target.push(this.footnote(String(n.attrs?.text || '')))
    }
    flush()
    return out
  }

  footnote(text: string): Xml {
    const id = this.footnotes.length + 1
    this.footnotes.push(x('w:footnote', { 'w:id': id },
      x('w:p', null, x('w:pPr', null, x('w:pStyle', { 'w:val': 'FootnoteText' })),
        x('w:r', null, x('w:rPr', null, x('w:rStyle', { 'w:val': 'FootnoteReference' })), x('w:footnoteRef')),
        x('w:r', null, x('w:t', { 'xml:space': 'preserve' }, ' ')),
        ...this.text(text, undefined))))
    return x('w:r', null, x('w:rPr', null, x('w:rStyle', { 'w:val': 'FootnoteReference' })), x('w:footnoteReference', { 'w:id': id }))
  }

  async image(n: PMNode): Promise<Xml> {
    const src = String(n.attrs?.src || '')
    const parsed = parseDataUrl(src)
    if (!parsed) { this.lose('pictures linked from the web (not embedded)'); return x('w:r', null) }
    let bytes = parsed.bytes
    let kind = sniffImage(bytes)
    // Word reads PNG, JPEG, GIF and BMP. A WebP — what the editor keeps pictures as — goes out
    // as JPEG, or PNG where it is transparent; anything else is redrawn as PNG.
    if (kind && /webp|avif/.test(kind.mime)) {
      const c = await classicImage(bytes)
      if (c) { bytes = c.bytes; kind = { mime: c.mime, ext: c.ext } }
    }
    if (!kind || !/png|jpeg|gif|bmp/.test(kind.mime)) {
      const png = await toPng(bytes, parsed.mime)
      if (!png) { this.lose('pictures in a format Word cannot read'); return x('w:r', null) }
      bytes = png
      kind = { mime: 'image/png', ext: 'png' }
    }
    this.images++
    const part = `word/media/image${this.images}.${kind.ext}`
    this.w.add(part, bytes)
    const rid = this.w.rel(this.part, { type: REL.image, target: part })
    let wpx = Number(n.attrs?.width) || 0
    let hpx = Number(n.attrs?.height) || 0
    if (!wpx || !hpx) { const dim = imageSize(bytes); wpx = wpx || dim?.w || 300; hpx = hpx || (dim ? Math.round(dim.h * (wpx / dim.w)) : 200) }
    // Never wider than the text column.
    const page = this.data.page
    const colPx = ((page.landscape ? Math.max(page.width, page.height) : page.width) - page.margins.left - page.margins.right) * (96 / 25.4)
    if (wpx > colPx) { hpx = Math.round(hpx * (colPx / wpx)); wpx = Math.round(colPx) }
    const cx = pxToEmu(wpx)
    const cy = pxToEmu(hpx)
    const id = this.drawId++
    const alt = String(n.attrs?.alt || '')
    const graphic = x('a:graphic', null, x('a:graphicData', { uri: 'http://schemas.openxmlformats.org/drawingml/2006/picture' },
      x('pic:pic', null,
        x('pic:nvPicPr', null, x('pic:cNvPr', { id, name: `Picture ${id}`, descr: alt || undefined }), x('pic:cNvPicPr')),
        x('pic:blipFill', null, x('a:blip', { 'r:embed': rid }), x('a:stretch', null, x('a:fillRect'))),
        x('pic:spPr', null, x('a:xfrm', null, x('a:off', { x: 0, y: 0 }), x('a:ext', { cx, cy })), x('a:prstGeom', { prst: 'rect' }, x('a:avLst'))))))
    const docPr = x('wp:docPr', { id, name: `Picture ${id}`, descr: alt || undefined })
    const locks = x('wp:cNvGraphicFramePr', null, x('a:graphicFrameLocks', { noChangeAspect: 1 }))
    const float = n.attrs?.float as string | null | undefined
    if (float) return x('w:r', null, x('w:drawing', null, this.anchor(float, cx, cy, docPr, locks, graphic)))
    return x('w:r', null, x('w:drawing', null,
      x('wp:inline', { distT: 0, distB: 0, distL: 0, distR: 0 }, x('wp:extent', { cx, cy }), docPr, locks, graphic)))
  }

  /** A floating object, set to one side of the column with the text running beside it. */
  anchor(float: string, cx: number, cy: number, docPr: Xml, locks: Xml | null, graphic: Xml): Xml {
    const gap = pxToEmu(12)
    const side = float === 'right' ? 'right' : float === 'center' ? 'center' : 'left'
    return x('wp:anchor', {
      distT: pxToEmu(2), distB: pxToEmu(6), distL: side === 'right' ? gap : 0, distR: side === 'left' ? gap : 0,
      simplePos: 0, relativeHeight: 251658240 + this.drawId, behindDoc: 0, locked: 0, layoutInCell: 1, allowOverlap: 1,
    },
      x('wp:simplePos', { x: 0, y: 0 }),
      x('wp:positionH', { relativeFrom: 'column' }, x('wp:align', null, side)),
      x('wp:positionV', { relativeFrom: 'paragraph' }, x('wp:posOffset', null, '0')),
      x('wp:extent', { cx, cy }),
      x('wp:effectExtent', { l: 0, t: 0, r: 0, b: 0 }),
      side === 'center' ? x('wp:wrapTopAndBottom') : x('wp:wrapSquare', { wrapText: 'bothSides' }),
      docPr, locks, graphic)
  }

  /** A text box: its own paragraphs in a DrawingML shape, anchored in a paragraph. */
  async textBox(n: PMNode): Promise<Xml> {
    const page = this.data.page
    const colPx = ((page.landscape ? Math.max(page.width, page.height) : page.width) - page.margins.left - page.margins.right) * (96 / 25.4)
    const wpx = Math.min(colPx, Number(n.attrs?.width) || Math.round(colPx / 3))
    // The height is a starting size; spAutoFit lets Word grow the box to its text.
    const lines = (n.content || []).reduce((k, b) => k + Math.max(1, Math.ceil(plainOf(b).length / Math.max(8, wpx / 7))), 0)
    const hpx = Math.max(24, lines * 22 + 12)
    const cx = pxToEmu(wpx)
    const cy = pxToEmu(hpx)
    const id = this.drawId++
    const fill = n.attrs?.fill as string | null | undefined
    const inner = await this.blocks(n.content)
    const shape = x('wps:wsp', null,
      x('wps:cNvSpPr', { txBox: 1 }),
      x('wps:spPr', null,
        x('a:xfrm', null, x('a:off', { x: 0, y: 0 }), x('a:ext', { cx, cy })),
        x('a:prstGeom', { prst: 'rect' }, x('a:avLst')),
        fill ? x('a:solidFill', null, x('a:srgbClr', { val: hex(fill) })) : x('a:noFill'),
        n.attrs?.border === false ? x('a:ln', null, x('a:noFill')) : x('a:ln', { w: 9525 }, x('a:solidFill', null, x('a:srgbClr', { val: '7A8A81' })))),
      x('wps:txbx', null, x('w:txbxContent', null, inner.length ? inner : x('w:p'))),
      x('wps:bodyPr', { rot: 0, vert: 'horz', wrap: 'square', lIns: 91440, tIns: 45720, rIns: 91440, bIns: 45720, anchor: 't' }, x('a:spAutoFit')))
    const graphic = x('a:graphic', null, x('a:graphicData', { uri: WPS }, shape))
    const docPr = x('wp:docPr', { id, name: `Text Box ${id}` })
    return x('w:r', null, x('mc:AlternateContent', null, x('mc:Choice', { Requires: 'wps' },
      x('w:drawing', null, this.anchor(String(n.attrs?.float || 'center'), cx, cy, docPr, x('wp:cNvGraphicFramePr'), graphic)))))
  }

  // ---- blocks -------------------------------------------------------------------------
  pPr(style: string | null, a: Record<string, unknown> | undefined, extra: { numId?: number; ilvl?: number; border?: boolean; rtlDefault?: boolean } = {}): Xml | null {
    const kids: XChild[] = []
    if (style) kids.push(x('w:pStyle', { 'w:val': style }))
    if (extra.numId) kids.push(x('w:numPr', null, x('w:ilvl', { 'w:val': extra.ilvl || 0 }), x('w:numId', { 'w:val': extra.numId })))
    const bd = a?.borders as Borders | null | undefined
    if (bd && (bd.t || bd.b || bd.l || bd.r)) {
      // Schema order: top, left, bottom, right.
      const side = (k: string, v?: BorderSide) => v ? x(`w:${k}`, { 'w:val': v.d ? 'double' : 'single', 'w:sz': Math.max(2, Math.round(v.w * 8)), 'w:space': Math.round(v.s), 'w:color': v.c.replace('#', '').toUpperCase() }) : null
      kids.push(x('w:pBdr', null, side('top', bd.t), side('left', bd.l), side('bottom', bd.b), side('right', bd.r)))
    } else if (extra.border) kids.push(x('w:pBdr', null, x('w:bottom', { 'w:val': 'single', 'w:sz': 6, 'w:space': 1, 'w:color': 'auto' })))
    const tabs = a?.tabs as TabStop[] | null | undefined
    if (tabs?.length) kids.push(x('w:tabs', null, [...tabs].sort((p, q) => p.pos - q.pos).map((t) => x('w:tab', { 'w:val': t.align, 'w:leader': t.leader === 'line' ? 'underscore' : t.leader, 'w:pos': Math.round(t.pos * 20) }))))
    const dir = a?.dir as string | null | undefined
    const rtl = dir === 'rtl' || (!dir && !!extra.rtlDefault)
    if (rtl) kids.push(x('w:bidi'))
    const sb = a?.spaceBefore as number | null | undefined
    const sa = a?.spaceAfter as number | null | undefined
    const lh = a?.lineHeight as number | null | undefined
    if (sb != null || sa != null || lh) kids.push(x('w:spacing', { 'w:before': sb != null ? Math.round(sb * 20) : undefined, 'w:after': sa != null ? Math.round(sa * 20) : undefined, 'w:line': lh ? Math.round(lh * 240) : undefined, 'w:lineRule': lh ? 'auto' : undefined }))
    const indent = Number(a?.indent || 0)
    const first = a?.firstLine as number | null | undefined
    if (indent || first) kids.push(x('w:ind', { 'w:start': indent ? Math.round(indent * 720) : undefined, 'w:firstLine': first && first > 0 ? Math.round(first * 20) : undefined, 'w:hanging': first && first < 0 ? Math.round(-first * 20) : undefined }))
    const al = a?.align as string | null | undefined
    // Logical alignment, written the way Word reads it: in a right-to-left
    // paragraph `left` and `right` are the start and the end.
    if (al) kids.push(x('w:jc', { 'w:val': al === 'justify' ? 'both' : al === 'center' ? 'center' : al === 'right' ? 'right' : 'left' }))
    return kids.length ? x('w:pPr', null, kids) : null
  }

  async blocks(nodes: PMNode[] | undefined, ctx: { ilvl?: number; numId?: number } = {}): Promise<XChild[]> {
    const out: XChild[] = []
    // A text box is anchored IN a paragraph: the one it sits before, when there is
    // one, so it adds no empty line of its own; otherwise a paragraph to hold it.
    let held: Xml[] = []
    for (const n of nodes || []) {
      if (n.type === 'text_box') { held.push(await this.textBox(n)); continue }
      const xs = await this.block(n, ctx)
      if (held.length && (n.type === 'paragraph' || n.type === 'heading') && xs.length) {
        xs[0] = intoParagraph(xs[0] as Xml, held.map((h) => h.s).join(''))
        held = []
      } else if (held.length) { out.push(x('w:p', null, held)); held = [] }
      out.push(...xs)
    }
    if (held.length) out.push(x('w:p', null, held))
    return out
  }

  async block(n: PMNode, ctx: { ilvl?: number; numId?: number } = {}): Promise<XChild[]> {
    const rtlDefault = !!this.data.rtl
    switch (n.type) {
      case 'paragraph': return [x('w:p', null, this.pPr(null, n.attrs, { rtlDefault }), await this.inline(n.content))]
      case 'heading': return [x('w:p', null, this.pPr(`Heading${Math.min(6, Math.max(1, Number(n.attrs?.level) || 1))}`, n.attrs, { rtlDefault }), await this.inline(n.content))]
      case 'blockquote': {
        const out: XChild[] = []
        for (const c of n.content || []) {
          if (c.type === 'paragraph') out.push(x('w:p', null, this.pPr('Quote', c.attrs, { rtlDefault }), await this.inline(c.content)))
          else out.push(...(await this.block(c, ctx)))
        }
        return out
      }
      case 'code_block': {
        const lines = (n.content?.map((c) => c.text || '').join('') || '').split('\n')
        return lines.map((l) => x('w:p', null, x('w:pPr', null, x('w:pStyle', { 'w:val': 'SourceCode' })), l ? this.text(l, undefined) : null))
      }
      case 'horizontal_rule': return [x('w:p', null, this.pPr(null, {}, { border: true }))]
      case 'page_break': return [x('w:p', null, x('w:r', null, x('w:br', { 'w:type': 'page' })))]
      case 'bullet_list': case 'ordered_list': return this.list(n, ctx)
      case 'table': return [await this.table(n), x('w:p')]
      default: return []
    }
  }

  async list(n: PMNode, ctx: { ilvl?: number; numId?: number }): Promise<XChild[]> {
    const ilvl = ctx.numId ? (ctx.ilvl ?? -1) + 1 : 0
    const fmt = n.type === 'bullet_list' ? (n.attrs?.checklist ? 'check' : 'bullet') : KIND_FMT[String(n.attrs?.kind || 'decimal')] || 'decimal'
    let numId = ctx.numId
    if (!numId) {
      const abs = this.abstracts.length
      this.abstracts.push({ id: abs, levels: Array(9).fill('') })
      numId = this.numbers.length + 1
      this.numbers.push({ num: numId, abs, start: Number(n.attrs?.order) || 1 })
    }
    const entry = this.numbers.find((e) => e.num === numId)!
    const lv = this.abstracts[entry.abs].levels
    if (!lv[Math.min(8, ilvl)]) lv[Math.min(8, ilvl)] = fmt
    const out: XChild[] = []
    for (const item of n.content || []) {
      const [first, ...rest] = item.content || []
      const box = n.attrs?.checklist ? (item.attrs?.checked ? '☑ ' : '☐ ') : ''
      if (n.attrs?.checklist) this.lose('checklist boxes (written as ☐ and ☑)')
      const inl = first?.content ? [...first.content] : []
      if (box) inl.unshift({ type: 'text', text: box })
      out.push(x('w:p', null, this.pPr('ListParagraph', first?.attrs, { numId, ilvl: Math.min(8, ilvl), rtlDefault: !!this.data.rtl }), await this.inline(inl)))
      for (const r of rest) out.push(...(await this.block(r, { numId, ilvl: Math.min(8, ilvl) })))
    }
    return out
  }

  async table(t: PMNode): Promise<Xml> {
    const rows = t.content || []
    // The grid: how many columns, and which cells a rowspan covers.
    const covered = new Map<string, PMNode>()
    let width = 0
    const layout: { cell: PMNode; col: number }[][] = rows.map(() => [])
    rows.forEach((row, r) => {
      let col = 0
      for (const cell of row.content || []) {
        while (covered.has(`${r},${col}`)) col++
        const cs = Number(cell.attrs?.colspan) || 1
        const rs = Number(cell.attrs?.rowspan) || 1
        layout[r].push({ cell, col })
        for (let dr = 1; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) covered.set(`${r + dr},${col + dc}`, cell)
        col += cs
      }
      width = Math.max(width, col)
    })
    for (const k of covered.keys()) width = Math.max(width, Number(k.split(',')[1]) + 1)
    const page = this.data.page
    const textTw = ((page.landscape ? Math.max(page.width, page.height) : page.width) - page.margins.left - page.margins.right) * TWIP_PER_MM
    const colTw: number[] = Array(width).fill(0)
    for (const row of layout) for (const { cell, col } of row) {
      const cw = cell.attrs?.colwidth as number[] | null
      if (cw) cw.forEach((px, i) => { if (col + i < width && !colTw[col + i]) colTw[col + i] = Math.round(px * 15) })
    }
    const known = colTw.reduce((a, b) => a + b, 0)
    const unknown = colTw.filter((v) => !v).length
    for (let i = 0; i < width; i++) if (!colTw[i]) colTw[i] = Math.max(400, Math.round((textTw - known) / Math.max(1, unknown)))
    const trs: Xml[] = []
    for (let r = 0; r < rows.length; r++) {
      const tcs: Xml[] = []
      const header = (rows[r].content || []).every((c) => c.type === 'table_header')
      let col = 0
      const byCol = new Map(layout[r].map((e) => [e.col, e.cell]))
      while (col < width) {
        const cov = covered.get(`${r},${col}`)
        if (cov) {
          const cs = Number(cov.attrs?.colspan) || 1
          tcs.push(x('w:tc', null, x('w:tcPr', null, x('w:tcW', { 'w:w': sum(colTw, col, cs), 'w:type': 'dxa' }), cs > 1 ? x('w:gridSpan', { 'w:val': cs }) : null, x('w:vMerge')), x('w:p')))
          col += cs
          continue
        }
        const cell = byCol.get(col)
        if (!cell) { tcs.push(x('w:tc', null, x('w:tcPr', null, x('w:tcW', { 'w:w': colTw[col], 'w:type': 'dxa' })), x('w:p'))); col++; continue }
        const cs = Number(cell.attrs?.colspan) || 1
        const rs = Number(cell.attrs?.rowspan) || 1
        const bg = cell.attrs?.background as string | null
        const va = cell.attrs?.valign as string | null
        const inner = await this.blocks(cell.content)
        const last = (cell.content || [])[cell.content!.length - 1]
        // A cell must END with a paragraph; a table nested last in a cell is invalid without one.
        if (!inner.length || last?.type === 'table') inner.push(x('w:p'))
        tcs.push(x('w:tc', null,
          x('w:tcPr', null, x('w:tcW', { 'w:w': sum(colTw, col, cs), 'w:type': 'dxa' }), cs > 1 ? x('w:gridSpan', { 'w:val': cs }) : null, rs > 1 ? x('w:vMerge', { 'w:val': 'restart' }) : null,
            bg ? x('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': hex(bg) }) : null, va ? x('w:vAlign', { 'w:val': va === 'middle' ? 'center' : va }) : null),
          inner))
        col += cs
      }
      trs.push(x('w:tr', null, header ? x('w:trPr', null, x('w:tblHeader')) : null, tcs))
    }
    const rtl = !!this.data.rtl
    // A table with no lines is written with none: without the grid style Word draws a table bare.
    const grid = (t.attrs?.grid as boolean | undefined) !== false
    return x('w:tbl', null,
      x('w:tblPr', null, grid ? x('w:tblStyle', { 'w:val': 'TableGrid' }) : null, rtl ? x('w:bidiVisual') : null, x('w:tblW', { 'w:w': 0, 'w:type': 'auto' }), x('w:tblLook', { 'w:val': '04A0', 'w:firstRow': 1, 'w:lastRow': 0, 'w:firstColumn': 1, 'w:lastColumn': 0, 'w:noHBand': 0, 'w:noVBand': 1 })),
      x('w:tblGrid', null, colTw.map((v) => x('w:gridCol', { 'w:w': v }))),
      trs)
  }

  // ---- parts --------------------------------------------------------------------------
  numberingXml(): string {
    const lvl = (i: number, fmt: string) => {
      const bullet = fmt === 'bullet' || fmt === 'check' || !fmt
      const indent = 720 * (i + 1)
      return x('w:lvl', { 'w:ilvl': i },
        x('w:start', { 'w:val': 1 }),
        x('w:numFmt', { 'w:val': fmt === 'check' ? 'none' : bullet ? 'bullet' : fmt }),
        x('w:lvlText', { 'w:val': fmt === 'check' ? '' : bullet ? BULLETS[i % 3] : `%${i + 1}.` }),
        x('w:lvlJc', { 'w:val': 'left' }),
        x('w:pPr', null, x('w:ind', { 'w:left': indent, 'w:hanging': 360 })),
        bullet && fmt !== 'check' ? x('w:rPr', null, x('w:rFonts', { 'w:ascii': 'Arial', 'w:hAnsi': 'Arial', 'w:hint': 'default' })) : null)
    }
    return xmlDoc(x('w:numbering', { 'xmlns:w': NS.w },
      this.abstracts.map((a) => x('w:abstractNum', { 'w:abstractNumId': a.id }, x('w:multiLevelType', { 'w:val': 'hybridMultilevel' }),
        a.levels.map((f, i) => lvl(i, f || (a.levels[0] === 'bullet' || a.levels[0] === 'check' ? 'bullet' : ['decimal', 'lowerLetter', 'lowerRoman'][i % 3]))))),
      this.numbers.map((n) => x('w:num', { 'w:numId': n.num }, x('w:abstractNumId', { 'w:val': n.abs }),
        x('w:lvlOverride', { 'w:ilvl': 0 }, x('w:startOverride', { 'w:val': n.start }))))))
  }

  headerFooter(kind: 'hdr' | 'ftr', text: string): Xml {
    const runs: XChild[] = []
    const field = (instr: string) => [
      x('w:r', null, x('w:fldChar', { 'w:fldCharType': 'begin' })),
      x('w:r', null, x('w:instrText', { 'xml:space': 'preserve' }, ` ${instr} `)),
      x('w:r', null, x('w:fldChar', { 'w:fldCharType': 'separate' })),
      x('w:r', null, x('w:t', null, '1')),
      x('w:r', null, x('w:fldChar', { 'w:fldCharType': 'end' })),
    ]
    const lines = text.split('\n')
    const paras = lines.map((line) => {
      const parts: XChild[] = []
      for (const piece of line.split(/(\{page\}|\{pages\})/)) {
        if (piece === '{page}') parts.push(...field('PAGE'))
        else if (piece === '{pages}') parts.push(...field('NUMPAGES'))
        else if (piece) parts.push(...this.text(piece, undefined))
      }
      return x('w:p', null, x('w:pPr', null, x('w:pStyle', { 'w:val': kind === 'hdr' ? 'Header' : 'Footer' }), this.data.rtl ? x('w:bidi') : null, x('w:jc', { 'w:val': 'center' })), parts)
    })
    void runs
    return x(kind === 'hdr' ? 'w:hdr' : 'w:ftr', W_ATTRS, paras)
  }
}

const tagOf = (k: Xml) => (k.s.match(/^<([\w:]+)/)?.[1] || '')
const sum = (a: number[], i: number, n: number) => a.slice(i, i + n).reduce((s, v) => s + v, 0)

export function hex(c: string): string {
  const v = c.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.slice(1).toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(v)) return v.slice(1).split('').map((ch) => ch + ch).join('').toUpperCase()
  const m = v.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i)
  if (m) return [m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, '0')).join('').toUpperCase()
  return '000000'
}

/** Pixel size from a PNG, JPEG or GIF header, without decoding it. */
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  if (b[0] === 0x89 && b[1] === 0x50) return { w: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], h: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] }
  if (b[0] === 0x47 && b[1] === 0x49) return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue }
      const m = b[i + 1]
      const len = (b[i + 2] << 8) | b[i + 3]
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] }
      i += 2 + len
    }
  }
  return null
}

async function toPng(bytes: Uint8Array, mime: string): Promise<Uint8Array | null> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return null
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }))
    const c = new OffscreenCanvas(bmp.width || 1, bmp.height || 1)
    c.getContext('2d')!.drawImage(bmp, 0, 0)
    return new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer())
  } catch { return null }
}

function stylesXml(rtl: boolean, lang: string): string {
  const hd = (n: number, size: number) => x('w:style', { 'w:type': 'paragraph', 'w:styleId': `Heading${n}` },
    x('w:name', { 'w:val': `heading ${n}` }), x('w:basedOn', { 'w:val': 'Normal' }), x('w:next', { 'w:val': 'Normal' }), x('w:uiPriority', { 'w:val': 9 }), x('w:qFormat'),
    x('w:pPr', null, x('w:keepNext'), x('w:keepLines'), x('w:spacing', { 'w:before': n === 1 ? 360 : 240, 'w:after': 80 }), x('w:outlineLvl', { 'w:val': n - 1 })),
    x('w:rPr', null, x('w:b'), x('w:bCs'), x('w:color', { 'w:val': n <= 2 ? '0B4F3A' : '1F3B33' }), x('w:sz', { 'w:val': size * 2 }), x('w:szCs', { 'w:val': size * 2 })))
  return xmlDoc(x('w:styles', { 'xmlns:w': NS.w },
    x('w:docDefaults', null,
      x('w:rPrDefault', null, x('w:rPr', null,
        x('w:rFonts', { 'w:ascii': 'Calibri', 'w:hAnsi': 'Calibri', 'w:eastAsia': 'Calibri', 'w:cs': 'Arial' }),
        x('w:sz', { 'w:val': 22 }), x('w:szCs', { 'w:val': 22 }),
        x('w:lang', { 'w:val': rtl ? 'ar-SA' : lang || 'en-US', 'w:bidi': 'ar-SA' }))),
      x('w:pPrDefault', null, x('w:pPr', null, x('w:spacing', { 'w:after': 160, 'w:line': 276, 'w:lineRule': 'auto' })))),
    x('w:style', { 'w:type': 'paragraph', 'w:default': 1, 'w:styleId': 'Normal' }, x('w:name', { 'w:val': 'Normal' }), x('w:qFormat'), rtl ? x('w:pPr', null, x('w:bidi')) : null),
    hd(1, 20), hd(2, 16), hd(3, 14), hd(4, 12), hd(5, 11), hd(6, 11),
    x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'Title' }, x('w:name', { 'w:val': 'Title' }), x('w:basedOn', { 'w:val': 'Normal' }), x('w:qFormat'), x('w:rPr', null, x('w:sz', { 'w:val': 56 }), x('w:szCs', { 'w:val': 56 }))),
    x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'Quote' }, x('w:name', { 'w:val': 'Quote' }), x('w:basedOn', { 'w:val': 'Normal' }), x('w:qFormat'),
      x('w:pPr', null, x('w:pBdr', null, x('w:left', { 'w:val': 'single', 'w:sz': 18, 'w:space': 8, 'w:color': '0B6E4F' })), x('w:ind', { 'w:left': 567, 'w:right': 567 })),
      x('w:rPr', null, x('w:i'), x('w:iCs'), x('w:color', { 'w:val': '404040' }))),
    x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'SourceCode' }, x('w:name', { 'w:val': 'Source Code' }), x('w:basedOn', { 'w:val': 'Normal' }),
      x('w:pPr', null, x('w:bidi', { 'w:val': 0 }), x('w:spacing', { 'w:after': 0, 'w:line': 240, 'w:lineRule': 'auto' }), x('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': 'F3F3F0' })),
      x('w:rPr', null, x('w:rFonts', { 'w:ascii': 'Courier New', 'w:hAnsi': 'Courier New', 'w:cs': 'Courier New' }), x('w:sz', { 'w:val': 20 }))),
    x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'ListParagraph' }, x('w:name', { 'w:val': 'List Paragraph' }), x('w:basedOn', { 'w:val': 'Normal' }), x('w:pPr', null, x('w:spacing', { 'w:after': 60 }), x('w:contextualSpacing'))),
    x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'Header' }, x('w:name', { 'w:val': 'header' }), x('w:basedOn', { 'w:val': 'Normal' })),
    x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'Footer' }, x('w:name', { 'w:val': 'footer' }), x('w:basedOn', { 'w:val': 'Normal' })),
    x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'FootnoteText' }, x('w:name', { 'w:val': 'footnote text' }), x('w:basedOn', { 'w:val': 'Normal' }), x('w:pPr', null, x('w:spacing', { 'w:after': 0 })), x('w:rPr', null, x('w:sz', { 'w:val': 18 }), x('w:szCs', { 'w:val': 18 }))),
    x('w:style', { 'w:type': 'character', 'w:styleId': 'FootnoteReference' }, x('w:name', { 'w:val': 'footnote reference' }), x('w:rPr', null, x('w:vertAlign', { 'w:val': 'superscript' }))),
    x('w:style', { 'w:type': 'character', 'w:styleId': 'Hyperlink' }, x('w:name', { 'w:val': 'Hyperlink' }), x('w:rPr', null, x('w:color', { 'w:val': '0B6E4F' }), x('w:u', { 'w:val': 'single' }))),
    x('w:style', { 'w:type': 'table', 'w:styleId': 'TableGrid' }, x('w:name', { 'w:val': 'Table Grid' }),
      x('w:tblPr', null, x('w:tblBorders', null, ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => x(`w:${s}`, { 'w:val': 'single', 'w:sz': 4, 'w:space': 0, 'w:color': 'auto' }))),
        x('w:tblCellMar', null, x('w:left', { 'w:w': 108, 'w:type': 'dxa' }), x('w:right', { 'w:w': 108, 'w:type': 'dxa' })))),
  ))
}

export async function writeDocx(data: WordData, meta: { title?: string } = {}): Promise<DocxExport> {
  const wr = new Writer(data)
  const body = await wr.blocks(data.doc.content)
  const w = wr.w
  const page = data.page
  const pw = Math.round((page.landscape ? Math.max(page.width, page.height) : Math.min(page.width, page.height)) * TWIP_PER_MM)
  const ph = Math.round((page.landscape ? Math.min(page.width, page.height) : Math.max(page.width, page.height)) * TWIP_PER_MM)
  const sect: XChild[] = []
  if (data.header) {
    w.add('word/header1.xml', xmlDoc(wr.headerFooter('hdr', data.header)), CT.header)
    sect.push(x('w:headerReference', { 'w:type': 'default', 'r:id': w.rel('word/document.xml', { type: REL.header, target: 'word/header1.xml' }) }))
  }
  if (data.footer) {
    w.add('word/footer1.xml', xmlDoc(wr.headerFooter('ftr', data.footer)), CT.footer)
    sect.push(x('w:footerReference', { 'w:type': 'default', 'r:id': w.rel('word/document.xml', { type: REL.footer, target: 'word/footer1.xml' }) }))
  }
  const mm = (v: number) => Math.round(v * TWIP_PER_MM)
  sect.push(x('w:pgSz', { 'w:w': pw, 'w:h': ph, 'w:orient': page.landscape ? 'landscape' : undefined }))
  sect.push(x('w:pgMar', { 'w:top': mm(page.margins.top), 'w:right': mm(page.margins.right), 'w:bottom': mm(page.margins.bottom), 'w:left': mm(page.margins.left), 'w:header': 709, 'w:footer': 709, 'w:gutter': 0 }))
  if (data.rtl) sect.push(x('w:bidi'))
  w.add('word/document.xml', xmlDoc(x('w:document', W_ATTRS, x('w:body', null, body, x('w:sectPr', null, sect)))), CT.doc)
  w.rel('', { type: REL.officeDocument, target: 'word/document.xml' })
  w.add('word/styles.xml', stylesXml(!!data.rtl, data.lang || 'en-US'), CT.styles)
  w.rel('word/document.xml', { type: REL.styles, target: 'word/styles.xml' })
  if (wr.numbers.length) {
    w.add('word/numbering.xml', wr.numberingXml(), CT.numbering)
    w.rel('word/document.xml', { type: REL.numbering, target: 'word/numbering.xml' })
  }
  if (wr.footnotes.length) {
    const sep = (id: number, t: 'separator' | 'continuationSeparator') => x('w:footnote', { 'w:type': t, 'w:id': id }, x('w:p', null, x('w:pPr', null, x('w:spacing', { 'w:after': 0 })), x('w:r', null, x(`w:${t}`))))
    w.add('word/footnotes.xml', xmlDoc(x('w:footnotes', W_ATTRS, sep(-1, 'separator'), sep(0, 'continuationSeparator'), wr.footnotes)), CT.footnotes)
    w.rel('word/document.xml', { type: REL.footnotes, target: 'word/footnotes.xml' })
  }
  w.add('word/settings.xml', xmlDoc(x('w:settings', { 'xmlns:w': NS.w },
    x('w:defaultTabStop', { 'w:val': 720 }),
    wr.footnotes.length ? x('w:footnotePr', null, x('w:footnote', { 'w:id': -1 }), x('w:footnote', { 'w:id': 0 })) : null,
    x('w:compat', null, x('w:compatSetting', { 'w:name': 'compatibilityMode', 'w:uri': 'http://schemas.microsoft.com/office/word', 'w:val': 15 })),
    x('w:themeFontLang', { 'w:val': 'en-US', 'w:bidi': 'ar-SA' }))), CT.settings)
  w.rel('word/document.xml', { type: REL.settings, target: 'word/settings.xml' })
  writeDocProps(w, { title: meta.title, app: 'Built in Saudi — Document Editor' })
  void raw
  return { blob: await w.toBlob(DOCX_MIME), loss: [...wr.loss].map(([what, count]) => ({ what, count })) }
}

function plainOf(n: PMNode): string { return n.text ?? (n.content || []).map(plainOf).join('') }
/** Put runs at the start of a built w:p, after its properties. */
function intoParagraph(p: Xml, runs: string): Xml {
  if (p.s === '<w:p/>') return raw(`<w:p>${runs}</w:p>`)
  const end = p.s.startsWith('<w:p><w:pPr') ? p.s.indexOf('</w:pPr>') + '</w:pPr>'.length : '<w:p>'.length
  return raw(p.s.slice(0, end) + runs + p.s.slice(end))
}
