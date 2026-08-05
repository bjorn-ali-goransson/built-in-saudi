import { gregorianToHijri, hijriToGregorian, formatHijri } from '../prayer-times/islamic'

// Documents people in Saudi Arabia actually let lapse. Each carries the lead
// time at which it's worth acting — not a legal deadline, just when renewal
// normally opens or when a queue starts to matter.
export type DocKind = 'iqama' | 'passport' | 'licence' | 'istimara' | 'insurance' | 'visa' | 'other'

export const KINDS: DocKind[] = ['iqama', 'passport', 'licence', 'istimara', 'insurance', 'visa', 'other']

export const KIND_LABEL: Record<DocKind, { en: string; ar: string }> = {
  iqama: { en: 'Iqama / residency', ar: 'الإقامة' },
  passport: { en: 'Passport', ar: 'جواز السفر' },
  licence: { en: 'Driving licence', ar: 'رخصة القيادة' },
  istimara: { en: 'Vehicle registration (istimara)', ar: 'استمارة المركبة' },
  insurance: { en: 'Insurance', ar: 'التأمين' },
  visa: { en: 'Visa / exit re-entry', ar: 'التأشيرة / الخروج والعودة' },
  other: { en: 'Something else', ar: 'مستند آخر' },
}

/** Days ahead at which we start nudging, per document. */
export const LEAD_DAYS: Record<DocKind, number> = {
  iqama: 60, passport: 180, licence: 30, istimara: 30, insurance: 30, visa: 30, other: 30,
}

export type Calendar = 'gregorian' | 'hijri'

export interface Doc {
  id: string
  kind: DocKind
  label: string
  /** Stored as an ISO date, whichever calendar it was entered in. */
  expiry: string
  calendar: Calendar
}

export const STORE_KEY = 'bis-id-expiry'

export function load(): Doc[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as Doc[]).filter((d) => d && d.id && d.expiry) : []
  } catch { return [] }
}

export function save(docs: Doc[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(docs)) } catch { /* non-fatal */ }
}

/** Whole days from today (local midnight) to the expiry date. */
export function daysLeft(iso: string, now = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, (m || 1) - 1, d || 1)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export type Status = 'expired' | 'urgent' | 'soon' | 'ok'

export function status(doc: Doc, now = new Date()): Status {
  const n = daysLeft(doc.expiry, now)
  if (n < 0) return 'expired'
  if (n <= 14) return 'urgent'
  if (n <= LEAD_DAYS[doc.kind]) return 'soon'
  return 'ok'
}

export const STATUS_TONE: Record<Status, string> = {
  expired: 'border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_16%,transparent)]',
  urgent: 'border-gold-500',
  soon: 'border-[color:var(--line)]',
  ok: 'border-[color:var(--line)]',
}

/** Convert a Hijri y/m/d into the ISO Gregorian date we store. */
export function hijriInputToIso(y: number, m: number, d: number): string {
  const g = hijriToGregorian(y, m, d)
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`
}

export function isoToHijri(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return gregorianToHijri(new Date(y, (m || 1) - 1, d || 1))
}

export function bothCalendars(iso: string, locale: 'en' | 'ar'): { greg: string; hijri: string } {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  return {
    greg: date.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    }),
    hijri: formatHijri(date, locale),
  }
}

export function newId(): string {
  return `d${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}
