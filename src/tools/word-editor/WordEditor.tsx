// The word processor. ProseMirror holds the document; every change is a step,
// and — in a live session — steps go through the owner, whose copy is the
// truth (prosemirror-collab). Page setup, header and footer travel beside the
// steps as last-writer-wins meta.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EditorState, NodeSelection, TextSelection, type Transaction, type Command } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Fragment, Slice, type Node } from 'prosemirror-model'
import { undo, redo, undoDepth, redoDepth } from 'prosemirror-history'
import {
  isInTable, addRowBefore, addRowAfter, addColumnBefore, addColumnAfter, deleteRow, deleteColumn, deleteTable,
  mergeCells, splitCell, toggleHeaderRow, setCellAttr,
} from 'prosemirror-tables'
import { EditorShell, LossDialog } from '../../components/office/EditorShell'
import { usePersistence, useCollab } from '../../components/office/hooks'
import type { EditorProps } from '../../components/office/OfficeApp'
import { RItem } from '../../components/office/Ribbon'
import { OFFICE_STR } from '../../components/office/strings'
import { pictureFromFile } from '../../lib/office/picture'
import { PrintPreview } from '../../components/office/PrintPreview'
import { printable } from './printable'
import { randomId } from '../../lib/p2p/mesh'
import { colorFor } from '../../lib/collab/session'
import { schema } from './schema'
import { emptyDoc, plainText, wordCount, type PMNode, type PageSetup, type WordData } from './model'
import { PMCollab, collabPlugin, type Host } from './collab'
import * as C from './commands'
import { rules, keys, checklist, peers, find, placeholder, imageView, corePlugins, peersKey, findKey, type Peer } from './plugins'
import { WD_STR } from './strings'
import { WordRibbon, type WdActions, type WdFormat } from './ui/WordRibbon'
import { LinkDialog, FootnoteDialog, FindBar, type FindState } from './ui/Dialogs'
import { WD_CSS } from './ui/docCss'

const S = schema
type Meta = Omit<WordData, 'doc'>
type Dialog = { k: 'link'; url: string; text: string; edit: boolean } | { k: 'footnote' } | null

const MM = 96 / 25.4
const metaOf = (d: WordData): Meta => ({ page: d.page, header: d.header, footer: d.footer, rtl: d.rtl, lang: d.lang })

function safeDoc(j: PMNode | undefined, rtl: boolean): Node {
  try { const n = S.nodeFromJSON(j); n.check(); return n } catch { return S.nodeFromJSON(emptyDoc(rtl).doc) }
}
function validMeta(m: unknown): Meta | null {
  const x = m as Meta
  if (!x || typeof x !== 'object' || !x.page || typeof x.page.width !== 'number' || typeof x.page.height !== 'number' || !x.page.margins) return null
  return { page: x.page, header: typeof x.header === 'string' ? x.header : undefined, footer: typeof x.footer === 'string' ? x.footer : undefined, rtl: !!x.rtl, lang: typeof x.lang === 'string' ? x.lang : undefined }
}

export default function WordEditor({ locale, kit, doc, joinRoom, onBack, onSaveCopy, importLoss }: EditorProps<WordData>) {
  const s = WD_STR[locale]
  const guest = !!joinRoom
  const initial = useMemo<WordData>(() => {
    const d = (doc?.data as WordData | undefined) || kit.blank()
    return { ...d, page: d.page || emptyDoc().page }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const clientID = useMemo(() => randomId(10), [])
  const mount = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [meta, setMetaState] = useState<Meta>(() => metaOf(initial))
  const metaRef = useRef(meta)
  metaRef.current = meta
  const [rev, setRev] = useState(0)
  const [, setTick] = useState(0)
  const [title, setTitle] = useState(doc?.title || '')
  const [titleRev, setTitleRev] = useState(0)
  const [tab, setTab] = useState('home')
  const [zoom, setZoomRaw] = useState(1)
  // Until somebody picks a zoom, a page wider than the screen is shown WHOLE, at its
  // real proportions: the page is the document's layout, and a phone squeezing it
  // into a column would show line breaks the printout does not have.
  const zoomChosen = useRef(false)
  const setZoom = useCallback((z: number) => { zoomChosen.current = true; setZoomRaw(z) }, [])
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [pageView, setPageView] = useState(true)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [findOpen, setFindOpen] = useState<{ replace: boolean } | null>(null)
  const [findState, setFindState] = useState<{ ranges: { from: number; to: number }[]; i: number; q: FindState | null; msg?: string }>({ ranges: [], i: 0, q: null })
  const [loss, setLoss] = useState<{ items: string[]; dir: 'import' | 'export' } | null>(importLoss?.length ? { items: importLoss, dir: 'import' } : null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState('')
  const [paperH, setPaperH] = useState(0)
  const paperRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pictureInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const editable = useRef(!guest)
  const hooks = useRef<{ onLink?: () => void; onFind?: (r: boolean) => void; onPrint?: () => void }>({})
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 3500) }

  const makePlugins = useCallback((version: number) => [
    rules(),
    ...keys({ onLink: () => hooks.current.onLink?.(), onFind: (r) => hooks.current.onFind?.(r), onPrint: () => hooks.current.onPrint?.() }),
    checklist(() => editable.current),
    peers(),
    find(),
    placeholder(() => s.placeholder),
    ...corePlugins(),
    collabPlugin(version, clientID),
  ], [clientID]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the collaboration host ---------------------------------------------------
  const pmRef = useRef<PMCollab | null>(null)
  const host = useMemo<Host>(() => ({
    getState: () => viewRef.current!.state,
    apply: (tr: Transaction) => {
      const v = viewRef.current!
      v.updateState(v.state.apply(tr))
      if (tr.docChanged) setRev((r) => r + 1)
      setTick((t) => t + 1)
    },
    reset: (d, version) => {
      const v = viewRef.current!
      v.updateState(EditorState.create({ doc: d, plugins: makePlugins(version) }))
      setRev((r) => r + 1)
      setTick((t) => t + 1)
    },
    getMeta: () => metaRef.current,
    setMeta: (m) => { const x = validMeta(m); if (x) { metaRef.current = x; setMetaState(x); setRev((r) => r + 1) } },
  }), [makePlugins])
  const pm = useMemo(() => { const p = new PMCollab(S, host, !guest); pmRef.current = p; return p }, [host, guest])

  const collab = useCollab({ adapter: pm, kind: 'word', title: title || s.templates.blank, onMeta: (m) => { if (m.title) setTitle(m.title) } })
  useEffect(() => { if (joinRoom) collab.join(joinRoom) }, [joinRoom]) // eslint-disable-line react-hooks/exhaustive-deps
  const readOnly = !collab.canEdit
  useEffect(() => { editable.current = !readOnly; viewRef.current?.setProps({}) }, [readOnly])

  // ---- the view -------------------------------------------------------------------
  useLayoutEffect(() => {
    const state = EditorState.create({ doc: safeDoc(guest ? emptyDoc(locale === 'ar').doc : initial.doc, !!initial.rtl), plugins: makePlugins(0) })
    const view = new EditorView(mount.current!, {
      state,
      editable: () => editable.current,
      attributes: { 'data-testid': 'wd-editor', spellcheck: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Document' },
      nodeViews: { image: (n, v, getPos) => imageView(v, getPos, n, () => editable.current), page_break: () => pageBreakView() },
      dispatchTransaction(tr) {
        const v = viewRef.current!
        v.updateState(v.state.apply(tr))
        if (tr.docChanged) { setRev((r) => r + 1); pmRef.current?.flush() }
        if (tr.docChanged || tr.selectionSet) setTick((t) => t + 1)
      },
      handlePaste(_v, e) {
        const files = [...(e.clipboardData?.files || [])]
        if (!files.length || !editable.current) return false
        e.preventDefault()
        void insertPictures(files)
        return true
      },
      handleDrop(v, e) {
        const files = [...((e as DragEvent).dataTransfer?.files || [])]
        if (!files.length || !editable.current) return false
        e.preventDefault()
        const at = v.posAtCoords({ left: (e as DragEvent).clientX, top: (e as DragEvent).clientY })
        if (at) v.dispatch(v.state.tr.setSelection(TextSelection.near(v.state.doc.resolve(at.pos))))
        void insertPictures(files)
        return true
      },
    })
    viewRef.current = view
    setTick((t) => t + 1)
    if (!guest) view.focus()
    return () => { view.destroy(); viewRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const view = viewRef.current
  const state = view?.state
  const run = useCallback((cmd: Command) => {
    const v = viewRef.current
    if (!v || !editable.current) return false
    const ok = cmd(v.state, v.dispatch, v)
    v.focus()
    return ok
  }, [])

  // Presence: where my cursor is, and drawing everybody else's.
  useEffect(() => { if (state) collab.sendPresence({ from: state.selection.from, to: state.selection.to }) }, [state?.selection.from, state?.selection.to, collab.state]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = viewRef.current
    if (!v) return
    const list: Peer[] = Object.entries(collab.presence).flatMap(([client, p]) => {
      const d = p.d as { from?: number; to?: number }
      const m = collab.roster.find((x) => x.client === client)
      if (client === collab.me || typeof d?.from !== 'number' || typeof d?.to !== 'number') return []
      return [{ client, name: m?.name || '…', color: m?.color || colorFor(client), from: d.from, to: d.to }]
    })
    v.dispatch(v.state.tr.setMeta(peersKey, list).setMeta('addToHistory', false))
  }, [collab.presence, collab.roster, collab.me])

  // ---- meta (page setup, header, footer) ---------------------------------------------
  const updateMeta = useCallback((patch: Partial<Meta>) => {
    if (!editable.current) return
    const next = { ...metaRef.current, ...patch }
    metaRef.current = next
    setMetaState(next)
    setRev((r) => r + 1)
    pmRef.current?.sendMeta(next)
  }, [])
  const setPage = (p: Partial<PageSetup>) => updateMeta({ page: { ...meta.page, ...p, margins: { ...meta.page.margins, ...(p.margins || {}) } } })

  // ---- persistence ------------------------------------------------------------------
  const stored = useMemo(() => (doc ? { ...doc, title } : null), [doc, title])
  const getData = useCallback((): WordData => ({ ...metaRef.current, doc: (viewRef.current?.state.doc.toJSON() as PMNode) || initial.doc }), [initial])
  const persist = usePersistence({ doc: stored, kit, getData, rev: rev + titleRev * 1e9, disabled: guest, onLoss: (l) => setLoss({ items: l, dir: 'export' }) })

  // ---- pictures -----------------------------------------------------------------------
  const insertPictures = useCallback(async (files: File[]) => {
    for (const f of files) {
      const r = await pictureFromFile(f, locale)
      if ('error' in r) { say(r.error); continue }
      const v = viewRef.current
      if (!v) return
      const maxW = Math.round((metaRef.current.page.width - metaRef.current.page.margins.left - metaRef.current.page.margins.right) * MM)
      const w = Math.min(r.w, maxW)
      const node = S.nodes.image.create({ src: r.src, alt: f.name.replace(/\.[^.]+$/, ''), width: w, height: Math.round((w * r.h) / Math.max(1, r.w)) })
      v.dispatch(v.state.tr.replaceSelectionWith(node).scrollIntoView())
    }
    viewRef.current?.focus()
  }, [locale]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- find ---------------------------------------------------------------------------
  const applyFind = useCallback((ranges: { from: number; to: number }[], i: number, q: FindState | null, msg?: string) => {
    setFindState({ ranges, i, q, msg })
    const v = viewRef.current
    if (!v) return
    const tr = v.state.tr.setMeta(findKey, { ranges, current: i }).setMeta('addToHistory', false)
    const r = ranges[i]
    if (r) tr.setSelection(TextSelection.create(v.state.doc, r.from, r.to)).scrollIntoView()
    v.dispatch(tr)
  }, [])
  const search = useCallback((q: FindState) => {
    const v = viewRef.current
    if (!v) return
    const ranges = C.findInDoc(v.state.doc, q.q, q)
    const from = v.state.selection.from
    const i = Math.max(0, ranges.findIndex((r) => r.from >= from))
    applyFind(ranges, ranges.length ? i : 0, q)
  }, [applyFind])
  const step = (d: 1 | -1) => {
    const n = findState.ranges.length
    if (!n) return
    applyFind(findState.ranges, (findState.i + d + n) % n, findState.q)
  }
  const replaceOne = (w: string) => {
    const v = viewRef.current
    const r = findState.ranges[findState.i]
    if (!v || !r || !editable.current) return
    v.dispatch(v.state.tr.insertText(w, r.from, r.to))
    if (findState.q) {
      const ranges = C.findInDoc(viewRef.current!.state.doc, findState.q.q, findState.q)
      const at = r.from + w.length
      const i = Math.max(0, ranges.findIndex((x) => x.from >= at))
      applyFind(ranges, ranges.length ? i : 0, findState.q)
    }
  }
  const replaceAll = (w: string) => {
    const v = viewRef.current
    if (!v || !editable.current || !findState.ranges.length) return
    const tr = v.state.tr
    for (const r of [...findState.ranges].reverse()) tr.insertText(w, r.from, r.to)
    v.dispatch(tr)
    applyFind([], 0, findState.q, s.replacedN(findState.ranges.length))
  }
  const closeFind = () => { setFindOpen(null); applyFind([], 0, null); viewRef.current?.focus() }

  // ---- printing -----------------------------------------------------------------------
  const [preview, setPreview] = useState(false)
  const print = useCallback(() => setPreview(true), [])

  hooks.current = {
    onLink: () => openLink(),
    onFind: (replace) => setFindOpen({ replace }),
    onPrint: () => print(),
  }

  // ---- what the ribbon shows ------------------------------------------------------------
  const fmt: WdFormat = useMemo(() => {
    if (!state) return { bold: false, italic: false, underline: false, strike: false, sup: false, sub: false, code: false, style: 'normal', align: null, dir: null, lineHeight: null, list: null, link: null }
    const ts = C.textStyleAt(state)
    const l = C.listAt(state)
    return {
      bold: C.markActive(state, S.marks.bold), italic: C.markActive(state, S.marks.italic), underline: C.markActive(state, S.marks.underline),
      strike: C.markActive(state, S.marks.strike), sup: C.markActive(state, S.marks.sup), sub: C.markActive(state, S.marks.sub), code: C.markActive(state, S.marks.code),
      color: (ts.color as string) || undefined, highlight: (ts.highlight as string) || undefined, font: (ts.font as string) || undefined, size: (ts.size as number) || undefined,
      style: C.currentStyle(state), align: (C.blockAttr(state, 'align') as string) || null, dir: (C.blockAttr(state, 'dir') as string) || null, lineHeight: (C.blockAttr(state, 'lineHeight') as number) || null,
      list: !l ? null : l.node.type === S.nodes.ordered_list ? 'ordered' : l.node.attrs.checklist ? 'check' : 'bullet',
      listKind: l?.node.attrs.kind,
      link: C.linkAt(state),
    }
  }, [state])
  const inTable = !!state && isInTable(state)
  const img = state ? C.selectedImage(state) : null
  const box = state ? C.textBoxAt(state) : null

  const openLink = () => {
    const v = viewRef.current
    if (!v || !editable.current) return
    const st = v.state
    const href = C.linkAt(st)
    const range = href && st.selection.empty ? C.linkRange(st) : null
    const text = range ? st.doc.textBetween(range[0], range[1]) : st.doc.textBetween(st.selection.from, st.selection.to)
    if (range) v.dispatch(st.tr.setSelection(TextSelection.create(st.doc, range[0], range[1])))
    setDialog({ k: 'link', url: href || '', text, edit: !!href })
  }

  const act: WdActions = {
    mark: (n) => run(C.toggle(n)),
    textStyle: (p) => run(C.setTextStyle(p)),
    clear: () => run(C.clearFormatting),
    style: (x) => run(C.setStyle(x)),
    list: (k, kind) => run(k === 'ordered' ? C.toggleList(S.nodes.ordered_list, kind ? { kind } : {}) : C.toggleList(S.nodes.bullet_list, { checklist: k === 'check' })),
    indent: (d) => run(C.indent(d)),
    align: (a) => run(C.setBlockAttr('align', a)),
    dir: (d) => run(C.setBlockAttr('dir', d)),
    lineHeight: (x) => run(C.setBlockAttr('lineHeight', x)),
    table: (r, c) => run(C.insertTable(r, c)),
    picture: () => pictureInput.current?.click(),
    link: openLink,
    pageBreak: () => run(C.insertBlock(S.nodes.page_break)),
    rule: () => run(C.insertBlock(S.nodes.horizontal_rule)),
    footnote: () => { if (editable.current) setDialog({ k: 'footnote' }) },
    symbol: (ch) => run((st, d) => { d?.(st.tr.insertText(ch)); return true }),
    date: () => run((st, d) => { d?.(st.tr.insertText(new Date().toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))); return true }),
    pageSize: (w, h) => setPage(meta.page.landscape ? { width: Math.max(w, h), height: Math.min(w, h) } : { width: Math.min(w, h), height: Math.max(w, h) }),
    orientation: (l) => { const a = Math.min(meta.page.width, meta.page.height); const b = Math.max(meta.page.width, meta.page.height); setPage(l ? { width: b, height: a, landscape: true } : { width: a, height: b, landscape: false }) },
    margins: (mm) => setPage({ margins: { top: mm, bottom: mm, left: mm, right: mm } }),
    docDir: (rtl) => {
      updateMeta({ rtl, lang: rtl ? (meta.lang?.startsWith('ar') ? meta.lang : 'ar-SA') : (meta.lang?.startsWith('ar') ? 'en-US' : meta.lang || 'en-US') })
      // Paragraphs that already chose a direction keep it; the rest follow the document.
      run((st, d) => {
        const tr = st.tr
        st.doc.descendants((n, pos) => { if (n.isTextblock && 'dir' in n.attrs && !n.attrs.dir && !n.textContent.trim()) tr.setNodeMarkup(pos, undefined, { ...n.attrs, dir: rtl ? 'rtl' : null }); return !n.isTextblock })
        if (tr.docChanged) d?.(tr)
        return true
      })
    },
    find: (r) => setFindOpen({ replace: !!r }),
    zoom: setZoom,
    outline: () => setOutlineOpen((o) => !o),
    pageView: () => setPageView((p) => !p),
    table_: (cmd) => {
      const m = { rowBefore: addRowBefore, rowAfter: addRowAfter, colBefore: addColumnBefore, colAfter: addColumnAfter, deleteRow, deleteCol: deleteColumn, deleteTable, merge: mergeCells, split: splitCell, headerRow: toggleHeaderRow }
      run(m[cmd])
    },
    cellShade: (c) => run(setCellAttr('background', c)),
    picturePatch: (p) => run((st, d) => {
      const im = C.selectedImage(st)
      if (!im) return false
      const a = im.node.attrs
      const width = p.width === undefined ? a.width : p.width
      const height = p.width === undefined ? a.height : p.width && a.width && a.height ? Math.round((p.width * a.height) / a.width) : null
      const tr = st.tr.setNodeMarkup(im.pos, undefined, { ...a, width, height, alt: p.alt ?? a.alt, float: p.float === undefined ? a.float : p.float })
      tr.setSelection(NodeSelection.create(tr.doc, im.pos))
      d?.(tr)
      return true
    }),
    pictureDelete: () => run((st, d) => { const im = C.selectedImage(st); if (!im) return false; d?.(st.tr.delete(im.pos, im.pos + im.node.nodeSize)); return true }),
    textBox: () => run(C.insertTextBox),
    textBoxPatch: (p) => run(C.setTextBox(p)),
    textBoxDelete: () => run(C.unwrapTextBox),
  }

  // Page count: measured, not paginated. The page view draws a boundary every page-height.
  const page = meta.page
  const pageHpx = page.height * MM
  const pageWpx = (page.landscape ? Math.max(page.width, page.height) : page.width) * MM
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !pageView) return
    const fit = () => {
      if (zoomChosen.current) return
      const z = Math.min(1, Math.floor(((el.clientWidth - 24) / pageWpx) * 100) / 100)
      setZoomRaw(Math.max(0.25, z))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pageView, pageWpx])
  useEffect(() => {
    const el = paperRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPaperH(el.scrollHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [pageView])
  // In the page view a page break is a spacer that pushes what follows to the top
  // of the next page, so the boundaries drawn and the count agree with where the
  // breaks are. Each one is laid out after the one before it has moved things.
  useLayoutEffect(() => {
    const paper = paperRef.current
    if (!paper) return
    const els = [...paper.querySelectorAll<HTMLElement>('[data-page-break]')]
    for (const el of els) el.style.height = '0px'
    if (!pageView) return
    for (const el of els) {
      const top = offsetIn(el, paper)
      const next = (Math.floor(top / pageHpx) + 1) * pageHpx + page.margins.top * MM
      el.style.height = `${Math.max(0, next - top)}px`
    }
    setPaperH(paper.scrollHeight)
  })
  const pages = pageView ? Math.max(1, Math.ceil((paperH - 1) / pageHpx)) : 1
  const breaks = state ? countBreaks(state.doc) : 0
  const totalPages = pages + (pageView ? 0 : breaks)
  const caretPage = (() => {
    const v = viewRef.current
    const paper = paperRef.current
    if (!v || !paper || !pageView) return 1
    try {
      const at = v.coordsAtPos(v.state.selection.from).top
      return Math.max(1, Math.min(totalPages, Math.floor((at - paper.getBoundingClientRect().top) / (pageHpx * zoom)) + 1))
    } catch { return 1 }
  })()
  const text = state ? plainText(state.doc.toJSON() as PMNode) : ''
  const words = wordCount(text)
  const outline = state ? C.outline(state.doc) : []
  const footnotes: string[] = []
  state?.doc.descendants((n) => { if (n.type === S.nodes.footnote) footnotes.push(n.attrs.text); return true })
  const fill = (t?: string) => (t || '').replace(/\{pages\}/g, String(totalPages))

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
      onPrint={print}
      onUndo={() => { const v = viewRef.current; if (v) { undo(v.state, v.dispatch); v.focus() } }}
      onRedo={() => { const v = viewRef.current; if (v) { redo(v.state, v.dispatch); v.focus() } }}
      canUndo={!!state && undoDepth(state) > 0}
      canRedo={!!state && redoDepth(state) > 0}
      collab={collab}
      onSaveCopy={() => void onSaveCopy(getData(), title || s.templates.blank)}
      busy={busy}
      fileExtra={(close) => <RItem testid="wd-import-into" onClick={() => { close(); importInput.current?.click() }}>{s.importInto}</RItem>}
    >
      <style>{WD_CSS}</style>
      <WordRibbon s={s} tab={tab} onTab={setTab} fmt={fmt} act={act} readOnly={readOnly} inTable={inTable}
        picture={img ? { width: img.node.attrs.width, alt: img.node.attrs.alt || '', float: img.node.attrs.float } : null}
        textBox={box ? { float: box.node.attrs.float, border: box.node.attrs.border } : null}
        page={{ width: page.width, height: page.height, margins: page.margins.left, landscape: !!page.landscape }} rtl={!!meta.rtl} zoom={zoom} outline={outlineOpen} pageView={pageView} />
      {findOpen && <FindBar s={s} replace={findOpen.replace} count={findState.ranges.length} index={findState.i} readOnly={readOnly} message={findState.msg}
        onSearch={search} onStep={step} onReplace={replaceOne} onReplaceAll={replaceAll} onClose={closeFind} />}
      <div className="flex-1 min-h-0 flex">
        {outlineOpen && (
          <aside className="flex-none w-[220px] max-[720px]:hidden overflow-auto border-e border-[color:var(--line-soft)] bg-[var(--surface)] py-2" data-testid="wd-outline-pane">
            <div className="px-3 pb-1 text-[0.72rem] uppercase tracking-wide rtl:tracking-normal text-ink-faint">{s.outline}</div>
            {outline.length === 0 && <p className="px-3 text-[0.82rem] text-ink-faint">{s.outlineEmpty}</p>}
            {outline.map((h, i) => (
              <button key={i} type="button" dir="auto" data-testid="wd-outline-item" onClick={() => { const v = viewRef.current; if (!v) return; v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, h.pos + 1)).scrollIntoView()); v.focus() }}
                className="block w-full text-start py-1 pe-2 border-0 bg-transparent cursor-pointer text-[0.84rem] text-ink hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] truncate" style={{ paddingInlineStart: 12 + (h.level - 1) * 12 }}>{h.text || '—'}</button>
            ))}
          </aside>
        )}
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-auto bg-[color-mix(in_srgb,var(--ink)_7%,var(--bg))]" data-testid="wd-scroll" onMouseDown={(e) => { if (e.target === e.currentTarget) viewRef.current?.focus() }}>
          <div data-zoom={zoom} style={{ zoom }} className={pageView ? 'py-6 px-3 w-fit min-w-full' : 'py-6 px-3 max-[560px]:px-0 max-[560px]:py-0'}>
            <div
              ref={paperRef}
              data-wd-page=""
              data-testid="wd-page"
              data-pages={totalPages}
              data-paged={pageView ? '' : undefined}
              dir={meta.rtl ? 'rtl' : 'ltr'}
              lang={meta.lang || (meta.rtl ? 'ar' : 'en')}
              className={`relative mx-auto bg-white text-[#1b1b1b] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_6px_24px_rgba(0,0,0,0.08)]${pageView ? '' : ' max-[560px]:shadow-none'}`}
              style={pageView
                ? { width: `${page.width}mm`, minHeight: `${page.height}mm`, padding: `${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm`, boxSizing: 'border-box' }
                : { maxWidth: '52em', padding: '2.5em 3em', boxSizing: 'border-box' }}
              onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); const v = viewRef.current; if (v) { v.dispatch(v.state.tr.setSelection(TextSelection.atEnd(v.state.doc))); v.focus() } } }}
            >
              {pageView && Array.from({ length: pages - 1 }, (_, i) => (
                <div key={i} aria-hidden className="absolute inset-x-0 border-t border-dashed border-[#c9d1cc] pointer-events-none" style={{ top: (i + 1) * pageHpx }} data-testid="wd-page-boundary">
                  <span className="absolute -top-2.5 end-2 bg-white px-1 text-[9px] text-[#8a9a91]">{i + 2}</span>
                </div>
              ))}
              <input
                dir="auto"
                data-testid="wd-header"
                aria-label={s.header}
                value={meta.header || ''}
                placeholder={readOnly ? '' : s.headerPh}
                readOnly={readOnly}
                onChange={(e) => updateMeta({ header: e.target.value })}
                className="block w-full mb-4 -mt-2 px-1 py-0.5 text-[9pt] text-[#5f6b65] bg-transparent border-0 border-b border-dashed border-transparent hover:border-[#d7ddd9] focus:border-green-600 outline-none placeholder:text-[#c2c9c5]"
              />
              <div ref={mount} />
              {footnotes.length > 0 && (
                <ol className="mt-6 pt-2 border-t border-[#ccc] text-[9pt] text-[#444] ps-5 list-decimal" data-testid="wd-footnotes">
                  {footnotes.map((f, i) => <li key={i} dir="auto">{f}</li>)}
                </ol>
              )}
              <input
                dir="auto"
                data-testid="wd-footer"
                aria-label={s.footer}
                value={meta.footer || ''}
                placeholder={readOnly ? '' : s.footerPh}
                readOnly={readOnly}
                onChange={(e) => updateMeta({ footer: e.target.value })}
                title={fill(meta.footer).replace(/\{page\}/g, '1')}
                className="block w-full mt-6 px-1 py-0.5 text-[9pt] text-center text-[#5f6b65] bg-transparent border-0 border-t border-dashed border-transparent hover:border-[#d7ddd9] focus:border-green-600 outline-none placeholder:text-[#c2c9c5]"
              />
            </div>
          </div>
        </div>
      </div>
      <footer className="flex-none flex items-center gap-4 px-3 h-7 border-t border-[color:var(--line-soft)] bg-[var(--surface)] text-[0.76rem] text-ink-faint" data-testid="wd-status">
        <span data-testid="wd-pages">{s.pageN(caretPage, totalPages)}</span>
        <span data-testid="wd-words" data-count={words}>{s.words(words)}</span>
        <span className="max-[560px]:hidden" data-testid="wd-chars">{s.chars([...text.replace(/\n/g, '')].length)}</span>
        <div className="flex-1" />
        <input type="range" min={50} max={200} step={5} value={Math.round(zoom * 100)} aria-label={s.zoom} data-testid="wd-zoom" onChange={(e) => setZoom(+e.target.value / 100)} className="w-[110px] max-[480px]:hidden" />
        <span className="w-10 text-end">{Math.round(zoom * 100)}%</span>
      </footer>
      {toast && <div role="status" data-testid="wd-toast" className="absolute bottom-10 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[6] px-3 py-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[0.86rem] shadow-[var(--shadow-md)]">{toast}</div>}
      <input ref={pictureInput} type="file" multiple hidden data-testid="wd-picture-input" onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ''; void insertPictures(f) }} />
      <input ref={importInput} type="file" hidden data-testid="wd-import-input" onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setBusy(OFFICE_STR[locale].importing)
        try {
          const r = await kit.importFile(f)
          const v = viewRef.current
          if (v && editable.current) {
            const d = safeDoc(r.data.doc, !!r.data.rtl)
            v.dispatch(v.state.tr.replaceSelection(new Slice(Fragment.from(d.content), 0, 0)).scrollIntoView())
          }
          if (r.loss.length) setLoss({ items: r.loss, dir: 'import' })
        } catch { say(locale === 'ar' ? 'تعذّر فتح الملف.' : 'The file could not be opened.') } finally { setBusy('') }
      }} />
      {dialog?.k === 'link' && (
        <LinkDialog s={s} url={dialog.url} text={dialog.text} onClose={() => { setDialog(null); viewRef.current?.focus() }}
          onSave={(u, t) => run(C.setLink(u, t || undefined))}
          onRemove={dialog.edit ? () => run(C.setLink(null)) : undefined} />
      )}
      {dialog?.k === 'footnote' && (
        <FootnoteDialog s={s} text="" onClose={() => { setDialog(null); viewRef.current?.focus() }}
          onSave={(t) => run(C.insertNode(S.nodes.footnote.create({ text: t })))} />
      )}
      {loss && <LossDialog locale={locale} loss={loss.items} dir={loss.dir} onClose={() => setLoss(null)} />}
      {preview && <PrintPreview locale={locale} build={() => printable(getData(), title || s.templates.blank)} onClose={() => { setPreview(false); viewRef.current?.focus() }} />}
    </EditorShell>
  )
}

function offsetIn(el: HTMLElement, root: HTMLElement): number {
  let y = 0
  let n: HTMLElement | null = el
  while (n && n !== root) { y += n.offsetTop; n = n.offsetParent as HTMLElement | null }
  return y
}

/** The page break's DOM is ours to resize, so ProseMirror is told to leave it alone. */
function pageBreakView() {
  const dom = document.createElement('div')
  dom.className = 'page-break'
  dom.setAttribute('data-page-break', '1')
  dom.contentEditable = 'false'
  return { dom, ignoreMutation: () => true }
}

function countBreaks(doc: Node): number {
  let n = 0
  doc.forEach((c) => { if (c.type === S.nodes.page_break) n++ })
  return n
}
