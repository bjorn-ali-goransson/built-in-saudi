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

/** The second file input lives behind the overflow ("⋯") bar, as power features do. */
async function addAnother(page: Page) {
  await page.getByTestId('ve-mode-more').click()
  await page.getByTestId('ve-add').setInputFiles({ name: 'second.mp4', mimeType: 'video/mp4', buffer: bytes() })
  await expect(page.getByTestId('ve-clip-1')).toBeVisible({ timeout: 30_000 })
}

/** Show the picture at `sec` and wait for the stage to have drawn something. */
async function seek(page: Page, sec: number) {
  await page.getByTestId('ve-video').evaluate((v: HTMLVideoElement, s) => { v.currentTime = s }, sec)
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

test('the tool buttons switch which controls the picture carries', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)

  // Crop is where it opens, because a crop is the first decision.
  await expect(page.getByTestId('ve-crop-bar')).toBeVisible()
  await expect(page.getByTestId('ve-mode-crop')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('ve-mode-censor').click()
  await expect(page.getByTestId('ve-censor-bar')).toBeVisible()
  await expect(page.getByTestId('ve-crop-bar')).toHaveCount(0)
  // With nothing drawn there is nothing to configure, so it says what to do.
  await expect(page.getByTestId('ve-censor-hint')).toBeVisible()

  await page.getByTestId('ve-mode-text').click()
  await expect(page.getByTestId('ve-text-bar')).toBeVisible()
  await expect(page.getByTestId('ve-censor-bar')).toHaveCount(0)

  await page.getByTestId('ve-mode-more').click()
  await expect(page.getByTestId('ve-more-bar')).toBeVisible()
  await expect(page.getByTestId('ve-text-bar')).toHaveCount(0)
})

test('says what a crop costs, and the output size follows the shape', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)

  // The fixture is 320×240 — 4:3. Cropped to 9:16 the kept rectangle is
  // 135×240, which is 135×240 / 320×240 = 42% of the frame.
  await page.getByTestId('ve-aspect-9:16').click()
  await expect(page.getByTestId('ve-kept')).toContainText('42%')
  // 240 tall, 240 × 9/16 = 135 wide — and 135 is ODD, so it must come back
  // even or the encoder refuses the configuration outright.
  await expect(page.getByTestId('ve-out-size')).toHaveText('134×240')

  // Square from the same frame keeps 240×240 of 320×240 = 75%.
  await page.getByTestId('ve-aspect-1:1').click()
  await expect(page.getByTestId('ve-kept')).toContainText('75%')
  await expect(page.getByTestId('ve-out-size')).toHaveText('240×240')

  // And the original keeps all of it — the case that would pass against a tool
  // that always reported a loss.
  await page.getByTestId('ve-aspect-source').click()
  await expect(page.getByTestId('ve-kept')).toContainText('100%')
  await expect(page.getByTestId('ve-out-size')).toHaveText('320×240')
})

test('never upscales past the source', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  // Asking for 1440p from a 240-tall clip must still give 240: upscaling adds
  // pixels and no detail, and the claim in the copy has to be true.
  await page.getByTestId('ve-mode-more').click()
  await page.getByTestId('ve-height').selectOption('1440')
  await page.getByTestId('ve-mode-crop').click()
  await expect(page.getByTestId('ve-out-size')).toHaveText('320×240')
})

test('crops and exports a real, playable MP4 at the cropped size', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-1:1').click()
  await expect(page.getByTestId('ve-out-size')).toHaveText('240×240')

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
  await pick(page)
  await addAnother(page)
  await expect(page.getByTestId('ve-total')).toContainText('2 clips')
  await expect(page.getByTestId('ve-total')).toContainText('0:12')

  await page.getByTestId('ve-mode-crop').click()
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
  await pick(page)
  await addAnother(page)
  await expect(page.getByTestId('ve-total')).toContainText('0:12')
  await page.getByTestId('ve-remove-1').click()
  // Back to one clip, and the list of clips goes with it.
  await expect(page.getByTestId('ve-clips')).toHaveCount(0)
  await expect(page.getByTestId('ve-total')).toContainText('1 clip')
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
  const bandMean = () => meanOf(page, [0, 0.74, 1, 0.9])

  await seek(page, 1)
  await expect.poll(bandMean, { timeout: 15_000 }).toBeGreaterThan(0)
  const before = await bandMean()

  await page.getByTestId('ve-mode-text').click()
  await page.getByTestId('ve-caption-add').click()
  await page.getByTestId('ve-caption-from').fill('0')
  await page.getByTestId('ve-caption-to').fill('2')
  await page.getByTestId('ve-caption-text').fill('HELLO')

  // The band plus the text darkens those rows noticeably.
  await expect.poll(bandMean, { timeout: 15_000 }).toBeLessThan(before - 4)

  // And it goes when its window closes. Without this the case would pass
  // against a tool that painted every caption over the whole clip.
  await page.getByTestId('ve-caption-to').fill('0.5')
  await expect.poll(bandMean, { timeout: 15_000 }).toBeGreaterThan(before - 2)
})

test('a caption can be removed again', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-mode-text').click()
  await page.getByTestId('ve-caption-add').click()
  await page.getByTestId('ve-caption-text').fill('HELLO')
  await expect(page.getByTestId('ve-caption-box-0')).toBeVisible()
  await page.getByTestId('ve-caption-remove').click()
  await expect(page.getByTestId('ve-caption-box-0')).toHaveCount(0)
  await expect(page.getByTestId('ve-caption-text')).toHaveCount(0)
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

test('a drawn box censors that part of the picture, and only while it is showing', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)

  const REGION: [number, number, number, number] = [0.3, 0.3, 0.6, 0.6]
  await expect.poll(() => meanOf(page, REGION), { timeout: 15_000 }).toBeGreaterThan(10)
  const before = await meanOf(page, REGION)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.3], [0.6, 0.6])
  await expect(page.getByTestId('ve-box-0')).toBeVisible()
  // Drawing it selects it, which is what puts its controls on the bar.
  await expect(page.getByTestId('ve-box-delete-0')).toBeVisible()

  // Solid is the default, so that region of the picture is now black.
  await expect.poll(() => meanOf(page, [0.35, 0.35, 0.55, 0.55]), { timeout: 15_000 }).toBeLessThan(8)
  // And the rest of the frame is untouched — without this the case would pass
  // against a tool that blacked out everything.
  expect(await meanOf(page, [0.0, 0.0, 0.15, 0.15])).toBeGreaterThan(10)

  // It ends when its window ends. The box defaults to a 3s span from t=1.
  await page.getByTestId('ve-censor-to').fill('1.5')
  await seek(page, 4)
  await expect.poll(() => meanOf(page, [0.35, 0.35, 0.55, 0.55]), { timeout: 15_000 }).toBeGreaterThan(before * 0.5)
})

test('a selected box can be deleted', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)
  await expect.poll(() => meanOf(page, [0.3, 0.3, 0.6, 0.6]), { timeout: 15_000 }).toBeGreaterThan(10)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.3], [0.6, 0.6])
  await expect.poll(() => meanOf(page, [0.35, 0.35, 0.55, 0.55]), { timeout: 15_000 }).toBeLessThan(8)

  await page.getByTestId('ve-box-delete-0').click()
  await expect(page.getByTestId('ve-box-0')).toHaveCount(0)
  // The picture comes back — a delete that only removed the handle would leave
  // the censor burnt into every frame with no way to reach it.
  await expect.poll(() => meanOf(page, [0.35, 0.35, 0.55, 0.55]), { timeout: 15_000 }).toBeGreaterThan(10)
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
  await drawBox(page, [0.3, 0.3], [0.6, 0.6])
  await page.getByTestId('ve-censor-to').fill('1.5')

  // Scrub past the end of its span. Drawing only the boxes showing at this
  // instant looks tidier and traps you: the box that is out of reach is exactly
  // the one whose span you need to widen, and guessing where it was is not a
  // recovery. The handle stays, drawn faintly.
  await seek(page, 4)
  await expect.poll(() => meanOf(page, [0.35, 0.35, 0.55, 0.55]), { timeout: 15_000 }).toBeGreaterThan(10)
  await expect(page.getByTestId('ve-box-0')).toBeVisible()
  await page.getByTestId('ve-box-0').click()
  await expect(page.getByTestId('ve-box-delete-0')).toBeVisible()
  // And widening it brings the censor back over the frame on screen.
  await page.getByTestId('ve-censor-to').fill('6')
  await expect.poll(() => meanOf(page, [0.35, 0.35, 0.55, 0.55]), { timeout: 15_000 }).toBeLessThan(8)
})

test('solid is the default, and choosing a recoverable mode says why', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)
  await expect.poll(() => meanOf(page, [0.3, 0.3, 0.6, 0.6]), { timeout: 15_000 }).toBeGreaterThan(10)
  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.3], [0.6, 0.6])

  // No warning for the safe default — a caveat shown to everybody is one
  // nobody reads, which is the failure this branch exists to rule out.
  await expect(page.getByTestId('ve-censor-warning')).toHaveCount(0)

  await page.getByTestId('ve-censor-pixelate').click()
  await expect(page.getByTestId('ve-censor-warning')).toBeVisible()
  await expect(page.getByTestId('ve-censor-warning')).toContainText('98.6%')

  await page.getByTestId('ve-censor-block').click()
  await expect(page.getByTestId('ve-censor-warning')).toHaveCount(0)
})

test('pixelating keeps the colours it is hiding, which is why it is not the default', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 1)
  const REGION: [number, number, number, number] = [0.35, 0.35, 0.55, 0.55]
  await expect.poll(() => meanOf(page, REGION), { timeout: 15_000 }).toBeGreaterThan(10)
  const before = await meanOf(page, REGION)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.3], [0.6, 0.6])
  await page.getByTestId('ve-censor-pixelate').click()

  // A mosaic is the AVERAGE of what was there, so the region keeps roughly its
  // brightness — the visual difference from a solid box, and the reason the
  // information is still in the file.
  await expect.poll(() => meanOf(page, REGION), { timeout: 15_000 }).toBeGreaterThan(before * 0.5)
})

test('the censor is burnt into the exported file, not just the stage', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('ve-aspect-source').click()
  await seek(page, 0)
  await expect.poll(() => meanOf(page, [0.3, 0.3, 0.6, 0.6]), { timeout: 15_000 }).toBeGreaterThan(10)

  await page.getByTestId('ve-mode-censor').click()
  await drawBox(page, [0.3, 0.3], [0.6, 0.6])
  // Cover the whole clip: the default span is 3s and the fixture is 6s.
  await page.getByTestId('ve-censor-from').fill('0')
  await page.getByTestId('ve-censor-to').fill('6')

  await page.getByTestId('ve-export').click()
  await expect(page.getByTestId('ve-download')).toBeVisible({ timeout: 120_000 })

  // Decode the EXPORTED file and read its pixels. A stage assertion cannot tell
  // "drawn on screen" from "encoded into the video", and the whole point of a
  // redaction is that it survives into the file somebody else opens.
  const href = await page.getByTestId('ve-download').getAttribute('href')
  const mean = await page.evaluate((url) => new Promise<number>((resolve, reject) => {
    const v = document.createElement('video')
    v.preload = 'auto'
    const read = () => {
      const c = document.createElement('canvas')
      c.width = v.videoWidth
      c.height = v.videoHeight
      const ctx = c.getContext('2d')
      if (!ctx) return reject(new Error('no ctx'))
      ctx.drawImage(v, 0, 0)
      const px = ctx.getImageData(
        Math.round(c.width * 0.35), Math.round(c.height * 0.35),
        Math.round(c.width * 0.2), Math.round(c.height * 0.2),
      ).data
      let sum = 0
      for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / 3
      resolve(sum / (px.length / 4))
    }
    v.addEventListener('seeked', read, { once: true })
    v.addEventListener('loadedmetadata', () => { v.currentTime = 2 }, { once: true })
    v.addEventListener('error', () => reject(new Error('decode failed')), { once: true })
    setTimeout(() => reject(new Error('timeout')), 20_000)
    v.src = url!
  }), href)
  // Black in the encoded frame. H.264 is lossy, so this is "near black" rather
  // than exactly zero.
  expect(mean).toBeLessThan(12)
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

  // Not shown until asked for, while everything is working.
  await expect(page.getByTestId('ve-diagnostics')).toHaveCount(0)
  await page.getByTestId('ve-diag-toggle').click()
  const text = page.getByTestId('ve-diag-text')
  await expect(text).toBeVisible()

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
  // A working clip must not be described as having an error.
  expect(body).toContain('preview: playing, no error')
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
