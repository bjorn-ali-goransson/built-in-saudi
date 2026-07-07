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

export interface MeetingType {
  id: string
  name: string
  minutes: number
  meet: boolean // attach a Google Meet link to the booking
}

export interface HostConfig {
  code: string
  tz: string
  meeting: MeetingConfig // primary meeting (mirrors meetingTypes[0]) — kept for the backend
  meetingTypes: MeetingType[]
  availability: AvailWindow[]
  notify: { push: boolean; telegram: boolean; email: boolean }
  pushSub?: unknown // this device's Web Push subscription, sent to the host record
}

// ---- Grid geometry ----------------------------------------------------------

export const DAY_START_MIN = 0 // grid covers the whole day, 00:00 …
export const DAY_END_MIN = 24 * 60 // … to 24:00
export const SLOT_MIN = 60 // one grid row = one whole hour (availability is hourly)
export const ROWS = (DAY_END_MIN - DAY_START_MIN) / SLOT_MIN // 24
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
  const len = meeting.minutes * 60_000
  const step = (meeting.minutes + meeting.gapMinutes) * 60_000
  const earliest = now + meeting.minNoticeHours * 3_600_000
  const HOUR = 3_600_000
  const slots: Slot[] = []
  const add = (s: number) => {
    const e = s + len
    if (s < earliest) return
    if (busy.some((b) => s < b.end && e > b.start)) return
    slots.push({ startUtc: s, endUtc: e })
  }
  for (const w of windows) {
    const winStart = dayMidnightUtc + hhmmToMinutes(w.start) * 60_000
    const winEnd = dayMidnightUtc + hhmmToMinutes(w.end) * 60_000
    if (meeting.minutes > 60) {
      // Long meetings span hour boundaries — step continuously across the window.
      for (let s = winStart; s + len <= winEnd + 1; s += step) add(s)
    } else {
      // One meeting per painted hour; the rest of the hour is the gap.
      for (let h = winStart; h < winEnd; h += HOUR) add(h)
    }
  }
  return slots
}

/**
 * Client-side slot preview from the host's own config, computed in the browser's
 * local time (which is the host's tz). No backend, no busy-times — it's what the
 * booking page would show for a host with an empty calendar. Used by ?preview=1.
 */
export function previewSlots(cfg: HostConfig, now: number = Date.now()): number[] {
  const { meeting, availability } = cfg
  const len = meeting.minutes
  const step = meeting.minutes + meeting.gapMinutes
  const earliest = now + meeting.minNoticeHours * 3_600_000
  const horizonEnd = now + meeting.horizonDays * 86_400_000
  const out: number[] = []
  for (let d = 0; d <= meeting.horizonDays + 1; d++) {
    const day = new Date(now + d * 86_400_000)
    const weekday = day.getDay()
    for (const w of availability) {
      if (w.day !== weekday) continue
      const [sh, sm] = w.start.split(':').map(Number)
      const [eh, em] = w.end.split(':').map(Number)
      const winStartMin = sh * 60 + sm
      const winEndMin = eh * 60 + em
      const addAt = (mins: number) => {
        const dt = new Date(day)
        dt.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
        const s = dt.getTime()
        if (s < earliest || s > horizonEnd) return
        out.push(s)
      }
      if (len > 60) {
        for (let m = winStartMin; m + len <= winEndMin; m += step) addAt(m)
      } else {
        // One meeting per painted hour.
        for (let h = winStartMin; h < winEndMin; h += 60) addAt(h)
      }
    }
  }
  return [...new Set(out)].sort((a, b) => a - b)
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

export function defaultMeetingTypes(): MeetingType[] {
  return [{ id: makeCode(), name: 'Meeting', minutes: 45, meet: true }]
}

export function defaultConfig(): HostConfig {
  return {
    code: makeCode(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh',
    meeting: defaultMeeting(),
    meetingTypes: defaultMeetingTypes(),
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
      const meeting = { ...defaultMeeting(), ...(parsed.meeting || {}) }
      return {
        ...defaultConfig(),
        ...parsed,
        meeting,
        // migrate: derive a first meeting type from the legacy single meeting
        meetingTypes: parsed.meetingTypes?.length
          ? parsed.meetingTypes
          : [{ id: makeCode(), name: meeting.title || 'Meeting', minutes: meeting.minutes || 45, meet: false }],
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

// Public Telegram bot handle (safe to expose). The dashboard deep-links to
// t.me/<bot>?start=<code>; the telegramWebhook binds that chat to the host.
export const TELEGRAM_BOT = 'BuiltInSaudi_bot'
