import { test, expect } from '@playwright/test'

test.describe('printable paper', () => {
  test('previews and downloads a PDF named after the paper', async ({ page }) => {
    await page.goto('/en/apps/paper-generator')
    await expect(page.getByTestId('pg-preview')).toBeVisible()
    const dl = page.waitForEvent('download')
    await page.getByTestId('pg-download').click()
    expect((await dl).suggestedFilename()).toBe('graph-a4.pdf')
  })

  test('the PDF really is a PDF', async ({ page }) => {
    await page.goto('/en/apps/paper-generator')
    const dl = page.waitForEvent('download')
    await page.getByTestId('pg-download').click()
    const stream = await (await dl).createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c as Buffer)
    expect(Buffer.concat(chunks).subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  test('switching paper kind changes the filename', async ({ page }) => {
    await page.goto('/en/apps/paper-generator')
    await page.getByTestId('pg-kind').selectOption('arabic')
    await page.getByTestId('pg-size').selectOption('a5')
    const dl = page.waitForEvent('download')
    await page.getByTestId('pg-download').click()
    expect((await dl).suggestedFilename()).toBe('arabic-a5.pdf')
  })

  test('spacing only appears for the kinds that use it', async ({ page }) => {
    await page.goto('/en/apps/paper-generator')
    await expect(page.getByTestId('pg-spacing')).toBeVisible()
    await page.getByTestId('pg-kind').selectOption('blank')
    await expect(page.getByTestId('pg-spacing')).toHaveCount(0)
  })
})

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

  test('finds the colours that are actually in the image', async ({ page }) => {
    await page.goto('/en/apps/color-palette')
    await attach(page)
    await expect(page.getByTestId('cp-swatches')).toBeVisible()
    const values = page.getByTestId('cp-values')
    await expect(values).toContainText('#ff0000')
    await expect(values).toContainText('#0000ff')
  })

  test('exports as CSS, Tailwind and JSON', async ({ page }) => {
    await page.goto('/en/apps/color-palette')
    await attach(page)
    await expect(page.getByTestId('cp-export')).toContainText(':root')
    await page.getByTestId('cp-tailwind').click()
    await expect(page.getByTestId('cp-export')).toContainText('brand1')
    await page.getByTestId('cp-json').click()
    await expect(page.getByTestId('cp-export')).toContainText('"hex"')
  })

  test('the same image gives the same palette twice', async ({ page }) => {
    await page.goto('/en/apps/color-palette')
    await attach(page)
    const first = await page.getByTestId('cp-export').textContent()
    await attach(page)
    await expect(page.getByTestId('cp-export')).toHaveText(first!)
  })
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

test.describe('hex viewer', () => {
  test('dumps bytes and identifies a PNG by its magic number', async ({ page }) => {
    await page.goto('/en/apps/hex-viewer')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    await page.getByTestId('hx-file').setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByTestId('hx-detected')).toContainText('PNG image')
    await expect(page.getByTestId('hx-dump')).toContainText('89 50 4e 47')
    await expect(page.getByTestId('hx-dump')).toContainText('PNG')
  })

  test('flags a file whose extension disagrees with its contents', async ({ page }) => {
    await page.goto('/en/apps/hex-viewer')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    // A PNG renamed to .pdf — no file manager would tell you.
    await page.getByTestId('hx-file').setInputFiles({ name: 'invoice.pdf', mimeType: '', buffer: png })
    await expect(page.getByTestId('hx-mismatch')).toBeVisible()
  })

  test('finds text inside the bytes', async ({ page }) => {
    await page.goto('/en/apps/hex-viewer')
    await page.getByTestId('hx-file').setInputFiles({
      name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x'.repeat(500) + 'NEEDLE' + 'y'.repeat(100)),
    })
    await page.getByTestId('hx-query').fill('NEEDLE')
    await page.getByTestId('hx-search').click()
    // 500 bytes of padding, so the needle starts at 500 = 0x1F4.
    await expect(page.getByTestId('hx-searchmsg')).toContainText('0x1F4')
  })

  test('recognises plain text with no signature', async ({ page }) => {
    await page.goto('/en/apps/hex-viewer')
    await page.getByTestId('hx-file').setInputFiles({
      name: 'data.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b,c\n1,2,3\n'),
    })
    await expect(page.getByTestId('hx-detected')).toContainText('Plain text')
  })
})

test.describe('sun times', () => {
  test('lists every light of the day for a fixed date', async ({ page }) => {
    await page.goto('/en/apps/sun-times')
    await page.getByTestId('st-date').fill('2026-06-21')
    // Makkah in June: sunrise is early morning, sunset early evening.
    await expect(page.getByTestId('st-sunrise')).toHaveText(/0[45]:\d\d/)
    await expect(page.getByTestId('st-sunset')).toHaveText(/19:\d\d/)
    await expect(page.getByTestId('st-solarNoon')).toBeVisible()
    await expect(page.getByTestId('st-golden')).toBeVisible()
  })

  test('daylight is longer at the solstice than at the equinox', async ({ page }) => {
    await page.goto('/en/apps/sun-times')
    await page.getByTestId('st-date').fill('2026-06-21')
    const solstice = await page.getByTestId('st-daylength').textContent()
    await page.getByTestId('st-date').fill('2026-12-21')
    const winter = await page.getByTestId('st-daylength').textContent()
    const hours = (t: string | null) => Number(t!.split('h')[0])
    expect(hours(solstice)).toBeGreaterThan(hours(winter))
  })

  test('twilight comes before sunrise and after sunset', async ({ page }) => {
    await page.goto('/en/apps/sun-times')
    await page.getByTestId('st-date').fill('2026-03-21')
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const civilDawn = toMin((await page.getByTestId('st-civilDawn').textContent())!)
    const sunrise = toMin((await page.getByTestId('st-sunrise').textContent())!)
    const sunset = toMin((await page.getByTestId('st-sunset').textContent())!)
    const civilDusk = toMin((await page.getByTestId('st-civilDusk').textContent())!)
    expect(civilDawn).toBeLessThan(sunrise)
    expect(civilDusk).toBeGreaterThan(sunset)
  })

  test('changing city changes the times', async ({ page }) => {
    await page.goto('/en/apps/sun-times')
    await page.getByTestId('st-date').fill('2026-06-21')
    const makkah = await page.getByTestId('st-sunrise').textContent()
    await page.getByTestId('st-city').selectOption({ index: 3 })
    await expect(page.getByTestId('st-sunrise')).not.toHaveText(makkah!)
  })
})
