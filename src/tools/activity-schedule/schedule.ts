// An illustrated activity schedule: the model, the share encoding, and the
// one check that makes it more than a grid of boxes.
//
// The reference this was built from is the kind of sheet a Saudi kindergarten
// or a primary class pins on the wall: a time and an activity per day, an icon
// beside each activity so a child who cannot yet read can still follow the day.
// What every maker of those sheets leaves you to do by eye is keep the TIMES
// straight — and the sheet this was modelled on had four rows where one day's
// time had drifted from the rest of its row (`9:30 – 9:30`, `10:00 – 19:30`,
// `10:00 – 10:40`). Nobody proof-reads a wall chart column by column, which is
// exactly why a tool should.
//
// So the time lives on the CELL, not on the row. That is the whole reason the
// check can exist: a single time per row makes disagreement unrepresentable
// and the sheet pinned to a real wall says it happens anyway.

import { foldArabic } from '../../lib/fuzzy'
import { SCHOOL_WEEK, WEEK, type DayKey } from '../../lib/week'

export { WEEK, SCHOOL_WEEK, DAY_LABEL, columnOrder, type DayKey } from '../../lib/week'

export interface Cell {
  /** Free text — whatever the activity is called. */
  name: string
  /** One emoji. Chosen, remembered, or guessed; see `icons.ts`. */
  icon: string
  /** This cell's own time, e.g. `7:00 – 7:30`. */
  time: string
}

export interface Row {
  cells: Partial<Record<DayKey, Cell>>
}

export interface Schedule {
  /** Stable id, so saving twice updates rather than duplicates. */
  id: string
  title: string
  /** A line under the title — the class, the term, whatever it is. */
  note: string
  days: DayKey[]
  rows: Row[]
  /** Draw the header and footer illustrations on the sheet. */
  art: boolean
  updated: number
}

export const emptyCell = (): Cell => ({ name: '', icon: '', time: '' })

export const cellAt = (row: Row, day: DayKey): Cell => row.cells[day] ?? emptyCell()

export const hasContent = (c: Cell | undefined) => !!c && (!!c.name.trim() || !!c.time.trim())

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function emptySchedule(locale: 'en' | 'ar', rows = 8): Schedule {
  return {
    id: newId(),
    title: locale === 'ar' ? 'الجدول الأسبوعي' : 'Weekly schedule',
    note: locale === 'ar' ? 'أيام الدراسة: الأحد إلى الخميس' : 'School days: Sunday to Thursday',
    days: [...SCHOOL_WEEK],
    rows: Array.from({ length: rows }, () => ({ cells: {} })),
    art: true,
    updated: Date.now(),
  }
}

export const isBlank = (s: Schedule) =>
  s.rows.every((r) => Object.values(r.cells).every((c) => !hasContent(c)))

// --- names -----------------------------------------------------------------

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

// --- times -----------------------------------------------------------------

export interface Span {
  /** Minutes from midnight. */
  from: number
  to: number
}

const TIME = /(\d{1,2})\s*[:.]\s*(\d{2})/g

/**
 * Read `7:00 – 7:30` — or `٧:٠٠ - ٧:٣٠`, or `7.00-7.30`.
 *
 * Deliberately forgiving about the separator, because the dash between two
 * times is typed as a hyphen, an en dash, an em dash or an Arabic comma
 * depending on the keyboard, and refusing any of those would turn the harmony
 * check off for exactly the person whose sheet needs it. A single time with no
 * range is legitimate (`11:00`, the end of the day) and yields `to === from`.
 */
export function parseSpan(raw: string): Span | null {
  const latin = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  const found: number[] = []
  TIME.lastIndex = 0
  for (let m = TIME.exec(latin); m; m = TIME.exec(latin)) {
    const h = Number(m[1])
    const min = Number(m[2])
    if (h > 23 || min > 59) return null
    found.push(h * 60 + min)
  }
  if (!found.length) return null
  return { from: found[0], to: found.length > 1 ? found[1] : found[0] }
}

/** The times in a row, as typed, for the cells that have one. */
const rowTimes = (row: Row, days: DayKey[]): string[] =>
  days.map((d) => cellAt(row, d).time.trim()).filter(Boolean)

/**
 * The time the rest of the row agrees on, or null when it does not agree.
 *
 * A plurality is not enough: two days saying one thing and two saying another
 * is a row with no consensus, and picking the first would be inventing one.
 * Suggesting nothing is the honest answer there.
 */
export function rowConsensus(row: Row, days: DayKey[]): string | null {
  const times = rowTimes(row, days)
  if (times.length < 2) return null
  const counts = new Map<string, number>()
  for (const t of times) counts.set(t, (counts.get(t) ?? 0) + 1)
  let best = ''
  let n = 0
  let tied = false
  for (const [t, c] of counts) {
    if (c > n) { best = t; n = c; tied = false }
    else if (c === n) tied = true
  }
  if (tied || n < 2) return null
  return best
}

export type Trouble =
  /** This cell's time is not the one the rest of the row agrees on. */
  | { kind: 'odd'; expected: string }
  /** The range ends before it starts. */
  | { kind: 'backwards' }
  /** The range starts and ends at the same minute. */
  | { kind: 'zero' }
  /** There is an activity here and no time at all, while the row has one. */
  | { kind: 'missing'; expected: string }

/**
 * What is wrong with one cell's time, if anything.
 *
 * The three malformed-range cases are cheap to add and were all present on the
 * sheet this tool was modelled on, which is the argument for including them:
 * `9:30 – 9:30` and `10:45 – 10:45` are zero-length, and `10:00 – 19:30` is a
 * typo for 10:00 that reads as a nine-and-a-half-hour art lesson. None of them
 * is catchable by the row check, because a typo can be the only entry in its
 * row — and none of them is visible to a person scanning a wall chart either.
 */
export function troubleWith(row: Row, day: DayKey, days: DayKey[]): Trouble | null {
  const cell = cellAt(row, day)
  if (!hasContent(cell)) return null
  const expected = rowConsensus(row, days)
  const time = cell.time.trim()

  if (!time) return expected ? { kind: 'missing', expected } : null

  const span = parseSpan(time)
  if (span) {
    if (span.to < span.from) return { kind: 'backwards' }
    if (span.to === span.from && /[-–—]|إلى/.test(time)) return { kind: 'zero' }
  }
  if (expected && time !== expected) return { kind: 'odd', expected }
  return null
}

/** Every cell in the schedule with something wrong with its time. */
export function troubles(s: Schedule): Array<{ row: number; day: DayKey; trouble: Trouble }> {
  const out: Array<{ row: number; day: DayKey; trouble: Trouble }> = []
  s.rows.forEach((row, i) => {
    for (const day of s.days) {
      const trouble = troubleWith(row, day, s.days)
      if (trouble) out.push({ row: i, day, trouble })
    }
  })
  return out
}

/** Give every filled cell in the row the time the row agrees on. */
export function alignRow(row: Row, days: DayKey[]): Row {
  const expected = rowConsensus(row, days)
  if (!expected) return row
  const cells = { ...row.cells }
  for (const d of days) {
    const c = cells[d]
    if (c && hasContent(c) && c.time.trim() !== expected) cells[d] = { ...c, time: expected }
  }
  return { cells }
}

// --- the share link --------------------------------------------------------

/**
 * A compact form, because the whole schedule travels in a URL and that URL has
 * to fit in a QR code somebody can print and scan.
 *
 * Three savings, each measured against the reference sheet (5 days, 9 rows):
 * the activity names repeat down every column, so they become a dictionary;
 * the times repeat across every row, so they do too; and a row where every day
 * shares one time — which is the normal case and the one the harmony check
 * pushes towards — stores that time once for the row instead of five times.
 * Together that is roughly 800 bytes for a full week, against about 2,600 for
 * the same thing as plain JSON. The difference is a QR of about 113 modules
 * rather than one too dense to print on a sheet of A4.
 */
interface Compact {
  t: string
  n: string
  /** Day indices into WEEK. */
  d: number[]
  /** Dictionary: [name, icon]. */
  v: Array<[string, string]>
  /** Dictionary of times. */
  m: string[]
  /**
   * One entry per row: the row's own time index (-1 for none) followed by one
   * item per day — 0 for an empty cell, `v+1` for a cell on the row's time, or
   * `[v+1, timeIndex]` for a cell that keeps its own.
   */
  r: Array<Array<number | [number, number]>>
  /** 1 when the illustrations are on. */
  a: number
}

export async function encodeSchedule(s: Schedule): Promise<string> {
  const names: string[] = []
  const vocab: Array<[string, string]> = []
  const times: string[] = []
  const vIdx = (c: Cell) => {
    const key = c.name + ' ' + c.icon
    let i = names.indexOf(key)
    if (i < 0) { i = names.push(key) - 1; vocab.push([c.name, c.icon]) }
    return i
  }
  const tIdx = (t: string) => {
    let i = times.indexOf(t)
    if (i < 0) i = times.push(t) - 1
    return i
  }

  const rows = s.rows.map((row) => {
    const common = rowConsensus(row, s.days)
      ?? (s.days.map((d) => cellAt(row, d).time.trim()).filter(Boolean)[0] ?? '')
    const out: Array<number | [number, number]> = [common ? tIdx(common) : -1]
    for (const d of s.days) {
      const c = row.cells[d]
      if (!c || !hasContent(c)) { out.push(0); continue }
      const v = vIdx(c) + 1
      const t = c.time.trim()
      out.push(t === common ? v : [v, t ? tIdx(t) : -1])
    }
    return out
  })

  const c: Compact = {
    t: s.title, n: s.note,
    d: s.days.map((d) => WEEK.indexOf(d)),
    v: vocab, m: times, r: rows, a: s.art ? 1 : 0,
  }
  return toBase64Url(await deflate(new TextEncoder().encode(JSON.stringify(c))))
}

export async function decodeSchedule(raw: string): Promise<Schedule | null> {
  try {
    const c = JSON.parse(await unpack(fromBase64Url(raw))) as Compact
    if (!c || !Array.isArray(c.r) || !Array.isArray(c.d)) return null
    const days = c.d.map((i) => WEEK[i]).filter(Boolean)
    if (!days.length) return null
    const vocab = Array.isArray(c.v) ? c.v : []
    const times = Array.isArray(c.m) ? c.m : []

    const rows: Row[] = c.r.map((entry) => {
      const [rowT, ...items] = entry as Array<number | [number, number]>
      const common = typeof rowT === 'number' && rowT >= 0 ? (times[rowT] ?? '') : ''
      const cells: Partial<Record<DayKey, Cell>> = {}
      days.forEach((d, i) => {
        const item = items[i]
        if (!item) return
        const [v, t] = Array.isArray(item) ? item : [item, null]
        const entryV = vocab[(v as number) - 1]
        if (!entryV) return
        cells[d] = {
          name: String(entryV[0] ?? ''),
          icon: String(entryV[1] ?? ''),
          time: t === null || t < 0 ? (Array.isArray(item) ? '' : common) : (times[t] ?? ''),
        }
      })
      return { cells }
    })

    return {
      id: newId(),
      title: String(c.t ?? ''),
      note: String(c.n ?? ''),
      days, rows,
      art: c.a !== 0,
      updated: Date.now(),
    }
  } catch { return null }
}

/**
 * The payload is DEFLATED before it is base64'd, and that is most of why the
 * QR is a printable size at all.
 *
 * A schedule is the most compressible thing there is — the same day names,
 * the same time format and the same handful of activity names, over and over.
 * The dictionary in `Compact` takes the repetition out at the record level and
 * deflate takes out what is left. Measured on real-shaped sheets:
 *
 * | sheet | plain | deflated | QR |
 * |---|---|---|---|
 * | 16 rows, one activity per row | 1,323 B | **616 B** | 121 → 85 modules, 54 → 39mm |
 * | 24 rows, every cell different | 5,927 B | **1,407 B** | past the limit → 125 modules, 56mm |
 *
 * So it is not a tidy-up: the bottom row is a sheet that could not have a QR
 * at all and now has one, and every ordinary sheet gets a code a third
 * smaller. `deflate-raw` rather than gzip because the header and trailer are
 * 18 bytes of nothing when both ends are ours — the same choice `lib/zip.ts`
 * makes, and the same API, which this site already requires.
 */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Inflate, falling back to reading the bytes as text.
 *
 * The fallback is not for old links — there are none — it is so that a link
 * built by hand, or by anything that does not compress, still opens. A wrong
 * guess costs nothing: JSON.parse rejects it and the caller reports a bad
 * link, which is what it would have done anyway.
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

export async function readShareHash(hash: string): Promise<Schedule | null> {
  const m = /[#&]s=([^&]+)/.exec(hash)
  return m ? decodeSchedule(m[1]) : null
}

// --- the colours the day columns are tinted with ----------------------------
//
// Defined here rather than in either renderer, because the HTML grid and the
// canvas the PDF is drawn on have to agree and neither can read the other's
// stylesheet. Flat and pale on purpose: the sheet is printed, and a saturated
// column head costs a colour cartridge and makes the text under it harder to
// read than the white it replaced.

export const DAY_TINT: Record<DayKey, { head: string; band: string }> = {
  sun: { head: '#e8b4bc', band: '#fbeff1' },
  mon: { head: '#f0cf8a', band: '#fdf6e7' },
  tue: { head: '#a9cc9b', band: '#f0f6ed' },
  wed: { head: '#b6aedb', band: '#f2f0fa' },
  thu: { head: '#8fc4cc', band: '#eef6f7' },
  fri: { head: '#d7bfa6', band: '#f8f2eb' },
  sat: { head: '#c3c9a8', band: '#f4f6ec' },
}
