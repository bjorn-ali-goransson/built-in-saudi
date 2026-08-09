import { test, expect } from '@playwright/test'

// HEIC has to survive the WHOLE tool, not just the front door.
//
// Found by a code sweep for direct `createImageBitmap` calls: two tools probed
// the picked file with `decodeImage` — the documented rule — and then handed
// the raw File to a path that could not decode it. So an iPhone photo was
// accepted, listed, thumbnailed, and died at the point of doing the work. The
// pick-time check satisfied its letter and not its purpose.
//
// The fixture is a real HEIF still; ffmpeg cannot make one (see CLAUDE.md).

test('images to PDF: a HEIC survives to the export, not just the list', async ({ page }) => {
  await page.goto('/en/apps/images-to-pdf')
  await page.getByTestId('i2p-drop').locator('input[type="file"]')
    .setInputFiles('e2e/fixtures/sample.heic')
  await expect(page.getByTestId('i2p-list')).toBeVisible({ timeout: 30_000 })

  // The export is where it used to throw: `toPngBytes` called
  // `createImageBitmap` directly while the pick path used the decoder.
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('i2p-create').click()
  await page.getByTestId('i2p-download').click()
  const file = await dl
  expect(file.suggestedFilename()).toMatch(/\.pdf$/)
})

test('steganography: a HEIC can actually carry a message', async ({ page }) => {
  // The tool probed with `decodeImage` at pick time and then posted the File to
  // a worker whose own `createImageBitmap` threw. A worker cannot call
  // `decodeImage` without nesting another worker, so it falls back to
  // `decodeHeic` in place — the pattern `imageEncode.worker.ts` already used.
  await page.goto('/en/apps/steganography')
  await page.getByTestId('stego-drop').locator('input[type="file"]')
    .setInputFiles('e2e/fixtures/sample.heic')
  await page.getByTestId('stego-message').fill('from an iPhone')
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('stego-embed').click()
  await dl
  await expect(page.getByTestId('stego-error')).toHaveCount(0)
})

test('an ordinary PNG still never fetches the HEIC decoder', async ({ page }) => {
  // The fallback must stay a fallback: the wasm is ~1.4MB and is only worth
  // fetching when the bytes actually say HEIC. Without this the fixes above
  // could have been "always use the heavy path".
  const heic: string[] = []
  page.on('request', (r) => { if (/libheif|heic/i.test(r.url())) heic.push(r.url()) })
  await page.goto('/en/apps/images-to-pdf')
  await page.getByTestId('i2p-drop').locator('input[type="file"]')
    .setInputFiles('e2e/fixtures/diff-small.png')
  await expect(page.getByTestId('i2p-list')).toBeVisible({ timeout: 20_000 })
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('i2p-create').click()
  await page.getByTestId('i2p-download').click()
  await dl
  expect(heic, 'the HEIC decoder was fetched for a PNG').toEqual([])
})
