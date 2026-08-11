import { gregorianToHijri, hijriToGregorian, formatHijri } from '../prayer-times/islamic'

// Documents people in Saudi Arabia actually let lapse. Each carries the lead
// time at which it's worth acting — not a legal deadline, just when renewal
// normally opens or when a queue starts to matter.
export type DocKind =
  | 'iqama' | 'passport' | 'licence' | 'istimara' | 'insurance' | 'visa'
  // Business documents. Every kind here used to be personal, on a site that
  // also answers what a commercial register costs to renew and when its window
  // opens — so the one tool built for "what runs out next" did not know about
  // the documents whose lapse suspends a business.
  | 'cr' | 'municipal' | 'chamber'
  | 'other'

export const KINDS: DocKind[] = ['iqama', 'passport', 'licence', 'istimara', 'insurance', 'visa', 'cr', 'municipal', 'chamber', 'other']

export const KIND_LABEL: Record<DocKind, { en: string; ar: string }> = {
  iqama: { en: 'Iqama / residency', ar: 'الإقامة' },
  passport: { en: 'Passport', ar: 'جواز السفر' },
  licence: { en: 'Driving licence', ar: 'رخصة القيادة' },
  istimara: { en: 'Vehicle registration (istimara)', ar: 'استمارة المركبة' },
  insurance: { en: 'Insurance', ar: 'التأمين' },
  visa: { en: 'Visa / exit re-entry', ar: 'التأشيرة / الخروج والعودة' },
  cr: { en: 'Commercial registration', ar: 'السجل التجاري' },
  municipal: { en: 'Municipal (Balady) licence', ar: 'رخصة البلدية' },
  chamber: { en: 'Chamber of Commerce subscription', ar: 'اشتراك الغرفة التجارية' },
  other: { en: 'Something else', ar: 'مستند آخر' },
}

/** Days ahead at which we start nudging, per document. */
export const LEAD_DAYS: Record<DocKind, number> = {
  iqama: 60, passport: 180, licence: 30, istimara: 30, insurance: 30, visa: 30,
  // The commercial register's renewal window opens exactly 90 days out, and
  // the same is true of a municipal licence; the Chamber subscription is a
  // prerequisite for both, so it is worth chasing sooner than its own date.
  cr: 90, municipal: 90, chamber: 30,
  other: 30,
}

/**
 * The tool that owns the RULE behind a document, where one exists.
 *
 * This tool knows a date and nothing else — it will tell somebody their iqama
 * runs out in six weeks on a site that also works out what the renewal costs,
 * warns that an exit-re-entry visa cannot outrun it, and knows a lapsed Fahes
 * blocks an istimara renewal. Every one of those lived a click away with
 * nothing pointing at it: **`IdExpiryTool` had zero outbound links.**
 *
 * Only where the tool genuinely answers the next question. A passport or an
 * insurance policy has no rule module here, and inventing a link would be
 * worse than none.
 */
export const GUIDE: Partial<Record<DocKind, { tool: string; en: string; ar: string }>> = {
  iqama: { tool: 'iqama-fees', en: 'What the renewal costs', ar: 'كم يكلّف التجديد' },
  istimara: { tool: 'vehicle-renewal', en: 'The window, and the Fahes that gates it', ar: 'النافذة والفحص الذي يشترطها' },
  visa: { tool: 'exit-reentry', en: 'The fee, and the iqama it cannot outrun', ar: 'الرسوم والإقامة التي لا تتجاوزها' },
  cr: { tool: 'cr-renewal', en: 'The window, and why the grace is not an extension', ar: 'النافذة ولماذا ليست المهلة تمديدًا' },
  municipal: { tool: 'cr-renewal', en: 'How it gates the commercial register', ar: 'كيف تشترط السجل التجاري' },
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
