// To-do lists: local-first data model + this-browser storage. A list lives in
// localStorage and works with no account at all; turning on sync copies it to the
// backend (functions/todo.js) so it can be opened elsewhere and shared with other
// people by email. Nothing leaves the device until the user opts a list in.

export interface TodoItem {
  id: string
  text: string
  done: boolean
  at: number
  by?: string // who added it (display name) — only meaningful on a shared list
}

export interface TodoList {
  id: string
  title: string
  items: TodoItem[]
  updatedAt: number
  /** Synced to the account (and therefore shareable). Local-only when false. */
  cloud?: boolean
  /** Google `sub` of the owner, once synced. */
  owner?: string
  /** Emails this list is shared with (owner-managed). */
  members?: string[]
  /** True when this list reached us through someone else's share. */
  shared?: boolean
}

const KEY = 'bis-todo'
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 12)

export function newList(title: string): TodoList {
  return { id: uid(), title, items: [], updatedAt: Date.now() }
}

export function loadLists(): TodoList[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(v)) return []
    return v.filter((l) => l && typeof l.id === 'string').map((l) => ({
      ...l,
      title: String(l.title || ''),
      items: Array.isArray(l.items) ? l.items.filter((i: TodoItem) => i && typeof i.id === 'string') : [],
      updatedAt: Number(l.updatedAt) || 0,
    }))
  } catch { return [] }
}

export function saveLists(lists: TodoList[]) {
  try { localStorage.setItem(KEY, JSON.stringify(lists)) } catch { /* storage full */ }
}

/** Merge a server copy into the local set: newer `updatedAt` wins per list, and
 *  lists that only exist on one side are kept. Deliberately coarse — a to-do list
 *  is small and a whole-list last-write-wins is predictable to explain. */
export function mergeLists(local: TodoList[], remote: TodoList[]): TodoList[] {
  const by = new Map(local.map((l) => [l.id, l]))
  for (const r of remote) {
    const mine = by.get(r.id)
    if (!mine || r.updatedAt >= mine.updatedAt) by.set(r.id, { ...r, cloud: true })
  }
  return [...by.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export const remaining = (l: TodoList) => l.items.filter((i) => !i.done).length
