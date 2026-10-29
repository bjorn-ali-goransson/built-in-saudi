// The spreadsheet editor. One SheetModel holds the workbook; every change is an
// XOp sent through the SeqDoc, which applies it here and — in a live session —
// routes it through the owner so every browser applies the same edits in the
// same order. Undo is by inverse op, so it takes back MY change and leaves a
// colleague's alone.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { EditorShell, LossDialog } from '../../components/office/EditorShell'
import { usePersistence, useCollab } from '../../components/office/hooks'
import type { EditorProps } from '../../components/office/OfficeApp'
import { RItem } from '../../components/office/Ribbon'
import { OFFICE_STR } from '../../components/office/strings'
import { SeqDoc } from '../../lib/collab/seqDoc'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { SheetModel, blankSheet, MAX_FMT_BOX, type XOp, type CellPatch } from './doc'
import { XL_STR } from './strings'
import { Grid, type Sel, type EditState, type GridCtl, type PeerSel } from './ui/Grid'
import { XlRibbon, type XlActions } from './ui/XlRibbon'
import { FindBar } from './ui/FindBar'
import { LinkDialog, NoteDialog, ValidationDialog, NamesDialog, CondDialog, FormatDialog, SizeDialog, FunctionDialog, SplitDialog, RenameSheetDialog, FilterMenu } from './ui/Dialogs'
import { normBox, expandForMerges, boxArea, inBox, DEFAULT_COL_W, DEFAULT_ROW_H, type Box } from './ui/geometry'
import { toTsv, toHtml, parseTsv, readPayload, parseHtmlTable, pastePatches, textPayload, type ClipPayload } from './ui/clipboard'
import {
  borderPatches, mergeOps, currentRegion, hasHeader, sortPatches, autosumFor, autosumBelow, fillPatches, fillSelection,
  findAll, replaceIn, dedupePatches, splitPatches, fitWidth, selectionStats, freeSheetName, clampToUsed, boxRef, usedIn, type Match, type FindOpts,
} from './actions'
import { cellLook } from './ui/cellStyle'
import { cellKey, parseRange, isError, type CellFormat, type ChartKind, type ChartSpec, type SheetData, type WorkbookData, type Addr } from './engine/model'
import { stepDecimals, shownDecimals, DEFAULT_DECIMALS, type NumFmtId } from './engine/numfmt'
import { distinctValues, hiddenRows as filterHiddenRows, withFilter, type SheetFilters } from './engine/filter'
import { randomId } from '../../lib/p2p/mesh'
import { colorFor } from '../../lib/collab/session'

type Undo = { ops: XOp[]; inv: XOp[]; sheet: string; sel: Sel }
type Dialog =
  | { k: 'link' } | { k: 'note' } | { k: 'validation' } | { k: 'names' } | { k: 'cond' } | { k: 'format' }
  | { k: 'size'; axis: 'row' | 'col' } | { k: 'fn' } | { k: 'split' } | { k: 'rename'; sheet: string } | null

const ONE: Sel = { a: { row: 0, col: 0 }, f: { row: 0, col: 0 } }

export default function ExcelEditor({ locale, kit, doc, joinRoom, onBack, onSaveCopy, importLoss }: EditorProps<WorkbookData>) {
  const s = XL_STR[locale]
  const guest = !!joinRoom
  const model = useMemo(() => new SheetModel(JSON.parse(JSON.stringify(doc?.data || kit.blank())) as WorkbookData), []) // eslint-disable-line react-hooks/exhaustive-deps
  const seq = useMemo(() => new SeqDoc<XOp>(model, !guest), [model, guest])
  const rev = useSyncExternalStore(useCallback((f) => model.subscribe(f), [model]), () => model.rev)
  const [title, setTitle] = useState(doc?.title || '')
  const [titleRev, setTitleRev] = useState(0)
  const [active, setActive] = useState(() => Math.min(model.book.active || 0, model.book.sheets.length - 1))
  const sheet: SheetData = model.book.sheets[Math.min(active, model.book.sheets.length - 1)] || model.book.sheets[0]
  const name = sheet.name
  const [sels, setSels] = useState<Record<string, Sel>>({})
  const sel = sels[name] || ONE
  const [edit, setEdit] = useState<EditState | null>(null)
  const [tab, setTab] = useState('home')
  const [zoom, setZoom] = useState(1)
  const [showFormulas, setShowFormulas] = useState(false)
  const [obj, setObj] = useState<{ kind: 'chart' | 'image'; id: string } | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [loss, setLoss] = useState<{ items: string[]; dir: 'import' | 'export' } | null>(importLoss?.length ? { items: importLoss, dir: 'import' } : null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState('')
  const [focusTick, setFocusTick] = useState(0)
  const [find, setFind] = useState<{ replace: boolean } | null>(null)
  const [matches, setMatches] = useState<{ list: Match[]; i: number; q: string; o: FindOpts; msg?: string }>({ list: [], i: 0, q: '', o: {} })
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [tabMenu, setTabMenu] = useState<{ sheet: string; x: number; y: number } | null>(null)
  const [filters, setFilters] = useState<Record<string, SheetFilters>>({})
  const [filterMenu, setFilterMenu] = useState<{ col: number; x: number; y: number } | null>(null)
  const clip = useRef<{ payload: ClipPayload; box: Box; sheet: string; cut: boolean } | null>(null)
  const [marquee, setMarquee] = useState<{ box: Box; sheet: string } | null>(null)
  const undo = useRef<Undo[]>([])
  const redo = useRef<Undo[]>([])
  const [, bump] = useState(0)
  const pictureInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)

  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 3500) }

  // ---- collaboration ----------------------------------------------------------
  const collab = useCollab({ adapter: seq, kind: 'excel', title: title || s.templates.budget, onMeta: (m) => { if (m.title) setTitle(m.title) } })
  useEffect(() => { if (joinRoom) collab.join(joinRoom) }, [joinRoom]) // eslint-disable-line react-hooks/exhaustive-deps
  const readOnly = !collab.canEdit
  // If a remote edit renamed or removed the sheet we are on, follow it.
  useEffect(() => { if (active >= model.book.sheets.length) setActive(model.book.sheets.length - 1) }, [rev, active, model])
  useEffect(() => { collab.sendPresence({ sheet: name, a: sel.a, f: sel.f }) }, [name, sel, collab.state]) // eslint-disable-line react-hooks/exhaustive-deps
  const peers: PeerSel[] = useMemo(() => Object.entries(collab.presence).flatMap(([client, p]) => {
    const d = p.d as { sheet?: string; a?: Addr; f?: Addr }
    const m = collab.roster.find((x) => x.client === client)
    if (!d?.sheet || !d.a || !d.f || client === collab.me) return []
    return [{ client, name: m?.name || '…', color: m?.color || colorFor(client), sheet: d.sheet, sel: { a: d.a, f: d.f } }]
  }), [collab.presence, collab.roster, collab.me])

  // ---- persistence ------------------------------------------------------------
  const stored = useMemo(() => (doc ? { ...doc, title } : null), [doc, title])
  const getData = useCallback(() => ({ ...model.book, active }), [model, active])
  const persist = usePersistence({ doc: stored, kit, getData, rev: rev + titleRev * 1e9, disabled: guest, onLoss: (l) => setLoss({ items: l, dir: 'export' }) })

  // ---- edits ------------------------------------------------------------------
  const run = useCallback((ops: XOp[], keepRedo = false): XOp[] | null => {
    if (readOnly) return null
    const inv: XOp[] = []
    let any = false
    for (const op of ops) {
      let back: XOp | null = null
      try { back = model.inverse(op) } catch { back = null }
      if (seq.edit(op)) { any = true; if (back) inv.push(back) }
    }
    if (!any) return null
    if (!keepRedo) redo.current = []
    bump((x) => x + 1)
    return inv
  }, [model, seq, readOnly])

  const dispatch = useCallback((ops: XOp | XOp[]) => {
    const list = Array.isArray(ops) ? ops : [ops]
    const inv = run(list)
    if (inv) { undo.current.push({ ops: list, inv, sheet: name, sel }); if (undo.current.length > 300) undo.current.shift() }
    setMarquee(null)
    return !!inv
  }, [run, name, sel])

  const doUndo = useCallback(() => {
    const e = undo.current.pop()
    if (!e) return
    run([...e.inv].reverse(), true)
    redo.current.push(e)
    jumpTo(e.sheet, e.sel)
    bump((x) => x + 1)
  }, [run]) // eslint-disable-line react-hooks/exhaustive-deps
  const doRedo = useCallback(() => {
    const e = redo.current.pop()
    if (!e) return
    const inv = run(e.ops, true)
    if (inv) undo.current.push({ ...e, inv })
    jumpTo(e.sheet, e.sel)
    bump((x) => x + 1)
  }, [run]) // eslint-disable-line react-hooks/exhaustive-deps

  const jumpTo = (sheetName: string, to: Sel) => {
    const i = model.book.sheets.findIndex((x) => x.name === sheetName)
    if (i >= 0) setActive(i)
    setSels((m) => ({ ...m, [sheetName]: to }))
  }

  // ---- selection --------------------------------------------------------------
  const merges = useMemo(() => (sheet.merges || []).map((m) => parseRange(m)).filter((b): b is Box => !!b), [sheet.merges])
  const selBox = useMemo(() => expandForMerges(normBox(sel.a, sel.f), merges), [sel, merges])
  const used = model.engine.extent(name)
  const workBox = clampToUsed(selBox, { rows: Math.max(used.rows, selBox.r0 + 1), cols: Math.max(used.cols, selBox.c0 + 1) })
  const activeCell = sheet.cells[cellKey(sel.a.row, sel.a.col)]
  const fmt: CellFormat = activeCell?.fmt || {}
  const value = useCallback((r: number, c: number) => model.engine.value(name, { row: r, col: c }), [model, name, rev]) // eslint-disable-line react-hooks/exhaustive-deps
  const filled = (r: number, c: number) => { const x = sheet.cells[cellKey(r, c)]; return !!x && x.input !== '' }
  const region = () => (boxArea(selBox) > 1 ? workBox : currentRegion(filled, sel.a.row, sel.a.col, Math.max(used.rows + 1, 10), Math.max(used.cols + 1, 10)))

  const select = useCallback((a: Addr, f?: Addr) => {
    setSels((m) => ({ ...m, [name]: { a, f: f || a } }))
    setObj(null)
  }, [name])

  // ---- editing a cell -----------------------------------------------------------
  const startEdit = (text: string, mode: 'enter' | 'edit', from: 'cell' | 'bar' = 'cell') => {
    if (readOnly) return
    const m = merges.find((b) => inBox(b, sel.a.row, sel.a.col))
    setEdit({ r: m ? m.r0 : sel.a.row, c: m ? m.c0 : sel.a.col, text, mode, from })
  }
  const commit = (move: 'down' | 'up' | 'right' | 'left' | 'none', extend = false) => {
    const e = edit
    if (!e) return
    let text = e.text
    if (text.startsWith('=')) {
      const open = (text.match(/\(/g) || []).length - (text.match(/\)/g) || []).length
      if (open > 0) text += ')'.repeat(open)
    }
    const prev = sheet.cells[cellKey(e.r, e.c)]?.input ?? ''
    setEdit(null)
    if (extend && boxArea(selBox) > 1) dispatch({ k: 'cells', sheet: name, cells: fillSelection(text, { row: e.r, col: e.c }, workBox) })
    else if (text !== prev) dispatch({ k: 'cells', sheet: name, cells: [{ r: e.r, c: e.c, input: text }] })
    const d = { down: [1, 0], up: [-1, 0], right: [0, 1], left: [0, -1], none: [0, 0] }[move]
    if (move !== 'none') {
      const m = merges.find((b) => inBox(b, e.r, e.c))
      const r = d[0] > 0 && m ? m.r1 + 1 : e.r + d[0]
      const c = d[1] > 0 && m ? m.c1 + 1 : e.c + d[1]
      select({ row: Math.max(0, r), col: Math.max(0, c) })
    }
    setFocusTick((t) => t + 1)
  }
  const cancel = () => { setEdit(null); setFocusTick((t) => t + 1) }

  // ---- formatting -----------------------------------------------------------------
  const fmtBox = (patch: Partial<Record<keyof CellFormat, unknown>>) => {
    const b = workBox
    if (boxArea(b) > MAX_FMT_BOX) { say(s.tooBig); return }
    dispatch({ k: 'fmt', sheet: name, box: b, patch: patch as CellFormat })
  }
  const toggle = (key: 'bold' | 'italic' | 'underline' | 'strike' | 'wrap') => fmtBox({ [key]: fmt[key] ? undefined : true })

  // ---- clipboard ------------------------------------------------------------------
  const makePayload = (b: Box): { payload: ClipPayload; rows: string[][] } => {
    const cells: ClipPayload['cells'] = []
    const rows: string[][] = []
    for (let r = b.r0; r <= b.r1; r++) {
      const row: string[] = []
      for (let c = b.c0; c <= b.c1; c++) {
        const cell = sheet.cells[cellKey(r, c)]
        row.push(cell ? cellLook(value(r, c), cell.fmt, { zoom: 1 }).text : '')
        if (cell) cells.push({ r: r - b.r0, c: c - b.c0, input: cell.input, fmt: cell.fmt })
      }
      rows.push(row)
    }
    return { payload: { v: 1, rows: b.r1 - b.r0 + 1, cols: b.c1 - b.c0 + 1, cells, o: [b.r0, b.c0] }, rows }
  }
  const doCopy = (cut: boolean, e?: ClipboardEvent) => {
    const b = workBox
    if (boxArea(b) > 2_000_000) { say(s.tooBig); return }
    const { payload, rows } = makePayload(b)
    if (cut) payload.cut = { sheet: name }
    const text = toTsv(rows)
    const html = toHtml(rows, payload)
    if (e?.clipboardData) {
      e.preventDefault()
      e.clipboardData.setData('text/plain', text)
      e.clipboardData.setData('text/html', html)
    } else {
      try {
        const CI = (window as unknown as { ClipboardItem?: new (d: Record<string, Blob>) => unknown }).ClipboardItem
        if (CI && navigator.clipboard?.write) void navigator.clipboard.write([new CI({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) }) as ClipboardItem]).catch(() => navigator.clipboard?.writeText(text))
        else void navigator.clipboard?.writeText(text)
      } catch { /* the internal clipboard still has it */ }
    }
    clip.current = { payload, box: b, sheet: name, cut }
    setMarquee({ box: b, sheet: name })
  }
  const applyPaste = (payload: ClipPayload, mode?: 'values' | 'formats') => {
    if (readOnly) return
    const target = boxArea(selBox) > 1 ? { rows: workBox.r1 - workBox.r0 + 1, cols: workBox.c1 - workBox.c0 + 1 } : undefined
    const patches = pastePatches(payload, { row: selBox.r0, col: selBox.c0 }, target, {
      valuesOnly: mode === 'values', formatsOnly: mode === 'formats',
      values: (c) => { const src = clip.current; if (!src || !payload.o) return c.input; const v = model.engine.value(src.sheet, { row: payload.o[0] + c.r, col: payload.o[1] + c.c }); return isError(v) ? v.kind : String(v ?? '') },
    })
    const ops: XOp[] = []
    const cut = payload.cut && clip.current?.cut ? clip.current : null
    if (cut) {
      // A cut MOVES: clear the source first (except where the paste lands on it).
      const land = new Set(patches.map((p) => `${p.r},${p.c}`))
      const clear: CellPatch[] = []
      for (const [r, c] of usedIn(model.sheet(cut.sheet), cut.box)) if (cut.sheet !== name || !land.has(`${r},${c}`)) clear.push({ r, c, input: '', fmt: null, note: null, link: null })
      if (clear.length) ops.push({ k: 'cells', sheet: cut.sheet, cells: clear })
      clip.current = null
    }
    ops.push({ k: 'cells', sheet: name, cells: patches })
    dispatch(ops)
    const last = patches.reduce((m, p) => ({ r: Math.max(m.r, p.r), c: Math.max(m.c, p.c) }), { r: selBox.r0, c: selBox.c0 })
    select({ row: selBox.r0, col: selBox.c0 }, { row: last.r, col: last.c })
  }
  const onPasteEvent = (e: ClipboardEvent) => {
    e.preventDefault()
    const html = e.clipboardData?.getData('text/html') || ''
    const text = e.clipboardData?.getData('text/plain') || ''
    const ours = readPayload(html)
    if (ours) { applyPaste(ours); return }
    // An image pasted from a screenshot tool becomes a picture on the sheet.
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'))
    if (file && !text) { void insertPicture(file); return }
    const rows = parseHtmlTable(html) || (text ? parseTsv(text) : null)
    if (rows) applyPaste(textPayload(rows))
  }
  const pasteButton = async (mode?: 'values' | 'formats') => {
    try {
      const items = await navigator.clipboard.read()
      for (const it of items) {
        if (it.types.includes('text/html')) {
          const html = await (await it.getType('text/html')).text()
          const ours = readPayload(html)
          if (ours) { applyPaste(ours, mode); return }
          const rows = parseHtmlTable(html)
          if (rows) { applyPaste(textPayload(rows), mode); return }
        }
        if (it.types.includes('text/plain')) { applyPaste(textPayload(parseTsv(await (await it.getType('text/plain')).text())), mode); return }
      }
    } catch {
      if (clip.current) { applyPaste(clip.current.payload, mode); return }
      say(s.pasteNoAccess)
    }
  }

  // ---- pictures ---------------------------------------------------------------------
  const insertPicture = async (file: File) => {
    const bmp = await decodeImage(file)
    if (!bmp) { say(await whyUnreadable(file, locale)); return }
    const max = 1600
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k)
    c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const src = c.toDataURL(/png/i.test(file.type) ? 'image/png' : 'image/jpeg', 0.88)
    const w = Math.min(400, c.width)
    const img = { id: randomId(8), src, anchor: { row: sel.a.row, col: sel.a.col }, size: { w, h: Math.round(c.height * (w / c.width)) }, alt: file.name.replace(/\.[^.]+$/, '') }
    dispatch({ k: 'props', sheet: name, patch: { images: [...(sheet.images || []), img] } })
    setObj({ kind: 'image', id: img.id })
    setTab('picture')
  }

  // ---- find -------------------------------------------------------------------------
  const display = (sh: string, r: number, c: number) => {
    const cell = model.sheet(sh).cells[cellKey(r, c)]
    return cell ? cellLook(model.engine.value(sh, { row: r, col: c }), cell.fmt, { zoom: 1 }).text : ''
  }
  const search = (q: string, o: FindOpts) => {
    const list = findAll(model.book, name, q, { ...o, formulas: true }, display).concat()
    // Values and formulas both, without listing a cell twice.
    const seen = new Set<string>()
    const merged = [...list, ...findAll(model.book, name, q, o, display)].filter((m) => { const k = `${m.sheet}!${m.r},${m.c}`; if (seen.has(k)) return false; seen.add(k); return true })
    merged.sort((x, y) => (x.sheet === y.sheet ? x.r - y.r || x.c - y.c : model.book.sheets.findIndex((s2) => s2.name === x.sheet) - model.book.sheets.findIndex((s2) => s2.name === y.sheet)))
    setMatches({ list: merged, i: 0, q, o })
    if (merged[0]) jumpTo(merged[0].sheet, { a: { row: merged[0].r, col: merged[0].c }, f: { row: merged[0].r, col: merged[0].c } })
  }
  const step = (d: 1 | -1) => {
    setMatches((m) => {
      if (!m.list.length) return m
      const i = (m.i + d + m.list.length) % m.list.length
      const x = m.list[i]
      jumpTo(x.sheet, { a: { row: x.r, col: x.c }, f: { row: x.r, col: x.c } })
      return { ...m, i }
    })
  }
  const replaceOne = (w: string) => {
    const m = matches.list[matches.i]
    if (!m) return
    const input = model.sheet(m.sheet).cells[cellKey(m.r, m.c)]?.input ?? ''
    const next = replaceIn(input, matches.q, w, matches.o)
    if (next !== input) dispatch({ k: 'cells', sheet: m.sheet, cells: [{ r: m.r, c: m.c, input: next }] })
    search(matches.q, matches.o)
  }
  const replaceAll = (w: string) => {
    const by = new Map<string, CellPatch[]>()
    let n = 0
    for (const m of matches.list) {
      const input = model.sheet(m.sheet).cells[cellKey(m.r, m.c)]?.input ?? ''
      const next = replaceIn(input, matches.q, w, matches.o)
      if (next === input) continue
      n++
      if (!by.has(m.sheet)) by.set(m.sheet, [])
      by.get(m.sheet)!.push({ r: m.r, c: m.c, input: next })
    }
    if (n) dispatch([...by].map(([sh, cells]) => ({ k: 'cells', sheet: sh, cells }) as XOp))
    setMatches({ list: [], i: 0, q: matches.q, o: matches.o, msg: s.replacedN(n) })
  }

  // ---- filters ------------------------------------------------------------------------
  const af = sheet.autoFilter ? parseRange(sheet.autoFilter) : null
  const sheetFilters = filters[name] || []
  const hiddenByFilter = useMemo(() => (af && sheetFilters.length ? filterHiddenRows(sheet, sheetFilters, (r, c) => value(r, c), af.r0 + 1) : undefined), [af?.r0, sheetFilters, sheet, value]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the ribbon's actions -----------------------------------------------------------
  const act: XlActions = {
    cut: () => doCopy(true),
    copy: () => doCopy(false),
    paste: (mode) => void pasteButton(mode),
    fmt: fmtBox,
    toggle,
    border: (p) => dispatch({ k: 'cells', sheet: name, cells: borderPatches(sheet, workBox, p) }),
    merge: (on) => { const ops = mergeOps(sheet, workBox, on); if (ops.length) { if (on && [...usedIn(sheet, workBox)].length > 1) say(s.mergeLoses); dispatch(ops) } },
    numFmt: (id) => fmtBox({ numFmt: id === 'general' ? undefined : id, numCode: undefined, currency: id === 'currency' ? fmt.currency || 'SAR' : undefined, decimals: DEFAULT_DECIMALS[id as NumFmtId] }),
    decimals: (d) => {
      const r = stepDecimals(fmt.numFmt as NumFmtId | undefined, fmt.decimals, d, shownDecimals(value(sel.a.row, sel.a.col)))
      fmtBox({ decimals: r.decimals, numFmt: r.numFmt, numCode: undefined })
    },
    customFormat: () => setDialog({ k: 'format' }),
    indent: (d) => fmtBox({ indent: Math.max(0, Math.min(15, (fmt.indent || 0) + d)) || undefined }),
    insert: (axis, where) => {
      const at = axis === 'row' ? (where === 'before' ? selBox.r0 : selBox.r1 + 1) : where === 'before' ? selBox.c0 : selBox.c1 + 1
      const n = axis === 'row' ? Math.min(1000, selBox.r1 - selBox.r0 + 1) : Math.min(200, selBox.c1 - selBox.c0 + 1)
      dispatch({ k: 'struct', sheet: name, axis, at, delta: n })
    },
    remove: (axis) => {
      const at = axis === 'row' ? selBox.r0 : selBox.c0
      const n = axis === 'row' ? Math.min(workBox.r1, used.rows) - selBox.r0 + 1 : Math.min(workBox.c1, used.cols) - selBox.c0 + 1
      dispatch({ k: 'struct', sheet: name, axis, at, delta: -Math.max(1, n) })
      select({ row: axis === 'row' ? at : sel.a.row, col: axis === 'col' ? at : sel.a.col })
    },
    hide: (axis) => {
      const key = axis === 'row' ? 'hiddenRows' : 'hiddenCols'
      const set = new Set(sheet[key] || [])
      const [lo, hi] = axis === 'row' ? [selBox.r0, Math.min(workBox.r1, selBox.r0 + 5000)] : [selBox.c0, Math.min(workBox.c1, selBox.c0 + 500)]
      for (let i = lo; i <= hi; i++) set.add(i)
      dispatch({ k: 'props', sheet: name, patch: { [key]: [...set].sort((a, b) => a - b) } })
    },
    unhide: (axis) => {
      const key = axis === 'row' ? 'hiddenRows' : 'hiddenCols'
      const [lo, hi] = axis === 'row' ? [selBox.r0, selBox.r1] : [selBox.c0, selBox.c1]
      const all = lo === hi
      dispatch({ k: 'props', sheet: name, patch: { [key]: all ? [] : (sheet[key] || []).filter((i) => i < lo || i > hi) } })
    },
    size: (axis) => setDialog({ k: 'size', axis }),
    clear: (what) => dispatch({ k: 'clear', sheet: name, box: workBox, what }),
    autosum: (fn) => {
      if (fn?.startsWith('=')) { startEdit(fn + '(', 'enter'); setFocusTick((t) => t + 1); return }
      if (boxArea(selBox) > 1) { dispatch({ k: 'cells', sheet: name, cells: autosumBelow(workBox).map((p) => ({ ...p, input: fn ? p.input!.replace('SUM', fn) : p.input })) }); return }
      const f = autosumFor((r, c) => value(r, c), sel.a.row, sel.a.col)
      if (f) dispatch({ k: 'cells', sheet: name, cells: [{ r: sel.a.row, c: sel.a.col, input: fn ? f.replace('SUM', fn) : f }] })
      else startEdit(`=${fn || 'SUM'}(`, 'enter')
    },
    sort: (dir) => {
      const reg = af && inBox(af, sel.a.row, sel.a.col) ? af : region()
      const header = af && reg === af ? true : hasHeader((r, c) => value(r, c), reg)
      const p = sortPatches(sheet, reg, sel.a.col, dir, (r, c) => value(r, c), header)
      if (p.length) dispatch({ k: 'cells', sheet: name, cells: p })
    },
    filter: () => {
      if (af) { dispatch({ k: 'props', sheet: name, patch: { autoFilter: null as unknown as undefined } }); setFilters((f) => ({ ...f, [name]: [] })); return }
      const reg = region()
      dispatch({ k: 'props', sheet: name, patch: { autoFilter: boxRef(reg) } })
    },
    clearFilters: () => setFilters((f) => ({ ...f, [name]: [] })),
    find: (rep) => setFind({ replace: !!rep }),
    chart: (kind: ChartKind) => {
      const reg = boxArea(selBox) > 1 ? workBox : region()
      const spec: ChartSpec = { id: randomId(8), kind, range: boxRef(reg), anchor: { row: reg.r0, col: reg.c1 + 2 }, size: { w: 440, h: 270 } }
      dispatch({ k: 'props', sheet: name, patch: { charts: [...(sheet.charts || []), spec] } })
      setObj({ kind: 'chart', id: spec.id })
      setTab('chart')
    },
    picture: () => pictureInput.current?.click(),
    link: () => setDialog({ k: 'link' }),
    note: () => setDialog({ k: 'note' }),
    insertFunction: () => setDialog({ k: 'fn' }),
    validation: () => setDialog({ k: 'validation' }),
    dedupe: () => {
      const reg = region()
      const { patches, removed } = dedupePatches(sheet, reg, (r, c) => value(r, c), hasHeader((r, c) => value(r, c), reg))
      if (removed) dispatch({ k: 'cells', sheet: name, cells: patches })
      say(removed ? s.dupesRemoved(removed) : s.dupesNone)
    },
    names: () => setDialog({ k: 'names' }),
    cond: () => setDialog({ k: 'cond' }),
    split: () => setDialog({ k: 'split' }),
    freeze: (mode) => dispatch({ k: 'props', sheet: name, patch: { freeze: mode === 'none' ? (null as unknown as undefined) : mode === 'top' ? { rows: 1, cols: 0 } : mode === 'first' ? { rows: 0, cols: 1 } : { rows: sel.a.row, cols: sel.a.col } } }),
    gridlines: () => dispatch({ k: 'props', sheet: name, patch: { showGrid: sheet.showGrid === false ? (null as unknown as undefined) : false } }),
    showFormulas: () => setShowFormulas((v) => !v),
    zoom: setZoom,
    rtl: () => dispatch({ k: 'props', sheet: name, patch: { rtl: sheet.rtl ? (null as unknown as undefined) : true } }),
    chartPatch: (p) => { if (obj?.kind !== 'chart') return; dispatch({ k: 'props', sheet: name, patch: { charts: (sheet.charts || []).map((c) => (c.id === obj.id ? { ...c, ...p } : c)) } }) },
    chartDelete: () => { if (obj?.kind !== 'chart') return; dispatch({ k: 'props', sheet: name, patch: { charts: (sheet.charts || []).filter((c) => c.id !== obj.id) } }); setObj(null) },
    picturePatch: (p) => { if (obj?.kind !== 'image') return; dispatch({ k: 'props', sheet: name, patch: { images: (sheet.images || []).map((c) => (c.id === obj.id ? { ...c, ...p } : c)) } }) },
    pictureDelete: () => { if (obj?.kind !== 'image') return; dispatch({ k: 'props', sheet: name, patch: { images: (sheet.images || []).filter((c) => c.id !== obj.id) } }); setObj(null) },
    print: () => printSheet(sheet, (r, c) => display(name, r, c), title || s.templates.budget),
  }

  const measure = useMemo(() => {
    const c = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
    return (t: string, f?: CellFormat) => { if (!c) return t.length * 7; c.font = `${f?.bold ? 700 : 400} ${((f?.fontSize || 10) * 4) / 3}px "IBM Plex Sans Arabic", sans-serif`; return c.measureText(t).width }
  }, [])

  // ---- the grid's controller -------------------------------------------------------------
  const ctl: GridCtl = {
    select,
    startEdit: (t, mode) => startEdit(t, mode),
    setEditText: (t) => setEdit((e) => (e ? { ...e, text: t } : e)),
    commit,
    cancel,
    clear: () => dispatch({ k: 'clear', sheet: name, box: workBox, what: 'contents' }),
    copy: (e, cut) => doCopy(cut, e),
    paste: onPasteEvent,
    fill: (src, target) => dispatch({ k: 'cells', sheet: name, cells: fillPatches(sheet, src, target) }),
    resize: (axis, i, size) => {
      const [lo, hi] = axis === 'col' && selBox.c0 <= i && selBox.c1 >= i && selBox.r1 - selBox.r0 > 1000 ? [selBox.c0, selBox.c1] : axis === 'row' && selBox.r0 <= i && selBox.r1 >= i && selBox.c1 - selBox.c0 > 100 ? [selBox.r0, selBox.r1] : [i, i]
      const key = axis === 'col' ? 'colWidths' : 'rowHeights'
      const map = { ...(sheet[key] || {}) }
      for (let k = lo; k <= Math.min(hi, lo + 500); k++) map[k] = size
      dispatch({ k: 'props', sheet: name, patch: { [key]: map } })
    },
    autofit: (axis, i) => {
      if (axis === 'row') { const map = { ...(sheet.rowHeights || {}) }; delete map[i]; dispatch({ k: 'props', sheet: name, patch: { rowHeights: map } }); return }
      const texts: { t: string; f?: CellFormat }[] = []
      for (const k of Object.keys(sheet.cells)) { const [r, c] = k.split(',').map(Number); if (c === i) texts.push({ t: display(name, r, c), f: sheet.cells[k].fmt }) }
      const w = fitWidth(texts.map((x) => x.t), (t) => { const f = texts.find((x) => x.t === t)?.f; return measure(t, f) }, 40, 600)
      dispatch({ k: 'props', sheet: name, patch: { colWidths: { ...(sheet.colWidths || {}), [i]: w } } })
    },
    context: (x, y) => setMenu({ x, y }),
    setValue: (r, c, v) => dispatch({ k: 'cells', sheet: name, cells: [{ r, c, input: v }] }),
    moveObject: (kind, id, patch) => {
      if (kind === 'chart') dispatch({ k: 'props', sheet: name, patch: { charts: (sheet.charts || []).map((c) => (c.id === id ? { ...c, ...patch } : c)) } })
      else dispatch({ k: 'props', sheet: name, patch: { images: (sheet.images || []).map((c) => (c.id === id ? { ...c, ...(patch.anchor ? { anchor: { ...c.anchor, ...patch.anchor, dx: 0, dy: 0 } } : {}), ...(patch.size ? { size: patch.size } : {}) } : c)) } })
    },
    selectObject: (o) => { setObj(o); if (o) setTab(o.kind === 'chart' ? 'chart' : 'picture') },
    openFilter: (col, x, y) => setFilterMenu({ col, x, y }),
    shortcut: (e) => {
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && !e.shiftKey && k === 'z') { doUndo(); return true }
      if (mod && (k === 'y' || (e.shiftKey && k === 'z'))) { doRedo(); return true }
      if (mod && k === 'f') { setFind({ replace: false }); return true }
      if (mod && k === 'h') { setFind({ replace: true }); return true }
      if (mod && k === 'p') { act.print(); return true }
      if (e.key === '`' && mod) { setShowFormulas((v) => !v); return true }
      if (readOnly) return false
      if (mod && k === 'b') { toggle('bold'); return true }
      if (mod && k === 'i') { toggle('italic'); return true }
      if (mod && k === 'u') { toggle('underline'); return true }
      if (mod && k === '5') { toggle('strike'); return true }
      if (mod && k === 'k') { setDialog({ k: 'link' }); return true }
      if (mod && k === 'd' && selBox.r1 > selBox.r0) { dispatch({ k: 'cells', sheet: name, cells: fillPatches(sheet, { ...workBox, r1: workBox.r0 }, workBox) }); return true }
      if (mod && k === 'r' && selBox.c1 > selBox.c0) { dispatch({ k: 'cells', sheet: name, cells: fillPatches(sheet, { ...workBox, c1: workBox.c0 }, workBox) }); return true }
      if (mod && e.key === ';' && !e.shiftKey) { dispatch({ k: 'cells', sheet: name, cells: [{ r: sel.a.row, c: sel.a.col, input: localDate() }] }); return true }
      if (mod && e.key === ':' ) { dispatch({ k: 'cells', sheet: name, cells: [{ r: sel.a.row, c: sel.a.col, input: new Date().toTimeString().slice(0, 5) }] }); return true }
      if (e.altKey && e.key === '=') { act.autosum(); return true }
      if (mod && e.shiftKey && k === 'l') { act.filter(); return true }
      if (mod && e.key === '+') { act.insert('row', 'before'); return true }
      if (mod && e.key === '-') { act.remove('row'); return true }
      if (e.key === 'Enter' && mod) return false
      return false
    },
  }

  // Ctrl+Enter inside the cell fills the selection; the Grid reports it as a commit with extend.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (edit && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); commit('none', true) }
      else if (!edit && e.key === 'Delete' && obj && document.activeElement?.closest('[data-testid="office-shell"]')) {
        if (obj.kind === 'chart') act.chartDelete(); else act.pictureDelete()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  // ---- sheet tabs ------------------------------------------------------------------------
  const addSheet = () => {
    const n = freeSheetName(model.book, s.sheetN(model.book.sheets.length + 1))
    if (dispatch({ k: 'sheet-add', name: n, at: active + 1 })) setActive(active + 1)
  }
  const sheetAction = (op: 'rename' | 'duplicate' | 'delete' | 'left' | 'right' | 'hide' | 'unhide', sh: string) => {
    const i = model.book.sheets.findIndex((x) => x.name === sh)
    if (op === 'rename') setDialog({ k: 'rename', sheet: sh })
    if (op === 'duplicate') { const n = freeSheetName(model.book, sh); dispatch({ k: 'sheet-add', name: n, at: i + 1, data: JSON.parse(JSON.stringify(model.book.sheets[i])) }); setActive(i + 1) }
    if (op === 'delete') {
      if (model.book.sheets.length <= 1) { say(s.cantDeleteLast); return }
      dispatch({ k: 'sheet-del', name: sh })
      setActive(Math.max(0, Math.min(i, model.book.sheets.length - 1) - (i >= model.book.sheets.length ? 1 : 0)))
    }
    if (op === 'left' && i > 0) { dispatch({ k: 'sheet-move', name: sh, to: i - 1 }); setActive(i - 1) }
    if (op === 'right' && i < model.book.sheets.length - 1) { dispatch({ k: 'sheet-move', name: sh, to: i + 1 }); setActive(i + 1) }
    if (op === 'hide') { if (model.book.sheets.filter((x) => !x.hidden).length > 1) { dispatch({ k: 'props', sheet: sh, patch: { hidden: true } }); setActive(model.book.sheets.findIndex((x) => !x.hidden && x.name !== sh)) } }
    if (op === 'unhide') dispatch(model.book.sheets.filter((x) => x.hidden).map((x) => ({ k: 'props', sheet: x.name, patch: { hidden: null as unknown as undefined } }) as XOp))
  }

  // ---- formula bar ------------------------------------------------------------------------
  const barText = edit ? edit.text : activeCell?.input ?? ''
  const [nameBox, setNameBox] = useState('')
  useEffect(() => setNameBox(boxRef(selBox)), [selBox])
  const goTo = (t: string) => {
    const v = t.trim()
    const named = (model.book.names || []).find((n) => n.name.toLowerCase() === v.toLowerCase())
    const ref = named ? named.ref : v
    const bang = ref.lastIndexOf('!')
    const sh = bang >= 0 ? ref.slice(0, bang).replace(/^'|'$/g, '') : name
    const b = parseRange(ref.slice(bang + 1).replace(/\$/g, '').toUpperCase())
    if (!b) { setNameBox(boxRef(selBox)); return }
    jumpTo(model.book.sheets.some((x) => x.name === sh) ? sh : name, { a: { row: b.r0, col: b.c0 }, f: { row: b.r1, col: b.c1 } })
    setFocusTick((x) => x + 1)
  }
  const fnHint = useMemo(() => {
    if (!edit || !edit.text.startsWith('=')) return []
    const m = edit.text.match(/([A-Za-z][A-Za-z0-9.]*)$/)
    if (!m || m[1].length < 2) return []
    const q = m[1].toUpperCase()
    return SUPPORTED.filter((f) => f.startsWith(q) && f !== q).slice(0, 8)
  }, [edit])
  const acceptFn = (f: string) => {
    if (!edit) return
    setEdit({ ...edit, text: edit.text.replace(/([A-Za-z][A-Za-z0-9.]*)$/, f + '(') })
    setFocusTick((x) => x + 1)
  }

  const stats = useMemo(() => (boxArea(selBox) > 1 ? selectionStats(sheet, workBox, (r, c) => value(r, c)) : null), [selBox, workBox, sheet, value])
  const fmtN = (n: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en', { maximumFractionDigits: 4 }).format(n)
  const chart = obj?.kind === 'chart' ? (sheet.charts || []).find((c) => c.id === obj.id) || null : null
  const picture = obj?.kind === 'image' ? (sheet.images || []).find((c) => c.id === obj.id) || null : null
  const visibleSheets = model.book.sheets.map((x, i) => ({ x, i })).filter(({ x }) => !x.hidden)

  return (
    <EditorShell
      locale={locale}
      kit={kit}
      title={title}
      onTitle={(t) => { setTitle(t); setTitleRev((r) => r + 1) }}
      status={persist.status}
      fileName={persist.fileName}
      needsPermission={persist.needsPermission}
      onBack={() => { void persist.flush().then(onBack) }}
      onSave={() => void persist.save()}
      onLink={() => void persist.link()}
      onUnlink={() => void persist.unlink()}
      exportBlob={persist.exportBlob}
      onExport={async (ext) => { setBusy(OFFICE_STR[locale].exporting); try { const l = await persist.exportDownload(ext); if (l.length) setLoss({ items: l, dir: 'export' }) } finally { setBusy('') } }}
      onPrint={act.print}
      onUndo={doUndo}
      onRedo={doRedo}
      canUndo={undo.current.length > 0}
      canRedo={redo.current.length > 0}
      collab={collab}
      onSaveCopy={() => void onSaveCopy(JSON.parse(JSON.stringify(model.book)), title || s.templates.budget)}
      busy={busy}
      fileExtra={(close) => <RItem testid="xl-import-sheet" onClick={() => { close(); importInput.current?.click() }}>{s.importInto}</RItem>}
    >
      <XlRibbon s={s} tab={tab} onTab={setTab} fmt={fmt} act={act} merged={merges.some((m) => inBox(m, sel.a.row, sel.a.col))}
        sheetFreeze={!!(sheet.freeze?.rows || sheet.freeze?.cols)} showGrid={sheet.showGrid !== false} rtl={!!sheet.rtl} zoom={zoom} showFormulas={showFormulas}
        chart={chart} picture={picture} readOnly={readOnly} />
      <div className="flex-none flex items-stretch gap-1 px-2 py-1 border-b border-[color:var(--line-soft)] bg-[var(--surface)] relative" data-testid="xl-formula-bar">
        <input
          aria-label="Name box"
          data-testid="xl-namebox"
          value={nameBox}
          onChange={(e) => setNameBox(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goTo(nameBox) } if (e.key === 'Escape') { setNameBox(boxRef(selBox)); setFocusTick((x) => x + 1) } }}
          onFocus={(e) => e.currentTarget.select()}
          className="w-[96px] h-8 px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] font-mono text-[0.82rem]"
          dir="ltr"
        />
        <span className="grid place-items-center px-1 text-ink-faint font-serif italic text-[0.95rem] select-none">fx</span>
        <textarea
          data-testid="xl-formula-input"
          aria-label="Formula"
          rows={1}
          dir="auto"
          spellCheck={false}
          readOnly={readOnly}
          value={barText}
          onFocus={() => { if (!edit && !readOnly) startEdit(activeCell?.input ?? '', 'edit', 'bar') }}
          onChange={(e) => (edit ? setEdit({ ...edit, text: e.target.value, from: 'bar' }) : startEdit(e.target.value, 'edit', 'bar'))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.altKey) { e.preventDefault(); commit(e.shiftKey ? 'up' : e.ctrlKey || e.metaKey ? 'none' : 'down', e.ctrlKey || e.metaKey) }
            if (e.key === 'Tab') { e.preventDefault(); if (fnHint[0]) acceptFn(fnHint[0]); else commit(e.shiftKey ? 'left' : 'right') }
            if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
          onBlur={(e) => { const to = e.relatedTarget as HTMLElement | null; if (edit?.from === 'bar' && !to?.closest('[data-testid="xl-grid"]') && !to?.closest('[data-fn-hint]')) commit('none') }}
          className="flex-1 min-w-0 min-h-8 max-h-24 px-2 py-1 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] font-mono text-[0.86rem] resize-none leading-snug"
          style={{ height: Math.min(96, 32 + (barText.split('\n').length - 1) * 18) }}
        />
        {fnHint.length > 0 && (
          <div data-fn-hint="1" data-testid="xl-fn-hints" className="absolute z-[30] top-full start-[130px] mt-0.5 min-w-[180px] rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)] py-1">
            {fnHint.map((f) => <button key={f} type="button" tabIndex={-1} data-testid="xl-fn-hint" onMouseDown={(e) => { e.preventDefault(); acceptFn(f) }} className="block w-full text-start px-3 py-1 font-mono text-[0.82rem] border-0 bg-transparent cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]" dir="ltr">{f}</button>)}
          </div>
        )}
      </div>
      {find && (
        <FindBar s={s} replace={find.replace} count={matches.list.length} index={matches.i} readOnly={readOnly} message={matches.msg}
          onSearch={search} onStep={step} onReplace={replaceOne} onReplaceAll={replaceAll} onClose={() => { setFind(null); setFocusTick((x) => x + 1) }} />
      )}
      <Grid
        model={model}
        rev={rev}
        sheet={sheet}
        sel={sel}
        edit={edit}
        zoom={zoom}
        showFormulas={showFormulas}
        readOnly={readOnly}
        peers={peers}
        filterHidden={hiddenByFilter}
        selectedObject={obj}
        ctl={ctl}
        locale={locale}
        focusTick={focusTick}
        marquee={marquee && marquee.sheet === name ? marquee.box : null}
        filterRow={af ? { row: af.r0, c0: af.c0, c1: af.c1, active: sheetFilters.filter((f) => f.keep.length).map((f) => f.col) } : undefined}
      />
      <div className="flex-none flex items-center gap-1 px-1 border-t border-[color:var(--line-soft)] bg-[var(--surface)] min-h-[34px]" data-testid="xl-tabs">
        <button type="button" aria-label={s.addSheet} title={s.addSheet} data-testid="xl-add-sheet" disabled={readOnly} onClick={addSheet} className="grid place-items-center size-7 rounded-sm border-0 bg-transparent cursor-pointer text-[1.1rem] hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] disabled:opacity-40">＋</button>
        <div className="flex-1 min-w-0 flex items-stretch overflow-x-auto [scrollbar-width:none]">
          {visibleSheets.map(({ x, i }) => (
            <button
              key={x.name}
              type="button"
              data-testid="xl-sheet-tab"
              data-active={i === active ? '1' : '0'}
              onClick={() => { if (edit) commit('none'); setActive(i); setObj(null); setFocusTick((t) => t + 1) }}
              onDoubleClick={() => !readOnly && setDialog({ k: 'rename', sheet: x.name })}
              onContextMenu={(e) => { e.preventDefault(); setTabMenu({ sheet: x.name, x: e.clientX, y: e.clientY }) }}
              className={`flex-none px-3 py-1 text-[0.84rem] border-0 border-t-2 cursor-pointer whitespace-nowrap ${i === active ? 'bg-[var(--bg)] font-semibold text-green-700' : 'bg-transparent text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]'}`}
              style={{ borderTopColor: x.tabColor || (i === active ? 'var(--color-green-600)' : 'transparent') }}
              dir="auto"
            >{x.name}</button>
          ))}
        </div>
        <span className="text-[0.76rem] text-ink-soft px-2 whitespace-nowrap" data-testid="xl-stats">
          {stats && stats.count > 0 && <>{stats.nums > 0 && <>{s.sum}: <b data-testid="xl-stat-sum">{fmtN(stats.sum)}</b> · {s.avg}: {fmtN(stats.sum / stats.nums)} · </>}{s.count}: <b data-testid="xl-stat-count">{fmtN(stats.count)}</b></>}
          {hiddenByFilter && hiddenByFilter.size > 0 && af && <> · <span data-testid="xl-filter-status">{s.rowsShown(af.r1 - af.r0 - hiddenByFilter.size, af.r1 - af.r0)}</span></>}
        </span>
      </div>
      {toast && <div role="status" data-testid="xl-toast" className="absolute bottom-12 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[20] px-4 py-2 rounded-md bg-ink text-[color:var(--surface)] text-[0.86rem] shadow-[var(--shadow-md)]">{toast}</div>}
      <input ref={pictureInput} type="file" hidden data-testid="xl-picture-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void insertPicture(f) }} />
      <input ref={importInput} type="file" hidden data-testid="xl-import-input" accept={kit.accepts.join(',')} onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setBusy(OFFICE_STR[locale].importing)
        try {
          const r = await kit.importFile(f)
          const ops: XOp[] = r.data.sheets.map((sh) => ({ k: 'sheet-add', name: freeSheetName({ sheets: [...model.book.sheets] }, sh.name), data: sh }) as XOp)
          // Names have to be chosen against the growing list, one at a time.
          const taken: SheetData[] = [...model.book.sheets]
          for (const op of ops) if (op.k === 'sheet-add') { op.name = freeSheetName({ sheets: taken }, op.name); taken.push(blankSheet(op.name)) }
          dispatch(ops)
          setActive(model.book.sheets.length - 1)
          if (r.loss.length) setLoss({ items: r.loss, dir: 'import' })
        } catch { say(locale === 'ar' ? 'تعذّر فتح الملف.' : 'The file could not be opened.') } finally { setBusy('') }
      }} />
      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
        {(close) => <>
          <RItem testid="xl-ctx-cut" hint="Ctrl+X" disabled={readOnly} onClick={() => { close(); act.cut() }}>{s.cut}</RItem>
          <RItem testid="xl-ctx-copy" hint="Ctrl+C" onClick={() => { close(); act.copy() }}>{s.copy}</RItem>
          <RItem testid="xl-ctx-paste" hint="Ctrl+V" disabled={readOnly} onClick={() => { close(); act.paste() }}>{s.paste}</RItem>
          <RItem testid="xl-ctx-paste-values" disabled={readOnly} onClick={() => { close(); act.paste('values') }}>{s.pasteValues}</RItem>
          <hr className="my-1 border-[color:var(--line-soft)]" />
          <RItem testid="xl-ctx-insert-row" disabled={readOnly} onClick={() => { close(); act.insert('row', 'before') }}>{s.rowsAbove}</RItem>
          <RItem testid="xl-ctx-insert-col" disabled={readOnly} onClick={() => { close(); act.insert('col', 'before') }}>{s.colsBefore}</RItem>
          <RItem testid="xl-ctx-delete-row" disabled={readOnly} onClick={() => { close(); act.remove('row') }}>{s.deleteRows}</RItem>
          <RItem testid="xl-ctx-delete-col" disabled={readOnly} onClick={() => { close(); act.remove('col') }}>{s.deleteCols}</RItem>
          <RItem testid="xl-ctx-clear" disabled={readOnly} onClick={() => { close(); act.clear('contents') }}>{s.clearContents}</RItem>
          <hr className="my-1 border-[color:var(--line-soft)]" />
          <RItem testid="xl-ctx-sort-asc" disabled={readOnly} onClick={() => { close(); act.sort('asc') }}>{s.sortAsc}</RItem>
          <RItem testid="xl-ctx-sort-desc" disabled={readOnly} onClick={() => { close(); act.sort('desc') }}>{s.sortDesc}</RItem>
          <RItem testid="xl-ctx-link" disabled={readOnly} onClick={() => { close(); act.link() }}>{s.link}…</RItem>
          <RItem testid="xl-ctx-note" disabled={readOnly} onClick={() => { close(); act.note() }}>{s.note}…</RItem>
          {activeCell?.link && <RItem testid="xl-ctx-open-link" onClick={() => { close(); window.open(activeCell.link, '_blank', 'noopener') }}>{s.openLink}</RItem>}
        </>}
      </ContextMenu>}
      {tabMenu && <ContextMenu x={tabMenu.x} y={tabMenu.y} onClose={() => setTabMenu(null)} up>
        {(close) => <>
          {(['rename', 'duplicate', 'left', 'right', 'hide', 'delete'] as const).map((o) => (
            <RItem key={o} testid={`xl-tab-${o}`} disabled={readOnly} danger={o === 'delete'} onClick={() => { close(); sheetAction(o, tabMenu.sheet) }}>
              {o === 'rename' ? s.renameSheet : o === 'duplicate' ? s.duplicateSheet : o === 'left' ? s.moveLeft : o === 'right' ? s.moveRight : o === 'hide' ? s.hideSheet : s.deleteSheet}
            </RItem>
          ))}
          {model.book.sheets.some((x) => x.hidden) && <RItem testid="xl-tab-unhide" disabled={readOnly} onClick={() => { close(); sheetAction('unhide', tabMenu.sheet) }}>{s.unhideSheets}</RItem>}
          <div className="flex gap-1 px-3 py-2">{['#0b6e4f', '#c8963e', '#3b5bdb', '#c2255c', '#e8590c', ''].map((c) => (
            <button key={c || 'none'} type="button" aria-label={s.tabColor} data-testid={`xl-tab-color-${c.slice(1) || 'none'}`} disabled={readOnly} onClick={() => { close(); dispatch({ k: 'props', sheet: tabMenu.sheet, patch: { tabColor: c || (null as unknown as undefined) } }) }}
              className="size-5 rounded-sm cursor-pointer border border-[color:var(--line)]" style={{ background: c || 'transparent' }} />
          ))}</div>
        </>}
      </ContextMenu>}
      {filterMenu && (() => {
        const col = filterMenu.col
        const vals = distinctValues(sheet, col, (r, c) => value(r, c), (af?.r0 ?? 0) + 1)
        const cur = sheetFilters.find((f) => f.col === col)?.keep || []
        return <FilterMenu s={s} values={vals} keep={cur} x={filterMenu.x} y={filterMenu.y} onClose={() => setFilterMenu(null)}
          onApply={(keep) => setFilters((f) => ({ ...f, [name]: withFilter(f[name] || [], col, keep) }))}
          onSort={(d) => { select({ row: sel.a.row, col }); const reg = af!; const p = sortPatches(sheet, reg, col, d, (r, c) => value(r, c), true); if (p.length) dispatch({ k: 'cells', sheet: name, cells: p }) }} />
      })()}
      {dialog?.k === 'link' && <LinkDialog s={s} url={activeCell?.link || ''} text={activeCell?.input && !activeCell.input.startsWith('=') ? activeCell.input : ''} onClose={() => { setDialog(null); setFocusTick((x) => x + 1) }}
        onRemove={activeCell?.link ? () => dispatch({ k: 'cells', sheet: name, cells: [{ r: sel.a.row, c: sel.a.col, link: null }] }) : undefined}
        onSave={(url, text) => dispatch({ k: 'cells', sheet: name, cells: [{ r: sel.a.row, c: sel.a.col, link: url, input: text || activeCell?.input || url }] })} />}
      {dialog?.k === 'note' && <NoteDialog s={s} note={activeCell?.note || ''} onClose={() => { setDialog(null); setFocusTick((x) => x + 1) }} onSave={(n) => dispatch({ k: 'cells', sheet: name, cells: [{ r: sel.a.row, c: sel.a.col, note: n }] })} />}
      {dialog?.k === 'validation' && (() => {
        const cur = (sheet.validations || []).find((v) => v.range.split(/\s+/).some((rg) => { const b = parseRange(rg); return b && inBox(b, sel.a.row, sel.a.col) })) || null
        return <ValidationDialog s={s} current={cur} onClose={() => { setDialog(null); setFocusTick((x) => x + 1) }} onSave={(v) => {
          const rest = (sheet.validations || []).filter((x) => x !== cur)
          dispatch({ k: 'props', sheet: name, patch: { validations: v ? [...rest, { range: boxRef(workBox), kind: 'list', ...v }] : rest } })
        }} />
      })()}
      {dialog?.k === 'names' && <NamesDialog s={s} names={model.book.names || []} selectionRef={`${/[^A-Za-z0-9_]/.test(name) ? `'${name.replace(/'/g, "''")}'` : name}!${boxRef(workBox).split(':').map((p) => p.replace(/([A-Z]+)(\d+)/, '$$$1$$$2')).join(':')}`} onClose={() => setDialog(null)} onSave={(n) => dispatch({ k: 'names', names: n })} />}
      {dialog?.k === 'cond' && <CondDialog s={s} rules={sheet.conds || []} scales={(sheet.scales || []).length} onClose={() => { setDialog(null); setFocusTick((x) => x + 1) }}
        onSave={(r) => dispatch({ k: 'props', sheet: name, patch: { conds: [...(sheet.conds || []), r] } })}
        onScale={(k) => dispatch({ k: 'props', sheet: name, patch: { scales: [...(sheet.scales || []), { box: workBox, kind: k }] } })}
        onClear={() => dispatch({ k: 'props', sheet: name, patch: { conds: [], scales: [], cond: null as unknown as undefined } })} />}
      {dialog?.k === 'format' && <FormatDialog s={s} code={fmt.numCode || ''} sample={(() => { const v = value(sel.a.row, sel.a.col); return typeof v === 'number' ? v : 1234.5 })()} onClose={() => { setDialog(null); setFocusTick((x) => x + 1) }}
        onSave={(c) => fmtBox({ numCode: c || undefined, numFmt: undefined, decimals: undefined, currency: undefined })} />}
      {dialog?.k === 'size' && <SizeDialog s={s} label={dialog.axis === 'row' ? s.rowHeight : s.colWidth}
        value={dialog.axis === 'row' ? sheet.rowHeights?.[sel.a.row] ?? DEFAULT_ROW_H : sheet.colWidths?.[sel.a.col] ?? DEFAULT_COL_W} onClose={() => { setDialog(null); setFocusTick((x) => x + 1) }}
        onSave={(n) => {
          const key = dialog.axis === 'row' ? 'rowHeights' : 'colWidths'
          const map = { ...(sheet[key] || {}) }
          const [lo, hi] = dialog.axis === 'row' ? [selBox.r0, Math.min(workBox.r1, selBox.r0 + 1000)] : [selBox.c0, Math.min(workBox.c1, selBox.c0 + 200)]
          for (let i = lo; i <= hi; i++) map[i] = n
          dispatch({ k: 'props', sheet: name, patch: { [key]: map } })
        }} />}
      {dialog?.k === 'fn' && <FunctionDialog s={s} onClose={() => setDialog(null)} onPick={(f) => {
        setDialog(null)
        const cur = edit?.text
        if (cur && cur.startsWith('=')) setEdit({ ...edit!, text: cur + f + '(' })
        else startEdit(`=${f}(`, 'enter')
        setFocusTick((x) => x + 1)
      }} />}
      {dialog?.k === 'split' && <SplitDialog s={s} onClose={() => setDialog(null)} onSplit={(d) => { const p = splitPatches(sheet, { ...workBox, c1: workBox.c0 }, d); if (p.length) dispatch({ k: 'cells', sheet: name, cells: p }) }} />}
      {dialog?.k === 'rename' && <RenameSheetDialog s={s} name={dialog.sheet} taken={model.book.sheets.map((x) => x.name)} onClose={() => setDialog(null)} onSave={(n) => { if (n !== dialog.sheet) dispatch({ k: 'sheet-ren', from: dialog.sheet, to: n }) }} />}
      {loss && <LossDialog locale={locale} loss={loss.items} dir={loss.dir} onClose={() => setLoss(null)} />}
    </EditorShell>
  )
}

const SUPPORTED: string[] = []
void import('./engine/formula').then((m) => { SUPPORTED.push(...[...m.SUPPORTED_FUNCTIONS].sort()) })

function localDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ContextMenu({ x, y, onClose, children, up }: { x: number; y: number; onClose: () => void; children: (close: () => void) => ReactNode; up?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[85]" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }} onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div data-testid="xl-context-menu" className="absolute w-[230px] max-h-[80dvh] overflow-auto rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)] py-1"
        style={{ left: Math.max(8, Math.min(x, window.innerWidth - 238)), ...(up ? { bottom: Math.max(8, window.innerHeight - y) } : { top: Math.max(8, Math.min(y, window.innerHeight - 440)) }) }}>
        {children(onClose)}
      </div>
    </div>
  )
}

/** Print the sheet's used range as a plain table, via a hidden frame. */
function printSheet(sheet: SheetData, display: (r: number, c: number) => string, title: string) {
  let rows = 0
  let cols = 0
  for (const k of Object.keys(sheet.cells)) { const [r, c] = k.split(',').map(Number); rows = Math.max(rows, r + 1); cols = Math.max(cols, c + 1) }
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  let body = ''
  for (let r = 0; r < Math.min(rows, 5000); r++) {
    if (sheet.hiddenRows?.includes(r)) continue
    body += '<tr>'
    for (let c = 0; c < Math.min(cols, 200); c++) {
      if (sheet.hiddenCols?.includes(c)) continue
      const f = sheet.cells[cellKey(r, c)]?.fmt
      const st = [f?.bold && 'font-weight:700', f?.italic && 'font-style:italic', f?.bg && `background:${f.bg}`, f?.color && `color:${f.color}`, f?.align && `text-align:${f.align}`].filter(Boolean).join(';')
      body += `<td style="${st}">${esc(display(r, c))}</td>`
    }
    body += '</tr>'
  }
  const html = `<!doctype html><html dir="${sheet.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;font-size:10pt}table{border-collapse:collapse}td{border:1px solid #ccc;padding:2px 6px;white-space:pre}</style></head><body><table>${body}</table></body></html>`
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0'
  frame.setAttribute('data-testid', 'xl-print-frame')
  document.body.appendChild(frame)
  frame.contentDocument!.open()
  frame.contentDocument!.write(html)
  frame.contentDocument!.close()
  setTimeout(() => { try { frame.contentWindow!.focus(); frame.contentWindow!.print() } catch { /* */ } setTimeout(() => frame.remove(), 60_000) }, 50)
}

