// Saudi vehicle plates.
//
// A plate carries the same three letters and four digits TWICE: once in Arabic
// and once in Latin. They are not a transliteration — they are a fixed code
// table. Only 17 Arabic letters are used, chosen because each could be given a
// unique single Latin character that would not be confused at a border crossing
// or in an international police database. That is why ح is J and م is Z: the
// obvious letters were already taken, and uniqueness mattered more than
// intuition.
//
// The other half of the job is the ORDER. Arabic reads right-to-left, so the
// letters appear mirrored between the two halves of the plate, and the digits
// are written in Arabic-Indic on one side and Western on the other. Reading a
// plate off a photo and typing it into a form is exactly where this goes wrong.

export interface Letter { ar: string; la: string; name: string }

export const LETTERS: Letter[] = [
  { ar: 'ا', la: 'A', name: 'alef' },
  { ar: 'ب', la: 'B', name: 'baa' },
  { ar: 'ح', la: 'J', name: 'haa' },
  { ar: 'د', la: 'D', name: 'dal' },
  { ar: 'ر', la: 'R', name: 'raa' },
  { ar: 'س', la: 'S', name: 'seen' },
  { ar: 'ص', la: 'X', name: 'sad' },
  { ar: 'ط', la: 'T', name: 'taa' },
  { ar: 'ع', la: 'E', name: 'ain' },
  { ar: 'ق', la: 'G', name: 'qaf' },
  { ar: 'ك', la: 'K', name: 'kaf' },
  { ar: 'ل', la: 'L', name: 'lam' },
  { ar: 'م', la: 'Z', name: 'meem' },
  { ar: 'ن', la: 'N', name: 'noon' },
  { ar: 'ه', la: 'H', name: 'haa' },
  { ar: 'و', la: 'U', name: 'waw' },
  { ar: 'ى', la: 'V', name: 'yaa' },
]

const AR_TO_LA = new Map(LETTERS.map((l) => [l.ar, l.la]))
const LA_TO_AR = new Map(LETTERS.map((l) => [l.la, l.ar]))
// Alternate forms people actually type: ه vs ة, ى vs ي vs ی.
const NORMALISE_AR: Record<string, string> = { 'ة': 'ه', 'ي': 'ى', 'ی': 'ى', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا' }

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export const toWesternDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
export const toArabicDigits = (s: string) =>
  s.replace(/\d/g, (d) => AR_DIGITS[Number(d)])

export interface Plate {
  letters: string[]      // Latin, in reading order
  digits: string         // Western, 1–4 characters
  valid: boolean
  problems: string[]
}

export type Problem =
  | 'no-letters' | 'no-digits' | 'too-many-letters' | 'too-many-digits'
  | 'unknown-letter' | 'ok'

/**
 * Read a plate from whatever someone typed: either script, either digit set,
 * in either order, with or without separators.
 */
export function parsePlate(input: string): Plate {
  const problems: string[] = []
  const text = toWesternDigits(input.trim())

  const letters: string[] = []
  const digits: string[] = []
  const unknown: string[] = []

  for (const raw of text) {
    if (/\d/.test(raw)) { digits.push(raw); continue }
    if (/\s|[-–—/·.]/.test(raw)) continue
    const ch = NORMALISE_AR[raw] ?? raw
    if (AR_TO_LA.has(ch)) { letters.push(AR_TO_LA.get(ch)!); continue }
    const upper = ch.toUpperCase()
    if (LA_TO_AR.has(upper)) { letters.push(upper); continue }
    // A letter that exists in neither table — either Arabic that plates do not
    // use, or a Latin letter with no plate equivalent.
    if (/[A-Za-z؀-ۿ]/.test(ch)) unknown.push(raw)
  }

  if (unknown.length) problems.push('unknown-letter:' + [...new Set(unknown)].join(''))
  if (!letters.length) problems.push('no-letters')
  if (!digits.length) problems.push('no-digits')
  if (letters.length > 3) problems.push('too-many-letters')
  if (digits.length > 4) problems.push('too-many-digits')

  return {
    letters: letters.slice(0, 3),
    digits: digits.slice(0, 4).join(''),
    valid: problems.length === 0,
    problems,
  }
}

export interface Rendered {
  latin: string
  arabic: string
  /** Letters as they physically appear on the Arabic half — mirrored. */
  arabicLetters: string
  arabicDigits: string
}

export function renderPlate(p: Plate): Rendered {
  const latinLetters = p.letters.join(' ')
  const arabic = p.letters.map((l) => LA_TO_AR.get(l) ?? l)
  return {
    latin: `${latinLetters} ${p.digits}`.trim(),
    // Arabic reads right-to-left, so the same letters appear in the opposite
    // order on that half of the plate. Printing them in Latin order is the
    // single most common mistake in a form that accepts both.
    arabic: `${[...arabic].reverse().join(' ')} ${toArabicDigits(p.digits)}`.trim(),
    arabicLetters: [...arabic].reverse().join(' '),
    arabicDigits: toArabicDigits(p.digits),
  }
}

/** Look up one letter either way, for the reference table. */
export function findLetter(query: string): Letter | null {
  const q = query.trim()
  if (!q) return null
  const ar = NORMALISE_AR[q] ?? q
  return LETTERS.find((l) => l.ar === ar || l.la === q.toUpperCase()) ?? null
}
