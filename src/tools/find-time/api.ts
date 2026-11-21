// Client for the `find-time` Cloud Function (functions/findTimeCore.js).
import { createPasskey, getPasskey } from '../../lib/passkey'

const FN = 'https://us-central1-blitz-ksa.cloudfunctions.net/find-time'

export interface Person {
  id: string
  name: string
  owner: boolean
  claimed: boolean
  answered: boolean
  avail: number[]
  tz: string
  you: boolean
}

export interface Poll {
  code: string
  title: string
  start: number
  days: number
  slotMin: number
  tz: string
  people: Person[]
  everyone: number[]
  version: number
  owner: boolean
  expiresAt: number
}

export interface Session { token: string; name: string }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || `HTTP ${res.status}`)
  return data as T
}

// --- the session, kept in this browser -------------------------------------
const SESSION_KEY = 'bis-find-time-session'
export const SESSION_EVENT = 'bis-find-time-session'

export function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null
    if (!s?.token) return null
    const b64 = s.token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const body = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as { exp?: number }
    return body.exp && body.exp > Date.now() ? s : null
  } catch { return null }
}
export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* private mode: the session lasts this page */ }
  window.dispatchEvent(new Event(SESSION_EVENT))
}

/** Make a passkey for `name` and sign in with it. */
export async function signUp(name: string): Promise<Session> {
  const { challengeId, options } = await call<{ challengeId: string; options: Record<string, unknown> }>('registerOptions', { name })
  const response = await createPasskey(options)
  const s = await call<Session>('register', { challengeId, response })
  saveSession(s)
  return s
}

/** Sign in with a passkey this device (or a nearby phone) already has. */
export async function signIn(): Promise<Session> {
  const { challengeId, options } = await call<{ challengeId: string; options: Record<string, unknown> }>('loginOptions')
  const response = await getPasskey(options)
  const s = await call<Session>('login', { challengeId, response })
  saveSession(s)
  return s
}

export const localZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

export const createPoll = (token: string, title: string, names: string[]) =>
  call<Poll>('create', { token, title, names, tz: localZone() })

export const getPoll = (code: string, token?: string, since?: number) =>
  call<{ exists?: boolean; unchanged?: boolean; poll?: Poll }>('get', { code, token, since })

export const claimName = (token: string, code: string, which: { pid?: string; name?: string }) =>
  call<Poll>('claim', { token, code, ...which, tz: localZone() })

export const setAvail = (token: string, code: string, slots: number[]) =>
  call<Poll>('setAvail', { token, code, slots, tz: localZone() })

export const invite = (token: string, code: string, names: string[]) => call<Poll>('invite', { token, code, names })
export const removePerson = (token: string, code: string, pid: string) => call<Poll>('remove', { token, code, pid })
export const deletePoll = (token: string, code: string) => call<{ ok: true }>('deletePoll', { token, code })

export const subscribe = (code: string, sub: PushSubscription, locale: string) =>
  call<{ ok: true }>('subscribe', { code, sub: sub.toJSON(), locale })
export const unsubscribe = (code: string, endpoint: string) => call<{ ok: true }>('unsubscribe', { code, endpoint })

export interface MyData {
  person: { name: string; createdAt: number | null; expiresAt: number }
  passkeys: { id: string; createdAt: number | null; usedAt: number | null; expiresAt: number }[]
  polls: { code: string; title: string; owner: boolean; name: string; slots: number; createdAt: number; expiresAt: number }[]
}
export const myData = (token: string) => call<MyData>('myData', { token })
export const deleteAccount = (token: string) => call<{ ok: true }>('deleteAccount', { token })
