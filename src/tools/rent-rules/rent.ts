// Two rules a tenant or a landlord actually needs, and the date that separates
// them.
//
// **The Riyadh freeze.** A royal decree of 25 September 2025 suspends rent
// increases inside Riyadh's urban boundary for five years, on residential AND
// commercial property. The part that catches people is not the freeze but the
// exception: an escalation clause in a contract ALREADY IN PLACE on that date
// stays valid and enforceable, while a contract entered on or after it may not
// apply escalation during the freeze even if its term runs longer. So two
// tenants in the same building can face different answers, decided by which
// side of one day their signature falls.
//
// **Automatic renewal**, which is nationwide and not a Riyadh rule at all: a
// lease renews itself unless one party gives notice at least 60 days before it
// ends. Miss that and the contract has renewed — which is the more common and
// more expensive mistake, and the reason the deadline is a countdown here.

/** The decree's effective date. */
export const FREEZE_START = new Date(2025, 8, 25)
/** Five years on. */
export const FREEZE_END = new Date(2030, 8, 25)
/** Days of notice required to stop a lease renewing itself. */
export const NOTICE_DAYS = 60

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY)
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)

/** Which of the decree's three property situations applies. */
export type Situation = 'leased' | 'vacant' | 'never'

export interface FreezeVerdict {
  /** False outside Riyadh, or once the five years are up. */
  applies: boolean
  /** True when the landlord may still raise the rent. */
  increaseAllowed: boolean
  /** Why — the one sentence that answers the question. */
  reason: 'not-riyadh' | 'expired' | 'pre-existing-escalation' | 'frozen' | 'first-agreement'
  /** What the rent is pinned to, when it is pinned. */
  reference: 'current' | 'last-ejar' | 'agreed' | null
}

export function freezeVerdict(opts: {
  riyadh: boolean
  /** When this contract was signed. */
  signed: Date
  situation: Situation
  /** Does the contract contain an escalation clause? */
  escalation: boolean
  today?: Date
}): FreezeVerdict {
  const today = opts.today ?? new Date()
  if (!opts.riyadh) return { applies: false, increaseAllowed: true, reason: 'not-riyadh', reference: null }
  if (startOfDay(today) >= startOfDay(FREEZE_END)) {
    return { applies: false, increaseAllowed: true, reason: 'expired', reference: null }
  }

  const signedBefore = startOfDay(opts.signed) < startOfDay(FREEZE_START)

  // The exception, and the whole reason the signing date is asked for: a clause
  // that already existed keeps working.
  if (signedBefore && opts.escalation) {
    return { applies: true, increaseAllowed: true, reason: 'pre-existing-escalation', reference: 'current' }
  }

  // A property never previously leased has no reference rent to be pinned to,
  // so the first rent is whatever the two parties agree — and is then frozen.
  if (opts.situation === 'never' && !signedBefore) {
    return { applies: true, increaseAllowed: false, reason: 'first-agreement', reference: 'agreed' }
  }

  return {
    applies: true,
    increaseAllowed: false,
    reason: 'frozen',
    reference: opts.situation === 'vacant' ? 'last-ejar' : 'current',
  }
}

export interface NoticeStatus {
  ends: Date
  /** The last day notice can be given to stop the lease renewing. */
  deadline: Date
  daysLeft: number
  /** True once the deadline has passed: the lease will renew itself. */
  passed: boolean
}

/** Nationwide, and the deadline people actually miss. */
export function noticeStatus(ends: Date, today = new Date()): NoticeStatus {
  const deadline = addDays(ends, -NOTICE_DAYS)
  return {
    ends,
    deadline,
    daysLeft: daysBetween(today, deadline),
    passed: startOfDay(today) > startOfDay(deadline),
  }
}
