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

/** The link to hand out: this site's join page for the room, with the time if set. */
export function meetingUrl(locale: string, code: string, at?: Date | null): string {
  const h = callsHost()
  return `${h.site}/${locale}${h.base}/join?code=${code}${at ? `&at=${atParam(at)}` : ''}`
}

/** "Mon 2 Nov, 09:00" in the viewer's own timezone and language. */
export function formatAt(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d)
}
