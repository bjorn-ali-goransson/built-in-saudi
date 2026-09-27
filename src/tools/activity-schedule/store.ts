// Saved schedules, and the vocabulary they add up to.
//
// The vocabulary is the reason the saved list is read as a whole rather than
// one schedule at a time: the suggestions under the activity box come from
// EVERY schedule this person has, not the open one. A teacher builds next
// term's sheet from last term's words, and a tool that only remembers within
// one document makes them type «طابور وأذكار الصباح» from scratch every time.

import { itemsOn, migrate, nameKey, type Schedule } from './schedule'

const KEY = 'bis-schedules'
const CURRENT = 'bis-schedule-current'

export function loadAll(): Schedule[] {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : null
    // Through `migrate`, because a sheet saved before the axis existed is
    // still somebody's term plan. See `schedule.ts`.
    return Array.isArray(v) ? v.map(migrate).filter((x): x is Schedule => !!x) : []
  } catch { return [] }
}

function writeAll(list: Schedule[]): Schedule[] {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
  return list
}

/** Save under the schedule's own id — saving twice updates, never duplicates. */
export function saveOne(s: Schedule): Schedule[] {
  const stamped = { ...s, updated: Date.now() }
  const list = loadAll()
  const i = list.findIndex((x) => x.id === s.id)
  if (i >= 0) list[i] = stamped
  else list.unshift(stamped)
  list.sort((a, b) => b.updated - a.updated)
  return writeAll(list)
}

export function deleteOne(id: string): Schedule[] {
  return writeAll(loadAll().filter((s) => s.id !== id))
}

export function loadCurrentId(): string | null {
  try { return localStorage.getItem(CURRENT) } catch { return null }
}

export function setCurrentId(id: string) {
  try { localStorage.setItem(CURRENT, id) } catch { /* ignore */ }
}

/** The working copy, so a half-typed schedule survives a reload unsaved. */
const DRAFT = 'bis-schedule-draft'

export function loadDraft(): Schedule | null {
  try {
    const raw = localStorage.getItem(DRAFT)
    return raw ? migrate(JSON.parse(raw)) : null
  } catch { return null }
}

export function saveDraft(s: Schedule) {
  try { localStorage.setItem(DRAFT, JSON.stringify(s)) } catch { /* ignore */ }
}

export interface Suggestion {
  name: string
  icon: string
  /** How many cells across every schedule use it — the sort order. */
  count: number
}

/**
 * Every activity name this person has used, most-used first.
 *
 * Deduplicated on the folded key, so «قرآن» and «القرآن» are one row rather
 * than two spellings of the same lesson competing for the top of the list. The
 * spelling kept is the one used most; ties go to the one seen most recently,
 * which is what `loadAll` already sorts by.
 */
export function vocabulary(saved: Schedule[], open?: Schedule): Suggestion[] {
  const by = new Map<string, Suggestion>()
  const add = (name: string, icon: string) => {
    const key = nameKey(name)
    if (!key) return
    const found = by.get(key)
    if (found) {
      found.count++
      if (icon && !found.icon) found.icon = icon
    } else by.set(key, { name: name.trim(), icon, count: 1 })
  }
  for (const s of [...(open ? [open] : []), ...saved]) {
    for (const day of s.days) {
      for (const it of itemsOn(s, day)) if (it.name.trim()) add(it.name, it.icon)
    }
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
