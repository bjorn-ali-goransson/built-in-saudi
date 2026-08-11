// What you actually keep from a sale, and what to charge to keep what you meant to.
//
// SOURCES — checked 11 August 2026
//   Authority: Zakat, Tax and Customs Authority (ZATCA) for the rate, Ministry
//   of Commerce for how a price must be shown.
//     · **VAT is 15%** on a standard-rated supply.
//     · **The displayed price must INCLUDE VAT.** The Ministry of Commerce
//       states it plainly — a SAR 100 shelf price means a final invoice of no
//       more than SAR 100 — and "tax added at the till" is a violation
//       consumers are asked to report. Corroborated across the Ministry's own
//       statement and independent reports of it (Okaz, Al-Eqtisadiah,
//       Al-Arabiya) before being encoded.
//
// WHY THIS IS NOT ANOTHER MARGIN CALCULATOR. Every one of them starts from a
// price NET of tax, because that is how the countries they were written in
// quote a price. Here you must advertise the tax-inclusive figure, so **the
// number on your product page is not the money you receive** — and the error
// compounds with the second thing they leave out, which is that a payment or
// platform fee is charged on the GROSS, including the tax you are only holding
// on ZATCA's behalf.
//
// Measured, and it is the reason to build this rather than link to one: a
// seller with a SAR 50 cost aiming at a 40% margin, using a generic
// calculator, is told to charge **83.33**. At that price, after VAT and a 2.5%
// payment fee, the margin they actually earn is **28.1%**. They aimed at forty
// and got twenty-eight. To truly earn 40% the displayed price is **100.66**.
//
// THREE THINGS PEOPLE GET WRONG:
//
// 1. **Markup is not margin.** A 50% markup is a **33.3%** margin, because
//    markup is a share of COST and margin is a share of REVENUE. This is
//    reported everywhere as one of the commonest pricing errors there is, and
//    it costs a few points on every sale forever.
// 2. **The displayed price is not revenue.** SAR 100 displayed is SAR 86.96 of
//    revenue; the other 13.04 was never yours. Computing a margin against the
//    displayed price overstates it by a seventh.
// 3. **Fees come off the gross.** A 2.5% fee on a SAR 100 sale is 2.50, not
//    2.5% of your net — the processor takes its cut of the tax as well.
//
// WHAT IT WILL NOT DO: there is no built-in table of payment-gateway or
// platform fees. They differ by provider, by package, by card scheme and by
// volume, and are negotiated. Printing a figure nobody can stand behind is the
// mistake `iqama-fees` records; the rate is an input, and the tool says where
// to find yours.

/** Standard-rated VAT. */
export const VAT_RATE = 0.15

export interface Sale {
  /** What the unit costs you, landed. */
  cost: number
  /** The price shown to the customer, INCLUDING VAT — the only price you may
   *  advertise here. */
  displayed: number
  /** Payment gateway and platform fees as a fraction, charged on the gross. */
  feeRate: number
}

export interface Breakdown {
  /** The tax inside the displayed price. Never yours. */
  vat: number
  /** What is left of the displayed price after the tax. */
  net: number
  /** Fees, charged on the whole displayed amount including the tax. */
  fee: number
  /** Net minus cost minus fees. */
  profit: number
  /** Profit as a share of NET revenue. The number that means something. */
  margin: number
  /** Profit as a share of cost. The bigger, more flattering number. */
  markup: number
  /** True when the sale loses money. */
  loss: boolean
}

/** Split one sale into where the money went. */
export function breakDown(s: Sale): Breakdown {
  const displayed = Math.max(0, s.displayed || 0)
  const cost = Math.max(0, s.cost || 0)
  const feeRate = Math.max(0, s.feeRate || 0)

  const net = displayed / (1 + VAT_RATE)
  const vat = displayed - net
  const fee = displayed * feeRate
  const profit = net - cost - fee

  return {
    vat,
    net,
    fee,
    profit,
    margin: net > 0 ? profit / net : 0,
    markup: cost > 0 ? profit / cost : 0,
    loss: profit < 0,
  }
}

/**
 * The price to DISPLAY in order to actually earn a given margin.
 *
 * Solving for it rather than marking up, because the fee is a share of the
 * answer: `profit = net - cost - fee` with `net = P/(1+v)` and `fee = fP`
 * gives `P = cost / ((1-m)/(1+v) - f)`.
 *
 * Returns null when the target is unreachable — a 90% margin against a 12% fee
 * has no solution, and the denominator goes to zero or negative. Saying so
 * beats returning a vast number that looks like an answer.
 */
export function priceForMargin(cost: number, margin: number, feeRate: number): number | null {
  const c = Math.max(0, cost || 0)
  const m = margin
  const f = Math.max(0, feeRate || 0)
  if (m >= 1) return null
  const denom = (1 - m) / (1 + VAT_RATE) - f
  if (denom <= 0) return null
  return c / denom
}

/**
 * What a generic, net-of-tax, no-fee calculator would tell you to charge —
 * and, since it is quoted here as a displayed price, what it actually earns.
 *
 * This is the comparison the tool exists for, so it is computed rather than
 * described.
 */
export function naivePrice(cost: number, margin: number): number {
  if (margin >= 1) return Infinity
  return Math.max(0, cost || 0) / (1 - margin)
}

/** Markup converted to the margin it really is, and back. */
export const markupToMargin = (markup: number) => markup / (1 + markup)
export const marginToMarkup = (margin: number) => (margin >= 1 ? Infinity : margin / (1 - margin))
