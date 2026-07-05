// Shared types + slot math for Book With Me. The Firestore doc shape mirrors
// HostConfig (see docs/tools/book-with-me.md); until the backend is live the
// host dashboard persists this to localStorage under BIS_KEY.

export interface AvailWindow {
  day: number // 0 = Sunday … 6 = Saturday (host-tz local)
  start: string // 'HH:MM'
  end: string // 'HH:MM' (exclusive)
}

export interface MeetingConfig {
  minutes: number // meeting length
  gapMinutes: number // gap between consecutive meetings
  bufferBefore: number
  bufferAfter: number
  horizonDays: number // how far ahead people can book
  minNoticeHours: number // earliest a slot can be booked from now
  title: string
  location: string
}

export interface HostConfig {
  code: string
  tz: string
  meeting: MeetingConfig
  availability: AvailWindow[]
  notify: { push: boolean; telegram: boolean; email: boolean }
}

// ---- Grid geometry ----------------------------------------------------------

export const DAY_START_MIN = 6 * 60 // grid starts at 06:00
export const DAY_END_MIN = 24 * 60 // …ends at 24:00
export const SLOT_MIN = 30 // one grid row = 30 minutes
export const ROWS = (DAY_END_MIN - DAY_START_MIN) / SLOT_MIN // 36
export const DAYS = 7

export type Grid = boolean[][] // [day 0..6][row 0..ROWS-1]

export function emptyGrid(): Grid {
  return Array.from({ length: DAYS }, () => Array<boolean>(ROWS).fill(false))
}

export function rowToMinutes(row: number): number {
  return DAY_START_MIN + row * SLOT_MIN
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

// ---- Grid <-> availability windows -----------------------------------------

/** Merge consecutive painted rows per day into [start,end) windows. */
export function gridToWindows(grid: Grid): AvailWindow[] {
  const out: AvailWindow[] = []
  for (let day = 0; day < DAYS; day++) {
    let runStart = -1
    for (let row = 0; row <= ROWS; row++) {
      const on = row < ROWS && grid[day][row]
      if (on && runStart === -1) runStart = row
      else if (!on && runStart !== -1) {
        out.push({
          day,
          start: minutesToHHMM(rowToMinutes(runStart)),
          end: minutesToHHMM(rowToMinutes(row)),
        })
        runStart = -1
      }
    }
  }
  return out
}

export function windowsToGrid(windows: AvailWindow[]): Grid {
  const grid = emptyGrid()
  for (const w of windows) {
    const from = Math.max(0, Math.round((hhmmToMinutes(w.start) - DAY_START_MIN) / SLOT_MIN))
    const to = Math.min(ROWS, Math.round((hhmmToMinutes(w.end) - DAY_START_MIN) / SLOT_MIN))
    for (let row = from; row < to; row++) if (grid[w.day]) grid[w.day][row] = true
  }
  return grid
}

// ---- Slot enumeration (used by the booking page) ----------------------------

export interface Slot {
  startUtc: number // epoch ms
  endUtc: number
}

/**
 * Enumerate bookable slot start times inside a day's availability windows,
 * stepping by (meeting length + gap). `busy` ranges (existing bookings / Google
 * free-busy, epoch-ms) are subtracted. Times are computed in the host tz using
 * the provided day-in-tz midnight epoch as the anchor.
 */
export function enumerateDaySlots(
  windows: AvailWindow[],
  dayMidnightUtc: number,
  meeting: MeetingConfig,
  busy: { start: number; end: number }[],
  now: number,
): Slot[] {
  const step = (meeting.minutes + meeting.gapMinutes) * 60_000
  const len = meeting.minutes * 60_000
  const earliest = now + meeting.minNoticeHours * 3_600_000
  const slots: Slot[] = []
  for (const w of windows) {
    const winStart = dayMidnightUtc + hhmmToMinutes(w.start) * 60_000
    const winEnd = dayMidnightUtc + hhmmToMinutes(w.end) * 60_000
    for (let s = winStart; s + len <= winEnd + 1; s += step) {
      const e = s + len
      if (s < earliest) continue
      const clash = busy.some((b) => s < b.end && e > b.start)
      if (!clash) slots.push({ startUtc: s, endUtc: e })
    }
  }
  return slots
}

// ---- Defaults + persistence -------------------------------------------------

export const BIS_KEY = 'bis-bookwith'

export function defaultMeeting(): MeetingConfig {
  return {
    minutes: 45,
    gapMinutes: 0,
    bufferBefore: 0,
    bufferAfter: 0,
    horizonDays: 30,
    minNoticeHours: 4,
    title: 'Meeting',
    location: '',
  }
}

/** Short URL-safe booking code (no ambiguous chars). */
export function makeCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(7)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export function defaultConfig(): HostConfig {
  return {
    code: makeCode(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh',
    meeting: defaultMeeting(),
    availability: [
      // A sensible starter: weekday mornings, so the grid isn't blank.
      { day: 1, start: '09:00', end: '12:00' },
      { day: 2, start: '09:00', end: '12:00' },
      { day: 3, start: '09:00', end: '12:00' },
      { day: 4, start: '09:00', end: '12:00' },
      { day: 0, start: '10:00', end: '13:00' },
    ],
    notify: { push: false, telegram: false, email: true },
  }
}

export function loadConfig(): HostConfig {
  try {
    const raw = localStorage.getItem(BIS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HostConfig>
      return {
        ...defaultConfig(),
        ...parsed,
        meeting: { ...defaultMeeting(), ...(parsed.meeting || {}) },
        notify: { push: false, telegram: false, email: true, ...(parsed.notify || {}) },
        // keep a stable code across reloads
        code: parsed.code || makeCode(),
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return defaultConfig()
}

export function saveConfig(cfg: HostConfig): void {
  try {
    localStorage.setItem(BIS_KEY, JSON.stringify(cfg))
  } catch {
    /* quota / private mode — non-fatal */
  }
}

// Path-based booking link on the apex (subdomain deferred — no Cloudflare needed).
// A bare /book/<code> lets the visitor's own locale kick in via the Layout
// redirect, so links aren't language-locked.
export const BOOKING_LINK_BASE = 'https://built-in-saudi.com/book'
