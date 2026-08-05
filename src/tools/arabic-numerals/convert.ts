// Digit-shape conversion. Three scripts share the same values 0–9 but different
// code points, and Arabic text routinely mixes them — a document typed in Word
// on a Windows Arabic locale comes out in Arabic-Indic, while anything a system
// generated comes out Western.
export type Script = 'western' | 'arabic' | 'persian'

const SETS: Record<Script, string> = {
  western: '0123456789',
  arabic: '٠١٢٣٤٥٦٧٨٩', // U+0660 Arabic-Indic
  persian: '۰۱۲۳۴۵۶۷۸۹', // U+06F0 Extended Arabic-Indic (Persian/Urdu)
}

// The separators travel with the digits: a number written ١٢٣٤٫٥ is unreadable
// if the digits flip to Western but the decimal mark stays U+066B.
const SEPS: Record<Script, { dec: string; group: string }> = {
  western: { dec: '.', group: ',' },
  arabic: { dec: '٫', group: '٬' },
  persian: { dec: '٫', group: '٬' },
}

const ALL_DIGITS = SETS.western + SETS.arabic + SETS.persian

/** Which digit scripts appear in the text, in the order western/arabic/persian. */
export function detect(text: string): Script[] {
  const found: Script[] = []
  for (const s of ['western', 'arabic', 'persian'] as Script[]) {
    if ([...SETS[s]].some((d) => text.includes(d))) found.push(s)
  }
  return found
}

export function countDigits(text: string): number {
  let n = 0
  for (const ch of text) if (ALL_DIGITS.includes(ch)) n++
  return n
}

/**
 * Rewrite every digit (and, when `separators`, the decimal/thousands marks) into
 * `to`. Non-digit characters are passed through untouched, so this is safe on a
 * whole document rather than just a bare number.
 */
export function convert(text: string, to: Script, separators = true): string {
  const target = SETS[to]
  const sep = SEPS[to]
  const chars = [...text]
  const isDigit = (c: string | undefined) => !!c && ALL_DIGITS.includes(c)
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const idx = ALL_DIGITS.indexOf(ch)
    if (idx >= 0) { out += target[idx % 10]; continue }
    // Only rewrite a separator sitting BETWEEN two digits — otherwise the full
    // stop ending a sentence would silently become U+066B.
    if (separators && isDigit(chars[i - 1]) && isDigit(chars[i + 1])) {
      if (ch === '.' || ch === '٫') { out += sep.dec; continue }
      if (ch === ',' || ch === '٬') { out += sep.group; continue }
    }
    out += ch
  }
  return out
}

/** The other script, for the one-click "flip" default: whatever is dominant goes. */
export function suggestTarget(text: string): Script {
  const found = detect(text)
  if (found.length === 0) return 'arabic'
  if (found.includes('western') && found.length === 1) return 'arabic'
  return 'western'
}
