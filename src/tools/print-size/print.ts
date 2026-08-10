// How big can this photo be printed, and what "300 DPI" actually means.
//
// SOURCES — checked 10 August 2026
//   Human visual acuity is conventionally **1 arcminute** for 20/20 vision:
//   the parts of the smallest letter read on a chart subtend 1/60 of a degree
//   at the eye. There are **3438 arcminutes in a radian** (180/π × 60), which
//   is the constant that turns an angle into a distance — so the finest
//   detail resolvable at a distance d is d/3438, and the pixel density that
//   just saturates the eye is **3438 / d**.
//   Corroborated across two independent sources before being encoded, and the
//   derivation is checkable: at 11.46 inches — arm's length, roughly how you
//   hold a photograph — that formula gives **300 PPI**.
//
// THAT IS THE WHOLE POINT OF THE TOOL. "300 DPI" is quoted everywhere as
// though it were a law of printing. It is not: it is one arcminute of human
// acuity at arm's length, and it falls away with distance. A poster read from
// two metres saturates the eye at about **44 PPI** — seven times fewer pixels,
// which is the difference between "your photo is too small" and "your photo is
// fine". Every print-size calculator on the web prints the 300 and none of them
// says where it came from or when it stops applying.
//
// Two more things this gets right that the incumbents do not:
//
// - **A pixel has no size.** The DPI field inside a JPEG is metadata that most
//   software ignores; nothing about the image changes when you edit it. What
//   decides the print is pixels ÷ physical size, and nothing else.
// - **Paper here is the A series.** A4/A3/A2 first, not Letter — this is a
//   Gulf site, and a calculator whose first preset is a paper size nobody here
//   buys is a calculator you have to fight.

/** Arcminutes in a radian: 180/π × 60. The constant that makes this geometry. */
export const ARCMIN_PER_RADIAN = 3438
export const CM_PER_INCH = 2.54

/**
 * The pixel density that just saturates a 20/20 eye at this viewing distance.
 *
 * Above it, more pixels are invisible; below it, the eye can resolve the grid.
 */
export function ppiForDistance(distanceCm: number): number {
  const inches = Math.max(1, distanceCm) / CM_PER_INCH
  return ARCMIN_PER_RADIAN / inches
}

/** Physical size in cm of `px` pixels printed at `ppi`. */
export const cmAt = (px: number, ppi: number) => (px / Math.max(1, ppi)) * CM_PER_INCH

/** The density you actually get printing `px` pixels across `cm`. */
export const ppiAcross = (px: number, cm: number) => (px / Math.max(0.1, cm)) * CM_PER_INCH

export interface Paper { id: string; w: number; h: number }

/**
 * Millimetres, long edge second. The A series first because that is what is
 * sold here; the photo sizes after it are the ones a print shop actually offers.
 */
export const PAPERS: Paper[] = [
  { id: 'a6', w: 105, h: 148 },
  { id: 'a5', w: 148, h: 210 },
  { id: 'a4', w: 210, h: 297 },
  { id: 'a3', w: 297, h: 420 },
  { id: 'a2', w: 420, h: 594 },
  { id: 'a1', w: 594, h: 841 },
  { id: 'a0', w: 841, h: 1189 },
  { id: 'photo10x15', w: 100, h: 150 },
  { id: 'photo13x18', w: 130, h: 180 },
  { id: 'photo20x30', w: 200, h: 300 },
]

export interface Fit {
  /** PPI along the constraining edge once the image is fitted to the paper. */
  ppi: number
  /** Printed size in cm, preserving the image's own proportions. */
  wCm: number
  hCm: number
  /** True when the paper's proportions differ enough to leave visible margins. */
  letterboxed: boolean
}

/**
 * Fit `px` × `py` pixels inside a sheet, keeping the image's proportions.
 *
 * Fitted rather than stretched, and the leftover is reported instead of being
 * silently cropped: a calculator that quietly changes the aspect ratio answers
 * a question nobody asked.
 */
export function fitToPaper(px: number, py: number, paper: Paper, landscape: boolean): Fit {
  const pw = (landscape ? paper.h : paper.w) / 10
  const ph = (landscape ? paper.w : paper.h) / 10
  if (px <= 0 || py <= 0) return { ppi: 0, wCm: 0, hCm: 0, letterboxed: false }

  const scale = Math.min(pw / px, ph / py)
  const wCm = px * scale
  const hCm = py * scale
  return {
    ppi: ppiAcross(px, wCm),
    wCm,
    hCm,
    // More than 2% of either dimension left over is a margin somebody will see.
    letterboxed: (pw - wCm) / pw > 0.02 || (ph - hCm) / ph > 0.02,
  }
}

export type Verdict = 'plenty' | 'enough' | 'short'

/**
 * Whether the density is enough for the distance — with a band rather than a
 * cliff, because acuity varies between people and a hard pass/fail on a number
 * that is itself an average would be false precision.
 */
export function verdict(ppi: number, needed: number): Verdict {
  if (ppi >= needed) return 'plenty'
  if (ppi >= needed * 0.6) return 'enough'
  return 'short'
}

/** The largest print, in cm, that still meets `needed` PPI. */
export const maxCm = (px: number, needed: number) => cmAt(px, needed)
