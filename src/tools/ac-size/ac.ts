// What size air conditioner a room needs, and why bigger is not better.
//
// SOURCES — checked 9 August 2026
//   Sizing bands corroborated across five Saudi and Gulf sources before being
//   encoded — YORK KSA, Tamkeen Stores, elecs.sa, TCL Gulf and LG Saudi — all
//   of which publish the same ladder: 12–16 m² → 12,000 BTU/h (1 ton),
//   16–22 → 18,000, 22–30 → 24,000, 30–40 → 30,000, with 10–20% added for
//   direct sun or a high ceiling and 400–600 BTU per occupant. That works out
//   at about 750 BTU/h per m², which is roughly THREE TIMES the 20 BTU/sq ft
//   (≈215 BTU/m²) rule the American calculators use — a temperate-climate
//   number that badly undersizes a room in a 45°C summer.
//
// Found by a web sweep of the home-improvement calculator market, where AC
// sizing is a staple (464 calculators on one site) and every one of them
// assumes a temperate climate.
//
// This is a SANITY CHECK, not a load calculation. A real answer accounts for
// wall construction, glazing, orientation, infiltration and internal gains —
// ASHRAE/Manual J work an engineer does. The tool says so rather than implying
// its arithmetic is the same thing.

/** BTU/h per m² for a hot-climate room, before adjustments. */
export const BASE_PER_M2 = 750
/** 1 refrigeration ton = 12,000 BTU/h. Sold in tons here, BTU elsewhere. */
export const BTU_PER_TON = 12000
/** What you can actually buy: standard split capacities, BTU/h. */
export const SIZES = [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000]

export interface Room {
  areaM2: number
  /** Ceiling height in metres; anything over 2.8 adds volume the base misses. */
  ceilingM: number
  /** Direct sun on a wall or window for much of the day. */
  sunny: boolean
  /** Top floor, so the roof loads it too. */
  topFloor: boolean
  /** People normally in the room. */
  people: number
  /** A kitchen adds a large, constant internal gain. */
  kitchen: boolean
}

export interface AcResult {
  btu: number
  tons: number
  /** The nearest size actually sold, rounded UP. */
  unit: number
  unitTons: number
  /** How far above the requirement the bought unit is, as a percentage. */
  overBy: number
  /** Each adjustment, so the answer can be argued with rather than believed. */
  parts: { key: string; btu: number }[]
}

export function calcAc(r: Room): AcResult {
  const area = Math.max(0, r.areaM2)
  const base = area * BASE_PER_M2
  const parts: { key: string; btu: number }[] = [{ key: 'base', btu: base }]

  // Height is volume the per-m² figure assumes at 2.8 m; above that the extra
  // is proportional, not a flat bonus.
  const extraHeight = Math.max(0, r.ceilingM - 2.8)
  if (extraHeight > 0) parts.push({ key: 'ceiling', btu: base * (extraHeight / 2.8) })
  if (r.sunny) parts.push({ key: 'sun', btu: base * 0.15 })
  if (r.topFloor) parts.push({ key: 'roof', btu: base * 0.1 })
  // The first two occupants are inside the published bands already.
  const extraPeople = Math.max(0, r.people - 2)
  if (extraPeople > 0) parts.push({ key: 'people', btu: extraPeople * 500 })
  if (r.kitchen) parts.push({ key: 'kitchen', btu: 4000 })

  const btu = parts.reduce((n, p) => n + p.btu, 0)
  // Rounded UP: an undersized unit runs flat out and never reaches the set
  // point, which is the worse of the two failures.
  const unit = SIZES.find((s) => s >= btu) ?? SIZES[SIZES.length - 1]
  return {
    btu,
    tons: btu / BTU_PER_TON,
    unit,
    unitTons: unit / BTU_PER_TON,
    overBy: btu > 0 ? ((unit - btu) / btu) * 100 : 0,
    parts,
  }
}

/**
 * Whether the nearest purchasable unit is so far above the requirement that
 * short-cycling becomes the problem.
 *
 * **Oversizing is the mistake people actually make**, because bigger sounds
 * safer. An oversized unit reaches the set point fast and stops, so it never
 * runs long enough to pull moisture out of the air — the room ends up cold and
 * clammy rather than comfortable, and the compressor wears from starting and
 * stopping. On the coast, where the humidity is, that is the difference between
 * a room that feels right and one that does not.
 */
export const OVERSIZE_WARN = 25
export const isOversized = (r: AcResult) => r.overBy > OVERSIZE_WARN
