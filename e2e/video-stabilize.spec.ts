import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// A SYNTHESISED SHAKE, because the steady fixture cannot test this tool at all:
// a stabiliser run against `sample.mp4` corrects by nothing, crops by nothing,
// and passes every assertion having measured nothing. `scripts/make-shaky-mp4.mjs`
// builds it — a slow sway plus a fast wobble plus a bright marker at a fixed
// place in the world, so the cases below can ask whether the picture actually
// stopped moving rather than trusting a percentage.
const SHAKY = fileURLToPath(new URL('./fixtures/shaky.mp4', import.meta.url))
// The CONTROL, from the same generator with the camera nailed down. It cannot
// be `sample.mp4`: that clip's content moves, which any global estimator reads
// as camera motion and correctly reports as shake — so it would prove the
// steady branch unreachable rather than proving it right.
const STEADY = fileURLToPath(new URL('./fixtures/steady.mp4', import.meta.url))
/** The one fixture here with a sound track. */
const WITH_SOUND = fileURLToPath(new URL('./fixtures/sample.mp4', import.meta.url))

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
  await page.goto(`/${locale}/apps/video-stabilize`)
  await expect(page.getByTestId('video-stabilize')).toBeVisible()
}

async function pick(page: Page, file = SHAKY, name = 'shaky.mp4') {
  await page.getByTestId('vs-file').setInputFiles({ name, mimeType: 'video/mp4', buffer: readFileSync(file) })
  // The panel appears only once the whole clip has been measured, so waiting on
  // it is waiting on the analysis rather than on a timer.
  await expect(page.getByTestId('vs-panel')).toBeVisible({ timeout: 60_000 })
}

/** The kept-picture percentage the tool is showing, as a number. */
async function kept(page: Page): Promise<number> {
  const text = await page.getByTestId('vs-cost').textContent()
  const m = /(\d+)%/.exec(text ?? '')
  if (!m) throw new Error(`no percentage in ${JSON.stringify(text)}`)
  return Number(m[1])
}

/** The output size the tool is offering, read off the same line. */
async function outSize(page: Page): Promise<{ w: number; h: number }> {
  const text = await page.getByTestId('vs-cost').textContent()
  const m = /(\d+)×(\d+)/.exec(text ?? '')
  if (!m) throw new Error(`no size in ${JSON.stringify(text)}`)
  return { w: Number(m[1]), h: Number(m[2]) }
}

/**
 * How far the marker JUMPS between consecutive frames of a FILE, in fractions
 * of its own width.
 *
 * Three things about how this is measured, and each one cost a round:
 *
 * SUCCESSIVE DIFFERENCE, NOT OVERALL SPREAD. The tool deliberately keeps a pan
 * — what it removes is the difference between where the camera went and where
 * it was heading — so a clip built around a slow sway is supposed to still sway
 * at the end. Measuring total wander measures the thing the tool is designed
 * not to touch, and reported it as barely working.
 *
 * PLAYED, NOT SEEKED. Setting `currentTime` to consecutive frame times does not
 * step frame by frame: measured, the element handed back the SAME picture for
 * two of every three seeks. `requestVideoFrameCallback` fires once per frame
 * actually presented, with the frame already on screen.
 *
 * ON THE FILES, NOT ON THE STAGE. The steadied side is the EXPORT and the raw
 * side is the source blob the tool is holding, so both go through one function
 * here and neither depends on the app's own canvas being painted at the moment
 * the measurement runs.
 */
async function frameJitter(page: Page, url: string): Promise<{ jitter: number; frames: number }> {
  return page.evaluate(async (src) => {
    const v = document.createElement('video')
    v.src = src
    v.muted = true
    v.playsInline = true
    await new Promise((r, reject) => {
      v.addEventListener('loadedmetadata', r, { once: true })
      v.addEventListener('error', () => reject(new Error('would not decode')), { once: true })
    })
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    const pts: { x: number; y: number }[] = []
    await new Promise<void>((resolve) => {
      const onFrame = () => {
        ctx.drawImage(v, 0, 0)
        const d = ctx.getImageData(0, 0, c.width, c.height).data
        let sx = 0, sy = 0, n = 0
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            const o = (y * c.width + x) * 4
            // Near-white AND near-neutral: the world is coloured, the marker is
            // not — and the export has been through an encoder, so the
            // threshold has to leave room for that.
            const r = d[o], g = d[o + 1], b = d[o + 2]
            if (r > 200 && g > 200 && b > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 40) { sx += x; sy += y; n++ }
          }
        }
        if (n >= 12) pts.push({ x: sx / n / c.width, y: sy / n / c.height })
        if (pts.length >= 24 || v.ended) { v.pause(); resolve(); return }
        v.requestVideoFrameCallback(onFrame)
      }
      v.addEventListener('ended', () => resolve(), { once: true })
      v.requestVideoFrameCallback(onFrame)
      void v.play()
    })
    let sum = 0
    for (let i = 1; i < pts.length; i++) sum += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    return { jitter: pts.length > 1 ? sum / (pts.length - 1) : 0, frames: pts.length }
  }, url)
}

test('a browser without an H.264 encoder is told so, and pointed somewhere useful', async ({ page }) => {
  await load(page)
  if (await canEncode(page)) {
    // The other half, and the one that stops this being a warning shown to
    // everybody: on a browser that CAN do the job the gate must not fire.
    await expect(page.getByTestId('vs-unsupported')).toHaveCount(0)
    await expect(page.getByTestId('vs-file')).toHaveCount(1)
    return
  }
  await expect(page.getByTestId('vs-unsupported')).toBeVisible()
  await expect(page.getByTestId('vs-unsupported')).toContainText('WebCodecs')
})

test('the first screen asks for a file and nothing else', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await expect(page.getByTestId('vs-file')).toHaveCount(1)
  // Nothing to configure before there is a clip to configure it against —
  // controls nobody can act on teach nothing about the tool.
  await expect(page.getByTestId('vs-panel')).toHaveCount(0)
  await expect(page.getByTestId('vs-stage')).toHaveCount(0)
})

test('it measures the clip and prices the crop before anything is encoded', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)

  // The price is a real fraction of the picture, not a placeholder — and it is
  // on screen before the export button has been touched, which is the whole
  // difference from a tool that crops by a percentage you had to guess.
  const k = await kept(page)
  expect(k).toBeGreaterThan(50)
  expect(k).toBeLessThan(100)

  // Never larger than the source: upscaling adds pixels and no detail.
  const size = await outSize(page)
  expect(size.w).toBeLessThanOrEqual(320)
  expect(size.h).toBeLessThanOrEqual(180)
  // Even, or an H.264 encoder refuses the configuration outright — there is no
  // whole chroma sample for an odd last column.
  expect(size.w % 2).toBe(0)
  expect(size.h % 2).toBe(0)

  await expect(page.getByTestId('vs-removed')).toContainText(/[\d.]+ px/)
})

test('steadying harder costs more picture, and that is priced instantly', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)

  await page.getByTestId('vs-level-gentle').click()
  const gentle = await kept(page)
  const gentleSize = await outSize(page)

  await page.getByTestId('vs-level-strong').click()
  const strong = await kept(page)
  const strongSize = await outSize(page)

  // THE TRADE. A stronger setting fights the slow sway as well as the wobble,
  // so it has to slide the frames further and therefore crop harder. Measured
  // on this fixture at 92% against 82%; the assertion leaves room for the
  // encoder's own noise without being satisfiable by a rounding difference.
  expect(strong).toBeLessThan(gentle - 3)
  expect(strongSize.w).toBeLessThan(gentleSize.w)

  // And no second measurement pass: the clip is analysed once, so switching is
  // arithmetic over three numbers a frame. Without this the case would pass
  // against a tool that silently re-decoded the whole file on every click.
  await expect(page.getByTestId('vs-busy')).toHaveCount(0)
})

test('the picture stops jumping between frames, which is not the same as being cropped', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  await page.getByTestId('vs-level-strong').click()
  await page.getByTestId('vs-export').click()
  await expect(page.getByTestId('vs-download')).toBeVisible({ timeout: 120_000 })

  const raw = await frameJitter(page, (await page.getByTestId('vs-video').getAttribute('src'))!)
  const steadied = await frameJitter(page, (await page.getByTestId('vs-download').getAttribute('href'))!)

  // A measurement that saw two frames would satisfy any ratio. Assert it looked
  // at the clip before concluding anything from it.
  expect(raw.frames).toBeGreaterThan(12)
  expect(steadied.frames).toBeGreaterThan(12)

  // Simulated on the fixture's own camera path before the file was made: the
  // marker jumps about 5.6 times as far per frame before steadying as after.
  // A percentage on a panel says what the tool BELIEVES; this says what it
  // wrote into the file somebody downloads.
  expect(raw.jitter).toBeGreaterThan(steadied.jitter * 2.5)
})

test('the steadied clip exports as a real, playable MP4 at the cropped size', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  const size = await outSize(page)

  await page.getByTestId('vs-export').click()
  await expect(page.getByTestId('vs-download')).toBeVisible({ timeout: 120_000 })

  const href = await page.getByTestId('vs-download').getAttribute('href')
  expect(href).toMatch(/^blob:/)
  const meta = await page.evaluate((url) => new Promise<{ d: number; w: number; h: number }>((resolve, reject) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.addEventListener('loadedmetadata', () => resolve({ d: v.duration, w: v.videoWidth, h: v.videoHeight }), { once: true })
    v.addEventListener('error', () => reject(new Error('the exported file would not decode')), { once: true })
    setTimeout(() => reject(new Error('timeout decoding the exported file')), 20_000)
    v.src = url!
  }), href)

  expect(meta.w).toBe(size.w)
  expect(meta.h).toBe(size.h)
  // 60 frames at 24fps. The clip must come out the length it went in — a
  // stabiliser that quietly dropped frames would still look steady.
  expect(meta.d).toBeGreaterThan(2.2)
  expect(meta.d).toBeLessThan(2.8)
})

test('a clip with a sound track keeps it, and one without says so', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')

  // The synthetic fixture is silent, so the tool says so rather than offering a
  // checkbox that decides nothing.
  await pick(page)
  await expect(page.getByTestId('vs-no-audio')).toBeVisible()
  await expect(page.getByTestId('vs-audio')).toHaveCount(0)

  await page.getByTestId('vs-again').click()
  await pick(page, WITH_SOUND, 'sample.mp4')
  await expect(page.getByTestId('vs-audio')).toBeChecked()
  await expect(page.getByTestId('vs-no-audio')).toHaveCount(0)
})

test('a steady clip is told it is steady rather than sold a crop', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page, STEADY, 'steady.mp4')

  // The honest answer to a locked-off shot. Without this the tool would take
  // 8% of a tripod recording's picture to remove nothing.
  await expect(page.getByTestId('vs-steady')).toBeVisible()
  expect(await kept(page)).toBeGreaterThan(97)

  // And the shaky fixture must NOT say it, or the message is decoration.
  await page.getByTestId('vs-again').click()
  await pick(page)
  await expect(page.getByTestId('vs-steady')).toHaveCount(0)
})

test('a file that is not an MP4 is refused with a reason', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await page.getByTestId('vs-file').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('this is not a video'),
  })
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('vs-panel')).toHaveCount(0)
})

test('the Arabic side prints Arabic digits in the figures it computes', async ({ page }) => {
  await load(page, 'ar')
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await pick(page)
  // An Arabic test that only asserts prose tests nothing about the Arabic
  // rendering of anything COMPUTED — `toFixed` returns Latin digits whatever
  // the locale, which is exactly how this goes wrong.
  await expect(page.getByTestId('vs-cost')).toContainText(/[٠-٩]/)
  await expect(page.getByTestId('vs-removed')).toContainText(/[٠-٩]/)
})

test('what it cannot do is on the page, not implied away', async ({ page }) => {
  await load(page)
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await expect(page.getByTestId('vs-limits')).toBeVisible()
  await expect(page.getByTestId('vs-limits')).toContainText('rolling-shutter')
  await expect(page.getByTestId('vs-limits')).toContainText('blur')
})
