// SOURCES — checked 8 August 2026
//   Water & Electricity Regulatory Authority (WERA) tariff, as billed by Saudi
//     Electricity Company (se.com.sa).
//     · Residential: 18 halalas/kWh up to 6,000 a month, 30 above — MARGINAL,
//       so only the units above 6,000 are charged at the higher rate.
//     · SAR 10 meter fee, then 15% VAT on the whole charge.

// A residential electricity bill, and the misconception that makes people
// misjudge it.
//
// The tariff is **marginal**, not a cliff: consumption up to 6,000 kWh in a
// month is charged at 18 halalas, and only the kWh ABOVE that are charged at
// 30. Crossing the threshold does not reprice the earlier units — which is the
// thing almost everyone assumes about tiered pricing, and the reason a bill
// feels arbitrary. Going from 5,999 to 6,001 kWh costs 60 halalas more, not
// hundreds of riyals more.
//
// A fixed meter fee and 15% VAT sit on top, and the VAT applies to the whole
// charge rather than to the energy alone.

/** Halalas per kWh, first band. */
export const RATE_LOW = 0.18
/** Halalas per kWh, above the threshold. */
export const RATE_HIGH = 0.30
/** kWh per MONTH at which the higher rate starts applying to further units. */
export const THRESHOLD = 6000
/** Fixed meter service charge, SAR. */
export const METER_FEE = 10
export const VAT = 0.15

export interface Bill {
  kwh: number
  /** Units charged at the lower rate. */
  lowUnits: number
  /** Units charged at the higher rate — zero below the threshold. */
  highUnits: number
  lowCost: number
  highCost: number
  energy: number
  meter: number
  vat: number
  total: number
  /** What the next kWh costs, at this level of use. */
  marginal: number
  /** kWh remaining before the higher rate starts. Zero once past it. */
  toThreshold: number
  /**
   * What crossing the threshold actually costs, for the copy that corrects the
   * misconception: the difference between the last unit below and the first
   * unit above.
   */
  stepCost: number
}

const round = (n: number) => Math.round(n * 100) / 100

export function bill(kwh: number): Bill {
  const units = Math.max(0, kwh || 0)
  const lowUnits = Math.min(units, THRESHOLD)
  const highUnits = Math.max(0, units - THRESHOLD)
  const lowCost = lowUnits * RATE_LOW
  const highCost = highUnits * RATE_HIGH
  const energy = lowCost + highCost
  const meter = METER_FEE
  // VAT applies to the whole charge, energy and meter fee alike.
  const vat = (energy + meter) * VAT
  return {
    kwh: units,
    lowUnits,
    highUnits,
    lowCost: round(lowCost),
    highCost: round(highCost),
    energy: round(energy),
    meter,
    vat: round(vat),
    total: round(energy + meter + vat),
    marginal: units >= THRESHOLD ? RATE_HIGH : RATE_LOW,
    toThreshold: Math.max(0, THRESHOLD - units),
    stepCost: round((RATE_HIGH - RATE_LOW) * (1 + VAT)),
  }
}

/** What a change in consumption is worth, with VAT — the useful "what if". */
export function deltaCost(fromKwh: number, toKwh: number): number {
  return round(bill(toKwh).total - bill(fromKwh).total)
}
