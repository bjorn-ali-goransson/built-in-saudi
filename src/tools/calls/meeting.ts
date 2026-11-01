// A meeting made before anyone joins it: a room code this browser will host, a
// link to hand out, and optionally the time it is meant to start.
//
// The time rides in the link (`at=`, UTC to the minute) because there is no
// server to keep it: whoever opens the link learns it from the link. It is
// shown, not enforced — the organiser can start whenever they like, and a
// guest still knocks and waits to be let in as with any call.
import { HOST_KEY, code6 } from './helpers'
import { callsHost } from './host'

/** A new room code, remembered as hosted here so opening its link makes us the host. */
export function createMeeting(): string {
  const code = code6()
  try { localStorage.setItem(HOST_KEY, code) } catch { /* storage blocked: the link still works, as a guest */ }
  return code
}

/** `2026-11-02T06:00Z`: UTC, to the minute — short, and unambiguous in any timezone. */
export function atParam(d: Date): string {
  return d.toISOString().slice(0, 16) + 'Z'
}

/** The start time a link carries, or null when it carries none (or nonsense). */
export function parseAt(search: string): Date | null {
  const v = new URLSearchParams(search).get('at')
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(v)) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** What else a meeting's link can say about it, read back by whoever opens
 *  it: how long it runs, a title of the organiser's own, and the organiser's
 *  name. Like the time, there is no server to keep these, so the link does. */
export interface MeetingDetails { minutes?: number; title?: string; by?: string }

/** The link to hand out: this site's join page for the room, with the time and
 *  the details that are set. */
export function meetingUrl(locale: string, code: string, at?: Date | null, more: MeetingDetails = {}): string {
  const h = callsHost()
  const q = new URLSearchParams({ code })
  if (at) q.set('at', atParam(at))
  if (more.minutes && more.minutes > 0) q.set('dur', String(Math.round(more.minutes)))
  if (more.title?.trim()) q.set('title', more.title.trim())
  if (more.by?.trim()) q.set('by', more.by.trim())
  // atParam's colon is left readable: the link is read as well as tapped.
  return `${h.site}/${locale}${h.base}/join?${q.toString().replace(/%3A/g, ':')}`
}

/** The details a link carries, each dropped when missing or nonsense. */
export function parseDetails(search: string): MeetingDetails {
  const q = new URLSearchParams(search)
  const dur = Number(q.get('dur'))
  const text = (k: string, max: number) => (q.get(k) || '').trim().slice(0, max) || undefined
  return { minutes: Number.isInteger(dur) && dur > 0 && dur <= 24 * 60 ? dur : undefined, title: text('title', 60), by: text('by', 40) }
}

/** The start time, or the start and end when the meeting has a length. */
export function formatWhen(d: Date, locale: string, minutes = 0): string {
  const f = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  if (!minutes) return f.format(d)
  // formatRange is in every engine this runs in; the lib target predates it.
  return (f as Intl.DateTimeFormat & { formatRange(a: Date, b: Date): string }).formatRange(d, new Date(d.getTime() + minutes * 60_000))
}

/** A length on its own, for a meeting with no start time. */
export function formatMinutes(minutes: number, locale: string): string {
  const unit = minutes % 60 === 0 ? 'hour' : 'minute'
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', { style: 'unit', unit, unitDisplay: 'long' }).format(unit === 'hour' ? minutes / 60 : minutes)
}

/** "Mon 2 Nov, 09:00" in the viewer's own timezone and language. */
export function formatAt(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d)
}
