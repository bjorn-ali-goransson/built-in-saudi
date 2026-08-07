// When a vehicle's inspection and registration are actually due.
//
// The dates are simple; the RELATIONSHIP between them is what people get
// caught by, and it is the reason this is worth a tool:
//
// - **The inspection gates the registration.** No valid Fahes, no istimara
//   renewal and no ownership transfer. People discover this at the counter, on
//   the day, with an expired card — so the useful output is not two dates but
//   the order they have to happen in.
// - **A new private car is exempt for three years** from first registration,
//   then inspected every year. So the first inspection is due on an
//   anniversary nobody has a reminder for, and until then an inspection is
//   money spent for nothing.
// - **Public transport and taxis get two years**, not three.

export type VehicleKind = 'private' | 'public'

/** Years of exemption from first registration, by vehicle kind. */
export const EXEMPT_YEARS: Record<VehicleKind, number> = { private: 3, public: 2 }

/** How early the registration renewal window opens, in days. */
export const RENEWAL_WINDOW_DAYS = 180

const DAY = 86_400_000

export const addYears = (d: Date, n: number) => {
  const out = new Date(d.getTime())
  out.setFullYear(out.getFullYear() + n)
  return out
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)

export const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY)

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export interface Inspection {
  /** True while the vehicle is still inside its exemption. */
  exempt: boolean
  /** The next inspection date — the end of the exemption, or the next annual one. */
  due: Date
  /** Negative when it has already passed. */
  daysAway: number
  /** How many annual inspections have fallen due since the exemption ended. */
  since: number
}

/**
 * The next inspection due date.
 *
 * Counted from the LAST inspection, not from first registration — a Fahes
 * certificate is valid a year from the day it was passed, so that is what sets
 * the next one. An earlier draft of this walked anniversaries forward from
 * first registration instead, which looks equivalent and is not: it can only
 * ever return a date in the future, so "overdue" was unreachable and the
 * warning that depends on it was dead code. The test caught that.
 *
 * With no last inspection recorded, a vehicle past its exemption is due now.
 */
export function nextInspection(
  firstRegistered: Date,
  kind: VehicleKind,
  today = new Date(),
  lastInspection?: Date | null,
): Inspection {
  const exemptUntil = addYears(firstRegistered, EXEMPT_YEARS[kind])
  if (startOfDay(today) < startOfDay(exemptUntil)) {
    return { exempt: true, due: exemptUntil, daysAway: daysBetween(today, exemptUntil), since: 0 }
  }
  // Past the exemption with nothing on record: the first one came due when the
  // exemption ended.
  const due = lastInspection ? addYears(lastInspection, 1) : exemptUntil
  return { exempt: false, due, daysAway: daysBetween(today, due), since: lastInspection ? 1 : 0 }
}

export interface Registration {
  expires: Date
  /** When the renewal window opens. */
  opens: Date
  /** True when it can be renewed right now. */
  open: boolean
  /** Negative when the registration has already expired. */
  daysAway: number
}

export function registrationStatus(expires: Date, today = new Date()): Registration {
  const opens = addDays(expires, -RENEWAL_WINDOW_DAYS)
  return {
    expires,
    opens,
    open: startOfDay(today) >= startOfDay(opens),
    daysAway: daysBetween(today, expires),
  }
}

/**
 * The one thing worth saying out loud: can the registration actually be
 * renewed, or is an inspection in the way first?
 */
export function blockedByInspection(insp: Inspection, reg: Registration): boolean {
  // Only a chargeable, already-due inspection blocks it. Inside the exemption
  // there is nothing to pass.
  return !insp.exempt && insp.daysAway < 0 && reg.open
}
