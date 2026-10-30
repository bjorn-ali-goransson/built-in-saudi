// The plain-text family: Markdown and plain text in, Markdown, HTML and plain
// text out. Pure string work on the document JSON, so it runs in the worker
// and in tests alike.
import { parseMarkdown, type Inline, type Block } from '../../../lib/markdown'
import { borderCss, type Borders } from '../schema'
import { emptyDoc, isRtlText, plainText, type PMNode, type PMMark, type WordData } from '../model'

const inlineNodes = (inl: Inline[]): PMNode[] => inl.filter((n) => n.v).map((n): PMNode => {
  const marks: PMMark[] = n.t === 'strong' ? [{ type: 'bold' }] : n.t === 'em' ? [{ type: 'italic' }] : n.t === 'strike' ? [{ type: 'strike' }] : n.t === 'code' ? [{ type: 'code' }] : n.t === 'link' ? [{ type: 'link', attrs: { href: n.href, title: null } }] : []
  return marks.length ? { type: 'text', text: n.v, marks } : { type: 'text', text: n.v }
})
const para = (inl: Inline[]): PMNode => {
  const content = inlineNodes(inl)
  const text = content.map((c) => c.text).join('')
  return { type: 'paragraph', attrs: isRtlText(text) ? { dir: 'rtl' } : {}, ...(content.length ? { content } : {}) }
}

export function fromMarkdown(src: string): WordData {
  const blocks: Block[] = parseMarkdown(src)
  const out: PMNode[] = []
  for (const b of blocks) {
    if (b.t === 'heading') { const p = para(b.inline); out.push({ type: 'heading', attrs: { level: Math.min(6, b.level), ...p.attrs }, content: p.content }) }
    else if (b.t === 'para') out.push(para(b.inline))
    else if (b.t === 'quote') out.push({ type: 'blockquote', content: [para(b.inline)] })
    else if (b.t === 'code') out.push({ type: 'code_block', ...(b.text ? { content: [{ type: 'text', text: b.text }] } : {}) })
    else if (b.t === 'rule') out.push({ type: 'horizontal_rule' })
    else if (b.t === 'table') out.push({ type: 'table', content: b.rows.map((row, i) => ({ type: 'table_row', content: row.map((cell) => ({ type: i === 0 ? 'table_header' : 'table_cell', attrs: { colspan: 1, rowspan: 1, colwidth: null, background: null, valign: null }, content: [para(cell)] })) })) })
    else if (b.t === 'list') {
      // Items carry a depth; nest them under the previous item, one list per level.
      const type = b.ordered ? 'ordered_list' : 'bullet_list'
      const root: PMNode = { type, attrs: b.ordered ? { order: 1, kind: 'decimal' } : {}, content: [] }
      const stack: { depth: number; list: PMNode }[] = [{ depth: 0, list: root }]
      for (const it of b.items) {
        while (stack.length > 1 && stack[stack.length - 1].depth > it.depth) stack.pop()
        let top = stack[stack.length - 1]
        if (it.depth > top.depth) {
          const parentItem = top.list.content![top.list.content!.length - 1]
          const nested: PMNode = { type, attrs: root.attrs, content: [] }
          if (parentItem) { parentItem.content!.push(nested); stack.push({ depth: it.depth, list: nested }); top = stack[stack.length - 1] }
        }
        const checked = it.inline[0]?.t === 'text' ? it.inline[0].v.match(/^\[([ xX])\]\s+/) : null
        if (checked) { it.inline[0] = { ...it.inline[0], v: it.inline[0].v.slice(checked[0].length) }; top.list.attrs = { ...top.list.attrs, checklist: true } }
        top.list.content!.push({ type: 'list_item', attrs: checked ? { checked: checked[1] !== ' ' } : {}, content: [para(it.inline)] })
      }
      out.push(root)
    }
  }
  const d = emptyDoc()
  d.doc = { type: 'doc', content: out.length ? out : [{ type: 'paragraph' }] }
  const paras = out.filter((n) => n.type === 'paragraph' || n.type === 'heading')
  d.rtl = paras.length > 0 && paras.filter((n) => n.attrs?.dir === 'rtl').length > paras.length / 2
  return d
}

export function fromText(src: string): WordData {
  const d = emptyDoc()
  const lines = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/)
  d.doc = {
    type: 'doc',
    content: lines.map((block) => {
      const parts = block.split('\n')
      const content: PMNode[] = []
      parts.forEach((p, i) => { if (i) content.push({ type: 'hard_break' }); if (p) content.push({ type: 'text', text: p }) })
      return { type: 'paragraph', attrs: isRtlText(block) ? { dir: 'rtl' } : {}, ...(content.length ? { content } : {}) }
    }),
  }
  d.rtl = isRtlText(src)
  return d
}

// ---- out ------------------------------------------------------------------------------

const mdEsc = (t: string) => t.replace(/([\\`*_[\]#|])/g, '\\$1')
function mdInline(nodes: PMNode[] | undefined): string {
  let s = ''
  for (const n of nodes || []) {
    if (n.type === 'hard_break') { s += '  \n'; continue }
    if (n.type === 'image') { s += `![${n.attrs?.alt || ''}](${String(n.attrs?.src || '').startsWith('data:') ? 'image' : n.attrs?.src})`; continue }
    if (n.type === 'footnote') { s += `^[${n.attrs?.text || ''}]`; continue }
    let t = n.text || ''
    const has = (k: string) => n.marks?.some((m) => m.type === k)
    if (has('code')) t = '`' + t + '`'
    else {
      // Emphasis cannot hug whitespace in Markdown; move the spaces outside the markers.
      const lead = t.match(/^\s*/)![0]
      const trail = t.match(/\s*$/)![0]
      let core = mdEsc(t.trim())
      if (core) {
        if (has('bold')) core = `**${core}**`
        if (has('italic')) core = `*${core}*`
        if (has('strike')) core = `~~${core}~~`
      }
      t = lead + core + trail
    }
    const link = n.marks?.find((m) => m.type === 'link')
    if (link) t = `[${t}](${link.attrs?.href})`
    s += t
  }
  return s
}

export function toMarkdown(doc: PMNode): string {
  const out: string[] = []
  const block = (n: PMNode, indent = ''): string => {
    switch (n.type) {
      case 'heading': return '#'.repeat(Number(n.attrs?.level) || 1) + ' ' + mdInline(n.content)
      case 'paragraph': return indent + mdInline(n.content)
      case 'blockquote': return (n.content || []).map((c) => '> ' + block(c)).join('\n>\n')
      case 'code_block': return '```\n' + plainText(n) + '\n```'
      case 'horizontal_rule': return '---'
      case 'page_break': return '<div style="page-break-after: always"></div>'
      case 'bullet_list': case 'ordered_list': {
        const lines: string[] = []
        let i = Number(n.attrs?.order) || 1
        for (const item of n.content || []) {
          const marker = n.type === 'ordered_list' ? `${i++}.` : '-'
          const box = item.attrs?.checked === true ? '[x] ' : item.attrs?.checked === false ? '[ ] ' : ''
          const [first, ...rest] = item.content || []
          lines.push(`${indent}${marker} ${box}${first ? mdInline(first.content) : ''}`)
          for (const r of rest) lines.push(block(r, indent + '   '))
        }
        return lines.join('\n')
      }
      // Markdown has no box: its paragraphs as a quote, so they stay together and apart.
      case 'text_box': return (n.content || []).map((c) => '> ' + block(c)).join('\n>\n')
      case 'table': {
        const rows = (n.content || []).map((r) => (r.content || []).map((c) => (c.content || []).map((p) => mdInline(p.content)).join(' ').replace(/\|/g, '\\|')))
        if (!rows.length) return ''
        const w = Math.max(...rows.map((r) => r.length))
        const line = (r: string[]) => '| ' + Array.from({ length: w }, (_, i) => r[i] ?? '').join(' | ') + ' |'
        return [line(rows[0]), '|' + ' --- |'.repeat(w), ...rows.slice(1).map(line)].join('\n')
      }
      default: return ''
    }
  }
  for (const n of doc.content || []) out.push(block(n))
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export function toText(doc: PMNode): string {
  const lines: string[] = []
  const walk = (n: PMNode, prefix = '') => {
    if (n.type === 'bullet_list' || n.type === 'ordered_list') {
      let i = Number(n.attrs?.order) || 1
      for (const it of n.content || []) {
        const [first, ...rest] = it.content || []
        lines.push(prefix + (n.type === 'ordered_list' ? `${i++}. ` : '• ') + (first ? plainText(first) : ''))
        for (const r of rest) walk(r, prefix + '   ')
      }
      return
    }
    if (n.type === 'table') { for (const r of n.content || []) lines.push((r.content || []).map((c) => plainText(c, ' ')).join('\t')); return }
    if (n.type === 'blockquote') { for (const c of n.content || []) walk(c, prefix + '> '); return }
    if (n.type === 'page_break') { lines.push('\f'); return }
    if (n.type === 'horizontal_rule') { lines.push('———'); return }
    lines.push(prefix + plainText(n))
  }
  for (const n of doc.content || []) walk(n)
  return lines.join('\n') + '\n'
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** A link is only kept when it is plainly a web, mail or phone link — never javascript: or data:text/html. */
export const safeHref = (h: string) => (/^(https?:|mailto:|tel:|#)/i.test(h.trim()) ? h.trim() : null)

export function htmlInline(nodes: PMNode[] | undefined, notes: string[]): string {
  let s = ''
  for (const n of nodes || []) {
    if (n.type === 'hard_break') { s += '<br>'; continue }
    if (n.type === 'image') {
      const w = (n.attrs?.width ? ` width="${Number(n.attrs.width)}"` : '') + (n.attrs?.float === 'left' || n.attrs?.float === 'right' ? ` style="float:${n.attrs.float}"` : n.attrs?.float === 'center' ? ' style="display:block;margin:0 auto"' : '')
      const src = String(n.attrs?.src || '')
      s += /^(data:image\/|https?:)/.test(src) ? `<img src="${esc(src)}" alt="${esc(String(n.attrs?.alt || ''))}"${w}>` : ''
      continue
    }
    if (n.type === 'footnote') { notes.push(String(n.attrs?.text || '')); s += `<sup class="fn"><a href="#fn${notes.length}" id="fnref${notes.length}">${notes.length}</a></sup>`; continue }
    // A tab is a span tabLayout.ts can size to its stop; elsewhere it is simply a tab.
    let t = esc(n.text || '').replace(/\t/g, '<span class="wd-tab">\t</span>')
    for (const m of n.marks || []) {
      if (m.type === 'bold') t = `<strong>${t}</strong>`
      else if (m.type === 'italic') t = `<em>${t}</em>`
      else if (m.type === 'underline') t = `<u>${t}</u>`
      else if (m.type === 'strike') t = `<s>${t}</s>`
      else if (m.type === 'code') t = `<code>${t}</code>`
      else if (m.type === 'sup') t = `<sup>${t}</sup>`
      else if (m.type === 'sub') t = `<sub>${t}</sub>`
      else if (m.type === 'textStyle') {
        const a = m.attrs || {}
        const st = [a.color && `color:${a.color}`, a.highlight && `background-color:${a.highlight}`, a.font && `font-family:'${String(a.font).replace(/'/g, '')}'`, a.size && `font-size:${a.size}pt`].filter(Boolean).join(';')
        if (st) t = `<span style="${esc(st)}">${t}</span>`
      }
    }
    const link = n.marks?.find((m) => m.type === 'link')
    const href = link ? safeHref(String(link.attrs?.href || '')) : null
    if (href) t = `<a href="${esc(href)}">${t}</a>`
    s += t
  }
  return s
}

function blockAttr(a: Record<string, unknown> | undefined): string {
  const st: string[] = []
  if (a?.align) st.push(`text-align:${a.align === 'left' ? 'start' : a.align === 'right' ? 'end' : a.align}`)
  if (a?.indent) st.push(`margin-inline-start:${+(Number(a.indent) * 36).toFixed(2)}pt`)
  if (a?.lineHeight) st.push(`line-height:${a.lineHeight}`)
  if (a?.spaceBefore != null) st.push(`margin-top:${a.spaceBefore}pt`)
  if (a?.spaceAfter != null) st.push(`margin-bottom:${a.spaceAfter}pt`)
  if (a?.firstLine) st.push(`text-indent:${a.firstLine}pt`)
  st.push(...borderCss(a?.borders as Borders | null | undefined))
  const tabs = a?.tabs as unknown[] | null | undefined
  return ` dir="${a?.dir || 'auto'}"${tabs?.length ? ` data-tabs="${esc(JSON.stringify(tabs))}"` : ''}${st.length ? ` style="${st.join(';')}"` : ''}`
}

export function htmlBody(doc: PMNode, notes: string[] = []): string {
  const block = (n: PMNode): string => {
    switch (n.type) {
      case 'paragraph': return `<p${blockAttr(n.attrs)}>${htmlInline(n.content, notes) || '<br>'}</p>`
      case 'heading': { const l = Math.min(6, Number(n.attrs?.level) || 1); return `<h${l}${blockAttr(n.attrs)}>${htmlInline(n.content, notes)}</h${l}>` }
      case 'blockquote': return `<blockquote>${(n.content || []).map(block).join('')}</blockquote>`
      case 'code_block': return `<pre dir="ltr"><code>${esc(plainText(n))}</code></pre>`
      case 'horizontal_rule': return '<hr>'
      case 'page_break': return '<div class="page-break"></div>'
      case 'bullet_list': return `<ul${n.attrs?.checklist ? ' class="checklist"' : ''}>${(n.content || []).map(block).join('')}</ul>`
      case 'ordered_list': return `<ol${Number(n.attrs?.order) !== 1 && n.attrs?.order ? ` start="${Number(n.attrs.order)}"` : ''} style="list-style-type:${esc(String(n.attrs?.kind || 'decimal'))}">${(n.content || []).map(block).join('')}</ol>`
      case 'list_item': return `<li${n.attrs?.checked != null ? ` data-checked="${n.attrs.checked}"` : ''}>${n.attrs?.checked != null ? (n.attrs.checked ? '☑ ' : '☐ ') : ''}${(n.content || []).map((c, i) => (i === 0 && c.type === 'paragraph' ? htmlInline(c.content, notes) : block(c))).join('')}</li>`
      case 'text_box': {
        const f = n.attrs?.float
        const st = [n.attrs?.width ? `width:${Number(n.attrs.width)}px` : '', f === 'left' || f === 'right' ? `float:${f}` : f === 'center' ? 'margin:0 auto' : '', /^#[0-9a-f]{3,8}$/i.test(String(n.attrs?.fill || '')) ? `background:${n.attrs!.fill}` : '', n.attrs?.border === false ? '' : 'border:1px solid #7a8a81', 'padding:4pt 6pt'].filter(Boolean).join(';')
        return `<aside style="${st}">${(n.content || []).map(block).join('')}</aside>`
      }
      case 'table': return `<table${n.attrs?.grid === false ? ' class="nogrid"' : ''}>${(n.content || []).map(block).join('')}</table>`
      case 'table_row': return `<tr>${(n.content || []).map(block).join('')}</tr>`
      case 'table_cell': case 'table_header': {
        const tag = n.type === 'table_header' ? 'th' : 'td'
        const a = n.attrs || {}
        const span = `${Number(a.colspan) > 1 ? ` colspan="${a.colspan}"` : ''}${Number(a.rowspan) > 1 ? ` rowspan="${a.rowspan}"` : ''}`
        const st = [a.background && `background-color:${a.background}`, a.valign && `vertical-align:${a.valign}`].filter(Boolean).join(';')
        return `<${tag}${span}${st ? ` style="${esc(st)}"` : ''}>${(n.content || []).map(block).join('')}</${tag}>`
      }
      default: return ''
    }
  }
  return (doc.content || []).map(block).join('\n')
}

export const DOC_CSS = `body{font-family:"IBM Plex Sans Arabic",Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#1b1b1b;max-width:46em;margin:2em auto;padding:0 1em}
h1{font-size:20pt}h2{font-size:16pt}h3{font-size:14pt}h1,h2,h3,h4{color:#0b4f3a;line-height:1.25}
table{border-collapse:collapse;margin:1em 0}td,th{border:1px solid #999;padding:4px 8px;vertical-align:top}th{background:#f2f2ee}table.nogrid td,table.nogrid th{border:0;background:none}
blockquote{border-inline-start:3px solid #0b6e4f;margin-inline:0;padding-inline-start:1em;color:#444}
pre{background:#f3f3f0;padding:.6em .8em;overflow:auto}img{max-width:100%;height:auto}
.page-break{page-break-after:always;break-after:page}ul.checklist{list-style:none;padding-inline-start:1em}
.fn a{text-decoration:none}.footnotes{font-size:9pt;border-top:1px solid #ccc;margin-top:2em}
@media print{body{max-width:none;margin:0;padding:0}}`

export function toHtml(data: WordData, title: string): string {
  const notes: string[] = []
  const body = htmlBody(data.doc, notes)
  const fn = notes.length ? `<ol class="footnotes">${notes.map((t, i) => `<li id="fn${i + 1}">${esc(t)} <a href="#fnref${i + 1}">↩</a></li>`).join('')}</ol>` : ''
  return `<!doctype html>\n<html lang="${esc(data.lang || (data.rtl ? 'ar' : 'en'))}" dir="${data.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${DOC_CSS}</style></head><body>\n${body}\n${fn}</body></html>\n`
}
