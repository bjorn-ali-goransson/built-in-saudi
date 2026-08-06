import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The fixture is a real 6-second H.264/AAC MP4 with a keyframe every second
// (ffmpeg -g 30 at 30fps), so the keyframe snapping has something honest to
// snap to. Regenerate with:
//   ffmpeg -f lavfi -i testsrc=size=320x240:rate=30:duration=6 \
//          -f lavfi -i sine=frequency=440:duration=6 \
//          -c:v libx264 -g 30 -pix_fmt yuv420p -c:a aac -shortest sample.mp4
const FIXTURE = fileURLToPath(new URL('./fixtures/sample.mp4', import.meta.url))
const bytes = () => readFileSync(FIXTURE)

async function load(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/video-trim`)
  await page.getByTestId('vt-file').setInputFiles({
    name: 'sample.mp4', mimeType: 'video/mp4', buffer: bytes(),
  })
  await expect(page.getByTestId('vt-bar')).toBeVisible({ timeout: 30_000 })
}

test('reads an MP4 and reports its real tracks', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('vt-tracks')).toContainText('320×240')
  await expect(page.getByTestId('vt-tracks')).toContainText('avc1')
  await expect(page.getByTestId('vt-tracks')).toContainText('mp4a')
  // Full length selected to begin with. The movie header says 5.93s, not a
  // round 6 — the track is 178 frames at 30fps, and reporting what the file
  // actually says beats rounding it to what ffmpeg was asked for.
  await expect(page.getByTestId('vt-duration')).toContainText(/0:0[56]\./)
})

test('the start snaps to a keyframe, and says so', async ({ page }) => {
  await load(page)
  // Ask for a start at 2.5s, which is NOT a keyframe in this file (they sit at
  // ~0.07, 1.07, 2.07 …). It must move back rather than silently produce a clip
  // that opens on broken frames.
  await page.getByTestId('vt-video').evaluate((v: HTMLVideoElement) => { v.currentTime = 2.5 })
  await page.getByTestId('vt-set-start').click()
  await expect(page.getByTestId('vt-snapped')).toBeVisible()
  await expect(page.getByTestId('vt-snapped')).toContainText('moves back')
  // Snapped back to the 2.07s keyframe — earlier than asked, never later.
  const started = await page.getByTestId('vt-start').innerText()
  expect(started).toMatch(/^0:0[12]\./)
})

test('trims to a real, playable MP4 that is shorter than the original', async ({ page }) => {
  await load(page)
  await page.getByTestId('vt-video').evaluate((v: HTMLVideoElement) => { v.currentTime = 4 })
  await page.getByTestId('vt-set-end').click()
  await page.getByTestId('vt-video').evaluate((v: HTMLVideoElement) => { v.currentTime = 2 })
  await page.getByTestId('vt-set-start').click()

  await page.getByTestId('vt-trim').click()
  await expect(page.getByTestId('vt-result')).toBeVisible({ timeout: 30_000 })

  // The output has to be a video the browser will actually decode — the whole
  // failure mode of a hand-built MP4 is a file that parses and plays nothing.
  const meta = await page.getByTestId('vt-out-video').evaluate((v: HTMLVideoElement) => new Promise<{ d: number; w: number; h: number }>((resolve, reject) => {
    const done = () => resolve({ d: v.duration, w: v.videoWidth, h: v.videoHeight })
    if (v.readyState >= 1) return done()
    v.addEventListener('loadedmetadata', done, { once: true })
    v.addEventListener('error', () => reject(new Error('decode failed')), { once: true })
    setTimeout(() => reject(new Error('timeout')), 15_000)
  }))
  expect(meta.w).toBe(320)
  expect(meta.h).toBe(240)
  // Roughly 2 seconds (start snapped back to ~1.07 or ~2.07), never the full 6.
  expect(meta.d).toBeGreaterThan(1)
  expect(meta.d).toBeLessThan(4)

  // And it is offered as a download, not left sitting in memory.
  await expect(page.getByTestId('vt-download')).toHaveAttribute('download', /trimmed-/)
})

test('a file that is not an MP4 is refused with a reason', async ({ page }) => {
  await page.goto('/en/apps/video-trim')
  await page.getByTestId('vt-file').setInputFiles({
    name: 'notavideo.txt', mimeType: 'text/plain', buffer: Buffer.from('this is not a video at all'),
  })
  // The shared FileError component, as every other file-taking tool uses.
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('file-error')).toContainText('WebM')
  await expect(page.getByTestId('vt-bar')).toHaveCount(0)
})

test('the heavy parser is not fetched until a video is chosen', async ({ page }) => {
  // mp4box is ~1MB. The catalogue page must not pay for it, exactly as the HEIC
  // decoder must not be fetched for an ordinary PNG.
  const asked: string[] = []
  page.on('request', (r) => asked.push(r.url()))
  await page.goto('/en/apps/video-trim')
  await expect(page.getByTestId('vt-file')).toBeAttached()
  await page.waitForTimeout(1500)
  expect(asked.some((u) => /mp4box/i.test(u))).toBe(false)
})

test('works in Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await expect(page.getByTestId('vt-tracks')).toContainText('320×240')
  await expect(page.getByTestId('vt-trim')).toBeVisible()
})
