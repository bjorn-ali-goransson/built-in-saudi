// Editor state: the shape document, current tool, selection, viewport (for
// pan/zoom) and an undo/redo history. Drag interactions mutate live without
// recording, then call `record(before)` once on release so one gesture = one undo.
import { useCallback, useRef, useState } from 'react'
import type { Shape, Fill } from './model'

export type Tool = 'select' | 'pan' | 'rect' | 'ellipse' | 'line' | 'path' | 'text'
export type Doc = { shapes: Shape[]; width: number; height: number }
export type View = { x: number; y: number; w: number; h: number }

const MAX_HISTORY = 100

export function useEditor(initial: Doc) {
  const [doc, setDoc] = useState<Doc>(initial)
  const [tool, setTool] = useState<Tool>('select')
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, w: initial.width, h: initial.height })
  const past = useRef<Doc[]>([])
  const future = useRef<Doc[]>([])
  const [, forceHistory] = useState(0)

  const record = useCallback((before: Doc) => {
    past.current.push(before)
    if (past.current.length > MAX_HISTORY) past.current.shift()
    future.current = []
    forceHistory((n) => n + 1)
  }, [])

  // Live mutation without a history entry (used during drags).
  const set = useCallback((next: Doc | ((d: Doc) => Doc)) => setDoc(next), [])

  // Mutate + record in one step (used for discrete actions like delete, restyle).
  const commit = useCallback((next: (d: Doc) => Doc) => {
    setDoc((d) => { record(d); return next(d) })
  }, [record])

  const add = useCallback((s: Shape) => {
    commit((d) => ({ ...d, shapes: [...d.shapes, s] }))
    setSelected(s.id)
  }, [commit])

  const update = useCallback((id: string, patch: Partial<Shape>) => {
    commit((d) => ({ ...d, shapes: d.shapes.map((s) => (s.id === id ? ({ ...s, ...patch } as Shape) : s)) }))
  }, [commit])

  const restyle = useCallback((id: string, patch: Partial<Fill>) => update(id, patch as Partial<Shape>), [update])

  const remove = useCallback((id: string) => {
    commit((d) => ({ ...d, shapes: d.shapes.filter((s) => s.id !== id) }))
    setSelected((cur) => (cur === id ? null : cur))
  }, [commit])

  const reorder = useCallback((id: string, dir: 'up' | 'down' | 'top' | 'bottom') => {
    commit((d) => {
      const i = d.shapes.findIndex((s) => s.id === id)
      if (i < 0) return d
      const arr = d.shapes.slice()
      const [s] = arr.splice(i, 1)
      const j = dir === 'up' ? Math.min(arr.length, i + 1) : dir === 'down' ? Math.max(0, i - 1) : dir === 'top' ? arr.length : 0
      arr.splice(j, 0, s)
      return { ...d, shapes: arr }
    })
  }, [commit])

  const resize = useCallback((w: number, h: number) => commit((d) => ({ ...d, width: w, height: h })), [commit])

  const load = useCallback((next: Doc) => {
    setDoc((d) => { record(d); return next })
    setSelected(null)
    setView({ x: 0, y: 0, w: next.width, h: next.height })
  }, [record])

  const undo = useCallback(() => {
    if (!past.current.length) return
    setDoc((cur) => { future.current.push(cur); return past.current.pop() as Doc })
    setSelected(null)
    forceHistory((n) => n + 1)
  }, [])

  const redo = useCallback(() => {
    if (!future.current.length) return
    setDoc((cur) => { past.current.push(cur); return future.current.pop() as Doc })
    setSelected(null)
    forceHistory((n) => n + 1)
  }, [])

  const selectedShape = doc.shapes.find((s) => s.id === selected) || null

  return {
    doc, set, record, tool, setTool, selected, setSelected, selectedShape,
    view, setView, add, update, restyle, remove, reorder, resize, load, undo, redo,
    canUndo: past.current.length > 0, canRedo: future.current.length > 0,
  }
}
export type Editor = ReturnType<typeof useEditor>
