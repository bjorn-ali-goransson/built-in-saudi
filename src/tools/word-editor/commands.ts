// What the ribbon and the keyboard do to the document. Every one is a plain
// ProseMirror command, so each is undoable, testable on an EditorState without a
// view, and — through the collab plugin — sent to collaborators as steps.
import { toggleMark, setBlockType, wrapIn, lift } from 'prosemirror-commands'
import { wrapInList, liftListItem, sinkListItem } from 'prosemirror-schema-list'
import { TextSelection, NodeSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state'
import type { MarkType, Node, NodeType, Attrs } from 'prosemirror-model'
import { isInTable } from 'prosemirror-tables'
import { schema } from './schema'

const S = schema

export function markActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection
  if (empty) return !!type.isInSet(state.storedMarks || $from.marks())
  return state.doc.rangeHasMark(from, to, type)
}
export const toggle = (name: string): Command => toggleMark(S.marks[name])

/** The textStyle attributes at the cursor (or the start of the selection). */
export function textStyleAt(state: EditorState): Record<string, unknown> {
  const { $from, empty } = state.selection
  const marks = empty ? state.storedMarks || $from.marks() : state.doc.resolve(Math.min(state.selection.from + 1, state.doc.content.size)).marks()
  return (marks.find((m) => m.type === S.marks.textStyle)?.attrs as Record<string, unknown>) || {}
}

/**
 * Set one textStyle attribute (colour, highlight, font, size) across the
 * selection, keeping the others each run already has — runs in a selection
 * often differ, and a size change must not reset their colours.
 */
export function setTextStyle(patch: Record<string, unknown>): Command {
  return (state, dispatch) => {
    const type = S.marks.textStyle
    const { from, to, empty } = state.selection
    if (empty) {
      const cur = textStyleAt(state)
      const next = clean({ ...cur, ...patch })
      if (dispatch) dispatch(state.tr.setStoredMarks([...(state.storedMarks || state.selection.$from.marks()).filter((m) => m.type !== type), ...(next ? [type.create(next)] : [])]))
      return true
    }
    if (!dispatch) return true
    const tr = state.tr
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText) return
      const a = Math.max(from, pos)
      const b = Math.min(to, pos + node.nodeSize)
      const cur = (node.marks.find((m) => m.type === type)?.attrs as Record<string, unknown>) || {}
      const next = clean({ ...cur, ...patch })
      tr.removeMark(a, b, type)
      if (next) tr.addMark(a, b, type.create(next))
    })
    dispatch(tr.scrollIntoView())
    return true
  }
}
function clean(a: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = { color: null, highlight: null, font: null, size: null }
  let any = false
  for (const k of Object.keys(out)) if (a[k] != null && a[k] !== '') { out[k] = a[k]; any = true }
  return any ? out : null
}

export const clearFormatting: Command = (state, dispatch) => {
  const { from, to } = state.selection
  if (dispatch) {
    const tr = state.tr
    for (const m of Object.values(S.marks)) if (m !== S.marks.link) tr.removeMark(from, to, m)
    tr.setStoredMarks([])
    dispatch(tr)
  }
  return true
}

/** The textblocks the selection touches. */
function textblocks(state: EditorState): { node: Node; pos: number }[] {
  const out: { node: Node; pos: number }[] = []
  const { from, to } = state.selection
  state.doc.nodesBetween(from, to, (node, pos) => { if (node.isTextblock) { out.push({ node, pos }); return false } return true })
  if (!out.length) { const $f = state.selection.$from; if ($f.parent.isTextblock) out.push({ node: $f.parent, pos: $f.before() }) }
  return out
}

/** Set a paragraph attribute (align, dir, lineHeight, spacing) on every selected block. */
export function setBlockAttr(attr: string, value: unknown): Command {
  return (state, dispatch) => {
    const blocks = textblocks(state).filter((b) => attr in (b.node.type.spec.attrs || {}))
    if (!blocks.length) return false
    if (dispatch) {
      const tr = state.tr
      // Choosing a line spacing replaces a fixed rule the document came with, or the menu would
      // say 1.5 over a paragraph still drawn at exactly 12pt.
      const also = attr === 'lineHeight' ? { lineExact: null, lineMin: null } : {}
      for (const b of blocks) tr.setNodeMarkup(b.pos, undefined, { ...b.node.attrs, ...also, [attr]: value })
      dispatch(tr)
    }
    return true
  }
}
export function blockAttr(state: EditorState, attr: string): unknown {
  return state.selection.$from.parent.attrs[attr]
}

const CARRY = ['align', 'dir', 'indent', 'lineHeight', 'lineExact', 'lineMin', 'paraSize', 'paraFont', 'spaceBefore', 'spaceAfter', 'firstLine', 'borders', 'tabs']
/** Change the block type keeping its direction and alignment (a heading in Arabic stays right to left). */
export function setStyle(style: string): Command {
  return (state, dispatch) => {
    const $f = state.selection.$from
    const keep: Record<string, unknown> = {}
    for (const k of CARRY) if (k in ($f.parent.attrs || {})) keep[k] = $f.parent.attrs[k]
    if (style === 'quote') return wrapIn(S.nodes.blockquote)(state, dispatch)
    if (style === 'code') return setBlockType(S.nodes.code_block)(state, dispatch)
    // Leaving a quote first, if inside one.
    let st = state
    let tr: Transaction | null = null
    if (style === 'normal' && $f.node(-1)?.type === S.nodes.blockquote) {
      lift(state, (t) => { tr = t })
      if (tr) st = state.apply(tr)
    }
    const m = style.match(/^h([1-6])$/)
    const cmd = m ? setBlockType(S.nodes.heading, { level: +m[1], ...keep }) : setBlockType(S.nodes.paragraph, keep)
    // After leaving a quote the block is often ALREADY a paragraph, so the second
    // command finds nothing to change and never dispatches — the lift alone must still land.
    let sent = false
    const ok = cmd(st, (t2) => {
      if (!dispatch) return
      sent = true
      if (tr) { for (const s of t2.steps) (tr as Transaction).step(s); dispatch(tr as Transaction) } else dispatch(t2)
    })
    if (tr && !sent && dispatch) dispatch(tr)
    return ok || !!tr
  }
}
export function currentStyle(state: EditorState): string {
  const $f = state.selection.$from
  const p = $f.parent
  if (p.type === S.nodes.heading) return `h${p.attrs.level}`
  if (p.type === S.nodes.code_block) return 'code'
  for (let d = $f.depth; d > 0; d--) if ($f.node(d).type === S.nodes.blockquote) return 'quote'
  return 'normal'
}

/** The list the cursor is in, innermost first. */
export function listAt(state: EditorState): { node: Node; pos: number; depth: number } | null {
  const $f = state.selection.$from
  for (let d = $f.depth; d > 0; d--) {
    const n = $f.node(d)
    if (n.type === S.nodes.bullet_list || n.type === S.nodes.ordered_list) return { node: n, pos: $f.before(d), depth: d }
  }
  return null
}

/**
 * Toggle a list: on a paragraph, wrap it; inside a list of the SAME kind, take
 * it out; inside a list of a different kind, CONVERT the list in place (a
 * bulleted list made numbered keeps its items and its nesting).
 */
export function toggleList(type: NodeType, attrs: Attrs = {}): Command {
  return (state, dispatch) => {
    const cur = listAt(state)
    if (cur) {
      const sameKind = cur.node.type === type && (type !== S.nodes.bullet_list || !!cur.node.attrs.checklist === !!attrs.checklist) && (type !== S.nodes.ordered_list || !attrs.kind || cur.node.attrs.kind === attrs.kind)
      if (sameKind) return liftListItem(S.nodes.list_item)(state, dispatch)
      if (dispatch) {
        const tr = state.tr.setNodeMarkup(cur.pos, type, { ...(type === S.nodes.ordered_list ? { order: 1, kind: 'decimal' } : { checklist: false }), ...attrs })
        if (attrs.checklist) cur.node.forEach((li, off) => { tr.setNodeMarkup(cur.pos + 1 + off, undefined, { ...li.attrs, checked: false }) })
        else cur.node.forEach((li, off) => { if (li.attrs.checked !== null) tr.setNodeMarkup(cur.pos + 1 + off, undefined, { ...li.attrs, checked: null }) })
        dispatch(tr)
      }
      return true
    }
    return wrapInList(type, attrs)(state, (tr) => {
      if (!dispatch) return
      if (attrs.checklist) {
        // New checklist items start unticked.
        const $s = tr.selection.$from
        for (let d = $s.depth; d > 0; d--) {
          const n = $s.node(d)
          if (n.type === S.nodes.bullet_list) { const p = $s.before(d); n.forEach((li, off) => tr.setNodeMarkup(p + 1 + off, undefined, { ...li.attrs, checked: false })); break }
        }
      }
      dispatch(tr)
    })
  }
}

/** Tab: deeper in a list, otherwise indent the paragraph. Shift+Tab: the reverse. */
export function indent(dir: 1 | -1): Command {
  return (state, dispatch) => {
    if (listAt(state)) return (dir > 0 ? sinkListItem(S.nodes.list_item) : liftListItem(S.nodes.list_item))(state, dispatch)
    const blocks = textblocks(state).filter((b) => 'indent' in (b.node.type.spec.attrs || {}))
    if (!blocks.length) return false
    if (dispatch) {
      const tr = state.tr
      for (const b of blocks) tr.setNodeMarkup(b.pos, undefined, { ...b.node.attrs, indent: Math.max(0, Math.min(8, dir > 0 ? Math.floor(b.node.attrs.indent || 0) + 1 : Math.ceil(b.node.attrs.indent || 0) - 1)) })
      dispatch(tr)
    }
    return true
  }
}

export function insertNode(node: Node): Command {
  return (state, dispatch) => {
    if (dispatch) dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
    return true
  }
}
/** A block (page break, rule) after the current block, with the cursor in a fresh paragraph after it. */
export function insertBlock(type: NodeType): Command {
  return (state, dispatch) => {
    const $f = state.selection.$from
    let d = $f.depth
    while (d > 0 && !$f.node(d - 1).type.contentMatch.matchType(type)) d--
    if (d === 0 && !state.doc.type.contentMatch.matchType(type)) return false
    const after = d > 0 ? $f.after(d) : $f.pos
    if (dispatch) {
      const tr = state.tr.insert(after, [type.create(), S.nodes.paragraph.create($f.parent.attrs.dir ? { dir: $f.parent.attrs.dir } : {})])
      tr.setSelection(TextSelection.create(tr.doc, after + 2))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export function insertTable(rows: number, cols: number): Command {
  return (state, dispatch) => {
    if (isInTable(state)) return false
    const cell = (header: boolean) => (header ? S.nodes.table_header : S.nodes.table_cell).create(null, S.nodes.paragraph.create())
    const table = S.nodes.table.create(null, Array.from({ length: rows }, (_, r) => S.nodes.table_row.create(null, Array.from({ length: cols }, () => cell(r === 0)))))
    return insertBlockNode(table)(state, dispatch)
  }
}
function insertBlockNode(node: Node): Command {
  return (state, dispatch) => {
    const $f = state.selection.$from
    const d = Math.max(1, $f.depth)
    const after = $f.after(d)
    if (dispatch) {
      const empty = $f.parent.isTextblock && $f.parent.content.size === 0 && $f.depth === 1
      const tr = empty ? state.tr.replaceWith($f.before(1), $f.after(1), node) : state.tr.insert(after, node)
      const at = empty ? $f.before(1) : after
      tr.setSelection(TextSelection.near(tr.doc.resolve(at + 3)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export function setLink(href: string | null, text?: string): Command {
  return (state, dispatch) => {
    const type = S.marks.link
    const { from, to, empty } = state.selection
    if (!dispatch) return true
    const tr = state.tr
    if (!href) {
      // Remove the whole link around the cursor, not just the selected part of it.
      const [a, b] = empty ? linkRange(state) || [from, to] : [from, to]
      dispatch(tr.removeMark(a, b, type))
      return true
    }
    if (empty) {
      const t = text || href
      tr.insertText(t, from).addMark(from, from + t.length, type.create({ href }))
    } else {
      if (text && text !== state.doc.textBetween(from, to)) tr.insertText(text, from, to).addMark(from, from + text.length, type.create({ href }))
      else tr.removeMark(from, to, type).addMark(from, to, type.create({ href }))
    }
    dispatch(tr.scrollIntoView())
    return true
  }
}
export function linkRange(state: EditorState): [number, number] | null {
  const type = S.marks.link
  const $p = state.selection.$from
  const mark = type.isInSet($p.marks()) || ($p.nodeBefore && type.isInSet($p.nodeBefore.marks))
  if (!mark) return null
  let a = $p.pos
  let b = $p.pos
  const parentStart = $p.start()
  const parentEnd = $p.end()
  while (a > parentStart && mark.isInSet(state.doc.resolve(a).nodeBefore?.marks || [])) a -= state.doc.resolve(a).nodeBefore!.nodeSize
  while (b < parentEnd && mark.isInSet(state.doc.resolve(b).nodeAfter?.marks || [])) b += state.doc.resolve(b).nodeAfter!.nodeSize
  return [a, b]
}
export function linkAt(state: EditorState): string | null {
  const m = state.selection.$from.marks().find((x) => x.type === S.marks.link) || state.selection.$from.nodeBefore?.marks.find((x) => x.type === S.marks.link)
  return (m?.attrs.href as string) || null
}

export function selectedImage(state: EditorState): { node: Node; pos: number } | null {
  const sel = state.selection
  if (sel instanceof NodeSelection && sel.node.type === S.nodes.image) return { node: sel.node, pos: sel.from }
  return null
}

/** Toggle a checklist item's tick. */
export function toggleChecked(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos)
    if (!node || node.type !== S.nodes.list_item || node.attrs.checked === null) return false
    if (dispatch) dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: !node.attrs.checked }))
    return true
  }
}

/** Every heading, for the outline pane. */
export function outline(doc: Node): { level: number; text: string; pos: number }[] {
  const out: { level: number; text: string; pos: number }[] = []
  doc.descendants((n, pos) => { if (n.type === S.nodes.heading) { out.push({ level: n.attrs.level, text: n.textContent, pos }); return false } return n.isBlock })
  return out
}

/** Find matches of a query in the document's text, as document ranges. */
export function findInDoc(doc: Node, q: string, opts: { matchCase?: boolean; whole?: boolean } = {}): { from: number; to: number }[] {
  if (!q) return []
  const out: { from: number; to: number }[] = []
  const needle = opts.matchCase ? q : q.toLowerCase()
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    // Text with positions, across runs with different marks.
    let text = ''
    const map: number[] = []
    node.forEach((child, off) => {
      if (child.isText) { for (let i = 0; i < child.text!.length; i++) { map.push(pos + 1 + off + i) } text += child.text }
      else { map.push(pos + 1 + off); text += '￼' }
    })
    const hay = opts.matchCase ? text : text.toLowerCase()
    let i = hay.indexOf(needle)
    while (i >= 0) {
      const before = hay[i - 1]
      const after = hay[i + needle.length]
      const word = /[\p{L}\p{N}]/u
      if (!opts.whole || ((!before || !word.test(before)) && (!after || !word.test(after)))) out.push({ from: map[i], to: map[i + needle.length - 1] + 1 })
      i = hay.indexOf(needle, i + Math.max(1, needle.length))
    }
    return false
  })
  return out
}

/** The text box the selection is inside, if any. */
export function textBoxAt(state: EditorState): { node: Node; pos: number } | null {
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === S.nodes.text_box) return { node: $from.node(d), pos: $from.before(d) }
  return null
}

/** A text box after the current block, holding one empty paragraph with the cursor in it. */
export const insertTextBox: Command = (state, dispatch) => {
  if (textBoxAt(state)) return false
  const box = S.nodes.text_box.create({ width: 220, float: 'right' }, S.nodes.paragraph.create())
  const { $from } = state.selection
  // Before the current top-level block, so it floats beside that block's text.
  const at = $from.depth ? $from.before(1) : 0
  if (dispatch) {
    const tr = state.tr.insert(at, box)
    tr.setSelection(TextSelection.create(tr.doc, at + 2))
    dispatch(tr.scrollIntoView())
  }
  return true
}

export function setTextBox(attrs: Record<string, unknown>): Command {
  return (state, dispatch) => {
    const b = textBoxAt(state)
    if (!b) return false
    if (dispatch) dispatch(state.tr.setNodeMarkup(b.pos, undefined, { ...b.node.attrs, ...attrs }))
    return true
  }
}

/** Remove the box, keeping its paragraphs where it stood. */
export const unwrapTextBox: Command = (state, dispatch) => {
  const b = textBoxAt(state)
  if (!b) return false
  if (dispatch) dispatch(state.tr.replaceWith(b.pos, b.pos + b.node.nodeSize, b.node.content).scrollIntoView())
  return true
}
