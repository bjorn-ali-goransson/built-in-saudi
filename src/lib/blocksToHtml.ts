// Blocks → HTML.
//
// Found by a code sweep: `lib/markdown.ts` parses to `Block[]` and there were
// renderers for **.docx and .epub and none for HTML** — while `htmlToMd.ts` has
// gone the other way since long before either. The parser's most obvious output
// was the one it did not have.
//
// It also completes an inverse pair. `paste-to-markdown` turns HTML into
// Markdown; this turns Markdown into HTML, and round-tripping through the other
// is the strongest test either has — which is exactly how building
// `docx-markdown` found two real defects in the .docx writer shipped two days
// before it.
//
// **RAW HTML DOES NOT PASS THROUGH, and that is worth stating rather than
// discovering.** `parseMarkdown` has no HTML node, so `<script>alert(1)</script>`
// in the source is TEXT, and text is escaped here — it comes out visible on the
// page instead of running. Most converters pass raw HTML straight through,
// which is fine in a trusted editor and an injection vector the moment the
// Markdown came from somebody else. This is a limitation of the parser that
// happens to be the safe default; a tool that needs passthrough is a different
// tool, and the UI says so rather than leaving it to be found.

import { inlineText, type Block, type Inline } from './markdown'

/** Escape for element content. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Escape for an attribute value, where quotes are structural too. */
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

/**
 * A URL safe to put in `href`.
 *
 * `javascript:` and `data:text/html` in a link are the other half of the same
 * injection: escaping the TEXT of a document and then writing whatever it said
 * into an href has escaped nothing. Anything not plainly http(s), mailto, tel
 * or a relative path is dropped to `#`, and the label is kept — losing the
 * label as well would lose content the document had.
 */
export function safeHref(href: string): string {
  const t = href.trim()
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t
  // Relative, anchor or protocol-relative-to-same-scheme are all fine.
  if (/^[^a-z]/i.test(t) || /^[a-z0-9._~-]+[/?#]/i.test(t)) return t
  return '#'
}

function inlineHtml(parts: Inline[]): string {
  return parts.map((p) => {
    switch (p.t) {
      case 'strong': return `<strong>${esc(p.v)}</strong>`
      case 'em': return `<em>${esc(p.v)}</em>`
      case 'code': return `<code>${esc(p.v)}</code>`
      case 'strike': return `<del>${esc(p.v)}</del>`
      case 'link': return `<a href="${escAttr(safeHref(p.href))}">${esc(p.v)}</a>`
      default: return esc(p.v)
    }
  }).join('')
}

/**
 * A heading's id, for the anchor links a long document needs.
 *
 * Deliberately derived from the TEXT rather than counted, so the same heading
 * keeps the same anchor when a section is added above it — a counted id
 * silently breaks every link into the document.
 */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'section'
}

export interface HtmlOptions {
  /** Give each heading an id, so a long document can be linked into. */
  anchors?: boolean
}

/** The document body, with no wrapper — what a CMS or a template wants. */
export function blocksToHtml(blocks: Block[], opts: HtmlOptions = {}): string {
  const seen = new Map<string, number>()
  const out: string[] = []

  for (const b of blocks) {
    switch (b.t) {
      case 'heading': {
        const level = Math.min(6, Math.max(1, b.level))
        let id = ''
        if (opts.anchors) {
          const base = headingId(inlineText(b.inline))
          const n = (seen.get(base) ?? 0) + 1
          seen.set(base, n)
          // Two sections really can share a title; a duplicate id makes the
          // second one unlinkable and is invalid HTML besides.
          id = ` id="${escAttr(n === 1 ? base : `${base}-${n}`)}"`
        }
        out.push(`<h${level}${id}>${inlineHtml(b.inline)}</h${level}>`)
        break
      }
      case 'para':
        out.push(`<p>${inlineHtml(b.inline)}</p>`)
        break
      case 'quote':
        out.push(`<blockquote><p>${inlineHtml(b.inline)}</p></blockquote>`)
        break
      case 'code':
        // The language goes on the <code>, which is what every highlighter
        // reads; putting it on the <pre> is the common mistake.
        out.push(
          `<pre><code${b.lang ? ` class="language-${escAttr(b.lang)}"` : ''}>`
          + `${esc(b.text)}</code></pre>`,
        )
        break
      case 'rule':
        out.push('<hr>')
        break
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul'
        const items = b.items.map((i) => `<li>${inlineHtml(i.inline)}</li>`).join('')
        out.push(`<${tag}>${items}</${tag}>`)
        break
      }
      case 'table': {
        const [head, ...body] = b.rows
        const th = head ? `<thead><tr>${head.map((c) => `<th>${inlineHtml(c)}</th>`).join('')}</tr></thead>` : ''
        const tb = body.length
          ? `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
          : ''
        out.push(`<table>${th}${tb}</table>`)
        break
      }
    }
  }
  return out.join('\n')
}

export interface DocOptions extends HtmlOptions {
  title?: string
  /** 'ar' sets BOTH `lang` and `dir`, which is the half most generators skip. */
  lang?: string
  rtl?: boolean
  /** Inline a small stylesheet, so the file is readable opened from disk. */
  styles?: boolean
}

const CSS = `:root{color-scheme:light dark}
body{margin:0 auto;padding:2rem 1.25rem;max-width:44rem;line-height:1.65;
font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
h1,h2,h3,h4{line-height:1.25;margin:2rem 0 .6rem}
pre{overflow-x:auto;padding:.9rem;border-radius:6px;background:#f4f4f5}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em}
pre code{background:none;padding:0}
blockquote{margin:1rem 0;padding:.2rem 1rem;border-inline-start:3px solid #ccc;color:#555}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:.45rem .6rem;text-align:start}
img{max-width:100%;height:auto}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}
pre{background:#1c1c1e}blockquote{border-color:#444;color:#aaa}th,td{border-color:#333}}`

/**
 * A standalone file somebody can open.
 *
 * **`dir` and `lang` are set together, and that is the half most generators
 * skip** — the same mistake `writeEpub` documents for
 * `page-progression-direction`. `lang` alone gives a document that hyphenates
 * and reads to a screen reader correctly and runs the text the wrong way;
 * `dir` alone gives the reverse.
 */
export function htmlDocument(body: string, opts: DocOptions = {}): string {
  const lang = opts.lang || 'en'
  const dir = opts.rtl ? 'rtl' : 'ltr'
  const title = opts.title?.trim() || 'Document'
  return `<!doctype html>
<html lang="${escAttr(lang)}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${opts.styles ? `\n<style>${CSS}</style>` : ''}
</head>
<body>
${body}
</body>
</html>
`
}
