// What it costs to pay a personal finance off early — and what it saves.
//
// The rule is SAMA's, not the lender's, and it is the opposite of what most
// people assume. Settling early does NOT mean paying the rest of the term cost.
// The borrower pays the outstanding balance plus the term cost for the **three
// months following** repayment, on a declining balance, and the cost for the
// remaining period is waived. The three months is a ceiling, not a fee schedule.
//
// So the number worth showing is not the settlement figure but the SAVING
// against continuing to maturity — which is what tells someone whether to do it,
// and which no bank quote puts in front of them.

export interface Loan {
  /** Amount financed, in SAR. */
  principal: number
  /** Annual term cost as a percentage, e.g. 6.5. */
  annualRate: number
  /** Total term in months. */
  months: number
  /** How many monthly payments have already been made. */
  paid: number
}

export interface Settlement {
  monthly: number
  /** Outstanding balance after the payments made so far. */
  balance: number
  /** Term cost for the three months following, on a declining balance. */
  compensation: number
  /** Balance + compensation: what settling costs today. */
  total: number
  /** What the remaining payments would have cost in full. */
  ifContinued: number
  /** Continuing minus settling — the number that decides it. */
  saving: number
  remaining: number
}

const round = (n: number) => Math.round(n * 100) / 100

/** Standard amortising payment. Falls back to straight division at zero rate. */
export function monthlyPayment(principal: number, annualRate: number, months: number): number {
  if (months <= 0) return 0
  const i = annualRate / 100 / 12
  if (i === 0) return principal / months
  return (principal * i) / (1 - Math.pow(1 + i, -months))
}

/**
 * Balance after `k` payments, on a declining balance.
 *
 * Computed from the closed form rather than by looping, then clamped at zero:
 * floating point can leave a few halalas outstanding on the final payment, and
 * a negative balance would turn into a negative settlement figure.
 */
export function balanceAfter(principal: number, annualRate: number, months: number, k: number): number {
  const i = annualRate / 100 / 12
  const m = monthlyPayment(principal, annualRate, months)
  if (i === 0) return Math.max(0, principal - m * k)
  const g = Math.pow(1 + i, k)
  return Math.max(0, principal * g - m * ((g - 1) / i))
}

export function settle(loan: Loan): Settlement {
  const principal = Math.max(0, loan.principal || 0)
  const months = Math.max(1, Math.floor(loan.months || 1))
  const paid = Math.min(Math.max(0, Math.floor(loan.paid || 0)), months)
  const rate = Math.max(0, loan.annualRate || 0)

  const m = monthlyPayment(principal, rate, months)
  const balance = balanceAfter(principal, rate, months, paid)
  const remaining = months - paid

  // "The term cost for the three months subsequent to repayment, calculated on
  // the basis of a declining balance" — so it is the interest portion of the
  // next three payments, not three times the first month's.
  const i = rate / 100 / 12
  let b = balance
  let compensation = 0
  for (let k = 0; k < Math.min(3, remaining); k++) {
    const interest = b * i
    compensation += interest
    b = Math.max(0, b + interest - m)
  }

  const total = balance + compensation
  const ifContinued = m * remaining
  return {
    monthly: round(m),
    balance: round(balance),
    compensation: round(compensation),
    total: round(total),
    ifContinued: round(ifContinued),
    saving: round(ifContinued - total),
    remaining,
  }
}
