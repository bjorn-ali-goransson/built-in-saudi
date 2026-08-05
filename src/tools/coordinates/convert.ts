// Coordinate conversion. Every format here describes the same point on WGS-84;
// what changes is how it is written, and each notation is the one some tool
// insists on — DMS on a survey document, UTM on a site plan, MGRS on a military
// or emergency map, plain decimal in every API.

export interface LatLng { lat: number; lng: number }

/** Parse whatever someone pasted: decimal, DMS with symbols, or DDM. */
export function parse(input: string): LatLng | null {
  const text = input.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  if (!text) return null

  // Plain decimal pair: "24.7136, 46.6753"
  const dec = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/)
  if (dec) {
    const lat = Number(dec[1]), lng = Number(dec[2])
    return valid(lat, lng) ? { lat, lng } : null
  }

  // DMS / DDM, in either order, with N/S/E/W anywhere in each part.
  const parts = text.split(/(?<=[NSEWnsew])\s*,?\s*|\s*,\s*/).filter(Boolean)
  if (parts.length === 2) {
    const a = parseComponent(parts[0])
    const b = parseComponent(parts[1])
    if (a && b) {
      // Whichever carries N/S is the latitude; without hemispheres, assume lat first.
      const latFirst = a.axis !== 'lng' && b.axis !== 'lat'
      const lat = latFirst ? a.value : b.value
      const lng = latFirst ? b.value : a.value
      return valid(lat, lng) ? { lat, lng } : null
    }
  }
  return null
}

function valid(lat: number, lng: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

function parseComponent(raw: string): { value: number; axis: 'lat' | 'lng' | null } | null {
  const hemi = raw.match(/[NSEWnsew]/)
  const axis = hemi ? ('NSns'.includes(hemi[0]) ? 'lat' : 'lng') : null
  const nums = raw.match(/-?\d+(?:\.\d+)?/g)
  if (!nums || !nums.length) return null
  const [d, m = '0', sec = '0'] = nums
  let value = Math.abs(Number(d)) + Number(m) / 60 + Number(sec) / 3600
  const negative = Number(d) < 0 || (hemi ? 'SWsw'.includes(hemi[0]) : false)
  if (negative) value = -value
  return { value, axis }
}

export function toDecimal(p: LatLng, places = 6): string {
  return `${p.lat.toFixed(places)}, ${p.lng.toFixed(places)}`
}

function dmsPart(value: number, axis: 'lat' | 'lng'): string {
  const hemi = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W')
  const abs = Math.abs(value)
  const d = Math.floor(abs)
  const mFloat = (abs - d) * 60
  const m = Math.floor(mFloat)
  const s = (mFloat - m) * 60
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(2).padStart(5, '0')}"${hemi}`
}

export function toDms(p: LatLng): string {
  return `${dmsPart(p.lat, 'lat')} ${dmsPart(p.lng, 'lng')}`
}

export function toDdm(p: LatLng): string {
  const part = (v: number, axis: 'lat' | 'lng') => {
    const hemi = axis === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')
    const abs = Math.abs(v)
    const d = Math.floor(abs)
    return `${d}°${((abs - d) * 60).toFixed(4)}'${hemi}`
  }
  return `${part(p.lat, 'lat')} ${part(p.lng, 'lng')}`
}

// ── UTM / MGRS ──────────────────────────────────────────────────────────────
// WGS-84 ellipsoid.
const A = 6378137.0
const F = 1 / 298.257223563
const K0 = 0.9996

export interface Utm { zone: number; band: string; easting: number; northing: number; north: boolean }

const BANDS = 'CDEFGHJKLMNPQRSTUVWX'

function latBand(lat: number): string {
  if (lat < -80 || lat > 84) return '?'
  return BANDS[Math.floor((lat + 80) / 8)] ?? 'X'
}

export function toUtm(p: LatLng): Utm | null {
  if (p.lat < -80 || p.lat > 84) return null // UTM is undefined at the poles
  const zone = Math.floor((p.lng + 180) / 6) + 1
  const λ0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180
  const φ = p.lat * Math.PI / 180
  const λ = p.lng * Math.PI / 180

  const e2 = F * (2 - F)
  const ep2 = e2 / (1 - e2)
  const N = A / Math.sqrt(1 - e2 * Math.sin(φ) ** 2)
  const T = Math.tan(φ) ** 2
  const C = ep2 * Math.cos(φ) ** 2
  const Aa = Math.cos(φ) * (λ - λ0)

  const M = A * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * φ
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * φ)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * φ)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * φ)
  )

  const easting = K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6
    + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * Aa ** 5 / 120) + 500000

  let northing = K0 * (M + N * Math.tan(φ) * (Aa ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * Aa ** 4 / 24
    + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * Aa ** 6 / 720))
  // The southern hemisphere gets a 10,000km false northing so values stay positive.
  if (p.lat < 0) northing += 10000000

  return { zone, band: latBand(p.lat), easting, northing, north: p.lat >= 0 }
}

export function formatUtm(u: Utm): string {
  return `${u.zone}${u.band} ${Math.round(u.easting)}E ${Math.round(u.northing)}N`
}

const E_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const N_LETTERS = 'ABCDEFGHJKLMNPQRSTUV'

export function toMgrs(p: LatLng, digits = 5): string | null {
  const u = toUtm(p)
  if (!u) return null
  const set = (u.zone - 1) % 6
  const eIdx = Math.floor(u.easting / 100000) - 1
  const colLetter = E_LETTERS[(set * 8 + eIdx) % 24]
  const nShift = set % 2 === 1 ? 5 : 0
  const rowLetter = N_LETTERS[(Math.floor(u.northing / 100000) + nShift) % 20]
  const factor = 10 ** (5 - digits)
  const e = String(Math.floor((u.easting % 100000) / factor)).padStart(digits, '0')
  const n = String(Math.floor((u.northing % 100000) / factor)).padStart(digits, '0')
  return `${u.zone}${u.band} ${colLetter}${rowLetter} ${e} ${n}`
}

/** Great-circle distance in metres, for the two-point mode. */
export function distance(a: LatLng, b: LatLng): number {
  const R = 6371008.8
  const φ1 = a.lat * Math.PI / 180
  const φ2 = b.lat * Math.PI / 180
  const dφ = φ2 - φ1
  const dλ = (b.lng - a.lng) * Math.PI / 180
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Initial bearing from a to b, in degrees. */
export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = a.lat * Math.PI / 180
  const φ2 = b.lat * Math.PI / 180
  const dλ = (b.lng - a.lng) * Math.PI / 180
  const y = Math.sin(dλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}
