import type { Cv } from '../tools/cv-generator/schema'

// Google Identity Services sign-in + the CV generation call. The client ID is
// public (like the VAPID key in push.ts).
export const GOOGLE_CLIENT_ID = '736023550280-71bb5sl89i1trt8p1obk8h35jrn6t7a3.apps.googleusercontent.com'
const FN = 'https://us-central1-blitz-ksa.cloudfunctions.net'

interface GisId {
  initialize(cfg: { client_id: string; callback: (r: { credential: string }) => void }): void
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void
  disableAutoSelect(): void
  prompt(momentListener?: (n: unknown) => void): void
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

/** A problem the AI found but couldn't fix on its own — surfaced to the user in
 *  a dialog before the CV is revealed (#213). */
export interface CvIssue {
  title: string
  detail: string
  severity: 'high' | 'medium' | 'low'
}

export interface CvResult {
  cv: Cv
  issues: CvIssue[]
  summary: string
  polishLeft: number
}

const SEVERITIES = ['high', 'medium', 'low'] as const
function parseIssues(raw: unknown): CvIssue[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((i) => {
      const o = (i || {}) as Partial<CvIssue>
      const sev = SEVERITIES.find((x) => x === o.severity) || 'medium'
      return { title: String(o.title || ''), detail: String(o.detail || ''), severity: sev }
    })
    .filter((i) => i.title)
}

function parseResult(data: { cv?: Cv; issues?: unknown; summary?: unknown; polishLeft?: unknown }): CvResult {
  return {
    cv: data.cv as Cv,
    issues: parseIssues(data.issues),
    summary: typeof data.summary === 'string' ? data.summary : '',
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

/** Apply one instruction to the generated CV.
 *  `context` is the previous change summary so the user can correct it ("no, like this"). */
export async function refineCv(idToken: string, cv: Cv, instruction: string, kind: 'polish' | 'elaborate' | 'shorten', context = '', sourceText = ''): Promise<CvResult> {
  const r = await fetch(`${FN}/cv-refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, cv, instruction, kind, context, sourceText }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return parseResult(data)
}
