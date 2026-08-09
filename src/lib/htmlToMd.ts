// A compact, dependency-free HTML → Markdown converter. It walks the DOM and
// emits GitHub-flavoured Markdown. Deliberately lean — it handles the elements
// that actually show up on a clipboard, and passes unknown wrappers through to
// their children.
//
// It lives in `lib/` rather than in `paste-to-markdown/` because it has a SECOND
// caller: an EPUB chapter is XHTML, so "EPUB to Markdown" is this converter and
// nothing else. That claim was on the epub tool's tagline for a long time while
// it shipped `xhtmlToText` output with `##` bolted on top — which flattens every
// heading, list, link and bold run in the book before the "Markdown" is made.

type Ctx = { indent: string }

// Strip anything scriptable so a pasted fragment is safe to re-render as a preview.
export function parseClean(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, meta, link, title, noscript').forEach((n) => n.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const n = attr.name.toLowerCase()
      if (n.startsWith('on')) el.removeAttribute(attr.name)
      if ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name)
    }
  })
  return doc.body
}

const collapse = (s: string) => s.replace(/\s+/g, ' ')

function children(node: Node, ctx: Ctx): string {
  return Array.from(node.childNodes).map((n) => nodeMd(n, ctx)).join('')
}

function listMd(list: HTMLElement, ctx: Ctx, ordered: boolean): string {
  const items = Array.from(list.children).filter((c) => c.tagName === 'LI') as HTMLElement[]
  return items
    .map((li, i) => {
      const marker = ordered ? `${i + 1}.` : '-'
      let inlinePart = ''
      let nestedPart = ''
      for (const ch of Array.from(li.childNodes)) {
        if (ch.nodeType === 1 && ((ch as HTMLElement).tagName === 'UL' || (ch as HTMLElement).tagName === 'OL')) {
          nestedPart += '\n' + listMd(ch as HTMLElement, { indent: ctx.indent + '  ' }, (ch as HTMLElement).tagName === 'OL')
        } else {
          inlinePart += nodeMd(ch, ctx)
        }
      }
      const text = collapse(inlinePart).trim()
      return ctx.indent + marker + ' ' + text + nestedPart
    })
    .join('\n')
}

function tableMd(table: HTMLElement, ctx: Ctx): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (!rows.length) return ''
  const cells = rows.map((r) =>
    Array.from(r.children).map((c) => collapse(children(c, ctx)).trim().replace(/\|/g, '\\|')),
  )
  const width = Math.max(...cells.map((r) => r.length))
  const pad = (r: string[]) => { const a = r.slice(); while (a.length < width) a.push(''); return a }
  const line = (a: string[]) => '| ' + pad(a).join(' | ') + ' |'
  const head = cells[0]
  const sep = pad(head).map(() => '---')
  return '\n\n' + [line(head), line(sep), ...cells.slice(1).map(line)].join('\n') + '\n\n'
}

function nodeMd(node: Node, ctx: Ctx): string {
  if (node.nodeType === 3) return collapse(node.textContent || '') // text
  if (node.nodeType !== 1) return ''
  const el = node as HTMLElement
  const kids = () => children(el, ctx).trim()
  switch (el.tagName) {
    case 'BR': return '  \n'
    case 'HR': return '\n\n---\n\n'
    case 'STRONG': case 'B': { const t = kids(); return t ? `**${t}**` : '' }
    case 'EM': case 'I': { const t = kids(); return t ? `*${t}*` : '' }
    case 'DEL': case 'S': case 'STRIKE': { const t = kids(); return t ? `~~${t}~~` : '' }
    case 'CODE':
      if (el.closest('pre')) return el.textContent || ''
      { const t = el.textContent || ''; return t ? '`' + t + '`' : '' }
    case 'PRE': { const t = (el.textContent || '').replace(/\n+$/, ''); return `\n\n\`\`\`\n${t}\n\`\`\`\n\n` }
    case 'A': { const t = kids() || el.getAttribute('href') || ''; const href = el.getAttribute('href') || ''; return href ? `[${t}](${href})` : t }
    case 'IMG': { const src = el.getAttribute('src') || ''; const alt = el.getAttribute('alt') || ''; return src ? `![${alt}](${src})` : '' }
    case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': {
      const t = kids(); return t ? `\n\n${'#'.repeat(+el.tagName[1])} ${t}\n\n` : ''
    }
    case 'BLOCKQUOTE': { const t = kids(); return t ? '\n\n' + t.split('\n').map((l) => '> ' + l).join('\n') + '\n\n' : '' }
    case 'UL': case 'OL': return '\n' + listMd(el, ctx, el.tagName === 'OL') + '\n'
    case 'TABLE': return tableMd(el, ctx)
    case 'P': case 'DIV': case 'SECTION': case 'ARTICLE': case 'HEADER': case 'FOOTER': case 'MAIN': case 'ASIDE': case 'FIGURE': case 'FIGCAPTION': {
      const t = kids(); return t ? `\n\n${t}\n\n` : ''
    }
    default: return children(el, ctx) // span, font, b/i already handled, unknown wrappers → passthrough
  }
}

export function elementToMd(el: HTMLElement): string {
  return children(el, { indent: '' })
    .replace(/[ \t]+$/gm, (m) => (m === '  ' ? m : '')) // keep hard-break "  " but trim other trailing space
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function htmlToMd(html: string): { md: string; safeHtml: string } {
  const body = parseClean(html)
  return { md: elementToMd(body), safeHtml: body.innerHTML }
}
