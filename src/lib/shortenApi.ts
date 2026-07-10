// Link shortener API. Uses the same Google Identity Services sign-in as the CV
// Generator (see cvApi.ts) for the id_token. Resolving a link is public.
const FN = 'https://us-central1-blitz-ksa.cloudfunctions.net'

export interface ShortLink {
  code: string
  short: string
  url: string
  hits: number
  createdAt: number
  expiresAt: number
}

/** Create a 6-month short link (requires a Google id_token). */
export async function shortenUrl(idToken: string, url: string): Promise<ShortLink> {
  const r = await fetch(`${FN}/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, url }),
  })
  const d = await r.json().catch(() => ({}))
  if (r.status === 429) {
    const e = new Error('rate-limited') as Error & { retryAfter?: number }
    e.retryAfter = typeof d.retryAfter === 'number' ? d.retryAfter : 3600000
    throw e
  }
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
  return { code: d.code, short: d.short, url: d.url, hits: 0, createdAt: Date.now(), expiresAt: d.expiresAt }
}

/** Resolve a short code to its target URL (public). Null if not found/expired. */
export async function resolveLink(code: string): Promise<string | null> {
  try {
    const r = await fetch(`${FN}/resolve-link?c=${encodeURIComponent(code)}`)
    if (!r.ok) return null
    const d = await r.json().catch(() => ({}))
    return typeof d.url === 'string' ? d.url : null
  } catch {
    return null
  }
}

/** The signed-in user's live short links. */
export async function myLinks(idToken: string): Promise<ShortLink[]> {
  const r = await fetch(`${FN}/my-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!r.ok) throw new Error(String(r.status))
  const d = await r.json()
  return Array.isArray(d.links) ? d.links : []
}

/** Delete one of the user's links. */
export async function deleteLink(idToken: string, code: string): Promise<void> {
  await fetch(`${FN}/delete-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, code }),
  }).catch(() => { /* ignore */ })
}
