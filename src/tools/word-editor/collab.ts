// Live co-editing for the word processor: prosemirror-collab, with the
// document OWNER as the central authority.
//
// prosemirror-collab is exactly the "owner is truth" model: one authority keeps
// the canonical step list; each client sends the steps it made against the
// version it last saw; the authority accepts them only if that version is still
// current, and broadcasts them. A client whose submission was stale simply
// receives the steps it missed, rebases its own on top (the plugin does this),
// and sends again. Nothing is ever merged by guesswork.
//
// The owner's own edits go through the same authority, confirmed at once, so
// its editor is never ahead of the truth it is publishing.
//
// Page setup, header and footer are not ProseMirror steps; they travel as
// `meta` on the same channel and are last-writer-wins at the owner.
import { Step } from 'prosemirror-transform'
import { collab, sendableSteps, receiveTransaction, getVersion } from 'prosemirror-collab'
import type { EditorState, Transaction, Plugin } from 'prosemirror-state'
import type { Node, Schema } from 'prosemirror-model'
import type { CollabAdapter, CollabSession } from '../../lib/collab/session'

export interface Host {
  getState(): EditorState
  apply(tr: Transaction): void
  /** Replace the document wholesale (a resync); rebuild the state at `version`. */
  reset(doc: Node, version: number): void
  getMeta(): unknown
  setMeta(m: unknown): void
}

type Commit = { v: number; steps: unknown[]; clientIDs: (string | number)[]; meta?: unknown }
type Submission = { v: number; steps: unknown[]; clientID: string | number } | { meta: unknown }

export function collabPlugin(version: number, clientID: string): Plugin {
  return collab({ version, clientID })
}

export class PMCollab implements CollabAdapter {
  private session: CollabSession | null = null
  private inFlight = -1
  constructor(private schema: Schema, private host: Host, readonly owner: boolean) {}

  bind(s: CollabSession | null) { this.session = s; this.inFlight = -1 }
  get active() { return !!this.session }

  /** Call after every local transaction. */
  flush() {
    const state = this.host.getState()
    const send = sendableSteps(state)
    if (!send) return
    if (this.owner || !this.session) {
      // The authority is here: confirm at once, and publish if anyone is listening.
      const steps = send.steps
      const ids = steps.map(() => send.clientID)
      this.host.apply(receiveTransaction(state, steps, ids))
      if (this.session && this.owner) this.session.commitLocal({ v: getVersion(this.host.getState()), steps: steps.map((s) => s.toJSON()), clientIDs: ids } satisfies Commit)
      return
    }
    if (!this.session.canEdit) return
    if (this.inFlight === send.version) return
    this.inFlight = send.version
    this.session.submit({ v: send.version, steps: send.steps.map((s) => s.toJSON()), clientID: send.clientID } satisfies Submission)
  }

  /** Owner, or a guest proposing: page setup / header / footer changed. */
  sendMeta(meta: unknown) {
    if (!this.session) return
    if (this.owner) this.session.commitLocal({ v: getVersion(this.host.getState()), steps: [], clientIDs: [], meta } satisfies Commit)
    else this.session.submit({ meta } satisfies Submission)
  }

  // ---- CollabAdapter ---------------------------------------------------------------------
  snapshot() {
    const s = this.host.getState()
    return { snap: { doc: s.doc.toJSON(), meta: this.host.getMeta() }, version: getVersion(s) }
  }
  load(snap: unknown, version: number) {
    const s = (snap || {}) as { doc?: unknown; meta?: unknown }
    if (!s.doc) return
    this.host.reset(this.schema.nodeFromJSON(s.doc), version)
    if (s.meta) this.host.setMeta(s.meta)
    this.inFlight = -1
  }
  accept(payload: unknown, _client: string): unknown | null {
    const p = (payload || {}) as Submission
    if ('meta' in p) { this.host.setMeta(p.meta); return { v: getVersion(this.host.getState()), steps: [], clientIDs: [], meta: p.meta } satisfies Commit }
    const state = this.host.getState()
    // A stale submission is not an error: the guest will get what it missed, rebase, and resend.
    if (typeof p.v !== 'number' || p.v !== getVersion(state) || !Array.isArray(p.steps)) return null
    let steps: Step[]
    try { steps = p.steps.map((j) => Step.fromJSON(this.schema, j as never)) } catch { return null }
    // Check every step applies before accepting any of them.
    let doc = state.doc
    // A guest's steps are untrusted input: one out of range must not throw inside the owner.
    try { for (const st of steps) { const r = st.apply(doc); if (r.failed || !r.doc) return null; doc = r.doc } } catch { return null }
    const ids = steps.map(() => p.clientID)
    this.host.apply(receiveTransaction(state, steps, ids))
    return { v: getVersion(this.host.getState()), steps: p.steps, clientIDs: ids } satisfies Commit
  }
  commit(payload: unknown): 'ok' | 'gap' {
    const c = payload as Commit
    if (!c || typeof c.v !== 'number') return 'ok'
    if (c.meta !== undefined) this.host.setMeta(c.meta)
    if (!c.steps?.length) return 'ok'
    const state = this.host.getState()
    const have = getVersion(state)
    if (c.v <= have) return 'ok'
    if (c.v - c.steps.length !== have) return 'gap'
    let steps: Step[]
    try { steps = c.steps.map((j) => Step.fromJSON(this.schema, j as never)) } catch { return 'gap' }
    try { this.host.apply(receiveTransaction(state, steps, c.clientIDs)) } catch { return 'gap' }
    this.inFlight = -1
    // Our own unconfirmed steps were rebased on top; send them again.
    queueMicrotask(() => this.flush())
    return 'ok'
  }
  refused() { this.inFlight = -1; queueMicrotask(() => this.flush()) }
  resend() { this.inFlight = -1; this.flush() }
}
