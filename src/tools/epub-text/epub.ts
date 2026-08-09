import { readEntry, zipEntries } from '../../lib/unzip'
import { parseClean, elementToMd } from '../../lib/htmlToMd'

// Getting the text out of an EPUB.
//
// An EPUB is a zip of XHTML plus a manifest, so `lib/unzip.ts` does the opening
// and this does the rest. Four things a naive reader gets wrong, all of which
// produce a file that looks plausible and is missing or scrambling content:
//
// 1. **The manifest is not at a fixed path.** `OEBPS/content.opf` is a
//    convention, not a rule; META-INF/container.xml is the only thing whose
//    location the spec fixes, and it names the real one.
// 2. **Hrefs are relative to the OPF, not to the zip root.** Assume the root and
//    a book whose OPF sits in a subfolder yields nothing at all.
// 3. **Reading order comes from the spine**, not from the manifest and not from
//    the alphabetical order of the files. Chapter 10 sorts before chapter 2.
// 4. **Stripping tags with a regex glues words together.** A block element is a
//    line break; without that, "end of paragraph" runs into "Start of the next"
//    and the text is subtly wrong everywhere.
// 5. **Markdown is not text with hashes in front of it.** This tool has offered
//    a Markdown export since it shipped, and produced `xhtmlToText` output with
//    `## <chapter title>` bolted on — so every heading, list, link, blockquote
//    and bold run in the book was flattened to prose BEFORE the "Markdown" was
//    made. Its own spec asserted only that the headings were there, which is the
//    one thing the flattened output still had. Chapters now carry a real `md`,
//    converted from the chapter's own XHTML by `lib/htmlToMd.ts`.

export interface Meta {
  title: string
  authors: string[]
  language: string
  publisher: string
  identifier: string
  date: string
}

export interface Chapter { href: string; title: string; text: string; md: string; words: number }

export interface Book {
  meta: Meta
  chapters: Chapter[]
  /** Files in the archive that were not part of the reading order. */
  extras: number
}

const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml')

/** Resolve an href that is relative to the OPF's own directory. */
export function resolveHref(opfPath: string, href: string): string {
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const joined = href.startsWith('/') ? href.slice(1) : base + href
  // Normalise any ../ segments, which real books do use.
  const parts: string[] = []
  for (const seg of joined.split('/')) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return decodeURIComponent(parts.join('/'))
}

const BLOCK = /^(p|div|br|h[1-6]|li|tr|blockquote|section|article|figcaption|td|th|pre)$/i

/** XHTML to readable text, honouring block elements as line breaks. */
export function xhtmlToText(source: string): string {
  const doc = new DOMParser().parseFromString(source, 'application/xhtml+xml')
  const body = doc.querySelector('body') ?? doc.documentElement
  if (!body) return ''
  const out: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === 3) { out.push(node.nodeValue ?? ''); return }
    if (node.nodeType !== 1) return
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style') return
    if (BLOCK.test(tag)) out.push('\n')
    for (const child of Array.from(el.childNodes)) walk(child)
    if (BLOCK.test(tag)) out.push('\n')
  }
  walk(body)
  return out.join('')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * XHTML to Markdown, keeping the structure the text extractor throws away.
 *
 * Parsed as `text/html` rather than `application/xhtml+xml` on purpose: the
 * strict parser rejects a whole chapter over one unescaped ampersand, and real
 * books in the wild have them. A book that renders in a reader must convert.
 *
 * `imgBase` rewrites a picture's src to its path INSIDE the archive, so the
 * reference names a real file in the book rather than a path relative to a
 * chapter folder that no longer exists once the Markdown is somewhere else. The
 * image files themselves are not extracted — this tool returns text — and the
 * UI says so rather than leaving a reader to discover the broken picture.
 */
export function xhtmlToMarkdown(source: string, chapterPath = ''): string {
  const body = parseClean(source)
  for (const img of Array.from(body.querySelectorAll('img'))) {
    const src = img.getAttribute('src')
    if (src && !/^(https?:|data:)/i.test(src)) img.setAttribute('src', resolveHref(chapterPath, src))
  }
  return elementToMd(body)
}

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

export async function readEpub(buf: ArrayBuffer): Promise<Book> {
  const entries = zipEntries(buf)
  if (!entries) throw new Error('not-a-zip')
  const byName = new Map(entries.map((e) => [e.name, e]))
  const text = async (name: string) => {
    const e = byName.get(name)
    if (!e) return ''
    return new TextDecoder().decode(await readEntry(buf, e))
  }

  const container = await text('META-INF/container.xml')
  if (!container) throw new Error('not-epub')
  const opfPath = xml(container).querySelector('rootfile')?.getAttribute('full-path') ?? ''
  if (!opfPath) throw new Error('not-epub')

  const opfSource = await text(opfPath)
  if (!opfSource) throw new Error('not-epub')
  const opf = xml(opfSource)

  // Dublin Core elements are namespaced and usually prefixed (dc:title), so
  // match on localName inside <metadata> rather than on the qualified name —
  // a book that omits the prefix is still valid and would otherwise read blank.
  const metaEl = Array.from(opf.getElementsByTagName('*')).find((e) => e.localName === 'metadata')
  const dc = (tag: string) =>
    Array.from(metaEl?.getElementsByTagName('*') ?? [])
      .filter((e) => e.localName === tag)
      .map((e) => (e.textContent ?? '').trim())
      .filter(Boolean)
  const first = (tag: string) => dc(tag)[0] ?? ''

  const meta: Meta = {
    title: first('title'),
    authors: dc('creator'),
    language: first('language'),
    publisher: first('publisher'),
    identifier: first('identifier'),
    date: first('date'),
  }

  // id -> href, from the manifest.
  const manifest = new Map<string, { href: string; type: string }>()
  for (const item of Array.from(opf.getElementsByTagName('item'))) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) manifest.set(id, { href, type: item.getAttribute('media-type') ?? '' })
  }

  // Reading order comes from the spine.
  const order = Array.from(opf.getElementsByTagName('itemref'))
    .map((r) => r.getAttribute('idref'))
    .filter((x): x is string => !!x)

  const chapters: Chapter[] = []
  for (const id of order) {
    const item = manifest.get(id)
    if (!item || !/xhtml|html/i.test(item.type)) continue
    const path = resolveHref(opfPath, item.href)
    const source = await text(path)
    if (!source) continue
    const body = xhtmlToText(source)
    if (!body) continue
    const doc = new DOMParser().parseFromString(source, 'application/xhtml+xml')
    const heading = doc.querySelector('h1, h2, h3, title')?.textContent?.trim() ?? ''
    chapters.push({
      href: path,
      title: heading || path.split('/').pop() || path,
      text: body,
      md: xhtmlToMarkdown(source, path),
      words: countWords(body),
    })
  }

  if (!chapters.length) throw new Error('no-text')
  return { meta, chapters, extras: entries.length - chapters.length }
}

export const bookToText = (book: Book, withTitles: boolean) =>
  book.chapters.map((c) => (withTitles ? `${c.title}\n\n${c.text}` : c.text)).join('\n\n')

/**
 * A chapter usually opens with its own <h1>, so prepending the title as well
 * printed every chapter heading twice — once as our `##`, again as the book's
 * own `#`. The chapter's own heading wins where it has one, since that is the
 * author's markup; ours is the fallback for a chapter with none.
 */
export const chapterToMarkdown = (c: Chapter) =>
  /^#{1,6} /.test(c.md) ? c.md : `## ${c.title}\n\n${c.md}`

export const bookToMarkdown = (book: Book) =>
  [
    `# ${book.meta.title || 'Untitled'}`,
    book.meta.authors.join(', '),
    '',
    ...book.chapters.map(chapterToMarkdown),
  ].join('\n\n')
