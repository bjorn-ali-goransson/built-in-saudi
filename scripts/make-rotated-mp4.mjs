// Make a ROTATED copy of the sample clip: `e2e/fixtures/rotated.mp4`.
//
// Run once; the file is committed. It exists because the hard case for every
// video tool here is the one a phone actually produces — a recording held
// upright is stored LANDSCAPE with a 90° rotation matrix in its `tkhd`, and
// nothing in this repo's fixtures had one. The player applies the matrix, so
// `<video>.videoWidth/videoHeight` come back SWAPPED against the dimensions a
// demuxer reads out of the sample entry, and any code that mixes the two draws
// the picture into a box of the wrong shape.
//
// Nothing is re-encoded: the samples, the codec configuration and every other
// box are byte-identical to `sample.mp4`. Only the 36-byte matrix in the video
// track's `tkhd` changes, which is exactly the difference a rotated recording
// has.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(ROOT, 'e2e/fixtures/sample.mp4')
const dest = join(ROOT, 'e2e/fixtures/rotated.mp4')

const buf = readFileSync(src)

/** Walk the boxes at one level, calling back with type and body range. */
function boxes(from, to, fn) {
  let p = from
  while (p + 8 <= to) {
    const size = buf.readUInt32BE(p)
    const type = buf.toString('latin1', p + 4, p + 8)
    if (size < 8) break
    fn(type, p + 8, p + size)
    p += size
  }
}

/** The video track's `tkhd` body, found by walking moov → trak → tkhd. */
function findVideoTkhd() {
  let found = null
  boxes(0, buf.length, (type, start, end) => {
    if (type !== 'moov') return
    boxes(start, end, (t2, s2, e2) => {
      if (t2 !== 'trak') return
      let tkhd = null
      let isVideo = false
      boxes(s2, e2, (t3, s3, e3) => {
        if (t3 === 'tkhd') tkhd = { start: s3, end: e3 }
        if (t3 !== 'mdia') return
        boxes(s3, e3, (t4, s4, e4) => {
          if (t4 !== 'hdlr') return
          // handler type is 4 bytes in, after version/flags and one reserved word
          isVideo = buf.toString('latin1', s4 + 8, s4 + 12) === 'vide'
        })
      })
      if (tkhd && isVideo) found = tkhd
    })
  })
  return found
}

const tkhd = findVideoTkhd()
if (!tkhd) throw new Error('no video tkhd — is this an MP4?')

const version = buf[tkhd.start]
// version/flags 4 + (creation, modification, track id, reserved, duration)
const afterDuration = tkhd.start + 4 + (version === 1 ? 32 : 20)
// reserved 8 + layer 2 + alternate group 2 + volume 2 + reserved 2
const matrix = afterDuration + 16
const width = matrix + 36

const w = buf.readUInt32BE(width) >>> 16
const h = buf.readUInt32BE(width + 4) >>> 16

// 90° clockwise: [0 1 0, -1 0 0, h 0 1]. a/b/c/d are 16.16 fixed point, u/v/w
// are 2.30, and the translation keeps the picture in the positive quadrant.
const rotate90 = [0, 0x00010000, 0, -0x00010000, 0, 0, h << 16, 0, 0x40000000]
rotate90.forEach((v, i) => buf.writeInt32BE(v | 0, matrix + i * 4))

writeFileSync(dest, buf)
console.log(`wrote ${dest} — stored ${w}×${h}, displays ${h}×${w}`)
