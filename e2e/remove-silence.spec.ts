import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The fixture is 1s of tone, 2s of true silence, 1s of tone — so what should
// survive is knowable to the tenth of a second. Regenerate with:
//   ffmpeg -f lavfi -i "sine=frequency=440:duration=1" \
//          -f lavfi -i "anullsrc=r=44100:cl=mono:duration=2" \
//          -f lavfi -i "sine=frequency=660:duration=1" \
//          -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]" -map "[out]" \
//          -ar 44100 -ac 1 speech.wav
const WAV = readFileSync(fileURLToPath(new URL('./fixtures/speech.wav', import.meta.url)))

async function load(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/remove-silence`)
  await page.getByTestId('rs-file').setInputFiles({ name: 'speech.wav', mimeType: 'audio/wav', buffer: WAV })
  await expect(page.getByTestId('rs-waveform')).toBeVisible({ timeout: 20_000 })
}

const secs = (t: string) => {
  const [m, s] = t.split(':').map(Number)
  return m * 60 + s
}

/**
 * Read a duration once it has settled.
 *
 * `innerText()` takes one snapshot and does not retry, unlike `toHaveText`. The
 * analysis runs after the waveform appears, so a plain read can catch the value
 * mid-computation — which passed every time this file ran alone and failed
 * under the full suite. Wait for the thing under test, not for time to pass.
 */
async function settled(page: import('@playwright/test').Page, testId: string) {
  await expect.poll(async () => secs(await page.getByTestId(testId).innerText())).toBeGreaterThan(0)
  return secs(await page.getByTestId(testId).innerText())
}

test('finds the silence and reports what it will remove', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('rs-before')).toHaveText(/0:04/)
  await expect(page.getByTestId('rs-found')).toContainText('1 silence')
  // 2s of silence, minus 0.12s of padding at each end.
  const saved = await settled(page, 'rs-saved')
  expect(saved).toBeGreaterThan(1.5)
  expect(saved).toBeLessThan(2)
})

test('keeps a margin at each edge rather than cutting flush', async ({ page }) => {
  await load(page)
  const withPad = await settled(page, 'rs-saved')
  await page.getByTestId('rs-padding').fill('0')
  const noPad = await settled(page, 'rs-saved')
  // Without padding the whole 2 seconds goes; with it, less does. A cut made
  // flush against the silence clips the breath before the next word.
  expect(noPad).toBeGreaterThan(withPad)
  expect(noPad).toBeGreaterThan(1.9)
})

test('the threshold decides what counts as silent', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('rs-found')).toContainText('1 silence')
  // Nothing in this file is quieter than -90dB except the true silence, and a
  // tone is nowhere near it — so a very low threshold still finds the gap.
  await page.getByTestId('rs-threshold').fill('-80')
  await expect(page.getByTestId('rs-found')).toContainText('1 silence')
  // Raise it above the tone and the whole file reads as silence, which the
  // minimum-length rule then treats as one long cut.
  await page.getByTestId('rs-threshold').fill('-10')
  await expect(page.getByTestId('rs-saved')).not.toHaveText('0:00')
})

test('a minimum length that no gap reaches finds nothing', async ({ page }) => {
  await load(page)
  await page.getByTestId('rs-min').fill('5')
  await expect(page.getByTestId('rs-found')).toContainText('No silence found')
  await expect(page.getByTestId('rs-apply')).toBeDisabled()
})

test('produces a shorter file the browser can actually play', async ({ page }) => {
  await load(page)
  await page.getByTestId('rs-apply').click()
  await expect(page.getByTestId('rs-result')).toBeVisible({ timeout: 30_000 })
  const meta = await page.getByTestId('rs-audio').evaluate((a: HTMLAudioElement) => new Promise<number>((res, rej) => {
    if (a.readyState >= 1) return res(a.duration)
    a.addEventListener('loadedmetadata', () => res(a.duration), { once: true })
    a.addEventListener('error', () => rej(new Error('decode failed')), { once: true })
    setTimeout(() => rej(new Error('timeout')), 15_000)
  }))
  // Two seconds of tone, plus the padding kept at each edge of the cut.
  expect(meta).toBeGreaterThan(2)
  expect(meta).toBeLessThan(2.6)
  await expect(page.getByTestId('rs-download')).toHaveAttribute('download', /trimmed\.wav$/)
})

test('a file that is not audio is refused with a reason', async ({ page }) => {
  await page.goto('/en/apps/remove-silence')
  await page.getByTestId('rs-file').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not audio at all'),
  })
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('file-error')).toContainText('MP3')
})

test('works in Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await expect(page.getByTestId('rs-found')).toContainText('سكتة')
})
