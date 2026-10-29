// The presentation as a sequenced document: every change is an op, applied here
// and — in a live session — routed through the owner (lib/collab/seqDoc).
//
// EVERY op is a last-writer-wins write to one object, which is what lets a
// guest apply its own edits at once and simply re-apply the still-pending ones
// whenever the owner's commits land first — the result is the owner's, exactly.
//
// - **Order is a field** (`ord`, a fractional key — order.ts). Moving a slide
//   or raising a shape sets one string; lists are kept sorted by it. Index- or
//   anchor-based moves depend on where everything else is, and the convergence
//   fuzz in doc.test.ts caught them diverging.
// - **Adds are upserts and deletes forgive.** Adding an id that exists replaces
//   it, deleting one that is gone does nothing, setting a field on a deleted
//   element is a no-op — so no op can fail on a re-application.
// - **Removing a field is spelled out** (`unset`), because `undefined` does not
//   survive the JSON a commit travels as.
//
// Undo is by inverse ops, computed against the state BEFORE an op applies: it
// takes back MY change and leaves a colleague's alone.
import type { SeqModel } from '../../lib/collab/seqDoc'
import type { DeckData, El, Slide, Media, Master } from './model'
import { blankDeck } from './model'
import { byOrd, ensureOrd } from './order'

export type SOp =
  | { k: 'slide-add'; slide: Slide }
  | { k: 'slide-del'; id: string }
  | { k: 'slide-move'; id: string; ord: string }
  | { k: 'slide-set'; id: string; patch: Partial<Omit<Slide, 'id' | 'elements' | 'ord'>>; unset?: string[] }
  | { k: 'el-add'; slide: string; el: El }
  | { k: 'el-del'; slide: string; ids: string[] }
  | { k: 'el-set'; slide: string; id: string; patch: Partial<El>; unset?: string[] }
  | { k: 'el-z'; slide: string; id: string; ord: string }
  | { k: 'deck-set'; patch: Partial<Pick<DeckData, 'size' | 'theme' | 'rtl' | 'lang' | 'footer'>>; unset?: string[] }
  | { k: 'media-add'; id: string; media: Media }
  | { k: 'master-set'; master: Master }

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

/**
 * Merge a patch. Removing a field is spelled out in `unset`, because an
 * `undefined` does not survive the JSON a commit travels as — a guest would
 * never hear that a rotation was cleared. A local `undefined` counts too.
 */
function assignPatch(target: Record<string, unknown>, patch: object, unset: string[] = []): void {
  for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete target[k]; else target[k] = clone(v) }
  for (const k of unset) delete target[k]
}
/** The editor writes `undefined` for "remove"; this makes such an op safe to send. */
export function wire(op: SOp): SOp {
  if (op.k !== 'el-set' && op.k !== 'slide-set' && op.k !== 'deck-set') return op
  const patch: Record<string, unknown> = {}
  const unset = new Set(op.unset || [])
  for (const [k, v] of Object.entries(op.patch)) { if (v === undefined) unset.add(k); else patch[k] = v }
  return { ...op, patch, unset: unset.size ? [...unset] : undefined } as SOp
}
/** The inverse patch of `keys` on `obj`: present values go back in `patch`, absent ones in `unset`. */
function before(obj: Record<string, unknown>, keys: string[]): { patch: Record<string, unknown>; unset?: string[] } {
  const patch: Record<string, unknown> = {}
  const unset: string[] = []
  for (const k of keys) { if (obj[k] === undefined) unset.push(k); else patch[k] = clone(obj[k]) }
  return { patch, unset: unset.length ? unset : undefined }
}
function upsert<T extends { id: string; ord?: string }>(list: T[], item: T): void {
  const i = list.findIndex((x) => x.id === item.id)
  if (i >= 0) list[i] = item
  else list.push(item)
  list.sort(byOrd)
}

export class DeckModel implements SeqModel<SOp> {
  deck: DeckData
  rev = 0
  private listeners = new Set<() => void>()

  constructor(deck: DeckData) {
    this.deck = deck
    normalise(this.deck)
  }

  subscribe(f: () => void): () => void { this.listeners.add(f); return () => this.listeners.delete(f) }
  private changed() { this.rev++; for (const f of this.listeners) f() }

  slide(id: string): Slide | undefined { return this.deck.slides.find((s) => s.id === id) }
  el(slide: string, id: string): El | undefined { return this.slide(slide)?.elements.find((e) => e.id === id) }

  idempotent(): boolean { return true }
  snapshot(): unknown { return clone(this.deck) }
  load(snap: unknown): void {
    const d = snap as DeckData
    if (!d || typeof d !== 'object' || !Array.isArray(d.slides)) return
    this.deck = clone(d)
    normalise(this.deck)
    this.changed()
  }

  apply(op: SOp): void {
    const d = this.deck
    switch (op.k) {
      case 'slide-add': { const s = clone(op.slide); s.elements = (s.elements || []).sort(byOrd); upsert(d.slides, s); break }
      case 'slide-del': { const i = d.slides.findIndex((s) => s.id === op.id); if (i >= 0) d.slides.splice(i, 1); break }
      case 'slide-move': { const s = this.slide(op.id); if (s) { s.ord = op.ord; d.slides.sort(byOrd) } break }
      case 'slide-set': { const s = this.slide(op.id); if (s) assignPatch(s as unknown as Record<string, unknown>, op.patch, op.unset); break }
      case 'el-add': { const s = this.slide(op.slide); if (s) upsert(s.elements, clone(op.el)); break }
      case 'el-del': { const s = this.slide(op.slide); if (s) s.elements = s.elements.filter((e) => !op.ids.includes(e.id)); break }
      case 'el-set': {
        const s = this.slide(op.slide)
        const i = s ? s.elements.findIndex((e) => e.id === op.id) : -1
        if (s && i >= 0) {
          const next = { ...s.elements[i] } as El
          assignPatch(next as unknown as Record<string, unknown>, op.patch, op.unset)
          next.id = op.id
          next.ord = s.elements[i].ord
          s.elements[i] = next
        }
        break
      }
      case 'el-z': { const s = this.slide(op.slide); const e = s?.elements.find((x) => x.id === op.id); if (s && e) { e.ord = op.ord; s.elements.sort(byOrd) } break }
      case 'deck-set': assignPatch(d as unknown as Record<string, unknown>, op.patch, op.unset); break
      case 'media-add': d.media[op.id] = op.media; break
      case 'master-set': {
        d.masters = d.masters || []
        const i = d.masters.findIndex((m) => m.id === op.master.id)
        if (i >= 0) d.masters[i] = clone(op.master)
        else d.masters.push(clone(op.master))
        break
      }
    }
    this.changed()
  }

  /** The ops that undo `op`, against the state as it is NOW (before `op` applies). */
  inverse(op: SOp): SOp[] {
    const d = this.deck
    switch (op.k) {
      case 'slide-add': { const had = this.slide(op.slide.id); return [had ? { k: 'slide-add', slide: clone(had) } : { k: 'slide-del', id: op.slide.id }] }
      case 'slide-del': { const s = this.slide(op.id); return s ? [{ k: 'slide-add', slide: clone(s) }] : [] }
      case 'slide-move': { const s = this.slide(op.id); return s?.ord ? [{ k: 'slide-move', id: op.id, ord: s.ord }] : [] }
      case 'slide-set': {
        const s = this.slide(op.id)
        return s ? [{ k: 'slide-set', id: op.id, ...before(s as unknown as Record<string, unknown>, [...Object.keys(op.patch), ...(op.unset || [])]) }] : []
      }
      case 'el-add': {
        const had = this.el(op.slide, op.el.id)
        return [had ? { k: 'el-add', slide: op.slide, el: clone(had) } : { k: 'el-del', slide: op.slide, ids: [op.el.id] }]
      }
      case 'el-del': { const s = this.slide(op.slide); return (s?.elements || []).filter((e) => op.ids.includes(e.id)).map((e) => ({ k: 'el-add', slide: op.slide, el: clone(e) })) }
      case 'el-set': {
        const e = this.el(op.slide, op.id)
        return e ? [{ k: 'el-set', slide: op.slide, id: op.id, ...before(e as unknown as Record<string, unknown>, [...Object.keys(op.patch), ...(op.unset || [])]) }] : []
      }
      case 'el-z': { const e = this.el(op.slide, op.id); return e?.ord ? [{ k: 'el-z', slide: op.slide, id: op.id, ord: e.ord }] : [] }
      case 'deck-set': return [{ k: 'deck-set', ...before(d as unknown as Record<string, unknown>, [...Object.keys(op.patch), ...(op.unset || [])]) }]
      case 'media-add': return []
      case 'master-set': { const m = d.masters?.find((x) => x.id === op.master.id); return m ? [{ k: 'master-set', master: clone(m) }] : [] }
    }
  }
}

/** A deck from a file or storage may be missing parts or order keys; fill them so nothing downstream checks. */
export function normalise(d: DeckData): DeckData {
  const base = blankDeck(!!d.rtl)
  if (!d.size || !(d.size.w > 0) || !(d.size.h > 0)) d.size = base.size
  if (!d.theme) d.theme = base.theme
  if (!d.theme.colors) d.theme.colors = base.theme.colors
  if (!d.theme.fonts) d.theme.fonts = base.theme.fonts
  if (!Array.isArray(d.slides)) d.slides = []
  if (!d.media || typeof d.media !== 'object') d.media = {}
  ensureOrd(d.slides)
  for (const s of d.slides) { if (!Array.isArray(s.elements)) s.elements = []; ensureOrd(s.elements) }
  for (const m of d.masters || []) if (!Array.isArray(m.elements)) m.elements = []
  return d
}
