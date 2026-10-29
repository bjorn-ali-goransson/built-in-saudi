// OpenDocument text (.odt) — LibreOffice's own format, and what many government
// and university machines save by default. Read here; the editor writes .docx,
// which LibreOffice opens.
//
// ODF says the same things as OOXML differently enough to trip a reader:
//  - Formatting lives in NAMED automatic styles (T1, P4), not on the run, so
//    every span and paragraph is resolved through its style and its parents.
//  - Spaces are compressed: `<text:s text:c="3"/>` is three spaces, and
//    whitespace inside the XML itself is NOT content.
//  - A merged cell leaves `covered-table-cell` placeholders that must be
//    skipped, or every merge shifts the rest of its row.
//  - A list's numbering lives in its list style, level by level.
import { zipEntries, readEntry } from '../../../lib/unzip'
import { parseXml, kids, attr, textOf, isEl, type XEl } from '../../../lib/xml'
import { sniffImage, dataUrl, OpcError } from '../../../lib/office/opc'
import { A4, type PMNode, type PMMark, type WordData, type PageSetup, isRtlText } from '../model'
import type { Loss } from './docx-read'

const NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  xlink: 'http://www.w3.org/1999/xlink',
  svg: 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
  dc: 'http://purl.org/dc/elements/1.1/',
}

interface TextProps { b?: boolean; i?: boolean; u?: boolean; s?: boolean; color?: string; bg?: string; size?: number; font?: string; sup?: boolean; sub?: boolean }
interface ParaProps { align?: string; rtl?: boolean; before?: number; after?: number; indent?: number; firstLine?: number; breakBefore?: boolean }
interface OStyle { name: string; family: string; parent?: string; text: TextProps; para: ParaProps; display?: string; listStyle?: string; outline?: number }
interface ListLevel { bullet: boolean; fmt: string; start: number }

const len = (v: string | undefined): number | undefined => {
  if (!v) return undefined
  const m = v.match(/^(-?[\d.]+)(cm|mm|in|pt|pc|px)?$/)
  if (!m) return undefined
  const n = +m[1]
  return m[2] === 'cm' ? n * 28.3465 : m[2] === 'mm' ? n * 2.83465 : m[2] === 'in' ? n * 72 : m[2] === 'pc' ? n * 12 : m[2] === 'px' ? n * 0.75 : n
}
const mmOf = (v: string | undefined, d: number) => { const p = len(v); return p === undefined ? d : Math.round((p / 2.83465) * 10) / 10 }

const FMT: Record<string, string> = { '1': 'decimal', a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman', '١, ٢, ٣, ...': 'arabic-indic', 'أ, ب, ت, ...': 'arabic-abjad' }

class OdtReader {
  styles = new Map<string, OStyle>()
  lists = new Map<string, ListLevel[]>()
  loss = new Map<string, number>()
  images = new Map<string, Uint8Array>()
  pageLayout: PageSetup = { ...A4, margins: { ...A4.margins } }
  lose(w: string, n = 1) { this.loss.set(w, (this.loss.get(w) || 0) + n) }

  readStyles(root: XEl | null) {
    if (!root) return
    const visit = (el: XEl) => {
      for (const c of el.children) {
        if (!isEl(c)) continue
        if (c.ns === NS.style && c.local === 'style') {
          const name = attr(c, 'name', NS.style)
          if (!name) continue
          const tp = kids(c, NS.style, 'text-properties')[0]
          const pp = kids(c, NS.style, 'paragraph-properties')[0]
          const ol = attr(c, 'default-outline-level', NS.style)
          this.styles.set(name, {
            name, family: attr(c, 'family', NS.style) || '', parent: attr(c, 'parent-style-name', NS.style),
            display: attr(c, 'display-name', NS.style), listStyle: attr(c, 'list-style-name', NS.style),
            text: this.textProps(tp), para: this.paraProps(pp), outline: ol ? +ol : undefined,
          })
        } else if (c.ns === NS.text && c.local === 'list-style') {
          const name = attr(c, 'name', NS.style)
          if (!name) continue
          const levels: ListLevel[] = Array.from({ length: 10 }, () => ({ bullet: true, fmt: 'decimal', start: 1 }))
          for (const l of c.children) {
            if (!isEl(l)) continue
            const lv = +(attr(l, 'level', NS.text) || 1) - 1
            if (lv < 0 || lv > 9) continue
            if (l.local === 'list-level-style-number') levels[lv] = { bullet: false, fmt: FMT[attr(l, 'num-format', NS.style) || '1'] || 'decimal', start: +(attr(l, 'start-value', NS.text) || 1) }
            else if (l.local === 'list-level-style-bullet' || l.local === 'list-level-style-image') levels[lv] = { bullet: true, fmt: 'bullet', start: 1 }
          }
          this.lists.set(name, levels)
        } else if (c.ns === NS.style && c.local === 'page-layout') {
          const p = kids(c, NS.style, 'page-layout-properties')[0]
          if (p && !this.pageLayoutSet) {
            const w = mmOf(attr(p, 'page-width', NS.fo), 210)
            const h = mmOf(attr(p, 'page-height', NS.fo), 297)
            this.pageLayout = {
              width: w, height: h, landscape: attr(p, 'print-orientation', NS.style) === 'landscape' || w > h,
              margins: { top: mmOf(attr(p, 'margin-top', NS.fo), 20), right: mmOf(attr(p, 'margin-right', NS.fo), 20), bottom: mmOf(attr(p, 'margin-bottom', NS.fo), 20), left: mmOf(attr(p, 'margin-left', NS.fo), 20) },
            }
            this.pageLayoutSet = true
          }
        } else visit(c)
      }
    }
    visit(root)
  }
  pageLayoutSet = false

  textProps(tp: XEl | undefined): TextProps {
    const t: TextProps = {}
    if (!tp) return t
    const fw = attr(tp, 'font-weight', NS.fo) || attr(tp, 'font-weight-complex', NS.style)
    if (fw) t.b = fw === 'bold' || +fw >= 600
    const fs = attr(tp, 'font-style', NS.fo) || attr(tp, 'font-style-complex', NS.style)
    if (fs) t.i = fs === 'italic' || fs === 'oblique'
    const u = attr(tp, 'text-underline-style', NS.style)
    if (u) t.u = u !== 'none'
    const s = attr(tp, 'text-line-through-style', NS.style)
    if (s) t.s = s !== 'none'
    const color = attr(tp, 'color', NS.fo)
    if (color && /^#[0-9a-f]{6}$/i.test(color)) t.color = color.toLowerCase()
    const bg = attr(tp, 'background-color', NS.fo)
    if (bg && /^#[0-9a-f]{6}$/i.test(bg)) t.bg = bg.toLowerCase()
    const size = len(attr(tp, 'font-size', NS.fo))
    if (size) t.size = Math.round(size * 2) / 2
    const font = attr(tp, 'font-name', NS.style)
    if (font) t.font = font
    const pos = attr(tp, 'text-position', NS.style)
    if (pos) { t.sup = /^(super|\d)/.test(pos) && !pos.startsWith('0'); t.sub = /^(sub|-)/.test(pos) }
    return t
  }
  paraProps(pp: XEl | undefined): ParaProps {
    const p: ParaProps = {}
    if (!pp) return p
    const ta = attr(pp, 'text-align', NS.fo)
    if (ta) p.align = ta === 'center' ? 'center' : ta === 'justify' ? 'justify' : ta === 'end' || ta === 'right' ? 'right' : 'left'
    const wm = attr(pp, 'writing-mode', NS.style)
    if (wm) p.rtl = wm.startsWith('rl')
    const mb = len(attr(pp, 'margin-top', NS.fo))
    const ma = len(attr(pp, 'margin-bottom', NS.fo))
    if (mb !== undefined) p.before = Math.round(mb)
    if (ma !== undefined) p.after = Math.round(ma)
    const ml = len(attr(pp, 'margin-left', NS.fo))
    if (ml) p.indent = Math.round(ml / 36)
    const ti = len(attr(pp, 'text-indent', NS.fo))
    if (ti) p.firstLine = Math.round(ti)
    if (attr(pp, 'break-before', NS.fo) === 'page') p.breakBefore = true
    return p
  }
  chain(name: string | undefined): OStyle[] {
    const out: OStyle[] = []
    const seen = new Set<string>()
    let cur = name
    while (cur && !seen.has(cur) && out.length < 20) { seen.add(cur); const s = this.styles.get(cur); if (!s) break; out.unshift(s); cur = s.parent }
    return out
  }
  text(name: string | undefined): TextProps { return Object.assign({}, ...this.chain(name).map((s) => s.text)) }
  para(name: string | undefined): ParaProps { return Object.assign({}, ...this.chain(name).map((s) => s.para)) }
  displayNames(name: string | undefined): string[] { return this.chain(name).map((s) => (s.display || s.name).replace(/_20_/g, ' ')) }

  marks(t: TextProps, link?: string): PMMark[] | undefined {
    const m: PMMark[] = []
    if (link) m.push({ type: 'link', attrs: { href: link, title: null } })
    if (t.b) m.push({ type: 'bold' })
    if (t.i) m.push({ type: 'italic' })
    if (t.u) m.push({ type: 'underline' })
    if (t.s) m.push({ type: 'strike' })
    if (t.sup) m.push({ type: 'sup' })
    else if (t.sub) m.push({ type: 'sub' })
    const color = t.color && t.color !== '#000000' ? t.color : null
    const size = t.size && t.size !== 12 && t.size !== 11 ? t.size : null
    if (color || t.bg || size || t.font) m.push({ type: 'textStyle', attrs: { color, highlight: t.bg || null, font: null, size } })
    return m.length ? m : undefined
  }

  inline(el: XEl, base: TextProps, link?: string, out: PMNode[] = []): PMNode[] {
    const push = (text: string, t: TextProps) => { if (text) out.push({ type: 'text', text, ...(this.marks(t, link) ? { marks: this.marks(t, link) } : {}) }) }
    for (const c of el.children) {
      if (typeof c === 'string') { push(c.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' '), base); continue }
      if (c.ns === NS.text) {
        switch (c.local) {
          case 'span': this.inline(c, { ...base, ...this.text(attr(c, 'style-name', NS.text)) }, link, out); break
          case 'a': this.inline(c, base, attr(c, 'href', NS.xlink) || link, out); break
          case 's': push(' '.repeat(Math.min(1000, +(attr(c, 'c', NS.text) || 1))), base); break
          case 'tab': push('\t', base); break
          case 'line-break': out.push({ type: 'hard_break' }); break
          case 'note': {
            const body = kids(c, NS.text, 'note-body')[0]
            out.push({ type: 'footnote', attrs: { text: body ? kids(body, NS.text, 'p').map((p) => textOf(p)).join('\n').trim() : '' } })
            break
          }
          case 'bookmark': case 'bookmark-start': case 'bookmark-end': case 'soft-page-break': case 'reference-mark': break
          case 'tracked-changes': this.lose('tracked changes (accepted as they stand)'); break
          case 'change-start': case 'change-end': case 'change': break
          default: this.inline(c, base, link, out)
        }
      } else if (c.ns === NS.draw && c.local === 'frame') {
        const img = kids(c, NS.draw, 'image')[0]
        const href = attr(img, 'href', NS.xlink)
        if (img && href && this.images.has(href)) {
          const bytes = this.images.get(href)!
          const kind = sniffImage(bytes)
          if (kind && /png|jpeg|gif|webp|svg|bmp/.test(kind.mime)) {
            const w = len(attr(c, 'width', NS.svg))
            const h = len(attr(c, 'height', NS.svg))
            const title = kids(c, NS.svg, 'title')[0] || kids(c, NS.svg, 'desc')[0]
            out.push({ type: 'image', attrs: { src: dataUrl(bytes, kind.mime), alt: title ? textOf(title) : null, title: null, width: w ? Math.round(w * 4 / 3) : null, height: h ? Math.round(h * 4 / 3) : null } })
          } else this.lose('pictures in a format browsers cannot show (EMF, WMF, TIFF)')
        } else if (kids(c, NS.draw, 'text-box')[0]) {
          this.lose('text boxes and shapes (their text is kept)')
          push(' ' + textOf(c).trim() + ' ', base)
        } else if (kids(c, NS.draw, 'object')[0]) this.lose('embedded objects and charts')
      } else if (c.ns === NS.draw) this.lose('drawings and shapes')
      else if (c.ns === NS.office && c.local === 'annotation') this.lose('comments')
    }
    return out
  }

  blockAttrs(styleName: string | undefined, content: PMNode[]): Record<string, unknown> {
    const pp = this.para(styleName)
    const a: Record<string, unknown> = {}
    if (pp.align && pp.align !== 'left') a.align = pp.align
    const text = content.map((n) => n.text || '').join('')
    if (pp.rtl === true || (pp.rtl === undefined && isRtlText(text))) a.dir = 'rtl'
    if (pp.indent) a.indent = Math.min(8, pp.indent)
    if (pp.firstLine) a.firstLine = pp.firstLine
    return a
  }

  blocks(el: XEl, listCtx?: { style: string; level: number; counters: Map<string, number> }): PMNode[] {
    const out: PMNode[] = []
    for (const c of el.children) {
      if (!isEl(c)) continue
      if (c.ns === NS.text && (c.local === 'p' || c.local === 'h')) {
        const sn = attr(c, 'style-name', NS.text)
        const base = this.text(sn)
        const content = this.inline(c, {}, undefined)
        if (this.para(sn).breakBefore) out.push({ type: 'page_break' })
        const names = this.displayNames(sn)
        const level = c.local === 'h' ? Math.min(6, Math.max(1, +(attr(c, 'outline-level', NS.text) || 1))) : 0
        const attrs = this.blockAttrs(sn, content)
        // A paragraph style's own bold is not a mark on a heading; it IS on a body paragraph.
        if (!level && (base.b || base.i)) for (const n of content) if (n.type === 'text') n.marks = mergeMarks(n.marks, this.marks({ b: base.b, i: base.i }))
        if (level) out.push({ type: 'heading', attrs: { level, ...attrs }, content })
        else if (names.some((n) => /preformatted|source text|code/i.test(n))) out.push({ type: 'code_block', content: content.length ? [{ type: 'text', text: content.map((n) => n.text || (n.type === 'hard_break' ? '\n' : '')).join('') }] : undefined })
        else if (names.some((n) => /^quotations?$/i.test(n))) out.push({ type: 'blockquote', content: [{ type: 'paragraph', attrs, content }] })
        else out.push({ type: 'paragraph', attrs, content })
      } else if (c.ns === NS.text && c.local === 'list') out.push(this.list(c, listCtx))
      else if (c.ns === NS.table && c.local === 'table') out.push(this.table(c))
      else if (c.ns === NS.text && (c.local === 'section' || c.local === 'index-body' || c.local === 'table-of-content' || c.local === 'alphabetical-index' || c.local === 'bibliography')) out.push(...this.blocks(c.local === 'section' ? c : kids(c, NS.text, 'index-body')[0] || c, listCtx))
      else if (c.ns === NS.text && (c.local === 'sequence-decls' || c.local === 'tracked-changes' || c.local === 'variable-decls' || c.local === 'user-field-decls')) continue
    }
    for (const n of out) if (n.content && !n.content.length) delete n.content
    return out
  }

  list(el: XEl, ctx?: { style: string; level: number; counters: Map<string, number> }): PMNode {
    const style = attr(el, 'style-name', NS.text) || ctx?.style || ''
    const level = ctx ? ctx.level + 1 : 0
    const lv = this.lists.get(style)?.[Math.min(9, level)] || { bullet: true, fmt: 'bullet', start: 1 }
    const counters = ctx?.counters || this.counters
    const key = `${style}:${level}`
    const continues = attr(el, 'continue-numbering', NS.text) === 'true' || !!attr(el, 'continue-list', NS.text)
    const start = continues && counters.has(key) ? counters.get(key)! + 1 : lv.start
    const items: PMNode[] = []
    for (const li of kids(el, NS.text, 'list-item').concat(kids(el, NS.text, 'list-header'))) {
      const inner = this.blocks(li, { style, level, counters })
      const first = inner[0]
      const para: PMNode = first && first.type === 'paragraph' ? first : first && first.type === 'heading' ? { type: 'paragraph', attrs: {}, content: first.content } : { type: 'paragraph' }
      const rest = first && (first.type === 'paragraph' || first.type === 'heading') ? inner.slice(1) : inner
      items.push({ type: 'list_item', attrs: {}, content: [para, ...rest] })
    }
    counters.set(key, start + items.length - 1)
    if (!items.length) items.push({ type: 'list_item', content: [{ type: 'paragraph' }] })
    return lv.bullet ? { type: 'bullet_list', attrs: {}, content: items } : { type: 'ordered_list', attrs: { order: start, kind: lv.fmt }, content: items }
  }
  counters = new Map<string, number>()

  table(t: XEl): PMNode {
    const rows: PMNode[] = []
    const rowEls: XEl[] = []
    const collect = (e: XEl) => { for (const c of e.children) if (isEl(c) && c.ns === NS.table) { if (c.local === 'table-row') rowEls.push(c); else if (c.local === 'table-rows' || c.local === 'table-header-rows' || c.local === 'table-row-group') collect(c) } }
    collect(t)
    const headerRows = new Set(kids(t, NS.table, 'table-header-rows').flatMap((h) => kids(h, NS.table, 'table-row')))
    for (const tr of rowEls.slice(0, 5000)) {
      const cells: PMNode[] = []
      for (const tc of tr.children) {
        if (!isEl(tc) || tc.ns !== NS.table) continue
        if (tc.local === 'covered-table-cell') continue
        if (tc.local !== 'table-cell') continue
        const rep = Math.min(50, +(attr(tc, 'number-columns-repeated', NS.table) || 1))
        for (let k = 0; k < rep; k++) {
          const content = this.blocks(tc)
          const bg = this.cellBg(attr(tc, 'style-name', NS.table))
          cells.push({
            type: headerRows.has(tr) ? 'table_header' : 'table_cell',
            attrs: { colspan: +(attr(tc, 'number-columns-spanned', NS.table) || 1), rowspan: +(attr(tc, 'number-rows-spanned', NS.table) || 1), colwidth: null, background: bg, valign: null },
            content: content.length ? content : [{ type: 'paragraph' }],
          })
        }
      }
      if (cells.length) rows.push({ type: 'table_row', content: cells })
    }
    return rows.length ? { type: 'table', content: rows } : { type: 'paragraph' }
  }
  cellBg(name: string | undefined): string | null {
    if (!name) return null
    return this.cellBgs.get(name) ?? null
  }
  cellBgs = new Map<string, string>()
  readCellStyles(root: XEl | null) {
    if (!root) return
    const walk = (e: XEl) => {
      for (const c of e.children) {
        if (!isEl(c)) continue
        if (c.ns === NS.style && c.local === 'style' && attr(c, 'family', NS.style) === 'table-cell') {
          const bg = attr(kids(c, NS.style, 'table-cell-properties')[0], 'background-color', NS.fo)
          if (bg && /^#[0-9a-f]{6}$/i.test(bg)) this.cellBgs.set(attr(c, 'name', NS.style)!, bg.toLowerCase())
        } else walk(c)
      }
    }
    walk(root)
  }
}

function mergeMarks(a: PMMark[] | undefined, b: PMMark[] | undefined): PMMark[] | undefined {
  const out = [...(a || [])]
  for (const m of b || []) if (!out.some((x) => x.type === m.type)) out.push(m)
  return out.length ? out : undefined
}

export async function readOdt(buf: ArrayBuffer): Promise<{ data: WordData; loss: Loss[]; title: string }> {
  const entries = zipEntries(buf)
  if (!entries) {
    const head = new Uint8Array(buf.slice(0, 8))
    if (head[0] === 0xd0 && head[1] === 0xcf) throw new OpcError('legacy-binary', 'legacy binary document')
    throw new OpcError('not-zip', 'not a zip')
  }
  const get = async (n: string) => { const e = entries.find((x) => x.name === n); return e ? readEntry(buf, e) : null }
  const mime = await get('mimetype')
  if (mime && !new TextDecoder().decode(mime).includes('opendocument.text')) throw new OpcError('not-ooxml', 'not a text document')
  const content = await get('content.xml')
  if (!content) throw new OpcError('missing-part', 'content.xml')
  const r = new OdtReader()
  for (const e of entries) if (/^Pictures\//.test(e.name) && e.size < 40 * 1024 * 1024) r.images.set(e.name, await readEntry(buf, e))
  const stylesBytes = await get('styles.xml')
  const stylesRoot = stylesBytes ? parseXml(new TextDecoder().decode(stylesBytes)) : null
  const root = parseXml(new TextDecoder().decode(content))
  r.readStyles(stylesRoot)
  r.readStyles(root)
  r.readCellStyles(root)
  const body = kids(kids(root, NS.office, 'body')[0], NS.office, 'text')[0]
  if (!body) throw new OpcError('not-ooxml', 'no text body')
  const doc = r.blocks(body)
  let title = ''
  const meta = await get('meta.xml')
  if (meta) { const m = parseXml(new TextDecoder().decode(meta)); const find = (e: XEl): string => { for (const c of e.children) if (isEl(c)) { if (c.ns === NS.dc && c.local === 'title') return textOf(c); const f = find(c); if (f) return f } return '' }; title = find(m) }
  const paras = doc.filter((n) => n.type === 'paragraph' || n.type === 'heading')
  const rtl = paras.length > 0 && paras.filter((n) => n.attrs?.dir === 'rtl').length > paras.length / 2
  return {
    data: { doc: { type: 'doc', content: doc.length ? doc : [{ type: 'paragraph' }] }, page: r.pageLayout, rtl, lang: rtl ? 'ar-SA' : 'en-US' },
    loss: [...r.loss].map(([what, count]) => ({ what, count })),
    title,
  }
}
