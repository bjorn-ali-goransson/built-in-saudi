// Mojibake repair. The damage is always the same shape: bytes that were UTF-8
// got decoded as a single-byte codepage, so every non-ASCII character became a
// short run of Latin-1/CP1252 lookalikes ("العربية" → "Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©").
// The fix is to undo the wrong decode — re-encode the text with that codepage
// and read the bytes back as UTF-8.

/** Codepages a UTF-8 stream is most often misread as. */
export const CODEPAGES = ['windows-1252', 'windows-1256', 'iso-8859-1', 'windows-1251'] as const
export type Codepage = (typeof CODEPAGES)[number]

// CP1252 maps 0x80–0x9F to real characters where Latin-1 has controls. Encoding
// back therefore needs the same table, and TextEncoder only speaks UTF-8 — so we
// carry an explicit reverse map for those 32 slots.
const CP1252_HIGH: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91,
  '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}

/** Turn text back into the bytes it would have been in `cp`; null if it can't be. */
function toBytes(text: string, cp: Codepage): Uint8Array | null {
  // For the Latin single-byte pages, code point == byte for 0x00–0xFF.
  if (cp === 'windows-1252' || cp === 'iso-8859-1') {
    const out = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      const code = ch.charCodeAt(0)
      if (code <= 0xff) { out[i] = code; continue }
      const mapped = cp === 'windows-1252' ? CP1252_HIGH[ch] : undefined
      if (mapped === undefined) return null
      out[i] = mapped
    }
    return out
  }
  // The Cyrillic/Arabic pages need a real reverse table, built once by decoding
  // every byte 0x00–0xFF through the browser's own decoder for that page.
  const rev = reverseTable(cp)
  if (!rev) return null
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const b = rev.get(text[i])
    if (b === undefined) return null
    out[i] = b
  }
  return out
}

const revCache = new Map<Codepage, Map<string, number> | null>()
function reverseTable(cp: Codepage): Map<string, number> | null {
  if (revCache.has(cp)) return revCache.get(cp)!
  let table: Map<string, number> | null = null
  try {
    const dec = new TextDecoder(cp, { fatal: false })
    table = new Map()
    const buf = new Uint8Array(1)
    for (let b = 0; b <= 0xff; b++) {
      buf[0] = b
      const ch = dec.decode(buf)
      // First byte wins, so ASCII and real mappings beat the replacement char.
      if (ch && ch !== '�' && !table.has(ch)) table.set(ch, b)
    }
  } catch { table = null }
  revCache.set(cp, table)
  return table
}

const utf8 = new TextDecoder('utf-8', { fatal: true })

/** Undo one wrong-codepage decode. Returns null when the text isn't valid UTF-8 underneath. */
export function repairOnce(text: string, cp: Codepage): string | null {
  const bytes = toBytes(text, cp)
  if (!bytes) return null
  try { return utf8.decode(bytes) } catch { return null }
}

// Characters that only show up when a UTF-8 lead byte was misread. Their presence
// is the signal that text is damaged rather than merely accented.
const SUSPECT = /[ÃÂÐÑØÙÚÛÅÆÇÈÉÊË][-¿ -›Œ-ž€ƒ]|â€|Ã¢|Ð|Ø§|Ù„/

export function looksDamaged(text: string): boolean {
  return SUSPECT.test(text)
}

export interface Attempt { cp: Codepage; text: string; rounds: number; score: number }

/**
 * Score a candidate repair. Higher is better: real letters (Arabic, Latin,
 * Cyrillic, CJK) are good, leftover mojibake markers and replacement characters
 * are bad. Used to pick between codepages without asking the user to guess.
 */
export function score(text: string): number {
  let good = 0, bad = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c === 0xfffd) { bad += 5; continue }
    if (c < 0x80) { good += 0.2; continue }                    // ASCII: weak signal
    if (c >= 0x600 && c <= 0x6ff) { good += 2; continue }      // Arabic
    if (c >= 0x400 && c <= 0x4ff) { good += 2; continue }      // Cyrillic
    if (c >= 0x4e00 && c <= 0x9fff) { good += 2; continue }    // CJK
    if (c >= 0xc0 && c <= 0x24f) { good += 1; continue }       // accented Latin
    if (c >= 0x80 && c <= 0xbf) { bad += 2; continue }         // stray continuation-range
    bad += 1
  }
  return good - bad
}

/**
 * Try every codepage, repeatedly (double-encoded text is common — a file that
 * went through the same broken pipeline twice needs two passes), and return the
 * candidates that scored better than the input, best first.
 */
export function repair(text: string, maxRounds = 3): Attempt[] {
  const base = score(text)
  const out: Attempt[] = []
  for (const cp of CODEPAGES) {
    let cur = text
    for (let r = 1; r <= maxRounds; r++) {
      const next = repairOnce(cur, cp)
      if (next === null || next === cur) break
      cur = next
      const sc = score(cur)
      if (sc > base) out.push({ cp, text: cur, rounds: r, score: sc })
    }
  }
  // Best score wins; on a tie prefer the fewest rounds, then a stable cp order.
  out.sort((a, b) => b.score - a.score || a.rounds - b.rounds || CODEPAGES.indexOf(a.cp) - CODEPAGES.indexOf(b.cp))
  // Drop duplicates that different codepages arrived at.
  const seen = new Set<string>()
  return out.filter((a) => (seen.has(a.text) ? false : (seen.add(a.text), true)))
}
