// What a parcel from abroad actually costs when it lands.
//
// SOURCES — checked 10 August 2026
//   Corroborated across two independent customs-clearance guides before being
//   encoded, both citing ZATCA:
//     · **5%** customs duty on most goods, charged on the **CIF** value — cost
//       plus insurance plus freight, not the price of the item alone.
//     · **0%** on books, medical devices, basic foodstuffs, and goods of GCC
//       origin under the GCC Customs Union.
//     · Higher protected rates exist — around **20%** for some categories and
//       **100%** on tobacco.
//     · **A personal shipment of SAR 1,000 or less is exempt from DUTY.**
//     · **15% VAT applies to every import regardless of value**, and is charged
//       on the landed value **including the duty**.
//   Rates vary by HS code and were revised in late 2025, so the tool names
//   ZATCA's Integrated Tariff rather than pretending to be a tariff book.
//
// THREE THINGS PEOPLE GET WRONG, and the first is nearly universal:
//
// 1. **"Under a thousand riyals is duty-free" is true, and "nothing to pay" is
//    not.** The exemption is on the DUTY. The 15% VAT applies at any value, so
//    a SAR 300 parcel still owes 45. That is the belief this tool exists to
//    correct.
// 2. **Shipping counts.** Customs values a parcel at CIF, so a SAR 950 item
//    with SAR 100 postage is a SAR 1,050 shipment and is over the line — and
//    the duty is charged on the whole 1,050, not on the 50 above it.
// 3. **VAT compounds on the duty**, so the two rates do not add. A dutiable
//    parcel at 5% is not 20%: it is 5% + 15% of 105%, i.e. **20.75%** of CIF.
//    Small on a phone case, real on a laptop.

/** VAT on imports, on the landed value including duty. */
export const VAT_RATE = 0.15
/** A personal shipment at or below this is exempt from DUTY, not from VAT. */
export const DUTY_FREE_LIMIT = 1000

export interface DutyBand { id: string; rate: number }

/**
 * The bands, not a tariff book.
 *
 * Deliberately a handful of published rates rather than an HS-code table: the
 * codes run to thousands of lines, they were revised in late 2025, and a
 * half-copied tariff that is wrong for one line is worse than sending somebody
 * to the authority that publishes it.
 */
export const BANDS: DutyBand[] = [
  { id: 'zero', rate: 0 },
  { id: 'standard', rate: 0.05 },
  { id: 'protected', rate: 0.20 },
  { id: 'tobacco', rate: 1.0 },
]

export interface Parcel {
  /** What the goods cost. */
  goods: number
  /** Freight, which customs counts. */
  shipping: number
  /** Insurance, which customs also counts. */
  insurance: number
  /** Duty rate as a fraction. */
  dutyRate: number
  /** A personal shipment gets the SAR 1,000 duty exemption; a commercial one
   *  does not. */
  personal: boolean
}

export interface Landed {
  /** Cost + insurance + freight: what customs values the parcel at. */
  cif: number
  duty: number
  /** True when the duty was waived by the personal-shipment threshold. */
  dutyWaived: boolean
  /** VAT is charged on CIF PLUS duty, which is why the rates do not add. */
  vatBase: number
  vat: number
  /** Everything owed on top of the goods themselves. */
  charges: number
  total: number
  /** Charges as a percentage of CIF — the number that surprises people. */
  effectiveRate: number
}

export function landedCost(p: Parcel): Landed {
  const cif = Math.max(0, p.goods) + Math.max(0, p.shipping) + Math.max(0, p.insurance)
  // The threshold is on the CIF value, not on the price of the goods — which
  // is trap 2: postage can push a parcel over it.
  const dutyWaived = p.personal && cif <= DUTY_FREE_LIMIT
  const duty = dutyWaived ? 0 : cif * Math.max(0, p.dutyRate)
  const vatBase = cif + duty
  const vat = vatBase * VAT_RATE
  const charges = duty + vat
  return {
    cif,
    duty,
    dutyWaived,
    vatBase,
    vat,
    charges,
    total: cif + charges,
    effectiveRate: cif > 0 ? (charges / cif) * 100 : 0,
  }
}

/**
 * How far under or over the exemption a parcel is.
 *
 * Negative once it has crossed. Worth showing because the line is a cliff for
 * the duty, not a taper: at SAR 1,001 the duty is charged on the whole 1,001.
 */
export const overBy = (cif: number) => cif - DUTY_FREE_LIMIT

/**
 * The extra owed by being one riyal over the line.
 *
 * The cliff, in money: crossing it costs the duty on the ENTIRE value plus the
 * VAT that compounds on it, not a few halalas.
 */
export function cliffCost(dutyRate: number, cif = DUTY_FREE_LIMIT + 1): number {
  const duty = cif * dutyRate
  return duty + duty * VAT_RATE
}
