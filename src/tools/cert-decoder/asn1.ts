// Just enough ASN.1 DER to read a certificate.
//
// A parser is the right answer here rather than a library: DER is
// tag-length-value all the way down, the subset X.509 uses is small, and
// `crypto.subtle` — which can verify a signature — cannot tell you a single
// thing about what is inside a certificate.
//
// The one place this bites people is the length encoding: a length byte under
// 0x80 is the length, and 0x80-or-above means "the next N bytes are the length".
// Reading the first form everywhere works on small certificates and silently
// mangles any certificate with a SAN list longer than 127 bytes, which is most
// real ones.

export interface Node {
  /** Raw tag byte. */
  tag: number
  /** Tag number without class/constructed bits. */
  num: number
  constructed: boolean
  cls: number
  /** Contents, excluding the header. */
  value: Uint8Array
  children: Node[]
  /** Offset of the whole element in the source, for slicing signed regions. */
  start: number
  end: number
}

export const TAG = {
  BOOLEAN: 0x01, INTEGER: 0x02, BIT_STRING: 0x03, OCTET_STRING: 0x04, NULL: 0x05,
  OID: 0x06, UTF8: 0x0c, SEQUENCE: 0x10, SET: 0x11, PRINTABLE: 0x13, IA5: 0x16,
  UTC_TIME: 0x17, GEN_TIME: 0x18, BMP: 0x1e,
} as const

export function parseDer(bytes: Uint8Array, start = 0, end = bytes.length): Node[] {
  const out: Node[] = []
  let i = start
  while (i < end) {
    const elStart = i
    const tag = bytes[i++]
    if (tag === undefined) break
    let len = bytes[i++]
    if (len === undefined) break
    if (len & 0x80) {
      const n = len & 0x7f
      // Indefinite length is legal in BER and forbidden in DER; a certificate
      // using it is malformed, and guessing at where it ends is worse than
      // stopping.
      if (n === 0 || n > 4) break
      len = 0
      for (let k = 0; k < n; k++) len = (len << 8) | bytes[i++]
    }
    if (i + len > end) break
    const value = bytes.subarray(i, i + len)
    const constructed = (tag & 0x20) !== 0
    const node: Node = {
      tag, num: tag & 0x1f, constructed, cls: tag >> 6,
      value, children: [], start: elStart, end: i + len,
    }
    if (constructed) node.children = parseDer(bytes, i, i + len)
    out.push(node)
    i += len
  }
  return out
}

/** Dotted OID from its DER contents. */
export function oidToString(v: Uint8Array): string {
  if (!v.length) return ''
  const parts = [Math.floor(v[0] / 40), v[0] % 40]
  let acc = 0
  for (let i = 1; i < v.length; i++) {
    acc = acc * 128 + (v[i] & 0x7f)
    if (!(v[i] & 0x80)) { parts.push(acc); acc = 0 }
  }
  return parts.join('.')
}

const dec = new TextDecoder()
export function derString(n: Node): string {
  if (n.num === TAG.BMP) {
    // BMPString is UTF-16BE; decoding it as UTF-8 turns a name into nulls.
    let s = ''
    for (let i = 0; i + 1 < n.value.length; i += 2) s += String.fromCharCode((n.value[i] << 8) | n.value[i + 1])
    return s
  }
  return dec.decode(n.value)
}

/**
 * UTCTime is two-digit years, and the rule is fixed by RFC 5280: 50–99 means
 * 19xx, 00–49 means 20xx. Treating "30" as 1930 expires every modern
 * certificate ninety years ago.
 */
export function derTime(n: Node): Date | null {
  const s = dec.decode(n.value).trim()
  const m = n.num === TAG.UTC_TIME
    ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/.exec(s)
    : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/.exec(s)
  if (!m) return null
  let year = Number(m[1])
  if (n.num === TAG.UTC_TIME) year += year >= 50 ? 1900 : 2000
  const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)))
  return isNaN(d.getTime()) ? null : d
}

export const hex = (v: Uint8Array, sep = '') =>
  [...v].map((b) => b.toString(16).padStart(2, '0')).join(sep).toUpperCase()

/** PEM (or bare base64) → DER bytes. Returns null when there is nothing to read. */
export function pemToDer(text: string): Uint8Array | null {
  const body = /-----BEGIN [^-]+-----([\s\S]*?)-----END [^-]+-----/.exec(text)
  const b64 = (body ? body[1] : text).replace(/\s+/g, '')
  if (!b64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return null
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out.length ? out : null
  } catch { return null }
}
