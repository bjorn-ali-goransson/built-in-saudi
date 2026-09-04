// Does a mosaic survive being shown hundreds of times?
//
//   node evals/pixelleak.mjs
//
// `video-edit` can pixelate, blur or black out part of a clip, and the question
// of which to DEFAULT to is not a matter of taste. Pixelation replaces each
// block with its average, which for one still is a real loss of information —
// a 12×12 block is 144 numbers reduced to one. The intuition everybody has is
// that a video is just a lot of stills, so it must be at least as safe.
//
// IT IS THE OPPOSITE, and this measures by how much. The mosaic grid is fixed
// to the FRAME while the thing being hidden MOVES through it, so every frame
// samples the same underlying picture on a differently-aligned grid. Each frame
// is a fresh set of linear constraints on the same pixels, and enough of them
// invert the average. The subject you most want to hide — a face, a plate, a
// name on a screen someone is holding — is precisely the one that moves.
//
// The reconstruction here is deliberately naive: iterative back-projection, a
// textbook method in a few dozen lines, no libraries. That is the point. An
// attack that needs no expertise and no tooling is the one to design against,
// and anything better than this only makes the case stronger.
//
// A STATIC region is the control, and it must NOT be recoverable — without that
// case the harness would just be measuring "reconstruction works", and the
// finding would be about arithmetic rather than about motion.

/** A 5×7 bitmap for each digit — enough to be legible, small enough to type. */
const GLYPHS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
}

const SCALE = 4                 // pixels per glyph cell
const BLOCK = 12                // mosaic block size, in pixels
const PLATE = [4, 8, 1, 3, 7, 0]

/** The secret: a plate-like row of digits, as a 0..1 image. */
function secret() {
  const gw = 5, gh = 7, gap = 1
  const w = PLATE.length * (gw + gap) * SCALE
  const h = gh * SCALE
  const px = new Float64Array(w * h).fill(0)
  PLATE.forEach((d, n) => {
    const rows = GLYPHS[d]
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (rows[y][x] !== '1') continue
        const ox = (n * (gw + gap) + x) * SCALE
        const oy = y * SCALE
        for (let dy = 0; dy < SCALE; dy++) {
          for (let dx = 0; dx < SCALE; dx++) px[(oy + dy) * w + ox + dx] = 1
        }
      }
    }
  })
  return { px, w, h }
}

/**
 * One frame's observation: the mean of every BLOCK×BLOCK cell of the mosaic
 * grid, where the picture sits at offset (sx, sy) inside that grid.
 *
 * Returns the cells plus, for each, the source pixels that fell in it — which
 * is all the reconstruction needs and is the honest statement of what a
 * pixelated frame gives away.
 */
function observe(img, sx, sy) {
  const cells = new Map()
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const key = `${Math.floor((x + sx) / BLOCK)},${Math.floor((y + sy) / BLOCK)}`
      let cell = cells.get(key)
      if (!cell) { cell = { idx: [], mean: 0 }; cells.set(key, cell) }
      cell.idx.push(y * img.w + x)
    }
  }
  for (const cell of cells.values()) {
    let sum = 0
    for (const i of cell.idx) sum += img.px[i]
    cell.mean = sum / cell.idx.length
  }
  return [...cells.values()]
}

/**
 * Iterative back-projection: guess flat grey, then repeatedly push each cell's
 * residual back over the pixels that produced it.
 */
function reconstruct(frames, size, rounds = 300) {
  const out = new Float64Array(size).fill(0.5)
  for (let r = 0; r < rounds; r++) {
    for (const frame of frames) {
      for (const cell of frame) {
        let sum = 0
        for (const i of cell.idx) sum += out[i]
        const delta = cell.mean - sum / cell.idx.length
        for (const i of cell.idx) out[i] = Math.min(1, Math.max(0, out[i] + delta))
      }
    }
  }
  return out
}

/** How much of the secret came back: RMSE, and pixels correctly black-or-white. */
function score(truth, guess) {
  let se = 0, right = 0
  for (let i = 0; i < truth.length; i++) {
    se += (truth[i] - guess[i]) ** 2
    if ((guess[i] > 0.5) === (truth[i] > 0.5)) right++
  }
  return { rmse: Math.sqrt(se / truth.length), correct: right / truth.length }
}

const img = secret()
console.log(`secret: ${img.w}×${img.h}px plate "${PLATE.join('')}", mosaic block ${BLOCK}px`)
console.log(`a single block averages ${BLOCK * BLOCK} pixels into one number\n`)

// A subject drifting across the frame, as anything worth censoring does. The
// offsets are what the motion provides; the grid itself never moves.
const moving = (n) => Array.from({ length: n }, (_, i) => observe(img, (i * 5) % BLOCK, Math.floor(i * 3 / BLOCK) % BLOCK))

console.log('MOVING subject — the mosaic grid is fixed to the frame, the face is not')
console.log('frames   RMSE    pixels recovered')
for (const n of [1, 2, 4, 8, 16, 32, 64]) {
  const s = score(img.px, reconstruct(moving(n), img.px.length))
  console.log(`${String(n).padStart(6)}   ${s.rmse.toFixed(3)}   ${(s.correct * 100).toFixed(1)}%`)
}

// The control. If a still subject were recoverable too, this would be measuring
// the reconstruction rather than the motion, and the finding would be worthless.
const still = (n) => Array.from({ length: n }, () => observe(img, 0, 0))
console.log('\nSTATIC subject — every frame is the same observation (the control)')
console.log('frames   RMSE    pixels recovered')
for (const n of [1, 64]) {
  const s = score(img.px, reconstruct(still(n), img.px.length))
  console.log(`${String(n).padStart(6)}   ${s.rmse.toFixed(3)}   ${(s.correct * 100).toFixed(1)}%`)
}

// And the one that is not a trade-off at all.
const blacked = new Float64Array(img.px.length).fill(0)
const s = score(img.px, blacked)
console.log(`\nSOLID BLOCK, any number of frames   ${s.rmse.toFixed(3)}   ${(s.correct * 100).toFixed(1)}%`)
console.log('  (and that figure is only "recovered" in the sense that a blank guess')
console.log('   scores against a mostly-blank plate — nothing is being read back)')
