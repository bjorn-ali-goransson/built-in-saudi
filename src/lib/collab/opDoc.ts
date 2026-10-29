// Glue between the generic op log (oplog.ts) and a CollabSession, for editors
// whose operations are by stable id — the spreadsheet and the deck.
import { Authority, Replica, type Applier, type Committed } from './oplog'
import type { CollabAdapter, CollabSession } from './session'
import { randomId } from '../p2p/mesh'

export class OpDoc<S, O> implements CollabAdapter {
  private auth: Authority<S, O> | null = null
  private rep: Replica<S, O> | null = null
  private session: CollabSession | null = null
  private listeners = new Set<(s: S, remote: boolean) => void>()

  constructor(ap: Applier<S, O>, initial: S, readonly owner: boolean) {
    if (owner) this.auth = new Authority(initial, ap)
    else this.rep = new Replica(initial, 0, ap)
  }

  bind(s: CollabSession): void { this.session = s }

  /** What the editor should render. */
  get state(): S { return this.owner ? this.auth!.state : this.rep!.view }
  get version(): number { return this.owner ? this.auth!.version : this.rep!.version }
  get pendingCount(): number { return this.rep?.pending.length ?? 0 }

  subscribe(fn: (s: S, remote: boolean) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit(remote: boolean) { for (const f of this.listeners) f(this.state, remote) }

  /** A local edit. Returns false when it does not apply (or a viewer tried). */
  edit(op: O): boolean {
    const id = randomId(10)
    if (this.owner) {
      const c = this.auth!.submit(op, this.session?.me || 'owner', id)
      if (!c) return false
      this.session?.commitLocal(c)
      this.emit(false)
      return true
    }
    if (this.session && !this.session.canEdit) return false
    if (!this.rep!.local(op, id)) return false
    this.session?.submit({ op, id })
    this.emit(false)
    return true
  }

  /** Owner: replace the whole document (an import). */
  reset(s: S): void {
    if (!this.owner) return
    this.auth!.reset(s)
    this.session?.resnapshot()
    this.emit(false)
  }

  // ---- CollabAdapter ---------------------------------------------------------
  snapshot() { return { snap: this.auth!.state as unknown, version: this.auth!.version } }
  load(snap: unknown, version: number) {
    if (this.owner) return
    this.rep!.resync(snap as S, version)
    this.emit(true)
  }
  accept(p: unknown, client: string) {
    const { op, id } = (p || {}) as { op: O; id: string }
    if (!id) return null
    return this.auth!.submit(op, client, String(id))
  }
  commit(p: unknown): 'ok' | 'gap' {
    const r = this.rep!.receive(p as Committed<O>)
    if (r === 'gap') return 'gap'
    if (r === 'ok') this.emit(true)
    return 'ok'
  }
  refused(p: unknown) {
    const id = String(((p || {}) as { id?: string }).id || '')
    if (this.rep && id && this.rep.drop(id)) this.emit(true)
  }
  resend() {
    if (!this.rep || !this.session) return
    for (const p of this.rep.pending) this.session.submit({ op: p.op, id: p.id })
  }
}
