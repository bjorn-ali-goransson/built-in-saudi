// The MP4 we WRITE must be readable by something that is not us.
//
//   node evals/mp4guard.mjs
//
// `lib/mp4Writer.ts` hand-writes an ISO-BMFF sample table — `stts`, `stss`,
// `ctts`, `stsc`, `stsz`, `stco` — and every one of those is a table of offsets
// into a file whose size depends on the table. Get one wrong and the output
// still looks like an MP4, still has the right length, and plays in nothing;
// there is no typecheck and no browser test that catches an `stco` that is four
// bytes out.
//
// So it is checked the way `docxguard` checks the Word writer: a real file is
// demuxed, re-muxed through the writer, and re-parsed by **mp4box**, which is
// somebody else's implementation. Two hand-written implementations agreeing is
// weaker evidence than one being right — a shared misconception satisfies both.
//
// It needs no API key and runs on the committed fixture, so it works on any
// clean checkout.

import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { compile } from './lib/tsc.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const GEN = path.join(ROOT, 'evals/gen')
mkdirSync(GEN, { recursive: true })
compile(ROOT, [path.join(ROOT, 'src/lib/mp4Writer.ts'), path.join(ROOT, 'src/lib/mp4Demux.ts')], GEN, [
  '--rootDir', path.join(ROOT, 'src/lib'),
])

const { writeMp4 } = await import(path.join(GEN, 'mp4Writer.js'))
const { demuxMp4, rotationOf, displaySize } = await import(path.join(GEN, 'mp4Demux.js'))
const MP4Box = await import('mp4box')

const fixture = path.join(ROOT, 'e2e/fixtures/sample.mp4')
const buf = readFileSync(fixture)
const source = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

let failed = 0
const check = (ok, what, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`)
}

/** Parse with mp4box and report what an independent reader sees. */
function reread(bytes) {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const file = MP4Box.createFile()
  let info = null
  const got = new Map()
  file.onError = (e) => { throw new Error(String(e)) }
  file.onReady = (movie) => {
    info = movie
    for (const t of movie.tracks) {
      got.set(t.id, [])
      file.setExtractionOptions(t.id, null, { nbSamples: 1_000_000 })
    }
    file.start()
  }
  file.onSamples = (id, _u, list) => { got.get(id)?.push(...list) }
  file.appendBuffer(MP4Box.MP4BoxBuffer.fromArrayBuffer(ab, 0))
  file.flush()
  return { info, samples: got, file }
}

const original = await demuxMp4(source)
console.log(`fixture: ${original.durationSec.toFixed(2)}s, ${original.tracks.length} tracks — ` +
  original.tracks.map((t) => `${t.kind} ${t.codec} ×${t.samples.length}`).join(', '))
check(original.tracks.length >= 2, 'the fixture has both a video and an audio track',
  'a one-track fixture would let a broken interleave pass')

const out = writeMp4(original.tracks)
console.log(`written: ${out.length} bytes (source ${buf.length})`)

// A progressive file has its index up front. The whole point of this writer is
// that it does NOT emit the fragmented layout mp4box's own addSample produces,
// so the absence of `moof` is the property under test, not a detail.
const head = Buffer.from(out.slice(0, 4096)).toString('latin1')
check(head.includes('moov'), 'moov is at the front of the file')
check(!Buffer.from(out).toString('latin1').includes('moof'), 'no moof — the file is progressive, not fragmented')
check(head.includes('stco') || head.includes('co64'), 'a chunk offset table is present')
check(head.includes('stsz') && head.includes('stts'), 'sample size and timing tables are present')

const back = reread(out)
check(!!back.info, 'mp4box re-parses the written file')
if (back.info) {
  check(back.info.tracks.length === original.tracks.length,
    'every track survived', `${back.info.tracks.length} of ${original.tracks.length}`)

  for (const src of original.tracks) {
    const mine = back.info.tracks.find((t) => t.type === src.kind)
    if (!mine) { check(false, `${src.kind} track is present`); continue }
    check(mine.codec === src.codec, `${src.kind} codec survives`, `${mine.codec} vs ${src.codec}`)
    check(mine.timescale === src.timescale, `${src.kind} timescale survives`)
    const list = back.samples.get(mine.id) ?? []
    check(list.length === src.samples.length,
      `${src.kind} sample count survives`, `${list.length} of ${src.samples.length}`)

    // The bytes are the point: an offset table that is subtly wrong hands back
    // samples of the right COUNT read from the wrong PLACE, which every
    // structural check above would pass.
    let same = 0
    for (let i = 0; i < Math.min(list.length, src.samples.length); i++) {
      const a = list[i].data, b = src.samples[i].data
      if (a.length === b.length && a.every((v, j) => v === b[j])) same++
    }
    check(same === src.samples.length, `${src.kind} sample BYTES survive`,
      `${same} of ${src.samples.length} identical`)

    const timing = list.every((s, i) => s.cts === src.samples[i].cts && s.duration === src.samples[i].duration)
    check(timing, `${src.kind} timing survives`)
    if (src.kind === 'video') {
      const syncs = list.filter((s) => s.is_sync).length
      const want = src.samples.filter((s) => s.sync).length
      check(syncs === want, 'the keyframe list survives', `${syncs} of ${want}`)
      check(want > 0 && want < src.samples.length,
        'the fixture has SOME keyframes and not all of them',
        'an all-keyframe fixture would never write stss, so it could not test it')
    }
  }

  const wroteDur = back.info.duration / back.info.timescale
  check(Math.abs(wroteDur - original.durationSec) < 0.1,
    'the duration survives', `${wroteDur.toFixed(2)}s vs ${original.durationSec.toFixed(2)}s`)
}

// A ROTATED SOURCE, which is what a phone actually hands over: the frames are
// stored landscape with a matrix beside them saying to turn them. A trim COPIES
// those frames, so a writer that emits the unity matrix silently lays a portrait
// recording on its side — and nothing here would have noticed, because every
// other check passes on a file that plays sideways.
const rotated = readFileSync(path.join(ROOT, 'e2e/fixtures/rotated.mp4'))
const rot = await demuxMp4(rotated.buffer.slice(rotated.byteOffset, rotated.byteOffset + rotated.byteLength))
const rotVideo = rot.tracks.find((t) => t.kind === 'video')
check(rotVideo?.rotation === 90, 'the fixture is read as rotated', `${rotVideo?.rotation}°`)
check(displaySize({ width: rotVideo?.width ?? 0, height: rotVideo?.height ?? 0 }, rotVideo?.rotation ?? 0).width
  === rotVideo?.height, 'the display size is the turned one')

const rewrote = reread(writeMp4(rot.tracks))
const rotBack = rewrote.info?.tracks.find((t) => t.video)
check(rotationOf(rotBack?.matrix) === 90, 'the rotation survives a copy',
  `${rotationOf(rotBack?.matrix)}° back from mp4box`)

// A muxer that quietly drops a track it does not understand is worse than one
// that refuses, so the refusal is pinned too.
let refused = false
try { writeMp4([]) } catch { refused = true }
check(refused, 'writing nothing is refused rather than producing an empty file')

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed')
process.exit(failed ? 1 : 0)
