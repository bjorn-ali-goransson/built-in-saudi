// Markdown → a small block tree.
//
// The site had `htmlToMd.ts` and nothing going the other way, which is why
// three obvious tools were unbuildable: Markdown to Word, Markdown to EPUB and
// Markdown to PDF all need the same thing — the STRUCTURE of the document, not
// a string of HTML. So this returns blocks rather than markup, and each writer
// renders them into its own format. Emitting HTML and then parsing it back
// would work and is the usual shortcut; it also means every writer inherits
// whatever the HTML step guessed.
//
// Deliberately lean, in the same spirit as `htmlToMd.ts`: it handles what
// people actually write, and anything it does not recognise stays as text
// rather than being dropped. **Dropping is the failure that matters** — a
// converter that silently loses a line is worse than one that passes it
// through unstyled.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; v: string }
  | { t: 'em'; v: string }
  | { t: 'code'; v: string }
  | { t: 'strike'; v: string }
  | { t: 'link'; v: string; href: string }

export type Block =
  | { t: 'heading'; level: number; inline: Inline[] }
  | { t: 'para'; inline: Inline[] }
  | { t: 'list'; ordered: boolean; items: { inline: Inline[]; depth: number }[] }
  | { t: 'quote'; inline: Inline[] }
  | { t: 'code'; lang: string; text: string }
  | { t: 'rule' }
  | { t: 'table'; rows: Inline[][][] }

// Inline parsing is one pass with an alternation rather than nested regexes,
// so `**bold** and *italic*` cannot have the emphasis rule eat the strong one's
// asterisks. Order matters inside the alternation: `**` must be tried before
// `*`, and a link before anything that could match inside its label.
const INLINE = /(!?\[([^\]]*)\]\(([^)\s]+)[^)]*\))|(\*\*|__)(.+?)\4|(\*|_)(.+?)\6|(~~)(.+?)\8|(`+)([^`]+?)\10/

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let rest = src
  while (rest) {
    const m = INLINE.exec(rest)
    if (!m || m.index === undefined) break
    if (m.index > 0) out.push({ t: 'text', v: rest.slice(0, m.index) })
    if (m[1] !== undefined) out.push({ t: 'link', v: m[2] || m[3], href: m[3] })
    else if (m[5] !== undefined) out.push({ t: 'strong', v: m[5] })
    else if (m[7] !== undefined) out.push({ t: 'em', v: m[7] })
    else if (m[9] !== undefined) out.push({ t: 'strike', v: m[9] })
    else if (m[11] !== undefined) out.push({ t: 'code', v: m[11] })
    rest = rest.slice(m.index + m[0].length)
  }
  if (rest) out.push({ t: 'text', v: rest })
  return out.length ? out : [{ t: 'text', v: '' }]
}

const isRule = (l: string) => /^\s{0,3}([-*_])\s*(\1\s*){2,}$/.test(l)
const rowCells = (l: string) =>
  l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'))

export function parseMarkdown(src: string): Block[] {
  // Normalise line endings first: a .md file written on Windows arrives with
  // CRLF, and a stray \r at the end of every line turns "```" into "```\r",
  // which no fence test matches.
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    // Fenced code. The closing fence must be at least as long as the opening
    // one, so a block containing ``` can be fenced with ````.
    const fence = /^\s{0,3}(`{3,}|~{3,})\s*([^\s`]*)/.exec(line)
    if (fence) {
      const mark = fence[1][0]
      const len = fence[1].length
      const body: string[] = []
      i++
      while (i < lines.length && !new RegExp(`^\\s{0,3}${mark === '`' ? '`' : '~'}{${len},}\\s*$`).test(lines[i])) {
        body.push(lines[i]); i++
      }
      i++ // the closing fence, or the end of input
      out.push({ t: 'code', lang: fence[2] || '', text: body.join('\n') })
      continue
    }

    if (isRule(line)) { out.push({ t: 'rule' }); i++; continue }

    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (h) { out.push({ t: 'heading', level: h[1].length, inline: parseInline(h[2]) }); i++; continue }

    // Setext heading: a line of === or --- UNDER text. Checked after the
    // thematic-break test, since `---` is both, and before the paragraph rule
    // so the underline never becomes a paragraph of its own.
    if (i + 1 < lines.length && /^\s{0,3}(=+|-+)\s*$/.test(lines[i + 1]) && line.trim() && !isRule(lines[i + 1])) {
      out.push({ t: 'heading', level: lines[i + 1].trim()[0] === '=' ? 1 : 2, inline: parseInline(line.trim()) })
      i += 2
      continue
    }

    // A table needs its separator row; without one these are just paragraphs.
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]*-[-\s:|]*\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const rows: Inline[][][] = [rowCells(line).map(parseInline)]
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(rowCells(lines[i]).map(parseInline)); i++
      }
      out.push({ t: 'table', rows })
      continue
    }

    const bullet = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (bullet) {
      const ordered = /\d/.test(bullet[2])
      const items: { inline: Inline[]; depth: number }[] = []
      while (i < lines.length) {
        const b = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
        if (!b || isRule(lines[i])) break
        // A list stops at a change of KIND, so an ordered list following a
        // bulleted one is two lists rather than one with mixed markers.
        if (/\d/.test(b[2]) !== ordered) break
        items.push({ inline: parseInline(b[3]), depth: Math.floor(b[1].length / 2) })
        i++
      }
      out.push({ t: 'list', ordered, items })
      continue
    }

    if (/^\s{0,3}>\s?/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^\s{0,3}>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s{0,3}>\s?/, '')); i++
      }
      out.push({ t: 'quote', inline: parseInline(body.join(' ')) })
      continue
    }

    // A paragraph runs to the next blank line or the start of another block —
    // that last part is what stops a heading immediately after a line of prose
    // from being swallowed into it, which is how most naive parsers lose one.
    const body: string[] = [line.trim()]
    i++
    while (i < lines.length && lines[i].trim()
      && !/^\s{0,3}#{1,6}\s/.test(lines[i])
      && !/^\s{0,3}(`{3,}|~{3,})/.test(lines[i])
      && !/^\s{0,3}>\s?/.test(lines[i])
      && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i])
      && !isRule(lines[i])
      && !/^\s{0,3}(=+|-+)\s*$/.test(lines[i])) {
      body.push(lines[i].trim()); i++
    }
    out.push({ t: 'para', inline: parseInline(body.join(' ')) })
  }

  return out
}

/** Plain text of a run of inlines — for a title, a filename, an alt attribute. */
export const inlineText = (inline: Inline[]): string => inline.map((n) => n.v).join('')
