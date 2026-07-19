// Client for the anonymous "call me" links (functions/call.js: call-register /
// call-ring / call-delete). A host claims a link on THIS device (push subscribe +
// register under a stable random code); sharing built-in-saudi.com/call/<code>
// lets anyone ring them. No login — we keep just the code + endpoint locally so
// the link is stable and removable. Deletion NEVER unsubscribes the device's push
// (it's shared with prayer/Book-Me) — it only drops the server-side registration.
import { subscribeDevice } from './push'

// Overridable in e2e (window.__CALL_FN) so tests can point at a mock; the real
// backend otherwise.
const FN = (typeof window !== 'undefined' && (window as unknown as { __CALL_FN?: string }).__CALL_FN) || 'https://us-central1-blitz-ksa.cloudfunctions.net'
const KEY = 'bis-call-link' // { code, endpoint }

export interface MyCallLink { code: string; endpoint: string }

export function getMyCallLink(): MyCallLink | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.code ? v : null } catch { return null }
}
function saveMyCallLink(v: MyCallLink) { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* */ } }
export function clearMyCallLink() { try { localStorage.removeItem(KEY) } catch { /* */ } }

// A 9-char code from an unambiguous alphabet (no i/l/o/0/1) — this is the public
// link, so a little length keeps it unguessable.
export function newCallCode(): string {
  const A = 'abcdefghjkmnpqrstuvwxyz23456789'
  const b = crypto.getRandomValues(new Uint8Array(9))
  let s = ''
  for (let i = 0; i < 9; i++) s += A[b[i] % A.length]
  return s
}

/** Claim/refresh a personal call link on THIS device. Requests notification
 *  permission + subscribes push, registers under a stable code (reused if this
 *  device already has one), stores {code, endpoint} locally. Returns the code,
 *  or null if push is unavailable / permission denied / the server rejected it. */
export async function claimCallLink(name: string): Promise<string | null> {
  const sub = await subscribeDevice()
  if (!sub) return null
  const code = getMyCallLink()?.code || newCallCode()
  try {
    const res = await fetch(`${FN}/call-register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, sub, name }),
    })
    if (!res.ok) return null
  } catch { return null }
  saveMyCallLink({ code, endpoint: sub.endpoint })
  return code
}

/** Ring the owner of a call link so their device(s) get a push to answer `room`. */
export async function ringCallLink(code: string, room: string, caller: string): Promise<{ ok: boolean; delivered: number }> {
  try {
    const res = await fetch(`${FN}/call-ring`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, room, caller }),
    })
    if (!res.ok) return { ok: false, delivered: 0 }
    const d = await res.json().catch(() => ({}))
    return { ok: true, delivered: Number(d.delivered) || 0 }
  } catch { return { ok: false, delivered: 0 } }
}

/** Remove a device from a link (pass its endpoint) or the whole link (omit it).
 *  Best-effort; clears local state if it was ours. Does NOT touch the shared push
 *  subscription — other features (prayer alerts, Book Me) rely on it. */
export async function deleteCallLink(code: string, endpoint?: string): Promise<void> {
  try {
    await fetch(`${FN}/call-delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, endpoint }),
    })
  } catch { /* best-effort */ }
  const mine = getMyCallLink()
  if (mine && mine.code === code && (!endpoint || mine.endpoint === endpoint)) clearMyCallLink()
}
