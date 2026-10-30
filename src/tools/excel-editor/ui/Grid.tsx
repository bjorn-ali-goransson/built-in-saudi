// The sheet on screen.
//
// One scroll container provides the scrollbars and nothing else: inside it a
// sticky viewport the size of the window is DRAWN from the scroll offsets — four
// panes (the frozen corner, the frozen top, the frozen side and the body), each
// clipped, each showing only the rows and columns that fit. That is how frozen
// panes, a million rows and variable sizes all work with a few hundred divs on
// the page at any moment.
//
// Positions are written with `insetInlineStart`, so a right-to-left sheet is the
// same code mirrored by CSS; pointer hit-testing measures from the inline-start
// edge for the same reason.
//
// Typing goes into one textarea that is always focused and sits on the active
// cell: invisible until a key is pressed, then it IS the in-cell editor. That is
// what makes IME composition, mobile keyboards and a paste with no selection all
// behave, where a keydown handler on a div gets none of them right.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Axis, DEFAULT_COL_W, DEFAULT_ROW_H, HEADER_H, HEADER_W, expandForMerges, inBox, normBox, jump, type Box } from './geometry'
import { cellLook, overflowHashes, scaleColor } from './cellStyle'
import { tableBoxes, tableLookAt } from './tableStyle'
import { RunsView } from './runs'
import { colToLetters, parseRange, cellKey, validRuns, chartAnchor, CHART_DEFAULT_SIZE, type Addr, type SheetData, type CellValue, isError } from '../engine/model'
import type { SheetModel } from '../doc'
import { ChartSvg } from './Chart'
import { readChart } from './chartData'

export interface Sel { a: Addr; f: Addr }
export interface EditState { r: number; c: number; text: string; mode: 'enter' | 'edit'; from: 'cell' | 'bar' }
export interface PeerSel { client: string; name: string; color: string; sel: Sel; sheet: string }

export interface GridCtl {
  select(a: Addr, f?: Addr): void
  /** False when the edit was refused (a locked cell on a protected sheet). */
  startEdit(text: string, mode: 'enter' | 'edit'): boolean | void
  setEditText(t: string): void
  commit(move: 'down' | 'up' | 'right' | 'left' | 'none', extend?: boolean): void
  cancel(): void
  clear(): void
  copy(e: ClipboardEvent, cut: boolean): void
  paste(e: ClipboardEvent): void
  fill(src: Box, target: Box): void
  resize(axis: 'row' | 'col', i: number, size: number): void
  autofit(axis: 'row' | 'col', i: number): void
  context(x: number, y: number): void
  setValue(r: number, c: number, value: string): void
  moveObject(kind: 'chart' | 'image', id: string, patch: { anchor?: { row: number; col: number }; size?: { w: number; h: number } }): void
  selectObject(o: { kind: 'chart' | 'image'; id: string } | null): void
  shortcut(e: KeyboardEvent): boolean
  openFilter(col: number, x: number, y: number): void
}

const MOVE: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

interface Props {
  model: SheetModel
  rev: number
  sheet: SheetData
  sel: Sel
  edit: EditState | null
  zoom: number
  showFormulas?: boolean
  readOnly?: boolean
  peers: PeerSel[]
  filterHidden?: Set<number>
  selectedObject: { kind: 'chart' | 'image'; id: string } | null
  ctl: GridCtl
  locale: string
  /** A focus request from outside (after the formula bar commits). */
  focusTick: number
  /** Copy marquee: the box last copied, dashed until something else happens. */
  marquee?: Box | null
  /** The auto-filter's header row, which carries a drop-down on each column. */
  filterRow?: { row: number; c0: number; c1: number; active: number[] }
}

export function Grid(p: Props) {
  const { model, sheet, sel, edit, zoom: z, ctl } = p
  const scrollRef = useRef<HTMLDivElement>(null)
  const keyRef = useRef<HTMLTextAreaElement>(null)
  const [view, setView] = useState({ w: 800, h: 500, sx: 0, sy: 0 })
  const [extra, setExtra] = useState({ rows: 0, cols: 0 })
  const rtl = !!sheet.rtl
  const name = sheet.name

  // ---- geometry ---------------------------------------------------------------
  const ext = model.engine.extent(name)
  const nRows = Math.min(1_048_576, Math.max(sheet.rows, ext.rows + 60, 200) + extra.rows)
  const nCols = Math.min(16_384, Math.max(sheet.cols, ext.cols + 8, 30) + extra.cols)
  const hiddenR = useMemo(() => new Set([...(sheet.hiddenRows || []), ...(p.filterHidden || [])]), [sheet.hiddenRows, p.filterHidden])
  const hiddenC = useMemo(() => new Set(sheet.hiddenCols || []), [sheet.hiddenCols])
  const rows = useMemo(() => new Axis(nRows, (i) => (hiddenR.has(i) ? 0 : (sheet.rowHeights?.[i] ?? DEFAULT_ROW_H) * z)), [nRows, hiddenR, sheet.rowHeights, z])
  const cols = useMemo(() => new Axis(nCols, (i) => (hiddenC.has(i) ? 0 : (sheet.colWidths?.[i] ?? DEFAULT_COL_W) * z)), [nCols, hiddenC, sheet.colWidths, z])
  const hW = HEADER_W * z
  const hH = HEADER_H * z
  const fr = Math.min(sheet.freeze?.rows || 0, nRows - 1)
  const fc = Math.min(sheet.freeze?.cols || 0, nCols - 1)
  const frozenH = rows.offset(fr)
  const frozenW = cols.offset(fc)
  const merges = useMemo(() => (sheet.merges || []).map((m) => parseRange(m)).filter((b): b is Box => !!b), [sheet.merges])
  const tables = useMemo(() => tableBoxes(sheet.tables, parseRange), [sheet.tables])
  const mergeOf = useCallback((r: number, c: number) => merges.find((m) => inBox(m, r, c)) || null, [merges])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setView((v) => ({ ...v, w: el.clientWidth, h: el.clientHeight })))
    ro.observe(el)
    setView((v) => ({ ...v, w: el.clientWidth, h: el.clientHeight }))
    return () => ro.disconnect()
  }, [])

  const onScroll = () => {
    const el = scrollRef.current!
    const sx = Math.abs(el.scrollLeft)
    const sy = el.scrollTop
    setView((v) => (v.sx === sx && v.sy === sy ? v : { ...v, sx, sy }))
    // Near the end: the sheet goes on, as a spreadsheet does.
    if (sy + el.clientHeight > el.scrollHeight - 400) setExtra((e) => ({ ...e, rows: e.rows + 200 }))
    if (sx + el.clientWidth > el.scrollWidth - 300) setExtra((e) => ({ ...e, cols: e.cols + 10 }))
  }

  // ---- coordinates ------------------------------------------------------------
  /** Pixel position of a cell's start within the viewport, honouring frozen panes. */
  const xOf = (c: number) => hW + (c < fc ? cols.offset(c) : cols.offset(c) - view.sx)
  const yOf = (r: number) => hH + (r < fr ? rows.offset(r) : rows.offset(r) - view.sy)
  const boxRect = (b: Box) => {
    const x0 = xOf(b.c0)
    const y0 = yOf(b.r0)
    return { x: x0, y: y0, w: cols.offset(b.c1 + 1) - cols.offset(b.c0), h: rows.offset(b.r1 + 1) - rows.offset(b.r0) }
  }
  /** The cell under a viewport point (inline-start based). */
  const cellAt = (x: number, y: number): Addr => {
    const bx = x - hW
    const by = y - hH
    const col = bx < frozenW ? cols.at(bx) : cols.at(bx + view.sx)
    const row = by < frozenH ? rows.at(by) : rows.at(by + view.sy)
    return { row: Math.max(0, row), col: Math.max(0, col) }
  }
  const localPoint = (clientX: number, clientY: number) => {
    const r = scrollRef.current!.getBoundingClientRect()
    return { x: rtl ? r.right - clientX : clientX - r.left, y: clientY - r.top }
  }

  // Keep the active cell in view.
  const scrollIntoView = useCallback((a: Addr) => {
    const el = scrollRef.current
    if (!el) return
    const bodyW = el.clientWidth - hW - frozenW
    const bodyH = el.clientHeight - hH - frozenH
    let sx = Math.abs(el.scrollLeft)
    let sy = el.scrollTop
    if (a.col >= fc) {
      const x0 = cols.offset(a.col) - frozenW
      const x1 = cols.offset(a.col + 1) - frozenW
      if (x0 < sx) sx = x0
      else if (x1 > sx + bodyW) sx = x1 - bodyW
    }
    if (a.row >= fr) {
      const y0 = rows.offset(a.row) - frozenH
      const y1 = rows.offset(a.row + 1) - frozenH
      if (y0 < sy) sy = y0
      else if (y1 > sy + bodyH) sy = y1 - bodyH
    }
    el.scrollTop = Math.max(0, sy)
    el.scrollLeft = rtl ? -Math.max(0, sx) : Math.max(0, sx)
  }, [cols, rows, fc, fr, frozenW, frozenH, hW, hH, rtl])

  useEffect(() => { scrollIntoView(sel.f) }, [sel.f.row, sel.f.col]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sel.a.row >= nRows - 30) setExtra((e) => ({ ...e, rows: e.rows + 200 })) }, [sel.a.row, nRows])

  // Focus stays on the key sink, so typing always lands in the sheet.
  useEffect(() => { if (!edit || edit.from === 'cell') keyRef.current?.focus({ preventScroll: true }) }, [p.focusTick, edit?.from, sheet.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- values -----------------------------------------------------------------
  const value = useCallback((r: number, c: number): CellValue => model.engine.value(name, { row: r, col: c }), [model, name, p.rev]) // eslint-disable-line react-hooks/exhaustive-deps
  const filled = useCallback((r: number, c: number) => { const cell = sheet.cells[cellKey(r, c)]; return !!cell && cell.input !== '' }, [sheet, p.rev]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Min/max for each colour scale, computed once per change. */
  const scaleStats = useMemo(() => (sheet.scales || []).map((s) => {
    let lo = Infinity
    let hi = -Infinity
    for (let r = s.box.r0; r <= Math.min(s.box.r1, s.box.r0 + 20000); r++) for (let c = s.box.c0; c <= s.box.c1; c++) {
      const v = value(r, c)
      if (typeof v === 'number') { lo = Math.min(lo, v); hi = Math.max(hi, v) }
    }
    return { ...s, lo, hi }
  }), [sheet.scales, value])

  // ---- pointer ----------------------------------------------------------------
  const drag = useRef<null | { kind: 'select' | 'fill' | 'col' | 'row' | 'colsel' | 'rowsel'; start: Addr; i?: number; origin?: number; size?: number; moved?: boolean }>(null)
  const [fillTarget, setFillTarget] = useState<Box | null>(null)
  const [resizeGhost, setResizeGhost] = useState<{ axis: 'row' | 'col'; at: number } | null>(null)
  const [listOpen, setListOpen] = useState(false)
  useEffect(() => setListOpen(false), [sel.a.row, sel.a.col])
  const selBox = useMemo(() => expandForMerges(normBox(sel.a, sel.f), merges), [sel, merges])
  const isFormulaEdit = !!edit && edit.text.startsWith('=')
  const pickRef = useRef<{ start: number; end: number; anchor: Addr } | null>(null)

  /** While typing a formula, a click on a cell writes its reference at the caret. */
  const canPick = () => {
    if (!isFormulaEdit || !edit) return false
    const ta = edit.from === 'bar' ? (document.querySelector('[data-testid="xl-formula-input"]') as HTMLTextAreaElement | null) : keyRef.current
    const pos = ta?.selectionStart ?? edit.text.length
    const before = edit.text.slice(0, pos).trimEnd()
    return pickRef.current !== null || /[=(,+\-*/^&<>:;%]$/.test(before)
  }
  const insertRef = (a: Addr, f: Addr) => {
    if (!edit) return
    const ta = edit.from === 'bar' ? (document.querySelector('[data-testid="xl-formula-input"]') as HTMLTextAreaElement | null) : keyRef.current
    const b = normBox(a, f)
    const ref = b.r0 === b.r1 && b.c0 === b.c1 ? `${colToLetters(b.c0)}${b.r0 + 1}` : `${colToLetters(b.c0)}${b.r0 + 1}:${colToLetters(b.c1)}${b.r1 + 1}`
    const prev = pickRef.current
    const start = prev ? prev.start : ta?.selectionStart ?? edit.text.length
    const end = prev ? prev.end : ta?.selectionEnd ?? edit.text.length
    const text = edit.text.slice(0, start) + ref + edit.text.slice(end)
    pickRef.current = { start, end: start + ref.length, anchor: a }
    ctl.setEditText(text)
    requestAnimationFrame(() => { if (ta) { ta.focus(); ta.setSelectionRange(start + ref.length, start + ref.length) } })
  }
  useEffect(() => { if (!edit) pickRef.current = null }, [edit])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) {
      const pt = localPoint(e.clientX, e.clientY)
      const a = cellAt(pt.x, pt.y)
      if (!inBox(selBox, a.row, a.col) && pt.x > hW && pt.y > hH) ctl.select(a)
      return
    }
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-grid-object]') || target.closest('[data-grid-ui]')) return
    const pt = localPoint(e.clientX, e.clientY)
    const touch = e.pointerType === 'touch'
    // Headers: select a whole row or column, or resize from the border.
    if (pt.y < hH && pt.x > hW) {
      const a = cellAt(pt.x, hH + 1)
      const edgeCol = nearEdge(pt.x, 'col')
      if (edgeCol !== null) {
        drag.current = { kind: 'col', start: a, i: edgeCol, origin: pt.x, size: cols.size(edgeCol) / z }
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        return
      }
      const f = { row: nRows - 1, col: a.col }
      if (e.shiftKey) ctl.select(sel.a.row === 0 ? sel.a : { row: 0, col: sel.a.col }, f)
      else ctl.select({ row: 0, col: a.col }, f)
      drag.current = { kind: 'colsel', start: { row: 0, col: a.col } }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      return
    }
    if (pt.x < hW && pt.y > hH) {
      const a = cellAt(hW + 1, pt.y)
      const edgeRow = nearEdge(pt.y, 'row')
      if (edgeRow !== null) {
        drag.current = { kind: 'row', start: a, i: edgeRow, origin: pt.y, size: rows.size(edgeRow) / z }
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        return
      }
      ctl.select({ row: a.row, col: 0 }, { row: a.row, col: nCols - 1 })
      drag.current = { kind: 'rowsel', start: { row: a.row, col: 0 } }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      return
    }
    if (pt.x < hW && pt.y < hH) { ctl.select({ row: 0, col: 0 }, { row: nRows - 1, col: nCols - 1 }); return }
    const a = cellAt(pt.x, pt.y)
    if (target.dataset.fillHandle) {
      drag.current = { kind: 'fill', start: a }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      e.preventDefault()
      return
    }
    if (canPick()) {
      e.preventDefault()
      insertRef(a, a)
      drag.current = { kind: 'select', start: a, moved: false }
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      return
    }
    if (edit) ctl.commit('none')
    if (e.shiftKey) ctl.select(sel.a, a)
    else ctl.select(a)
    if (!touch) {
      drag.current = { kind: 'select', start: e.shiftKey ? sel.a : a }
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    }
    if (!touch) e.preventDefault()
    keyRef.current?.focus({ preventScroll: true })
  }

  const nearEdge = (px: number, axis: 'row' | 'col'): number | null => {
    const ax = axis === 'col' ? cols : rows
    const base = axis === 'col' ? hW : hH
    const frozen = axis === 'col' ? frozenW : frozenH
    const scroll = axis === 'col' ? view.sx : view.sy
    const local = px - base
    const off = local < frozen ? local : local + scroll
    const i = ax.at(off)
    const end = ax.offset(i + 1)
    const startI = ax.offset(i)
    if (Math.abs(off - end) <= 4) return i
    if (Math.abs(off - startI) <= 4 && i > 0) return i - 1
    return null
  }

  const autoScroll = useRef<number>()
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const pt = localPoint(e.clientX, e.clientY)
    if (!d) {
      // Resize cursor over a header border.
      const el = scrollRef.current!
      const cur = (pt.y < hH && pt.x > hW && nearEdge(pt.x, 'col') !== null) ? 'col-resize' : (pt.x < hW && pt.y > hH && nearEdge(pt.y, 'row') !== null) ? 'row-resize' : ''
      if (el.style.cursor !== cur) el.style.cursor = cur
      return
    }
    if (d.kind === 'col' || d.kind === 'row') {
      const delta = ((d.kind === 'col' ? pt.x : pt.y) - d.origin!) / z
      setResizeGhost({ axis: d.kind, at: Math.max(4, d.size! + delta) })
      return
    }
    const a = cellAt(Math.max(hW + 1, pt.x), Math.max(hH + 1, pt.y))
    // Off the edge of the viewport: keep scrolling in that direction.
    const el = scrollRef.current!
    window.clearInterval(autoScroll.current)
    const dx = pt.x > el.clientWidth - 20 ? 20 : pt.x < hW ? -20 : 0
    const dy = pt.y > el.clientHeight - 20 ? 20 : pt.y < hH ? -20 : 0
    if (dx || dy) autoScroll.current = window.setInterval(() => { el.scrollTop += dy; el.scrollLeft += rtl ? -dx : dx }, 30)
    if (d.kind === 'select') {
      d.moved = true
      if (pickRef.current && edit) insertRef(pickRef.current.anchor, a)
      else ctl.select(d.start, a)
    } else if (d.kind === 'colsel') ctl.select(d.start, { row: nRows - 1, col: a.col })
    else if (d.kind === 'rowsel') ctl.select(d.start, { row: a.row, col: nCols - 1 })
    else if (d.kind === 'fill') {
      const b = selBox
      const down = a.row > b.r1 ? a.row - b.r1 : a.row < b.r0 ? a.row - b.r0 : 0
      const across = a.col > b.c1 ? a.col - b.c1 : a.col < b.c0 ? a.col - b.c0 : 0
      if (!down && !across) { setFillTarget(null); return }
      if (Math.abs(down) * rows.size(b.r1) >= Math.abs(across) * cols.size(b.c1)) setFillTarget(down > 0 ? { ...b, r1: a.row } : { ...b, r0: a.row })
      else setFillTarget(across > 0 ? { ...b, c1: a.col } : { ...b, c0: a.col })
    }
  }
  const onPointerUp = () => {
    window.clearInterval(autoScroll.current)
    const d = drag.current
    drag.current = null
    if (!d) return
    if ((d.kind === 'col' || d.kind === 'row') && resizeGhost) { ctl.resize(d.kind, d.i!, Math.round(resizeGhost.at)); setResizeGhost(null) }
    if (d.kind === 'fill' && fillTarget) { ctl.fill(selBox, fillTarget); ctl.select(sel.a, { row: fillTarget.r0 === selBox.r0 ? fillTarget.r1 : fillTarget.r0, col: fillTarget.c0 === selBox.c0 ? fillTarget.c1 : fillTarget.c0 }); setFillTarget(null) }
    if (d.kind === 'select' && pickRef.current) { /* keep the pick open for another drag */ }
  }
  const onDoubleClick = (e: React.MouseEvent) => {
    const pt = localPoint(e.clientX, e.clientY)
    if (pt.y < hH && pt.x > hW) { const i = nearEdge(pt.x, 'col'); if (i !== null) ctl.autofit('col', i); return }
    if (pt.x < hW && pt.y > hH) { const i = nearEdge(pt.y, 'row'); if (i !== null) ctl.autofit('row', i); return }
    if (pt.x < hW || pt.y < hH || p.readOnly) return
    const a = cellAt(pt.x, pt.y)
    const cell = sheet.cells[cellKey(a.row, a.col)]
    ctl.select(a)
    ctl.startEdit(cell?.input ?? '', 'edit')
  }

  // ---- keyboard ---------------------------------------------------------------
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ne = e.nativeEvent
    if (ne.isComposing) return
    if (edit && edit.from === 'cell') {
      if (e.key === 'Enter' && !e.altKey) { e.preventDefault(); ctl.commit(e.shiftKey ? 'up' : 'down'); return }
      if (e.key === 'Enter' && e.altKey) {
        e.preventDefault()
        const ta = e.currentTarget
        const s = ta.selectionStart
        ctl.setEditText(edit.text.slice(0, s) + '\n' + edit.text.slice(ta.selectionEnd))
        requestAnimationFrame(() => ta.setSelectionRange(s + 1, s + 1))
        return
      }
      if (e.key === 'Tab') { e.preventDefault(); ctl.commit(e.shiftKey ? 'left' : 'right'); return }
      if (e.key === 'Escape') { e.preventDefault(); ctl.cancel(); return }
      if (edit.mode === 'enter' && MOVE[e.key] && !canPick()) {
        e.preventDefault()
        const k = rtl && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') ? (e.key === 'ArrowLeft' ? 'right' : 'left') : ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as const)[e.key as 'ArrowUp']
        ctl.commit(k)
        return
      }
      if (edit.mode === 'enter' && MOVE[e.key] && canPick()) {
        // Arrow keys pick a reference while typing a formula, as in Excel.
        e.preventDefault()
        const [dr, dc0] = MOVE[e.key]
        const dc = rtl ? -dc0 : dc0
        const base = pickRef.current ? pickRef.current.anchor : sel.a
        const n = { row: Math.max(0, base.row + dr), col: Math.max(0, base.col + dc) }
        if (pickRef.current) pickRef.current = { ...pickRef.current, anchor: n }
        insertRef(n, n)
        return
      }
      if (e.key === 'F2') { e.preventDefault(); ctl.startEdit(edit.text, edit.mode === 'enter' ? 'edit' : 'enter'); return }
      pickRef.current = null
      return
    }
    if (ctl.shortcut(ne)) { e.preventDefault(); return }
    const mod = e.ctrlKey || e.metaKey
    if (MOVE[e.key]) {
      e.preventDefault()
      const [dr, dc0] = MOVE[e.key]
      const dc = rtl ? -dc0 : dc0
      const from = e.shiftKey ? sel.f : sel.a
      let next: Addr
      if (mod) next = jump(filled, from.row, from.col, dr, dc, nRows - 1, nCols - 1)
      else {
        next = { row: from.row + dr, col: from.col + dc }
        // Step over hidden lines and across a merge rather than into it.
        const m = mergeOf(from.row, from.col)
        if (m && !e.shiftKey) next = { row: dr > 0 ? m.r1 + 1 : dr < 0 ? m.r0 - 1 : from.row, col: dc > 0 ? m.c1 + 1 : dc < 0 ? m.c0 - 1 : from.col }
        while (next.row > 0 && next.row < nRows - 1 && hiddenR.has(next.row)) next.row += dr || 1
        while (next.col > 0 && next.col < nCols - 1 && hiddenC.has(next.col)) next.col += dc || 1
      }
      next = { row: Math.max(0, Math.min(nRows - 1, next.row)), col: Math.max(0, Math.min(nCols - 1, next.col)) }
      const mm = !e.shiftKey ? mergeOf(next.row, next.col) : null
      if (mm) next = { row: mm.r0, col: mm.c0 }
      if (e.shiftKey) ctl.select(sel.a, next)
      else ctl.select(next)
      return
    }
    if (e.key === 'Tab') { e.preventDefault(); const n = { row: sel.a.row, col: Math.max(0, sel.a.col + (e.shiftKey ? -1 : 1)) }; ctl.select(n); return }
    if (e.key === 'Enter') { e.preventDefault(); const n = { row: Math.max(0, sel.a.row + (e.shiftKey ? -1 : 1)), col: sel.a.col }; ctl.select(n); return }
    if (e.key === 'Home') { e.preventDefault(); const n = mod ? { row: 0, col: 0 } : { row: sel.a.row, col: 0 }; if (e.shiftKey) ctl.select(sel.a, n); else ctl.select(n); return }
    if (e.key === 'End' && mod) { e.preventDefault(); const n = { row: Math.max(0, ext.rows - 1), col: Math.max(0, ext.cols - 1) }; if (e.shiftKey) ctl.select(sel.a, n); else ctl.select(n); return }
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault()
      const page = Math.max(1, Math.floor((view.h - hH - frozenH) / (DEFAULT_ROW_H * z)) - 1)
      const n = { row: Math.max(0, Math.min(nRows - 1, sel.f.row + (e.key === 'PageDown' ? page : -page))), col: sel.f.col }
      if (e.shiftKey) ctl.select(sel.a, n); else ctl.select(n)
      return
    }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); ctl.select({ row: 0, col: 0 }, { row: nRows - 1, col: nCols - 1 }); return }
    if (e.key === ' ' && e.shiftKey && !mod) { e.preventDefault(); ctl.select({ row: sel.a.row, col: 0 }, { row: sel.f.row, col: nCols - 1 }); return }
    if (e.key === ' ' && mod && !e.shiftKey) { e.preventDefault(); ctl.select({ row: 0, col: sel.a.col }, { row: nRows - 1, col: sel.f.col }); return }
    if (p.readOnly) return
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); ctl.clear(); return }
    if (e.key === 'F2') { e.preventDefault(); ctl.startEdit(sheet.cells[cellKey(sel.a.row, sel.a.col)]?.input ?? '', 'edit'); return }
    // A printable key falls through to the textarea's input event.
  }
  const onInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget.value
    // A refused keystroke must not wait in the sink and land in the next cell somebody types in.
    if (!edit) { if (p.readOnly || ctl.startEdit(t, 'enter') === false) e.currentTarget.value = '' }
    else ctl.setEditText(t)
  }
  // Mirror the edit text into the sink when the formula bar or a ref pick changed it.
  useEffect(() => {
    const ta = keyRef.current
    if (!ta) return
    const want = edit && edit.from === 'cell' ? edit.text : ''
    if (ta.value !== want) ta.value = want
  }, [edit])

  useEffect(() => {
    const ta = keyRef.current
    if (!ta) return
    const copy = (e: ClipboardEvent) => { if (!edit) ctl.copy(e, false) }
    const cut = (e: ClipboardEvent) => { if (!edit && !p.readOnly) ctl.copy(e, true) }
    const paste = (e: ClipboardEvent) => { if (!edit && !p.readOnly) ctl.paste(e) }
    ta.addEventListener('copy', copy)
    ta.addEventListener('cut', cut)
    ta.addEventListener('paste', paste)
    return () => { ta.removeEventListener('copy', copy); ta.removeEventListener('cut', cut); ta.removeEventListener('paste', paste) }
  }, [ctl, edit, p.readOnly])

  // ---- drawing ----------------------------------------------------------------
  // Four panes, each clipped to its own rectangle; a merge that crosses a frozen
  // edge is drawn in both and the clipping makes it read as one cell.
  const vr0 = Math.max(fr, rows.at(view.sy + frozenH))
  const vr1 = Math.min(nRows - 1, rows.at(view.sy + frozenH + Math.max(0, view.h - hH - frozenH)) + 1)
  const vc0 = Math.max(fc, cols.at(view.sx + frozenW))
  const vc1 = Math.min(nCols - 1, cols.at(view.sx + frozenW + Math.max(0, view.w - hW - frozenW)) + 1)
  type PaneDef = { id: 'corner' | 'top' | 'left' | 'body'; r: [number, number]; c: [number, number]; x: number; y: number; w: number; h: number }
  const panes: PaneDef[] = ([
    { id: 'corner', r: [0, fr - 1], c: [0, fc - 1], x: hW, y: hH, w: frozenW, h: frozenH },
    { id: 'top', r: [0, fr - 1], c: [vc0, vc1], x: hW + frozenW, y: hH, w: view.w - hW - frozenW, h: frozenH },
    { id: 'left', r: [vr0, vr1], c: [0, fc - 1], x: hW, y: hH + frozenH, w: frozenW, h: view.h - hH - frozenH },
    { id: 'body', r: [vr0, vr1], c: [vc0, vc1], x: hW + frozenW, y: hH + frozenH, w: view.w - hW - frozenW, h: view.h - hH - frozenH },
  ] as PaneDef[]).filter((q) => q.w > 0 && q.h > 0 && q.r[1] >= q.r[0] && q.c[1] >= q.c[0])
  const paneOf = (r: number, c: number): PaneDef['id'] => (r < fr ? (c < fc ? 'corner' : 'top') : c < fc ? 'left' : 'body')

  const showGrid = sheet.showGrid !== false
  const gridLine = showGrid ? '1px solid color-mix(in srgb, var(--ink) 11%, transparent)' : undefined
  const lineColor = 'color-mix(in srgb, var(--ink) 9%, transparent)'

  const drawCell = (out: ReactNode[], r: number, c: number, box: Box | null) => {
    const rr = box ? box.r0 : r
    const cc = box ? box.c0 : c
    const x = xOf(cc)
    const y = yOf(rr)
    const w = box ? cols.offset(box.c1 + 1) - cols.offset(box.c0) : cols.size(c)
    const h = box ? rows.offset(box.r1 + 1) - rows.offset(box.r0) : rows.size(r)
    if (w <= 0 || h <= 0) return
    const cell = sheet.cells[cellKey(rr, cc)]
    const v = cell ? value(rr, cc) : ''
    const fmt = cell?.fmt
    const condBg = cell && (sheet.conds?.length || sheet.cond) ? model.engine.condFill(name, { row: rr, col: cc }) : undefined
    const look = cellLook(v, fmt, { zoom: z, showFormula: p.showFormulas && cell?.input.startsWith('=') ? cell.input : undefined, condBg })
    // A table's style sits under the cell's own formatting: a cell somebody filled keeps its fill.
    const tl = tables.length ? tableLookAt(tables, rr, cc) : null
    if (tl) {
      if (tl.bg && !look.style.background) look.style.background = tl.bg
      if (tl.color && !fmt?.color) look.style.color = tl.color
      if (tl.bold) look.style.fontWeight = 700
      if (tl.borderTop && !look.style.borderTop) look.style.borderTop = tl.borderTop
      if (tl.borderBottom && !look.style.borderBottom) look.style.borderBottom = tl.borderBottom
    }
    const runs = typeof v === 'string' && !p.showFormulas ? validRuns(fmt, look.text) : null
    let bg = look.style.background as string | undefined
    let bar: number | null = null
    for (const s of scaleStats) {
      if (!inBox(s.box, rr, cc) || typeof v !== 'number' || !Number.isFinite(s.lo)) continue
      const t = s.hi === s.lo ? 1 : (v - s.lo) / (s.hi - s.lo)
      if (s.kind === 'databar') bar = t
      else bg = scaleColor(t, s.kind === 'scale3')
    }
    if (!look.text && !bg && bar === null && !box && !fmt && !cell?.note && !tl) return
    let text = look.text
    let width = w
    const wrap = !!fmt?.wrap
    // A number that does not fit shows hashes; text runs on into empty neighbours.
    if (text && !wrap && !box) {
      const est = text.length * 7 * z * (fmt?.bold ? 1.08 : 1) * ((fmt?.fontSize || 10) / 10)
      if (look.isNumber && est > w + 2 && !p.showFormulas) text = overflowHashes(w, z)
      else if (!look.isNumber && est > w && look.align === 'start') {
        let k = c + 1
        while (k < Math.min(nCols, c + 12) && width < est && !filled(r, k) && !mergeOf(r, k)) { width += cols.size(k); k++ }
      }
    }
    const style: CSSProperties = {
      ...look.style,
      position: 'absolute',
      insetInlineStart: x,
      top: y,
      width,
      height: h,
      background: bg || (width > w || box ? 'var(--surface)' : undefined),
      borderBottom: look.style.borderBottom || gridLine,
      borderInlineEnd: look.style.borderInlineEnd || gridLine,
      display: 'flex',
      alignItems: fmt?.valign === 'top' ? 'flex-start' : fmt?.valign === 'middle' ? 'center' : 'flex-end',
      justifyContent: look.align === 'center' ? 'center' : look.align === 'end' ? 'flex-end' : 'flex-start',
      paddingInlineStart: look.style.paddingInlineStart ?? 3 * z,
      paddingInlineEnd: 3 * z,
      paddingBottom: fmt?.valign === 'top' || fmt?.valign === 'middle' ? undefined : 2 * z,
      overflow: 'hidden',
      whiteSpace: wrap ? 'pre-wrap' : 'pre',
      wordBreak: wrap ? 'break-word' : undefined,
      lineHeight: 1.25,
      zIndex: width > w || box ? 1 : undefined,
      boxSizing: 'border-box',
    }
    const link = cell?.link
    out.push(
      <div key={`${rr}:${cc}`} style={style} data-cell={`${colToLetters(cc)}${rr + 1}`} dir={typeof v === 'string' ? 'auto' : undefined} title={cell?.note || link || undefined}>
        {bar !== null && <span aria-hidden data-testid="xl-databar" style={{ position: 'absolute', insetInlineStart: 2, top: '20%', height: '60%', width: `${Math.max(2, bar * (w - 4))}px`, background: 'color-mix(in srgb, var(--color-green-600) 45%, transparent)', borderRadius: 2 }} />}
        <span style={{ position: 'relative', color: link ? 'var(--color-green-700)' : undefined, textDecoration: link ? 'underline' : undefined, transform: fmt?.rotate ? `rotate(${-(fmt.rotate > 90 ? 90 - fmt.rotate : fmt.rotate)}deg)` : undefined }}>{runs && text === look.text ? <RunsView runs={runs} zoom={z} /> : text}</span>
        {cell?.note && <span aria-hidden data-testid="xl-note-marker" style={{ position: 'absolute', top: 0, insetInlineEnd: 0, width: 0, height: 0, borderTop: `${6 * z}px solid var(--danger)`, borderInlineStart: `${6 * z}px solid transparent` }} />}
      </div>,
    )
  }

  const paneContent = (q: PaneDef): ReactNode[] => {
    const out: ReactNode[] = []
    if (showGrid) {
      for (let r = q.r[0]; r <= q.r[1]; r++) if (!hiddenR.has(r)) out.push(<div key={`hl${r}`} style={{ position: 'absolute', insetInlineStart: xOf(q.c[0]), width: cols.offset(q.c[1] + 1) - cols.offset(q.c[0]), top: yOf(r + 1) - 1, height: 1, background: lineColor }} />)
      for (let c = q.c[0]; c <= q.c[1]; c++) if (!hiddenC.has(c)) out.push(<div key={`vl${c}`} style={{ position: 'absolute', top: yOf(q.r[0]), height: rows.offset(q.r[1] + 1) - rows.offset(q.r[0]), insetInlineStart: xOf(c + 1) - 1, width: 1, background: lineColor }} />)
    }
    const seen = new Set<Box>()
    for (let r = q.r[0]; r <= q.r[1]; r++) {
      if (hiddenR.has(r)) continue
      for (let c = q.c[0]; c <= q.c[1]; c++) {
        if (hiddenC.has(c)) continue
        const m = mergeOf(r, c)
        if (m) { if (!seen.has(m)) { seen.add(m); drawCell(out, r, c, m) } continue }
        if (!sheet.cells[cellKey(r, c)] && !sheet.scales?.length && !(tables.length && tableLookAt(tables, r, c))) continue
        drawCell(out, r, c, null)
      }
    }
    // A merge whose top-left is above or before the pane still shows inside it.
    for (const m of merges) {
      if (seen.has(m)) continue
      if (m.r1 >= q.r[0] && m.r0 <= q.r[1] && m.c1 >= q.c[0] && m.c0 <= q.c[1]) drawCell(out, m.r0, m.c0, m)
    }
    return out
  }

  const selRect = boxRect(selBox)
  const active = mergeOf(sel.a.row, sel.a.col) || { r0: sel.a.row, c0: sel.a.col, r1: sel.a.row, c1: sel.a.col }
  const activeRect = boxRect(active)
  const multi = selBox.r0 !== selBox.r1 || selBox.c0 !== selBox.c1
  const editing = !!edit && edit.from === 'cell'
  const editLook = editing ? cellLook('', sheet.cells[cellKey(edit!.r, edit!.c)]?.fmt, { zoom: z }) : null
  const peers = p.peers.filter((x) => x.sheet === name)
  const selPane = paneOf(selBox.r1, selBox.c1)
  const actPane = paneOf(active.r0, active.c0)

  const overlays = (q: PaneDef): ReactNode[] => {
    const out: ReactNode[] = []
    const tid = (id: string, pane: string) => (pane === q.id ? id : undefined)
    if (multi) out.push(<div key="sel" data-testid={tid('xl-selection', paneOf(selBox.r0, selBox.c0))} style={{ position: 'absolute', insetInlineStart: selRect.x, top: selRect.y, width: selRect.w, height: selRect.h, background: 'color-mix(in srgb, var(--color-green-600) 12%, transparent)', border: '2px solid var(--color-green-600)', boxSizing: 'border-box', pointerEvents: 'none' }} />)
    out.push(<div key="act" data-testid={tid('xl-active', actPane)} data-cell={`${colToLetters(sel.a.col)}${sel.a.row + 1}`} style={{ position: 'absolute', insetInlineStart: activeRect.x, top: activeRect.y, width: activeRect.w, height: activeRect.h, border: multi ? '1px solid var(--color-green-700)' : '2px solid var(--color-green-700)', boxSizing: 'border-box', pointerEvents: 'none', background: multi ? 'color-mix(in srgb, var(--surface) 55%, transparent)' : undefined }} />)
    if (!p.readOnly && !edit) out.push(<div key="fill" data-fill-handle="1" data-testid={tid('xl-fill-handle', selPane)} style={{ position: 'absolute', insetInlineStart: selRect.x + selRect.w - 5, top: selRect.y + selRect.h - 5, width: 9, height: 9, background: 'var(--color-green-700)', border: '1.5px solid var(--surface)', cursor: 'crosshair', touchAction: 'none', zIndex: 5 }} />)
    if (fillTarget) { const f = boxRect(fillTarget); out.push(<div key="ft" data-testid={tid('xl-fill-target', paneOf(fillTarget.r0, fillTarget.c0))} style={{ position: 'absolute', insetInlineStart: f.x, top: f.y, width: f.w, height: f.h, border: '1.5px dashed var(--color-green-700)', pointerEvents: 'none' }} />) }
    if (p.marquee) { const m = boxRect(p.marquee); out.push(<div key="mq" data-testid={tid('xl-marquee', paneOf(p.marquee.r0, p.marquee.c0))} style={{ position: 'absolute', insetInlineStart: m.x, top: m.y, width: m.w, height: m.h, border: '2px dashed var(--color-green-600)', pointerEvents: 'none' }} />) }
    const fr0 = p.filterRow
    if (fr0) for (let c = Math.max(fr0.c0, q.c[0]); c <= Math.min(fr0.c1, q.c[1]); c++) {
      if (paneOf(fr0.row, c) !== q.id || hiddenC.has(c)) continue
      const h = rows.size(fr0.row)
      const on = fr0.active.includes(c)
      out.push(
        <button key={'f' + c} type="button" data-grid-ui="1" data-testid="xl-filter-btn" data-col={colToLetters(c)} data-active={on ? '1' : '0'} aria-label="Filter"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); ctl.openFilter(c, r.left, r.bottom + 2) }}
          style={{ position: 'absolute', insetInlineStart: xOf(c + 1) - Math.min(18, h) * 1 - 2, top: yOf(fr0.row) + 2, width: Math.min(18, h - 4), height: Math.min(18, h - 4), zIndex: 6, fontSize: 9, lineHeight: 1, padding: 0, cursor: 'pointer', borderRadius: 3, border: '1px solid var(--line)', background: on ? 'var(--color-green-600)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink-soft)' }}>{on ? '⏷' : '▾'}</button>,
      )
    }
    for (const pe of peers) {
      const pb = expandForMerges(normBox(pe.sel.a, pe.sel.f), merges)
      const b = boxRect(pb)
      out.push(
        <div key={'p' + pe.client} data-testid={tid('xl-peer', paneOf(pb.r0, pb.c0))} data-peer={pe.name} style={{ position: 'absolute', insetInlineStart: b.x, top: b.y, width: b.w, height: b.h, border: `2px solid ${pe.color}`, background: `color-mix(in srgb, ${pe.color} 10%, transparent)`, pointerEvents: 'none' }}>
          <span style={{ position: 'absolute', top: 0, insetInlineStart: 0, background: pe.color, color: '#fff', fontSize: 10, padding: '0 4px', whiteSpace: 'nowrap', transform: 'translateY(-100%)' }}>{pe.name}</span>
        </div>,
      )
    }
    return out
  }

  // Objects: charts and pictures float over the body, anchored to a cell.
  const objects: ReactNode[] = []
  for (const ch of sheet.charts || []) {
    const an = chartAnchor(ch)
    const size = ch.size || CHART_DEFAULT_SIZE
    objects.push(
      <FloatingObject key={'c' + ch.id} kind="chart" id={ch.id} x={xOf(an.col)} y={yOf(an.row)} w={size.w} h={size.h} zoom={z}
        selected={p.selectedObject?.kind === 'chart' && p.selectedObject.id === ch.id} ctl={ctl} cellAt={cellAt} localPoint={localPoint} readOnly={p.readOnly}>
        <ChartSvg spec={ch} data={readChart(ch, name, (sh, r, c) => model.engine.value(sh, { row: r, col: c }))} w={size.w} h={size.h} locale={p.locale} />
      </FloatingObject>,
    )
  }
  for (const img of sheet.images || []) {
    objects.push(
      <FloatingObject key={'i' + img.id} kind="image" id={img.id} x={xOf(img.anchor.col) + (img.anchor.dx || 0) * z} y={yOf(img.anchor.row) + (img.anchor.dy || 0) * z} w={img.size.w} h={img.size.h} zoom={z}
        selected={p.selectedObject?.kind === 'image' && p.selectedObject.id === img.id} ctl={ctl} cellAt={cellAt} localPoint={localPoint} readOnly={p.readOnly}>
        <img src={img.src} alt={img.alt || ''} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
      </FloatingObject>,
    )
  }

  // Headers, in two clips per strip so the frozen part does not scroll.
  const headerCls = (on: boolean) => `grid place-items-center border-e border-b border-[color:var(--line-soft)] select-none ${on ? 'bg-[color-mix(in_srgb,var(--color-green-600)_18%,var(--surface))] text-green-700 font-semibold' : 'bg-[var(--sand-50)] text-ink-soft'}`
  const colHeaders = (c0: number, c1: number) => {
    const out: ReactNode[] = []
    for (let c = c0; c <= c1; c++) { const w = cols.size(c); if (w > 0) out.push(<div key={c} data-col-header={colToLetters(c)} style={{ position: 'absolute', insetInlineStart: xOf(c), top: 0, width: w, height: hH, fontSize: 11 * z }} className={headerCls(c >= selBox.c0 && c <= selBox.c1)}>{colToLetters(c)}</div>) }
    return out
  }
  const rowHeaders = (r0: number, r1: number) => {
    const out: ReactNode[] = []
    for (let r = r0; r <= r1; r++) { const h = rows.size(r); if (h > 0) out.push(<div key={r} data-row-header={r + 1} style={{ position: 'absolute', insetInlineStart: 0, top: yOf(r), width: hW, height: h, fontSize: 11 * z }} className={headerCls(r >= selBox.r0 && r <= selBox.r1)}>{r + 1}</div>) }
    return out
  }

  const validation = (sheet.validations || []).find((v) => v.kind === 'list' && v.range.split(/\s+/).some((rg) => { const b = parseRange(rg); return b && inBox(b, sel.a.row, sel.a.col) }))
  const listOptions = validation ? (validation.list?.length ? validation.list : listFromSource(validation.source, (r, c) => value(r, c))) : []

  return (
    <div
      ref={scrollRef}
      dir={rtl ? 'rtl' : 'ltr'}
      onScroll={onScroll}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => { e.preventDefault(); ctl.context(e.clientX, e.clientY) }}
      data-testid="xl-grid"
      data-rtl={rtl ? '1' : '0'}
      className="relative flex-1 min-h-0 overflow-auto bg-[var(--surface)] outline-none [touch-action:pan-x_pan-y]"
    >
      <div style={{ width: hW + cols.total, height: hH + rows.total, position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, insetInlineStart: 0, width: view.w, height: view.h, overflow: 'hidden', fontFamily: 'var(--font-body)', color: 'var(--ink)' }} className="rtl:font-ar">
          {panes.map((q) => (
            <Clip key={q.id} x={q.x} y={q.y} w={q.w} h={q.h} testid={`xl-pane-${q.id}`}>
              <Shift dx={-q.x} dy={-q.y}>
                {paneContent(q)}
                {overlays(q)}
                {q.id === 'body' && objects}
              </Shift>
            </Clip>
          ))}
          {fr > 0 && <div style={{ position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, top: hH + frozenH - 1, height: 2, background: 'color-mix(in srgb, var(--ink) 35%, transparent)', zIndex: 4, pointerEvents: 'none' }} />}
          {fc > 0 && <div style={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: hW + frozenW - 1, width: 2, background: 'color-mix(in srgb, var(--ink) 35%, transparent)', zIndex: 4, pointerEvents: 'none' }} />}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
            {fc > 0 && <Clip x={hW} y={0} w={frozenW} h={hH}><Shift dx={-hW} dy={0}>{colHeaders(0, fc - 1)}</Shift></Clip>}
            <Clip x={hW + frozenW} y={0} w={view.w - hW - frozenW} h={hH}><Shift dx={-hW - frozenW} dy={0}>{colHeaders(vc0, vc1)}</Shift></Clip>
            {fr > 0 && <Clip x={0} y={hH} w={hW} h={frozenH}><Shift dx={0} dy={-hH}>{rowHeaders(0, fr - 1)}</Shift></Clip>}
            <Clip x={0} y={hH + frozenH} w={hW} h={view.h - hH - frozenH}><Shift dx={0} dy={-hH - frozenH}>{rowHeaders(vr0, vr1)}</Shift></Clip>
            <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, width: hW, height: hH }} className="bg-[var(--sand-50)] border-e border-b border-[color:var(--line-soft)]" />
            {resizeGhost && drag.current?.i !== undefined && <div data-testid="xl-resize-ghost" style={resizeGhost.axis === 'col'
              ? { position: 'absolute', top: 0, bottom: 0, width: 1, insetInlineStart: xOf(drag.current.i) + resizeGhost.at * z, background: 'var(--color-green-700)' }
              : { position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, height: 1, top: yOf(drag.current.i) + resizeGhost.at * z, background: 'var(--color-green-700)' }} />}
          </div>
          <textarea
            ref={keyRef}
            data-testid="xl-cell-input"
            aria-label="Cell"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            dir="auto"
            onKeyDown={onKeyDown}
            onInput={onInput}
            onBlur={(e) => {
              // Clicking away commits, as every spreadsheet does.
              const to = e.relatedTarget as HTMLElement | null
              if (editing && !to?.closest('[data-testid="xl-formula-input"]') && !to?.closest('[data-grid-ui]') && !to?.closest('[data-testid="ribbon"]')) ctl.commit('none')
            }}
            style={editing ? {
              position: 'absolute', insetInlineStart: activeRect.x, top: activeRect.y, minWidth: activeRect.w,
              width: Math.max(activeRect.w, Math.min(Math.max(activeRect.w, view.w - activeRect.x - 4), (edit!.text.split('\n').reduce((m, l) => Math.max(m, l.length), 0) + 2) * 7.5 * z)),
              minHeight: activeRect.h, height: Math.max(activeRect.h, edit!.text.split('\n').length * 18 * z + 4), zIndex: 7, resize: 'none',
              ...(editLook?.style || {}), border: '2px solid var(--color-green-700)', background: 'var(--surface)', padding: `${1 * z}px ${3 * z}px`, outline: 'none',
              boxShadow: 'var(--shadow-md)', whiteSpace: 'pre', overflow: 'hidden', lineHeight: 1.3, boxSizing: 'border-box', color: 'var(--ink)',
            } : { position: 'absolute', insetInlineStart: activeRect.x, top: activeRect.y, width: 2, height: 2, opacity: 0, padding: 0, border: 0, resize: 'none', zIndex: 0, caretColor: 'transparent', pointerEvents: 'none' }}
          />
          {validation && !edit && !p.readOnly && (
            <div data-grid-ui="1" style={{ position: 'absolute', insetInlineStart: activeRect.x + activeRect.w + 1, top: activeRect.y, zIndex: 8 }}>
              <button type="button" data-testid="xl-validation-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setListOpen((o) => !o)} className="grid place-items-center size-5 border border-[color:var(--line)] bg-[var(--surface)] rounded-sm text-[10px] cursor-pointer">▾</button>
              {listOpen && (
                <div data-testid="xl-validation-list" className="absolute top-6 min-w-[140px] max-h-[220px] overflow-auto rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)] py-1" style={{ insetInlineEnd: 0 }}>
                  {listOptions.map((o) => <button key={o} type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => { ctl.setValue(sel.a.row, sel.a.col, o); setListOpen(false); keyRef.current?.focus() }} className="block w-full text-start px-2 py-1 text-[0.85rem] border-0 bg-transparent cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]" dir="auto">{o}</button>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function listFromSource(src: string | undefined, value: (r: number, c: number) => CellValue): string[] {
  if (!src) return []
  const b = parseRange(src.replace(/^=/, '').replace(/\$/g, '').replace(/^.*!/, ''))
  if (!b) return src.replace(/^"|"$/g, '').split(',').map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  for (let r = b.r0; r <= Math.min(b.r1, b.r0 + 500); r++) for (let c = b.c0; c <= b.c1; c++) {
    const v = value(r, c)
    if (v !== '' && !isError(v)) out.push(String(v))
  }
  return out
}

function Clip({ x, y, w, h, z, children, testid }: { x: number; y: number; w: number; h: number; z?: number; children: ReactNode; testid?: string }) {
  return <div data-testid={testid} style={{ position: 'absolute', insetInlineStart: x, top: y, width: Math.max(0, w), height: Math.max(0, h), overflow: 'hidden', zIndex: z }}>{children}</div>
}
function Shift({ dx, dy, children }: { dx: number; dy: number; children: ReactNode }) {
  return <div style={{ position: 'absolute', insetInlineStart: dx, top: dy, width: 0, height: 0 }}>{children}</div>
}

function FloatingObject({ kind, id, x, y, w, h, selected, ctl, cellAt, localPoint, zoom, children, readOnly }: {
  kind: 'chart' | 'image'; id: string; x: number; y: number; w: number; h: number; selected: boolean; ctl: GridCtl
  cellAt: (x: number, y: number) => Addr; localPoint: (cx: number, cy: number) => { x: number; y: number }; zoom: number; children: ReactNode; readOnly?: boolean
}) {
  // w/h are the object's own size; on screen it is that times the zoom.
  const [ghost, setGhost] = useState<{ dx: number; dy: number; w: number; h: number } | null>(null)
  const start = useRef<{ x: number; y: number; mode: 'move' | 'size' } | null>(null)
  const down = (e: React.PointerEvent, mode: 'move' | 'size') => {
    e.stopPropagation()
    ctl.selectObject({ kind, id })
    if (readOnly) return
    const pt = localPoint(e.clientX, e.clientY)
    start.current = { x: pt.x, y: pt.y, mode }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    e.stopPropagation()
    const pt = localPoint(e.clientX, e.clientY)
    const dx = pt.x - s.x
    const dy = pt.y - s.y
    setGhost(s.mode === 'move' ? { dx, dy, w, h } : { dx: 0, dy: 0, w: Math.max(60, w + dx / zoom), h: Math.max(40, h + dy / zoom) })
  }
  const up = (e: React.PointerEvent) => {
    const s = start.current
    start.current = null
    e.stopPropagation()
    if (!s || !ghost) { setGhost(null); return }
    if (s.mode === 'move') { const a = cellAt(x + ghost.dx + 1, y + ghost.dy + 1); ctl.moveObject(kind, id, { anchor: { row: a.row, col: a.col } }) }
    else ctl.moveObject(kind, id, { size: { w: Math.round(ghost.w), h: Math.round(ghost.h) } })
    setGhost(null)
  }
  const g = ghost || { dx: 0, dy: 0, w, h }
  return (
    <div
      data-grid-object={kind}
      data-testid={`xl-${kind}`}
      data-id={id}
      data-selected={selected ? '1' : '0'}
      onPointerDown={(e) => down(e, 'move')}
      onPointerMove={move}
      onPointerUp={up}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{ position: 'absolute', insetInlineStart: x + g.dx, top: y + g.dy, width: g.w * zoom, height: g.h * zoom, zIndex: 4, cursor: readOnly ? 'default' : 'move', outline: selected ? '2px solid var(--color-green-600)' : '1px solid var(--line-soft)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', touchAction: 'none', overflow: 'hidden' }}
    >
      <div style={{ pointerEvents: 'none', width: kind === 'chart' ? w : '100%', height: kind === 'chart' ? h : '100%', transform: kind === 'chart' ? `scale(${(g.w * zoom) / w}, ${(g.h * zoom) / h})` : undefined, transformOrigin: '0 0' }}>{children}</div>
      {selected && !readOnly && <div data-testid={`xl-${kind}-resize`} onPointerDown={(e) => down(e, 'size')} style={{ position: 'absolute', insetInlineEnd: 0, bottom: 0, width: 14, height: 14, background: 'var(--color-green-600)', cursor: 'nwse-resize', touchAction: 'none' }} />}
    </div>
  )
}
