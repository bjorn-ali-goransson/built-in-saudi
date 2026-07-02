// Cryptographically-secure password + passphrase generation. Uses
// crypto.getRandomValues with rejection sampling for an unbiased distribution.

export const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
}
const AMBIGUOUS = new Set('Il1O0o'.split(''))

export interface PwOptions {
  length: number
  lower: boolean
  upper: boolean
  digits: boolean
  symbols: boolean
  excludeAmbiguous: boolean
}

/** Unbiased random integer in [0, max) via rejection sampling. */
function randInt(max: number): number {
  const limit = Math.floor(0xffffffff / max) * max
  const buf = new Uint32Array(1)
  let x = 0
  do { crypto.getRandomValues(buf); x = buf[0] } while (x >= limit)
  return x % max
}

function pick(chars: string): string {
  return chars[randInt(chars.length)]
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function clean(set: string, excludeAmbiguous: boolean): string {
  return excludeAmbiguous ? [...set].filter((c) => !AMBIGUOUS.has(c)).join('') : set
}

export function generatePassword(o: PwOptions): string {
  const active = (['lower', 'upper', 'digits', 'symbols'] as const)
    .filter((k) => o[k])
    .map((k) => clean(SETS[k], o.excludeAmbiguous))
    .filter((s) => s.length > 0)
  if (active.length === 0) return ''

  const pool = active.join('')
  const len = Math.max(o.length, active.length)
  // Guarantee at least one char from each active set, then fill from the pool.
  const chars = active.map((s) => pick(s))
  while (chars.length < len) chars.push(pick(pool))
  return shuffle(chars).join('')
}

/** Shannon entropy (bits) for a random password over a character pool. */
export function passwordEntropy(o: PwOptions): number {
  const pool = (['lower', 'upper', 'digits', 'symbols'] as const)
    .filter((k) => o[k])
    .map((k) => clean(SETS[k], o.excludeAmbiguous).length)
    .reduce((a, b) => a + b, 0)
  return pool > 0 ? Math.round(o.length * Math.log2(pool)) : 0
}

export interface PhraseOptions {
  words: number
  separator: string
  capitalize: boolean
  number: boolean
}

export function generatePassphrase(o: PhraseOptions, list: string[]): string {
  const parts: string[] = []
  for (let i = 0; i < o.words; i++) {
    let w = list[randInt(list.length)]
    if (o.capitalize) w = w[0].toUpperCase() + w.slice(1)
    parts.push(w)
  }
  let out = parts.join(o.separator)
  if (o.number) out += o.separator + randInt(100)
  return out
}

export function phraseEntropy(o: PhraseOptions, listSize: number): number {
  let bits = o.words * Math.log2(listSize)
  if (o.number) bits += Math.log2(100)
  return Math.round(bits)
}

export type Strength = 'weak' | 'fair' | 'strong' | 'excellent'
export function strength(bits: number): Strength {
  if (bits < 40) return 'weak'
  if (bits < 60) return 'fair'
  if (bits < 90) return 'strong'
  return 'excellent'
}
