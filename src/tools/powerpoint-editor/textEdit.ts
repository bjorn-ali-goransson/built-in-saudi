// Editing the text inside a shape: a small ProseMirror schema for slide text,
// converted from and back to the deck's TextBody.
//
// ProseMirror rather than a bare contentEditable because the browser's own
// editing commands disagree with each other about what bold or a new
// paragraph produces, and the result has to round-trip into a model and a
// .pptx. The schema is the TextBody's shape exactly: paragraphs with their
// level, bullet and direction; runs with their marks; a line break. Nothing in
// it can mean something the model cannot hold.
//
// Two ways to format, because there are two ways people do it: inside a box
// while typing (the selection), and on a SELECTED box from the ribbon (all of
// its text). The second is plain functions over TextBody, below.
import { Schema, type Node, type Mark } from 'prosemirror-model'
import type { Command, EditorState } from 'prosemirror-state'
import { toggleMark } from 'prosemirror-commands'
import type { Para, Run, TextBody } from './model'

const paraAttrs = {
  align: { default: null as string | null }, level: { default: 0 }, bullet: { default: null as string | null }, char: { default: null as string | null },
  scheme: { default: null as string | null }, start: { default: null as number | null }, rtl: { default: false }, lineSpacing: { default: null as number | null },
  spaceBefore: { default: null as number | null }, spaceAfter: { default: null as number | null }, size: { default: null as number | null },
}

export const slideSchema = new Schema({
  nodes: {
    doc: { content: 'para+' },
    para: {
      content: 'inline*', attrs: paraAttrs,
      toDOM: (n) => ['p', { dir: n.attrs.rtl ? 'rtl' : 'auto', 'data-level': n.attrs.level, 'data-bullet': n.attrs.bullet || undefined }, 0],
      parseDOM: [{ tag: 'p' }, { tag: 'div' }, { tag: 'li', getAttrs: () => ({ bullet: 'bullet' }) }, { tag: 'h1' }, { tag: 'h2' }, { tag: 'h3' }],
    },
    text: { group: 'inline' },
    br: { inline: true, group: 'inline', selectable: false, toDOM: () => ['br'], parseDOM: [{ tag: 'br' }] },
  },
  marks: {
    b: { toDOM: () => ['strong', 0], parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight', getAttrs: (v) => /^(bold|[6-9]00)$/.test(v as string) && null }] },
    i: { toDOM: () => ['em', 0], parseDOM: [{ tag: 'em' }, { tag: 'i' }] },
    u: { toDOM: () => ['u', 0], parseDOM: [{ tag: 'u' }] },
    s: { toDOM: () => ['s', 0], parseDOM: [{ tag: 's' }, { tag: 'del' }] },
    sup: { excludes: 'sub', toDOM: () => ['sup', 0], parseDOM: [{ tag: 'sup' }] },
    sub: { excludes: 'sup', toDOM: () => ['sub', 0], parseDOM: [{ tag: 'sub' }] },
    link: { attrs: { href: {} }, inclusive: false, toDOM: (m) => ['a', { href: m.attrs.href, 'data-href': m.attrs.href }, 0], parseDOM: [{ tag: 'a[href]', getAttrs: (d) => ({ href: (d as HTMLElement).getAttribute('href') }) }] },
    ts: {
      attrs: { color: { default: null }, highlight: { default: null }, size: { default: null }, font: { default: null }, spc: { default: null }, caps: { default: null } },
      // The CSS is filled in by the editor, which knows the theme; here the attributes are carried.
      toDOM: (m) => ['span', { 'data-ts': '1', 'data-color': m.attrs.color || undefined, 'data-size': m.attrs.size || undefined, 'data-font': m.attrs.font || undefined, 'data-hl': m.attrs.highlight || undefined, 'data-spc': m.attrs.spc ?? undefined, 'data-caps': m.attrs.caps || undefined, style: [m.attrs.spc ? `letter-spacing:${m.attrs.spc}px` : '', m.attrs.caps === 'all' ? 'text-transform:uppercase' : m.attrs.caps === 'small' ? 'font-variant:small-caps' : ''].filter(Boolean).join(';') || undefined }, 0],
      parseDOM: [{ tag: 'span[data-ts]', getAttrs: (d) => { const e = d as HTMLElement; return { color: e.dataset.color || null, size: e.dataset.size ? +e.dataset.size : null, font: e.dataset.font || null, highlight: e.dataset.hl || null, spc: e.dataset.spc ? +e.dataset.spc : null, caps: e.dataset.caps === 'all' || e.dataset.caps === 'small' ? e.dataset.caps : null } } }],
    },
  },
})
const S = slideSchema

export function toPM(body: TextBody | undefined): Node {
  const paras = (body?.paras.length ? body.paras : [{ runs: [] }]).map((p) => {
    const kids: Node[] = []
    for (const r of p.runs) {
      if (r.t === '\n') { kids.push(S.nodes.br.create()); continue }
      if (!r.t) continue
      const marks: Mark[] = []
      if (r.b) marks.push(S.marks.b.create())
      if (r.i) marks.push(S.marks.i.create())
      if (r.u) marks.push(S.marks.u.create())
      if (r.s) marks.push(S.marks.s.create())
      if (r.sup) marks.push(S.marks.sup.create())
      if (r.sub) marks.push(S.marks.sub.create())
      if (r.link) marks.push(S.marks.link.create({ href: r.link }))
      if (r.color || r.highlight || r.size || r.font || r.spc || r.caps) marks.push(S.marks.ts.create({ color: r.color || null, highlight: r.highlight || null, size: r.size || null, font: r.font || null, spc: r.spc || null, caps: r.caps || null }))
      // A run may hold a newline from a paste; split it into breaks.
      r.t.split('\n').forEach((part, i) => { if (i) kids.push(S.nodes.br.create()); if (part) kids.push(S.text(part, marks)) })
    }
    return S.nodes.para.create({
      align: p.align || null, level: p.level || 0, bullet: p.bullet || null, char: p.char || null, scheme: p.scheme || null, start: p.start || null,
      rtl: !!p.rtl, lineSpacing: p.lineSpacing || null, spaceBefore: p.spaceBefore ?? null, spaceAfter: p.spaceAfter ?? null, size: p.size || null,
    }, kids)
  })
  return S.nodes.doc.create(null, paras)
}

/** The doc back into paragraphs; everything else about the body (anchor, insets, defaults) is kept from `base`. */
export function fromPM(doc: Node, base: TextBody | undefined): TextBody {
  const paras: Para[] = []
  doc.forEach((pn) => {
    const a = pn.attrs
    const p: Para = { runs: [] }
    if (a.align) p.align = a.align
    if (a.level) p.level = a.level
    if (a.bullet) p.bullet = a.bullet
    if (a.char) p.char = a.char
    if (a.scheme) p.scheme = a.scheme
    if (a.start) p.start = a.start
    if (a.rtl) p.rtl = true
    if (a.lineSpacing) p.lineSpacing = a.lineSpacing
    if (a.spaceBefore != null) p.spaceBefore = a.spaceBefore
    if (a.spaceAfter != null) p.spaceAfter = a.spaceAfter
    if (a.size) p.size = a.size
    pn.forEach((c) => {
      if (c.type === S.nodes.br) { p.runs.push({ t: '\n' }); return }
      const r: Run = { t: c.text || '' }
      for (const m of c.marks) {
        const n = m.type.name
        if (n === 'link') r.link = m.attrs.href
        else if (n === 'ts') { if (m.attrs.color) r.color = m.attrs.color; if (m.attrs.highlight) r.highlight = m.attrs.highlight; if (m.attrs.size) r.size = m.attrs.size; if (m.attrs.font) r.font = m.attrs.font; if (m.attrs.spc) r.spc = m.attrs.spc; if (m.attrs.caps) r.caps = m.attrs.caps }
        else (r as unknown as Record<string, boolean>)[n] = true
      }
      const last = p.runs[p.runs.length - 1]
      if (last && last.t !== '\n' && sameLook(last, r)) last.t += r.t
      else p.runs.push(r)
    })
    paras.push(p)
  })
  return { ...(base || { paras: [] }), paras }
}
const LOOK: (keyof Run)[] = ['b', 'i', 'u', 's', 'sup', 'sub', 'color', 'highlight', 'size', 'font', 'link']
const sameLook = (a: Run, b: Run) => LOOK.every((k) => (a[k] ?? null) === (b[k] ?? null))

// ---- inside the box: commands on the selection -----------------------------------

export const markOn = (state: EditorState, name: string): boolean => {
  const t = S.marks[name]
  const { from, to, empty, $from } = state.selection
  if (empty) return !!t.isInSet(state.storedMarks || $from.marks())
  return state.doc.rangeHasMark(from, to, t)
}
export const toggle = (name: string): Command => toggleMark(S.marks[name])

/** Set one text-style attribute across the selection, keeping the others each run has. */
export function setTs(patch: Partial<Record<'color' | 'highlight' | 'size' | 'font', unknown>>): Command {
  return (state, dispatch) => {
    const t = S.marks.ts
    const { from, to, empty } = state.selection
    const merge = (cur: Record<string, unknown> | undefined) => {
      const n = { color: null, highlight: null, size: null, font: null, ...(cur || {}), ...patch } as Record<string, unknown>
      return Object.values(n).some((v) => v != null && v !== '') ? t.create(n) : null
    }
    if (empty) {
      const marks = (state.storedMarks || state.selection.$from.marks())
      const cur = marks.find((m) => m.type === t)?.attrs
      const next = merge(cur)
      dispatch?.(state.tr.setStoredMarks([...marks.filter((m) => m.type !== t), ...(next ? [next] : [])]))
      return true
    }
    if (!dispatch) return true
    const tr = state.tr
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText) return
      const a = Math.max(from, pos), b = Math.min(to, pos + node.nodeSize)
      const next = merge(node.marks.find((m) => m.type === t)?.attrs)
      tr.removeMark(a, b, t)
      if (next) tr.addMark(a, b, next)
    })
    dispatch(tr)
    return true
  }
}
export function tsAt(state: EditorState): Record<string, unknown> {
  const { $from, empty } = state.selection
  const marks = empty ? state.storedMarks || $from.marks() : state.doc.resolve(Math.min(state.selection.from + 1, state.doc.content.size)).marks()
  return (marks.find((m) => m.type === S.marks.ts)?.attrs as Record<string, unknown>) || {}
}
/** Set a paragraph attribute on every paragraph the selection touches. */
export function setPara(attr: string, value: unknown): Command {
  return (state, dispatch) => {
    if (!dispatch) return true
    const tr = state.tr
    const { from, to } = state.selection
    state.doc.nodesBetween(from, to, (n, pos) => { if (n.type === S.nodes.para) { tr.setNodeMarkup(pos, undefined, { ...n.attrs, [attr]: value }); return false } return true })
    dispatch(tr)
    return true
  }
}
export function paraAttr(state: EditorState, attr: string): unknown { return state.selection.$from.parent.attrs[attr] }
/** Tab and Shift+Tab: a level deeper or shallower, as PowerPoint does in a list. */
export function shiftLevel(d: 1 | -1): Command {
  return (state, dispatch) => {
    if (!dispatch) return true
    const tr = state.tr
    const { from, to } = state.selection
    state.doc.nodesBetween(from, to, (n, pos) => { if (n.type === S.nodes.para) { tr.setNodeMarkup(pos, undefined, { ...n.attrs, level: Math.max(0, Math.min(8, (n.attrs.level || 0) + d)) }); return false } return true })
    dispatch(tr)
    return true
  }
}
export function setLink(href: string | null): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection
    if (empty || !dispatch) return !empty
    const tr = state.tr.removeMark(from, to, S.marks.link)
    if (href) tr.addMark(from, to, S.marks.link.create({ href }))
    dispatch(tr)
    return true
  }
}

// ---- on a selected box: formatting all of its text --------------------------------

export type RunPatch = Partial<Pick<Run, 'b' | 'i' | 'u' | 's' | 'sup' | 'sub' | 'color' | 'highlight' | 'size' | 'font'>>
export type ParaPatch = Partial<Pick<Para, 'align' | 'bullet' | 'rtl' | 'lineSpacing' | 'level'>>

export function patchRuns(b: TextBody, patch: RunPatch): TextBody {
  const one = (r: Run): Run => {
    const n = { ...r }
    for (const [k, v] of Object.entries(patch)) { if (v === undefined || v === null || v === false) delete (n as unknown as Record<string, unknown>)[k]; else (n as unknown as Record<string, unknown>)[k] = v }
    return n
  }
  // An empty box takes the formatting too, as the size of its empty paragraphs, so what is typed next matches.
  return { ...b, paras: b.paras.map((p) => ({ ...p, runs: p.runs.map(one), ...(patch.size && !p.runs.length ? { size: patch.size } : {}) })) }
}
export function patchParas(b: TextBody, patch: ParaPatch): TextBody {
  return { ...b, paras: b.paras.map((p) => { const n = { ...p }; for (const [k, v] of Object.entries(patch)) { if (v === undefined || v === null || v === false) delete (n as unknown as Record<string, unknown>)[k]; else (n as unknown as Record<string, unknown>)[k] = v } return n }) }
}
/** What the ribbon shows for a selected box: its first run's look. */
export function firstRun(b: TextBody | undefined): Run | undefined {
  for (const p of b?.paras || []) for (const r of p.runs) if (r.t && r.t !== '\n') return r
  return undefined
}
/** "Is all of it bold?" — for toggling a whole box. */
export function allRuns(b: TextBody | undefined, k: 'b' | 'i' | 'u' | 's'): boolean {
  const runs = (b?.paras || []).flatMap((p) => p.runs).filter((r) => r.t && r.t !== '\n')
  return runs.length > 0 && runs.every((r) => (k === 'b' ? r.b ?? !!b?.defaults?.b : r[k]))
}
