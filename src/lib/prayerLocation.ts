import { CITIES, DEFAULT_CITY } from '../tools/prayer-times/cities'

// Location saved by the Prayer Times tool, reused by other tools (e.g. Adhkar
// reminders) so the user picks a location once.
const LOC_KEY = 'bis-prayer-loc'

export interface ResolvedLoc { lat: number; lng: number; tz: string; label?: string }

type SavedLoc =
  | { mode: 'city'; cityId: string }
  | { mode: 'geo'; lat: number; lng: number; tz: string; label?: string }

/** Resolve the Prayer-Times-saved location to coordinates, or null if none. */
export function savedPrayerLocation(): ResolvedLoc | null {
  try {
    const r = localStorage.getItem(LOC_KEY)
    if (!r) return null
    const v = JSON.parse(r) as SavedLoc
    if (v.mode === 'geo') return { lat: v.lat, lng: v.lng, tz: v.tz, label: v.label }
    if (v.mode === 'city') {
      const c = CITIES.find((x) => x.id === v.cityId) || DEFAULT_CITY
      return { lat: c.lat, lng: c.lng, tz: c.tz }
    }
  } catch { /* ignore */ }
  return null
}

/** Best-effort browser geolocation → coordinates (null if unavailable/denied). */
export function geolocate(): Promise<ResolvedLoc | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh',
      }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 600000 },
    )
  })
}

export const FALLBACK_LOC: ResolvedLoc = { lat: DEFAULT_CITY.lat, lng: DEFAULT_CITY.lng, tz: DEFAULT_CITY.tz }
