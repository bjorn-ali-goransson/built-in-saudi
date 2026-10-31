import { test, expect } from '@playwright/test'

test.describe('palette from image', () => {
  async function attach(page: import('@playwright/test').Page) {
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement('canvas')
      c.width = 200; c.height = 100
      const ctx = c.getContext('2d')!
      // Two flat blocks: the palette must come back with these two colours.
      ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 100, 100)
      ctx.fillStyle = '#0000ff'; ctx.fillRect(100, 0, 100, 100)
      return c.toDataURL('image/png')
    })
    await page.getByTestId('cp-file').setInputFiles({
      name: 'blocks.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
    })
  }
})

test.describe('json diff', () => {
  test('reformatting is not reported as a change', async ({ page }) => {
    await page.goto('/en/apps/json-diff')
    await page.getByTestId('jd-left').fill('{"a":1,"b":[1,2]}')
    await page.getByTestId('jd-right').fill('{\n  "b": [1, 2],\n  "a": 1\n}')
    await expect(page.getByTestId('jd-same')).toContainText('only formatting or key order changed')
  })

  test('reports added, removed and changed by path', async ({ page }) => {
    await page.goto('/en/apps/json-diff')
    await page.getByTestId('jd-left').fill('{"user":{"name":"Ahmed","age":30},"tags":["a"]}')
    await page.getByTestId('jd-right').fill('{"user":{"name":"Ahmed","city":"Riyadh"},"tags":["a","b"]}')
    const changes = page.getByTestId('jd-changes')
    await expect(changes).toContainText('user.age')
    await expect(changes).toContainText('user.city')
    await expect(changes).toContainText('tags[1]')
    await expect(page.getByTestId('jd-count')).toHaveText('3 differences')
  })

  test('a type change is called out as such', async ({ page }) => {
    await page.goto('/en/apps/json-diff')
    await page.getByTestId('jd-left').fill('{"count":"5"}')
    await page.getByTestId('jd-right').fill('{"count":5}')
    await expect(page.getByTestId('jd-changes')).toContainText('type changed')
  })

  test('array order can be ignored on request', async ({ page }) => {
    await page.goto('/en/apps/json-diff')
    await page.getByTestId('jd-left').fill('{"tags":["a","b"]}')
    await page.getByTestId('jd-right').fill('{"tags":["b","a"]}')
    await expect(page.getByTestId('jd-count')).toHaveText('2 differences')
    await page.getByTestId('jd-order').check()
    await expect(page.getByTestId('jd-same')).toBeVisible()
  })

  test('invalid JSON is reported per side', async ({ page }) => {
    await page.goto('/en/apps/json-diff')
    await page.getByTestId('jd-left').fill('{oops}')
    await expect(page.getByTestId('jd-left-error')).toBeVisible()
  })
})

test.describe('sun times', () => {
  // Pin the browser's timezone: CI runs in UTC and a developer machine usually
  // does not, and without this the assertions below would only hold in one of
  // them. The tool renders in the PLACE's zone, so Makkah reads as Makkah here.
  test.use({ timezoneId: 'UTC' })
})
