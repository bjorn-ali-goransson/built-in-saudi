// The owner-is-truth sequencer, for documents too big to copy on every edit.
//
// `oplog.ts` keeps immutable states so a guest can rebuild "confirmed + pending"
// from scratch — exact, and fine for a toy model, but for a 50,000-cell workbook
// it means copying the workbook on every keystroke. This variant mutates one
// document in place and relies instead on a property of the operations:
//
// - **Idempotent ops are optimistic.** "Set B7 to 42", "move shape s3 to (10,20)"
//   give the same result applied once or twice, so a guest applies its own edit
//   at once, and when somebody else's commit lands first it simply re-applies
//   its still-pending ones on top — which reproduces exactly the order the owner
//   will use (theirs, then ours). Confirmation needs no work at all.
// - **Everything else is pessimistic.** "Insert a row at 5" applied twice inserts
//   two rows, so a guest does NOT apply it locally; it sends it and waits for the
//   owner's commit, which it then applies like anyone else's. A row insert is
//   slow to appear by one round trip; it can never be applied twice.
// - **A refusal or a gap resyncs from a snapshot.** Rare, and the only way to be
//   sure of agreeing with the owner after something unexpected.
import type { CollabAdapter, CollabSession } from './session'
import { randomId } from '../p2p/mesh'

export interface SeqModel<O> {
  /** Apply in place. Throw if it does not apply. */
  apply(op: O, origin: 'local' | 'remote'): void
  /** Can this op be applied optimistically (idempotent)? */
  idempotent(op: O): boolean
  snapshot(): unknown
  load(snap: unknown): void
}

export interface SeqCommit<O> { v: number; op: O; id: string; by: string }

export class SeqDoc<O> implements CollabAdapter {
  version = 0
  private pending: { op: O; id: string; applied: boolean }[] = []
  private session: CollabSession | null = null
  private listeners = new Set<(remote: boolean) => void>()
  /** How many of our edits the owner refused (and were rolled back by a resync). */
  refusals = 0

  constructor(private model: SeqModel<O>, readonly owner: boolean) {}

  bind(s: CollabSession | null): void { this.session = s }
  get active(): boolean { return !!this.session }
  get pendingCount(): number { return this.pending.length }

  subscribe(fn: (remote: boolean) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private emit(remote: boolean) { for (const f of this.listeners) f(remote) }

  /** A local edit. Without a session it simply applies. */
  edit(op: O): boolean {
    if (!this.session) {
      try { this.model.apply(op, 'local') } catch { return false }
      this.emit(false)
      return true
    }
    if (this.owner) {
      try { this.model.apply(op, 'local') } catch { return false }
      this.version++
      const id = randomId(10)
      this.remember(id)
      this.session.commitLocal({ v: this.version, op, id, by: this.session.me } satisfies SeqCommit<O>)
      this.emit(false)
      return true
    }
    if (!this.session.canEdit) return false
    const id = randomId(10)
    const optimistic = this.model.idempotent(op)
    if (optimistic) {
      try { this.model.apply(op, 'local') } catch { return false }
    }
    this.pending.push({ op, id, applied: optimistic })
    this.session.submit({ op, id })
    if (optimistic) this.emit(false)
    return true
  }

  // ---- CollabAdapter -----------------------------------------------------------
  /** Owner: ids of recent commits, so a resend after a reconnect is never applied twice. */
  private recent: string[] = []
  private remember(id: string) { this.recent.push(id); if (this.recent.length > 2000) this.recent.splice(0, 500) }

  snapshot() { return { snap: { doc: this.model.snapshot(), ids: this.recent.slice(-500) }, version: this.version } }
  load(snap: unknown, version: number) {
    const s = (snap || {}) as { doc?: unknown; ids?: string[] }
    this.model.load(s.doc)
    this.version = version
    // Anything the owner already has is not pending any more.
    const done = new Set(s.ids || [])
    this.pending = this.pending.filter((p) => !done.has(p.id))
    // Our optimistic edits are not in the snapshot unless the owner already had them;
    // re-apply what is still pending so the view does not jump back.
    for (const p of this.pending) if (p.applied) { try { this.model.apply(p.op, 'local') } catch { /* gone */ } }
    this.emit(true)
  }
  accept(payload: unknown, client: string): unknown | null {
    const { op, id } = (payload || {}) as { op: O; id: string }
    if (!id) return null
    if (this.recent.includes(id)) return null
    try { this.model.apply(op, 'remote') } catch { return null }
    this.version++
    this.remember(id)
    this.emit(true)
    return { v: this.version, op, id, by: client } satisfies SeqCommit<O>
  }
  commit(payload: unknown): 'ok' | 'gap' {
    const c = payload as SeqCommit<O>
    if (!c || typeof c.v !== 'number') return 'ok'
    if (c.v <= this.version) return 'ok'
    if (c.v !== this.version + 1) return 'gap'
    const mine = this.pending.findIndex((p) => p.id === c.id)
    // A STRUCTURAL edit (anyone's, our own included), while other edits of ours are applied but not yet
    // confirmed: those edits were made against the old numbering, and applying the insert
    // under them would move them somewhere the owner will never put them. Take the truth
    // instead — the snapshot comes back with our pending edits re-applied on top of it.
    if (!this.model.idempotent(c.op) && this.pending.some((p) => p.applied && p.id !== c.id)) return 'gap'
    this.version = c.v
    if (mine >= 0) {
      const p = this.pending.splice(mine, 1)[0]
      // An idempotent op of ours is already applied; a pessimistic one applies now.
      if (!p.applied) { try { this.model.apply(c.op, 'remote') } catch { /* */ } }
    } else {
      try { this.model.apply(c.op, 'remote') } catch { return 'gap' }
    }
    // Keep our still-pending optimistic edits on top, as the owner will order them.
    for (const p of this.pending) if (p.applied) { try { this.model.apply(p.op, 'local') } catch { /* superseded */ } }
    this.emit(true)
    return 'ok'
  }
  /** The owner refused one of ours. If we had applied it, our view is now wrong: ask for the truth. */
  refused(payload: unknown) {
    const id = String(((payload || {}) as { id?: string }).id || '')
    const i = this.pending.findIndex((p) => p.id === id)
    if (i < 0) return
    const [p] = this.pending.splice(i, 1)
    this.refusals++
    if (p.applied) this.session?.requestResync()
  }
  resend() {
    if (!this.session) return
    for (const p of this.pending) this.session.submit({ op: p.op, id: p.id })
  }
}
