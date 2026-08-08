// SOURCES — checked 8 August 2026
//   Ministry of Interior — Jawazat (Directorate General of Passports), via
//     Absher (absher.sa) and Muqeem (muqeem.sa).
//     · Single: SAR 200 covering two months, SAR 100 each further month.
//     · Multiple: SAR 500 covering three months, SAR 200 each further month.
//     · Applying from abroad doubles the per-month figure.
//     · Validity cannot exceed the iqama's expiry.

// What an exit/re-entry visa costs, and the two things that catch people.
//
// - **Months are charged in whole 30-day blocks.** 1–30 days is one month,
//   31–60 is two. A trip of 61 days therefore costs a month more than a trip of
//   60, and the boundary is invisible until the fee appears.
// - **The visa cannot outrun the iqama.** Validity is capped at the iqama's
//   expiry, so a trip that returns after it is not a more expensive visa — it
//   is no visa at all until the iqama is renewed. That is a dependency, like
//   the inspection gating the vehicle registration, and it is worth saying
//   before the fee rather than after it.
//
// Extending from OUTSIDE the Kingdom costs double per month, which is the
// difference between planning and improvising.

export type VisaKind = 'single' | 'multiple'
export type ExtendFrom = 'inside' | 'outside'

interface Terms {
  base: number
  /** Months the base fee already covers. */
  included: number
  /** Per extra month, applied from inside the Kingdom. */
  perMonth: number
}

export const TERMS: Record<VisaKind, Terms> = {
  single: { base: 200, included: 2, perMonth: 100 },
  multiple: { base: 500, included: 3, perMonth: 200 },
}

/** Extending from outside doubles the per-month figure. */
export const OUTSIDE_MULTIPLIER = 2

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY)

/** 1–30 days is one month, 31–60 is two. Whole blocks, never part of one. */
export const monthsFor = (days: number) => Math.max(1, Math.ceil(Math.max(1, days) / 30))

export interface Quote {
  days: number
  months: number
  /** Months beyond what the base fee covers. */
  extraMonths: number
  perMonth: number
  base: number
  total: number
  /** Days until the next 30-day boundary pushes the price up. */
  daysToNextMonth: number
  /** Cost of crossing that boundary. */
  nextMonthCost: number
}

export function quote(kind: VisaKind, days: number, from: ExtendFrom = 'inside'): Quote {
  const t = TERMS[kind]
  const d = Math.max(1, Math.floor(days || 1))
  const months = monthsFor(d)
  const extraMonths = Math.max(0, months - t.included)
  const perMonth = t.perMonth * (from === 'outside' ? OUTSIDE_MULTIPLIER : 1)
  return {
    days: d,
    months,
    extraMonths,
    perMonth,
    base: t.base,
    total: t.base + extraMonths * perMonth,
    daysToNextMonth: months * 30 - d + 1,
    nextMonthCost: perMonth,
  }
}

export interface IqamaCheck {
  /** True when the trip returns after the iqama expires. */
  beyond: boolean
  /** Days of the trip that fall past the iqama's expiry. */
  daysBeyond: number
  /** The longest trip the current iqama allows, from the departure date. */
  maxDays: number
}

export function againstIqama(depart: Date, days: number, iqamaExpiry: Date): IqamaCheck {
  const maxDays = daysBetween(depart, iqamaExpiry)
  return {
    beyond: days > maxDays,
    daysBeyond: Math.max(0, days - maxDays),
    maxDays: Math.max(0, maxDays),
  }
}
