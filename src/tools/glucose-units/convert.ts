// Blood glucose and HbA1c conversions.
//
// Saudi labs and meters report glucose in mg/dL; most of Europe and every
// research paper uses mmol/L. Someone managing diabetes across the two ends up
// converting constantly, and getting it wrong by the factor of 18 is not a
// rounding error — it is the difference between hypoglycaemia and hyperglycaemia.

/** Molar mass of glucose: 1 mmol/L = 18.0182 mg/dL. */
export const GLUCOSE_FACTOR = 18.0182

export const toMgdl = (mmol: number) => mmol * GLUCOSE_FACTOR
export const toMmol = (mgdl: number) => mgdl / GLUCOSE_FACTOR

// HbA1c: the IFCC (mmol/mol) and NGSP (%) scales, per the master equation.
export const a1cPercentToMmolMol = (pct: number) => (pct - 2.15) * 10.929
export const a1cMmolMolToPercent = (mmol: number) => mmol / 10.929 + 2.15

/**
 * Estimated average glucose from HbA1c — the ADAG study regression, which is
 * what "your A1c of 7% is about 154 mg/dL" comes from. It is a population
 * average: individual red-cell lifespan shifts it, which is why this is an
 * estimate and labelled as one.
 */
export const eagMgdl = (a1cPercent: number) => 28.7 * a1cPercent - 46.7
export const eagMmol = (a1cPercent: number) => toMmol(eagMgdl(a1cPercent))

export type Band = 'low' | 'normal' | 'prediabetes' | 'diabetes' | 'high'

export interface Context { id: 'fasting' | 'random' | 'postMeal'; en: string; ar: string }

export const CONTEXTS: Context[] = [
  { id: 'fasting', en: 'Fasting (8+ hours)', ar: 'صائم (٨ ساعات فأكثر)' },
  { id: 'postMeal', en: '2 hours after a meal', ar: 'بعد ساعتين من الأكل' },
  { id: 'random', en: 'Any time', ar: 'في أي وقت' },
]

/**
 * Reference bands, in mg/dL, following the widely-published diagnostic
 * thresholds. These describe where a reading sits — they do not diagnose
 * anything, which takes a repeat test and a doctor.
 */
export function band(mgdl: number, context: Context['id']): Band {
  if (mgdl < 70) return 'low'
  if (context === 'fasting') {
    if (mgdl < 100) return 'normal'
    if (mgdl < 126) return 'prediabetes'
    return 'diabetes'
  }
  if (context === 'postMeal') {
    if (mgdl < 140) return 'normal'
    if (mgdl < 200) return 'prediabetes'
    return 'diabetes'
  }
  if (mgdl < 140) return 'normal'
  if (mgdl < 200) return 'prediabetes'
  return 'diabetes'
}

export function a1cBand(pct: number): Band {
  if (pct < 5.7) return 'normal'
  if (pct < 6.5) return 'prediabetes'
  return 'diabetes'
}

export const BAND_LABEL: Record<Band, { en: string; ar: string }> = {
  low: { en: 'Below the usual range', ar: 'أقل من المعتاد' },
  normal: { en: 'In the usual range', ar: 'ضمن المعتاد' },
  prediabetes: { en: 'In the prediabetes range', ar: 'في نطاق ما قبل السكري' },
  diabetes: { en: 'In the diabetes range', ar: 'في نطاق السكري' },
  high: { en: 'Well above the usual range', ar: 'أعلى بكثير من المعتاد' },
}

export const BAND_TONE: Record<Band, string> = {
  low: 'text-gold-500',
  normal: 'text-green-700',
  prediabetes: 'text-gold-500',
  diabetes: 'text-gold-500',
  high: 'text-gold-500',
}

/** A reading low enough that it needs acting on now, not reading about. */
export function isUrgentLow(mgdl: number): boolean {
  return mgdl > 0 && mgdl < 54
}
export function isUrgentHigh(mgdl: number): boolean {
  return mgdl >= 300
}
