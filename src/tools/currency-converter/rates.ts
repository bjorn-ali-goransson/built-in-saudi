// Daily exchange rates, fetched client-side from the free, key-less, CORS-enabled
// @fawazahmed0 currency-api (CDN-hosted, updated daily, covers SAR + all majors).
// No user data leaves the browser — only a currency code is in the URL. Results
// are cached in localStorage so a repeat visit (or a brief outage) still works.

export type RateSet = { base: string; date: string; rates: Record<string, number> }

const HOSTS = [
  (b: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${b}.min.json`,
  (b: string) => `https://latest.currency-api.pages.dev/v1/currencies/${b}.min.json`,
]
const cacheKey = (b: string) => `bis-cur-rates-${b}`
const FRESH_MS = 6 * 3600 * 1000

type Cached = RateSet & { at: number }

function readCache(base: string): Cached | null {
  try { const r = localStorage.getItem(cacheKey(base)); return r ? (JSON.parse(r) as Cached) : null } catch { return null }
}
function writeCache(v: Cached) {
  try { localStorage.setItem(cacheKey(v.base), JSON.stringify(v)) } catch { /* storage full — non-fatal */ }
}

async function fetchOne(base: string): Promise<RateSet> {
  let lastErr: unknown
  for (const url of HOSTS) {
    try {
      const res = await fetch(url(base))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { date: string; [k: string]: unknown }
      const rates = json[base] as Record<string, number> | undefined
      if (!rates) throw new Error('no rates in payload')
      return { base, date: json.date, rates }
    } catch (e) { lastErr = e }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed')
}

/** Rates for `base`. Returns fresh network data when possible; falls back to the
 *  last cached set (flagged `stale`) if the network fails; throws only when there
 *  is neither. */
export async function getRates(base: string): Promise<RateSet & { stale: boolean }> {
  const b = base.toLowerCase()
  const cached = readCache(b)
  if (cached && Date.now() - cached.at < FRESH_MS) return { ...cached, stale: false }
  try {
    const fresh = await fetchOne(b)
    writeCache({ ...fresh, at: Date.now() })
    return { ...fresh, stale: false }
  } catch (e) {
    if (cached) return { ...cached, stale: true }
    throw e
  }
}
