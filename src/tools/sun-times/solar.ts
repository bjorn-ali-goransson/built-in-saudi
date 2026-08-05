// Solar position, from the standard low-precision NOAA equations. Accurate to
// well under a minute for these purposes, and — unlike a "sunrise plus an hour"
// rule of thumb — actually correct at any latitude and season.
//
// adhan (already a dependency) gives sunrise and sunset, but not the twilight
// and golden-hour thresholds, which are the whole point of this tool.

export interface SunEvent {
  astroDawn: Date | null
  nauticalDawn: Date | null
  civilDawn: Date | null
  sunrise: Date | null
  goldenMorningEnd: Date | null
  solarNoon: Date | null
  goldenEveningStart: Date | null
  sunset: Date | null
  civilDusk: Date | null
  nauticalDusk: Date | null
  astroDusk: Date | null
}

const RAD = Math.PI / 180
const DAY_MS = 86400000
const J1970 = 2440588
const J2000 = 2451545

const toJulian = (date: Date) => date.valueOf() / DAY_MS - 0.5 + J1970
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * DAY_MS)
const toDays = (date: Date) => toJulian(date) - J2000

const e = RAD * 23.4397 // obliquity of the ecliptic

function solarMeanAnomaly(d: number) { return RAD * (357.5291 + 0.98560028 * d) }

function eclipticLongitude(M: number) {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const P = RAD * 102.9372
  return M + C + P + Math.PI
}

function declination(L: number) { return Math.asin(Math.sin(e) * Math.sin(L)) }

const J0 = 0.0009
function julianCycle(d: number, lw: number) { return Math.round(d - J0 - lw / (2 * Math.PI)) }
function approxTransit(Ht: number, lw: number, n: number) { return J0 + (Ht + lw) / (2 * Math.PI) + n }
function solarTransitJ(ds: number, M: number, L: number) {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
}
function hourAngle(h: number, phi: number, d: number) {
  return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)))
}

/**
 * Times the sun crosses a given altitude. Returns null when it never does — at
 * high latitudes in summer there simply is no astronomical dawn, and inventing
 * one would be worse than a blank.
 */
function timesAtAltitude(angle: number, lat: number, lng: number, date: Date): { rise: Date | null; set: Date | null; noon: Date } {
  const lw = RAD * -lng
  const phi = RAD * lat
  const d = toDays(date)
  const n = julianCycle(d, lw)
  const ds = approxTransit(0, lw, n)
  const M = solarMeanAnomaly(ds)
  const L = eclipticLongitude(M)
  const dec = declination(L)
  const Jnoon = solarTransitJ(ds, M, L)

  const h = angle * RAD
  const w = hourAngle(h, phi, dec)
  if (Number.isNaN(w)) return { rise: null, set: null, noon: fromJulian(Jnoon) }

  const a = approxTransit(w, lw, n)
  const Jset = solarTransitJ(a, M, L)
  const Jrise = Jnoon - (Jset - Jnoon)
  return { rise: fromJulian(Jrise), set: fromJulian(Jset), noon: fromJulian(Jnoon) }
}

// The standard altitude thresholds. -0.833° accounts for refraction and the
// sun's radius, which is why sunrise is not at 0°.
const SUNRISE = -0.833
const CIVIL = -6
const NAUTICAL = -12
const ASTRO = -18
const GOLDEN = 6

export function solarEvents(lat: number, lng: number, date: Date): SunEvent {
  const sun = timesAtAltitude(SUNRISE, lat, lng, date)
  const civil = timesAtAltitude(CIVIL, lat, lng, date)
  const nautical = timesAtAltitude(NAUTICAL, lat, lng, date)
  const astro = timesAtAltitude(ASTRO, lat, lng, date)
  const golden = timesAtAltitude(GOLDEN, lat, lng, date)

  return {
    astroDawn: astro.rise,
    nauticalDawn: nautical.rise,
    civilDawn: civil.rise,
    sunrise: sun.rise,
    goldenMorningEnd: golden.rise,
    solarNoon: sun.noon,
    goldenEveningStart: golden.set,
    sunset: sun.set,
    civilDusk: civil.set,
    nauticalDusk: nautical.set,
    astroDusk: astro.set,
  }
}
