// End-to-end encryption for what Messages sends THROUGH our server.
//
// A peer-to-peer message is already encrypted by WebRTC (DTLS) and never touches
// a server. The other road — a Web Push while the recipient's app is closed —
// does pass through our relay and the browser vendor's push service. So every
// envelope that takes that road is sealed with a key only the two devices hold:
//
// - Each device makes an ECDH P-256 key pair once. The private half is a
//   NON-EXTRACTABLE CryptoKey in IndexedDB — JavaScript on this page can use it
//   but cannot read it out, not even to back it up.
// - Public keys are exchanged peer-to-peer (in the hello over the data channel)
//   or in an invite link. They are not secret.
// - Two devices derive the same AES-GCM key with ECDH + HKDF, bound to their two
//   addresses so a key derived for one conversation is useless for another.
// - A "safety number" — a hash of both public keys — can be compared out of band
//   (read aloud on a call) to rule out anybody having swapped a key in transit.
//
// What it does NOT hide: that a push was sent, when, and to which address. The
// relay needs the address to deliver at all.

const enc = new TextEncoder()
const dec = new TextDecoder()

export const b64u = {
  enc(b: Uint8Array): string {
    let s = ''
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  },
  dec(s: string): Uint8Array {
    const t = s.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(t + '==='.slice((t.length + 3) % 4))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  },
}

export async function generateIdentity(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']) as Promise<CryptoKeyPair>
}

export async function exportPublic(k: CryptoKey): Promise<string> {
  return b64u.enc(new Uint8Array(await crypto.subtle.exportKey('raw', k)))
}
export async function importPublic(s: string): Promise<CryptoKey> {
  const raw = b64u.dec(s)
  if (raw.length !== 65 || raw[0] !== 4) throw new Error('bad-public-key')
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
}

/** The shared conversation key between our private key and their public key. */
export async function sharedKey(myPrivate: CryptoKey, theirPublic: string, a: string, b: string): Promise<CryptoKey> {
  const pub = await importPublic(theirPublic)
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, myPrivate, 256)
  const hk = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey'])
  const info = enc.encode(`bis-messages-v1:${[a, b].sort().join(':')}`)
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** Seal a string: base64url(iv ‖ ciphertext+tag). Additional data binds it to the sender. */
export async function seal(key: CryptoKey, plaintext: string, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(plaintext)))
  const out = new Uint8Array(12 + ct.length)
  out.set(iv)
  out.set(ct, 12)
  return b64u.enc(out)
}
export async function open(key: CryptoKey, sealed: string, aad: string): Promise<string> {
  const b = b64u.dec(sealed)
  if (b.length < 13) throw new Error('short')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12) as BufferSource, additionalData: enc.encode(aad) }, key, b.subarray(12) as BufferSource)
  return dec.decode(pt)
}

/** A safety number both sides compute identically: 6 groups of 5 digits. */
export async function safetyNumber(pubA: string, pubB: string): Promise<string> {
  const [x, y] = [pubA, pubB].sort()
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${x}|${y}`)))
  const groups: string[] = []
  for (let i = 0; i < 6; i++) {
    const n = ((h[i * 4] << 24) | (h[i * 4 + 1] << 16) | (h[i * 4 + 2] << 8) | h[i * 4 + 3]) >>> 0
    groups.push(String(n % 100000).padStart(5, '0'))
  }
  return groups.join(' ')
}
