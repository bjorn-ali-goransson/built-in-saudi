// Make the fixture the stabiliser is measured against, once.
//
//   node scripts/make-shaky-mp4.mjs
//
// A FIXTURE HAS TO CONTAIN THE HARD CASE — recorded in this repo four times
// over (the lam-alef sentence, the real HEIC still, the grainy scan, the
// asymmetric caption) and it applies with particular force here: `sample.mp4`
// is a steady test pattern, so a stabiliser run against it corrects by nothing,
// crops by nothing, and passes every assertion having measured nothing at all.
//
// So the camera path is SYNTHESISED, with two components on purpose:
//   * a slow SWAY, which a gentle setting leaves alone and a strong one fights
//     — that is what makes "steadying harder costs more picture" a difference a
//     test can see rather than a sentence in the copy;
//   * a fast WOBBLE and a little roll, which is the shake itself.
// Plus one bright MARKER at a fixed place in the world, so a spec can ask
// whether the picture actually stopped moving instead of trusting a percentage.
//
// The frames are encoded by a real browser (Node has no H.264 encoder) and
// muxed by our own `lib/mp4Writer.ts`. Using our writer to build the fixture is
// only acceptable because `evals/mp4guard.mjs` proves that writer against
// mp4box, which is somebody else's implementation.

import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { compile } from '../evals/lib/tsc.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const GEN = path.join(ROOT, 'evals/gen')
mkdirSync(GEN, { recursive: true })
compile(ROOT, [path.join(ROOT, 'src/lib/mp4Writer.ts')], GEN, ['--rootDir', path.join(ROOT, 'src/lib')])
const { writeMp4 } = await import(path.join(GEN, 'mp4Writer.js'))

const W = 320
const H = 180
const FPS = 24
const N = 60
const TIMESCALE = 90_000

const browser = await chromium.launch()
const page = await browser.newPage()
// WebCodecs needs a secure context, and `about:blank` is an opaque origin that
// is not one — the constructor is simply absent there. A `file://` URL is
// treated as potentially trustworthy, which is enough.
const blank = path.join(ROOT, 'evals/gen/blank.html')
writeFileSync(blank, '<!doctype html><title>encode</title>')
await page.goto(`file://${blank}`)

async function encode(shaky) {
  return page.evaluate(async ({ W, H, FPS, N, shaky }) => {
  // Fixed generator: a fixture that differs between runs is a fixture nobody
  // can reason about when a case starts failing.
  let seed = 20260905
  const rnd = () => {
    seed ^= seed << 13; seed >>>= 0
    seed ^= seed >>> 17
    seed ^= seed << 5; seed >>>= 0
    return seed / 4294967296
  }

  const WORLD_W = 760
  const WORLD_H = 520
  const world = new OffscreenCanvas(WORLD_W, WORLD_H)
  const wc = world.getContext('2d')
  wc.fillStyle = '#20303a'
  wc.fillRect(0, 0, WORLD_W, WORLD_H)
  for (let i = 0; i < 220; i++) {
    wc.fillStyle = `hsl(${Math.floor(rnd() * 360)} ${30 + rnd() * 50}% ${25 + rnd() * 45}%)`
    wc.fillRect(rnd() * WORLD_W, rnd() * WORLD_H, 8 + rnd() * 60, 8 + rnd() * 50)
  }
  // Grain, which is what the sub-pixel refit bites on and what a smooth
  // gradient would not have given it.
  const grain = wc.getImageData(0, 0, WORLD_W, WORLD_H)
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (rnd() - 0.5) * 22
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n
  }
  wc.putImageData(grain, 0, 0)
  // The marker: one small, unmistakably brightest thing, at a fixed place in
  // the WORLD. A spec finds its centroid and asks how much it moves.
  wc.fillStyle = '#ffffff'
  wc.fillRect(WORLD_W / 2 + 96, WORLD_H / 2 - 54, 14, 14)

  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext('2d', { alpha: false })

  const chunks = []
  let description = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const d = meta?.decoderConfig?.description
      if (d && !description) {
        const u = ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : new Uint8Array(d)
        description = Array.from(u)
      }
      const data = new Uint8Array(chunk.byteLength)
      chunk.copyTo(data)
      chunks.push({ data: Array.from(data), ts: chunk.timestamp, key: chunk.type === 'key' })
    },
    error: (e) => { throw e },
  })
  encoder.configure({ codec: 'avc1.42001f', width: W, height: H, bitrate: 1_200_000, avc: { format: 'avc' } })

      // Sized so BOTH properties a spec needs are unmistakable, and the sizes
    // were simulated before the file was made: the sway makes gentle and strong
    // differ by 9 points of kept picture, and the wobble makes the marker jump
    // between consecutive frames about 5.6 times as far before steadying as
    // after. A fixture that only just shows a property is a case that fails on
    // a different encoder.
    const SWAY = shaky ? 26 : 0, SWAY_HZ = 0.4, WOB = shaky ? 4 : 0, WOB_HZ = 5, ROLL = shaky ? 0.02 : 0
  for (let i = 0; i < N; i++) {
    const t = i / FPS
    const cx = WORLD_W / 2 + Math.sin(2 * Math.PI * SWAY_HZ * t) * SWAY + Math.sin(2 * Math.PI * WOB_HZ * t) * WOB
    const cy = WORLD_H / 2 + Math.cos(2 * Math.PI * SWAY_HZ * t * 0.8) * SWAY * 0.6 + Math.cos(2 * Math.PI * WOB_HZ * t * 1.3) * WOB
    const rot = Math.sin(2 * Math.PI * WOB_HZ * t * 0.7) * ROLL
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.translate(W / 2, H / 2)
    ctx.rotate(-rot)
    ctx.translate(-cx, -cy)
    ctx.drawImage(world, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i / FPS) * 1e6), duration: Math.round(1e6 / FPS) })
    encoder.encode(frame, { keyFrame: i % 24 === 0 })
    frame.close()
  }
  await encoder.flush()
  encoder.close()
    return { chunks, description }
  }, { W, H, FPS, N, shaky })
}

/**
 * The CONTROL, from the same world with the camera nailed down.
 *
 * Without it "a steady clip is told it is steady" has to lean on whatever
 * `sample.mp4` happens to contain — and it contains moving content, which any
 * global estimator reads as camera motion and correctly reports as shake. Two
 * files differing in exactly the property under test is the whole point of a
 * control.
 */
const files = [['shaky.mp4', true], ['steady.mp4', false]]

for (const [name, shaky] of files) {
const encoded = await encode(shaky)
if (!encoded.description) throw new Error('the browser gave back no avcC record — no H.264 encoder?')

const step = Math.round(TIMESCALE / FPS)
const samples = encoded.chunks.map((c, i) => ({
  data: new Uint8Array(c.data),
  dts: i * step,
  cts: i * step,
  duration: step,
  sync: c.key,
}))

const record = new Uint8Array(encoded.description)
const avcC = new Uint8Array(record.length + 8)
new DataView(avcC.buffer).setUint32(0, record.length + 8)
avcC.set([0x61, 0x76, 0x63, 0x43], 4)
avcC.set(record, 8)

const bytes = writeMp4([{
  kind: 'video', entryType: 'avc1', timescale: TIMESCALE, config: avcC,
  width: W, height: H, samples,
}])
const out = path.join(ROOT, 'e2e/fixtures/', name)
writeFileSync(out, bytes)
console.log(`wrote ${out} — ${samples.length} frames, ${W}x${H}, ${(bytes.length / 1024).toFixed(1)}KB`)
}

await browser.close()
