// The editor that sits ON the slide while a box's text is being typed. It is
// drawn in the slide's own coordinates, inside the same scaled layer as the
// renderer, with the same insets, sizes and fonts — so text does not jump when
// editing starts or stops, which is the first thing people notice about a
// slide editor that gets it wrong.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { EditorState, Plugin, TextSelection, type Transaction } from 'prosemirror-state'
import { EditorView, Decoration, DecorationSet, type NodeView } from 'prosemirror-view'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, splitBlockAs, chainCommands, exitCode } from 'prosemirror-commands'
import { history, undo, redo } from 'prosemirror-history'
import type { Node } from 'prosemirror-model'
import { slideSchema, toPM, fromPM, toggle, shiftLevel } from './textEdit'
import { runSize, fontName, bulletLabel } from './look'
import { paint, type Para, type TextBody, type Theme } from './model'

export interface TextEditorApi { view: EditorView; body: () => TextBody }

const S = slideSchema

export function TextEditor({ body, theme, rect, onChange, onDone, onReady, onSelection, autoFocus = true, placeAt, typed }: {
  body: TextBody
  theme: Theme
  /** Where the text area is, in slide units, relative to the element. */
  rect: { x: number; y: number; w: number; h: number }
  onChange: (b: TextBody) => void
  onDone: (b: TextBody) => void
  onReady?: (api: TextEditorApi | null) => void
  onSelection?: () => void
  autoFocus?: boolean
  /** Put the caret here (client coordinates) — where the double-click was. */
  placeAt?: { x: number; y: number } | null
  /** Typed over the selected box before the editor existed; lands at the caret. */
  typed?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const base = useRef(body)
  const cb = useRef({ onChange, onDone, onSelection })
  cb.current = { onChange, onDone, onSelection }

  useLayoutEffect(() => {
    const b = base.current
    const defSize = (p: Para) => runSize(undefined, { ...p, runs: [] } as Para, b)
    const paraView = (node: Node): NodeView => {
      const dom = document.createElement('p')
      const paint2 = (n: Node) => {
        const a = n.attrs
        const p: Para = { runs: [], level: a.level, bullet: a.bullet, size: a.size }
        const size = defSize(p)
        const hang = a.bullet ? size * 1.15 : 0
        dom.dir = a.rtl ? 'rtl' : 'auto'
        dom.style.cssText = [
          'margin:0', `margin-inline-start:${a.level * 28 + hang}px`, `text-indent:${-hang}px`,
          `text-align:${a.align === 'ctr' ? 'center' : a.align === 'r' ? 'end' : a.align === 'just' ? 'justify' : (b.defaults?.align === 'ctr' ? 'center' : b.defaults?.align === 'r' ? 'end' : 'start')}`,
          `line-height:${a.lineSpacing ? (a.lineSpacing / 100) * 1.2 : 1.2}`, `padding-top:${a.spaceBefore || 0}px`, `padding-bottom:${a.spaceAfter || 0}px`,
          `font-size:${size}px`, `min-height:${size * 1.2}px`,
        ].join(';')
      }
      paint2(node)
      return { dom, contentDOM: dom, update(n) { if (n.type !== node.type) return false; paint2(n); return true } }
    }
    const bullets = new Plugin({
      props: {
        decorations(state) {
          const decos: Decoration[] = []
          const counters: number[] = []
          state.doc.forEach((p, pos) => {
            const lvl = p.attrs.level || 0
            if (p.attrs.bullet === 'number') { counters[lvl] = (counters[lvl] || 0) + 1; counters.length = lvl + 1 } else counters.length = lvl
            if (!p.attrs.bullet) return
            const label = bulletLabel({ runs: [], bullet: p.attrs.bullet, char: p.attrs.char, scheme: p.attrs.scheme, start: p.attrs.start, level: lvl }, counters[lvl] || 1, !!p.attrs.rtl)
            const size = defSize({ runs: [], level: lvl, size: p.attrs.size })
            decos.push(Decoration.widget(pos + 1, () => {
              const s = document.createElement('span')
              s.textContent = label
              s.contentEditable = 'false'
              s.style.cssText = `display:inline-block;width:${size * 1.15}px;text-indent:0;user-select:none`
              return s
            }, { side: -1, key: `b${pos}-${label}`, ignoreSelection: true }))
          })
          return DecorationSet.create(state.doc, decos)
        },
      },
    })
    const tsView = (mark: import('prosemirror-model').Mark) => {
      const dom = document.createElement('span')
      const a = mark.attrs
      if (a.color) dom.style.color = paint(a.color, theme)
      if (a.highlight) dom.style.background = paint(a.highlight, theme)
      if (a.size) dom.style.fontSize = `${a.size}px`
      if (a.font) dom.style.fontFamily = `"${fontName(a.font, b, theme)}", "IBM Plex Sans Arabic", sans-serif`
      return { dom }
    }
    const done = () => { cb.current.onDone(fromPM(view.state.doc, base.current)); return true }
    const state = EditorState.create({
      doc: toPM(b),
      plugins: [
        history(),
        keymap({
          'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo,
          'Mod-b': toggle('b'), 'Mod-i': toggle('i'), 'Mod-u': toggle('u'),
          Tab: shiftLevel(1), 'Shift-Tab': shiftLevel(-1),
          Enter: splitBlockAs((n) => ({ type: n.type, attrs: n.attrs })),
          'Shift-Enter': chainCommands(exitCode, (st, d) => { d?.(st.tr.replaceSelectionWith(S.nodes.br.create()).scrollIntoView()); return true }),
          Escape: done,
        }),
        keymap(baseKeymap),
        bullets,
      ],
    })
    const view = new EditorView(host.current!, {
      state,
      attributes: { 'data-testid': 'sl-text-editor', spellcheck: 'true', class: 'sl-pm' },
      nodeViews: { para: (n) => paraView(n) },
      markViews: { ts: (m) => tsView(m) },
      dispatchTransaction(tr: Transaction) {
        view.updateState(view.state.apply(tr))
        if (tr.docChanged) cb.current.onChange(fromPM(view.state.doc, base.current))
        cb.current.onSelection?.()
      },
      handleDOMEvents: {
        // A click inside the box is editing, not a click on the canvas underneath.
        pointerdown: (_v, e) => { e.stopPropagation(); return false },
      },
    })
    viewRef.current = view
    onReady?.({ view, body: () => fromPM(view.state.doc, base.current) })
    if (autoFocus) {
      view.focus()
      const at = placeAt ? view.posAtCoords({ left: placeAt.x, top: placeAt.y }) : null
      const sel = at ? TextSelection.near(view.state.doc.resolve(at.pos)) : TextSelection.atEnd(view.state.doc)
      view.dispatch(view.state.tr.setSelection(sel))
      if (typed) view.dispatch(view.state.tr.insertText(typed))
    }
    return () => { onReady?.(null); view.destroy(); viewRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving by clicking elsewhere is a finish too — the commonest way to stop typing.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const v = viewRef.current
      if (!v || host.current?.contains(e.target as globalThis.Node)) return
      if ((e.target as HTMLElement).closest?.('[data-ribbon], [data-keep-editing]')) return
      cb.current.onDone(fromPM(v.state.doc, base.current))
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [])

  const b = base.current
  const ins = b.inset || [7.2, 3.6, 7.2, 3.6]
  return (
    <div
      data-keep-editing=""
      style={{
        position: 'absolute', left: rect.x, top: rect.y, width: rect.w, minHeight: rect.h,
        padding: `${ins[1]}px ${ins[2]}px ${ins[3]}px ${ins[0]}px`, display: 'flex', flexDirection: 'column',
        justifyContent: b.anchor === 'ctr' ? 'center' : b.anchor === 'b' ? 'flex-end' : 'flex-start',
        color: paint(b.defaults?.color || 'dk1', theme), fontFamily: `"${fontName(undefined, b, theme)}", "IBM Plex Sans Arabic", sans-serif`,
        fontWeight: b.defaults?.b ? 700 : 400, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', outline: '1.5px dashed #0b6e4f', outlineOffset: 2, cursor: 'text', zIndex: 5,
      }}
    >
      <div ref={host} className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[1em] [&_a]:underline [&_a]:text-[#0563c1]" />
    </div>
  )
}
