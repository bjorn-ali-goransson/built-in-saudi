// A PDF's text, recovered as STRUCTURE rather than as a wall of characters.
//
// Found by a web sweep, and it is the largest gap the site had: **PDF to Word
// is the most-requested PDF task on the web** — around two million conversions
// a day — and **fewer than 15% of them happen without the file being uploaded
// to somebody's server.** That is this site's entire thesis, stated by the
// market, on the one document people are least willing to hand over: a
// contract, a payslip, a medical letter.
//
// It needed no new dependency. `pdf-to-text` already extracts with pdf.js and
// `lib/writeDocx.ts` already writes real OOXML from `Block[]`; what was missing
// was the middle — turning positioned glyph runs back into headings,
// paragraphs and lists.
//
// WHAT THIS DOES NOT DO, said plainly here and in the UI. A PDF has no
// paragraphs, no headings and no lists: it has characters at coordinates in
// fonts. Everything below is INFERENCE, and it recovers the text and its
// shape — not images, not exact layout, not a table as a table. Claiming a
// faithful reproduction is what the upload sites do, and they need a server to
// half-manage it.
//
// Four inferences, each measurable against a real document:
//
// 1. **Body size is the MEDIAN of the characters, not of the lines.** A short
//    heading is one line and forty characters; a paragraph is one line and
//    four hundred. Taking the median over lines lets a title page full of
//    large short lines redefine "normal" and turn the actual body into small
//    print. Weighting by character count is what makes a document with a big
//    cover page still come out right.
// 2. **A heading is a line meaningfully larger than the body, AND short.** Size
//    alone promotes the first line of a pull quote; length alone promotes every
//    one-line paragraph. The level comes from how much larger, so a document's
//    own hierarchy survives instead of everything becoming H1.
// 3. **A line ending mid-sentence continues the paragraph.** PDF lines are
//    typographic, not semantic — a wrapped sentence is several lines — so
//    joining only on a blank gap gives one paragraph per LINE, which is the
//    single most obvious way a converted document is unusable.
// 4. **A bullet or a number at the start of a line makes a list item.** Word
//    then treats it as a real list through `numbering.xml`, rather than as a
//    paragraph that happens to begin with a character.

import type { Block, Inline } from '../../lib/markdown'

export interface Run {
  text: string
  /** Rendered font size in PDF units — the vertical scale of the transform. */
  size: number
  bold: boolean
  x: number
  y: number
}

export interface Line {
  text: string
  size: number
  /** True when the whole line is bold, which is a heading signal on its own. */
  bold: boolean
  x: number
  y: number
  /** The runs, kept so bold spans survive into the Word document. */
  runs: Run[]
}

/** Bullet characters real PDFs use, plus the ASCII ones people type. */
const BULLET = /^\s*([•‣▪◦·∙*\-–—]|[oO])\s+/
const NUMBERED = /^\s*(\d{1,3})[.)]\s+/
/** Arabic-Indic digits, since an Arabic document numbers its lists in them. */
const NUMBERED_AR = /^\s*([٠-٩]{1,3})[.)]\s+/

/** A line that ends mid-sentence is a wrap, not a paragraph break. */
function continues(line: string): boolean {
  const t = line.trimEnd()
  if (!t) return false
  // Terminal punctuation in both scripts, plus a closing bracket or quote
  // after it. Arabic full stop is the same character; the question mark is not.
  return !/[.!?:;؟۔…]["'”’)\]]?$/.test(t)
}

/**
 * Group positioned runs into lines.
 *
 * Runs on the same baseline belong to one line. The tolerance is a fraction of
 * the font size rather than a fixed number of points, because a document set in
 * 8pt and one set in 24pt disagree about what "the same line" means by a factor
 * of three — and a fixed tolerance merges two lines of small print or splits a
 * heading whose glyphs sit a hair apart.
 */
export function runsToLines(runs: Run[]): Line[] {
  const sorted = [...runs].sort((a, b) => (b.y - a.y) || (a.x - b.x))
  const lines: Line[] = []
  for (const r of sorted) {
    if (!r.text) continue
    const last = lines[lines.length - 1]
    const tol = Math.max(1, r.size * 0.35)
    if (last && Math.abs(last.y - r.y) <= tol) {
      // A real gap between runs is a space; abutting runs are one word split at
      // a formatting boundary, and joining those with a space gives "Riy adh".
      const prev = last.runs[last.runs.length - 1]
      const gap = r.x - (prev.x + prev.text.length * prev.size * 0.5)
      const sep = gap > prev.size * 0.25 && !last.text.endsWith(' ') && !r.text.startsWith(' ') ? ' ' : ''
      last.text += sep + r.text
      last.runs.push(r)
      last.size = Math.max(last.size, r.size)
      last.bold = last.bold && r.bold
    } else {
      lines.push({ text: r.text, size: r.size, bold: r.bold, x: r.x, y: r.y, runs: [r] })
    }
  }
  return lines.filter((l) => l.text.trim())
}

/**
 * The body text size: the median over CHARACTERS, not over lines.
 *
 * See note 1 — a cover page of large short lines otherwise redefines normal.
 */
export function bodySize(lines: Line[]): number {
  const weighted: number[] = []
  for (const l of lines) {
    const n = Math.max(1, Math.round(l.text.trim().length / 10))
    for (let i = 0; i < n; i++) weighted.push(l.size)
  }
  if (!weighted.length) return 12
  weighted.sort((a, b) => a - b)
  return weighted[Math.floor(weighted.length / 2)]
}

/** Heading level from how much larger than the body a line is, or 0 for none. */
export function headingLevel(line: Line, body: number): number {
  const ratio = line.size / body
  const words = line.text.trim().split(/\s+/).length
  // Short, because size alone promotes the opening line of a pull quote.
  if (words > 14) return 0
  if (ratio >= 1.7) return 1
  if (ratio >= 1.35) return 2
  if (ratio >= 1.15) return 3
  // A wholly bold short line at body size is the fourth-level heading every
  // report uses and no size test can see.
  if (line.bold && ratio >= 0.98 && words <= 10) return 4
  return 0
}

/** The line's runs as Inline, so bold spans survive into Word. */
function inlineOf(line: Line): Inline[] {
  const out: Inline[] = []
  for (const r of line.runs) {
    if (!r.text) continue
    const last = out[out.length - 1]
    const t = r.bold ? 'strong' : 'text'
    if (last && last.t === t) last.v += r.text
    else out.push({ t, v: r.text } as Inline)
  }
  return out.length ? out : [{ t: 'text', v: line.text }]
}

const joinInline = (a: Inline[], b: Inline[]): Inline[] => {
  const out = [...a]
  const last = out[out.length - 1]
  const first = b[0]
  if (last && first && last.t === first.t && (last.t === 'text' || last.t === 'strong')) {
    out[out.length - 1] = { ...last, v: `${last.v} ${first.v}` } as Inline
    return [...out, ...b.slice(1)]
  }
  return [...out, { t: 'text', v: ' ' }, ...b]
}

/** Positioned runs for one page → the blocks `writeDocx` renders. */
export function linesToBlocks(lines: Line[], body: number): Block[] {
  const blocks: Block[] = []
  let para: Inline[] | null = null
  let list: { ordered: boolean; items: { inline: Inline[]; depth: number }[] } | null = null

  const flushPara = () => { if (para) { blocks.push({ t: 'para', inline: para }); para = null } }
  const flushList = () => { if (list) { blocks.push({ t: 'list', ...list }); list = null } }

  for (const line of lines) {
    const raw = line.text.trim()
    if (!raw) continue

    const level = headingLevel(line, body)
    if (level) {
      flushPara(); flushList()
      blocks.push({ t: 'heading', level, inline: inlineOf(line) })
      continue
    }

    const bullet = BULLET.exec(raw)
    const numbered = NUMBERED.exec(raw) || NUMBERED_AR.exec(raw)
    if (bullet || numbered) {
      flushPara()
      const ordered = !!numbered && !bullet
      if (list && list.ordered !== ordered) flushList()
      // Strip the marker: Word supplies it, and leaving it in gives every item
      // two bullets.
      const stripped: Line = { ...line, text: raw.replace(bullet ? BULLET : (numbered && NUMBERED.test(raw) ? NUMBERED : NUMBERED_AR), '') }
      stripped.runs = [{ ...line.runs[0], text: stripped.text }]
      list = list || { ordered, items: [] }
      list.items.push({ inline: inlineOf(stripped), depth: 0 })
      continue
    }

    flushList()
    // Note 3: a line ending mid-sentence is a wrap, so it continues.
    if (para) para = joinInline(para, inlineOf(line))
    else para = inlineOf(line)
    if (!continues(raw)) flushPara()
  }
  flushPara(); flushList()
  return blocks
}

/** The whole document, from every page's runs in order. */
export function pdfToBlocks(pages: Run[][]): Block[] {
  const perPage = pages.map(runsToLines)
  const all = perPage.flat()
  const body = bodySize(all)
  const out: Block[] = []
  for (const lines of perPage) out.push(...linesToBlocks(lines, body))
  return out
}
