import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The video editor took over three apps in November 2026: Video to GIF and
// Video to Image became its export formats, and the Video Stabilizer became
// its "Steady the shake" slider. These cases check each job is really done
// HERE — read off the downloaded file, not off a label the page prints.

const SAMPLE = fileURLToPath(new URL('./fixtures/sample.mp4', import.meta.url))
// The shaky fixture: a fast wobble and a slow sway around one bright marker
// fixed in the world (scripts/make-shaky-mp4.mjs). `steady.mp4` is the same
// world with the camera nailed down.
const SHAKY = fileURLToPath(new URL('./fixtures/shaky.mp4', import.meta.url))
const STEADY = fileURLToPath(new URL('./fixtures/steady.mp4', import.meta.url))

async function canEncode(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (typeof VideoEncoder === 'undefined') return false
    try {
      const s = await VideoEncoder.isConfigSupported({ codec: 'avc1.42001f', width: 640, height: 360, bitrate: 1_000_000, avc: { format: 'avc' } })
      return !!s.supported
    } catch { return false }
  })
}

async function open(page: Page, file = SAMPLE, name = 'clip.mp4') {
  await page.goto('/en/apps/video-edit')
  await expect(page.getByTestId('video-edit')).toBeVisible()
  test.skip(!(await canEncode(page)), 'no H.264 encoder in this browser')
  await page.getByTestId('ve-file').setInputFiles({ name, mimeType: 'video/mp4', buffer: readFileSync(file) })
  await expect(page.getByTestId('ve-stage')).toBeVisible({ timeout: 30_000 })
}

async function settings(page: Page, fn: () => Promise<void>) {
  await page.getByTestId('ve-settings').click()
  await expect(page.getByTestId('ve-settings-panel')).toBeVisible()
  await fn()
  await page.getByTestId('ve-settings-close').click()
}

async function exportFile(page: Page): Promise<{ href: string; name: string; head: number[]; size: number }> {
  await page.getByTestId('ve-export').click()
  const dl = page.getByTestId('ve-download')
  await expect(dl).toBeVisible({ timeout: 180_000 })
  const href = (await dl.getAttribute('href'))!
  const name = (await dl.getAttribute('download'))!
  const { head, size } = await page.evaluate(async (u) => {
    const b = new Uint8Array(await (await fetch(u)).arrayBuffer())
    return { head: Array.from(b.subarray(0, 8)), size: b.length }
  }, href)
  return { href, name, head, size }
}

test('the editor saves a GIF of the edit, which used to be its own app', async ({ page }) => {
  await open(page)
  await settings(page, async () => {
    await page.getByTestId('ve-format-gif').click()
    await expect(page.getByTestId('ve-format-note')).toContainText('GIF')
  })
  const f = await exportFile(page)
  expect(f.name).toMatch(/\.gif$/)
  // GIF89a, read off the bytes — the format, not a label.
  expect(String.fromCharCode(...f.head.slice(0, 6))).toBe('GIF89a')
  // More than one frame: count the image descriptors.
  const frames = await page.evaluate(async (u) => {
    const b = new Uint8Array(await (await fetch(u)).arrayBuffer())
    let n = 0
    for (let i = 0; i < b.length - 1; i++) if (b[i] === 0x21 && b[i + 1] === 0xf9) n++
    return n
  }, f.href)
  expect(frames).toBeGreaterThan(10)
})

test('the editor saves the frame on screen as a picture at the output size', async ({ page }) => {
  await open(page)
  await page.getByTestId('ve-aspect-source').click()
  await settings(page, async () => { await page.getByTestId('ve-format-png').click() })
  const size = (await page.getByTestId('ve-out-size').textContent({ timeout: 1000 }).catch(() => null))
  const f = await exportFile(page)
  expect(f.name).toMatch(/\.png$/)
  expect(f.head.slice(0, 4)).toEqual([0x89, 0x50, 0x4e, 0x47])
  const dims = await page.evaluate(async (u) => {
    const img = new Image()
    img.src = u
    await img.decode()
    return `${img.naturalWidth}×${img.naturalHeight}`
  }, f.href)
  // The source shape of the 320×240 fixture, never upscaled.
  expect(dims).toBe(size ?? '320×240')
})

/**
 * How far one bright marker, nailed to the world, jumps between consecutive
 * presented frames — measured on the FILES, so neither side depends on when the
 * app's own canvas happened to repaint.
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

async function steady(page: Page, seconds: number) {
  await settings(page, async () => {
    const slider = page.getByTestId('ve-steady')
    // Enabled only once the camera's movement has been measured.
    await expect(slider).toBeEnabled({ timeout: 60_000 })
    await slider.fill(String(seconds))
  })
}

test('steadying a shaky clip stops the picture jumping, in the file', async ({ page }) => {
  await open(page, SHAKY, 'shaky.mp4')
  await page.getByTestId('ve-aspect-source').click()
  await steady(page, 1.5)
  const f = await exportFile(page)
  const raw = await frameJitter(page, (await page.getByTestId('ve-video').getAttribute('src'))!)
  const steadied = await frameJitter(page, f.href)
  expect(raw.frames).toBeGreaterThan(12)
  expect(steadied.frames).toBeGreaterThan(12)
  // The Video Stabilizer measured 5.6x on this fixture; the editor runs the
  // same correction through its own pipeline, so it must at least halve it.
  expect(raw.jitter).toBeGreaterThan(steadied.jitter * 2.5)
})

test('steadying says what it costs, and costs nothing on a clip that is already steady', async ({ page }) => {
  await open(page, SHAKY, 'shaky.mp4')
  await steady(page, 1.5)
  await page.getByTestId('ve-settings').click()
  const shaky = Number(await page.getByTestId('ve-steady-note').getAttribute('data-kept'))
  expect(shaky).toBeLessThan(95)
  await expect(page.getByTestId('ve-steady-note')).toContainText('%')

  await open(page, STEADY, 'steady.mp4')
  await steady(page, 1.5)
  await page.getByTestId('ve-settings').click()
  const still = Number(await page.getByTestId('ve-steady-note').getAttribute('data-kept'))
  expect(still).toBeGreaterThan(shaky)
})

for (const [from] of [['video-gif'], ['video-frames'], ['video-stabilize']]) {
  test(`${from} now lives in the video editor`, async ({ page }) => {
    await page.goto(`/en/apps/${from}`)
    await expect(page).toHaveURL(/\/en\/apps\/video-edit\/?$/)
  })
}
