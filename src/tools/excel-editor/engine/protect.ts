// Sheet and workbook protection, as Excel does it — so a sheet protected in
// Excel opens protected here, unprotects with the same password, and goes back
// protected the same way.
//
// What Excel's protection IS matters for how it is described: it is a guard
// against accidents, not encryption. The data is in the file in the clear, and
// the password hash says only "the person who set this knew this word". The UI
// says so rather than implying the cells are secret.
//
// The modern hash (ECMA-376 Part 1 §18.2.29, "agile" key spinning): with the
// password as UTF-16LE, H0 = H(salt ‖ password), then Hn = H(Hn-1 ‖ n as a 32-bit
// little-endian integer) for n = 0 … spinCount-1. A hundred thousand rounds is
// deliberate on Excel's part, and takes a second or two here.
import type { Protection, SheetData, CellFormat } from './model'

const ALG: Record<string, string> = { 'SHA-512': 'SHA-512', 'SHA-384': 'SHA-384', 'SHA-256': 'SHA-256', 'SHA-1': 'SHA-1' }
const b64 = (u: Uint8Array) => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s) }
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const utf16 = (s: string) => { const u = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); u[i * 2] = c & 255; u[i * 2 + 1] = c >> 8 } return u }

export async function spinHash(password: string, salt: string, spin: number, algorithm = 'SHA-512'): Promise<string> {
  const alg = ALG[algorithm.toUpperCase()] || 'SHA-512'
  const s = unb64(salt)
  const p = utf16(password)
  const first = new Uint8Array(s.length + p.length)
  first.set(s); first.set(p, s.length)
  // SHA-512 is the algorithm Excel uses, and the one worth doing synchronously: a hundred
  // thousand awaited digests take ten seconds, the same rounds in place a fraction of one.
  if (alg === 'SHA-512') return b64(sha512Spin(new Uint8Array(await crypto.subtle.digest(alg, first)), spin))
  let h = new Uint8Array(await crypto.subtle.digest(alg, first))
  const buf = new Uint8Array(h.length + 4)
  for (let i = 0; i < spin; i++) {
    buf.set(h); buf[h.length] = i & 255; buf[h.length + 1] = (i >>> 8) & 255; buf[h.length + 2] = (i >>> 16) & 255; buf[h.length + 3] = (i >>> 24) & 255
    h = new Uint8Array(await crypto.subtle.digest(alg, buf.subarray(0, h.length + 4)))
  }
  return b64(h)
}

// ---- SHA-512 for the spin loop: H(previous 64 bytes ‖ counter) is always ONE block ------------
// The 80 round constants: the first 64 bits of the fractional parts of the cube roots of
// the first 80 primes (FIPS 180-4 §4.2.3).
const K = (() => {
  const hex = '428a2f98d728ae227137449123ef65cdb5c0fbcfec4d3b2fe9b5dba58189dbbc3956c25bf348b53859f111f1b605d019923f82a4af194f9bab1c5ed5da6d8118d807aa98a303024212835b0145706fbe243185be4ee4b28c550c7dc3d5ffb4e272be5d74f27b896f80deb1fe3b1696b19bdc06a725c71235c19bf174cf692694e49b69c19ef14ad2efbe4786384f25e30fc19dc68b8cd5b5240ca1cc77ac9c652de92c6f592b02754a7484aa6ea6e4835cb0a9dcbd41fbd476f988da831153b5983e5152ee66dfaba831c66d2db43210b00327c898fb213fbf597fc7beef0ee4c6e00bf33da88fc2d5a79147930aa72506ca6351e003826f142929670a0e6e7027b70a8546d22ffc2e1b21385c26c9264d2c6dfc5ac42aed53380d139d95b3df650a73548baf63de766a0abb3c77b2a881c2c92e47edaee692722c851482353ba2bfe8a14cf10364a81a664bbc423001c24b8b70d0f89791c76c51a30654be30d192e819d6ef5218d69906245565a910f40e35855771202a106aa07032bbd1b819a4c116b8d2d0c81e376c085141ab532748774cdf8eeb9934b0bcb5e19b48a8391c0cb3c5c95a634ed8aa4ae3418acb5b9cca4f7763e373682e6ff3d6b2b8a3748f82ee5defb2fc78a5636f43172f6084c87814a1f0ab728cc702081a6439ec90befffa23631e28a4506cebde82bde9bef9a3f7b2c67915c67178f2e372532bca273eceea26619cd186b8c721c0c207eada7dd6cde0eb1ef57d4f7fee6ed17806f067aa72176fba0a637dc5a2c898a6113f9804bef90dae1b710b35131c471b28db77f523047d8432caab7b40c724933c9ebe0a15c9bebc431d67c49c100d4c4cc5d4becb3e42b6597f299cfc657e2a5fcb6fab3ad6faec6c44198c4a475817'
  const out = new Int32Array(160)
  for (let i = 0; i < 160; i++) out[i] = parseInt(hex.slice(i * 8, i * 8 + 8), 16) | 0
  return out
})()
const IV = [0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1, 0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179]

/** `spin` rounds of H(h ‖ i as uint32LE) with SHA-512, each a single 128-byte block. */
export function sha512Spin(h0: Uint8Array, spin: number): Uint8Array {
  const W = new Int32Array(160)
  const H = new Int32Array(16)
  const block = new Uint8Array(128)
  const dv = new DataView(block.buffer)
  let h = h0
  for (let n = 0; n < spin; n++) {
    block.fill(0)
    block.set(h)
    block[64] = n & 255; block[65] = (n >>> 8) & 255; block[66] = (n >>> 16) & 255; block[67] = (n >>> 24) & 255
    block[68] = 0x80
    dv.setUint32(124, 68 * 8)
    for (let i = 0; i < 32; i++) W[i] = dv.getInt32(i * 4)
    for (let i = 16; i < 80; i++) {
      // sigma1(W[i-2]) and sigma0(W[i-15]) on (hi, lo) pairs.
      const xh = W[(i - 2) * 2], xl = W[(i - 2) * 2 + 1]
      const s1h = ((xh >>> 19) | (xl << 13)) ^ ((xl >>> 29) | (xh << 3)) ^ (xh >>> 6)
      const s1l = ((xl >>> 19) | (xh << 13)) ^ ((xh >>> 29) | (xl << 3)) ^ ((xl >>> 6) | (xh << 26))
      const yh = W[(i - 15) * 2], yl = W[(i - 15) * 2 + 1]
      const s0h = ((yh >>> 1) | (yl << 31)) ^ ((yh >>> 8) | (yl << 24)) ^ (yh >>> 7)
      const s0l = ((yl >>> 1) | (yh << 31)) ^ ((yl >>> 8) | (yh << 24)) ^ ((yl >>> 7) | (yh << 25))
      let lo = (s1l >>> 0) + (W[(i - 7) * 2 + 1] >>> 0) + (s0l >>> 0) + (W[(i - 16) * 2 + 1] >>> 0)
      let hi = s1h + W[(i - 7) * 2] + s0h + W[(i - 16) * 2] + Math.floor(lo / 0x100000000)
      W[i * 2] = hi | 0; W[i * 2 + 1] = lo | 0
      void lo; void hi
    }
    for (let i = 0; i < 16; i++) H[i] = IV[i] | 0
    let ah = H[0], al = H[1], bh = H[2], bl = H[3], ch = H[4], cl = H[5], dh = H[6], dl = H[7]
    let eh = H[8], el = H[9], fh = H[10], fl = H[11], gh = H[12], gl = H[13], hh = H[14], hl = H[15]
    for (let i = 0; i < 80; i++) {
      const S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23))
      const S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23))
      const chh = (eh & fh) ^ (~eh & gh)
      const chl = (el & fl) ^ (~el & gl)
      let lo = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + (K[i * 2 + 1] >>> 0) + (W[i * 2 + 1] >>> 0)
      const t1h = (hh + S1h + chh + K[i * 2] + W[i * 2] + Math.floor(lo / 0x100000000)) | 0
      const t1l = lo | 0
      const S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25))
      const S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25))
      const mh = (ah & bh) ^ (ah & ch) ^ (bh & ch)
      const ml = (al & bl) ^ (al & cl) ^ (bl & cl)
      lo = (S0l >>> 0) + (ml >>> 0)
      const t2h = (S0h + mh + Math.floor(lo / 0x100000000)) | 0
      const t2l = lo | 0
      hh = gh; hl = gl; gh = fh; gl = fl; fh = eh; fl = el
      lo = (dl >>> 0) + (t1l >>> 0)
      eh = (dh + t1h + Math.floor(lo / 0x100000000)) | 0; el = lo | 0
      dh = ch; dl = cl; ch = bh; cl = bl; bh = ah; bl = al
      lo = (t1l >>> 0) + (t2l >>> 0)
      ah = (t1h + t2h + Math.floor(lo / 0x100000000)) | 0; al = lo | 0
    }
    const add = (i: number, xh: number, xl: number) => { const lo = (H[i + 1] >>> 0) + (xl >>> 0); H[i] = (H[i] + xh + Math.floor(lo / 0x100000000)) | 0; H[i + 1] = lo | 0 }
    add(0, ah, al); add(2, bh, bl); add(4, ch, cl); add(6, dh, dl); add(8, eh, el); add(10, fh, fl); add(12, gh, gl); add(14, hh, hl)
    const out = new Uint8Array(64)
    const odv = new DataView(out.buffer)
    for (let i = 0; i < 16; i++) odv.setInt32(i * 4, H[i])
    h = out
  }
  return h
}

/** The pre-2010 16-bit password "hash" (ECMA-376 §18.2.28), as four uppercase hex digits. */
export function legacyHash(password: string): string {
  if (!password) return '0000'
  let h = 0
  // Each UTF-16 code unit as it stands, as openpyxl and LibreOffice compute it.
  const bytes = [...password].map((c) => c.charCodeAt(0))
  for (let i = bytes.length - 1; i >= 0; i--) {
    h = ((h >> 14) & 1) | ((h << 1) & 0x7fff)
    h ^= bytes[i]
  }
  h = ((h >> 14) & 1) | ((h << 1) & 0x7fff)
  h ^= bytes.length
  h ^= 0xce4b
  return h.toString(16).toUpperCase().padStart(4, '0')
}

export const hasPassword = (p: Protection | undefined) => !!(p?.hash || (p?.legacy && p.legacy !== '0000'))

/** Does this password open this protection? No password set means anybody may. */
export async function verify(p: Protection, password: string): Promise<boolean> {
  if (p.hash) return (await spinHash(password, p.hash.salt, p.hash.spin, p.hash.algorithm)) === p.hash.value
  if (p.legacy && p.legacy !== '0000') return legacyHash(password) === p.legacy.toUpperCase()
  return true
}

/** New protection, with a password or without one. */
export async function protection(password: string, allow?: Record<string, boolean>): Promise<Protection> {
  const out: Protection = allow ? { allow } : {}
  if (password) {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)))
    out.hash = { algorithm: 'SHA-512', salt, spin: 100000, value: await spinHash(password, salt, 100000) }
  }
  return out
}

/** A cell may be changed on a protected sheet only when it was unlocked first. */
export const isLocked = (fmt: CellFormat | undefined) => !fmt?.unlocked

/**
 * Why an edit is refused, or null when it may go ahead. Only the user's own
 * edits are checked — a collaborator's arrives already decided by its author.
 */
export function refusal(sheet: SheetData, op: { k: string; cells?: { r: number; c: number }[]; box?: { r0: number; c0: number; r1: number; c1: number }; what?: string; axis?: string; delta?: number }): 'locked' | 'format' | 'structure' | null {
  const p = sheet.protect
  if (!p) return null
  const allow = p.allow || {}
  const anyLocked = (cells: { r: number; c: number }[]) => cells.some((x) => isLocked(sheet.cells[`${x.r},${x.c}`]?.fmt))
  const boxCells = (b: { r0: number; c0: number; r1: number; c1: number }) => {
    const out: { r: number; c: number }[] = []
    if ((b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1) > 50_000) return [{ r: b.r0, c: b.c0 }, { r: -1, c: -1 }]
    for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) out.push({ r, c })
    return out
  }
  switch (op.k) {
    case 'cells': return op.cells && anyLocked(op.cells) ? 'locked' : null
    case 'clear':
      if (op.what !== 'contents' && !allow.formatCells) return 'format'
      return op.box && anyLocked(boxCells(op.box)) ? 'locked' : null
    case 'fmt': return allow.formatCells ? null : 'format'
    case 'struct': {
      const key = `${(op.delta || 0) > 0 ? 'insert' : 'delete'}${op.axis === 'col' ? 'Columns' : 'Rows'}`
      return allow[key] ? null : 'structure'
    }
    default: return null
  }
}
