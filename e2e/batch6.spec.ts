import { test, expect } from '@playwright/test'

test.describe('barcode', () => {
  test('calculates the EAN-13 check digit', async ({ page }) => {
    await page.goto('/en/apps/barcode')
    // 629104150021 → the published check digit for this GS1 example is 3.
    await page.getByTestId('bc-value').fill('629104150021')
    await expect(page.getByTestId('bc-check')).toContainText('3')
    await expect(page.getByTestId('bc-canvas')).toBeVisible()
  })

  test('asks for the right number of digits per symbology', async ({ page }) => {
    await page.goto('/en/apps/barcode')
    await page.getByTestId('bc-value').fill('123')
    await expect(page.getByTestId('bc-error')).toContainText('12 digits')
    await page.getByTestId('bc-type').selectOption('ean8')
    await expect(page.getByTestId('bc-error')).toContainText('7 digits')
  })

  test('Code 128 accepts text and rejects what it cannot encode', async ({ page }) => {
    await page.goto('/en/apps/barcode')
    await page.getByTestId('bc-type').selectOption('code128')
    await page.getByTestId('bc-value').fill('SHIP-4471/A')
    await expect(page.getByTestId('bc-canvas')).toBeVisible()
    await page.getByTestId('bc-value').fill('طلب ٤٤٧')
    await expect(page.getByTestId('bc-error')).toBeVisible()
  })

  test('downloads a PNG named after the code', async ({ page }) => {
    await page.goto('/en/apps/barcode')
    await page.getByTestId('bc-value').fill('629104150021')
    const dl = page.waitForEvent('download')
    await page.getByTestId('bc-download').click()
    expect((await dl).suggestedFilename()).toBe('barcode-6291041500213.png')
  })
})

test.describe('curl converter', () => {
  test('parses a multi-header POST and emits fetch', async ({ page }) => {
    await page.goto('/en/apps/curl-convert')
    await page.getByTestId('cv-sample').click()
    await expect(page.getByTestId('cv-url')).toHaveText('https://api.example.com/v1/orders')
    await expect(page.getByTestId('cv-headers')).toHaveText('2')
    const out = page.getByTestId('cv-output')
    await expect(out).toHaveValue(/method: 'POST'/)
    await expect(out).toHaveValue(/'Authorization': 'Bearer sk_test_123'/)
    await expect(out).toHaveValue(/JSON\.stringify\(/)
  })

  test('a header value containing a space survives tokenising', async ({ page }) => {
    await page.goto('/en/apps/curl-convert')
    await page.getByTestId('cv-input').fill(`curl https://x.test -H 'User-Agent: Mozilla 5.0 Safari'`)
    await expect(page.getByTestId('cv-output')).toHaveValue(/'User-Agent': 'Mozilla 5\.0 Safari'/)
  })

  test('switches target language', async ({ page }) => {
    await page.goto('/en/apps/curl-convert')
    await page.getByTestId('cv-sample').click()
    await page.getByTestId('cv-python').click()
    const out = page.getByTestId('cv-output')
    await expect(out).toHaveValue(/import requests/)
    // JSON true must become Python True, or the snippet does not run.
    await expect(out).toHaveValue(/True/)
    await expect(out).toHaveValue(/requests\.post\(/)
  })

  test('flags -k rather than silently reproducing it', async ({ page }) => {
    await page.goto('/en/apps/curl-convert')
    await page.getByTestId('cv-input').fill('curl -k https://self-signed.test/api')
    await expect(page.getByTestId('cv-insecure')).toBeVisible()
  })

  test('rejects input with no URL', async ({ page }) => {
    await page.goto('/en/apps/curl-convert')
    await page.getByTestId('cv-input').fill('just some words')
    await expect(page.getByTestId('cv-invalid')).toBeVisible()
  })
})

test.describe('coordinate converter', () => {
  test('converts decimal into every other notation', async ({ page }) => {
    await page.goto('/en/apps/coordinates')
    await page.getByTestId('co-input').fill('24.7136, 46.6753')
    await expect(page.getByTestId('co-decimal')).toHaveText('24.713600, 46.675300')
    await expect(page.getByTestId('co-dms')).toContainText('24°42')
    await expect(page.getByTestId('co-dms')).toContainText('N')
    await expect(page.getByTestId('co-utm')).toContainText('38')
    await expect(page.getByTestId('co-mgrs')).toContainText('38')
  })

  test('reads degrees-minutes-seconds back', async ({ page }) => {
    await page.goto('/en/apps/coordinates')
    await page.getByTestId('co-input').fill(`24°42'49"N 46°40'31"E`)
    await expect(page.getByTestId('co-decimal')).toHaveText(/^24\.713\d+, 46\.675\d+$/)
  })

  test('handles a southern and western point', async ({ page }) => {
    await page.goto('/en/apps/coordinates')
    await page.getByTestId('co-input').fill('-33.8688, -151.2093')
    await expect(page.getByTestId('co-dms')).toContainText('S')
    await expect(page.getByTestId('co-dms')).toContainText('W')
  })

  test('measures distance and bearing to a second point', async ({ page }) => {
    await page.goto('/en/apps/coordinates')
    await page.getByTestId('co-input').fill('24.7136, 46.6753')
    await page.getByTestId('co-add').click()
    await page.getByTestId('co-second').fill('21.4225, 39.8262')
    // Riyadh to Makkah is ~790 km in a straight line (the road is ~870).
    await expect(page.getByTestId('co-distance')).toHaveText(/79[0-9]\.\d+ km/)
    await expect(page.getByTestId('co-bearing')).toBeVisible()
  })

  test('rejects a value that is not a coordinate pair', async ({ page }) => {
    await page.goto('/en/apps/coordinates')
    await page.getByTestId('co-input').fill('somewhere near the shop')
    await expect(page.getByTestId('co-invalid')).toBeVisible()
  })
})

test.describe('url parser', () => {
  test('breaks a URL into its parts', async ({ page }) => {
    await page.goto('/en/apps/url-parser')
    await page.getByTestId('up-input').fill('https://shop.example.com:8443/a/b?x=1&y=2#top')
    const parts = page.getByTestId('up-parts')
    await expect(parts).toContainText('shop.example.com')
    await expect(parts).toContainText('8443')
    await expect(parts).toContainText('/a/b')
    await expect(parts).toContainText('#top')
  })

  test('strips tracking parameters in one click', async ({ page }) => {
    await page.goto('/en/apps/url-parser')
    await expect(page.getByTestId('up-trackers')).toContainText('1 tracking parameter')
    await page.getByTestId('up-strip').click()
    await expect(page.getByTestId('up-rebuilt')).not.toContainText('utm_source')
    await expect(page.getByTestId('up-rebuilt')).toContainText('id=42')
  })

  test('editing a parameter rebuilds the URL with correct encoding', async ({ page }) => {
    await page.goto('/en/apps/url-parser')
    await page.getByTestId('up-input').fill('https://example.com/?q=old')
    await page.getByTestId('up-value-0').fill('a b&c')
    await expect(page.getByTestId('up-rebuilt')).toContainText('q=a+b%26c')
  })

  test('rejects a string that is not a URL', async ({ page }) => {
    await page.goto('/en/apps/url-parser')
    await page.getByTestId('up-input').fill('example.com')
    await expect(page.getByTestId('up-invalid')).toBeVisible()
  })
})

test.describe('link preview', () => {
  const TAGS = [
    '<meta property="og:title" content="How to renew your iqama">',
    '<meta property="og:description" content="A short guide.">',
    '<meta property="og:image" content="https://example.com/card.png">',
    '<meta property="og:url" content="https://example.com/guide">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n')

  test('renders a card from pasted tags', async ({ page }) => {
    await page.goto('/en/apps/link-preview')
    await page.getByTestId('lp-html').fill(TAGS)
    const preview = page.getByTestId('lp-preview')
    await expect(preview).toContainText('How to renew your iqama')
    await expect(preview).toContainText('example.com')
    await expect(page.getByTestId('lp-good')).toBeVisible()
  })

  test('names what is missing', async ({ page }) => {
    await page.goto('/en/apps/link-preview')
    await page.getByTestId('lp-html').fill('<meta property="og:title" content="Just a title">')
    const problems = page.getByTestId('lp-problems')
    await expect(problems).toContainText('og:description')
    await expect(problems).toContainText('og:image')
    await expect(problems).toContainText('twitter:card')
  })

  test('flags a relative image path', async ({ page }) => {
    await page.goto('/en/apps/link-preview')
    await page.getByTestId('lp-html').fill(TAGS.replace('https://example.com/card.png', '/card.png'))
    await expect(page.getByTestId('lp-problems')).toContainText('relative path')
  })

  test('switching platform changes the card', async ({ page }) => {
    await page.goto('/en/apps/link-preview')
    await page.getByTestId('lp-html').fill(TAGS)
    await page.getByTestId('lp-x').click()
    await expect(page.getByTestId('lp-preview')).toContainText('How to renew your iqama')
  })
})
