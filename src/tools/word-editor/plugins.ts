// The editor's behaviour beyond the schema: typing shortcuts, the keyboard,
// ticking a checklist, drawing collaborators' cursors and the find highlights.
import { Plugin, PluginKey, type Command, type EditorState } from 'prosemirror-state'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, chainCommands, exitCode, toggleMark } from 'prosemirror-commands'
import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule, ellipsis, emDash } from 'prosemirror-inputrules'
import { splitListItem } from 'prosemirror-schema-list'
import { undo, redo, history } from 'prosemirror-history'
import { goToNextCell, tableEditing, columnResizing } from 'prosemirror-tables'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { schema } from './schema'
import { indent, insertBlock, setBlockAttr, setStyle, toggleList, toggleChecked } from './commands'

const S = schema

export function rules(): Plugin {
  return inputRules({
    rules: [
      ellipsis, emDash,
      textblockTypeInputRule(/^(#{1,6})\s$/, S.nodes.heading, (m) => ({ level: m[1].length })),
      wrappingInputRule(/^\s*>\s$/, S.nodes.blockquote),
      // "[ ] " and "[x] " start a checklist; must come before the plain bullet rule.
      new InputRule(/^\s*\[( |x)\]\s$/, (state, m, start, end) => {
        const tr = state.tr.delete(start, end)
        let done = false
        toggleList(S.nodes.bullet_list, { checklist: true })(state.apply(tr), (t2) => {
          for (const st of t2.steps) tr.step(st)
          if (m[1] === 'x') {
            const $s = tr.selection.$from
            for (let d = $s.depth; d > 0; d--) if ($s.node(d).type === S.nodes.list_item) { tr.setNodeMarkup($s.before(d), undefined, { checked: true }); break }
          }
          done = true
        })
        return done ? tr : null
      }),
      wrappingInputRule(/^\s*([-+*•])\s$/, S.nodes.bullet_list),
      wrappingInputRule(/^(\d+)[.)]\s$/, S.nodes.ordered_list, (m) => ({ order: +m[1], kind: 'decimal' }), (m, n) => n.childCount + n.attrs.order === +m[1]),
      // Arabic-Indic digits start an Arabic-numbered list: "١. "
      wrappingInputRule(/^([٠-٩]+)[.)]\s$/, S.nodes.ordered_list, (m) => ({ order: +m[1].replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)), kind: 'arabic-indic' })),
      textblockTypeInputRule(/^```$/, S.nodes.code_block),
      new InputRule(/^(?:---|___|\*\*\*)$/, (state, _m, start, end) => {
        const $s = state.doc.resolve(start)
        if ($s.parent.type !== S.nodes.paragraph || $s.parent.content.size !== end - start) return null
        const tr = state.tr.delete(start, end)
        let out = null as typeof tr | null
        insertBlock(S.nodes.horizontal_rule)(state.apply(tr), (t2) => { for (const st of t2.steps) tr.step(st); out = tr })
        return out
      }),
    ],
  })
}

export interface KeyHooks { onLink?: () => void; onFind?: (replace: boolean) => void; onPrint?: () => void }

export function keys(h: KeyHooks): Plugin[] {
  const mark = (n: string) => toggleMark(S.marks[n])
  const call = (f?: () => void): Command => () => { if (!f) return false; f(); return true }
  const hardBreak: Command = chainCommands(exitCode, (state, dispatch) => { if (dispatch) dispatch(state.tr.replaceSelectionWith(S.nodes.hard_break.create()).scrollIntoView()); return true })
  return [
    keymap({
      'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo,
      'Mod-b': mark('bold'), 'Mod-i': mark('italic'), 'Mod-u': mark('underline'), 'Mod-Shift-x': mark('strike'), 'Mod-`': mark('code'),
      'Mod-.': mark('sup'), 'Mod-,': mark('sub'),
      'Mod-Alt-0': setStyle('normal'), 'Mod-Alt-1': setStyle('h1'), 'Mod-Alt-2': setStyle('h2'), 'Mod-Alt-3': setStyle('h3'),
      'Mod-Shift-7': toggleList(S.nodes.ordered_list), 'Mod-Shift-8': toggleList(S.nodes.bullet_list), 'Mod-Shift-9': toggleList(S.nodes.bullet_list, { checklist: true }),
      'Mod-e': setBlockAttr('align', 'center'), 'Mod-l': setBlockAttr('align', null), 'Mod-r': setBlockAttr('align', 'right'), 'Mod-j': setBlockAttr('align', 'justify'),
      'Mod-Enter': insertBlock(S.nodes.page_break),
      'Shift-Enter': hardBreak,
      Enter: splitListItem(S.nodes.list_item),
      Tab: chainCommands(goToNextCell(1), indent(1)),
      'Shift-Tab': chainCommands(goToNextCell(-1), indent(-1)),
      'Mod-k': call(h.onLink), 'Mod-f': call(h.onFind && (() => h.onFind!(false))), 'Mod-h': call(h.onFind && (() => h.onFind!(true))), 'Mod-p': call(h.onPrint),
    }),
    keymap(baseKeymap),
  ]
}

/** Ticking a checklist: a real checkbox widget at the start of each item. */
export const checklistKey = new PluginKey('checklist')
export function checklist(editable: () => boolean): Plugin {
  const build = (state: EditorState) => {
    const decos: Decoration[] = []
    state.doc.descendants((node, pos) => {
      if (node.type !== S.nodes.list_item || node.attrs.checked === null) return true
      const done = !!node.attrs.checked
      decos.push(Decoration.node(pos, pos + node.nodeSize, { class: done ? 'wd-check wd-done' : 'wd-check' }))
      decos.push(Decoration.widget(pos + 2, () => {
        const box = document.createElement('input')
        box.type = 'checkbox'
        box.checked = done
        box.className = 'wd-checkbox'
        box.contentEditable = 'false'
        box.setAttribute('data-testid', 'wd-checkbox')
        box.setAttribute('data-pos', String(pos))
        box.setAttribute('aria-label', 'Done')
        return box
      }, { side: -1, ignoreSelection: true, key: `chk-${pos}-${done}` }))
      return true
    })
    return DecorationSet.create(state.doc, decos)
  }
  return new Plugin({
    key: checklistKey,
    state: { init: (_, st) => build(st), apply: (tr, old, _o, st) => (tr.docChanged ? build(st) : old) },
    props: {
      decorations: (st) => checklistKey.getState(st),
      handleDOMEvents: {
        mousedown: (view, e) => {
          const t = e.target as HTMLElement
          if (!t.classList?.contains('wd-checkbox')) return false
          e.preventDefault()
          if (editable()) toggleChecked(+t.getAttribute('data-pos')!)(view.state, view.dispatch)
          return true
        },
        click: (_view, e) => { if ((e.target as HTMLElement).classList?.contains('wd-checkbox')) { e.preventDefault(); return true } return false },
      },
    },
  })
}

/** Colleagues' cursors and selections. Set with `tr.setMeta(peersKey, peers)`. */
export interface Peer { client: string; name: string; color: string; from: number; to: number }
export const peersKey = new PluginKey<{ peers: Peer[]; set: DecorationSet }>('peers')
export function peers(): Plugin {
  const build = (doc: EditorState['doc'], list: Peer[]) => {
    const max = doc.content.size
    const decos: Decoration[] = []
    for (const p of list) {
      const from = Math.max(0, Math.min(max, p.from))
      const to = Math.max(0, Math.min(max, p.to))
      if (to > from) decos.push(Decoration.inline(from, to, { style: `background:${p.color}33`, class: 'wd-peer-sel' }))
      decos.push(Decoration.widget(to, () => {
        const c = document.createElement('span')
        c.className = 'wd-caret'
        c.style.borderColor = p.color
        c.setAttribute('data-testid', 'wd-peer-caret')
        c.setAttribute('data-client', p.client)
        const label = document.createElement('span')
        label.className = 'wd-caret-label'
        label.style.background = p.color
        label.textContent = p.name
        label.dir = 'auto'
        c.appendChild(label)
        return c
      }, { side: 1, key: `peer-${p.client}-${p.name}-${p.color}`, ignoreSelection: true }))
    }
    return DecorationSet.create(doc, decos)
  }
  return new Plugin({
    key: peersKey,
    state: {
      init: () => ({ peers: [] as Peer[], set: DecorationSet.empty }),
      apply(tr, old, _o, st) {
        const next = tr.getMeta(peersKey) as Peer[] | undefined
        if (next) return { peers: next, set: build(st.doc, next) }
        if (!tr.docChanged) return old
        // Move them with the text until the next presence update arrives.
        const moved = old.peers.map((p) => ({ ...p, from: tr.mapping.map(p.from), to: tr.mapping.map(p.to) }))
        return { peers: moved, set: build(st.doc, moved) }
      },
    },
    props: { decorations: (st) => peersKey.getState(st)?.set },
  })
}

/** Find highlights. Set with `tr.setMeta(findKey, { ranges, current })`. */
export const findKey = new PluginKey<{ ranges: { from: number; to: number }[]; current: number; set: DecorationSet }>('find')
export function find(): Plugin {
  const build = (doc: EditorState['doc'], ranges: { from: number; to: number }[], current: number) =>
    DecorationSet.create(doc, ranges.map((r, i) => Decoration.inline(r.from, r.to, { class: i === current ? 'wd-find wd-find-current' : 'wd-find', 'data-testid': i === current ? 'wd-find-current' : 'wd-find-hit' })))
  return new Plugin({
    key: findKey,
    state: {
      init: () => ({ ranges: [] as { from: number; to: number }[], current: 0, set: DecorationSet.empty }),
      apply(tr, old) {
        const next = tr.getMeta(findKey) as { ranges: { from: number; to: number }[]; current: number } | undefined
        if (next) return { ...next, set: build(tr.doc, next.ranges, next.current) }
        if (!tr.docChanged) return old
        const ranges = old.ranges.map((r) => ({ from: tr.mapping.map(r.from), to: tr.mapping.map(r.to) })).filter((r) => r.to > r.from)
        return { ranges, current: Math.min(old.current, Math.max(0, ranges.length - 1)), set: old.set.map(tr.mapping, tr.doc) }
      },
    },
    props: { decorations: (st) => findKey.getState(st)?.set },
  })
}

/** "Start writing…" on an empty document. */
export function placeholder(text: () => string): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const d = state.doc
        if (d.childCount !== 1 || !d.firstChild!.isTextblock || d.firstChild!.content.size) return null
        return DecorationSet.create(d, [Decoration.node(0, d.firstChild!.nodeSize, { class: 'wd-empty', 'data-placeholder': text() })])
      },
    },
  })
}

/** Images: a corner handle to resize the selected one, keeping its proportions. */
export function imageView(view: EditorView, getPos: () => number | undefined, node: import('prosemirror-model').Node, editable: () => boolean) {
  const wrap = document.createElement('span')
  wrap.className = 'wd-img'
  wrap.setAttribute('data-testid', 'wd-image')
  const img = document.createElement('img')
  const handle = document.createElement('span')
  handle.className = 'wd-img-handle'
  handle.setAttribute('data-testid', 'wd-image-handle')
  wrap.append(img, handle)
  let cur = node
  const paint = () => {
    img.src = cur.attrs.src
    img.alt = cur.attrs.alt || ''
    if (cur.attrs.title) img.title = cur.attrs.title
    img.style.width = cur.attrs.width ? `${cur.attrs.width}px` : ''
    wrap.setAttribute('data-width', String(cur.attrs.width || ''))
    if (cur.attrs.float) wrap.setAttribute('data-float', cur.attrs.float); else wrap.removeAttribute('data-float')
  }
  paint()
  handle.addEventListener('pointerdown', (e) => {
    if (!editable()) return
    e.preventDefault()
    e.stopPropagation()
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startW = img.getBoundingClientRect().width / (zoomOf(wrap) || 1)
    const rtl = getComputedStyle(wrap).direction === 'rtl'
    const max = (wrap.closest('.ProseMirror') as HTMLElement | null)?.clientWidth || 2000
    let w = startW
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) * (rtl ? -1 : 1) / (zoomOf(wrap) || 1)
      w = Math.round(Math.max(24, Math.min(max, startW + dx)))
      img.style.width = `${w}px`
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      const pos = getPos()
      if (pos == null) return
      const n = view.state.doc.nodeAt(pos)
      if (!n) return
      const ratio = n.attrs.width && n.attrs.height ? n.attrs.height / n.attrs.width : img.naturalHeight / (img.naturalWidth || 1)
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...n.attrs, width: w, height: Math.round(w * ratio) }))
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
  })
  return {
    dom: wrap,
    update(n: import('prosemirror-model').Node) { if (n.type !== cur.type) return false; cur = n; paint(); return true },
    selectNode() { wrap.classList.add('wd-img-selected') },
    deselectNode() { wrap.classList.remove('wd-img-selected') },
    stopEvent(e: Event) { return e.target === handle },
    ignoreMutation() { return true },
  }
}
function zoomOf(el: HTMLElement): number {
  const z = (el.closest('[data-zoom]') as HTMLElement | null)?.dataset.zoom
  return z ? +z : 1
}

export const corePlugins = () => [history(), dropCursor({ color: '#0b6e4f' }), gapCursor(), columnResizing(), tableEditing()]
