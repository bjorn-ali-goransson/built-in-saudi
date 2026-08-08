// The shared detectors for "what does a CV actually contain".
//
// These were duplicated in quantified.mjs and roles.mjs. That was fine while
// each answered its own question, and stopped being fine the moment a third
// harness needed to JOIN them — a role counted by one rule and a figure counted
// by a slightly different one produce a ratio that is not a ratio of anything.
//
// Extracted verbatim, and both original harnesses were re-run afterwards to
// confirm they print byte-identical output. A refactor of a measurement tool
// that changes the measurement is not a refactor.

/** A date range: "Mar 2021 – Present", "2019 - 2021", "01/2019 – 03/2021". */
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*'
export const RANGE = new RegExp(
  `(?:${MONTH}\\s*\\.?\\s*)?(?:\\d{1,2}[/.])?(?:19|20)\\d{2}\\s*(?:[-–—]|to|until|till)\\s*` +
  `(?:(?:${MONTH}\\s*\\.?\\s*)?(?:\\d{1,2}[/.])?(?:19|20)\\d{2}|present|current|now|date)`,
  'gi',
)

/**
 * Education entries carry date ranges too, and asking a graduate for a headline
 * number about a degree is not the point — so lines that look like study are
 * excluded rather than inflating the count.
 */
export const STUDY = /bachelor|master|b\.?sc|m\.?sc|ph\.?d|diploma|university|college|institute|degree|high school|جامعة|بكالوريوس|ماجستير|دبلوم/i

/** Is this line the start of a dated, non-study position? */
export function isRoleLine(line) {
  RANGE.lastIndex = 0
  if (!RANGE.test(line)) return false
  return !STUDY.test(line)
}

/** A line long enough to be a claim rather than a label or a heading. */
export function isClaim(line) {
  const t = line.trim()
  if (t.length < 30) return false
  if (/^[A-Z][A-Z\s&/-]{4,}$/.test(t)) return false          // SECTION HEADING
  if (/^\S+@\S+$/.test(t)) return false                       // an email on its own
  if (/^(\+?\d[\d\s()-]{6,})$/.test(t)) return false          // a phone number
  return true
}

/**
 * Does this line carry a figure that means something?
 *
 * Excluded on purpose: a bare four-digit year, and a date range — both are
 * everywhere in a CV and neither is an achievement, so counting them would
 * report a number three times too high and flatter the corpus.
 */
export function hasFigure(line) {
  const t = line
    .replace(/\b(19|20)\d{2}\s*[-–—]\s*((19|20)\d{2}|present|current)\b/gi, ' ')  // date ranges
    .replace(/\b(19|20)\d{2}\b/g, ' ')                                            // bare years
    .replace(/\+?\d[\d\s()-]{7,}/g, ' ')                                          // phone-like runs
  if (/\d\s*%/.test(t)) return true
  if (/\b(sar|usd|eur|gbp|aed|\$|€|£)\s*\d/i.test(t) || /\d\s*(sar|usd|aed|million|billion|k\b|m\b)/i.test(t)) return true
  // A number next to a countable noun: "6 analysts", "200 tickets", "3 teams".
  if (/\b\d[\d,.]*\s*\+?\s*[a-z]{3,}/i.test(t)) return true
  return false
}
