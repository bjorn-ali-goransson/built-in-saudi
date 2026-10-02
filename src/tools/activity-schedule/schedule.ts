// An illustrated activity schedule on a real time axis.
//
// The reference this was built from is the kind of sheet a Saudi kindergarten
// or a primary class pins on the wall: a time and an activity per day, an icon
// beside each activity so a child who cannot yet read can still follow the day.
//
// **There is ONE axis and activities sit on it**, the way every real schedule
// works — not a time written into each cell. The sheet this was modelled on
// repeats a time column inside all five day cards, which is the same value
// written five times and therefore five things that can drift apart. They had:
// `9:30 – 9:30`, `10:00 – 19:30`, a period that lost its end time.
//
// **But the days are NOT locked together.** A real week diverges: assembly
// only on Sunday, an early finish on Thursday, a longer art lesson once. So an
// activity carries its own start and end and can be moved anywhere on the
// axis — to a quarter of an hour, which is the granularity a timetable is
// actually written in. Locking every day to one row would make the common case
// tidy and the real week unrepresentable.
//
// What stops divergence happening by ACCIDENT is not a check after the fact,
// it is the snapping: a dragged activity pulls to the times its neighbours
// already use before it pulls to the raw quarter hour. So lining up is what
// happens when you do nothing, and differing is a deliberate act.

import { foldArabic } from '../../lib/fuzzy'
import { SCHOOL_WEEK, WEEK, type DayKey } from '../../lib/week'

export { WEEK, SCHOOL_WEEK, DAY_LABEL, columnOrder, type DayKey } from '../../lib/week'

/**
 * The grid everything lands on, in minutes.
 *
 * Fifteen because that is how a timetable is written — quarter past, half
 * past — and because it is the coarsest grid that can express every period
 * anybody actually schedules. Five would let a drag land on 7:03, which is not
 * a time a lesson starts and is a nuisance to correct.
 */
export const SNAP = 15

/** The shortest an activity can be. One snap; anything less is a mis-drag. */
export const MIN_LEN = 15

/** How near a neighbouring day's edge pulls a drag to it, in minutes. */
export const MAGNET = 10

export interface Item {
  /** Stable across edits, so React keys and drags survive a re-sort. */
  id: string
  name: string
  /** One emoji. Chosen, remembered, or guessed; see `icons.ts`. */
  icon: string
  /** Minutes from midnight. Both are multiples of `SNAP`. */
  start: number
  end: number
}

export interface Schedule {
  /** Stable id, so saving twice updates rather than duplicates. */
  id: string
  title: string
  /** A line under the title — the term, the days covered, whatever it is. */
  note: string
  /**
   * The class this belongs to: «تمهيدي», «KG2», «Year 1 Blue».
   *
   * Its own field rather than part of the note, because on every real sheet of
   * this kind it is set apart and emphasised — it is the thing a parent looks
   * for first to know whether the chart on the wall is their child's.
   */
  group: string
  days: DayKey[]
  /** The axis, in minutes from midnight. */
  from: number
  to: number
  items: Partial<Record<DayKey, Item[]>>
  /** Draw the header and footer illustrations on the sheet. */
  art: boolean
  updated: number
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const itemsOn = (s: Schedule, day: DayKey): Item[] => s.items[day] ?? []

export function emptySchedule(locale: 'en' | 'ar'): Schedule {
  return {
    id: newId(),
    title: locale === 'ar' ? 'الجدول الأسبوعي' : 'Weekly schedule',
    note: locale === 'ar' ? 'أيام الدراسة: الأحد إلى الخميس' : 'School days: Sunday to Thursday',
    group: '',
    days: [...SCHOOL_WEEK],
    from: 7 * 60,
    to: 12 * 60,
    items: {},
    art: true,
    updated: Date.now(),
  }
}

export const isBlank = (s: Schedule) => s.days.every((d) => itemsOn(s, d).length === 0)

// --- the axis ---------------------------------------------------------------

export const snap = (minutes: number) => Math.round(minutes / SNAP) * SNAP

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * `7:00`, `13:30` — plain, and in Latin digits in both languages.
 *
 * Not `toLocaleTimeString`: on the Arabic side that yields `٧:٠٠ ص`, and every
 * wall chart of this kind in the country writes the time in Latin digits.
 * Ours is the one number on the sheet that is NOT ours to localise — it is a
 * label on a grid, and the grid is read by children learning to tell the time
 * from a clock face with Latin digits on it.
 */
export const fmt = (minutes: number): string => {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

export const fmtSpan = (i: { start: number; end: number }) => `${fmt(i.start)} – ${fmt(i.end)}`

const TIME = /^\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*$/

/** Read `7:30` back off an input. Returns null rather than guessing. */
export function parseTime(raw: string): number | null {
  const latin = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  const m = TIME.exec(latin)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/**
 * The times a drag should pull towards: the quarter hours, plus every edge
 * the OTHER days already use.
 *
 * This is what replaces the old "your rows disagree" warning. A check tells
 * you afterwards; a magnet means the aligned answer is the one you get for
 * free, and a different one costs a deliberate extra few pixels.
 */
export function magnets(s: Schedule, except: DayKey): number[] {
  const out = new Set<number>()
  for (const day of s.days) {
    if (day === except) continue
    for (const it of itemsOn(s, day)) { out.add(it.start); out.add(it.end) }
  }
  return [...out]
}

/** Snap to the nearest neighbour edge if one is within `MAGNET`, else to the grid. */
export function snapWith(minutes: number, pull: number[]): number {
  let best: number | null = null
  let bestGap = MAGNET + 1
  for (const p of pull) {
    const gap = Math.abs(p - minutes)
    if (gap < bestGap) { best = p; bestGap = gap }
  }
  return best !== null ? best : snap(minutes)
}

// --- moving and resizing ----------------------------------------------------

/** Move an item, keeping its length and staying inside the axis. */
export function moveTo(s: Schedule, it: Item, start: number): Item {
  const len = it.end - it.start
  const from = clamp(start, s.from, s.to - len)
  return { ...it, start: from, end: from + len }
}

/** Resize from the bottom edge, never shorter than one snap. */
export function resizeTo(s: Schedule, it: Item, end: number): Item {
  return { ...it, end: clamp(end, it.start + MIN_LEN, s.to) }
}

/** Where a new activity should go: after the last one on that day, or the top. */
export function nextSlot(s: Schedule, day: DayKey): { start: number; end: number } {
  const last = itemsOn(s, day).reduce((a, b) => (b.end > a ? b.end : a), s.from)
  const start = clamp(last, s.from, Math.max(s.from, s.to - 30))
  return { start, end: Math.min(start + 30, s.to) }
}

// --- what is wrong with the day ---------------------------------------------

export type Trouble =
  /** Two activities on the same day claim the same minutes. */
  | { kind: 'overlap'; with: string }
  /** It starts before, or ends after, the axis the sheet declares. */
  | { kind: 'outside' }

/**
 * Overlaps, per day.
 *
 * This is the check a time axis makes possible and a grid of cells cannot: two
 * things at once is a real defect on a real schedule, and it is invisible on a
 * sheet of boxes because the boxes are the same size whatever they say.
 *
 * A GAP is deliberately not a defect. On a wall chart the break between two
 * lessons is very often simply not written down, so flagging every gap would
 * fire constantly on correct sheets — the "always show something" move this
 * site refuses.
 */
export function troubleFor(s: Schedule, day: DayKey, it: Item): Trouble | null {
  if (it.start < s.from || it.end > s.to) return { kind: 'outside' }
  for (const other of itemsOn(s, day)) {
    if (other.id === it.id) continue
    if (it.start < other.end && other.start < it.end) {
      return { kind: 'overlap', with: other.name.trim() || fmtSpan(other) }
    }
  }
  return null
}

export function troubles(s: Schedule): Array<{ day: DayKey; item: Item; trouble: Trouble }> {
  const out: Array<{ day: DayKey; item: Item; trouble: Trouble }> = []
  for (const day of s.days) {
    for (const item of itemsOn(s, day)) {
      const trouble = troubleFor(s, day, item)
      if (trouble) out.push({ day, item, trouble })
    }
  }
  return out
}

/**
 * Lay a day's activities out in columns so overlapping ones sit side by side.
 *
 * Without it two overlapping activities are drawn on top of each other and the
 * one underneath is simply gone from the sheet — which is worse than the
 * overlap it is reporting. Greedy packing over a cluster of mutually
 * overlapping items, which is what every calendar does and is about as simple
 * as this gets.
 */
export function layoutDay(items: Item[]): Array<{ item: Item; col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end)
  const out: Array<{ item: Item; col: number; cols: number }> = []
  let cluster: Array<{ item: Item; col: number }> = []
  let clusterEnd = -1

  const flush = () => {
    const cols = cluster.reduce((n, c) => Math.max(n, c.col + 1), 0)
    for (const c of cluster) out.push({ item: c.item, col: c.col, cols })
    cluster = []
    clusterEnd = -1
  }

  for (const item of sorted) {
    if (cluster.length && item.start >= clusterEnd) flush()
    const taken = new Set(
      cluster.filter((c) => c.item.end > item.start).map((c) => c.col),
    )
    let col = 0
    while (taken.has(col)) col++
    cluster.push({ item, col })
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()
  return out
}

// --- names ------------------------------------------------------------------

/**
 * The key two spellings of one activity have to share.
 *
 * Arabic is why this is not `toLowerCase()`. A teacher types «قرآن» in one
 * schedule and «القرآن» in the next, or writes the harakāt once and not the
 * second time — and every one of those is the same activity, so it must recall
 * the same icon and appear once in the suggestions rather than three times.
 * The alef/ya/ta-marbuta folds are the same same-letter-different-shape
 * substitutions `word-search` normalises for, and for the same reason.
 */
export function nameKey(raw: string): string {
  return foldArabic(raw)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/^ال/, '')
    .replace(/\s+/g, ' ')
}

// --- the share link ---------------------------------------------------------

/**
 * A compact form, because the whole schedule travels in a URL and that URL has
 * to fit in a QR code somebody can print and scan.
 *
 * The activity names repeat down every column, so they become a dictionary;
 * the times are minutes rather than text. Then the whole thing is DEFLATED,
 * which is most of why the QR is a printable size: a schedule is the most
 * compressible thing there is — the same handful of names and the same
 * quarter-hour boundaries, over and over.
 */
interface Compact {
  t: string
  n: string
  /** The class. */
  g?: string
  /** Day indices into WEEK. */
  d: number[]
  /** Axis, in minutes. */
  f: number
  e: number
  /** Dictionary: [name, icon]. */
  v: Array<[string, string]>
  /** One per activity: [dayIndexIntoD, vocabIndex, start, end]. */
  i: Array<[number, number, number, number]>
  /** 1 when the illustrations are on. */
  a: number
}

export async function encodeSchedule(s: Schedule): Promise<string> {
  const keys: string[] = []
  const vocab: Array<[string, string]> = []
  const vIdx = (it: Item) => {
    // JSON rather than a sentinel character. The first version joined on a
    // literal U+0000, which was duly written as a real NUL byte into the
    // source - it compiles, it works, and it makes the file BINARY to grep,
    // which is a landmine for every sweep this repo runs. Same family as the
    // backspace a heredoc writes: an escape that became a control character.
    const key = JSON.stringify([it.name, it.icon])
    let i = keys.indexOf(key)
    if (i < 0) { i = keys.push(key) - 1; vocab.push([it.name, it.icon]) }
    return i
  }

  const items: Array<[number, number, number, number]> = []
  s.days.forEach((day, di) => {
    for (const it of itemsOn(s, day)) items.push([di, vIdx(it), it.start, it.end])
  })

  const c: Compact = {
    t: s.title, n: s.note, g: s.group || undefined,
    d: s.days.map((d) => WEEK.indexOf(d)),
    f: s.from, e: s.to,
    v: vocab, i: items, a: s.art ? 1 : 0,
  }
  return toBase64Url(await deflate(new TextEncoder().encode(JSON.stringify(c))))
}

export async function decodeSchedule(raw: string): Promise<Schedule | null> {
  try {
    const text = await unpack(fromBase64Url(raw))
    const parsed = JSON.parse(text) as Compact & LegacyCompact
    if (!parsed || !Array.isArray(parsed.d)) return null
    const days = parsed.d.map((i) => WEEK[i]).filter(Boolean)
    if (!days.length) return null

    // A link made before the axis existed carries rows of cells instead.
    if (!Array.isArray(parsed.i) && Array.isArray(parsed.r)) {
      return fromLegacy(parsed, days)
    }

    const vocab = Array.isArray(parsed.v) ? parsed.v : []
    const items: Partial<Record<DayKey, Item[]>> = {}
    for (const entry of parsed.i ?? []) {
      const [di, vi, start, end] = entry
      const day = days[di]
      const v = vocab[vi]
      if (!day || !v) continue
      ;(items[day] ??= []).push({
        id: newId(),
        name: String(v[0] ?? ''),
        icon: String(v[1] ?? ''),
        start: Number(start) || 0,
        end: Number(end) || 0,
      })
    }

    return {
      id: newId(),
      title: String(parsed.t ?? ''),
      note: String(parsed.n ?? ''),
      group: String(parsed.g ?? ''),
      days,
      from: Number(parsed.f) || 7 * 60,
      to: Number(parsed.e) || 12 * 60,
      items,
      art: parsed.a !== 0,
      updated: Date.now(),
    }
  } catch { return null }
}

// --- reading what the previous shape wrote ----------------------------------
//
// The tool shipped once with a time on every CELL and rows instead of an axis.
// Both the saved schedules in somebody's browser and any link already handed
// out carry that shape, so both are read rather than discarded. A schedule
// somebody built and printed is not ours to throw away because we changed our
// minds about the model.

interface LegacyCompact {
  r?: Array<Array<number | [number, number]>>
  m?: string[]
}

const LEGACY_TIME = /(\d{1,2})\s*[:.]\s*(\d{2})/g

/** The first two clock times in a free-text label like `7:00 – 7:30`. */
function legacySpan(raw: string): { start: number; end: number } | null {
  const latin = String(raw ?? '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  const found: number[] = []
  LEGACY_TIME.lastIndex = 0
  for (let m = LEGACY_TIME.exec(latin); m; m = LEGACY_TIME.exec(latin)) {
    const h = Number(m[1])
    const min = Number(m[2])
    if (h <= 23 && min <= 59) found.push(h * 60 + min)
  }
  if (!found.length) return null
  return { start: found[0], end: found.length > 1 ? found[1] : found[0] + 30 }
}

function fromLegacy(c: Compact & LegacyCompact, days: DayKey[]): Schedule {
  const vocab = Array.isArray(c.v) ? c.v : []
  const times = Array.isArray(c.m) ? c.m : []
  const items: Partial<Record<DayKey, Item[]>> = {}
  let lo = Infinity
  let hi = -Infinity

  ;(c.r ?? []).forEach((entry, r) => {
    const [rowT, ...cells] = entry
    const rowTime = typeof rowT === 'number' && rowT >= 0 ? times[rowT] : ''
    days.forEach((day, di) => {
      const cell = cells[di]
      if (!cell) return
      const [v, t] = Array.isArray(cell) ? cell : [cell, null]
      const entryV = vocab[(v as number) - 1]
      if (!entryV) return
      const label = t !== null && t >= 0 ? (times[t] ?? '') : rowTime
      // A row with no readable time still has to land somewhere, so it takes
      // half an hour at its position in the sheet. Losing the activity would
      // be worse than placing it approximately.
      const span = legacySpan(label) ?? { start: 8 * 60 + r * 30, end: 8 * 60 + r * 30 + 30 }
      lo = Math.min(lo, span.start)
      hi = Math.max(hi, span.end)
      ;(items[day] ??= []).push({
        id: newId(),
        name: String(entryV[0] ?? ''),
        icon: String(entryV[1] ?? ''),
        start: snap(span.start),
        end: Math.max(snap(span.start) + MIN_LEN, snap(span.end)),
      })
    })
  })

  return {
    id: newId(),
    title: String(c.t ?? ''),
    note: String(c.n ?? ''),
    group: String(c.g ?? ''),
    days,
    from: Number.isFinite(lo) ? snap(lo) : 7 * 60,
    to: Number.isFinite(hi) ? snap(hi) : 12 * 60,
    items,
    art: c.a !== 0,
    updated: Date.now(),
  }
}

/** The same upgrade, for a schedule sitting in `localStorage`. */
export function migrate(raw: unknown): Schedule | null {
  const v = raw as Partial<Schedule> & { rows?: Array<{ cells?: Record<string, unknown> }> }
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v.rows) && !v.items) {
    const days = Array.isArray(v.days) ? (v.days as DayKey[]).filter((d) => WEEK.includes(d)) : []
    const items: Partial<Record<DayKey, Item[]>> = {}
    let lo = Infinity
    let hi = -Infinity
    v.rows.forEach((row, r) => {
      for (const day of days) {
        const cell = row?.cells?.[day] as { name?: string; icon?: string; time?: string } | undefined
        if (!cell || !(cell.name ?? '').trim()) continue
        const span = legacySpan(cell.time ?? '') ?? { start: 8 * 60 + r * 30, end: 8 * 60 + r * 30 + 30 }
        lo = Math.min(lo, span.start)
        hi = Math.max(hi, span.end)
        ;(items[day] ??= []).push({
          id: newId(),
          name: String(cell.name ?? ''),
          icon: String(cell.icon ?? ''),
          start: snap(span.start),
          end: Math.max(snap(span.start) + MIN_LEN, snap(span.end)),
        })
      }
    })
    return {
      id: String(v.id ?? newId()),
      title: String(v.title ?? ''),
      note: String(v.note ?? ''),
      group: String(v.group ?? ''),
      days: days.length ? days : [...SCHOOL_WEEK],
      from: Number.isFinite(lo) ? snap(lo) : 7 * 60,
      to: Number.isFinite(hi) ? snap(hi) : 12 * 60,
      items,
      art: v.art !== false,
      updated: Number(v.updated) || Date.now(),
    }
  }
  // A sheet from before the class line existed simply has none.
  return v.items && Array.isArray(v.days)
    ? ({ ...v, group: String(v.group ?? '') } as Schedule)
    : null
}

/**
 * The payload is DEFLATED before it is base64'd.
 *
 * `deflate-raw` rather than gzip because the header and trailer are 18 bytes
 * of nothing when both ends are ours — the same choice `lib/zip.ts` makes, and
 * the same API, which this site already requires.
 */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Inflate, falling back to reading the bytes as text.
 *
 * The fallback is so a link built by hand, or by anything that does not
 * compress, still opens. A wrong guess costs nothing: JSON.parse rejects it
 * and the caller reports a bad link, which is what it would have done anyway.
 */
async function unpack(bytes: Uint8Array): Promise<string> {
  try {
    const stream = new Blob([bytes as BlobPart]).stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
    return new TextDecoder().decode(await new Response(stream).arrayBuffer())
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

/** base64url — `+` and `/` do not survive being pasted into a chat message. */
function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
}

/**
 * The URL that reopens this schedule in the editor.
 *
 * The trailing slash is added rather than taken from wherever the reader
 * happens to be. Pages here are served as directory `index.html`, so the
 * no-slash form 301-redirects — and this URL is printed onto paper as a QR,
 * where a redirect is a round trip nobody can see failing on a phone with one
 * bar of signal. It is the one link on the site that cannot be corrected after
 * it is handed out.
 */
export async function shareLink(s: Schedule, origin: string, path: string): Promise<string> {
  const dir = path.endsWith('/') ? path : `${path}/`
  return `${origin}${dir}#s=${await encodeSchedule(s)}`
}

/**
 * Read a sheet out of the hash: a carried one (`#s=`) or a named one (`#t=`).
 *
 * Two forms because they answer different questions. `#s=` carries the whole
 * schedule, which is what makes a shared link work with no server and no
 * account — and is also 680 characters of base64. `#t=` names a sheet that
 * ships with the app, so the link is sixty characters and never expires. See
 * `samples.ts`.
 */
export async function readShareHash(
  hash: string, locale: 'en' | 'ar' = 'en',
): Promise<Schedule | null> {
  const named = /[#&]t=([a-z0-9-]+)/i.exec(hash)
  if (named) {
    const { sampleSchedule } = await import('./samples')
    const found = sampleSchedule(named[1].toLowerCase(), locale)
    if (found) return found
  }
  const m = /[#&]s=([^&]+)/.exec(hash)
  return m ? decodeSchedule(m[1]) : null
}

// --- the colours the day columns are tinted with ----------------------------
//
// Defined here rather than in either renderer, because the HTML grid and the
// canvas the PDF is drawn on have to agree and neither can read the other's
// stylesheet. Flat and pale on purpose: the sheet is printed, and a saturated
// column costs a colour cartridge and makes the text on it harder to read than
// the white it replaced.

/**
 * Four tones per day: the head, the alternating half-hour band, the activity
 * block, and the edge that ties them together.
 *
 * Pale on purpose — the sheet gets printed, and a saturated column costs a
 * colour cartridge and makes the text on it harder to read than the white it
 * replaced. The `edge` is what makes the head and the body below it read as
 * ONE card rather than a tinted bar floating above a box.
 */
export const DAY_TINT: Record<DayKey, { head: string; band: string; block: string; edge: string }> = {
  sun: { head: '#f7d3da', band: '#fdf2f4', block: '#fbe7ea', edge: '#eab8c2' },
  mon: { head: '#fae3b0', band: '#fdf7e8', block: '#fcefd2', edge: '#edc87e' },
  tue: { head: '#cfe6c3', band: '#f2f8ef', block: '#e4f0dc', edge: '#a8ccA0'.toLowerCase() },
  wed: { head: '#dcd6f2', band: '#f5f3fb', block: '#eae5f7', edge: '#b7aede' },
  thu: { head: '#c5e3e8', band: '#eff8f9', block: '#ddeff2', edge: '#95c6d0' },
  fri: { head: '#ecd9c2', band: '#faf5ee', block: '#f4e8d8', edge: '#d3b48f' },
  sat: { head: '#dde2c4', band: '#f6f8ee', block: '#ebefdc', edge: '#bcc79a' },
}
