// Client calls to the Book With Me Cloud Functions. Same host as push.ts.
const FN = 'https://us-central1-blitz-ksa.cloudfunctions.net'

export interface HostMeta {
  name: string | null
  tz: string
  minutes: number
  title: string
  location: string
  picture?: string | null
  pageHeading?: string
  pageText?: string
  meetingTypes?: { id: string; name: string; minutes: number; meet: boolean }[]
}

/** Read the host's own Google session (name/picture) — used by the preview page. */
export function readHostSession(): { name?: string; email?: string; picture?: string } | null {
  try {
    const hsid = localStorage.getItem('bis-bookwith-hsid')
    if (!hsid) return null
    const b64 = hsid.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const body = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))
    if (body.exp && Date.now() > body.exp) return null
    return { name: body.name, email: body.email, picture: body.picture }
  } catch {
    return null
  }
}

export interface AvailabilityResponse {
  ok: true
  host: HostMeta
  slots: number[] // open start times, epoch ms (UTC)
  taken?: number[] // busy/booked start times within availability, shown greyed out
}

export async function getAvailability(code: string): Promise<AvailabilityResponse> {
  const r = await fetch(`${FN}/get-availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (r.status === 404) throw new Error('not-found')
  if (!r.ok) throw new Error('failed')
  const data = await r.json()
  if (data && data.ok === false) throw new Error(data.error === 'host-calendar' ? 'host-calendar' : 'failed')
  return data
}

export async function book(input: {
  code: string
  startUtc: number
  name: string
  email: string
  note?: string
  typeId?: string
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

/** Delete the host's booking page + all its bookings. */
export async function deleteHost(hsid: string): Promise<{ ok: boolean; deletedBookings?: number }> {
  const r = await fetch(`${FN}/delete-host`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hsid }),
  })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

export interface MyDataReport {
  email: string | null
  bookingPage: { code: string | null; meetingTypes: number } | null
  bookings: number
  cvRuns: number
}

/** Report (del=false) or delete (del=true) everything stored for this Google user. */
export async function myData(idToken: string, del = false): Promise<{ ok: boolean; report: MyDataReport; deleted: boolean }> {
  const r = await fetch(`${FN}/my-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, del }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || String(r.status))
  return data
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
