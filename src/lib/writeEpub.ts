import { zipStore } from './zip'
import { inlineText, type Block, type Inline } from './markdown'

// Writing an EPUB.
//
// `lib/unzip.ts` could already READ one and `epub-text` does; this is the other
// direction, and it needed nothing new — `lib/zip.ts` writes store-only
// archives, which is **exactly** what an EPUB requires, and `lib/markdown.ts`
// supplies the structure. The same pairing that made `writeDocx.ts` cheap.
//
// Four things the format demands, each of which produces a file that a reader
// silently refuses rather than explaining:
//
// 1. **`mimetype` must be the FIRST entry and STORED, uncompressed.** That is
//    how a reader identifies the file without inflating anything. `zipStore`
//    stores every entry, so the only requirement here is the ordering.
// 2. **`META-INF/container.xml` is the one path the spec fixes**, and it names
//    where the package document really is. Everything else is convention.
// 3. **Every file in the spine must also be in the manifest**, with an id that
//    matches. A chapter present in one and not the other is a chapter that does
//    not exist.
// 4. **EPUB 3 wants a nav document** with `epub:type="toc"`. Without it the
//    book opens and has no table of contents, which on a phone is the whole
//    navigation gone.

export interface EpubMeta {
  title: string
  author: string
  /** BCP-47. `ar` also flips the page direction — see below. */
  language: string
  identifier?: string
}

export interface Chapter { title: string; blocks: Block[] }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

function inlineHtml(inline: Inline[]): string {
  return inline.map((n) => {
    switch (n.t) {
      case 'strong': return `<strong>${esc(n.v)}</strong>`
      case 'em': return `<em>${esc(n.v)}</em>`
      case 'strike': return `<s>${esc(n.v)}</s>`
      case 'code': return `<code>${esc(n.v)}</code>`
      // A real anchor, unlike the Word writer — XHTML has hyperlinks without
      // needing a relationship part, so nothing has to be written out beside it.
      case 'link': return `<a href="${esc(n.href)}">${esc(n.v)}</a>`
      default: return esc(n.v)
    }
  }).join('')
}

function blocksHtml(blocks: Block[]): string {
  return blocks.map((b) => {
    switch (b.t) {
      case 'heading': return `<h${b.level}>${inlineHtml(b.inline)}</h${b.level}>`
      case 'para': return `<p>${inlineHtml(b.inline)}</p>`
      case 'quote': return `<blockquote><p>${inlineHtml(b.inline)}</p></blockquote>`
      case 'rule': return '<hr/>'
      case 'code': return `<pre><code>${esc(b.text)}</code></pre>`
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul'
        return `<${tag}>${b.items.map((i) => `<li>${inlineHtml(i.inline)}</li>`).join('')}</${tag}>`
      }
      case 'table': {
        const row = (cells: Inline[][], head: boolean) =>
          `<tr>${cells.map((c) => `<t${head ? 'h' : 'd'}>${inlineHtml(c)}</t${head ? 'h' : 'd'}>`).join('')}</tr>`
        const [head, ...rest] = b.rows
        return `<table><thead>${row(head ?? [], true)}</thead><tbody>${rest.map((r) => row(r, false)).join('')}</tbody></table>`
      }
    }
  }).join('\n')
}

/**
 * Split a document into chapters at its top heading level.
 *
 * A book is chapters, and Markdown does not say where they are — so the split
 * is at the SHALLOWEST heading the document actually uses, not at a fixed `#`.
 * A document written entirely in `##` still becomes a book with chapters,
 * where a rule that only looked for `#` would produce one enormous chapter and
 * an empty table of contents.
 */
export function splitChapters(blocks: Block[], fallbackTitle: string): Chapter[] {
  const levels = blocks.filter((b) => b.t === 'heading').map((b) => b.level)
  if (!levels.length) return [{ title: fallbackTitle, blocks }]
  const top = Math.min(...levels)
  const out: Chapter[] = []
  let current: Chapter | null = null
  for (const b of blocks) {
    if (b.t === 'heading' && b.level === top) {
      current = { title: inlineText(b.inline) || fallbackTitle, blocks: [b] }
      out.push(current)
      continue
    }
    // Anything before the first heading is a preamble and keeps its place
    // rather than being dropped — losing content silently is the failure that
    // matters in a converter.
    if (!current) { current = { title: fallbackTitle, blocks: [] }; out.push(current) }
    current.blocks.push(b)
  }
  return out
}

const CSS = `body{font-family:serif;line-height:1.6;margin:1em}
h1,h2,h3{line-height:1.25}
code,pre{font-family:monospace}
pre{white-space:pre-wrap;background:#f4f4f4;padding:.6em;border-radius:4px}
blockquote{margin:1em 0;padding-inline-start:1em;border-inline-start:3px solid #ccc;color:#444}
table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.3em .5em}`

const xhtml = (title: string, lang: string, dir: string, body: string) =>
  `<?xml version="1.0" encoding="utf-8"?>\n`
  + `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${esc(lang)}" xml:lang="${esc(lang)}" dir="${dir}">`
  + `<head><title>${esc(title)}</title><meta charset="utf-8"/>`
  + `<link rel="stylesheet" type="text/css" href="style.css"/></head>`
  + `<body>${body}</body></html>`

export function buildEpub(meta: EpubMeta, chapters: Chapter[]): Blob {
  const enc = new TextEncoder()
  const lang = meta.language || 'en'
  // RTL is set on the package AND on every page. Setting only one of them gives
  // a book whose text runs the right way and whose pages turn the wrong way,
  // which is the half-done Arabic support every generator ships.
  const rtl = /^(ar|he|fa|ur)\b/i.test(lang)
  const dir = rtl ? 'rtl' : 'ltr'
  const id = meta.identifier || `urn:uuid:${crypto.randomUUID()}`

  const files = chapters.map((c, i) => ({
    name: `ch${i + 1}.xhtml`,
    xml: xhtml(c.title, lang, dir, blocksHtml(c.blocks)),
  }))

  const manifest = files
    .map((f, i) => `<item id="ch${i + 1}" href="${f.name}" media-type="application/xhtml+xml"/>`)
    .join('')
  const spine = files.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join('')

  const nav = xhtml(meta.title, lang, dir,
    `<nav epub:type="toc" id="toc"><h1>${esc(meta.title)}</h1><ol>`
    + chapters.map((c, i) => `<li><a href="ch${i + 1}.xhtml">${esc(c.title)}</a></li>`).join('')
    + `</ol></nav>`)

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${esc(lang)}"${rtl ? ' dir="rtl"' : ''}>
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="pub-id">${esc(id)}</dc:identifier>
<dc:title>${esc(meta.title)}</dc:title>
<dc:language>${esc(lang)}</dc:language>
${meta.author ? `<dc:creator>${esc(meta.author)}</dc:creator>` : ''}
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
</metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="style.css" media-type="text/css"/>${manifest}</manifest>
<spine${rtl ? ' page-progression-direction="rtl"' : ''}>${spine}</spine>
</package>`

  const container = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`

  return zipStore([
    // FIRST, and stored. Both are load-bearing.
    { name: 'mimetype', bytes: enc.encode('application/epub+zip') },
    { name: 'META-INF/container.xml', bytes: enc.encode(container) },
    { name: 'OEBPS/content.opf', bytes: enc.encode(opf) },
    { name: 'OEBPS/nav.xhtml', bytes: enc.encode(nav) },
    { name: 'OEBPS/style.css', bytes: enc.encode(CSS) },
    ...files.map((f) => ({ name: `OEBPS/${f.name}`, bytes: enc.encode(f.xml) })),
  ])
}
