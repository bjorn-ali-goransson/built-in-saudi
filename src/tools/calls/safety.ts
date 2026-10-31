// A short code two people in a call can read to each other to know nobody is in
// the middle.
//
// The media and the data channel are encrypted with DTLS, keyed by a certificate
// each browser makes for itself and announces in its SDP as `a=fingerprint`. The
// SDP travels through our relay, so a relay that wanted to listen could swap both
// fingerprints for its own and sit between the two — and each side would still
// see an encrypted, working call. What it cannot do is make the two sides agree
// on the PAIR: each would see the relay's certificate where the other's should
// be. So the code is a hash of both fingerprints, in an order both sides agree
// on, and two people reading the same digits aloud have ruled the relay out.
//
// Pure, so it is unit-tested without a call.

/** The certificate fingerprint an SDP announces, normalised; null if none. */
export function fingerprintOf(sdp: string | undefined | null): string | null {
  const m = /^a=fingerprint:(\S+) ([0-9A-Fa-f:]+)\s*$/m.exec(sdp || '')
  return m ? `${m[1].toLowerCase()} ${m[2].toUpperCase()}` : null
}

/** Four groups of four digits, the same on both ends. */
export async function safetyCode(fpA: string, fpB: string): Promise<string> {
  const [x, y] = [fpA, fpB].sort()
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`sk-call|${x}|${y}`)))
  const groups: string[] = []
  for (let i = 0; i < 4; i++) {
    const n = ((h[i * 4] << 24) | (h[i * 4 + 1] << 16) | (h[i * 4 + 2] << 8) | h[i * 4 + 3]) >>> 0
    groups.push(String(n % 10000).padStart(4, '0'))
  }
  return groups.join(' ')
}
