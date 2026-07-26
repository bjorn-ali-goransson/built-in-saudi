// Client for the optional cloud side of the to-do tool (functions/todo.js).
// Everything here is opt-in: a list only reaches the server once the user turns
// sync on for it. Auth is the same Google Identity Services sign-in the CV tool
// and link shortener use.
import type { TodoList } from './lib'

// Overridable in e2e (window.__TODO_FN) so tests can point at a mock.
const FN = (typeof window !== 'undefined' && (window as unknown as { __TODO_FN?: string }).__TODO_FN)
  || 'https://us-central1-blitz-ksa.cloudfunctions.net'

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${FN}/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`)
  return data as T
}

/** Push one list up (create or update) and get the authoritative copy back. */
export function syncList(idToken: string, list: TodoList) {
  return post<{ list: TodoList }>('todo-sync', { idToken, list })
}

/** Every list this account owns or has been shared into. */
export function fetchLists(idToken: string) {
  return post<{ lists: TodoList[] }>('todo-mine', { idToken })
}

/** Owner only: replace the member list (emails) a list is shared with. */
export function shareList(idToken: string, id: string, members: string[]) {
  return post<{ list: TodoList }>('todo-share', { idToken, id, members })
}

/** Owner deletes the list for everyone; a member just removes their own access. */
export function removeList(idToken: string, id: string) {
  return post<{ ok: boolean }>('todo-delete', { idToken, id })
}
