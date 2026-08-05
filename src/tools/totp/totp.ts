// RFC 6238 TOTP, on Web Crypto. The whole point of this tool is that a secret
// never leaves the page — so there is no library, no network, and nothing is
// written to storage unless the user explicitly asks for it.

export type Algo = 'SHA-1' | 'SHA-256' | 'SHA-512'

export interface Account {
  id: string
  label: string
  issuer: string
  secret: string   // base32, as printed by the service
  algo: Algo
  digits: number
  period: number
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Decode base32 (RFC 4648, no padding required — services print it both ways). */
export function base32Decode(input: string): Uint8Array | null {
  const clean = input.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase()
  if (!clean || /[^A-Z2-7]/.test(clean)) return null
  const bytes: number[] = []
  let bits = 0, value = 0
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(bytes)
}

export function isValidSecret(secret: string): boolean {
  const b = base32Decode(secret)
  return !!b && b.length > 0
}

/** The 8-byte big-endian counter RFC 4226 hashes. */
function counterBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(8)
  // Split rather than using BigInt shifts so this stays readable; counters are
  // well under 2^53 for any real period.
  let hi = Math.floor(counter / 0x100000000)
  let lo = counter >>> 0
  for (let i = 7; i >= 4; i--) { buf[i] = lo & 0xff; lo = lo >>> 8 }
  for (let i = 3; i >= 0; i--) { buf[i] = hi & 0xff; hi = Math.floor(hi / 256) }
  return buf
}

export async function hotp(secret: string, counter: number, algo: Algo, digits: number): Promise<string | null> {
  const keyBytes = base32Decode(secret)
  if (!keyBytes || keyBytes.length === 0) return null
  const key = await crypto.subtle.importKey(
    'raw', keyBytes as unknown as BufferSource, { name: 'HMAC', hash: algo }, false, ['sign'],
  )
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, counterBytes(counter) as unknown as BufferSource),
  )
  // Dynamic truncation (RFC 4226 §5.3).
  const offset = mac[mac.length - 1] & 0x0f
  const bin =
    ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

export function totpCounter(period: number, now = Date.now()): number {
  return Math.floor(now / 1000 / period)
}

export async function totp(a: Pick<Account, 'secret' | 'algo' | 'digits' | 'period'>, now = Date.now()): Promise<string | null> {
  return hotp(a.secret, totpCounter(a.period, now), a.algo, a.digits)
}

/** Seconds until the current code rolls over. */
export function secondsLeft(period: number, now = Date.now()): number {
  return period - Math.floor(now / 1000) % period
}

/**
 * Parse an otpauth:// URI — what the QR code on a 2FA setup page actually
 * contains, so pairing this with the QR reader means never typing a secret.
 */
export function parseOtpauth(uri: string): Omit<Account, 'id'> | null {
  let u: URL
  try { u = new URL(uri.trim()) } catch { return null }
  if (u.protocol !== 'otpauth:') return null
  if (u.host.toLowerCase() !== 'totp') return null
  const secret = u.searchParams.get('secret') || ''
  if (!isValidSecret(secret)) return null

  // The path is "/Issuer:account" or just "/account"; the issuer= param wins.
  const path = decodeURIComponent(u.pathname.replace(/^\//, ''))
  const colon = path.indexOf(':')
  const pathIssuer = colon > 0 ? path.slice(0, colon) : ''
  const label = (colon > 0 ? path.slice(colon + 1) : path).trim()

  const rawAlgo = (u.searchParams.get('algorithm') || 'SHA1').toUpperCase()
  const algo: Algo = rawAlgo === 'SHA256' ? 'SHA-256' : rawAlgo === 'SHA512' ? 'SHA-512' : 'SHA-1'
  const digits = Number(u.searchParams.get('digits')) || 6
  const period = Number(u.searchParams.get('period')) || 30

  return {
    label: label || 'Account',
    issuer: u.searchParams.get('issuer') || pathIssuer,
    secret,
    algo,
    digits: digits === 8 ? 8 : 6,
    period: period > 0 && period <= 300 ? period : 30,
  }
}

export const STORE_KEY = 'bis-totp'

export function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as Account[]).filter((a) => a && a.secret) : []
  } catch { return [] }
}

export function saveAccounts(list: Account[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)) } catch { /* non-fatal */ }
}

export function newId(): string {
  return `a${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}
