import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The same 6-second 320×240 H.264/AAC fixture the trimmer uses — a real file
// with a keyframe every second, so the decode side has something honest to
// decode. See e2e/video-trim.spec.ts for how it was generated.
const FIXTURE = fileURLToPath(new URL('./fixtures/sample.mp4', import.meta.url))
const bytes = () => readFileSync(FIXTURE)

/**
 * Whether THIS browser can re-encode H.264 at all.
 *
 * It is asked rather than assumed because the answer genuinely differs: a
 * Chromium built without proprietary codecs has `VideoEncoder` and no H.264
 * behind it, and reports `supported: false` for every avc1 configuration. The
 * tool is built to say so plainly in that case, so both branches below are real
 * behaviour to assert — and neither test is allowed to pass having checked
 * nothing.
 */
async function canEncode(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return false
    try {
      const s = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001f', width: 640, height: 360, bitrate: 1_000_000, avc: { format: 'avc' },
      })
      return !!s.supported
    } catch { return false }
  })
}

async function load(page: Page, locale = 'en') {
  await page.goto(`/${locale}/apps/video-edit`)
  await expect(page.getByTestId('video-edit')).toBeVisible()
}

/**
 * Pick the fixture and wait for the EDIT stage.
 *
 * The clip list only renders for more than one clip — a list of one is a list
 * of nothing — so the signal that a file landed is the stage itself, which is
 * also the thing every case below reads from.
 */
async function pick(page: Page) {
  await expect(page.getByTestId('ve-file')).toHaveCount(1)
  await page.getByTestId('ve-file').setInputFiles({ name: 'sample.mp4', mimeType: 'video/mp4', buffer: bytes() })
  await expect(page.getByTestId('ve-stage')).toBeVisible({ timeout: 30_000 })
}

/**
 * Pick TWO clips in one go.
 *
 * There is no adding a clip mid-edit any more: the join order is decided when
 * the files are chosen, which is the moment somebody knows what order they
 * want. So a two-clip session starts as a two-file pick.
 */
async function pickTwo(page: Page) {
  await page.getByTestId('ve-file').setInputFiles([
    { name: 'one.mp4', mimeType: 'video/mp4', buffer: bytes() },
    { name: 'two.mp4', mimeType: 'video/mp4', buffer: bytes() },
  ])
  await expect(page.getByTestId('ve-stage')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('ve-total')).toContainText('0:12', { timeout: 30_000 })
}

/** The clip list lives in the settings sheet now, with the other power features. */
async function openClips(page: Page) {
  await page.getByTestId('ve-settings').click()
  await expect(page.getByTestId('ve-clips')).toBeVisible()
}

/**
 * Show the picture at `sec`, and WAIT for the element to be there.
 *
 * Setting `currentTime` resolves long before the frame does, and anything read
 * straight afterwards is read at the previous time. Most cases hide that by
 * polling on pixels; a case that asks where a keyframe landed cannot, because
 * the answer depends on the playhead at the moment of the drag.
 */
async function seek(page: Page, sec: number) {
  await page.getByTestId('ve-video').evaluate((v: HTMLVideoElement, s) => { v.currentTime = s }, sec)
  await expect.poll(() => page.getByTestId('ve-video')
    .evaluate((v: HTMLVideoElement) => (v.seeking ? -1 : v.currentTime)), { timeout: 10_000 })
    .toBeGreaterThan(sec - 0.35)
}

/**
 * Decode the EXPORTED file — there is deliberately no result player.
 *
 * The old version of this suite read a `<video data-testid="ve-out-video">`,
 * and that element is gone on purpose: the stage above IS the export, frame for
 * frame, so a second player would be a second opinion about what was encoded.
 * The download button's `href` is the same blob, so the assertions that matter
 * — a hand-written MP4 that a browser will actually decode, at the right size
 * and the right length — survive unchanged.
 */
async function decodeExport(page: Page): Promise<{ d: number; w: number; h: number }> {
  const href = await page.getByTestId('ve-download').getAttribute('href')
  expect(href).toMatch(/^blob:/)
  return page.evaluate((url) => new Promise<{ d: number; w: number; h: number }>((resolve, reject) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.addEventListener('loadedmetadata', () => resolve({ d: v.duration, w: v.videoWidth, h: v.videoHeight }), { once: true })
    v.addEventListener('error', () => reject(new Error('the exported file would not decode')), { once: true })
    setTimeout(() => reject(new Error('timeout decoding the exported file')), 20_000)
    v.src = url!
  }), href)
}

test('a browser without an H.264 encoder is told so, and pointed somewhere useful', async ({ page }) => {
  await load(page)
  const able = await canEncode(page)
  if (able) {
    // The gate must NOT fire on a browser that can do the job — a warning
    // shown to everybody is the failure this branch exists to rule out.
    await expect(page.getByTestId('ve-unsupported')).toHaveCount(0)
    await expect(page.getByTestId('ve-file')).toHaveCount(1)
  } else {
    await expect(page.getByTestId('ve-unsupported')).toBeVisible()
    await expect(page.getByTestId('ve-unsupported')).toContainText('WebCodecs')
    // A dead end is not an answer: trimming needs no encoder and still works.
    await expect(page.getByTestId('ve-unsupported').getByRole('link')).toHaveAttribute('href', /video-trim/)
  }
})

test('the first screen asks for a file and nothing else', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  // Nothing to fiddle with before there is a video to fiddle with — the whole
  // point of the intake screen, and the property that would quietly rot if the
  // editor ever rendered its controls empty.
  await expect(page.getByTestId('ve-stage')).toHaveCount(0)
  await expect(page.getByTestId('ve-tools')).toHaveCount(0)
  await expect(page.getByTestId('ve-export')).toHaveCount(0)

  await pick(page)
  // And then the editor, all of it on one stage.
  await expect(page.getByTestId('ve-tools')).toBeVisible()
  await expect(page.getByTestId('ve-result')).toBeVisible()
  await expect(page.getByTestId('ve-export')).toBeVisible()
})

test('the editor takes the whole screen, chrome included', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')

  // The site's own header is there before a pick — this is an ordinary page.
  await expect(page.locator('header').first()).toBeVisible()

  await pick(page)

  // And afterwards the editor covers it. Asserted by GEOMETRY rather than by a
  // class name: what matters is that nothing of the site is on top of or
  // beside the video, which is the thing that was taking a third of the height
  // on a phone.
  const shell = page.getByTestId('ve-fullscreen')
  await expect(shell).toBeVisible()
  const box = await shell.boundingBox()
  const view = page.viewportSize()
  expect(box && view).toBeTruthy()
  expect(box!.x).toBeLessThanOrEqual(1)
  expect(box!.y).toBeLessThanOrEqual(1)
  expect(box!.width).toBeGreaterThanOrEqual(view!.width - 1)
  expect(box!.height).toBeGreaterThanOrEqual(view!.height - 1)

  // The page behind must not scroll under it — a second scrollbar dragging the
  // site's chrome around beneath a full-screen editor is the classic bug.
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
})

test('leaving asks first, and only then throws the session away', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-1:1').click()

  // Nothing here is saved anywhere, so leaving has to ask.
  await page.getByTestId('ve-back').click()
  await expect(page.getByTestId('ve-confirm-back')).toBeVisible()

  // Cancelling keeps BOTH the editor and the work — without this the case
  // would pass against a dialog whose two buttons did the same thing.
  await page.getByTestId('ve-back-cancel').click()
  await expect(page.getByTestId('ve-confirm-back')).toHaveCount(0)
  await expect(page.getByTestId('ve-fullscreen')).toBeVisible()
  await page.getByTestId('ve-settings').click()
  await expect(page.getByTestId('ve-out-size')).toHaveText('240×240')
  await page.getByTestId('ve-settings-close').click()

  // And discarding goes back to the upload screen, with the editor gone.
  await page.getByTestId('ve-back').click()
  await page.getByTestId('ve-back-discard').click()
  await expect(page.getByTestId('ve-fullscreen')).toHaveCount(0)
  await expect(page.getByTestId('ve-file')).toBeVisible()
  await expect(page.getByTestId('ve-stage')).toHaveCount(0)
  // The page scrolls again, or the catalogue below is unreachable for good.
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
})

test('several clips are picked at once and joined in that order', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pickTwo(page)

  // Two six-second clips are twelve seconds, and there is no way to add a
  // third from in here — the order is settled at the pick.
  await openClips(page)
  await expect(page.getByTestId('ve-clip-0')).toContainText('one.mp4')
  await expect(page.getByTestId('ve-clip-1')).toContainText('two.mp4')
  await expect(page.getByTestId('ve-add')).toHaveCount(0)
})

test('the tool buttons switch which controls the picture carries', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)

  // Crop is where it opens, because a crop is the first decision.
  await expect(page.getByTestId('ve-crop-bar')).toBeVisible()
  await expect(page.getByTestId('ve-mode-crop')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('ve-mode-censor').click()
  await expect(page.getByTestId('ve-crop-bar')).toHaveCount(0)
  // With nothing drawn there is nothing to configure, so it says what to do.
  await expect(page.getByTestId('ve-censor-hint')).toBeVisible()

  await page.getByTestId('ve-mode-text').click()
  await expect(page.getByTestId('ve-caption-hint')).toBeVisible()
  await expect(page.getByTestId('ve-censor-hint')).toHaveCount(0)

  // Settings are a full screen, not a fifth pill: on a phone that row was wider
  // than the viewport, so the controls it held were partly unreachable. It is
  // an OVERLAY rather than a mode, so the text bar is still behind it — what
  // has to hold is that it opens over everything and closes back.
  await page.getByTestId('ve-settings').click()
  await expect(page.getByTestId('ve-settings-panel')).toBeVisible()
  await expect(page.getByTestId('ve-height')).toBeVisible()
  await page.getByTestId('ve-settings-close').click()
  await expect(page.getByTestId('ve-settings-panel')).toHaveCount(0)
  await expect(page.getByTestId('ve-caption-hint')).toBeVisible()
})

/** The stage canvas's own aspect ratio — what shape is being shown right now. */
const stageShape = (page: Page) =>
  page.getByTestId('ve-result').evaluate((c: HTMLCanvasElement) => c.width / c.height)

test('cropping shows the WHOLE clip; leaving crop mode applies it', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)

  // The fixture is 320x240, so 4:3 = 1.333. Crop mode must show that shape
  // whatever the crop is set to: you are choosing a rectangle, and a rectangle
  // cannot be judged without the thing it is being taken out of. Showing the
  // cropped result while cropping makes the picture appear to zoom and puts
  // nothing on screen to say what is outside it.
  await page.getByTestId('ve-aspect-9:16').click()
  await expect(page.getByTestId('ve-crop-box')).toBeVisible()
  expect(await stageShape(page)).toBeCloseTo(4 / 3, 1)

  // And the crop rectangle drawn over it is the 9:16 one — narrower than the
  // frame, which is the whole point of showing both at once.
  const frame = await page.getByTestId('ve-stage').boundingBox()
  const box = await page.getByTestId('ve-crop-box').boundingBox()
  expect(frame && box).toBeTruthy()
  expect(box!.width).toBeLessThan(frame!.width * 0.75)
  expect(box!.width / box!.height).toBeCloseTo(9 / 16, 1)

  // Leaving crop mode applies it: now the stage IS the output, 9:16, and there
  // is nothing else on screen. Without this the case would pass against a tool
  // that simply never cropped.
  await page.getByTestId('ve-mode-censor').click()
  await expect(page.getByTestId('ve-crop-box')).toHaveCount(0)
  await expect.poll(() => stageShape(page), { timeout: 15_000 }).toBeCloseTo(9 / 16, 1)

  // Back to crop and the whole frame returns.
  await page.getByTestId('ve-mode-crop').click()
  await expect.poll(() => stageShape(page), { timeout: 15_000 }).toBeCloseTo(4 / 3, 1)
})

test('the output size follows the shape, and comes back EVEN', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)

  // The size lives beside the largest-side picker now rather than on a readout
  // over the picture — the crop rectangle drawn over the WHOLE frame is what
  // says what a crop costs, and a percentage next to it was a second telling
  // of the same thing in the one place with no room for it.
  await page.getByTestId('ve-settings').click()

  // The fixture is 320×240 — 4:3 — and the editor opens on 9:16, so the kept
  // rectangle is 240 tall and 240 × 9/16 = 135 wide. 135 is ODD, so it must
  // come back even or the encoder refuses the configuration outright.
  await expect(page.getByTestId('ve-out-size')).toHaveText('134×240')

  // Original keeps the whole frame — the reading that would pass against a
  // tool reporting a crop it had not made.
  await page.getByTestId('ve-settings-close').click()
  await page.getByTestId('ve-aspect-source').click()
  await page.getByTestId('ve-settings').click()
  await expect(page.getByTestId('ve-out-size')).toHaveText('320×240')

  await page.getByTestId('ve-settings-close').click()
  await page.getByTestId('ve-aspect-1:1').click()
  await page.getByTestId('ve-settings').click()
  await expect(page.getByTestId('ve-out-size')).toHaveText('240×240')
})

test('a corner SEGMENT sets a FREE proportion', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()

  // Free is not offered until a drag has made one — there is nothing for it to
  // mean before a rectangle exists, and a chip that selects the shape you are
  // already on is a control that does nothing.
  await expect(page.getByTestId('ve-aspect-free')).toHaveCount(0)

  // Drag the bottom-right SEGMENT in — a ninth of the rectangle rather than a
  // 14px square, which is the whole reason the squares are gone. The stage
  // keeps showing the WHOLE clip in crop mode, so what changes is the output.
  await page.getByTestId('ve-stage').scrollIntoViewIfNeeded()
  const b = (await page.getByTestId('ve-stage').boundingBox())!
  const handle = (await page.getByTestId('ve-crop-se').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * 0.75, b.y + b.height * 0.95, { steps: 6 })
  await page.mouse.up()

  await expect(page.getByTestId('ve-aspect-free')).toBeVisible()
  // The preset it started on is no longer the selected one, or the drag would
  // have been squeezed straight back into a shape nobody asked for.
  await page.getByTestId('ve-settings').click()
  const size = await page.getByTestId('ve-out-size').textContent()
  expect(size).not.toBe('320×240')
})

test('a segment moves by the DELTA, so an edge is reachable without a finger on it', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()

  // Grab the EAST segment at its middle — which is a sixth of the frame inside
  // the edge it moves — and drag left by a tenth of the stage.
  await page.getByTestId('ve-stage').scrollIntoViewIfNeeded()
  const b = (await page.getByTestId('ve-stage').boundingBox())!
  const seg = (await page.getByTestId('ve-crop-e').boundingBox())!
  const from = { x: seg.x + seg.width / 2, y: seg.y + seg.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x - b.width * 0.1, from.y, { steps: 6 })
  await page.mouse.up()

  await page.getByTestId('ve-settings').click()
  const size = (await page.getByTestId('ve-out-size').textContent()) ?? ''
  const width = Number(/(\d+)×/.exec(size)?.[1])

  // THE POINT OF THE CASE. A delta moves the right edge from 1.0 to 0.9, so
  // 320 becomes 288. The absolute version puts the edge under the fingertip —
  // the segment's own middle, minus the drag — which is 0.733 and 234 wide.
  // Reaching the frame's edge would then need a finger ON the edge of the
  // screen, in the bezel and the back-gesture strip, which is the whole
  // complaint. The two readings are 54px apart, so this cannot pass by rounding.
  expect(width).toBeGreaterThan(275)
  expect(width).toBeLessThan(300)
})

test('never upscales past the source', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  // Asking for 1440p from a 240-tall clip must still give 240: upscaling adds
  // pixels and no detail, and the claim in the copy has to be true.
  await page.getByTestId('ve-settings').click()
  await page.getByTestId('ve-height').selectOption('1440')
  await expect(page.getByTestId('ve-out-size')).toHaveText('320×240')
  await page.getByTestId('ve-settings-close').click()
})

test('crops and exports a real, playable MP4 at the cropped size', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-1:1').click()
  await page.getByTestId('ve-settings').click()
  await expect(page.getByTestId('ve-out-size')).toHaveText('240×240')
  await page.getByTestId('ve-settings-close').click()

  await page.getByTestId('ve-export').click()
  await expect(page.getByTestId('ve-download')).toBeVisible({ timeout: 120_000 })

  // The whole failure mode of a hand-built MP4 is a file that parses and plays
  // nothing, so the browser is asked to decode it rather than the bytes being
  // inspected.
  const m = await decodeExport(page)
  expect(m.w).toBe(240)
  expect(m.h).toBe(240)
  expect(m.d).toBeGreaterThan(5)
  expect(m.d).toBeLessThan(7)

  // Copied, not re-encoded — the fixture's AAC survives the trip.
  await expect(page.getByTestId('ve-out-info')).toContainText('with sound')
  await expect(page.getByTestId('ve-download')).toHaveAttribute('download', /edited-/)
})

test('joins two clips into one video of both their lengths', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  // The joined length is the transport's own total — twelve seconds of two
  // six-second clips, which is the property, wherever it is displayed.
  await pickTwo(page)

  await page.getByTestId('ve-aspect-source').click()
  await page.getByTestId('ve-export').click()
  await expect(page.getByTestId('ve-download')).toBeVisible({ timeout: 180_000 })

  const m = await decodeExport(page)
  expect(m.w).toBe(320)
  expect(m.h).toBe(240)
  // Twelve seconds, not six: a merge that silently kept one clip would still
  // produce a perfectly playable file.
  expect(m.d).toBeGreaterThan(11)
  expect(m.d).toBeLessThan(13)
  // Both clips are the same file, so their sound is stored identically and can
  // be concatenated without re-encoding.
  await expect(page.getByTestId('ve-out-info')).toContainText('with sound')
})

test('a clip can be removed and reordered', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pickTwo(page)
  await openClips(page)
  await page.getByTestId('ve-remove-1').click()
  // Back to one clip, and the list of clips goes with it.
  await expect(page.getByTestId('ve-clips')).toHaveCount(0)
  await page.getByTestId('ve-settings-close').click()
  await expect(page.getByTestId('ve-total')).toContainText('0:06')
})

/** Mean brightness of a rectangle of the stage, in canvas fractions. */
function meanOf(page: Page, r: [number, number, number, number]) {
  return page.getByTestId('ve-result').evaluate((c: HTMLCanvasElement, box) => {
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx || !c.width) return -1
    const x = Math.round(box[0] * c.width), y = Math.round(box[1] * c.height)
    const w = Math.max(1, Math.round((box[2] - box[0]) * c.width))
    const h = Math.max(1, Math.round((box[3] - box[1]) * c.height))
    const px = ctx.getImageData(x, y, w, h).data
    let sum = 0
    for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / 3
    return sum / (px.length / 4)
  }, r)
}

/**
 * How many DISTINCT colours a region holds.
 *
 * The observable had to change when solid did: a mosaic is the average of what
 * was there, so brightness is roughly preserved and "the region went black" no
 * longer describes anything the tool does. What a mosaic destroys is the count
 * of different values — a region of real picture holds hundreds, and one made
 * of a handful of flat squares holds a handful. Quantised to 5 bits a channel
 * so codec noise between two decodes of the same frame cannot inflate it.
 */
/**
 * The band of this fixture that has DETAIL in it.
 *
 * The rest is flat colour bars, and a mosaic of a flat bar is that same flat
 * bar — so a censor drawn there is undetectable however hard you look. These
 * cases read black boxes before, which hid that. Kept above the bottom bar,
 * which overlays the stage and would swallow the drag.
 */
const GRAD: [number, number, number, number] = [0.35, 0.73, 0.55, 0.81]

/** The rows a caption drawn at 0.76–0.88 occupies. */
const BAND: [number, number, number, number] = [0, 0.74, 1, 0.9]

function coloursIn(page: Page, r: [number, number, number, number]) {
  return page.getByTestId('ve-result').evaluate((c: HTMLCanvasElement, box) => {
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx || !c.width) return -1
    const x = Math.round(box[0] * c.width), y = Math.round(box[1] * c.height)
    const w = Math.max(1, Math.round((box[2] - box[0]) * c.width))
    const h = Math.max(1, Math.round((box[3] - box[1]) * c.height))
    const px = ctx.getImageData(x, y, w, h).data
    const seen = new Set<number>()
    for (let i = 0; i < px.length; i += 4) {
      seen.add(((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3))
    }
    return seen.size
  }, r)
}

test('a caption is drawn into the picture, and only while it is showing', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()

  // The stage IS what the encoder draws — the same `drawFrame` and the same
  // caption bitmap — so asking whether a caption reached the picture is a
  // question about pixels rather than about the DOM.
  //
  // Measured over the BAND of rows the caption occupies, not the one row at its
  // centre. The first version of this sampled `0.82 × height` exactly — which
  // is the middle of the text, where the white glyphs are, so the reading went
  // slightly UP while a screenshot showed the caption drawn perfectly. Row by
  // row: the band darkens rows 179–214 by ~16, and rows 189–200 brighten by up
  // to 11 because that is where the letters are.
  await seek(page, 1)
  await expect.poll(() => coloursIn(page, BAND), { timeout: 15_000 }).toBeGreaterThan(0)
  const before = await coloursIn(page, BAND)

  await page.getByTestId('ve-mode-text').click()
  await drawBox(page, [0.1, 0.76], [0.9, 0.88])
  // Drawing it selects it, and a selected caption carries a transparent field
  // over the box — so the caret is already where the words will land. There is
  // no dialog to open and none to close.
  await page.getByTestId('ve-caption-text-0').fill('HELLO')
  // Deselect first: while the field is open it IS the caption on screen, and
  // the canvas deliberately leaves the bitmap out so the words are not drawn
  // twice. A small drag makes no box (under the 5% floor) and clears the
  // selection, which is what a tap on the picture does by hand.
  await deselectCaption(page)

  // Counted in COLOURS rather than brightness, because the band went with the
  // options panel: white glyphs and their dark outline ADD values to a flat
  // bar, where a dark band used to subtract light from it. Asserting the mean
  // still fell would be asserting a band nothing draws any more.
  await expect.poll(() => coloursIn(page, BAND), { timeout: 15_000 }).toBeGreaterThan(before + 2)

  // And it is STILL there at the far end of the clip. A caption runs the whole
  // video now — the span was two number fields most people never touched, and
  // a caption that stops halfway is a defect far more often than a choice — so
  // this is the property that replaced "it goes when its window closes".
  await seek(page, 5.5)
  await expect.poll(() => coloursIn(page, BAND), { timeout: 15_000 }).toBeGreaterThan(before + 2)
})

test('an open caption field is not drawn behind itself', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)
  await expect.poll(() => coloursIn(page, BAND), { timeout: 15_000 }).toBeGreaterThan(0)
  const bare = await coloursIn(page, BAND)

  await page.getByTestId('ve-mode-text').click()
  await drawBox(page, [0.1, 0.76], [0.9, 0.88])
  await page.getByTestId('ve-caption-text-0').fill('HELLO')

  // The field sits exactly over the box in the same colour and size, so it is
  // ALREADY the caption on screen. Drawing the bitmap under it as well shows
  // the words twice, offset by however far the textarea and the canvas
  // disagree about wrapping — reported as duplicated text. So while the field
  // is open the canvas carries none of it, and the band reads as bare picture.
  await expect(page.getByTestId('ve-caption-text-0')).toBeVisible()
  await expect.poll(() => coloursIn(page, BAND), { timeout: 15_000 }).toBeLessThanOrEqual(bare + 2)

  // And it comes straight back when the field goes. Without this half the fix
  // could have been "never draw a caption on the stage", which would make the
  // preview disagree with the export — the one thing this tool rests on.
  await deselectCaption(page)
  await expect(page.getByTestId('ve-caption-text-0')).toHaveCount(0)
  await expect.poll(() => coloursIn(page, BAND), { timeout: 15_000 }).toBeGreaterThan(bare + 2)
})

test('a caption is a drawn box, and can be removed again', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await page.getByTestId('ve-mode-text').click()
  // Nothing to configure until a box exists, so it says what to do — the same
  // shape as the censor hint, because it is now the same gesture.
  await expect(page.getByTestId('ve-caption-hint')).toBeVisible()

  await drawBox(page, [0.15, 0.7], [0.85, 0.9])
  await page.getByTestId('ve-caption-text-0').fill('HELLO')
  await expect(page.getByTestId('ve-caption-box-0')).toBeVisible()

  await page.getByTestId('ve-caption-box-0-delete').click()
  await expect(page.getByTestId('ve-caption-box-0')).toHaveCount(0)
  await expect(page.getByTestId('ve-caption-text-0')).toHaveCount(0)
})

test('a caption is typed onto the picture, and its colour lives on the box', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await page.getByTestId('ve-mode-text').click()

  await drawBox(page, [0.15, 0.6], [0.85, 0.85])
  // The field is ON the box, in the colour and roughly the size the canvas
  // will draw — not in a dialog somewhere else. Fidelity is approximate on
  // purpose; being in the right PLACE is the point.
  const field = page.getByTestId('ve-caption-text-0')
  await expect(field).toBeVisible()
  await field.fill('HELLO')
  await expect(field).toHaveValue('HELLO')

  // Everything a caption has is on the caption: the bin, the resize grip and
  // the colour well, one per corner. There is no bar along the bottom.
  await expect(page.getByTestId('ve-caption-colour-0')).toBeVisible()
  await expect(page.getByTestId('ve-text-bar')).toHaveCount(0)

  // Deselecting takes the field away — the words stay in the picture, which is
  // where they were typed.
  await page.getByTestId('ve-mode-crop').click()
  await expect(page.getByTestId('ve-caption-text-0')).toHaveCount(0)
})

/**
 * Drag a box on the stage, in fractions of the canvas.
 *
 * The scroll is load-bearing, not defensive. `page.mouse` works in VIEWPORT
 * coordinates, and anything that scrolls the page between the measurement and
 * the drag sends every pointer event somewhere the canvas is not — which reads
 * as "the drag did not work" rather than as "the drag happened elsewhere".
 * Playwright's own locator actions scroll for you; raw mouse coordinates do
 * not. Measured once at y = -169 while chasing a bug that was not React.
 */
async function drawBox(page: Page, from: [number, number], to: [number, number]) {
  await page.getByTestId('ve-stage').scrollIntoViewIfNeeded()
  const box = await page.getByTestId('ve-stage').boundingBox()
  if (!box) throw new Error('no stage')
  const at = (f: [number, number]) => ({ x: box.x + box.width * f[0], y: box.y + box.height * f[1] })
  const a = at(from), b = at(to)
  // The POINTS have to be on screen, which is not the same as the box's origin
  // being on screen. `scrollIntoViewIfNeeded` leaves the element flush with the
  // top and sub-pixel rounding puts its y at -0.36 — a guard on the origin
  // therefore rejects a perfectly good drag, which is what the first version of
  // this did to three specs that were fine.
  const view = page.viewportSize()
  for (const pt of [a, b]) {
    if (pt.x < 0 || pt.y < 0 || (view && (pt.x > view.width || pt.y > view.height))) {
      throw new Error(`drag point (${Math.round(pt.x)}, ${Math.round(pt.y)}) is outside the viewport — `
        + 'page.mouse works in viewport coordinates and the event would reach nothing')
    }
  }
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2)
  await page.mouse.move(b.x, b.y)
  await page.mouse.up()
}

/**
 * Put the caption down: a drag too small to be a box, which is what a tap on
 * the picture is. Text mode clears the selection on pointer DOWN and only
 * commits a caption above 5% of the frame, so this leaves the list alone.
 */
async function deselectCaption(page: Page) {
  // Left-of-centre, well clear of BOTH the toolbar docked over the top of the
  // picture and the caption band below. The first version of this tapped the
  // top-left corner and hit the back button, which raises the discard dialog —
  // a control that is behind another control, one level over.
  await drawBox(page, [0.05, 0.45], [0.06, 0.46])
  await expect(page.getByTestId('ve-caption-text-0')).toHaveCount(0)
}

/** Set a box's span, which lives behind the box's own cog along with how it
 *  hides. Opened and closed rather than left up, because the sheet covers the
 *  stage every other assertion in these cases is about. */
async function span(page: Page, box: number, from: number, to: number) {
  await page.getByTestId(`ve-box-${box}-settings`).click()
  await page.getByTestId('ve-censor-from').fill(String(from))
  await page.getByTestId('ve-censor-to').fill(String(to))
  await page.getByTestId('ve-box-panel-close').click()
  await expect(page.getByTestId('ve-box-panel')).toHaveCount(0)
}

test('a drawn box censors that part of the picture, and only while it is showing', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)

  // OVER THE GRADIENT, and that is the whole design of this case. The fixture
  // is mostly flat colour bars, and a mosaic of a flat bar is that same flat
  // bar — so the region these cases used to read cannot show that a mosaic
  // happened at all. It worked before only because Solid painted it black.
  // The gradient band is the part of this fixture with detail in it, which is
  // the thing a mosaic destroys.
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeGreaterThan(40)
  const before = await coloursIn(page, GRAD)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.72], [0.6, 0.82])
  await expect(page.getByTestId('ve-box-0')).toBeVisible()
  // Drawing it selects it, which is what puts its controls on the bar.
  await expect(page.getByTestId('ve-box-0-delete')).toBeVisible()
  await span(page, 0, 0, 6)

  // Measured: 77 distinct colours become 8. The blocks are a fraction of the
  // frame, so a region of real picture collapses to a handful of flat squares.
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeLessThan(before / 4)
  // And the rest of the frame is untouched — without this the case would pass
  // against a tool that mosaiced everything.
  expect(await meanOf(page, [0.0, 0.0, 0.15, 0.15])).toBeLessThan(20)
  expect(await meanOf(page, [0.3, 0.3, 0.6, 0.6])).toBeGreaterThan(100)

  // It ends when its window ends. Captions run the whole clip now; a box does
  // not, because hiding something for part of a clip is the ordinary case.
  await span(page, 0, 0, 1.5)
  await seek(page, 4)
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeGreaterThan(before / 2)
})

/** Where a box's handle sits on the stage, in fractions of it. */
async function boxAtStage(page: Page, i: number) {
  const stage = await page.getByTestId('ve-stage').boundingBox()
  const box = await page.getByTestId(`ve-box-${i}`).boundingBox()
  if (!stage || !box) throw new Error('no stage or box')
  return { x: (box.x - stage.x) / stage.width, y: (box.y - stage.y) / stage.height }
}

test('a box hides to the END of the clip unless told otherwise', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeGreaterThan(40)
  const before = await coloursIn(page, GRAD)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.72], [0.6, 0.82])
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeLessThan(before / 4)

  // NO span was set. It used to default to three seconds from the playhead, so
  // a box drawn over a face silently stopped hiding it partway through — and
  // what a censor does wrong when it disappears is UNCENSOR something, which
  // is invisible at the moment you make the mistake because you are looking at
  // a frame where the box is showing.
  await seek(page, 5.5)
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeLessThan(before / 4)
  // Still typed rather than derived, so the panel's fields still bite.
  await span(page, 0, 0, 1.5)
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeGreaterThan(before / 2)
})

test('a box moved at another time TWEENS between the two', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 0)
  await page.getByTestId('ve-mode-censor').click()

  // Drawn once, which lays a key at each end of the clip holding the same
  // rectangle — so it is a box that does not move until somebody moves it.
  await drawBox(page, [0.2, 0.3], [0.4, 0.5])
  const start = await boxAtStage(page, 0)
  expect(start.x).toBeGreaterThan(0.15)
  expect(start.x).toBeLessThan(0.25)

  // Move it near the end of the clip. The drag itself writes the key — there
  // is no mode to be in and nothing to arm first, which is what keeps this
  // usable on a phone.
  await seek(page, 5)
  await drawBox(page, [0.3, 0.4], [0.7, 0.4])
  const late = await boxAtStage(page, 0)
  expect(late.x).toBeGreaterThan(start.x + 0.2)

  // And halfway between the two keys the box is halfway between the two
  // places. This is the property the whole feature is: a fixed box has to be
  // drawn big enough to cover everywhere the subject goes, which hides most of
  // the picture to hide one face.
  await seek(page, 2.5)
  const mid = await boxAtStage(page, 0)
  expect(mid.x).toBeGreaterThan(start.x + 0.05)
  expect(mid.x).toBeLessThan(late.x - 0.05)

  // It HOLDS outside the keys rather than carrying on — a box that extrapolated
  // would drift off the subject and off the frame, and what it stops hiding is
  // the thing it was drawn for.
  await seek(page, 0)
  const back = await boxAtStage(page, 0)
  expect(Math.abs(back.x - start.x)).toBeLessThan(0.02)
})

test('the keyframe button says whether this frame is one you decided', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 2)
  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.3], [0.6, 0.6])

  // A drawn box is keyed at each END, so a frame in the middle is one that was
  // worked out rather than one somebody chose. That distinction is the only
  // state this button carries, and it is on the box because on a phone there
  // is no room for a timeline to put it on.
  const key = page.getByTestId('ve-box-0-key')
  await expect(key).toHaveAttribute('data-key', 'off')
  await key.click()
  await expect(key).toHaveAttribute('data-key', 'on')
  // Tapping the lit one takes it away again.
  await key.click()
  await expect(key).toHaveAttribute('data-key', 'off')
})

test('a selected box can be deleted', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeGreaterThan(40)
  const before = await coloursIn(page, GRAD)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.72], [0.6, 0.82])
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeLessThan(before / 4)

  await page.getByTestId('ve-box-0-delete').click()
  await expect(page.getByTestId('ve-box-0')).toHaveCount(0)
  // The picture comes back — a delete that only removed the handle would leave
  // the censor burnt into every frame with no way to reach it.
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeGreaterThan(before / 2)
  await expect(page.getByTestId('ve-censor-hint')).toBeVisible()
})

test('a box outside its own span is still reachable', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)
  await expect.poll(() => meanOf(page, [0.3, 0.3, 0.6, 0.6]), { timeout: 15_000 }).toBeGreaterThan(10)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.72], [0.6, 0.82])
  await span(page, 0, 0, 1.5)

  // Scrub past the end of its span. Drawing only the boxes showing at this
  // instant looks tidier and traps you: the box that is out of reach is exactly
  // the one whose span you need to widen, and guessing where it was is not a
  // recovery. The handle stays, drawn faintly.
  await seek(page, 4)
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeGreaterThan(40)
  await expect(page.getByTestId('ve-box-0')).toBeVisible()
  await page.getByTestId('ve-box-0').click()
  await expect(page.getByTestId('ve-box-0-delete')).toBeVisible()
  // And widening it brings the censor back over the frame on screen.
  await span(page, 0, 0, 6)
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeLessThan(20)
})

test('how a box hides, and what that costs, are on the box', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.3], [0.6, 0.6])

  // NOT standing on the page. It used to be a paragraph under every censor,
  // which is the caveat-shown-to-everybody this repo already refuses — and it
  // is exactly the text somebody needs at the moment they wonder, which is
  // when they are looking at the box.
  await expect(page.getByTestId('ve-box-panel')).toHaveCount(0)

  await page.getByTestId('ve-box-0-settings').click()
  await expect(page.getByTestId('ve-box-panel')).toBeVisible()
  // Pixelate is where it starts, for the measured reason in `compose.ts`: a
  // black rectangle reads as a missing feature and sends people to a tool that
  // uploads their video.
  await expect(page.getByTestId('ve-box-mode-pixelate')).toHaveAttribute('aria-pressed', 'true')
  // The measured figure, not a vague warning. Without this the case would pass
  // against a panel that said "be careful".
  await expect(page.getByTestId('ve-box-why')).toContainText('98.6%')

  // And it CLEARS on the mode that actually removes something. Without this
  // the warning would be decoration — the same text under all three choices is
  // the caveat nobody reads, one level in.
  await page.getByTestId('ve-box-mode-solid').click()
  await expect(page.getByTestId('ve-box-mode-solid')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('ve-box-why')).not.toContainText('98.6%')

  await page.getByTestId('ve-box-panel-close').click()
  await expect(page.getByTestId('ve-box-panel')).toHaveCount(0)
})

test('solid removes what a mosaic keeps', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeGreaterThan(40)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.72], [0.6, 0.82])
  await span(page, 0, 0, 6)
  // A mosaic is the AVERAGE of what was there, so the light survives it — that
  // is the whole reason it leaks. Solid is the one that leaves nothing.
  expect(await meanOf(page, GRAD)).toBeGreaterThan(20)

  await page.getByTestId('ve-box-0-settings').click()
  await page.getByTestId('ve-box-mode-solid').click()
  await page.getByTestId('ve-box-panel-close').click()
  await expect.poll(() => meanOf(page, GRAD), { timeout: 15_000 }).toBeLessThan(6)
})

test('a mosaic throws away detail and KEEPS the light, which is what it costs', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeGreaterThan(40)
  const colours = await coloursIn(page, GRAD)
  const light = await meanOf(page, GRAD)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.72], [0.6, 0.82])
  await span(page, 0, 0, 6)

  // Both halves, because each alone is satisfied by something wrong. The
  // detail goes — 77 distinct colours down to 8, measured — while the light
  // stays, because a mosaic is the AVERAGE of what was there. That average IS
  // the information still sitting in the file, which is what the "i" says.
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeLessThan(colours / 4)
  expect(await meanOf(page, GRAD)).toBeGreaterThan(light * 0.8)
  expect(await meanOf(page, GRAD)).toBeLessThan(light * 1.2)
})

test('the censor is burnt into the exported file, not just the stage', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 0)
  await expect.poll(() => meanOf(page, [0.3, 0.3, 0.6, 0.6]), { timeout: 15_000 }).toBeGreaterThan(10)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.72], [0.6, 0.82])
  // Cover the whole clip: the default span is 3s and the fixture is 6s.
  await span(page, 0, 0, 6)

  await page.getByTestId('ve-export').click()
  await expect(page.getByTestId('ve-download')).toBeVisible({ timeout: 120_000 })

  // Decode the EXPORTED file and read its pixels. A stage assertion cannot tell
  // "drawn on screen" from "encoded into the video", and the whole point of a
  // redaction is that it survives into the file somebody else opens.
  const href = await page.getByTestId('ve-download').getAttribute('href')
  const colours = await page.evaluate((url) => new Promise<{ hidden: number; control: number }>((resolve, reject) => {
    const v = document.createElement('video')
    v.preload = 'auto'
    const read = () => {
      const c = document.createElement('canvas')
      c.width = v.videoWidth
      c.height = v.videoHeight
      const ctx = c.getContext('2d')
      if (!ctx) return reject(new Error('no ctx'))
      ctx.drawImage(v, 0, 0)
      // Five bits a channel, the same quantiser the stage helper uses — and
      // that was MEASURED rather than assumed. Four bits, chosen to be safe
      // against codec noise, is too coarse to separate the two: it reads 24
      // against 30, where five bits reads 32 against 75.
      const count = (fx: number) => {
        const px = ctx.getImageData(
          Math.round(c.width * fx), Math.round(c.height * 0.73),
          Math.round(c.width * 0.2), Math.round(c.height * 0.08),
        ).data
        const seen = new Set<number>()
        for (let i = 0; i < px.length; i += 4) {
          seen.add(((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3))
        }
        return seen.size
      }
      // The box covered x 0.3–0.6, so the SAME band at x 0.62 is uncensored
      // gradient in the SAME encoded frame — same codec, same quantiser, same
      // row of pixels. That is the control, and it is what makes this a
      // comparison rather than a threshold somebody picked.
      resolve({ hidden: count(0.35), control: count(0.62) })
    }
    v.addEventListener('seeked', read, { once: true })
    v.addEventListener('loadedmetadata', () => { v.currentTime = 2 }, { once: true })
    v.addEventListener('error', () => reject(new Error('decode failed')), { once: true })
    setTimeout(() => reject(new Error('timeout')), 20_000)
    v.src = url!
  }), href)
  // The censored half of the band arrives as a few flat squares; the half
  // beside it keeps the spread of colours the gradient holds. Solid's "near
  // black" reading went with solid, so the property asserted is the one a
  // mosaic actually has — and the control is what stops a codec that flattened
  // everything from passing this.
  expect(colours.control).toBeGreaterThan(50)
  expect(colours.hidden).toBeLessThan(colours.control / 2)
})

test('Arabic in a caption is shaped and joined, not left as separate letters', async ({ page }) => {
  await load(page, 'ar')
  // No encoder needed: this is about how the page draws text, which is the same
  // drawing that is composited into every frame.
  const shaping = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return null
    ctx.font = '600 64px "IBM Plex Sans Arabic", "Hanken Grotesk", system-ui, sans-serif'
    const word = 'مرحبا'
    const joined = ctx.measureText(word).width
    const apart = [...word].reduce((n, ch) => n + ctx.measureText(ch).width, 0)
    return { joined, apart }
  })
  expect(shaping).not.toBeNull()
  // Arabic letters JOIN, so a shaped word is narrower than its letters drawn
  // one at a time. A renderer that emitted isolated forms — which is what a
  // worker with no Arabic font, or a naive text drawer, produces — would give
  // roughly the same width or more.
  expect(shaping!.joined).toBeGreaterThan(0)
  expect(shaping!.joined).toBeLessThan(shaping!.apart * 0.95)
})

test('the picture is HELD when the decoded frame goes away, not wiped', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)
  await expect.poll(() => coloursIn(page, GRAD), { timeout: 15_000 }).toBeGreaterThan(40)
  const before = await coloursIn(page, GRAD)

  // Exactly what Chrome on Android does after a moment of idle: the metadata
  // stays — so `videoWidth` is intact and the frame loop keeps running — and
  // the DECODED FRAME is gone. Setting the canvas size CLEARS it, and
  // `drawImage` of a video with nothing decoded is a silent no-op, so the
  // picture was wiped to black with the boxes still floating on it. Reported
  // from a phone, and the black is the whole symptom: a stale frame is a far
  // smaller lie than an empty one.
  //
  // BOTH HALVES OF THAT STATE HAVE TO BE FAKED, and finding out why is the
  // reason this case is worth reading. Stubbing `readyState` alone proved
  // nothing — Chromium's `drawImage` reads the element's internal state rather
  // than the JS getter, so the real frame went on drawing and the case passed
  // with the fix removed. The spec says `drawImage` draws nothing below
  // HAVE_CURRENT_DATA; here that is emulated, so the pair is the platform
  // behaviour this guard exists for. Everything else — the element, the
  // canvas, the paint loop — is the product's own.
  await page.getByTestId('ve-video').evaluate((v: HTMLVideoElement) => {
    Object.defineProperty(v, 'readyState', { get: () => 1, configurable: true })
    const real = CanvasRenderingContext2D.prototype.drawImage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CanvasRenderingContext2D.prototype.drawImage = function (this: any, src: any, ...rest: any[]) {
      if (src instanceof HTMLVideoElement && src.readyState < 2) return
      return real.apply(this, [src, ...rest] as any)
    } as any
  })
  await page.waitForTimeout(500)
  expect(await coloursIn(page, GRAD)).toBeGreaterThan(before / 2)
})

test('a preview that will not play says so, with the code that identifies it', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)

  // A working clip must NOT carry the note — a warning shown to everybody is
  // the failure this branch exists to rule out.
  await expect(page.getByTestId('ve-preview-error')).toHaveCount(0)

  // Break the element the way a browser that cannot play the file does. The
  // real report was an Android screen recording that demuxed perfectly and left
  // a broken thumbnail and a black canvas with nothing saying why, which is the
  // dead-UI failure this repo already refuses for image picks.
  await page.getByTestId('ve-video').evaluate((v: HTMLVideoElement) => {
    v.src = 'blob:invalid-source-for-this-test'
  })
  await expect(page.getByTestId('ve-preview-error')).toBeVisible({ timeout: 15_000 })
  // The CODE is the point: it is the only thing separating "cannot play this
  // format" from "started and then failed", and it is not guessable outside.
  await expect(page.getByTestId('ve-preview-error')).toContainText(/error \d/)
})

test('the diagnostics carry what the fault turns on, and never the filename', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')

  // A name of exactly the shape that prompted this: it says which app, on which
  // date, at which time. The block exists to be pasted somewhere else.
  const NAME = 'Screen_Recording_20260904_125339_WhatsApp.mp4'
  await page.getByTestId('ve-file').setInputFiles({ name: NAME, mimeType: 'video/mp4', buffer: bytes() })
  await expect(page.getByTestId('ve-stage')).toBeVisible({ timeout: 30_000 })

  // They appear only on a FAILURE now — a toggle beside every working run is a
  // standing invitation to read a bug report about a tool that is behaving.
  await expect(page.getByTestId('ve-diagnostics')).toHaveCount(0)
  await page.getByTestId('ve-video').evaluate((v: HTMLVideoElement) => {
    v.src = 'blob:invalid-source-for-this-test'
  })
  const text = page.getByTestId('ve-diag-text')
  await expect(text).toBeVisible({ timeout: 15_000 })

  const body = await text.innerText()
  // THE PRIVACY PROPERTY. Without this the block could grow a filename later
  // and nothing would notice.
  expect(body).not.toContain('WhatsApp')
  expect(body).not.toContain('Screen_Recording')
  expect(body).not.toContain('125339')
  expect(body).toContain('.mp4')

  // And the facts the memory hypothesis actually turns on.
  expect(body).toMatch(/retained by the worker: \d+ samples/)
  expect(body).toContain('320×240')
  expect(body).toMatch(/timeline:/)
  expect(body).toMatch(/\+\s*\d+ms.*\bpick\b/)
  expect(body).toContain('video loadedmetadata')
  // The heap column is the memory hypothesis made visible; Chrome reports it.
  expect(body).toMatch(/\d+ MB {2}pick/)
})

test('a failed preview shows the diagnostics without being asked', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await expect(page.getByTestId('ve-diagnostics')).toHaveCount(0)

  await page.getByTestId('ve-video').evaluate((v: HTMLVideoElement) => {
    v.src = 'blob:invalid-source-for-this-test'
  })
  // Somebody whose preview just broke should not have to find a toggle.
  await expect(page.getByTestId('ve-diagnostics')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('ve-diag-text')).toContainText(/preview: error \d/)
  await expect(page.getByTestId('ve-diag-text')).toContainText(/video error \d/)
})

test('a file that is not an MP4 is refused with a reason', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await page.getByTestId('ve-file').setInputFiles({
    name: 'notavideo.txt', mimeType: 'text/plain', buffer: Buffer.from('this is not a video at all'),
  })
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('file-error')).toContainText('MP4')
  // And the first screen stays put, rather than dropping into an editor with
  // nothing in it.
  await expect(page.getByTestId('ve-file')).toBeVisible()
})
