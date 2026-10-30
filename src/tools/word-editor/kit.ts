// How the document editor reads and writes files. Word, OpenDocument, Markdown
// and text convert in the shared office worker; HTML is the one format parsed on
// the main thread, because parsing HTML needs a DOM and a worker has none.
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { office } from '../../lib/office/officeClient'
import type { EditorKit } from '../../components/office/hooks'
import { emptyDoc, plainText, isRtlText, type WordData, type PMNode } from './model'
import { schema } from './schema'
import { safeHref } from './io/text-formats'
import { lossText, WD_STR } from './strings'

type Loss = { what: string; count: number }
const extOf = (n: string) => (n.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase()

export function wordKit(locale: 'en' | 'ar'): EditorKit<WordData> {
  const s = WD_STR[locale]
  const L = (l: Loss[]) => l.map((x) => lossText(x, locale))
  return {
    kind: 'word',
    tool: 'word-editor',
    formats: [
      { ext: '.docx', label: s.docx },
      { ext: '.md', label: s.markdown },
      { ext: '.html', label: s.html },
      { ext: '.txt', label: s.text },
    ],
    accepts: ['.docx', '.docm', '.dotx', '.odt', '.md', '.markdown', '.txt', '.html', '.htm'],
    blank: () => emptyDoc(locale === 'ar'),
    async exportAs(data, ext, title) {
      if (ext === '.md') {
        const text = await office<string>('md-write', { data })
        return { blob: new Blob([text], { type: 'text/markdown;charset=utf-8' }), loss: L(mdLoss(data)) }
      }
      if (ext === '.txt') {
        const text = await office<string>('txt-write', { data })
        return { blob: new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }), loss: L([{ what: 'all formatting, pictures and tables (plain text)', count: 1 }]) }
      }
      if (ext === '.html') {
        const html = await office<string>('html-write', { data, opts: { title } })
        return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), loss: [] }
      }
      const r = await office<{ blob: Blob; loss: Loss[] }>('docx-write', { data, opts: { title } })
      return { blob: r.blob, loss: L(r.loss) }
    },
    async importFile(file) {
      const ext = extOf(file.name)
      if (ext === '.html' || ext === '.htm') {
        const r = fromHtml(await file.text(), locale === 'ar')
        return { data: r.data, loss: L(r.loss), title: r.title }
      }
      const buf = await file.arrayBuffer()
      const op = ext === '.odt' ? 'odt-read' : ext === '.md' || ext === '.markdown' ? 'md-read' : ext === '.txt' ? 'txt-read' : 'docx-read'
      const r = await office<{ data: WordData; loss: Loss[]; title: string }>(op, { buf })
      return { data: r.data, loss: L(r.loss), title: r.title || undefined }
    },
    thumb: (data) => thumbnail(data),
    async renderThumb(data) {
      const [{ printable }, { pageThumbnail }] = await Promise.all([import('./printable'), import('../../components/office/print')])
      return pageThumbnail(await printable(data, 'document'))
    },
  }
}

/** What a Markdown file cannot carry from this document. */
function mdLoss(data: WordData): Loss[] {
  let fancy = 0
  const walk = (n: PMNode) => {
    const a = n.attrs || {}
    if (a.align || a.indent || a.lineHeight || (a.dir && a.dir !== 'auto')) fancy++
    for (const m of n.marks || []) if (m.type === 'textStyle' || m.type === 'underline' || m.type === 'sup' || m.type === 'sub') fancy++
    n.content?.forEach(walk)
  }
  walk(data.doc)
  const out: Loss[] = []
  if (fancy) out.push({ what: 'formatting (Markdown carries headings, lists, links, tables and emphasis only)', count: 1 })
  if (data.header || data.footer) out.push({ what: 'page setup, header and footer', count: 1 })
  return out
}

/**
 * HTML → document, with the browser's parser and the editor's schema, which keeps
 * only what the editor understands. Two things are refused on the way in: a
 * `javascript:` link, and a picture that would be fetched from the web — opening a
 * saved page must not make this tool call out to wherever its images live.
 */
export function fromHtml(html: string, rtl: boolean): { data: WordData; loss: Loss[]; title: string } {
  const dom = new DOMParser().parseFromString(html, 'text/html')
  const loss: Loss[] = []
  let remote = 0
  dom.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || ''
    if (!/^data:image\//i.test(src)) { remote++; img.remove() }
  })
  if (remote) loss.push({ what: 'pictures linked from the web (not embedded)', count: remote })
  dom.querySelectorAll('a[href]').forEach((a) => { const h = safeHref(a.getAttribute('href') || ''); if (h) a.setAttribute('href', h); else a.removeAttribute('href') })
  dom.querySelectorAll('script,style,noscript,template,iframe,object,embed').forEach((n) => n.remove())
  const title = dom.querySelector('title')?.textContent?.trim() || ''
  const node = PMDOMParser.fromSchema(schema).parse(dom.body)
  const doc = node.toJSON() as PMNode
  const text = plainText(doc)
  const isRtl = dom.documentElement.getAttribute('dir') === 'rtl' || dom.body.getAttribute('dir') === 'rtl' || (text.trim() ? isRtlText(text) : rtl)
  const base = emptyDoc(isRtl)
  return { data: { ...base, doc: doc.content?.length ? doc : base.doc }, loss, title }
}

/** A tiny page with the first lines on it, for the library. */
export function thumbnail(data: WordData): string | undefined {
  const W = 180
  const H = 240
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rtl = !!data.rtl
  let y = 26
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/>`
  const line = (text: string, size: number, bold: boolean) => {
    if (y > H - 10 || !text.trim()) return
    const r = isRtlText(text) || (rtl && !/[A-Za-z]/.test(text[0] || ''))
    svg += `<text x="${r ? W - 16 : 16}" y="${y}" font-size="${size}" font-family="sans-serif" fill="#222" text-anchor="${r ? 'end' : 'start'}"${r ? ' direction="rtl"' : ''}${bold ? ' font-weight="700"' : ''}>${esc(text.slice(0, Math.floor(260 / size)))}</text>`
    y += size + 5
  }
  for (const b of data.doc.content || []) {
    if (y > H - 10) break
    if (b.type === 'heading') line(plainText(b), Math.max(9, 16 - 2 * ((b.attrs?.level as number) || 1)), true)
    else if (b.type === 'table') { svg += `<rect x="16" y="${y - 8}" width="${W - 32}" height="28" fill="none" stroke="#bbb"/><line x1="16" x2="${W - 16}" y1="${y + 6}" y2="${y + 6}" stroke="#bbb"/>`; y += 36 }
    else { const t = plainText(b, ' '); for (let i = 0; i < t.length && i < 140; i += 34) line(t.slice(i, i + 34), 7, false) }
  }
  svg += '</svg>'
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
