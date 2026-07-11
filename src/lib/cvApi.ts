import type { Cv } from '../tools/cv-generator/schema'

// Google Identity Services sign-in + the CV generation call. The client ID is
// public (like the VAPID key in push.ts).
export const GOOGLE_CLIENT_ID = '736023550280-71bb5sl89i1trt8p1obk8h35jrn6t7a3.apps.googleusercontent.com'
const FN = 'https://us-central1-blitz-ksa.cloudfunctions.net'

interface GisId {
  initialize(cfg: { client_id: string; callback: (r: { credential: string }) => void }): void
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void
  disableAutoSelect(): void
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GisId } }
  }
}

let gisPromise: Promise<GisId> | null = null

/** Load the Google Identity Services script once. */
export function loadGis(): Promise<GisId> {
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    const ready = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else reject(new Error('GIS unavailable'))
    }
    if (window.google?.accounts?.id) return ready()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = ready
    s.onerror = () => reject(new Error('Google sign-in failed to load'))
    document.head.appendChild(s)
  })
  return gisPromise
}

/** Decode a JWT payload (unverified — display only). */
export function decodeJwt(token: string): { email?: string; name?: string; picture?: string } {
  try {
    const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b.padEnd(Math.ceil(b.length / 4) * 4, '=')))
  } catch {
    return {}
  }
}

export interface CvResult {
  cv: Cv
  questions: string[]
  summary: string
  answersLeft: number
  polishLeft: number
}

function parseResult(data: { cv?: Cv; questions?: unknown; summary?: unknown; answersLeft?: unknown; polishLeft?: unknown }): CvResult {
  return {
    cv: data.cv as Cv,
    questions: Array.isArray(data.questions) ? data.questions.map(String) : [],
    summary: typeof data.summary === 'string' ? data.summary : '',
    answersLeft: Number(data.answersLeft ?? 0),
    polishLeft: Number(data.polishLeft ?? 0),
  }
}

export async function generateCv(idToken: string, text: string): Promise<CvResult> {
  const r = await fetch(`${FN}/cv-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, text }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return parseResult(data)
}

/** Opt-in: save the CV to the user's account so they can resume on any device. */
export async function saveCvServer(idToken: string, cv: Cv): Promise<void> {
  const r = await fetch(`${FN}/cv-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, cv }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
}

/** Remove the user's server-saved CV (opt-out). */
export async function deleteCvServer(idToken: string): Promise<void> {
  await fetch(`${FN}/cv-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  }).catch(() => { /* ignore */ })
}

/** Fetch the user's server-saved CV (null if none). */
export async function getSavedCv(idToken: string): Promise<Cv | null> {
  const r = await fetch(`${FN}/cv-get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!r.ok) return null
  const data = await r.json().catch(() => ({}))
  return data && data.cv ? (data.cv as Cv) : null
}

/** Tailor the generated CV to a specific job description (separate 24h budget). */
export async function tailorCv(idToken: string, cv: Cv, jobDescription: string): Promise<{ cv: Cv; tailorsLeft: number }> {
  const r = await fetch(`${FN}/cv-tailor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, cv, jobDescription }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return { cv: data.cv as Cv, tailorsLeft: Number(data.tailorsLeft ?? 0) }
}

/** Apply one message — an answer to an AI question ('answer') or a free tweak ('polish').
 *  `context` is the previous change summary so the user can correct it ("no, like this"). */
export async function refineCv(idToken: string, cv: Cv, instruction: string, kind: 'answer' | 'polish', context = '', sourceText = ''): Promise<CvResult> {
  const r = await fetch(`${FN}/cv-refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, cv, instruction, kind, context, sourceText }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return parseResult(data)
}
