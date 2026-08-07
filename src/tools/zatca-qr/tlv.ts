// Reading the QR on a Saudi e-invoice.
//
// Since e-invoicing became mandatory, every compliant receipt in the country
// carries a QR holding the invoice's key facts. The encoding is TLV — a
// one-byte tag, a one-byte length, then that many BYTES of value — with the
// whole run base64'd.
//
// **The length is in bytes, not characters.** An Arabic seller name is two
// bytes per letter in UTF-8, so any decoder that slices by character position
// reads the right number of characters and lands in the middle of the next
// field, then reports garbage for everything after it. That is the single trap
// in this format and it only shows up on Arabic invoices — which is to say, on
// almost all of them.
//
// What this does NOT do, and says so in the UI: verifying that an invoice is
// genuine. Tags 6–9 carry a hash and an ECDSA signature, and checking those
// needs ZATCA's certificate chain. Decoding tells you what the invoice CLAIMS.

export interface Field { tag: number; name: string; value: string; bytes: number }

export interface Invoice {
  sellerName: string
  vatNumber: string
  timestamp: string
  total: string
  vat: string
  /** Phase 2 fields are present on a cryptographically stamped invoice. */
  hasSignature: boolean
  fields: Field[]
  /** Anything that does not add up, stated plainly. */
  notes: NoteKey[]
}

export type NoteKey =
  | 'bad-vat-number' | 'bad-timestamp' | 'bad-total' | 'vat-rate-off'
  | 'phase-1' | 'phase-2' | 'trailing-bytes'

const TAG_NAMES: Record<number, string> = {
  1: 'sellerName', 2: 'vatNumber', 3: 'timestamp', 4: 'total', 5: 'vat',
  6: 'xmlHash', 7: 'signature', 8: 'publicKey', 9: 'stampSignature',
}

export function base64ToBytes(input: string): Uint8Array | null {
  const clean = input.trim().replace(/\s+/g, '')
  if (!clean || !/^[A-Za-z0-9+/=_-]+$/.test(clean)) return null
  try {
    const b64 = clean.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch { return null }
}

/** Walk the tag-length-value run. Returns null when it is not TLV at all. */
export function parseTlv(bytes: Uint8Array): { fields: Field[]; trailing: number } | null {
  const fields: Field[] = []
  const dec = new TextDecoder('utf-8')
  let i = 0
  while (i + 2 <= bytes.length) {
    const tag = bytes[i]
    const len = bytes[i + 1]
    // A tag outside 1–9 means we are not reading a ZATCA QR, or we have lost
    // our place — either way, stop rather than emit nonsense.
    if (tag < 1 || tag > 9) return fields.length ? { fields, trailing: bytes.length - i } : null
    if (i + 2 + len > bytes.length) return fields.length ? { fields, trailing: bytes.length - i } : null
    const value = bytes.subarray(i + 2, i + 2 + len)
    fields.push({
      tag,
      name: TAG_NAMES[tag] ?? String(tag),
      // Tags 6–9 are binary; showing them as base64 is the only readable form.
      value: tag >= 6 ? btoa(String.fromCharCode(...value)) : dec.decode(value),
      bytes: len,
    })
    i += 2 + len
  }
  return fields.length ? { fields, trailing: bytes.length - i } : null
}

/** A Saudi VAT registration number: 15 digits, first and last both 3. */
export const looksLikeVatNumber = (v: string) => /^3\d{13}3$/.test(v.trim())

export const STANDARD_VAT_RATE = 0.15

export function parseInvoice(payload: string): Invoice | null {
  const bytes = base64ToBytes(payload)
  if (!bytes) return null
  const parsed = parseTlv(bytes)
  if (!parsed) return null

  const get = (tag: number) => parsed.fields.find((f) => f.tag === tag)?.value ?? ''
  const total = get(4)
  const vat = get(5)
  const notes: NoteKey[] = []

  const hasSignature = parsed.fields.some((f) => f.tag >= 6)
  notes.push(hasSignature ? 'phase-2' : 'phase-1')

  if (get(2) && !looksLikeVatNumber(get(2))) notes.push('bad-vat-number')
  if (get(3) && isNaN(new Date(get(3)).getTime())) notes.push('bad-timestamp')

  const totalNum = Number(total)
  const vatNum = Number(vat)
  if (total && !isFinite(totalNum)) notes.push('bad-total')
  else if (total && vat && isFinite(vatNum) && totalNum > 0) {
    // The total INCLUDES VAT, so the net is total - vat and the rate is
    // vat / net. Worth checking: a receipt whose arithmetic does not produce
    // 15% is either not a standard-rated sale or is wrong, and either way the
    // person holding it would like to know.
    const net = totalNum - vatNum
    const rate = net > 0 ? vatNum / net : NaN
    if (!isFinite(rate) || Math.abs(rate - STANDARD_VAT_RATE) > 0.005) notes.push('vat-rate-off')
  }
  if (parsed.trailing > 0) notes.push('trailing-bytes')

  return {
    sellerName: get(1),
    vatNumber: get(2),
    timestamp: get(3),
    total,
    vat,
    hasSignature,
    fields: parsed.fields,
    notes,
  }
}

/** The implied VAT rate, for display. */
export function impliedRate(total: string, vat: string): number | null {
  const t = Number(total)
  const v = Number(vat)
  if (!isFinite(t) || !isFinite(v) || t - v <= 0) return null
  return v / (t - v)
}
