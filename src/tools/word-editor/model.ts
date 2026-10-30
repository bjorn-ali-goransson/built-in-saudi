// The document as the editor stores it, in plain JSON — the ProseMirror node
// format, without ProseMirror. The readers and writers run in a worker and work
// on this shape directly, so the worker never loads the editor, and every
// converter is testable in Node.

export interface PMMark { type: string; attrs?: Record<string, unknown> }
export interface PMNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PMNode[]
  text?: string
  marks?: PMMark[]
}

export interface PageSetup {
  /** Millimetres. */
  width: number
  height: number
  margins: { top: number; right: number; bottom: number; left: number }
  landscape?: boolean
  /** How far the header sits from the top edge and the footer from the bottom, in mm (Word's 12.5 by default). */
  headerAt?: number
  footerAt?: number
}

export interface WordData {
  doc: PMNode
  page: PageSetup
  /** Plain-text header and footer, repeated on every page. `{page}` and `{pages}` are fields. */
  header?: string
  footer?: string
  /** The direction new paragraphs take, and the document's language. */
  rtl?: boolean
  lang?: string
  /** The document's body face (and its face for Arabic and other complex scripts) and size in points. */
  font?: string
  fontCs?: string
  size?: number
  /** Space after and space before ADD between paragraphs (Word's "Don't use HTML paragraph auto spacing"); the larger of the two otherwise. */
  spaceSum?: boolean
}

export const A4: PageSetup = { width: 210, height: 297, margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 } }
export const LETTER: PageSetup = { width: 215.9, height: 279.4, margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 } }

export const emptyDoc = (rtl = false): WordData => ({
  doc: { type: 'doc', content: [{ type: 'paragraph', attrs: rtl ? { dir: 'rtl' } : {} }] },
  page: { ...A4, margins: { ...A4.margins } },
  rtl,
  lang: rtl ? 'ar-SA' : 'en-US',
})

export type ListKind = 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman' | 'arabic-indic' | 'arabic-abjad'

/** Everything inline text a node holds, joined — for search, word counts and previews. */
export function plainText(n: PMNode, sep = '\n'): string {
  if (n.text !== undefined) return n.text
  if (n.type === 'hard_break') return '\n'
  if (!n.content) return ''
  const inline = n.content.every((c) => c.text !== undefined || c.type === 'hard_break' || c.type === 'image')
  return n.content.map((c) => plainText(c, sep)).join(inline ? '' : sep)
}

/** Words, counted the way a reader would — Arabic and Latin both — not the way a regex of \w does. */
export function wordCount(text: string): number {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’\-]*/gu)
  return m ? m.length : 0
}

/** Does this text read right to left? The first strong character decides, as Unicode's own rule does. */
export function isRtlText(t: string): boolean {
  for (const ch of t) {
    if (/[֐-ࣿיִ-﷿ﹰ-﻿]/.test(ch)) return true
    if (/[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/.test(ch)) return false
  }
  return false
}

export const BLOCK_TYPES = new Set(['paragraph', 'heading', 'blockquote', 'code_block', 'horizontal_rule', 'page_break', 'bullet_list', 'ordered_list', 'list_item', 'table', 'table_row', 'table_cell', 'table_header'])
