import { test, expect } from '@playwright/test'

/** Draw a real image in the page and hand it to a file input. */
async function attach(page: import('@playwright/test').Page, testId: string, w: number, h: number) {
  const dataUrl = await page.evaluate(([cw, ch]) => {
    const c = document.createElement('canvas')
    c.width = cw; c.height = ch
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#3f8f6d'; ctx.fillRect(0, 0, cw, ch)
    ctx.fillStyle = '#c2903a'; ctx.fillRect(0, 0, cw / 2, ch / 2)
    return c.toDataURL('image/png')
  }, [w, h])
  await page.getByTestId(testId).setInputFiles({
    name: 'shot.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
  })
}

test.describe('wheel of names', () => {
  test('needs two names before it will spin', async ({ page }) => {
    await page.goto('/en/apps/spin-wheel')
    await expect(page.getByTestId('sw-spin')).toBeDisabled()
    await page.getByTestId('sw-names').fill('Ahmed')
    await expect(page.getByTestId('sw-count')).toHaveText('1 name')
    await expect(page.getByTestId('sw-spin')).toBeDisabled()
    await page.getByTestId('sw-names').fill('Ahmed\nFatimah')
    await expect(page.getByTestId('sw-spin')).toBeEnabled()
  })

  test('spinning picks one of the names', async ({ page }) => {
    await page.goto('/en/apps/spin-wheel')
    await page.getByTestId('sw-names').fill('Ahmed\nFatimah\nKhalid')
    await page.getByTestId('sw-spin').click()
    await expect(page.getByTestId('sw-winner')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('sw-winner-name')).toHaveText(/^(Ahmed|Fatimah|Khalid)$/)
  })

  test('removing the winner shrinks the list', async ({ page }) => {
    await page.goto('/en/apps/spin-wheel')
    await page.getByTestId('sw-names').fill('A\nB\nC')
    await page.getByTestId('sw-autoremove').check()
    await page.getByTestId('sw-spin').click()
    await expect(page.getByTestId('sw-winner')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('sw-count')).toHaveText('2 names')
  })

  test('the list survives a reload', async ({ page }) => {
    await page.goto('/en/apps/spin-wheel')
    await page.getByTestId('sw-names').fill('Noura\nSalem')
    await expect(page.getByTestId('sw-count')).toHaveText('2 names')
    await page.reload()
    await expect(page.getByTestId('sw-names')).toHaveValue('Noura\nSalem')
  })
})

test.describe('cron builder', () => {
  test('writes the expression for each preset', async ({ page }) => {
    await page.goto('/en/apps/cron-builder')
    await expect(page.getByTestId('cb-expr')).toHaveText('0 9 * * *')
    await page.getByTestId('cb-preset-minutely').click()
    await expect(page.getByTestId('cb-expr')).toHaveText('*/5 * * * *')
    await page.getByTestId('cb-preset-weekly').click()
    await expect(page.getByTestId('cb-expr')).toHaveText('0 9 * * 1')
    await page.getByTestId('cb-day-5').click()
    await expect(page.getByTestId('cb-expr')).toHaveText('0 9 * * 1,5')
  })

  test('lists the next runs', async ({ page }) => {
    await page.goto('/en/apps/cron-builder')
    await expect(page.getByTestId('cb-runs').locator('li')).toHaveCount(5)
  })

  test('a hand-typed expression is parsed, and a bad one is rejected', async ({ page }) => {
    await page.goto('/en/apps/cron-builder')
    await page.getByTestId('cb-preset-custom').click()
    await page.getByTestId('cb-custom').fill('30 14 * * 1-5')
    await expect(page.getByTestId('cb-runs').locator('li')).toHaveCount(5)
    await page.getByTestId('cb-custom').fill('nonsense here')
    await expect(page.getByTestId('cb-invalid')).toBeVisible()
  })

  test('an impossible date reports that it never runs', async ({ page }) => {
    await page.goto('/en/apps/cron-builder')
    await page.getByTestId('cb-preset-custom').click()
    // 30 February never happens.
    await page.getByTestId('cb-custom').fill('0 0 30 2 *')
    await expect(page.getByTestId('cb-never')).toBeVisible()
  })

  test('warns about the day-of-month / day-of-week OR trap', async ({ page }) => {
    await page.goto('/en/apps/cron-builder')
    await page.getByTestId('cb-preset-custom').click()
    await page.getByTestId('cb-custom').fill('0 0 1 * 1')
    await expect(page.getByText(/fire when EITHER matches/)).toBeVisible()
  })
})
