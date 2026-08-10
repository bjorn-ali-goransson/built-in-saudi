// Building and reading .ics calendar files (RFC 5545).
//
// Moved out of `tools/ics-builder/` by a code sweep that measured the obvious:
// **`buildIcs` had exactly one caller while at least six tools compute a date
// somebody needs reminding of** — the two Saudi expiry tools most of all, where
// missing the date costs money. A calendar writer used by the calendar tool and
// by nothing else is the shape of a capability nobody noticed was general.
//
// We already hand-write ICS on the server for Book Me, and the format is small
// enough that a dependency would be silly. But it has three rules that naive
// generators skip, and each one produces a file that looks fine in the browser
// and fails in somebody's calendar:
//
// 1. **Lines fold at 75 octets**, with a single space beginning each
//    continuation. Outlook and several CalDAV servers reject longer lines. The
//    limit is OCTETS, not characters — an Arabic description hits it in half the
//    characters an English one does.
// 2. **Commas, semicolons and backslashes are structural** and must be escaped
//    in text values, and a newline becomes a literal \n.
// 3. **Line endings are CRLF**, and an all-day event is `VALUE=DATE` with no
//    time at all — not midnight-to-midnight, which drags the event across two
//    days for anyone in a different timezone.

export interface EventInput {
  summary: string
  description: string
  location: string
  url: string
  /** Local wall-clock, "YYYY-MM-DD". */
  date: string
  /** "HH:MM", ignored when allDay. */
  start: string
  end: string
  endDate: string
  allDay: boolean
  repeat: Repeat
  repeatCount: number
  /** Minutes before the start; 0 for no reminder. */
  alarm: number
  organizer: string
}

export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export const DEFAULTS: EventInput = {
  summary: '', description: '', location: '', url: '',
  date: '', start: '09:00', end: '10:00', endDate: '',
  allDay: false, repeat: 'none', repeatCount: 0, alarm: 0, organizer: '',
}

const pad = (n: number) => String(n).padStart(2, '0')

/** UTC stamp: 20260806T143000Z */
export function stampUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

/** Date-only value: 20260806 */
export const stampDate = (ymd: string) => ymd.replace(/-/g, '')

export function escapeText(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

export function unescapeText(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')
}

/**
 * Fold a content line to 75 octets, continuing with a leading space.
 *
 * Counted in UTF-8 bytes, and never splitting a multi-byte character — cutting
 * one in half turns an Arabic summary into mojibake in whatever opens the file.
 */
export function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let bytes = 0
  let limit = 75
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (bytes + n > limit) {
      out.push(cur)
      cur = ''
      bytes = 0
      limit = 74 // the continuation's leading space costs one octet
    }
    cur += ch
    bytes += n
  }
  if (cur) out.push(cur)
  return out[0] + out.slice(1).map((l) => `\r\n ${l}`).join('')
}

function uid(): string {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  return `${[...b].map((x) => x.toString(16).padStart(2, '0')).join('')}@built-in-saudi.com`
}

export function buildIcs(ev: EventInput, now = new Date()): string {
  if (!ev.date) throw new Error('no-date')
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Built in Saudi//ICS Builder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid()}`,
    `DTSTAMP:${stampUtc(now)}`,
  ]

  if (ev.allDay) {
    // DTEND is exclusive for a date value, so a one-day event ends the NEXT day.
    // Getting this wrong is why so many all-day events show up a day short.
    const startYmd = stampDate(ev.date)
    const endSource = ev.endDate || ev.date
    const endDate = new Date(`${endSource}T00:00:00`)
    endDate.setDate(endDate.getDate() + 1)
    lines.push(`DTSTART;VALUE=DATE:${startYmd}`)
    lines.push(`DTEND;VALUE=DATE:${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}`)
  } else {
    const s = new Date(`${ev.date}T${ev.start || '09:00'}:00`)
    const e = new Date(`${ev.endDate || ev.date}T${ev.end || ev.start || '10:00'}:00`)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) throw new Error('bad-time')
    if (e.getTime() <= s.getTime()) throw new Error('ends-before-start')
    // Written as UTC. The times you typed are read in THIS device's timezone,
    // which is what someone entering "3pm" means, and the instant is then the
    // same for every guest wherever they are.
    lines.push(`DTSTART:${stampUtc(s)}`)
    lines.push(`DTEND:${stampUtc(e)}`)
  }

  lines.push(`SUMMARY:${escapeText(ev.summary || 'Event')}`)
  if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`)
  if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`)
  if (ev.url) lines.push(`URL:${escapeText(ev.url)}`)
  if (ev.organizer) lines.push(`ORGANIZER:mailto:${ev.organizer}`)
  if (ev.repeat !== 'none') {
    const freq = ev.repeat.toUpperCase()
    lines.push(`RRULE:FREQ=${freq}${ev.repeatCount > 0 ? `;COUNT=${ev.repeatCount}` : ''}`)
  }
  lines.push('SEQUENCE:0', 'STATUS:CONFIRMED', 'TRANSP:OPAQUE')

  if (ev.alarm > 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(ev.summary || 'Event')}`,
      `TRIGGER:-PT${ev.alarm}M`,
      'END:VALARM',
    )
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

// --- reading ----------------------------------------------------------------

export interface ParsedEvent {
  summary: string
  description: string
  location: string
  url: string
  start: Date | null
  end: Date | null
  allDay: boolean
  rrule: string
  organizer: string
  raw: Record<string, string>
}

/** Undo the folding: a line beginning with a space or tab continues the last. */
export function unfold(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1)
    else out.push(line)
  }
  return out
}

function parseStamp(value: string, params: string): { date: Date | null; allDay: boolean } {
  const isDate = /VALUE=DATE(?!-)/i.test(params)
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim())
  if (!m) return { date: null, allDay: isDate }
  const [, y, mo, d, hh, mm, ss, z] = m
  if (!hh) return { date: new Date(Number(y), Number(mo) - 1, Number(d)), allDay: true }
  const parts = [Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss)] as const
  // A trailing Z is UTC; without it the time is either floating or in a named
  // zone, and reading it as local is the closest honest guess.
  const date = z ? new Date(Date.UTC(...parts)) : new Date(...parts)
  return { date, allDay: isDate }
}

export function parseIcs(text: string): ParsedEvent[] {
  const lines = unfold(text)
  const events: ParsedEvent[] = []
  let cur: ParsedEvent | null = null
  for (const line of lines) {
    const t = line.trim()
    if (/^BEGIN:VEVENT$/i.test(t)) {
      cur = { summary: '', description: '', location: '', url: '', start: null, end: null, allDay: false, rrule: '', organizer: '', raw: {} }
      continue
    }
    if (/^END:VEVENT$/i.test(t)) { if (cur) events.push(cur); cur = null; continue }
    if (!cur) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const left = line.slice(0, idx)
    const value = line.slice(idx + 1)
    const [name, ...paramParts] = left.split(';')
    const key = name.toUpperCase()
    const params = paramParts.join(';')
    cur.raw[key] = value
    if (key === 'SUMMARY') cur.summary = unescapeText(value)
    else if (key === 'DESCRIPTION') cur.description = unescapeText(value)
    else if (key === 'LOCATION') cur.location = unescapeText(value)
    else if (key === 'URL') cur.url = unescapeText(value)
    else if (key === 'ORGANIZER') cur.organizer = value.replace(/^mailto:/i, '')
    else if (key === 'RRULE') cur.rrule = value
    else if (key === 'DTSTART') { const r = parseStamp(value, params); cur.start = r.date; cur.allDay = r.allDay }
    else if (key === 'DTEND') cur.end = parseStamp(value, params).date
  }
  return events
}

// --- a calendar of several events -------------------------------------------

export interface CalEvent {
  summary: string
  /** Local wall-clock "YYYY-MM-DD". All-day, always: these are dated things,
   *  not appointments, and a time would be an invention. */
  date: string
  /** The LAST day, inclusive. Omit for a one-day event. */
  endDate?: string
  description?: string
  /** Whole days before the start to raise a reminder; 0 for none. */
  alarmDays?: number
}

/**
 * A stable id for an event, derived from its own content.
 *
 * **A random UID per export is the classic multi-event bug**, and it is silent:
 * export the holidays, import them, export again next month and import that
 * too, and every holiday is in the calendar twice. Deriving the id from the
 * content means the second import UPDATES the first, which is what a person
 * re-exporting a list actually wants.
 *
 * The mirror mistake is worse and just as easy: reusing ONE uid across the
 * whole file. A calendar then treats every VEVENT as the same event and keeps
 * only the last, so a twelve-event file imports as one.
 */
function stableUid(namespace: string, ev: CalEvent): string {
  const key = `${namespace}|${ev.date}|${ev.endDate ?? ''}|${ev.summary}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < key.length; i++) {
    h1 = Math.imul(h1 ^ key.charCodeAt(i), 0x01000193) >>> 0
    h2 = Math.imul(h2 + key.charCodeAt(i), 0x85ebca6b) >>> 0
  }
  return `${h1.toString(16)}${h2.toString(16)}@built-in-saudi.com`
}

const ymd = (s: string) => stampDate(s)

/** The day AFTER the last one — DTEND is exclusive for a DATE value. */
function exclusiveEnd(last: string): string {
  const d = new Date(`${last}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}
const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Several all-day events in one calendar file.
 *
 * `buildIcs` writes ONE event from the builder tool's own shape and is left
 * alone: it carries times, repeats, a location and an organizer, none of which
 * a list of dated facts has. Two functions, because bending one into both
 * would give every caller the other's parameters.
 */
export function buildIcsCalendar(namespace: string, events: CalEvent[], now = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Built in Saudi//${namespace}//EN`,
    'CALSCALE:GREGORIAN',
    // Without this, several calendars import an all-day series as busy time.
    'METHOD:PUBLISH',
  ]
  for (const ev of events) {
    if (!ev.date) continue
    lines.push(
      'BEGIN:VEVENT',
      `UID:${stableUid(namespace, ev)}`,
      `DTSTAMP:${stampUtc(now)}`,
      `DTSTART;VALUE=DATE:${ymd(ev.date)}`,
      `DTEND;VALUE=DATE:${exclusiveEnd(ev.endDate || ev.date)}`,
      `SUMMARY:${escapeText(ev.summary)}`,
    )
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`)
    lines.push('TRANSP:TRANSPARENT', 'STATUS:CONFIRMED')
    if (ev.alarmDays && ev.alarmDays > 0) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(ev.summary)}`,
        // Days, not minutes: a reminder "10080 minutes before" is the same
        // instant and unreadable in every calendar's own UI.
        `TRIGGER:-P${Math.round(ev.alarmDays)}D`,
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Hand the file to the browser as a download. */
export function downloadIcs(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  a.click()
  URL.revokeObjectURL(a.href)
}
