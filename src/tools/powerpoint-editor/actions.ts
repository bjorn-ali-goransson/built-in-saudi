// What the ribbon and the keyboard do to a deck, as pure functions that return
// the OPS to apply. Pure so each is testable on a plain deck, and ops so each is
// undoable and travels to collaborators like any other edit.
import { bounds } from './canvasGeom'
import { layoutElements, newId, newSlide, type Cell, type DeckData, type El, type LayoutKind, type ShapeEl, type Slide, type TableEl, type TextBody } from './model'
import { keyBetween, ordAfter, ordEnd, byOrd } from './order'
import type { SOp } from './doc'
import type { ArrangeCmd } from './ui/SlidesRibbon'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/** A copy of elements with fresh ids, offset, stacked on top in their original order. */
export function copyEls(slide: Slide, els: El[], offset = 12): El[] {
  let ord = ordEnd(slide.elements)
  return [...els].sort(byOrd).map((e) => { const c = { ...clone(e), id: newId(), x: e.x + offset, y: e.y + offset, ord }; ord = keyBetween(ord, null); return c })
}

export function duplicateSlide(d: DeckData, id: string): { ops: SOp[]; newId: string } {
  const s = d.slides.find((x) => x.id === id)
  if (!s) return { ops: [], newId: id }
  const copy: Slide = { ...clone(s), id: newId('s'), ord: ordAfter(d.slides, id), elements: s.elements.map((e) => ({ ...clone(e), id: newId() })) }
  return { ops: [{ k: 'slide-add', slide: copy }], newId: copy.id }
}

export function addSlide(d: DeckData, after: string | null, kind: LayoutKind): { ops: SOp[]; newId: string } {
  const s = newSlide(kind, d)
  const prev = after ? d.slides.find((x) => x.id === after) : undefined
  if (prev?.master) s.master = prev.master
  s.ord = ordAfter(d.slides, after)
  const k = s.elements.length
  let o = keyBetween(null, null)
  for (let i = 0; i < k; i++) { s.elements[i].ord = o; o = keyBetween(o, null) }
  return { ops: [{ k: 'slide-add', slide: s }], newId: s.id }
}

/**
 * Change a slide's layout, keeping what was typed: the title moves to the new
 * title, body text to the new body placeholders in order, and anything that
 * is not a placeholder stays exactly where it was.
 */
export function relayout(d: DeckData, slideId: string, kind: LayoutKind): SOp[] {
  const s = d.slides.find((x) => x.id === slideId)
  if (!s) return []
  const fresh = layoutElements(kind, d.size, !!d.rtl)
  const old = s.elements.filter((e): e is ShapeEl => e.kind === 'shape' && !!e.ph)
  const titleOld = old.find((e) => e.ph === 'title' || e.ph === 'ctrTitle')
  const bodiesOld = old.filter((e) => e !== titleOld)
  const has = (b?: TextBody) => !!b?.paras.some((p) => p.runs.some((r) => r.t))
  let bi = 0
  for (const f of fresh as ShapeEl[]) {
    const src = f.ph === 'title' || f.ph === 'ctrTitle' ? titleOld : bodiesOld[bi++]
    // A placeholder that never shows bullets (a title, a subtitle) drops them; one that does keeps the source's.
    const target = f.text!.paras[0]?.bullet ?? null
    if (src?.text && has(src.text)) f.text = { ...f.text!, paras: src.text.paras.map((p) => ({ ...p, bullet: target === null ? null : p.bullet ?? target })) }
  }
  // Text the new layout has no room for is kept as a plain text box, never dropped.
  const orphans = bodiesOld.slice(bi).filter((e) => has(e.text)).map((e) => ({ ...clone(e), ph: undefined }) as ShapeEl)
  let o = keyBetween(null, null)
  for (const e of fresh) { e.ord = o; o = keyBetween(o, null) }
  const ops: SOp[] = [{ k: 'el-del', slide: slideId, ids: old.map((e) => e.id) }]
  for (const e of [...fresh, ...orphans]) { if (!e.ord) { e.ord = o; o = keyBetween(o, null) } ops.push({ k: 'el-add', slide: slideId, el: e }) }
  ops.push({ k: 'slide-set', id: slideId, patch: { layout: kind } })
  return ops
}

/** Bring forward / send backward / to front / to back, as new order keys. */
export function zOrder(slide: Slide, ids: string[], cmd: 'front' | 'back' | 'forward' | 'backward'): SOp[] {
  const list = [...slide.elements].sort(byOrd)
  const moving = list.filter((e) => ids.includes(e.id))
  const rest = list.filter((e) => !ids.includes(e.id))
  const ops: SOp[] = []
  if (cmd === 'front') { let o = ordEnd(rest); for (const e of moving) { ops.push({ k: 'el-z', slide: slide.id, id: e.id, ord: o }); o = keyBetween(o, null) } }
  else if (cmd === 'back') { let lo: string | null = null; const hi = rest[0]?.ord ?? null; for (const e of moving) { const k = keyBetween(lo, hi); ops.push({ k: 'el-z', slide: slide.id, id: e.id, ord: k }); lo = k } }
  else {
    for (const e of cmd === 'forward' ? [...moving].reverse() : moving) {
      const i = list.findIndex((x) => x.id === e.id)
      const j = cmd === 'forward' ? i + 1 : i - 1
      if (j < 0 || j >= list.length || ids.includes(list[j].id)) continue
      const ord = cmd === 'forward' ? keyBetween(list[j].ord ?? null, list[j + 1]?.ord ?? null) : keyBetween(list[j - 1]?.ord ?? null, list[j].ord ?? null)
      ops.push({ k: 'el-z', slide: slide.id, id: e.id, ord })
      const [m] = list.splice(i, 1)
      list.splice(cmd === 'forward' ? j : j, 0, { ...m, ord })
    }
  }
  return ops
}

/**
 * Align and distribute. One element aligns to the SLIDE; several align to the
 * box around them — what PowerPoint does by default, and what people mean.
 */
export function align(d: DeckData, slide: Slide, ids: string[], cmd: ArrangeCmd): SOp[] {
  const els = slide.elements.filter((e) => ids.includes(e.id))
  if (!els.length) return []
  const bs = els.map((e) => ({ e, b: bounds(e) }))
  const area = els.length === 1 ? { x: 0, y: 0, w: d.size.w, h: d.size.h } : (() => { const x = Math.min(...bs.map((q) => q.b.x)), y = Math.min(...bs.map((q) => q.b.y)); return { x, y, w: Math.max(...bs.map((q) => q.b.x + q.b.w)) - x, h: Math.max(...bs.map((q) => q.b.y + q.b.h)) - y } })()
  const set = (e: El, patch: Partial<El>): SOp => ({ k: 'el-set', slide: slide.id, id: e.id, patch })
  const r2 = (n: number) => Math.round(n * 100) / 100
  switch (cmd) {
    case 'left': return bs.map(({ e, b }) => set(e, { x: r2(e.x + area.x - b.x) }))
    case 'right': return bs.map(({ e, b }) => set(e, { x: r2(e.x + area.x + area.w - (b.x + b.w)) }))
    case 'centreH': return bs.map(({ e, b }) => set(e, { x: r2(e.x + area.x + area.w / 2 - (b.x + b.w / 2)) }))
    case 'top': return bs.map(({ e, b }) => set(e, { y: r2(e.y + area.y - b.y) }))
    case 'bottom': return bs.map(({ e, b }) => set(e, { y: r2(e.y + area.y + area.h - (b.y + b.h)) }))
    case 'middle': return bs.map(({ e, b }) => set(e, { y: r2(e.y + area.y + area.h / 2 - (b.y + b.h / 2)) }))
    case 'distH': case 'distV': {
      if (bs.length < 3) return []
      const h = cmd === 'distH'
      const sorted = [...bs].sort((a, b) => (h ? a.b.x - b.b.x : a.b.y - b.b.y))
      const total = sorted.reduce((s, q) => s + (h ? q.b.w : q.b.h), 0)
      const span = h ? area.w : area.h
      const gap = (span - total) / (sorted.length - 1)
      let at = h ? area.x : area.y
      return sorted.map(({ e, b }) => { const op = set(e, h ? { x: r2(e.x + at - b.x) } : { y: r2(e.y + at - b.y) }); at += (h ? b.w : b.h) + gap; return op })
    }
    case 'rotR': return els.map((e) => set(e, { rot: (((e.rot || 0) + 90) % 360) || undefined }))
    case 'rotL': return els.map((e) => set(e, { rot: (((e.rot || 0) + 270) % 360) || undefined }))
    case 'flipH': return els.map((e) => set(e, { flipH: !e.flipH || undefined }))
    case 'flipV': return els.map((e) => set(e, { flipV: !e.flipV || undefined }))
    default: return zOrder(slide, ids, cmd as 'front')
  }
}

// ---- tables ---------------------------------------------------------------------

const emptyCell = (rtl: boolean): Cell => ({ text: { paras: [{ runs: [], rtl: rtl || undefined }] } })
export function newTable(d: DeckData, rows: number, cols: number): TableEl {
  const w = d.size.w * 0.8
  const rh = 40
  return {
    id: newId(), kind: 'table', x: (d.size.w - w) / 2, y: Math.max(40, (d.size.h - rows * rh) / 2), w, h: rows * rh,
    cols: Array.from({ length: cols }, () => w / cols), style: { header: true, banded: true, accent: 'accent1' },
    rows: Array.from({ length: rows }, () => ({ h: rh, cells: Array.from({ length: cols }, () => emptyCell(!!d.rtl)) })),
  }
}
/** Row and column surgery, keeping merges consistent. `at` is the cell the command is relative to. */
export function tableEdit(t: TableEl, cmd: 'rowAbove' | 'rowBelow' | 'colBefore' | 'colAfter' | 'deleteRow' | 'deleteCol' | 'merge' | 'split' | 'header' | 'banded', at: [number, number], to?: [number, number]): Partial<TableEl> | null {
  const rows = clone(t.rows)
  const [r, c] = at
  const rtl = !!rows[0]?.cells[0]?.text.paras[0]?.rtl
  switch (cmd) {
    case 'rowAbove': case 'rowBelow': {
      const i = cmd === 'rowAbove' ? r : r + 1
      rows.splice(i, 0, { h: rows[r]?.h || 40, cells: t.cols.map(() => emptyCell(rtl)) })
      const h = t.h + (rows[i].h || 40)
      return { rows, h }
    }
    case 'deleteRow': {
      if (rows.length <= 1) return null
      const gone = rows.splice(r, 1)[0]
      return { rows, h: Math.max(10, t.h - gone.h) }
    }
    case 'colBefore': case 'colAfter': {
      const i = cmd === 'colBefore' ? c : c + 1
      const cw = t.cols[c] || t.w / t.cols.length
      const cols = [...t.cols]
      cols.splice(i, 0, cw)
      for (const row of rows) row.cells.splice(i, 0, emptyCell(rtl))
      return { rows, cols, w: t.w + cw }
    }
    case 'deleteCol': {
      if (t.cols.length <= 1) return null
      const cols = [...t.cols]
      const [cw] = cols.splice(c, 1)
      for (const row of rows) row.cells.splice(c, 1)
      return { rows, cols, w: Math.max(10, t.w - cw) }
    }
    case 'merge': {
      const [r1, c1] = to || at
      const ra = Math.min(r, r1), rb = Math.max(r, r1), ca = Math.min(c, c1), cb = Math.max(c, c1)
      if (ra === rb && ca === cb) return null
      const head = rows[ra].cells[ca]
      const texts: TextBody['paras'] = []
      for (let i = ra; i <= rb; i++) for (let j = ca; j <= cb; j++) {
        const cell = rows[i].cells[j]
        if (cell.text.paras.some((p) => p.runs.some((x) => x.t))) texts.push(...cell.text.paras)
        if (i !== ra || j !== ca) rows[i].cells[j] = { ...emptyCell(rtl), merged: true }
      }
      head.span = [rb - ra + 1, cb - ca + 1]
      if (texts.length) head.text = { ...head.text, paras: texts }
      return { rows }
    }
    case 'split': {
      const cell = rows[r]?.cells[c]
      if (!cell?.span) return null
      const [rs, cs] = cell.span
      for (let i = r; i < r + rs; i++) for (let j = c; j < c + cs; j++) if (i !== r || j !== c) rows[i].cells[j] = emptyCell(rtl)
      delete cell.span
      return { rows }
    }
    case 'header': return { style: { ...t.style, header: !t.style?.header } }
    case 'banded': return { style: { ...t.style, banded: !t.style?.banded } }
  }
}

// ---- find and replace -----------------------------------------------------------

export interface Hit { slide: string; el: string; cell?: [number, number]; para: number; run: number; at: number; len: number }
export function findAll(d: DeckData, q: string, matchCase = false): Hit[] {
  if (!q) return []
  const out: Hit[] = []
  const needle = matchCase ? q : q.toLowerCase()
  const scan = (slide: string, el: string, b: TextBody | undefined, cell?: [number, number]) => b?.paras.forEach((p, pi) => p.runs.forEach((r, ri) => {
    const hay = matchCase ? r.t : r.t.toLowerCase()
    let i = hay.indexOf(needle)
    while (i >= 0) { out.push({ slide, el, cell, para: pi, run: ri, at: i, len: q.length }); i = hay.indexOf(needle, i + needle.length) }
  }))
  for (const s of d.slides) for (const e of s.elements) {
    if (e.kind === 'shape') scan(s.id, e.id, e.text)
    if (e.kind === 'table') e.rows.forEach((row, r) => row.cells.forEach((c, ci) => { if (!c.merged) scan(s.id, e.id, c.text, [r, ci]) }))
  }
  return out
}
/** Replace hits (all, or one), returning the element patches. Hits in one run are applied right to left so earlier ones keep their offsets. */
export function replaceHits(d: DeckData, hits: Hit[], w: string): SOp[] {
  const bySlideEl = new Map<string, Hit[]>()
  for (const h of hits) { const k = `${h.slide}|${h.el}`; bySlideEl.set(k, [...(bySlideEl.get(k) || []), h]) }
  const ops: SOp[] = []
  for (const [k, hs] of bySlideEl) {
    const [sid, eid] = k.split('|')
    const el = d.slides.find((s) => s.id === sid)?.elements.find((e) => e.id === eid)
    if (!el) continue
    const edit = (b: TextBody, list: Hit[]): TextBody => {
      const nb = clone(b)
      for (const h of [...list].sort((a, z) => (z.para - a.para) || (z.run - a.run) || (z.at - a.at))) {
        const r = nb.paras[h.para]?.runs[h.run]
        if (r) r.t = r.t.slice(0, h.at) + w + r.t.slice(h.at + h.len)
      }
      return nb
    }
    if (el.kind === 'shape' && el.text) ops.push({ k: 'el-set', slide: sid, id: eid, patch: { text: edit(el.text, hs) } })
    if (el.kind === 'table') {
      const rows = clone(el.rows)
      for (const h of hs) if (h.cell) { const c = rows[h.cell[0]].cells[h.cell[1]]; c.text = edit(c.text, hs.filter((x) => x.cell && x.cell[0] === h.cell![0] && x.cell[1] === h.cell![1])) }
      ops.push({ k: 'el-set', slide: sid, id: eid, patch: { rows } })
    }
  }
  return ops
}

/** Changing 16:9 ↔ 4:3 scales everything horizontally so nothing falls off the edge. */
export function resizeDeck(d: DeckData, size: { w: number; h: number }): SOp[] {
  const kx = size.w / d.size.w, ky = size.h / d.size.h
  const ops: SOp[] = [{ k: 'deck-set', patch: { size } }]
  for (const s of d.slides) for (const e of s.elements) {
    const patch: Partial<El> = { x: Math.round(e.x * kx * 100) / 100, y: Math.round(e.y * ky * 100) / 100, w: Math.round(e.w * kx * 100) / 100, h: Math.round(e.h * ky * 100) / 100 }
    if (e.kind === 'table') (patch as Partial<TableEl>).cols = e.cols.map((c) => c * kx)
    ops.push({ k: 'el-set', slide: s.id, id: e.id, patch })
  }
  for (const m of d.masters || []) ops.push({ k: 'master-set', master: { ...m, elements: m.elements.map((e) => ({ ...e, x: e.x * kx, y: e.y * ky, w: e.w * kx, h: e.h * ky })) } })
  return ops
}
