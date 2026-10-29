// The word processor's schema: the 80/20 of a Word document — headings,
// paragraphs with alignment, direction and spacing, lists (including
// checklists), tables with merged cells, images, links, page breaks, and the
// character formatting people actually use.
import { Schema, type NodeSpec, type MarkSpec, type DOMOutputSpec } from 'prosemirror-model'
import { tableNodes } from 'prosemirror-tables'

const blockAttrs = {
  align: { default: null as string | null },
  dir: { default: null as string | null },
  indent: { default: 0 },
  lineHeight: { default: null as number | null },
  spaceBefore: { default: null as number | null },
  spaceAfter: { default: null as number | null },
  firstLine: { default: null as number | null },
}

type BAttrs = { align: string | null; dir: string | null; indent: number; lineHeight: number | null; spaceBefore: number | null; spaceAfter: number | null; firstLine: number | null }

function blockStyle(a: BAttrs): string {
  const s: string[] = []
  if (a.align) s.push(`text-align:${a.align === 'left' ? 'start' : a.align === 'right' ? 'end' : a.align}`)
  if (a.indent) s.push(`margin-inline-start:${a.indent * 2}em`)
  if (a.lineHeight) s.push(`line-height:${a.lineHeight}`)
  if (a.spaceBefore != null) s.push(`margin-top:${a.spaceBefore}pt`)
  if (a.spaceAfter != null) s.push(`margin-bottom:${a.spaceAfter}pt`)
  if (a.firstLine) s.push(`text-indent:${a.firstLine}pt`)
  return s.join(';')
}
function blockDom(tag: string, a: BAttrs): Record<string, string> {
  const out: Record<string, string> = {}
  const st = blockStyle(a)
  if (st) out.style = st
  // A paragraph with no stated direction takes it from its own first letter.
  out.dir = a.dir || 'auto'
  void tag
  return out
}
function parseBlock(el: HTMLElement): Partial<BAttrs> {
  const ta = el.style.textAlign
  const ml = parseFloat(el.style.marginInlineStart || el.style.marginLeft || '0')
  return {
    align: ta === 'center' || ta === 'justify' ? ta : ta === 'right' || ta === 'end' ? 'right' : ta === 'left' || ta === 'start' ? null : null,
    dir: el.getAttribute('dir') === 'rtl' ? 'rtl' : el.getAttribute('dir') === 'ltr' ? 'ltr' : null,
    indent: ml ? Math.min(8, Math.round(ml / 32)) : 0,
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
  bullet_list: {
    content: 'list_item+', group: 'block', attrs: { checklist: { default: false } },
    parseDOM: [{ tag: 'ul', getAttrs: (d) => ({ checklist: (d as HTMLElement).dataset.checklist === '1' }) }],
    toDOM: (n) => ['ul', n.attrs.checklist ? { 'data-checklist': '1' } : {}, 0],
  },
  ordered_list: {
    content: 'list_item+', group: 'block', attrs: { order: { default: 1 }, kind: { default: 'decimal' } },
    parseDOM: [{ tag: 'ol', getAttrs: (d) => { const el = d as HTMLElement; return { order: el.hasAttribute('start') ? +el.getAttribute('start')! : 1, kind: TYPE_KIND[el.getAttribute('type') || ''] || el.dataset.kind || 'decimal' } } }],
    toDOM: (n) => ['ol', { ...(n.attrs.order === 1 ? {} : { start: String(n.attrs.order) }), 'data-kind': n.attrs.kind, style: `list-style-type:${n.attrs.kind}` }, 0],
  },
  list_item: {
    content: 'paragraph block*', defining: true, attrs: { checked: { default: null as boolean | null } },
    parseDOM: [{ tag: 'li', getAttrs: (d) => { const c = (d as HTMLElement).dataset.checked; return { checked: c === 'true' ? true : c === 'false' ? false : null } } }],
    toDOM: (n) => ['li', n.attrs.checked === null ? {} : { 'data-checked': String(n.attrs.checked) }, 0],
  },
  text: { group: 'inline' },
  image: {
    inline: true, group: 'inline', draggable: true,
    attrs: { src: {}, alt: { default: null }, title: { default: null }, width: { default: null as number | null }, height: { default: null as number | null } },
    parseDOM: [{ tag: 'img[src]', getAttrs: (d) => { const el = d as HTMLElement; return { src: el.getAttribute('src'), alt: el.getAttribute('alt'), title: el.getAttribute('title'), width: +(el.getAttribute('width') || 0) || null, height: +(el.getAttribute('height') || 0) || null } } }],
    toDOM: (n) => ['img', { src: n.attrs.src, alt: n.attrs.alt || '', title: n.attrs.title, ...(n.attrs.width ? { width: String(n.attrs.width) } : {}), ...(n.attrs.height ? { height: String(n.attrs.height) } : {}) }],
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
    },
  }),
}

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
      if (m.attrs.font) s.push(`font-family:"${m.attrs.font}"`)
      if (m.attrs.size) s.push(`font-size:${m.attrs.size}pt`)
      return ['span', { style: s.join(';') }, 0]
    },
  },
}

export const schema = new Schema({ nodes, marks })
