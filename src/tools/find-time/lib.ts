// The week grid, as THIS browser sees it.
//
// A poll's slots are instants (its start plus 30 minutes each), so each viewer
// lays them out on their own wall clock: a column per local date, a row per
// local half hour. Somebody seven hours from the organiser gets the same slots
// on different rows, and the week can spill into an eighth column; that is the
// truth of their week, not a bug. A zone at a quarter past (Nepal) rounds each
// slot down to its half-hour row, which stays one slot per row because the
// slots are 30 minutes apart.
import type { Person } from './api'

export interface Layout {
  /** One per local date the poll touches, in order. */
  cols: { key: string; date: Date }[]
  /** Row count: half hours in a day. */
  rows: number
  /** `${col}:${row}` → slot index. */
  cell: Map<string, number>
  /** slot index → [col, row]. */
  where: Map<number, [number, number]>
}

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function layout(start: number, days: number, slotMin: number): Layout {
  const n = (days * 24 * 60) / slotMin
  const rows = (24 * 60) / slotMin
  const cols: Layout['cols'] = []
  const colOf = new Map<string, number>()
  const cell = new Map<string, number>()
  const where = new Map<number, [number, number]>()
  for (let i = 0; i < n; i++) {
    const d = new Date(start + i * slotMin * 60000)
    const key = dateKey(d)
    if (!colOf.has(key)) { colOf.set(key, cols.length); cols.push({ key, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()) }) }
    const col = colOf.get(key)!
    const row = Math.floor((d.getHours() * 60 + d.getMinutes()) / slotMin)
    // Autumn's repeated hour puts two slots on one row; the later one keeps it.
    cell.set(`${col}:${row}`, i)
    where.set(i, [col, row])
  }
  return { cols, rows, cell, where }
}

export const slotTime = (start: number, slotMin: number, i: number) => start + i * slotMin * 60000

/** Who is free in each slot, with `mine` standing in for my saved answer
 *  (so the overlay follows my drag before the server has heard of it). */
export function tally(people: Person[], mine: Set<number> | null): { free: Map<number, string[]>; answered: number } {
  const free = new Map<number, string[]>()
  let answered = 0
  for (const p of people) {
    const live = p.you && mine
    const slots = live ? [...mine] : p.answered ? p.avail : []
    // Marking my first slot makes me one of those who answered, as saving will.
    if (live ? p.answered || mine.size > 0 : p.answered) answered++
    for (const s of slots) {
      const a = free.get(s)
      if (a) a.push(p.name); else free.set(s, [p.name])
    }
  }
  return { free, answered }
}

/** The slots everybody who answered marked, once two or more have. */
export function everyone(free: Map<number, string[]>, answered: number): number[] {
  if (answered < 2) return []
  return [...free].filter(([, names]) => names.length === answered).map(([s]) => s).sort((a, b) => a - b)
}

/** The slots the most people marked, when nothing suits everybody. */
export function best(free: Map<number, string[]>): { slots: number[]; count: number } {
  let count = 0
  for (const names of free.values()) count = Math.max(count, names.length)
  if (count < 2) return { slots: [], count }
  return { slots: [...free].filter(([, n]) => n.length === count).map(([s]) => s).sort((a, b) => a - b), count }
}

/** Consecutive slots as [first, last] runs: "10:00–11:30", not three rows. */
export function runs(slots: number[]): [number, number][] {
  const out: [number, number][] = []
  for (const s of slots) {
    const last = out[out.length - 1]
    if (last && last[1] === s - 1) last[1] = s
    else out.push([s, s])
  }
  return out
}

// --- this browser's list of polls it has opened ----------------------------
const RECENT = 'bis-find-time-recent'
export interface Recent { code: string; title: string; at: number; until: number }
export function loadRecent(): Recent[] {
  try {
    const all = JSON.parse(localStorage.getItem(RECENT) || '[]') as Recent[]
    return all.filter((r) => r && r.code && r.until > Date.now())
  } catch { return [] }
}
export function rememberPoll(code: string, title: string, until: number) {
  try {
    const rest = loadRecent().filter((r) => r.code !== code)
    localStorage.setItem(RECENT, JSON.stringify([{ code, title, at: Date.now(), until }, ...rest].slice(0, 12)))
  } catch { /* ignore */ }
}
export function forgetPoll(code: string) {
  try { localStorage.setItem(RECENT, JSON.stringify(loadRecent().filter((r) => r.code !== code))) } catch { /* ignore */ }
}

// Polls this browser asked to be notified about: code → push endpoint.
const PUSHED = 'bis-find-time-push'
export function loadPushed(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PUSHED) || '{}') as Record<string, string> } catch { return {} }
}
export function setPushed(code: string, endpoint: string | null) {
  try {
    const all = loadPushed()
    if (endpoint) all[code] = endpoint; else delete all[code]
    localStorage.setItem(PUSHED, JSON.stringify(all))
  } catch { /* ignore */ }
}
