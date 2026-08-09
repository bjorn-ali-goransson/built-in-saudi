// Trip fuel cost, and whether 95 is worth it.
//
// SOURCES — checked 9 August 2026
//   Saudi Aramco publishes the regulated domestic retail fuel prices
//   (aramco.com); they are reviewed periodically, which is why this tool is
//   badged beta and every price here is an editable default rather than an
//   answer. The figures below — 91 at SAR 2.18/L and 95 at SAR 2.33/L — were
//   corroborated across two independent published sources before being encoded,
//   the same rule `end-of-service` follows. Diesel is deliberately absent: no
//   figure for it was corroborated, and printing one nobody verified is the
//   mistake `iqama-fees` records.
//
// Found by a web sweep of the automotive-calculator market, where fuel cost is
// one of the staples and several Arabic sites already publish one. Two things
// make ours worth building rather than copying:
//
// 1. **Nobody agrees what "consumption" means.** A Saudi dashboard shows
//    **km/L**, a spec sheet shows **L/100km**, and an imported car shows
//    **MPG** — in two different gallons, 20% apart. The incumbents take
//    L/100km and leave the conversion to the driver, which is where the
//    arithmetic goes wrong before it starts.
// 2. **"Is 95 worth it?" is the question people actually have at the pump**,
//    and no calculator answers it. It is decidable: 95 pays for itself only if
//    it returns better economy by at least the percentage it costs more.

export type Unit = 'l100' | 'kmpl' | 'mpgUs' | 'mpgUk'

/** Litres per 100 km, whatever the driver's dashboard happens to show. */
export function toL100(value: number, unit: Unit): number {
  if (!(value > 0)) return 0
  switch (unit) {
    case 'l100': return value
    case 'kmpl': return 100 / value
    // 1 US gallon = 3.785411784 L, 1 mile = 1.609344 km.
    case 'mpgUs': return 235.214583 / value
    // The Imperial gallon is 4.54609 L — a fifth bigger, so the same number of
    // "miles per gallon" is a fifth better. Treating them as one unit is a 20%
    // error, and an imported car may be labelled in either.
    case 'mpgUk': return 282.480936 / value
  }
}

export const PRICES = { p91: 2.18, p95: 2.33 } as const

export interface Trip {
  km: number
  consumption: number
  unit: Unit
  price: number
  returnTrip: boolean
  people: number
}

export interface TripResult {
  km: number
  litres: number
  cost: number
  perKm: number
  perPerson: number
  l100: number
}

export function calcTrip(t: Trip): TripResult {
  const l100 = toL100(t.consumption, t.unit)
  const km = Math.max(0, t.km) * (t.returnTrip ? 2 : 1)
  const litres = (km / 100) * l100
  const cost = litres * Math.max(0, t.price)
  return {
    km,
    litres,
    cost,
    perKm: km ? cost / km : 0,
    perPerson: t.people > 0 ? cost / t.people : cost,
    l100,
  }
}

/**
 * How much better 95 must do before it pays for itself.
 *
 * It costs `p95 / p91` times as much, so it has to go that much further on a
 * litre. Below that the extra is simply spent. The tool states this rather than
 * implying an answer, because whether a given car gains anything depends on
 * whether its engine advances timing for the higher octane — most cars built
 * for 91 do not, and a car whose manual REQUIRES 95 is not choosing.
 */
export const breakEvenPercent = (p91: number, p95: number): number =>
  p91 > 0 ? ((p95 - p91) / p91) * 100 : 0
