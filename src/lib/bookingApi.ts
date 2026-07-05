// Client calls to the Book With Me Cloud Functions. Same host as push.ts.
const FN = 'https://us-central1-blitz-ksa.cloudfunctions.net'

export interface HostMeta {
  name: string | null
  tz: string
  minutes: number
  title: string
  location: string
}

export interface AvailabilityResponse {
  ok: true
  host: HostMeta
  slots: number[] // open start times, epoch ms (UTC)
}

export async function getAvailability(code: string): Promise<AvailabilityResponse> {
  const r = await fetch(`${FN}/get-availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (r.status === 404) throw new Error('not-found')
  if (!r.ok) throw new Error('failed')
  return r.json()
}

export async function book(input: {
  code: string
  startUtc: number
  name: string
  email: string
  note?: string
}): Promise<{ ok: boolean; conflict?: boolean }> {
  const r = await fetch(`${FN}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (r.status === 409) return { ok: false, conflict: true }
  if (!r.ok) throw new Error('failed')
  return { ok: true }
}

/** Persist the host's schedule (requires the hsid session from OAuth callback). */
export async function saveSchedule(input: Record<string, unknown>): Promise<{ ok: boolean }> {
  const r = await fetch(`${FN}/save-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

/** Full-page redirect to Google to sign in + connect Calendar. */
export function connectGoogleUrl(code: string, locale: string): string {
  return `${FN}/booking-google-start?code=${encodeURIComponent(code)}&locale=${locale}`
}
