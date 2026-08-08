import { test, expect } from '@playwright/test'

async function open(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/video-frames`)
  await expect(page.getByTestId('video-frames')).toBeVisible()
  await page.getByTestId('vf-file').setInputFiles('e2e/fixtures/sample.mp4')
  await expect(page.getByTestId('vf-size')).toBeVisible({ timeout: 20000 })
}

test.describe('video to image', () => {
  test('it reads the frame size off the video', async ({ page }) => {
    await open(page)
    await expect(page.getByTestId('vf-size')).toContainText('×')
  })

  test('it saves a single frame in the chosen format', async ({ page }) => {
    await open(page)
    await page.getByTestId('vf-format').selectOption('jpg')
    const dl = page.waitForEvent('download')
    await page.getByTestId('vf-save').click()
    const file = await dl
    expect(file.suggestedFilename()).toMatch(/\.jpg$/)
    // The filename carries the timestamp, so several stills from one clip do
    // not overwrite each other in the downloads folder.
    expect(file.suggestedFilename()).toMatch(/\d+\.\ds\./)
  })

  test('every-few-seconds says how many it will take, and zips them', async ({ page }) => {
    await open(page)
    await page.getByTestId('vf-mode-every').click()
    await page.getByTestId('vf-interval').fill('1')
    await expect(page.getByTestId('vf-count')).toBeVisible()
    const dl = page.waitForEvent('download')
    await page.getByTestId('vf-save').click()
    expect((await dl).suggestedFilename()).toMatch(/\.zip$/)
  })

  test('it states the seek limit rather than pretending to be frame-exact', async ({ page }) => {
    // A browser seeks to the nearest independently decodable frame. Claiming
    // millisecond accuracy would be a lie on any video with sparse keyframes,
    // so the frame is shown before it is saved and the limit is written down.
    await open(page)
    await expect(page.getByTestId('vf-seek-note')).toContainText('nearest frame')
  })

  test('a file that is not a video is refused, not left spinning', async ({ page }) => {
    await page.goto('/en/apps/video-frames')
    await page.getByTestId('vf-file').setInputFiles({
      name: 'not-a-video.bin', mimeType: 'application/octet-stream',
      buffer: Buffer.from('nothing playable in here'),
    })
    await expect(page.getByTestId('file-error')).toBeVisible()
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, 'ar')
    await expect(page.getByTestId('vf-seek-note')).toContainText('اللقطات المفتاحية')
  })
})
