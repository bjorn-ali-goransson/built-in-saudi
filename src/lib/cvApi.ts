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

/** A follow-up question only the candidate can answer — asked after a pass to
 *  close the gaps that hold the ATS score back. Same shape as the Prompt
 *  Analyzer's gaps. */
export interface CvGap {
  id: string
  question: string
  why: string
  // 'percent' → the answer is a single percentage (rendered as a stepper);
  // 'text' → free text. Defaults to 'text'.
  expects: 'percent' | 'text'
  // The CV item ids / section keys ("summary","skills") this answer would change.
  targets: string[]
}

/** ATS score per dimension, each an integer 1–5. Keys match ATS_DIMENSIONS in
 *  functions/cv.js and ATS_DIMS in the tool. */
export type CvAts = Record<string, number>

export interface CvResult {
  cv: Cv
  issues: CvIssue[]
  ats: CvAts
  gaps: CvGap[]
  summary: string
  polishLeft: number
  improveLeft: number
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

const ATS_KEYS = ['keywords', 'impact', 'clarity', 'format', 'completeness', 'conciseness'] as const
function parseAts(raw: unknown): CvAts {
  const src = (raw || {}) as Record<string, unknown>
  const out: CvAts = {}
  for (const k of ATS_KEYS) {
    const n = Math.round(Number(src[k]))
    out[k] = Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 3
  }
  return out
}
function parseGaps(raw: unknown): CvGap[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((g, n) => {
      const o = (g || {}) as Partial<CvGap>
      return { id: String(o.id || `gap${n}`), question: String(o.question || ''), why: String(o.why || ''), expects: o.expects === 'percent' ? 'percent' as const : 'text' as const, targets: Array.isArray(o.targets) ? o.targets.map((t) => String(t)) : [] }
    })
    .filter((g) => g.question)
}

function parseResult(data: { cv?: Cv; issues?: unknown; ats?: unknown; gaps?: unknown; summary?: unknown; polishLeft?: unknown; improveLeft?: unknown }): CvResult {
  return {
    cv: data.cv as Cv,
    issues: parseIssues(data.issues),
    ats: parseAts(data.ats),
    gaps: parseGaps(data.gaps),
    summary: typeof data.summary === 'string' ? data.summary : '',
    polishLeft: Number(data.polishLeft ?? 0),
    improveLeft: Number(data.improveLeft ?? 0),
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

/** Second pass: fold the candidate's answers to the follow-up questions into the
 *  CV to raise its ATS score, then re-score. To save output tokens the server
 *  returns only the CHANGED sections as a `patch`; we merge it (section-level,
 *  by key) onto the current CV. `sourceText` lets the model pull back any
 *  original detail a blank answer would otherwise leave missing. */
export async function improveCv(idToken: string, cv: Cv, answers: { question: string; answer: string }[], sourceText = ''): Promise<CvResult> {
  const r = await fetch(`${FN}/cv-refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, cv, kind: 'improve', answers, sourceText }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  const patch = data.patch && typeof data.patch === 'object' ? (data.patch as Partial<Cv>) : {}
  return { ...parseResult(data), cv: { ...cv, ...patch } }
}
