// The word processor's schema: the 80/20 of a Word document — headings,
// paragraphs with alignment, direction and spacing, lists (including
// checklists), tables with merged cells, images, links, page breaks, and the
// character formatting people actually use.
import { Schema, type NodeSpec, type MarkSpec, type DOMOutputSpec } from 'prosemirror-model'
import { tableNodes } from 'prosemirror-tables'
import { runFaceCss } from './docFont'

const blockAttrs = {
  align: { default: null as string | null },
  dir: { default: null as string | null },
  indent: { default: 0 },
  lineHeight: { default: null as number | null },
  // Word's two fixed line rules, in points: EXACT is the line pitch whatever the font, AT LEAST
  // is a floor under the font's own single line. Either one replaces lineHeight's multiple.
  lineExact: { default: null as number | null },
  lineMin: { default: null as number | null },
  // An EMPTY paragraph is as tall as its paragraph mark's face and size in Word, not the document's —
  // a CV's blank spacer lines are usually set smaller than the body. Kept as the paragraph's own face.
  paraSize: { default: null as number | null },
  paraFont: { default: null as string | null },
  spaceBefore: { default: null as number | null },
  spaceAfter: { default: null as number | null },
  firstLine: { default: null as number | null },
  borders: { default: null as Borders | null },
  tabs: { default: null as TabStop[] | null },
}

/** One side of a paragraph border: width and space in points, a colour, double or not. */
export interface BorderSide { w: number; c: string; s: number; d?: boolean }
export interface Borders { t?: BorderSide; b?: BorderSide; l?: BorderSide; r?: BorderSide }
/** A tab stop, its position in points from the paragraph's start. */
export interface TabStop { pos: number; align: 'left' | 'right' | 'center' | 'decimal'; leader?: 'dot' | 'hyphen' | 'line' }

type BAttrs = { align: string | null; dir: string | null; indent: number; lineHeight: number | null; lineExact?: number | null; lineMin?: number | null; paraSize?: number | null; paraFont?: string | null; spaceBefore: number | null; spaceAfter: number | null; firstLine: number | null; borders?: Borders | null; tabs?: TabStop[] | null }

/** A paragraph border as CSS: the line, and Word's "space" as padding between it and the text. Physical sides, as Word's are. */
export function borderCss(b: Borders | null | undefined): string[] {
  const out: string[] = []
  if (!b) return out
  for (const [k, side] of [['t', 'top'], ['b', 'bottom'], ['l', 'left'], ['r', 'right']] as const) {
    const v = b[k]
    if (!v) continue
    out.push(`border-${side}:${v.d ? Math.max(3, v.w * 3) : v.w}pt ${v.d ? 'double' : 'solid'} ${v.c}`, `padding-${side}:${v.s}pt`)
  }
  return out
}

/**
 * A paragraph's spacing and layout as CSS, for the editor AND the exported/printed HTML — one
 * function, so the screen and the paper cannot disagree about where a line sits.
 *
 * Two properties of Word that CSS does not have by default, and both moved every line of every
 * imported document:
 *  - SINGLE spacing is the font's own line (ascent + descent + gap: 1.22 em for Calibri) — not
 *    `1`, which is the font size and a fifth tighter. It is written as --wd-lh times m (the
 *    document face's single line, measured once at a large size), NOT as `normal`: the browser
 *    rounds a face's ascent and descent to whole pixels at each size, so `normal` at 10pt made
 *    every line 17px where Word's is 16.3 — four per cent, on every line of every page.
 *  - Between two paragraphs Word keeps the LARGER of the space after and the space before, which
 *    is CSS margin collapsing. A document that turns on "Don't use HTML paragraph auto spacing"
 *    asks for the SUM instead; --wd-sb carries the space before so that mode (`data-wd-sum`) can
 *    turn it into padding, which never collapses.
 */
export function blockCss(a: Partial<BAttrs> | Record<string, unknown> | undefined): string[] {
  const b = (a || {}) as Partial<BAttrs>
  const s: string[] = []
  if (b.align) s.push(`text-align:${b.align === 'left' ? 'start' : b.align === 'right' ? 'end' : b.align}`)
  // One step is Word's half inch, 36pt, so a document indented here is indented the same in Word.
  if (b.indent) s.push(`margin-inline-start:${+(Number(b.indent) * 36).toFixed(2)}pt`)
  if (b.lineExact) s.push(`line-height:${b.lineExact}pt`)
  else if (b.lineMin) s.push(`line-height:max(${b.lineMin}pt,calc(var(--wd-lh,1.2) * 1em))`)
  else if (b.lineHeight) s.push(`--wd-m:${b.lineHeight}`, `line-height:calc(var(--wd-lh,1.2) * ${b.lineHeight})`)
  if (b.spaceBefore != null) s.push(`margin-top:${b.spaceBefore}pt`, `--wd-sb:${b.spaceBefore}pt`)
  if (b.spaceAfter != null) s.push(`margin-bottom:${b.spaceAfter}pt`)
  if (b.firstLine) s.push(`text-indent:${b.firstLine}pt`)
  if (b.paraSize) s.push(`font-size:${b.paraSize}pt`)
  if (b.paraFont) s.push(...runFaceCss(String(b.paraFont)))
  s.push(...borderCss(b.borders))
  return s
}
function blockStyle(a: BAttrs): string { return blockCss(a).join(';') }
/**
 * A list item is spaced as its paragraph: the marker sits in the item's own line box, so an item
 * at the page's 1.5 made every first line taller than the paragraph beside it said.
 */
export function itemCss(a: Record<string, unknown> | undefined): string {
  return blockCss(a).filter((x) => /^(line-height|--wd-m|font-size)/.test(x)).join(';')
}
function blockDom(tag: string, a: BAttrs): Record<string, string> {
  const out: Record<string, string> = {}
  const st = blockStyle(a)
  if (st) out.style = st
  // A paragraph with no stated direction takes it from its own first letter.
  out.dir = a.dir || 'auto'
  // Tab stops are drawn by tabLayout.ts, which finds the paragraphs that have them by this.
  if (a.tabs?.length) out['data-tabs'] = JSON.stringify(a.tabs)
  void tag
  return out
}
function parseBlock(el: HTMLElement): Partial<BAttrs> {
  const ta = el.style.textAlign
  const ml = parseFloat(el.style.marginInlineStart || el.style.marginLeft || '0')
  return {
    align: ta === 'center' || ta === 'justify' ? ta : ta === 'right' || ta === 'end' ? 'right' : ta === 'left' || ta === 'start' ? null : null,
    dir: el.getAttribute('dir') === 'rtl' ? 'rtl' : el.getAttribute('dir') === 'ltr' ? 'ltr' : null,
    indent: ml ? Math.min(8, Math.round((ml / 48) * 100) / 100) : 0,
  }
}

const nodes: Record<string, NodeSpec> = {
  doc: { content: 'block+' },
  paragraph: {
    content: 'inline*', group: 'block', attrs: blockAttrs,
    parseDOM: [{ tag: 'p', getAttrs: (d) => parseBlock(d as HTMLElement) }],
    toDOM: (n) => ['p', blockDom('p', n.attrs as BAttrs), 0],
  },
  heading: {
    content: 'inline*', group: 'block', defining: true, attrs: { level: { default: 1 }, ...blockAttrs },
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, getAttrs: (d: string | HTMLElement) => ({ level, ...parseBlock(d as HTMLElement) }) })),
    toDOM: (n) => [`h${n.attrs.level}`, blockDom('h', n.attrs as BAttrs), 0],
  },
  blockquote: {
    content: 'block+', group: 'block', defining: true, attrs: { dir: { default: null } },
    parseDOM: [{ tag: 'blockquote' }],
    toDOM: (n) => ['blockquote', { dir: n.attrs.dir || 'auto' }, 0],
  },
  code_block: {
    content: 'text*', marks: '', group: 'block', code: true, defining: true,
    parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
    toDOM: () => ['pre', { dir: 'ltr' }, ['code', 0]],
  },
  horizontal_rule: { group: 'block', parseDOM: [{ tag: 'hr' }], toDOM: () => ['hr'] },
  page_break: {
    group: 'block', atom: true, selectable: true,
    parseDOM: [{ tag: 'div.page-break' }, { tag: 'hr.page-break', priority: 60 }],
    toDOM: () => ['div', { class: 'page-break', 'data-page-break': '1' }],
  },
  // `pad`: the list's text indent in points, from the document's numbering (relative to the list it
  // sits in); null is the editor's own.
  bullet_list: {
    content: 'list_item+', group: 'block', attrs: { checklist: { default: false }, pad: { default: null as number | null } },
    parseDOM: [{ tag: 'ul', getAttrs: (d) => ({ checklist: (d as HTMLElement).dataset.checklist === '1' }) }],
    toDOM: (n) => ['ul', { ...(n.attrs.checklist ? { 'data-checklist': '1' } : {}), ...(n.attrs.pad != null ? { style: `padding-inline-start:${n.attrs.pad}pt` } : {}) }, 0],
  },
  ordered_list: {
    content: 'list_item+', group: 'block', attrs: { order: { default: 1 }, kind: { default: 'decimal' }, pad: { default: null as number | null } },
    parseDOM: [{ tag: 'ol', getAttrs: (d) => { const el = d as HTMLElement; return { order: el.hasAttribute('start') ? +el.getAttribute('start')! : 1, kind: TYPE_KIND[el.getAttribute('type') || ''] || el.dataset.kind || 'decimal' } } }],
    toDOM: (n) => ['ol', { ...(n.attrs.order === 1 ? {} : { start: String(n.attrs.order) }), 'data-kind': n.attrs.kind, style: `list-style-type:${n.attrs.kind}${n.attrs.pad != null ? `;padding-inline-start:${n.attrs.pad}pt` : ''}` }, 0],
  },
  list_item: {
    content: 'paragraph block*', defining: true, attrs: { checked: { default: null as boolean | null } },
    parseDOM: [{ tag: 'li', getAttrs: (d) => { const c = (d as HTMLElement).dataset.checked; return { checked: c === 'true' ? true : c === 'false' ? false : null } } }],
    toDOM: (n) => {
      const st = itemCss(n.firstChild?.attrs)
      return ['li', { ...(n.attrs.checked === null ? {} : { 'data-checked': String(n.attrs.checked) }), ...(st ? { style: st } : {}) }, 0]
    },
  },
  text: { group: 'inline' },
  image: {
    inline: true, group: 'inline', draggable: true,
    // `float`: null sits in the line like a letter; left/right let the text run
    // beside it; center puts it on a line of its own. PHYSICAL sides, as Word's
    // own placement is: a picture set on the right is on the right in Arabic too.
    attrs: { src: {}, alt: { default: null }, title: { default: null }, width: { default: null as number | null }, height: { default: null as number | null }, float: { default: null as Float } },
    parseDOM: [{ tag: 'img[src]', getAttrs: (d) => { const el = d as HTMLElement; return { src: el.getAttribute('src'), alt: el.getAttribute('alt'), title: el.getAttribute('title'), width: +(el.getAttribute('width') || 0) || null, height: +(el.getAttribute('height') || 0) || null, float: floatOf(el.dataset.float) } } }],
    toDOM: (n) => ['img', { src: n.attrs.src, alt: n.attrs.alt || '', title: n.attrs.title, ...(n.attrs.width ? { width: String(n.attrs.width) } : {}), ...(n.attrs.height ? { height: String(n.attrs.height) } : {}), ...(n.attrs.float ? { 'data-float': n.attrs.float } : {}) }],
  },
  // A box of its own paragraphs, placed beside the text the way Word's text box
  // and LibreOffice's text frame are. Its words were once kept as loose text in
  // the paragraph; a sidebar's two paragraphs then ran into the sentence it sat
  // beside, which is not the document anybody wrote.
  text_box: {
    content: 'block+', group: 'block', defining: true, isolating: true,
    attrs: { width: { default: null as number | null }, float: { default: null as Float }, fill: { default: null as string | null }, border: { default: true } },
    parseDOM: [{ tag: 'div.wd-textbox', getAttrs: (d) => { const el = d as HTMLElement; return { width: parseFloat(el.style.width) || null, float: floatOf(el.dataset.float), fill: /^#[0-9a-f]{3,8}$/i.test(el.dataset.fill || '') ? el.dataset.fill! : null, border: el.dataset.border !== '0' } } }],
    toDOM: (n) => ['div', {
      class: 'wd-textbox', 'data-testid': 'wd-textbox',
      ...(n.attrs.float ? { 'data-float': n.attrs.float } : {}),
      ...(n.attrs.fill ? { 'data-fill': n.attrs.fill } : {}),
      ...(n.attrs.border ? {} : { 'data-border': '0' }),
      style: [n.attrs.width ? `width:${n.attrs.width}px` : '', n.attrs.fill ? `background-color:${n.attrs.fill}` : ''].filter(Boolean).join(';'),
    }, 0],
  },
  hard_break: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
  footnote: {
    inline: true, group: 'inline', atom: true, attrs: { text: { default: '' } },
    parseDOM: [{ tag: 'sup.footnote', getAttrs: (d) => ({ text: (d as HTMLElement).dataset.text || '' }) }],
    toDOM: (n) => ['sup', { class: 'footnote', 'data-text': n.attrs.text, title: n.attrs.text }],
  },
  ...tableNodes({
    tableGroup: 'block',
    cellContent: 'block+',
    cellAttributes: {
      background: {
        default: null,
        getFromDOM: (d) => (d as HTMLElement).style.backgroundColor || null,
        setDOMAttr: (v, attrs) => { if (v) attrs.style = (attrs.style || '') + `background-color:${v};` },
      },
      valign: {
        default: null,
        getFromDOM: (d) => (d as HTMLElement).style.verticalAlign || null,
        setDOMAttr: (v, attrs) => { if (v) attrs.style = (attrs.style || '') + `vertical-align:${v};` },
      },
      // A cell's own padding (Word's tcMar), "top right bottom left" in points, over the table's.
      pad: {
        default: null,
        getFromDOM: (d) => (d as HTMLElement).dataset.pad || null,
        setDOMAttr: (v, attrs) => { const css = padCss(v); if (css) { attrs['data-pad'] = v; attrs.style = (attrs.style || '') + `padding:${css};` } },
      },
    },
  }),
}


/** A padding attribute ("top right bottom left", points) as CSS; null for anything else. */
export function padCss(pad: unknown): string | null {
  if (typeof pad !== 'string' || !/^[\d.]+( [\d.]+){3}$/.test(pad)) return null
  return pad.split(' ').map((v) => v + 'pt').join(' ')
}
export type Float = 'left' | 'right' | 'center' | null
export const floatOf = (v: unknown): Float => (v === 'left' || v === 'right' || v === 'center' ? v : null)

const TYPE_KIND: Record<string, string> = { '1': 'decimal', a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' }

const marks: Record<string, MarkSpec> = {
  link: {
    attrs: { href: {}, title: { default: null } }, inclusive: false,
    parseDOM: [{ tag: 'a[href]', getAttrs: (d) => ({ href: (d as HTMLElement).getAttribute('href'), title: (d as HTMLElement).getAttribute('title') }) }],
    toDOM: (m) => ['a', { href: m.attrs.href, title: m.attrs.title, rel: 'noopener noreferrer nofollow', target: '_blank' }, 0],
  },
  bold: {
    parseDOM: [{ tag: 'strong' }, { tag: 'b', getAttrs: (d) => (d as HTMLElement).style.fontWeight !== 'normal' && null }, { style: 'font-weight', getAttrs: (v) => /^(bold(er)?|[6-9]\d\d)$/.test(v as string) && null }],
    toDOM: (): DOMOutputSpec => ['strong', 0],
  },
  italic: { parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }], toDOM: (): DOMOutputSpec => ['em', 0] },
  underline: { parseDOM: [{ tag: 'u' }, { style: 'text-decoration', getAttrs: (v) => (v as string).includes('underline') && null }], toDOM: (): DOMOutputSpec => ['u', 0] },
  strike: { parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }, { style: 'text-decoration', getAttrs: (v) => (v as string).includes('line-through') && null }], toDOM: (): DOMOutputSpec => ['s', 0] },
  code: { parseDOM: [{ tag: 'code' }], toDOM: (): DOMOutputSpec => ['code', 0] },
  sup: { excludes: 'sub', parseDOM: [{ tag: 'sup:not(.footnote)' }], toDOM: (): DOMOutputSpec => ['sup', 0] },
  sub: { excludes: 'sup', parseDOM: [{ tag: 'sub' }], toDOM: (): DOMOutputSpec => ['sub', 0] },
  // Colour, highlight, font and size in ONE mark: they are attributes of one run of text,
  // and four marks would leave empty spans behind every time one of them is unset.
  textStyle: {
    attrs: { color: { default: null }, highlight: { default: null }, font: { default: null }, size: { default: null } },
    parseDOM: [{
      tag: 'span[style]',
      getAttrs: (d) => {
        const st = (d as HTMLElement).style
        const size = st.fontSize.endsWith('pt') ? parseFloat(st.fontSize) : st.fontSize.endsWith('px') ? Math.round(parseFloat(st.fontSize) * 0.75 * 2) / 2 : null
        const a = { color: st.color || null, highlight: st.backgroundColor || null, font: st.fontFamily ? st.fontFamily.split(',')[0].replace(/["']/g, '').trim() : null, size }
        return a.color || a.highlight || a.font || a.size ? a : false
      },
    }],
    toDOM: (m) => {
      const s: string[] = []
      if (m.attrs.color) s.push(`color:${m.attrs.color}`)
      if (m.attrs.highlight) s.push(`background-color:${m.attrs.highlight}`)
      if (m.attrs.font) s.push(...runFaceCss(String(m.attrs.font)))
      if (m.attrs.size) s.push(`font-size:${m.attrs.size}pt`)
      return ['span', { style: s.join(';') }, 0]
    },
  },
}

// A table either draws its lines or does not — a CV's layout table has none, and drawing a grid
// on it was the commonest visible difference from the original. No lines is shown in the editor
// as faint guides (Word's "View Gridlines") and prints as nothing.
/** A table's own cell padding, as a variable its cells read; the attribute keeps it through a parse. */
export function tablePadAttrs(pad: unknown): Record<string, string> {
  const css = padCss(pad)
  return css ? { 'data-pad': pad as string, style: `--wd-cp:${css}` } : {}
}
nodes.table = {
  ...nodes.table,
  // pad: the cell padding "top right bottom left" in points, as the document set it; null is ours.
  attrs: { grid: { default: true }, pad: { default: null } },
  parseDOM: [{ tag: 'table', getAttrs: (d) => ({ grid: !(d as HTMLElement).classList.contains('wd-nogrid'), pad: (d as HTMLElement).dataset.pad || null }) }],
  toDOM: (n) => ['table', { ...(n.attrs.grid === false ? { class: 'wd-nogrid' } : {}), ...tablePadAttrs(n.attrs.pad) }, ['tbody', 0]],
}

export const schema = new Schema({ nodes, marks })
