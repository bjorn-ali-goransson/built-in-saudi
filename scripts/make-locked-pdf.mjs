// Build e2e/fixtures/locked.pdf — a genuinely encrypted PDF.
//
//   node scripts/make-locked-pdf.mjs
//
// Run once; the fixture is committed. Same reasoning as `e2e/fixtures/sample.heic`:
// a mocked fixture proves nothing about a real decryption path, and no library
// in this repo can produce an encrypted PDF (pdf-lib explicitly cannot).
//
// This implements the PDF 1.4 standard security handler at V=1 R=2 — RC4-40 —
// which is the oldest and simplest variant and the one every reader still
// supports. The algorithm is from the PDF spec, Algorithms 2, 3, 4 and 5:
//
//   key   = MD5(padded user pw ‖ O ‖ P as 4 little-endian bytes ‖ first ID)[0..4]
//   O     = RC4(padded user pw, key = MD5(padded owner pw)[0..4])
//   U     = RC4(the pad string, key)                    (R = 2)
//   per-object key = MD5(key ‖ objnum as 3 LE ‖ gen as 2 LE)[0 .. 4+5]
//
// Every string and stream is RC4-encrypted with its own per-object key. Get any
// of that wrong and pdf.js simply refuses the file, which is what makes the
// fixture self-validating: the e2e only passes if the password really opens it.
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const USER_PW = 'letmein'
const OWNER_PW = 'owner-secret'
const TEXT = 'Locked payslip: net pay 12345 SAR'

const PAD = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
])

const pad = (pw) => Buffer.concat([Buffer.from(pw, 'latin1'), PAD]).subarray(0, 32)
const md5 = (b) => createHash('md5').update(b).digest()

function rc4(key, data) {
  const s = new Uint8Array(256)
  for (let i = 0; i < 256; i++) s[i] = i
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xff
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  const out = Buffer.alloc(data.length)
  let i = 0
  j = 0
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xff
    j = (j + s[i]) & 0xff
    ;[s[i], s[j]] = [s[j], s[i]]
    out[k] = data[k] ^ s[(s[i] + s[j]) & 0xff]
  }
  return out
}

// P = -1: every permission granted. The point of the fixture is the password to
// OPEN, not the permission bits.
const P = -1
const pBuf = Buffer.alloc(4)
pBuf.writeInt32LE(P, 0)
const ID = Buffer.from('0123456789abcdef', 'latin1')

const O = rc4(md5(pad(OWNER_PW)).subarray(0, 5), pad(USER_PW))
const key = md5(Buffer.concat([pad(USER_PW), O, pBuf, ID])).subarray(0, 5)
const U = rc4(key, PAD)

const objKey = (num, gen) => {
  const extra = Buffer.alloc(5)
  extra.writeUIntLE(num, 0, 3)
  extra.writeUIntLE(gen, 3, 2)
  return md5(Buffer.concat([key, extra])).subarray(0, Math.min(16, key.length + 5))
}

const content = Buffer.from(`BT /F1 14 Tf 40 200 Td (${TEXT}) Tj ET\n`, 'latin1')
const encContent = rc4(objKey(4, 0), content)

const hex = (b) => `<${b.toString('hex')}>`

const objects = [
  '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
  '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
  '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
  null, // 4 — the encrypted content stream, assembled below as bytes
  '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  `6 0 obj\n<< /Filter /Standard /V 1 /R 2 /O ${hex(O)} /U ${hex(U)} /P ${P} >>\nendobj\n`,
]

const parts = []
const offsets = []
let pos = 0
const push = (buf) => { parts.push(buf); pos += buf.length }

push(Buffer.from('%PDF-1.4\n', 'latin1'))
for (let i = 0; i < objects.length; i++) {
  offsets[i + 1] = pos
  if (i === 3) {
    push(Buffer.from(`4 0 obj\n<< /Length ${encContent.length} >>\nstream\n`, 'latin1'))
    push(encContent)
    push(Buffer.from('\nendstream\nendobj\n', 'latin1'))
  } else {
    push(Buffer.from(objects[i], 'latin1'))
  }
}

const xref = pos
let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
for (let i = 1; i <= objects.length; i++) table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
push(Buffer.from(table, 'latin1'))
push(Buffer.from(
  `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [<${ID.toString('hex')}> <${ID.toString('hex')}>] >>\nstartxref\n${xref}\n%%EOF\n`,
  'latin1',
))

writeFileSync('e2e/fixtures/locked.pdf', Buffer.concat(parts))
console.log(`wrote e2e/fixtures/locked.pdf — user password "${USER_PW}", text "${TEXT}"`)
