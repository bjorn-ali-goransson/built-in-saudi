// Weather from Open-Meteo: no API key, CORS-enabled, free for non-commercial use.
// Same shape as the currency converter's rates.ts — fetch from the browser, cache
// in localStorage, and serve the stale copy rather than nothing when the network
// is down.
//
// This is one of the few tools where something leaves the page: a rounded
// latitude/longitude goes to Open-Meteo. Nothing else does — no account, no
// identifier, and we never see the request. Coordinates are rounded to 2dp
// (~1km) before they are sent, which is far more precision than a forecast needs.

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const FRESH_MS = 30 * 60 * 1000

export interface Current {
  temp: number
  feels: number
  humidity: number
  wind: number
  code: number
  isDay: boolean
}
export interface Hour { t: string; temp: number; code: number; rain: number }
export interface Day {
  date: string
  code: number
  min: number
  max: number
  sunrise: string
  sunset: string
  uv: number
  rain: number
}
export interface Air { pm10: number | null; pm25: number | null; dust: number | null }

export interface Weather {
  current: Current
  hourly: Hour[]
  daily: Day[]
  air: Air
  timezone: string
  fetchedAt: number
}

const round = (n: number) => Math.round(n * 100) / 100
const key = (lat: number, lng: number) => `bis-weather-${round(lat)},${round(lng)}`

type Cached = Weather & { at: number }

function readCache(k: string): Cached | null {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as Cached) : null } catch { return null }
}
function writeCache(k: string, v: Cached) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage full — non-fatal */ }
}

async function json(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function shape(f: any, a: any): Weather {
  const cur = f.current || {}
  const h = f.hourly || {}
  const d = f.daily || {}
  const ac = (a && a.current) || {}
  const hourly: Hour[] = (h.time || []).map((t: string, i: number) => ({
    t,
    temp: h.temperature_2m?.[i] ?? 0,
    code: h.weather_code?.[i] ?? 0,
    rain: h.precipitation_probability?.[i] ?? 0,
  }))
  const daily: Day[] = (d.time || []).map((date: string, i: number) => ({
    date,
    code: d.weather_code?.[i] ?? 0,
    min: d.temperature_2m_min?.[i] ?? 0,
    max: d.temperature_2m_max?.[i] ?? 0,
    sunrise: d.sunrise?.[i] ?? '',
    sunset: d.sunset?.[i] ?? '',
    uv: d.uv_index_max?.[i] ?? 0,
    rain: d.precipitation_probability_max?.[i] ?? 0,
  }))
  return {
    current: {
      temp: cur.temperature_2m ?? 0,
      feels: cur.apparent_temperature ?? cur.temperature_2m ?? 0,
      humidity: cur.relative_humidity_2m ?? 0,
      wind: cur.wind_speed_10m ?? 0,
      code: cur.weather_code ?? 0,
      isDay: cur.is_day !== 0,
    },
    hourly,
    daily,
    air: {
      pm10: ac.pm10 ?? null,
      pm25: ac.pm2_5 ?? null,
      dust: ac.dust ?? null,
    },
    timezone: f.timezone || 'auto',
    fetchedAt: Date.now(),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getWeather(lat: number, lng: number): Promise<Weather & { stale: boolean }> {
  const la = round(lat), lo = round(lng)
  const k = key(la, lo)
  const cached = readCache(k)
  if (cached && Date.now() - cached.at < FRESH_MS) return { ...cached, stale: false }

  const q = `latitude=${la}&longitude=${lo}&timezone=auto`
  const fUrl = `${FORECAST}?${q}`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m'
    + '&hourly=temperature_2m,weather_code,precipitation_probability&forecast_hours=24'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max'
  // Air quality is a separate host and a nice-to-have: a failure there must not
  // cost the user their forecast, so it resolves to null rather than rejecting.
  const aUrl = `${AIR}?${q}&current=pm10,pm2_5,dust`

  try {
    const [f, a] = await Promise.all([json(fUrl), json(aUrl).catch(() => null)])
    const w = shape(f, a)
    writeCache(k, { ...w, at: Date.now() })
    return { ...w, stale: false }
  } catch (e) {
    if (cached) return { ...cached, stale: true }
    throw e
  }
}
