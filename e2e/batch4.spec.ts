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

test.describe('screenshot beautifier', () => {
  test('frames the image and reports the output size', async ({ page }) => {
    await page.goto('/en/apps/screenshot-frame')
    await attach(page, 'sf-file', 400, 300)
    await expect(page.getByTestId('sf-preview')).toBeVisible()
    // 8% padding on the longest edge (400) = 32px each side → 464 × 364.
    await expect(page.getByTestId('sf-size')).toHaveText('Output 464 × 364')
  })

  test('a forced shape grows the short side instead of cropping', async ({ page }) => {
    await page.goto('/en/apps/screenshot-frame')
    await attach(page, 'sf-file', 400, 300)
    await page.getByTestId('sf-ratio').selectOption('1:1')
    await expect(page.getByTestId('sf-size')).toHaveText('Output 464 × 464')
  })

  test('the export scale multiplies the output', async ({ page }) => {
    await page.goto('/en/apps/screenshot-frame')
    await attach(page, 'sf-file', 400, 300)
    await page.getByTestId('sf-scale').selectOption('2')
    await expect(page.getByTestId('sf-size')).toHaveText('Output 928 × 728')
  })

  test('downloads a PNG', async ({ page }) => {
    await page.goto('/en/apps/screenshot-frame')
    await attach(page, 'sf-file', 200, 200)
    const dl = page.waitForEvent('download')
    await page.getByTestId('sf-download').click()
    expect((await dl).suggestedFilename()).toBe('framed.png')
  })
})

test.describe('social resizer', () => {
  test('starts with a sensible selection and can select all', async ({ page }) => {
    await page.goto('/en/apps/social-resize')
    await attach(page, 'sr-file', 800, 600)
    await expect(page.getByTestId('sr-count')).toHaveText('4 selected')
    await page.getByTestId('sr-all').click()
    await expect(page.getByTestId('sr-count')).toHaveText('12 selected')
    await page.getByTestId('sr-none').click()
    await expect(page.getByTestId('sr-count')).toHaveText('0 selected')
  })

  test('downloads one size at its exact dimensions', async ({ page }) => {
    await page.goto('/en/apps/social-resize')
    await attach(page, 'sr-file', 800, 600)
    const dl = page.waitForEvent('download')
    await page.getByTestId('sr-one-ig-story').click()
    expect((await dl).suggestedFilename()).toBe('ig-story-1080x1920.png')
  })

  test('bundles the selected sizes into one zip', async ({ page }) => {
    await page.goto('/en/apps/social-resize')
    await attach(page, 'sr-file', 800, 600)
    const dl = page.waitForEvent('download')
    await page.getByTestId('sr-zip').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('social-sizes.zip')
    const stream = await file.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c as Buffer)
    const zip = Buffer.concat(chunks)
    expect(zip.subarray(0, 2).toString('latin1')).toBe('PK')
    // Four selected sizes → four entries named after them.
    expect(zip.toString('latin1')).toContain('ig-square-1080x1080.png')
    expect(zip.toString('latin1')).toContain('og-1200x630.png')
  })

  test('unchecking a size removes it from the count', async ({ page }) => {
    await page.goto('/en/apps/social-resize')
    await attach(page, 'sr-file', 400, 400)
    await page.getByTestId('sr-check-ig-square').uncheck()
    await expect(page.getByTestId('sr-count')).toHaveText('3 selected')
  })
})

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

test.describe('hmac', () => {
  test('matches the RFC 2202 HMAC-SHA-1 test vector', async ({ page }) => {
    await page.goto('/en/apps/hmac')
    await page.getByTestId('hm-algo').selectOption('SHA-1')
    await page.getByTestId('hm-keyenc').selectOption('hex')
    await page.getByTestId('hm-key').fill('0b'.repeat(20))
    await page.getByTestId('hm-message').fill('Hi There')
    await expect(page.getByTestId('hm-result')).toHaveText('b617318655057264e28bc0b6fb378c8ef146be00')
  })

  test('matches a known HMAC-SHA-256 vector and its base64 form', async ({ page }) => {
    await page.goto('/en/apps/hmac')
    await page.getByTestId('hm-keyenc').selectOption('hex')
    await page.getByTestId('hm-key').fill('0b'.repeat(20))
    await page.getByTestId('hm-message').fill('Hi There')
    await expect(page.getByTestId('hm-result')).toHaveText('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
    await page.getByTestId('hm-b64').click()
    await expect(page.getByTestId('hm-result')).toHaveText('sDRMYdjbOFNcqK/OrwvxK4gdwgDJgz2nJuk3bC4yz/c=')
  })

  test('compares against a supplied value', async ({ page }) => {
    await page.goto('/en/apps/hmac')
    await page.getByTestId('hm-key').fill('secret')
    await page.getByTestId('hm-message').fill('payload')
    await page.getByTestId('hm-expected').fill('deadbeef')
    await expect(page.getByTestId('hm-compare')).toHaveText('Does not match')
    const actual = await page.getByTestId('hm-result').textContent()
    await page.getByTestId('hm-expected').fill(actual!.toUpperCase())
    await expect(page.getByTestId('hm-compare')).toHaveText('Matches')
  })

  test('rejects a key that is not valid hex', async ({ page }) => {
    await page.goto('/en/apps/hmac')
    await page.getByTestId('hm-keyenc').selectOption('hex')
    await page.getByTestId('hm-key').fill('zzz')
    await page.getByTestId('hm-message').fill('anything')
    await expect(page.getByTestId('hm-error')).toBeVisible()
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
