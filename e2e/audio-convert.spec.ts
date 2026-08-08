import { test, expect } from '@playwright/test'

async function open(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/audio-convert`)
  await expect(page.getByTestId('audio-convert')).toBeVisible()
  await page.getByTestId('ac-file').setInputFiles('e2e/fixtures/speech.wav')
  await expect(page.getByTestId('ac-source')).toBeVisible({ timeout: 15000 })
}

test.describe('audio converter', () => {
  test('it reads the source and defaults to changing nothing', async ({ page }) => {
    await open(page)
    // "Keep" on both axes, so the output line mirrors the input.
    const source = await page.getByTestId('ac-source').innerText()
    const out = await page.getByTestId('ac-out').innerText()
    expect(out.split('·')[0].trim()).toBe(source.split('·')[0].trim())
    // Nothing changed, so there is no size delta to report.
    await expect(page.getByTestId('ac-delta')).toHaveCount(0)
  })

  test('16 kHz mono is dramatically smaller, and the tool says so before converting', async ({ page }) => {
    await open(page)
    await page.getByTestId('ac-rate-16000').click()
    await page.getByTestId('ac-ch-1').click()
    await expect(page.getByTestId('ac-out')).toContainText('16')
    // The whole point of showing the estimate is that the choice is made before
    // waiting for the encode.
    const delta = await page.getByTestId('ac-delta').innerText()
    expect(delta).toMatch(/smaller/i)
  })

  test('a higher rate is honestly reported as larger, not hidden', async ({ page }) => {
    await open(page)
    await page.getByTestId('ac-rate-48000').click()
    await page.getByTestId('ac-ch-2').click()
    // speech.wav is mono at a low rate, so this genuinely inflates it — and a
    // converter that only ever claims to shrink things is lying half the time.
    await expect(page.getByTestId('ac-delta')).toContainText(/larger/i)
  })

  test('it converts and downloads a WAV', async ({ page }) => {
    await open(page)
    await page.getByTestId('ac-rate-16000').click()
    await page.getByTestId('ac-ch-1').click()
    const dl = page.waitForEvent('download')
    await page.getByTestId('ac-download').click()
    const file = await dl
    expect(file.suggestedFilename()).toMatch(/\.wav$/)
  })

  test('it says why the output is WAV rather than MP3', async ({ page }) => {
    // The stance is deliberate and documented in lib/audio.ts; a tool that just
    // silently lacked MP3 would read as a missing feature.
    await open(page)
    await expect(page.getByTestId('ac-wav-note')).toContainText('MP3')
    await expect(page.getByTestId('ac-speech-note')).toContainText('16 kHz')
  })

  test('an undecodable file is named as such rather than failing silently', async ({ page }) => {
    await page.goto('/en/apps/audio-convert')
    await page.getByTestId('ac-file').setInputFiles({
      name: 'not-audio.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('this is not audio at all, not even slightly'),
    })
    await expect(page.getByTestId('file-error')).toBeVisible()
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, 'ar')
    await expect(page.getByTestId('ac-speech-note')).toContainText('كيلوهرتز')
  })
})
