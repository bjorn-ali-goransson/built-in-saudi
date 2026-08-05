// Timezone maths via Intl, so there is no tz database to ship and no drift when
// a country changes its rules — the browser's ICU data is already correct and
// already updated.

export interface Zone { id: string; en: string; ar: string }

export const ZONES: Zone[] = [
  { id: 'Asia/Riyadh', en: 'Riyadh', ar: 'الرياض' },
  { id: 'Asia/Dubai', en: 'Dubai', ar: 'دبي' },
  { id: 'Africa/Cairo', en: 'Cairo', ar: 'القاهرة' },
  { id: 'Asia/Karachi', en: 'Karachi', ar: 'كراتشي' },
  { id: 'Asia/Kolkata', en: 'Mumbai', ar: 'مومباي' },
  { id: 'Asia/Dhaka', en: 'Dhaka', ar: 'دكا' },
  { id: 'Asia/Manila', en: 'Manila', ar: 'مانيلا' },
  { id: 'Asia/Jakarta', en: 'Jakarta', ar: 'جاكرتا' },
  { id: 'Asia/Shanghai', en: 'Shanghai', ar: 'شنغهاي' },
  { id: 'Asia/Tokyo', en: 'Tokyo', ar: 'طوكيو' },
  { id: 'Europe/Istanbul', en: 'Istanbul', ar: 'إسطنبول' },
  { id: 'Europe/London', en: 'London', ar: 'لندن' },
  { id: 'Europe/Paris', en: 'Paris', ar: 'باريس' },
  { id: 'Europe/Berlin', en: 'Berlin', ar: 'برلين' },
  { id: 'Europe/Stockholm', en: 'Stockholm', ar: 'ستوكهولم' },
  { id: 'America/New_York', en: 'New York', ar: 'نيويورك' },
  { id: 'America/Chicago', en: 'Chicago', ar: 'شيكاغو' },
  { id: 'America/Los_Angeles', en: 'Los Angeles', ar: 'لوس أنجلوس' },
  { id: 'America/Sao_Paulo', en: 'São Paulo', ar: 'ساو باولو' },
  { id: 'Australia/Sydney', en: 'Sydney', ar: 'سيدني' },
]

/** Offset of `zone` from UTC in minutes, at `date` — so DST is accounted for. */
export function offsetMinutes(zone: string, date: Date): number {
  // Format the same instant as if it were UTC and as if it were in the zone; the
  // difference between the two readings IS the offset, DST included.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]))
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  )
  return Math.round((asUtc - date.getTime()) / 60000)
}

/** Local wall-clock hour in `zone` for a given UTC instant. */
export function hourIn(zone: string, date: Date): number {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', hour12: false }).format(date))
  return h % 24
}

export function labelIn(zone: string, date: Date, locale: 'en' | 'ar'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

export type Quality = 'good' | 'edge' | 'bad'

/** How reasonable an hour is to be asked to attend a meeting. */
export function quality(hour: number): Quality {
  if (hour >= 9 && hour < 17) return 'good'
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 20)) return 'edge'
  return 'bad'
}

export interface Slot { utc: Date; hours: { zone: string; hour: number; quality: Quality }[]; score: number }

/**
 * Score every hour of the chosen day across all zones. A slot everyone can make
 * beats one that is merely tolerable somewhere, so `good` is worth much more
 * than `edge` and `bad` is disqualifying rather than merely costly.
 */
export function rankSlots(zones: string[], day: Date, anchor: string): Slot[] {
  const out: Slot[] = []
  // Walk the 24 hours of the anchor zone's day so the grid reads naturally for
  // whoever is organising.
  const offset = offsetMinutes(anchor, day)
  const midnight = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0) - offset * 60000)
  for (let h = 0; h < 24; h++) {
    const utc = new Date(midnight.getTime() + h * 3600000)
    const hours = zones.map((z) => {
      const hour = hourIn(z, utc)
      return { zone: z, hour, quality: quality(hour) }
    })
    const score = hours.reduce((n, x) => n + (x.quality === 'good' ? 3 : x.quality === 'edge' ? 1 : -6), 0)
    out.push({ utc, hours, score })
  }
  return out
}
