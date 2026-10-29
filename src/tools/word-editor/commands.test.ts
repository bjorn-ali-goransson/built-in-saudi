import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection, type Command } from 'prosemirror-state'
import { schema } from './schema'
import * as C from './commands'

const S = schema
const p = (text: string, attrs: Record<string, unknown> = {}) => ({ type: 'paragraph', attrs, content: text ? [{ type: 'text', text }] : [] })
function state(content: unknown[], from = 1, to = from) {
  const doc = S.nodeFromJSON({ type: 'doc', content })
  return EditorState.create({ doc, selection: TextSelection.create(doc, from, to) })
}
function run(st: EditorState, cmd: Command): EditorState {
  let out = st
  const ok = cmd(st, (tr) => { out = st.apply(tr) })
  expect(ok).toBe(true)
  return out
}

describe('word processor commands', () => {
  it('setTextStyle keeps the other attributes each run already has', () => {
    // "Hello" red, " world" with a font; a size change across both keeps both.
    const doc = [{ type: 'paragraph', content: [
      { type: 'text', text: 'Hello', marks: [{ type: 'textStyle', attrs: { color: '#ff0000' } }] },
      { type: 'text', text: ' world', marks: [{ type: 'textStyle', attrs: { font: 'Arial' } }] },
    ] }]
    const out = run(state(doc, 1, 12), C.setTextStyle({ size: 14 }))
    const runs: Record<string, unknown>[] = []
    out.doc.firstChild!.forEach((n) => runs.push(n.marks.find((m) => m.type === S.marks.textStyle)!.attrs))
    expect(runs[0]).toMatchObject({ color: '#ff0000', size: 14, font: null })
    expect(runs[1]).toMatchObject({ font: 'Arial', size: 14, color: null })
  })

  it('setTextStyle removes the mark entirely when every attribute is unset', () => {
    const doc = [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi', marks: [{ type: 'textStyle', attrs: { color: '#00f' } }] }] }]
    const out = run(state(doc, 1, 3), C.setTextStyle({ color: null }))
    expect(out.doc.firstChild!.firstChild!.marks).toHaveLength(0)
  })

  it('setTextStyle on a collapsed cursor stores the mark for the next character', () => {
    const out = run(state([p('Hi')], 3), C.setTextStyle({ color: '#123456' }))
    expect(C.textStyleAt(out)).toMatchObject({ color: '#123456' })
    expect(out.doc.firstChild!.firstChild!.marks).toHaveLength(0)
  })

  it('setStyle keeps direction and alignment, and currentStyle reads it back', () => {
    const out = run(state([p('مرحبا', { dir: 'rtl', align: 'center' })], 2), C.setStyle('h2'))
    const h = out.doc.firstChild!
    expect(h.type.name).toBe('heading')
    expect(h.attrs).toMatchObject({ level: 2, dir: 'rtl', align: 'center' })
    expect(C.currentStyle(out)).toBe('h2')
    const back = run(out, C.setStyle('normal'))
    expect(back.doc.firstChild!.type.name).toBe('paragraph')
    expect(back.doc.firstChild!.attrs.dir).toBe('rtl')
  })

  it('a quote is entered and left with setStyle', () => {
    const q = run(state([p('Quote me')], 2), C.setStyle('quote'))
    expect(q.doc.firstChild!.type.name).toBe('blockquote')
    expect(C.currentStyle(q)).toBe('quote')
    const n = run(q, C.setStyle('normal'))
    expect(n.doc.firstChild!.type.name).toBe('paragraph')
    expect(C.currentStyle(n)).toBe('normal')
  })

  it('toggleList wraps, converts a bulleted list to numbered in place, and unwraps', () => {
    const st = state([p('one'), p('two')], 1, 9)
    const bul = run(st, C.toggleList(S.nodes.bullet_list))
    expect(bul.doc.childCount).toBe(1)
    expect(bul.doc.firstChild!.type.name).toBe('bullet_list')
    expect(bul.doc.firstChild!.childCount).toBe(2)
    const num = run(bul, C.toggleList(S.nodes.ordered_list))
    expect(num.doc.firstChild!.type.name).toBe('ordered_list')
    expect(num.doc.firstChild!.childCount).toBe(2)
    expect(num.doc.firstChild!.attrs.kind).toBe('decimal')
    // Same kind again: take the items out of the list.
    const off = run(num, C.toggleList(S.nodes.ordered_list))
    expect(off.doc.firstChild!.type.name).toBe('paragraph')
  })

  it('a checklist starts unticked, toggleChecked ticks it, converting away clears ticks', () => {
    const chk = run(state([p('buy milk')], 2), C.toggleList(S.nodes.bullet_list, { checklist: true }))
    const list = chk.doc.firstChild!
    expect(list.attrs.checklist).toBe(true)
    expect(list.firstChild!.attrs.checked).toBe(false)
    const ticked = run(chk, C.toggleChecked(1))
    expect(ticked.doc.firstChild!.firstChild!.attrs.checked).toBe(true)
    const plain = run(ticked, C.toggleList(S.nodes.bullet_list))
    expect(plain.doc.firstChild!.attrs.checklist).toBe(false)
    expect(plain.doc.firstChild!.firstChild!.attrs.checked).toBe(null)
    // A plain item cannot be ticked.
    expect(C.toggleChecked(1)(plain)).toBe(false)
  })

  it('indent nests a list item, and indents a paragraph by one step clamped to 0..8', () => {
    const list = state([{ type: 'bullet_list', content: [
      { type: 'list_item', content: [p('a')] }, { type: 'list_item', content: [p('b')] },
    ] }], 8)
    const nested = run(list, C.indent(1))
    expect(nested.doc.firstChild!.childCount).toBe(1)
    expect(nested.doc.firstChild!.firstChild!.childCount).toBe(2) // a + nested list
    const par = run(state([p('x')], 1), C.indent(1))
    expect(par.doc.firstChild!.attrs.indent).toBe(1)
    const back = run(run(par, C.indent(-1)), C.indent(-1))
    expect(back.doc.firstChild!.attrs.indent).toBe(0)
  })

  it('insertTable puts a header row first and replaces an empty paragraph', () => {
    const out = run(state([p('')], 1), C.insertTable(3, 2))
    const t = out.doc.firstChild!
    expect(t.type.name).toBe('table')
    expect(t.childCount).toBe(3)
    expect(t.firstChild!.firstChild!.type.name).toBe('table_header')
    expect(t.child(1).firstChild!.type.name).toBe('table_cell')
    // Inside a table it refuses rather than nesting a table.
    expect(C.insertTable(2, 2)(out)).toBe(false)
  })

  it('insertTable after a non-empty paragraph keeps the paragraph', () => {
    const out = run(state([p('Before')], 3), C.insertTable(2, 2))
    expect(out.doc.firstChild!.textContent).toBe('Before')
    expect(out.doc.child(1).type.name).toBe('table')
  })

  it('insertBlock adds a page break after the block with a fresh paragraph to type in', () => {
    const out = run(state([p('Chapter one')], 4), C.insertBlock(S.nodes.page_break))
    expect(out.doc.child(1).type.name).toBe('page_break')
    expect(out.doc.child(2).type.name).toBe('paragraph')
    expect(out.selection.$from.parent).toBe(out.doc.child(2))
  })

  it('setLink links a selection, linkRange finds the whole link, and null removes all of it', () => {
    const linked = run(state([p('see the site now')], 5, 13), C.setLink('https://example.com'))
    // cursor inside the link
    const inside = linked.apply(linked.tr.setSelection(TextSelection.create(linked.doc, 8)))
    expect(C.linkAt(inside)).toBe('https://example.com')
    expect(C.linkRange(inside)).toEqual([5, 13])
    const gone = run(inside, C.setLink(null))
    expect(gone.doc.rangeHasMark(1, gone.doc.content.size - 1, S.marks.link)).toBe(false)
  })

  it('setLink with no selection inserts the text as a link', () => {
    const out = run(state([p('')], 1), C.setLink('https://a.b', 'click'))
    expect(out.doc.textContent).toBe('click')
    expect(out.doc.rangeHasMark(1, 6, S.marks.link)).toBe(true)
  })

  it('clearFormatting removes styling marks but keeps links', () => {
    const doc = [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://a' } }, { type: 'textStyle', attrs: { color: 'red' } }] }] }]
    const out = run(state(doc, 1, 2), C.clearFormatting)
    expect(out.doc.firstChild!.firstChild!.marks.map((m) => m.type.name)).toEqual(['link'])
  })

  it('markActive reflects selection and stored marks', () => {
    const doc = [{ type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }, { type: 'text', text: ' plain' }] }]
    expect(C.markActive(state(doc, 1, 3), S.marks.bold)).toBe(true)
    expect(C.markActive(state(doc, 7, 9), S.marks.bold)).toBe(false)
    const toggled = run(state(doc, 8), C.toggle('bold'))
    expect(C.markActive(toggled, S.marks.bold)).toBe(true)
  })

  it('setBlockAttr applies to every selected paragraph', () => {
    const out = run(state([p('a'), p('b')], 1, 5), C.setBlockAttr('align', 'center'))
    expect(out.doc.child(0).attrs.align).toBe('center')
    expect(out.doc.child(1).attrs.align).toBe('center')
    expect(C.blockAttr(out, 'align')).toBe('center')
  })

  it('outline lists every heading with its level', () => {
    const doc = S.nodeFromJSON({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Intro' }] }, p('body'),
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Detail' }] },
    ] })
    expect(C.outline(doc).map((h) => [h.level, h.text])).toEqual([[1, 'Intro'], [2, 'Detail']])
  })

  it('findInDoc spans runs with different marks and maps to document positions', () => {
    const doc = S.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Ri', marks: [{ type: 'bold' }] }, { type: 'text', text: 'yadh and riyadhi' },
    ] }] })
    const hits = C.findInDoc(doc, 'riyadh')
    expect(hits).toHaveLength(2)
    expect(doc.textBetween(hits[0].from, hits[0].to)).toBe('Riyadh')
    expect(C.findInDoc(doc, 'riyadh', { matchCase: true })).toHaveLength(1)
    expect(C.findInDoc(doc, 'riyadh', { whole: true })).toHaveLength(1)
    expect(C.findInDoc(doc, '')).toEqual([])
  })

  it('findInDoc finds Arabic text', () => {
    const doc = S.nodeFromJSON({ type: 'doc', content: [p('الرياض عاصمة'), p('مدينة الرياض')] })
    const hits = C.findInDoc(doc, 'الرياض')
    expect(hits).toHaveLength(2)
    for (const h of hits) expect(doc.textBetween(h.from, h.to)).toBe('الرياض')
  })
})
