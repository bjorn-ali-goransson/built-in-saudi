// The presentation editor. One DeckModel holds the deck; every change is an op
// sent through the SeqDoc, which applies it here and — in a live session —
// routes it through the owner so every browser applies the same edits in the
// same order. Undo is by inverse op, so it takes back MY change and leaves a
// colleague's alone.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { EditorShell, LossDialog } from '../../components/office/EditorShell'
import { usePersistence, useCollab } from '../../components/office/hooks'
import type { EditorProps } from '../../components/office/OfficeApp'
import { RItem } from '../../components/office/Ribbon'
import { OFFICE_STR } from '../../components/office/strings'
import { Sheet, SheetTitle, SheetActions, Button, Input } from '../../components/ui'
import { SeqDoc } from '../../lib/collab/seqDoc'
import { colorFor } from '../../lib/collab/session'
import { pictureFromFile } from '../../lib/office/picture'
import { DeckModel, wire, type SOp } from './doc'
import { newId, plainText, slideTitle, type DeckData, type El, type ImageEl, type LayoutKind, type ShapeEl, type Slide, type TableEl, type TextBody, type Theme, type TransitionKind } from './model'
import { ordAfter, ordEnd } from './order'
import { SL_STR } from './strings'
import { SlideCanvas, emptyBody, type EditTarget, type Tool, type Transform, type PeerSel } from './SlideCanvas'
import { SlideRail, type RailPeer } from './SlideRail'
import { SlidesRibbon, type SlActions, type SlFormat } from './ui/SlidesRibbon'
import { TextEditor, type TextEditorApi } from './TextEditor'
import { Present, openAudienceWindow } from './Present'
import { SlideView } from './render'
import { markOn, tsAt, paraAttr, toggle as pmToggle, setTs, setPara, shiftLevel, setLink as pmLink, patchRuns, patchParas, firstRun, allRuns } from './textEdit'
import { addSlide, duplicateSlide, relayout, align, newTable, tableEdit, findAll, replaceHits, resizeDeck, copyEls, type Hit } from './actions'
import { pruned } from './kit'
import { runSize } from './look'
import { isLine } from './geom'

type Undo = { ops: SOp[]; inv: SOp[]; slide: string; sel: string[] }
const CLIP = 'application/x-bis-slides'
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export default function PowerPointEditor({ locale, kit, doc, joinRoom, onBack, onSaveCopy, importLoss }: EditorProps<DeckData>) {
  const s = SL_STR[locale]
  const guest = !!joinRoom
  const model = useMemo(() => new DeckModel(clone((doc?.data as DeckData | undefined) || kit.blank())), []) // eslint-disable-line react-hooks/exhaustive-deps
  const seq = useMemo(() => new SeqDoc<SOp>(model, !guest), [model, guest])
  const rev = useSyncExternalStore(useCallback((f) => model.subscribe(f), [model]), () => model.rev)
  const deck = model.deck
  const [title, setTitle] = useState(doc?.title || '')
  const [titleRev, setTitleRev] = useState(0)
  const [cur, setCur] = useState(() => deck.slides[0]?.id || '')
  const [sel, setSel] = useState<string[]>([])
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [tool, setTool] = useState<Tool | null>(null)
  const [tab, setTab] = useState('home')
  const [zoom, setZoom] = useState<number | null>(null)
  const [showNotes, setShowNotes] = useState(true)
  const [loss, setLoss] = useState<{ items: string[]; dir: 'import' | 'export' } | null>(importLoss?.length ? { items: importLoss, dir: 'import' } : null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState('')
  const [present, setPresent] = useState<{ start: number; presenter: boolean; popup: Window | null } | null>(null)
  const [following, setFollowing] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; slide?: string; el?: string | null } | null>(null)
  const [linkDlg, setLinkDlg] = useState<{ url: string } | null>(null)
  // On a phone the rail becomes a strip under the slide; hiding it would leave no way between slides.
  const narrow = useSyncExternalStore(useCallback((f) => { const m = matchMedia('(max-width: 720px)'); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, []), () => matchMedia('(max-width: 720px)').matches)
  const [find, setFind] = useState<{ q: string; r: string; matchCase: boolean; hits: Hit[]; i: number; msg?: string } | null>(null)
  const [printing, setPrinting] = useState(false)
  const [, bump] = useState(0)
  const undo = useRef<Undo[]>([])
  const redo = useRef<Undo[]>([])
  const pictureInput = useRef<HTMLInputElement>(null)
  const bgInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const editorApi = useRef<TextEditorApi | null>(null)
  const clip = useRef<{ els: El[]; media: DeckData['media'] } | null>(null)
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 3500) }

  // The slide in view follows edits: deleted under us → the nearest one.
  const slide: Slide | undefined = deck.slides.find((x) => x.id === cur) || deck.slides[0]
  useEffect(() => { if (slide && slide.id !== cur) setCur(slide.id) }, [rev]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSel((xs) => xs.filter((id) => slide?.elements.some((e) => e.id === id))) }, [rev, cur]) // eslint-disable-line react-hooks/exhaustive-deps
  const number = slide ? deck.slides.indexOf(slide) + 1 : 1

  // ---- collaboration ---------------------------------------------------------
  const collab = useCollab({ adapter: seq, kind: 'powerpoint', title: title || s.templates.blank, onMeta: (m) => { if (m.title) setTitle(m.title) } })
  useEffect(() => { if (joinRoom) collab.join(joinRoom) }, [joinRoom]) // eslint-disable-line react-hooks/exhaustive-deps
  const readOnly = !collab.canEdit
  const presentingSlide = useRef<string | null>(null)
  useEffect(() => { collab.sendPresence({ slide: cur, sel, editing: editing?.id || null, presenting: presentingSlide.current }) }, [cur, sel, editing, collab.state]) // eslint-disable-line react-hooks/exhaustive-deps
  const peerList = useMemo(() => Object.entries(collab.presence).flatMap(([client, p]) => {
    const d = p.d as { slide?: string; sel?: string[]; presenting?: string | null }
    const m = collab.roster.find((x) => x.client === client)
    if (client === collab.me || !d?.slide) return []
    return [{ client, name: m?.name || '…', color: m?.color || colorFor(client), slide: d.slide, sel: Array.isArray(d.sel) ? d.sel : [], presenting: d.presenting || null }]
  }), [collab.presence, collab.roster, collab.me])
  const presenter = peerList.find((p) => p.presenting)

  // ---- persistence -------------------------------------------------------------
  const stored = useMemo(() => (doc ? { ...doc, title } : null), [doc, title])
  const getData = useCallback(() => pruned(model.deck), [model])
  const persist = usePersistence({ doc: stored, kit, getData, rev: rev + titleRev * 1e9, disabled: guest, onLoss: (l) => setLoss({ items: l, dir: 'export' }) })

  // ---- edits ---------------------------------------------------------------------
  /** Apply ops; with `undoable`, remember how to take them back. */
  const run = useCallback((ops: SOp[], undoable = true): boolean => {
    if (readOnly || !ops.length) return false
    const inv: SOp[] = []
    let any = false
    for (const raw of ops) {
      const op = wire(raw)
      const back = model.inverse(op)
      if (seq.edit(op)) { any = true; inv.unshift(...back) }
    }
    if (any && undoable) {
      undo.current.push({ ops: ops.map(wire), inv, slide: cur, sel })
      if (undo.current.length > 300) undo.current.shift()
      redo.current = []
    }
    bump((x) => x + 1)
    return any
  }, [model, seq, readOnly, cur, sel])
  const doUndo = useCallback(() => {
    const e = undo.current.pop()
    if (!e || readOnly) return
    const inv: SOp[] = []
    for (const op of e.inv) { const back = model.inverse(op); if (seq.edit(op)) inv.unshift(...back) }
    redo.current.push({ ...e, inv: e.ops, ops: e.inv })
    if (deck.slides.some((x) => x.id === e.slide)) setCur(e.slide)
    setSel(e.sel)
    setEditing(null)
    bump((x) => x + 1)
  }, [model, seq, readOnly, deck])
  const doRedo = useCallback(() => {
    const e = redo.current.pop()
    if (!e || readOnly) return
    for (const op of e.inv) seq.edit(op)
    undo.current.push({ ...e, ops: e.inv, inv: e.ops })
    if (deck.slides.some((x) => x.id === e.slide)) setCur(e.slide)
    bump((x) => x + 1)
  }, [seq, readOnly, deck])
  const setEls = (patches: { id: string; patch: Partial<El> }[]) => slide && run(patches.map((p) => ({ k: 'el-set', slide: slide.id, id: p.id, patch: p.patch })))
  const selected = (slide?.elements || []).filter((e) => sel.includes(e.id))

  // ---- dragging, from the canvas ------------------------------------------------
  const dragStart = useRef<Map<string, El> | null>(null)
  const lastLive = useRef(0)
  const onTransform = useCallback((ts: Transform[], phase: 'start' | 'move' | 'end', opts?: { duplicate?: boolean }) => {
    if (!slide || readOnly) return
    if (phase === 'start') {
      dragStart.current = new Map(ts.map((t) => [t.id, clone(slide.elements.find((e) => e.id === t.id)!)]).filter(([, e]) => e) as [string, El][])
      if (opts?.duplicate) {
        // Alt-drag leaves a copy behind, as every drawing program does.
        const copies = copyEls(slide, [...dragStart.current.values()], 0)
        run(copies.map((el) => ({ k: 'el-add', slide: slide.id, el })), false)
      }
      return
    }
    if (phase === 'move') {
      // Collaborators see the drag as it happens, a few times a second, never the full stream.
      if (collab.state === 'live' && Date.now() - lastLive.current > 90) {
        lastLive.current = Date.now()
        for (const t of ts) seq.edit(wire({ k: 'el-set', slide: slide.id, id: t.id, patch: t.patch }))
      }
      return
    }
    const start = dragStart.current
    dragStart.current = null
    if (!ts.length || !start) return
    const ops: SOp[] = ts.map((t) => ({ k: 'el-set', slide: slide.id, id: t.id, patch: t.patch }))
    const inv: SOp[] = ts.map((t) => {
      const o = start.get(t.id) as unknown as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      for (const k of Object.keys(t.patch)) patch[k] = o?.[k]
      return wire({ k: 'el-set', slide: slide.id, id: t.id, patch })
    })
    for (const op of ops) seq.edit(wire(op))
    undo.current.push({ ops: ops.map(wire), inv, slide: slide.id, sel })
    redo.current = []
    bump((x) => x + 1)
  }, [slide, readOnly, collab.state, seq, run, sel])

  // ---- creating ------------------------------------------------------------------
  const addEl = (el: El, edit = false) => {
    if (!slide) return
    el.ord = ordEnd(slide.elements)
    run([{ k: 'el-add', slide: slide.id, el }])
    setSel([el.id])
    if (edit) setEditing({ id: el.id })
  }
  const onCreate = (b: { x: number; y: number; w: number; h: number; flipH?: boolean; flipV?: boolean }, t: Tool) => {
    if (t.kind === 'line') addEl({ id: newId(), kind: 'shape', geom: 'line', ...b, line: { color: 'dk1', width: 2, tail: t.arrow ? 'triangle' : undefined } })
    else if (t.kind === 'text') addEl({ id: newId(), kind: 'shape', geom: 'rect', ...b, fill: { type: 'none' }, line: null, text: emptyBody(!!deck.rtl) }, true)
    else addEl({ id: newId(), kind: 'shape', geom: t.geom, ...b, fill: { type: 'solid', color: 'accent1' }, line: { color: 'accent1', width: 1 }, text: { paras: [{ runs: [], align: 'ctr', rtl: deck.rtl || undefined }], anchor: 'ctr', defaults: { color: 'lt1', size: 18 } } })
  }
  const insertPictures = async (files: File[], at?: { x: number; y: number }) => {
    if (!slide) return
    for (const f of files) {
      const r = await pictureFromFile(f, locale)
      if ('error' in r) { say(r.error); continue }
      const id = newId('m')
      const S = deck.size
      const k = Math.min(1, (S.w * 0.6) / r.w, (S.h * 0.6) / r.h)
      const w = Math.round(r.w * k), h = Math.round(r.h * k)
      const el: ImageEl = { id: newId(), kind: 'image', media: id, x: Math.round((at?.x ?? S.w / 2) - w / 2), y: Math.round((at?.y ?? S.h / 2) - h / 2), w, h, alt: f.name.replace(/\.[^.]+$/, ''), ord: ordEnd(slide.elements) }
      run([{ k: 'media-add', id, media: { mime: r.src.slice(5, r.src.indexOf(';')), data: r.src } }, { k: 'el-add', slide: slide.id, el }])
      setSel([el.id])
    }
  }

  // ---- text editing ------------------------------------------------------------
  const editStart = useRef<{ target: EditTarget; body: TextBody } | null>(null)
  const liveTimer = useRef<number>()
  const bodyOf = (t: EditTarget): TextBody | undefined => {
    const el = slide?.elements.find((e) => e.id === t.id)
    if (!el) return undefined
    if (el.kind === 'table' && t.cell) return el.rows[t.cell[0]]?.cells[t.cell[1]]?.text
    if (el.kind === 'shape') return el.text || { paras: [{ runs: [] }], defaults: {} }
    return undefined
  }
  const patchFor = (t: EditTarget, body: TextBody): Partial<El> | null => {
    const el = slide?.elements.find((e) => e.id === t.id)
    if (!el) return null
    if (el.kind === 'table' && t.cell) { const rows = clone(el.rows); rows[t.cell[0]].cells[t.cell[1]].text = body; return { rows } }
    return { text: body }
  }
  useEffect(() => {
    if (!editing) { editStart.current = null; return }
    const b = bodyOf(editing)
    editStart.current = b ? { target: editing, body: clone(b) } : null
  }, [editing?.id, editing?.cell?.[0], editing?.cell?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  const onTextChange = (b: TextBody) => {
    // In a live session the others watch the words appear, a few times a second.
    if (collab.state !== 'live' || !editing || !slide) return
    window.clearTimeout(liveTimer.current)
    const t = editing
    liveTimer.current = window.setTimeout(() => { const p = patchFor(t, b); if (p) seq.edit(wire({ k: 'el-set', slide: slide.id, id: t.id, patch: p })) }, 250)
  }
  const onTextDone = (b: TextBody, measured?: number) => {
    window.clearTimeout(liveTimer.current)
    const st = editStart.current
    const t = editing
    setEditing(null)
    if (!st || !t || !slide) return
    const el = slide.elements.find((e) => e.id === t.id)
    if (!el) return
    const patch = patchFor(t, b)
    if (!patch) return
    // A text box that grows with its text: fit the box to what was typed.
    if (el.kind === 'shape' && b.autofit === 'resize' && measured && Math.abs(measured - el.h) > 1) (patch as Partial<ShapeEl>).h = Math.max(20, Math.round(measured))
    const same = JSON.stringify(st.body) === JSON.stringify(b) && !(patch as Partial<ShapeEl>).h
    // An empty new text box that was never typed into is removed, not left as an invisible box.
    if (el.kind === 'shape' && !el.ph && el.fill?.type === 'none' && el.line === null && !b.paras.some((p) => p.runs.some((r) => r.t))) { run([{ k: 'el-del', slide: slide.id, ids: [el.id] }]); return }
    if (same) return
    const before = patchFor(t, st.body)!
    const op = wire({ k: 'el-set', slide: slide.id, id: t.id, patch })
    seq.edit(op)
    const back: Record<string, unknown> = { ...before }
    if ((patch as Partial<ShapeEl>).h) back.h = el.h
    undo.current.push({ ops: [op], inv: [wire({ k: 'el-set', slide: slide.id, id: t.id, patch: back as Partial<El> })], slide: slide.id, sel: [t.id] })
    redo.current = []
    bump((x) => x + 1)
  }

  // ---- formatting: in the box while typing, or the whole selected box ----------
  const textTargets = selected.filter((e) => (e.kind === 'shape' && !isLine(e.geom)) || e.kind === 'table')
  const withBodies = (f: (b: TextBody) => TextBody) => {
    if (!slide) return
    run(textTargets.map((e) => {
      if (e.kind === 'table') return { k: 'el-set', slide: slide.id, id: e.id, patch: { rows: e.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c, text: f(c.text) })) })) } }
      return { k: 'el-set', slide: slide.id, id: e.id, patch: { text: f((e as ShapeEl).text || { paras: [{ runs: [] }] }) } }
    }))
  }
  const pm = () => editorApi.current?.view
  const pmRun = (c: (st: import('prosemirror-state').EditorState, d?: (tr: import('prosemirror-state').Transaction) => void) => boolean) => { const v = pm(); if (!v) return false; c(v.state, v.dispatch); v.focus(); bump((x) => x + 1); return true }

  const fmt: SlFormat = (() => {
    const v = pm()
    const first = selected[0]
    const fb = first?.kind === 'shape' ? first.text : first?.kind === 'table' ? first.rows[0]?.cells[0]?.text : undefined
    const base: SlFormat = { b: false, i: false, u: false, s: false }
    if (first?.kind === 'shape') {
      base.fill = first.fill?.type === 'solid' ? first.fill.color : first.fill?.type === 'none' ? null : undefined
      base.line = first.line === null ? null : first.line?.color
      base.lineWidth = first.line?.width
      base.dash = first.line?.dash
      base.shadow = first.shadow
      base.arrows = first.line?.head && first.line?.tail ? 'both' : first.line?.tail ? 'end' : 'none'
      base.anchor = first.text?.anchor || 't'
    }
    if (v) {
      const ts = tsAt(v.state)
      return { ...base, b: markOn(v.state, 'b'), i: markOn(v.state, 'i'), u: markOn(v.state, 'u'), s: markOn(v.state, 's'),
        size: (ts.size as number) || (editing ? runSize(undefined, { runs: [], level: paraAttr(v.state, 'level') as number }, bodyOf(editing) || { paras: [] }) : undefined),
        font: (ts.font as string) || undefined, color: (ts.color as string) || undefined, align: (paraAttr(v.state, 'align') as string) || undefined,
        bullet: (paraAttr(v.state, 'bullet') as string) || null, rtl: !!paraAttr(v.state, 'rtl') }
    }
    if (fb) {
      const r = firstRun(fb)
      const p = fb.paras[0]
      return { ...base, b: allRuns(fb, 'b'), i: allRuns(fb, 'i'), u: allRuns(fb, 'u'), s: allRuns(fb, 's'), size: p ? runSize(r, p, fb) : undefined, font: r?.font, color: r?.color, align: p?.align, bullet: p?.bullet ?? null, rtl: !!p?.rtl }
    }
    return base
  })()

  // ---- clipboard -----------------------------------------------------------------
  const copySel = () => {
    if (!selected.length) return false
    const media: DeckData['media'] = {}
    for (const e of selected) if (e.kind === 'image' && deck.media[e.media]) media[e.media] = deck.media[e.media]
    clip.current = { els: clone(selected), media }
    return true
  }
  const pasteClip = (c: { els: El[]; media: DeckData['media'] }) => {
    if (!slide || readOnly) return
    const copies = copyEls(slide, c.els, c.els.some((e) => slide.elements.some((x) => x.id === e.id)) ? 12 : 0)
    const ops: SOp[] = [...Object.entries(c.media).map(([id, m]) => ({ k: 'media-add', id, media: m }) as SOp), ...copies.map((el) => ({ k: 'el-add', slide: slide.id, el }) as SOp)]
    run(ops)
    setSel(copies.map((e) => e.id))
  }
  useEffect(() => {
    const busyTarget = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]')
    const onCopy = (e: ClipboardEvent) => {
      if (editing || present || busyTarget(e.target) || !copySel()) return
      e.preventDefault()
      e.clipboardData?.setData(CLIP, JSON.stringify(clip.current))
      e.clipboardData?.setData('text/plain', selected.map((x) => (x.kind === 'shape' ? plainText(x.text) : x.kind === 'table' ? x.rows.map((r) => r.cells.map((c) => plainText(c.text)).join('\t')).join('\n') : '')).filter(Boolean).join('\n'))
    }
    const onCut = (e: ClipboardEvent) => { if (editing || present || readOnly || busyTarget(e.target) || !selected.length) return; onCopy(e); if (slide) run([{ k: 'el-del', slide: slide.id, ids: sel }]); setSel([]) }
    const onPaste = (e: ClipboardEvent) => {
      if (editing || present || readOnly || busyTarget(e.target) || !slide) return
      const data = e.clipboardData
      const ours = data?.getData(CLIP)
      if (ours) { e.preventDefault(); try { pasteClip(JSON.parse(ours)) } catch { /* not ours after all */ } return }
      const files = [...(data?.files || [])]
      if (files.length) { e.preventDefault(); void insertPictures(files); return }
      const text = data?.getData('text/plain')
      if (text?.trim()) {
        e.preventDefault()
        const paras = text.replace(/\r\n?/g, '\n').split('\n').map((t) => ({ runs: t ? [{ t }] : [], rtl: /^[^A-Za-z]*[؀-ۿ]/.test(t) || undefined }))
        addEl({ id: newId(), kind: 'shape', geom: 'rect', x: 80, y: 80, w: deck.size.w * 0.5, h: Math.min(deck.size.h - 120, 40 + paras.length * 26), fill: { type: 'none' }, line: null, text: { ...emptyBody(!!deck.rtl), paras } })
      }
    }
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
    return () => { document.removeEventListener('copy', onCopy); document.removeEventListener('cut', onCut); document.removeEventListener('paste', onPaste) }
  })

  // ---- slides --------------------------------------------------------------------
  const newSlideAfter = (kind: LayoutKind) => { const { ops, newId: id } = addSlide(deck, cur || null, kind); if (run(ops)) { setCur(id); setSel([]) } }
  const dupSlide = (id = cur) => { const { ops, newId: nid } = duplicateSlide(deck, id); if (run(ops)) setCur(nid) }
  const delSlide = (id = cur) => {
    const i = deck.slides.findIndex((x) => x.id === id)
    if (i < 0) return
    if (deck.slides.length === 1) { const { ops, newId: nid } = addSlide(deck, null, 'blank'); run([...ops, { k: 'slide-del', id }]); setCur(nid); return }
    const next = deck.slides[i + 1] || deck.slides[i - 1]
    if (run([{ k: 'slide-del', id }])) { setCur(next.id); setSel([]) }
  }
  const moveSlide = (id: string, toIndex: number) => {
    const others = deck.slides.filter((x) => x.id !== id)
    const after = toIndex <= 0 ? null : (others[Math.min(others.length, toIndex) - 1]?.id ?? null)
    const realIndex = deck.slides.findIndex((x) => x.id === id)
    const adj = toIndex > realIndex ? deck.slides[toIndex - 1]?.id ?? null : after
    run([{ k: 'slide-move', id, ord: ordAfter(deck.slides, adj === id ? null : adj, id) }])
  }
  const goSlide = (d: 1 | -1) => { const i = deck.slides.findIndex((x) => x.id === cur); const n = deck.slides[i + d]; if (n) { setCur(n.id); setSel([]); setEditing(null) } }

  // ---- presenting ------------------------------------------------------------------
  const startShow = (mode: 'start' | 'current' | 'presenter' | 'window') => {
    setEditing(null)
    const start = mode === 'start' ? 0 : Math.max(0, deck.slides.findIndex((x) => x.id === cur))
    let popup: Window | null = null
    if (mode === 'window') { popup = openAudienceWindow(title || s.templates.blank); if (!popup) { say(s.present.popupBlocked); return } }
    setPresent({ start, presenter: mode === 'presenter' || mode === 'window', popup })
  }
  const endShow = useCallback(() => {
    setPresent((p) => { try { p?.popup?.close() } catch { /* */ } return null })
    // Back in the editor on the slide the show reached, as every presentation app does.
    const reached = presentingSlide.current && model.deck.slides.some((x) => x.id === presentingSlide.current) ? presentingSlide.current : cur
    presentingSlide.current = null
    setCur(reached)
    setSel([])
    collab.sendPresence({ slide: reached, sel: [], presenting: null })
  }, [collab, cur, model])

  // ---- printing: every slide a page, at the deck's own proportions ----------------
  const print = useCallback(() => {
    setPrinting(true)
    window.setTimeout(() => {
      const done = () => { setPrinting(false); window.removeEventListener('afterprint', done) }
      window.addEventListener('afterprint', done)
      window.print()
      window.setTimeout(done, 60_000)
    }, 300)
  }, [])

  // ---- keyboard ---------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (present) return
      const t = e.target as HTMLElement
      if (t?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key
      if (k === 'F5') { e.preventDefault(); startShow(e.shiftKey ? 'current' : 'start'); return }
      if (mod && k.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return }
      if (mod && k.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return }
      if (mod && k.toLowerCase() === 'm') { e.preventDefault(); newSlideAfter('titleContent'); return }
      if (mod && k.toLowerCase() === 'f') { e.preventDefault(); setFind({ q: '', r: '', matchCase: false, hits: [], i: 0 }); return }
      if (mod && k.toLowerCase() === 'a' && slide) { e.preventDefault(); setSel(slide.elements.map((x) => x.id)); return }
      if (mod && k.toLowerCase() === 'd') { e.preventDefault(); if (selected.length && slide) { const c = copyEls(slide, selected); run(c.map((el) => ({ k: 'el-add', slide: slide.id, el }))); setSel(c.map((x) => x.id)) } else dupSlide(); return }
      if (mod && ['b', 'i', 'u'].includes(k.toLowerCase()) && textTargets.length) { e.preventDefault(); act.mark(k.toLowerCase() as 'b'); return }
      if (k === 'Escape') { setTool(null); setSel([]); return }
      if ((k === 'Delete' || k === 'Backspace') && selected.length && slide && !readOnly) { e.preventDefault(); run([{ k: 'el-del', slide: slide.id, ids: sel }]); setSel([]); return }
      if ((k === 'Enter' || k === 'F2') && selected.length === 1 && selected[0].kind === 'shape' && !isLine(selected[0].geom) && !readOnly) { e.preventDefault(); setEditing({ id: selected[0].id }); return }
      // Typing over a selected box starts editing it, as it does everywhere else.
      if (k.length === 1 && !mod && !e.altKey && selected.length === 1 && selected[0].kind === 'shape' && !isLine(selected[0].geom) && !readOnly) { e.preventDefault(); setEditing({ id: selected[0].id, typed: k }); return }
      if (k.startsWith('Arrow') && selected.length && slide && !readOnly) {
        e.preventDefault()
        const d = e.shiftKey ? 10 : 1
        const dx = k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0
        const dy = k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0
        setEls(selected.map((x) => ({ id: x.id, patch: { x: x.x + dx, y: x.y + dy } })))
        return
      }
      if (!selected.length && (k === 'PageDown' || k === 'ArrowDown' || k === 'ArrowRight')) { e.preventDefault(); goSlide(1) }
      if (!selected.length && (k === 'PageUp' || k === 'ArrowUp' || k === 'ArrowLeft')) { e.preventDefault(); goSlide(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- the ribbon's actions ----------------------------------------------------------
  const tableSel = selected.length === 1 && selected[0].kind === 'table' ? (selected[0] as TableEl) : null
  const cellAt = useRef<[number, number]>([0, 0])
  if (editing?.cell) cellAt.current = editing.cell
  const act: SlActions = {
    newSlide: newSlideAfter,
    layout: (k) => slide && run(relayout(deck, slide.id, k)),
    duplicate: () => dupSlide(),
    deleteSlide: () => delSlide(),
    cut: () => { if (copySel() && slide) { run([{ k: 'el-del', slide: slide.id, ids: sel }]); setSel([]) } },
    copy: () => { copySel() },
    paste: () => { if (clip.current) pasteClip(clip.current) },
    mark: (k) => { if (pmRun(pmToggle(k))) return; const on = textTargets.length ? allRuns(textTargets[0].kind === 'shape' ? (textTargets[0] as ShapeEl).text : (textTargets[0] as TableEl).rows[0].cells[0].text, k) : false; withBodies((b) => patchRuns(b, { [k]: on ? undefined : true })) },
    run: (patch) => { if (pmRun(setTs(patch))) return; withBodies((b) => patchRuns(b, patch as never)) },
    growFont: (d) => { const sz = fmt.size || 18; const ladder = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 88, 96, 120]; const i = ladder.findIndex((x) => x >= sz); const n = ladder[Math.max(0, Math.min(ladder.length - 1, (i < 0 ? ladder.length - 1 : i) + d))]; act.run({ size: n }) },
    para: (patch) => { const [[k, v]] = Object.entries(patch); if (pmRun(setPara(k, v))) return; withBodies((b) => patchParas(b, patch as never)) },
    bullets: (kind) => { const on = fmt.bullet === kind; if (pmRun(setPara('bullet', on ? null : kind))) return; withBodies((b) => patchParas(b, { bullet: on ? null : kind })) },
    level: (d) => { if (pmRun(shiftLevel(d))) return; withBodies((b) => ({ ...b, paras: b.paras.map((p) => ({ ...p, level: Math.max(0, Math.min(8, (p.level || 0) + d)) || undefined })) })) },
    anchor: (a) => withBodies((b) => ({ ...b, anchor: a === 't' ? undefined : a })),
    fill: (c) => setEls(selected.filter((e) => e.kind === 'shape').map((e) => ({ id: e.id, patch: { fill: c ? { type: 'solid', color: c } : { type: 'none' } } }))),
    line: (p) => setEls(selected.filter((e) => e.kind !== 'table').map((e) => {
      const ln = ('line' in e ? e.line : undefined) || {}
      if (p.color === null) return { id: e.id, patch: { line: null } }
      const next = { ...ln, ...(p.color ? { color: p.color } : {}), ...(p.width ? { width: p.width } : {}), ...(p.dash ? { dash: p.dash as 'dash' } : {}) }
      if (p.arrows) { next.tail = p.arrows === 'none' ? undefined : 'triangle'; next.head = p.arrows === 'both' ? 'triangle' : undefined }
      if (!next.color) next.color = 'dk1'
      return { id: e.id, patch: { line: next } }
    })),
    shadow: () => setEls(selected.filter((e) => e.kind === 'shape').map((e) => ({ id: e.id, patch: { shadow: !(e as ShapeEl).shadow || undefined } }))),
    arrange: (c) => slide && run(align(deck, slide, sel, c)),
    find: () => setFind({ q: '', r: '', matchCase: false, hits: [], i: 0 }),
    tool: (t) => { setEditing(null); setTool(t) },
    picture: () => pictureInput.current?.click(),
    table: (r, c) => addEl(newTable(deck, r, c)),
    link: () => setLinkDlg({ url: (selected[0] as ShapeEl | undefined)?.link || '' }),
    symbol: (ch) => { if (pmRun((st, d) => { d?.(st.tr.insertText(ch)); return true })) return; addEl({ id: newId(), kind: 'shape', geom: 'rect', x: 100, y: 100, w: 80, h: 60, fill: { type: 'none' }, line: null, text: { ...emptyBody(!!deck.rtl, 32), paras: [{ runs: [{ t: ch, size: 32 }] }] } }) },
    slideNumber: () => addEl({ id: newId(), kind: 'shape', geom: 'rect', x: deck.size.w - 110, y: deck.size.h - 50, w: 80, h: 30, fill: { type: 'none' }, line: null, text: { paras: [{ runs: [{ t: '‹#›' }], align: 'r' }], defaults: { size: 12, color: 'dk2' } } }),
    theme: (th: Theme) => run([{ k: 'deck-set', patch: { theme: clone(th) } }]),
    themeColor: (slot, c) => run([{ k: 'deck-set', patch: { theme: { ...deck.theme, name: deck.theme.name.endsWith('*') ? deck.theme.name : deck.theme.name + '*', colors: { ...deck.theme.colors, [slot]: c } } } }]),
    fonts: (f) => run([{ k: 'deck-set', patch: { theme: { ...deck.theme, fonts: f } } }]),
    slideSize: (w, h) => { if (w !== deck.size.w || h !== deck.size.h) run(resizeDeck(deck, { w, h })) },
    background: (c) => slide && run([{ k: 'slide-set', id: slide.id, patch: { bg: c ? { type: 'solid', color: c } : undefined } }]),
    bgPicture: () => bgInput.current?.click(),
    bgAll: () => slide && run(deck.slides.filter((x) => x.id !== slide.id).map((x) => ({ k: 'slide-set', id: x.id, patch: { bg: slide.bg ? clone(slide.bg) : undefined } }))),
    transition: (k: TransitionKind) => slide && run([{ k: 'slide-set', id: slide.id, patch: { transition: k === 'none' ? undefined : { kind: k, dur: slide.transition?.dur } } }]),
    transitionDur: (ms) => slide?.transition && run([{ k: 'slide-set', id: slide.id, patch: { transition: { ...slide.transition, dur: ms } } }]),
    transitionAll: () => slide && run(deck.slides.filter((x) => x.id !== slide.id).map((x) => ({ k: 'slide-set', id: x.id, patch: { transition: slide.transition ? clone(slide.transition) : undefined } }))),
    present: startShow,
    zoom: setZoom,
    notes: () => setShowNotes((x) => !x),
    rtl: () => run([{ k: 'deck-set', patch: { rtl: !deck.rtl, lang: !deck.rtl ? 'ar-SA' : 'en-US' } }]),
    size: (p) => selected[0] && setEls([{ id: selected[0].id, patch: selected[0].kind === 'image' && (p.w || p.h) ? (p.w ? { w: p.w, h: Math.round((p.w * selected[0].h) / selected[0].w) } : { h: p.h, w: Math.round((p.h! * selected[0].w) / selected[0].h) }) : p }]),
    alt: (a) => selected[0] && setEls([{ id: selected[0].id, patch: { alt: a || undefined } }]),
    cropReset: () => selected[0]?.kind === 'image' && setEls([{ id: selected[0].id, patch: { crop: undefined } }]),
    replacePicture: () => replaceInput.current?.click(),
    pictureShape: (g) => selected[0]?.kind === 'image' && setEls([{ id: selected[0].id, patch: { geom: g === 'rect' ? undefined : g } as Partial<ImageEl> }]),
    tableCmd: (c) => {
      if (!tableSel || !slide) return
      const at = editing?.cell || cellAt.current
      const patch = tableEdit(tableSel, c, at, c === 'merge' ? [at[0], Math.min(tableSel.cols.length - 1, at[1] + 1)] : undefined)
      if (patch) run([{ k: 'el-set', slide: slide.id, id: tableSel.id, patch }])
    },
    cellFill: (c) => { if (!tableSel || !slide) return; const [r, ci] = editing?.cell || cellAt.current; const rows = clone(tableSel.rows); rows[r].cells[ci].fill = c || undefined; run([{ k: 'el-set', slide: slide.id, id: tableSel.id, patch: { rows } }]) },
    tableAccent: (c) => tableSel && slide && run([{ k: 'el-set', slide: slide.id, id: tableSel.id, patch: { style: { ...tableSel.style, accent: c } } }]),
    deleteEl: () => { if (slide && sel.length) { run([{ k: 'el-del', slide: slide.id, ids: sel }]); setSel([]) } },
  }

  const selKind: 'none' | 'shape' | 'text' | 'line' | 'image' | 'table' | 'multi' = !selected.length ? 'none' : selected.length > 1 ? 'multi'
    : selected[0].kind === 'image' ? 'image' : selected[0].kind === 'table' ? 'table' : isLine((selected[0] as ShapeEl).geom) ? 'line' : (selected[0] as ShapeEl).fill?.type === 'none' && (selected[0] as ShapeEl).line === null ? 'text' : 'shape'

  // Following a colleague who is presenting: their slide, full screen, until you stop.
  const followSlide = following && presenter ? deck.slides.find((x) => x.id === presenter.presenting) : null
  useEffect(() => { if (following && !presenter) setFollowing(null) }, [following, presenter])

  if (!slide) return null
  const editBody = editing ? bodyOf(editing) : undefined
  return (
    <EditorShell
      locale={locale} kit={kit} title={title}
      onTitle={(t) => { setTitle(t); setTitleRev((r) => r + 1) }}
      status={persist.status} fileName={persist.fileName} needsPermission={persist.needsPermission}
      onBack={() => { void persist.flush().then(onBack) }}
      onSave={() => void persist.save()} onLink={() => void persist.link()} onUnlink={() => void persist.unlink()}
      exportBlob={persist.exportBlob}
      onExport={async (ext) => { setBusy(OFFICE_STR[locale].exporting); try { const l = await persist.exportDownload(ext); if (l.length) setLoss({ items: l, dir: 'export' }) } finally { setBusy('') } }}
      onPrint={print}
      onUndo={doUndo} onRedo={doRedo} canUndo={undo.current.length > 0} canRedo={redo.current.length > 0}
      collab={collab}
      onSaveCopy={() => void onSaveCopy(pruned(clone(model.deck)), title || s.templates.blank)}
      busy={busy}
      fileExtra={(close) => <RItem testid="sl-import-into" onClick={() => { close(); importInput.current?.click() }}>{locale === 'ar' ? 'إدراج شرائح من ملف…' : 'Insert slides from a file…'}</RItem>}
    >
      <SlidesRibbon s={s} tab={tab} onTab={setTab} fmt={fmt} act={act} readOnly={readOnly} sel={selKind} theme={deck.theme} deckSize={deck.size}
        transition={slide.transition || { kind: 'none' }} zoom={zoom} notes={showNotes} rtl={!!deck.rtl}
        picture={selKind === 'image' ? { alt: (selected[0] as ImageEl).alt || '' } : null}
        table={tableSel ? { header: !!tableSel.style?.header, banded: !!tableSel.style?.banded } : null}
        elSize={selected.length === 1 ? { w: selected[0].w, h: selected[0].h } : null} />
      {presenter && !following && !present && (
        <div className="flex-none flex items-center gap-3 px-3 py-2 text-[0.86rem] border-b border-[color:var(--line-soft)] bg-[color-mix(in_srgb,var(--color-green-600)_10%,var(--surface))]" data-testid="sl-presenting-banner" role="status">
          <span dir="auto">{s.present.isPresenting(presenter.name)}</span>
          <button type="button" data-testid="sl-follow" onClick={() => setFollowing(presenter.client)} className="h-8 px-3 rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold cursor-pointer">{s.present.follow}</button>
        </div>
      )}
      {find && (
        <FindBar s={s} st={find} onChange={(f) => { const hits = findAll(deck, f.q, f.matchCase); setFind({ ...f, hits, i: 0, msg: undefined }); const h = hits[0]; if (h) { setCur(h.slide); setSel([h.el]) } }}
          onStep={(d) => { if (!find.hits.length) return; const i = (find.i + d + find.hits.length) % find.hits.length; setFind({ ...find, i }); const h = find.hits[i]; setCur(h.slide); setSel([h.el]) }}
          onReplace={(all) => { const hits = all ? find.hits : find.hits.slice(find.i, find.i + 1); if (!hits.length) return; run(replaceHits(deck, hits, find.r)); const next = findAll(model.deck, find.q, find.matchCase); setFind({ ...find, hits: next, i: Math.min(find.i, Math.max(0, next.length - 1)), msg: all ? s.replacedN(hits.length) : undefined }) }}
          onClose={() => setFind(null)} readOnly={readOnly} />
      )}
      <div className="flex-1 min-h-0 flex max-[720px]:flex-col-reverse">
        <SlideRail s={s} deck={deck} current={slide.id} onPick={(id) => { setCur(id); setSel([]); setEditing(null) }} onMove={moveSlide}
          onMenu={(e, id) => setMenu({ x: e.clientX, y: e.clientY, slide: id })} readOnly={readOnly} horizontal={narrow}
          peers={peerList.map((p) => ({ client: p.client, name: p.name, color: p.color, slide: p.slide }) as RailPeer)} />
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <SlideCanvas
            deck={deck} slide={slide} number={number}
            selection={sel} onSelect={(ids) => { setSel(ids); if (editing && !ids.includes(editing.id)) setEditing(null) }}
            tool={tool} onTool={setTool} onCreate={onCreate} onTransform={onTransform}
            editing={editing} onEdit={(t) => { if (t) setSel([t.id]); setEditing(t) }}
            editor={(rect) => editBody && editing ? (
              <TextEditor key={`${editing.id}:${editing.cell?.join(',') || ''}`} body={editBody} theme={deck.theme} rect={rect} placeAt={editing.at} typed={editing.typed}
                onChange={onTextChange} onDone={(b) => { const h = editorApi.current?.view.dom.closest('[data-keep-editing]') as HTMLElement | null; onTextDone(b, h ? h.offsetHeight + rect.y : undefined) }}
                onReady={(api) => { editorApi.current = api; bump((x) => x + 1) }} onSelection={() => bump((x) => x + 1)} />
            ) : null}
            peers={peerList.filter((p) => p.slide === slide.id).map((p) => ({ client: p.client, name: p.name, color: p.color, sel: p.sel }) as PeerSel)}
            zoom={zoom} readOnly={readOnly}
            ctx={{ prompts: s.words }}
            onContext={(e, id) => { if (id && !sel.includes(id)) setSel([id]); setMenu({ x: e.clientX, y: e.clientY, el: id }) }}
          />
          {showNotes && (
            <NotesPane key={slide.id} s={s} value={slide.notes || ''} readOnly={readOnly} onChange={(v) => run([{ k: 'slide-set', id: slide.id, patch: { notes: v || undefined } }], false)} />
          )}
          <footer className="flex-none flex items-center gap-4 px-3 h-7 border-t border-[color:var(--line-soft)] bg-[var(--surface)] text-[0.76rem] text-ink-faint" data-testid="sl-status">
            <span data-testid="sl-count">{s.slideN(number, deck.slides.length)}</span>
            <span className="max-[560px]:hidden truncate" dir="auto">{deck.theme.name}</span>
            <div className="flex-1" />
            <input type="range" min={25} max={300} step={5} value={Math.round((zoom || 1) * 100)} aria-label="Zoom" data-testid="sl-zoom" onChange={(e) => setZoom(+e.target.value / 100)} className="w-[110px] max-[480px]:hidden" />
            <button type="button" className="border-0 bg-transparent cursor-pointer text-ink-faint underline" onClick={() => setZoom(null)}>{s.zoomFit}</button>
          </footer>
        </div>
      </div>
      {menu && <ContextMenu s={s} at={menu} readOnly={readOnly} onClose={() => setMenu(null)} items={menu.slide ? [
        { id: 'new', l: s.newSlide, f: () => { setCur(menu.slide!); newSlideAfter('titleContent') } },
        { id: 'dup', l: s.duplicate, f: () => dupSlide(menu.slide) },
        { id: 'hide', l: deck.slides.find((x) => x.id === menu.slide)?.hidden ? s.showSlide : s.hideSlide, f: () => { const x = deck.slides.find((y) => y.id === menu.slide); if (x) run([{ k: 'slide-set', id: x.id, patch: { hidden: !x.hidden || undefined } }]) } },
        { id: 'up', l: s.moveUp, f: () => { const i = deck.slides.findIndex((x) => x.id === menu.slide); if (i > 0) moveSlide(menu.slide!, i - 1) } },
        { id: 'down', l: s.moveDown, f: () => { const i = deck.slides.findIndex((x) => x.id === menu.slide); if (i < deck.slides.length - 1) moveSlide(menu.slide!, i + 2) } },
        { id: 'del', l: s.deleteSlide, f: () => delSlide(menu.slide), danger: true },
      ] : menu.el ? [
        { id: 'cut', l: s.cut, f: act.cut }, { id: 'copy', l: s.copy, f: act.copy }, { id: 'paste', l: s.paste, f: act.paste },
        { id: 'dup', l: s.duplicate, f: () => { if (slide) { const c = copyEls(slide, selected); run(c.map((el) => ({ k: 'el-add', slide: slide.id, el }))); setSel(c.map((x) => x.id)) } } },
        { id: 'front', l: s.front, f: () => act.arrange('front') }, { id: 'back', l: s.back, f: () => act.arrange('back') },
        { id: 'link', l: s.link, f: act.link },
        { id: 'del', l: s.deleteEl, f: act.deleteEl, danger: true },
      ] : [{ id: 'paste', l: s.paste, f: act.paste }, { id: 'new', l: s.newSlide, f: () => newSlideAfter('titleContent') }, { id: 'bg', l: s.background, f: () => setTab('design') }]} />}
      {linkDlg && <LinkDialog s={s} deck={deck} url={linkDlg.url} onClose={() => setLinkDlg(null)}
        onSave={(href) => {
          if (editing && pmRun(pmLink(href))) return
          setEls(selected.map((e) => ({ id: e.id, patch: { link: href || undefined } })))
        }} />}
      <input ref={pictureInput} type="file" multiple hidden data-testid="sl-picture-input" onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ''; void insertPictures(f) }} />
      <input ref={bgInput} type="file" hidden data-testid="sl-bg-input" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f || !slide) return; const r = await pictureFromFile(f, locale); if ('error' in r) { say(r.error); return } const id = newId('m'); run([{ k: 'media-add', id, media: { mime: r.src.slice(5, r.src.indexOf(';')), data: r.src } }, { k: 'slide-set', id: slide.id, patch: { bg: { type: 'image', media: id } } }]) }} />
      <input ref={replaceInput} type="file" hidden data-testid="sl-replace-picture-input" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; const el = selected[0]; if (!f || !slide || el?.kind !== 'image') return; const r = await pictureFromFile(f, locale); if ('error' in r) { say(r.error); return } const id = newId('m'); run([{ k: 'media-add', id, media: { mime: r.src.slice(5, r.src.indexOf(';')), data: r.src } }, { k: 'el-set', slide: slide.id, id: el.id, patch: { media: id, crop: undefined, h: Math.round((el.w * r.h) / r.w) } as Partial<ImageEl> }]) }} />
      <input ref={importInput} type="file" hidden data-testid="sl-import-input" onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setBusy(OFFICE_STR[locale].importing)
        try {
          const r = await kit.importFile(f)
          let after: string | null = cur
          const ops: SOp[] = Object.entries(r.data.media).map(([id, m]) => ({ k: 'media-add', id, media: m }) as SOp)
          for (const m of r.data.masters || []) ops.push({ k: 'master-set', master: m })
          for (const x of r.data.slides) { const ns: Slide = { ...x, id: newId('s'), ord: ordAfter(model.deck.slides, after) }; ops.push({ k: 'slide-add', slide: ns }); model.deck.slides.length; after = ns.id; run([...ops.splice(0)]) }
          if (r.loss.length) setLoss({ items: r.loss, dir: 'import' })
        } catch { say(locale === 'ar' ? 'تعذّر فتح الملف.' : 'The file could not be opened.') } finally { setBusy('') }
      }} />
      {toast && <div role="status" data-testid="sl-toast" className="absolute bottom-10 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[6] px-3 py-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[0.86rem] shadow-[var(--shadow-md)]">{toast}</div>}
      {loss && <LossDialog locale={locale} loss={loss.items} dir={loss.dir} onClose={() => setLoss(null)} />}
      {present && <Present s={s} deck={deck} startAt={present.start} presenter={present.presenter} popup={present.popup} onExit={endShow} locale={locale}
        onSlide={(id) => { presentingSlide.current = id; collab.sendPresence({ slide: id, sel: [], presenting: id }) }} />}
      {followSlide && createPortal(
        <div className="fixed inset-0 z-[90] bg-[#111] grid place-items-center" data-testid="sl-following" onKeyDown={(e) => { if (e.key === 'Escape') setFollowing(null) }} tabIndex={-1}>
          <FollowView deck={deck} slide={followSlide} number={deck.slides.indexOf(followSlide) + 1} />
          <button type="button" data-testid="sl-stop-follow" onClick={() => setFollowing(null)} className="absolute top-3 end-3 h-9 px-3 rounded-md border border-white/20 bg-white/10 text-white text-[0.85rem] cursor-pointer">{s.present.stopFollowing}</button>
          <span className="absolute top-4 start-4 text-white/70 text-[0.85rem]" dir="auto">{s.present.following(presenter!.name)}</span>
        </div>, document.body)}
      {printing && createPortal(<PrintAll deck={deck} />, document.body)}
    </EditorShell>
  )
}

function FollowView({ deck, slide, number }: { deck: DeckData; slide: Slide; number: number }) {
  const [w, setW] = useState(() => Math.min(window.innerWidth, (window.innerHeight * deck.size.w) / deck.size.h))
  useEffect(() => { const f = () => setW(Math.min(window.innerWidth, (window.innerHeight * deck.size.w) / deck.size.h)); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [deck.size.w, deck.size.h])
  return <SlideView slide={slide} width={w} ctx={{ deck, number }} testid="sl-follow-slide" />
}

/** Every slide as a printed page; the rest of the site is hidden while it prints. */
function PrintAll({ deck }: { deck: DeckData }) {
  const W = 1000
  const H = Math.round((W * deck.size.h) / deck.size.w)
  return (
    <div data-testid="sl-print" className="sl-print-root">
      <style>{`@media screen{.sl-print-root{position:fixed;left:-99999px;top:0}}@media print{@page{size:${deck.size.w}pt ${deck.size.h}pt;margin:0}body>*:not(.sl-print-root){display:none!important}.sl-print-root{position:static}.sl-print-page{break-after:page;page-break-after:always;width:${deck.size.w}pt;height:${deck.size.h}pt;overflow:hidden}.sl-print-page>div{transform-origin:0 0;transform:scale(calc(${deck.size.w}pt / ${W}px))}}`}</style>
      {deck.slides.filter((x) => !x.hidden).map((x) => <div key={x.id} className="sl-print-page"><SlideView slide={x} width={W} ctx={{ deck, number: deck.slides.indexOf(x) + 1 }} style={{ height: H }} /></div>)}
    </div>
  )
}

function NotesPane({ s, value, readOnly, onChange }: { s: ReturnType<typeof getStr>; value: string; readOnly: boolean; onChange: (v: string) => void }) {
  const [v, setV] = useState(value)
  const t = useRef<number>()
  useEffect(() => { if (document.activeElement?.getAttribute('data-testid') !== 'sl-notes') setV(value) }, [value])
  return (
    <textarea data-testid="sl-notes" dir="auto" value={v} readOnly={readOnly} placeholder={s.notesPh} aria-label={s.notes}
      onChange={(e) => { setV(e.target.value); window.clearTimeout(t.current); const val = e.target.value; t.current = window.setTimeout(() => onChange(val), 350) }}
      onBlur={() => { window.clearTimeout(t.current); if (v !== value) onChange(v) }}
      className="flex-none h-[96px] max-[720px]:h-[64px] resize-y [font-family:inherit] px-3 py-2 border-0 border-t border-[color:var(--line-soft)] bg-[var(--surface)] text-ink text-[0.9rem] outline-none" />
  )
}
const getStr = () => SL_STR.en

function ContextMenu({ at, items, onClose, readOnly }: { s: ReturnType<typeof getStr>; at: { x: number; y: number }; items: { id: string; l: string; f: () => void; danger?: boolean }[]; onClose: () => void; readOnly: boolean }) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', close) }
  }, [onClose])
  return createPortal(
    <div data-testid="sl-menu" role="menu" style={{ position: 'fixed', top: Math.min(at.y, window.innerHeight - items.length * 36 - 12), left: Math.min(at.x, window.innerWidth - 220) }} className="z-[95] w-[210px] py-1 rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[0_10px_30px_rgba(18,33,27,0.18)]" onPointerDown={(e) => e.stopPropagation()}>
      {items.map((it) => <RItem key={it.id} testid={`sl-menu-${it.id}`} danger={it.danger} disabled={readOnly && it.id !== 'copy'} onClick={() => { onClose(); it.f() }}>{it.l}</RItem>)}
    </div>,
    document.body,
  )
}

function LinkDialog({ s, deck, url: u0, onSave, onClose }: { s: ReturnType<typeof getStr>; deck: DeckData; url: string; onSave: (href: string | null) => void; onClose: () => void }) {
  const [url, setUrl] = useState(u0.startsWith('#') ? '' : u0)
  const [slide, setSlide] = useState(u0.startsWith('#slide:') ? u0.slice(7) : '')
  const u = url.trim()
  const ok = !!slide || /^(https?:\/\/|mailto:|tel:)/i.test(u) || /^[\w.-]+\.[a-z]{2,}/i.test(u)
  const save = () => { if (!ok) return; onSave(slide ? `#slide:${slide}` : /^[a-z]+:/i.test(u) ? u : 'https://' + u); onClose() }
  return (
    <Sheet onClose={onClose} data-testid="sl-link-dialog">
      <SheetTitle>{s.link}</SheetTitle>
      <label className="block mb-3"><span className="block text-[0.8rem] text-ink-soft mb-1">{s.linkUrl}</span><Input autoFocus value={url} onChange={(e) => { setUrl(e.target.value); setSlide('') }} onKeyDown={(e) => { if (e.key === 'Enter') save() }} data-testid="sl-link-url" dir="ltr" className="w-full" /></label>
      <label className="block"><span className="block text-[0.8rem] text-ink-soft mb-1">{s.linkSlide}</span>
        <select value={slide} onChange={(e) => { setSlide(e.target.value); setUrl('') }} data-testid="sl-link-slide" className="w-full h-10 px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink">
          <option value="">—</option>
          {deck.slides.map((x, i) => <option key={x.id} value={x.id}>{i + 1}. {slideTitle(x) || '…'}</option>)}
        </select>
      </label>
      <SheetActions>
        {u0 && <Button onClick={() => { onSave(null); onClose() }} data-testid="sl-link-remove">{s.removeLink}</Button>}
        <Button onClick={onClose}>{s.cancel}</Button>
        <Button variant="primary" disabled={!ok} data-testid="sl-link-save" onClick={save}>{s.ok}</Button>
      </SheetActions>
    </Sheet>
  )
}

function FindBar({ s, st, onChange, onStep, onReplace, onClose, readOnly }: { s: ReturnType<typeof getStr>; st: { q: string; r: string; matchCase: boolean; hits: Hit[]; i: number; msg?: string }; onChange: (f: { q: string; r: string; matchCase: boolean; hits: Hit[]; i: number }) => void; onStep: (d: 1 | -1) => void; onReplace: (all: boolean) => void; onClose: () => void; readOnly: boolean }) {
  const input = 'h-8 px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink text-[0.86rem]'
  const btn = 'h-8 px-2.5 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink text-[0.82rem] cursor-pointer disabled:opacity-40'
  return (
    <div className="flex-none flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-[color:var(--line-soft)] bg-[var(--surface)]" data-testid="sl-findbar" role="search">
      <input autoFocus dir="auto" value={st.q} placeholder={s.findPh} aria-label={s.findPh} data-testid="sl-find-input" className={`${input} w-[220px]`} onChange={(e) => onChange({ ...st, q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') onStep(e.shiftKey ? -1 : 1); if (e.key === 'Escape') onClose() }} />
      <span className="text-[0.8rem] text-ink-faint min-w-[70px]" data-testid="sl-find-count">{st.msg || (st.q ? (st.hits.length ? s.nOfM(st.i + 1, st.hits.length) : s.noMatch) : '')}</span>
      <button type="button" className={btn} disabled={!st.hits.length} onClick={() => onStep(-1)} aria-label="Previous">↑</button>
      <button type="button" className={btn} disabled={!st.hits.length} onClick={() => onStep(1)} aria-label="Next" data-testid="sl-find-next">↓</button>
      <label className="inline-flex items-center gap-1 text-[0.8rem]"><input type="checkbox" checked={st.matchCase} onChange={(e) => onChange({ ...st, matchCase: e.target.checked })} />Aa</label>
      {!readOnly && <>
        <input dir="auto" value={st.r} placeholder={s.replacePh} aria-label={s.replacePh} data-testid="sl-replace-input" className={`${input} w-[180px]`} onChange={(e) => onChange({ ...st, r: e.target.value })} />
        <button type="button" className={btn} disabled={!st.hits.length} data-testid="sl-replace-one" onClick={() => onReplace(false)}>{s.replace}</button>
        <button type="button" className={btn} disabled={!st.hits.length} data-testid="sl-replace-all" onClick={() => onReplace(true)}>{s.replaceAll}</button>
      </>}
      <div className="flex-1" />
      <button type="button" className={btn} onClick={onClose} data-testid="sl-find-close">{s.close}</button>
    </div>
  )
}
