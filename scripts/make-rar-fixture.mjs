// Writes e2e/fixtures/sample.rar — a real RAR 4.x archive, by hand.
//
// Nothing in the repo can make one: RAR's compressor is proprietary, so there
// is no library for writing the format. But the container is documented, and
// an archive whose entries are STORED (method 0x30) needs no compressor at all —
// only the block layout and two kinds of checksum. It is self-validating: get
// a header CRC wrong and unrar refuses the archive, so the e2e reading it back
// is proof the layout is right.
import { writeFileSync } from 'node:fs'

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = (b) => { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (~c) >>> 0 }

const u16 = (n) => [n & 0xff, (n >> 8) & 0xff]
const u32 = (n) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]

/** A block: HEAD_CRC is the low 16 bits of the CRC32 of everything after it. */
function block(type, flags, rest) {
  const body = [type, ...u16(flags), ...u16(7 + rest.length), ...rest]
  return [...u16(crc32(Uint8Array.from(body)) & 0xffff), ...body]
}

const DOS_TIME = ((2026 - 1980) << 25) | (11 << 21) | (1 << 16) | (12 << 11)
function file(name, text) {
  const data = new TextEncoder().encode(text)
  const nm = new TextEncoder().encode(name)
  const rest = [
    ...u32(data.length), ...u32(data.length), 3 /* Unix */, ...u32(crc32(data)), ...u32(DOS_TIME),
    20, 0x30 /* store */, ...u16(nm.length), ...u32(0o100644), ...nm,
  ]
  return [...block(0x74, 0x8000, rest), ...data]
}

const bytes = Uint8Array.from([
  0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00,
  ...block(0x73, 0, [0, 0, 0, 0, 0, 0]),
  ...file('hello.txt', 'hello from a rar archive\n'),
  ...file('docs/notes.txt', 'second file, in a folder\n'),
  ...block(0x7b, 0x4000, []),
])
writeFileSync(new URL('../e2e/fixtures/sample.rar', import.meta.url), bytes)
console.log('wrote', bytes.length, 'bytes')
