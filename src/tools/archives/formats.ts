// What an archive IS, decided from its bytes, plus the tar half — which has no
// platform API and no dependency here, because it is a 512-byte header and the
// file after it, padded to the next 512.
//
// Pure, no runtime imports, so the worker and a unit test both use it.

export type Kind = 'zip' | 'rar' | 'gzip' | 'tar' | '7z' | 'bzip2' | 'xz' | 'zstd' | 'unknown'

/**
 * The bytes decide, never the extension. A `.zip` renamed `.rar` by a careless
 * download is still a zip, and a phone hands over files with no extension at
 * all. The formats this site cannot open are recognised too, so the refusal can
 * NAME them instead of saying "unknown file".
 */
export function sniff(b: Uint8Array): Kind {
  const at = (i: number, ...xs: number[]) => xs.every((x, k) => b[i + k] === x)
  if (at(0, 0x50, 0x4b, 0x03, 0x04) || at(0, 0x50, 0x4b, 0x05, 0x06)) return 'zip'
  if (at(0, 0x52, 0x61, 0x72, 0x21, 0x1a, 0x07)) return 'rar'
  if (at(0, 0x1f, 0x8b)) return 'gzip'
  if (at(0, 0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return '7z'
  if (at(0, 0x42, 0x5a, 0x68)) return 'bzip2'
  if (at(0, 0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00)) return 'xz'
  if (at(0, 0x28, 0xb5, 0x2f, 0xfd)) return 'zstd'
  if (isTar(b)) return 'tar'
  return 'unknown'
}

/** `ustar` at 257 — or, for a pre-POSIX tar, a header whose checksum adds up. */
export function isTar(b: Uint8Array): boolean {
  if (b.length < 512) return false
  if (b[257] === 0x75 && b[258] === 0x73 && b[259] === 0x74 && b[260] === 0x61 && b[261] === 0x72) return true
  const stored = octal(b.subarray(148, 156))
  return stored !== null && stored === checksum(b.subarray(0, 512)) && b[0] !== 0
}

function checksum(h: Uint8Array): number {
  let s = 0
  for (let i = 0; i < 512; i++) s += i >= 148 && i < 156 ? 0x20 : h[i]
  return s
}

function octal(f: Uint8Array): number | null {
  // GNU base-256 for sizes over 8GB: high bit set, big-endian after it.
  if (f[0] & 0x80) {
    let n = f[0] & 0x7f
    for (let i = 1; i < f.length; i++) n = n * 256 + f[i]
    return n
  }
  const s = new TextDecoder().decode(f).replace(/\0.*$/s, '').trim()
  if (!s) return 0
  return /^[0-7]+$/.test(s) ? parseInt(s, 8) : null
}

const str = (f: Uint8Array) => new TextDecoder().decode(f.subarray(0, f.indexOf(0) < 0 ? f.length : f.indexOf(0)))

export interface Item { name: string; dir: boolean; size: number; bytes?: Uint8Array }

/**
 * Every entry of a tar. Long names come in two dialects and both are read: GNU
 * writes an `L` entry whose BODY is the next entry's name, POSIX writes a pax
 * `x` entry carrying `path=`. Ignoring them turns every path over 100 bytes —
 * an ordinary node_modules path — into a truncated one.
 */
export function readTar(b: Uint8Array): Item[] {
  const out: Item[] = []
  let off = 0
  let longName: string | null = null
  let paxPath: string | null = null
  while (off + 512 <= b.length) {
    const h = b.subarray(off, off + 512)
    if (h.every((x) => x === 0)) break
    const size = octal(h.subarray(124, 136)) ?? 0
    const type = String.fromCharCode(h[156] || 0x30)
    const body = b.subarray(off + 512, off + 512 + size)
    off += 512 + Math.ceil(size / 512) * 512
    if (type === 'L') { longName = str(body); continue }
    if (type === 'x') {
      for (const rec of new TextDecoder().decode(body).split('\n')) {
        const m = /^\d+ path=(.*)$/.exec(rec)
        if (m) paxPath = m[1]
      }
      continue
    }
    if (type === 'g') continue
    const prefix = h[257] === 0x75 ? str(h.subarray(345, 500)) : ''
    let name = paxPath ?? longName ?? (prefix ? `${prefix}/${str(h.subarray(0, 100))}` : str(h.subarray(0, 100)))
    longName = paxPath = null
    name = name.replace(/^\.\//, '')
    if (!name || name === '.') continue
    if (type === '5') out.push({ name: name.endsWith('/') ? name : `${name}/`, dir: true, size: 0 })
    else if (type === '0' || type === '7') out.push({ name, dir: false, size, bytes: body })
    // Links, devices and FIFOs are not files a person can download; skipped.
  }
  return out
}

function field(s: string, len: number): Uint8Array {
  const f = new Uint8Array(len)
  f.set(new TextEncoder().encode(s).subarray(0, len))
  return f
}

const oct = (n: number, len: number) => field(n.toString(8).padStart(len - 1, '0'), len)

/**
 * A ustar archive. A name that does not fit the 100-byte field — measured in
 * BYTES, which an Arabic name reaches in fifty letters — gets a pax header
 * first, which every tar since 2001 reads; the truncated name stays in the
 * ustar header as the fallback the spec intends.
 */
export function writeTar(files: { name: string; bytes: Uint8Array }[], mtime = Math.floor(Date.now() / 1000)): Uint8Array {
  const parts: Uint8Array[] = []
  const enc = new TextEncoder()
  const header = (name: string, size: number, type: string) => {
    const h = new Uint8Array(512)
    h.set(field(name, 100), 0)
    h.set(oct(0o644, 8), 100)
    h.set(oct(0, 8), 108)
    h.set(oct(0, 8), 116)
    h.set(oct(size, 12), 124)
    h.set(oct(mtime, 12), 136)
    h[156] = type.charCodeAt(0)
    h.set(enc.encode('ustar\x0000'), 257)
    h.set(oct(checksum(h), 7), 148)
    h[155] = 0x20
    return h
  }
  const pad = (n: number) => new Uint8Array((512 - (n % 512)) % 512)
  for (const f of files) {
    if (enc.encode(f.name).length > 100) {
      const rec = (len: number) => `${len} path=${f.name}\n`
      let len = enc.encode(rec(0)).length
      while (enc.encode(rec(len)).length !== len) len = enc.encode(rec(len)).length
      const body = enc.encode(rec(len))
      parts.push(header('PaxHeader', body.length, 'x'), body, pad(body.length))
    }
    parts.push(header(f.name, f.bytes.length, '0'), f.bytes, pad(f.bytes.length))
  }
  parts.push(new Uint8Array(1024))
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

/** The original file name a gzip carries (FNAME), when it carries one. */
export function gzipName(b: Uint8Array): string | null {
  if (b[0] !== 0x1f || b[1] !== 0x8b) return null
  const flags = b[3]
  let off = 10
  if (flags & 4) off += 2 + (b[10] | (b[11] << 8))
  if (!(flags & 8)) return null
  const end = b.indexOf(0, off)
  if (end < 0) return null
  // Latin-1 by the RFC; but every gzip written on a modern machine is UTF-8,
  // and decoding UTF-8 as Latin-1 is what turns an Arabic name into mojibake.
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(off, end)) } catch { return new TextDecoder('latin1').decode(b.subarray(off, end)) }
}

/** `report.tar.gz` → `report.tar`, `x.tgz` → `x.tar`, `x.gz` → `x`. */
export function stripGz(name: string): string {
  return name.replace(/\.tgz$/i, '.tar').replace(/\.gz$/i, '') || 'file'
}

/** A name a downloaded file can safely have: the last path segment, never empty. */
export function baseName(path: string): string {
  return path.replace(/\/+$/, '').split('/').pop() || 'file'
}
