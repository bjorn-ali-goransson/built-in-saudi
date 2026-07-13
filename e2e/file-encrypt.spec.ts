import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const input = () => '[data-testid="fe-drop"] input[type=file]'

test('file encrypt: round-trips a file, and rejects the wrong password', async ({ page }) => {
  await page.goto('/en/apps/file-encrypt')
  const original = 'built-in-saudi secret payload 123 — أهلاً'

  // Encrypt
  await page.locator(input()).setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from(original) })
  await page.getByTestId('fe-password').fill('correct horse battery')
  const dl1 = page.waitForEvent('download')
  await page.getByTestId('fe-run').click()
  const encBuf = readFileSync((await (await dl1).path())!)
  expect(encBuf.length).toBeGreaterThan(28) // salt(16)+iv(12)+ciphertext

  // Decrypt with the right password → original bytes back
  await page.getByText('Choose another file').click()
  await page.getByTestId('fe-decrypt').click()
  await page.locator(input()).setInputFiles({ name: 'note.txt.enc', mimeType: 'application/octet-stream', buffer: encBuf })
  await page.getByTestId('fe-password').fill('correct horse battery')
  const dl2 = page.waitForEvent('download')
  await page.getByTestId('fe-run').click()
  const decBuf = readFileSync((await (await dl2).path())!)
  expect(decBuf.toString()).toBe(original)

  // Wrong password → error, no download
  await page.getByText('Choose another file').click()
  await page.locator(input()).setInputFiles({ name: 'note.txt.enc', mimeType: 'application/octet-stream', buffer: encBuf })
  await page.getByTestId('fe-password').fill('nope')
  await page.getByTestId('fe-run').click()
  await expect(page.getByTestId('fe-error')).toBeVisible()
})
