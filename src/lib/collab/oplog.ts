// The owner-is-truth sequencer for the spreadsheet and the deck.
//
// Collaboration here has no server, so somebody's copy has to be the one that
// counts, and it is the OWNER's: the document lives in their browser, they opened
// the session, and when they leave it ends. That makes the problem much smaller
// than a CRDT solves — there is exactly one ordering of edits, the owner's — and
// it is what lets the owner refuse an edit at all (a viewer's, or one that no
// longer applies).
//
// The shape is the classic server-reconciliation loop:
//
// - A guest applies its own edit at once (no waiting on a round trip to type),
//   keeps it in `pending`, and sends it to the owner.
// - The owner applies edits in the order they ARRIVE, numbers each one, and
//   broadcasts it. That numbered stream is the truth.
// - A guest that receives an edit rebuilds its view as
//   `confirmed + that edit + whatever of its own is still pending`. An edit of its
//   own coming back is dropped from `pending`; one that no longer applies after a
//   concurrent change (its row was deleted) throws and is discarded, which is the
//   owner's ordering winning — visibly, and without corrupting anything.
//
// It works for these two editors because their operations are by STABLE ID
// (`set cell B7`, `move shape s3`), so replaying one on a slightly different state
// still means what the author meant. Rich text does not have that property, which
// is why the word processor uses prosemirror-collab's step mapping instead.

export interface Applier<S, O> {
  /** Apply an op to a state, returning the new state. Throw if it no longer applies. Must not mutate `s`. */
  apply(s: S, op: O): S
}

export interface Committed<O> { v: number; op: O; by: string; id: string }

/** Owner side. */
export class Authority<S, O> {
  private log: Committed<O>[] = []
  version = 0
  constructor(public state: S, private ap: Applier<S, O>, private keep = 500) {}

  /** Apply an op (the owner's own or a guest's). Returns the commit, or null if it was rejected. */
  submit(op: O, by: string, id: string): Committed<O> | null {
    // An op id seen before is a resend after a reconnect — never apply twice.
    if (this.log.some((c) => c.id === id)) return null
    let next: S
    try { next = this.ap.apply(this.state, op) } catch { return null }
    this.state = next
    this.version++
    const c: Committed<O> = { v: this.version, op, by, id }
    this.log.push(c)
    if (this.log.length > this.keep) this.log.splice(0, this.log.length - this.keep)
    return c
  }

  /** Commits after `v`, or null when the log no longer reaches back that far (send a snapshot instead). */
  since(v: number): Committed<O>[] | null {
    if (v === this.version) return []
    if (v > this.version) return null
    const first = this.log[0]
    if (!first || first.v > v + 1) return null
    return this.log.filter((c) => c.v > v)
  }

  /** Replace the whole state (an undo of a large structural change, a re-import). */
  reset(state: S): void { this.state = state; this.version++; this.log = [] }
}

export interface PendingOp<O> { op: O; id: string }

/** Guest side. */
export class Replica<S, O> {
  confirmed: S
  version: number
  pending: PendingOp<O>[] = []
  view: S
  /** Ops of ours the owner never confirmed and we had to discard on rebase. */
  dropped = 0
  constructor(snapshot: S, version: number, private ap: Applier<S, O>) {
    this.confirmed = snapshot
    this.version = version
    this.view = snapshot
  }

  /** A local edit: applied now, sent later. Returns false if it does not apply even locally. */
  local(op: O, id: string): boolean {
    try { this.view = this.ap.apply(this.view, op) } catch { return false }
    this.pending.push({ op, id })
    return true
  }

  /**
   * A commit from the owner. Returns 'gap' when it skips a version we have not
   * seen — the caller must ask for a resync rather than guess.
   */
  receive(c: Committed<O>): 'ok' | 'stale' | 'gap' {
    if (c.v <= this.version) return 'stale'
    if (c.v !== this.version + 1) return 'gap'
    this.confirmed = this.ap.apply(this.confirmed, c.op)
    this.version = c.v
    this.pending = this.pending.filter((p) => p.id !== c.id)
    this.rebase()
    return 'ok'
  }

  /** Throw away everything and start again from a fresh snapshot (after a gap). */
  resync(snapshot: S, version: number): void {
    this.confirmed = snapshot
    this.version = version
    this.rebase()
  }

  /** The owner refused one of ours: forget it and rebuild the view without it. */
  drop(id: string): boolean {
    const n = this.pending.length
    this.pending = this.pending.filter((p) => p.id !== id)
    if (this.pending.length === n) return false
    this.dropped++
    this.rebase()
    return true
  }

  private rebase() {
    let v = this.confirmed
    const keep: PendingOp<O>[] = []
    for (const p of this.pending) {
      try { v = this.ap.apply(v, p.op); keep.push(p) } catch { this.dropped++ }
    }
    this.pending = keep
    this.view = v
  }
}
