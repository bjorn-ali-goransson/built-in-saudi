// Build a cron expression from choices, and show when it would actually fire.
// The explainer tool goes the other way; this is the inverse, which is the half
// people search for when they are writing a schedule rather than reading one.

export type Preset =
  | 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export interface Choice {
  preset: Preset
  everyN: number          // for minutely/hourly
  minute: number
  hour: number
  weekdays: number[]      // 0=Sun
  dayOfMonth: number
  month: number
  custom: string
}

export const DEFAULTS: Choice = {
  preset: 'daily', everyN: 5, minute: 0, hour: 9,
  weekdays: [1], dayOfMonth: 1, month: 1, custom: '*/5 * * * *',
}

export function toCron(c: Choice): string {
  switch (c.preset) {
    case 'minutely': return `*/${Math.max(1, Math.min(59, c.everyN))} * * * *`
    case 'hourly': return `${c.minute} */${Math.max(1, Math.min(23, c.everyN))} * * *`
    case 'daily': return `${c.minute} ${c.hour} * * *`
    case 'weekly': return `${c.minute} ${c.hour} * * ${(c.weekdays.length ? [...c.weekdays].sort() : [0]).join(',')}`
    case 'monthly': return `${c.minute} ${c.hour} ${c.dayOfMonth} * *`
    case 'yearly': return `${c.minute} ${c.hour} ${c.dayOfMonth} ${c.month} *`
    default: return c.custom.trim()
  }
}

// ── Field parsing, so "next runs" works for a hand-typed expression too ──────
function parseField(field: string, min: number, max: number): number[] | null {
  const out = new Set<number>()
  for (const part of field.split(',')) {
    const m = part.match(/^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/)
    if (!m) return null
    const step = m[3] ? Number(m[3]) : 1
    if (step < 1) return null
    let from: number, to: number
    if (m[1] === '*') { from = min; to = max }
    else {
      from = Number(m[1])
      to = m[2] ? Number(m[2]) : (m[3] ? max : from)
    }
    if (from < min || to > max || from > to) return null
    for (let v = from; v <= to; v += step) out.add(v)
  }
  return out.size ? [...out].sort((a, b) => a - b) : null
}

export interface Parsed {
  minutes: number[]
  hours: number[]
  days: number[]
  months: number[]
  weekdays: number[]
  /** True when both day-of-month and day-of-week are restricted, which most
   *  cron implementations treat as OR rather than AND — a real trap. */
  bothDayFields: boolean
}

export function parseCron(expr: string): Parsed | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const minutes = parseField(parts[0], 0, 59)
  const hours = parseField(parts[1], 0, 23)
  const days = parseField(parts[2], 1, 31)
  const months = parseField(parts[3], 1, 12)
  // Both 0 and 7 mean Sunday.
  const weekdays = parseField(parts[4].replace(/7/g, '0'), 0, 6)
  if (!minutes || !hours || !days || !months || !weekdays) return null
  return {
    minutes, hours, days, months, weekdays,
    bothDayFields: parts[2] !== '*' && parts[4] !== '*',
  }
}

/** The next `count` fire times after `from`. Walks minute by minute, capped so a
 *  never-matching expression (Feb 30) cannot spin forever. */
export function nextRuns(expr: string, count = 5, from = new Date()): Date[] {
  const p = parseCron(expr)
  if (!p) return []
  const out: Date[] = []
  const cursor = new Date(from.getTime())
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)
  // Four years of minutes is enough for any real schedule and bounded.
  const limit = 366 * 4 * 24 * 60
  for (let i = 0; i < limit && out.length < count; i++) {
    const dayMatches = p.bothDayFields
      // The OR quirk: with both fields set, cron fires if EITHER matches.
      ? p.days.includes(cursor.getDate()) || p.weekdays.includes(cursor.getDay())
      : p.days.includes(cursor.getDate()) && p.weekdays.includes(cursor.getDay())
    if (
      p.minutes.includes(cursor.getMinutes()) &&
      p.hours.includes(cursor.getHours()) &&
      p.months.includes(cursor.getMonth() + 1) &&
      dayMatches
    ) out.push(new Date(cursor.getTime()))
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return out
}
