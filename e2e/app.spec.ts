import { test, expect } from '@playwright/test'

declare global {
  /** Installed by the random-picker sound test: how many sounds the page has played. */
  interface Window { __soundsPlayed: number }
}

test.describe('home', () => {
  test('opens to the app grid + search', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('.tool-search__input')).toBeVisible()
    const cards = page.locator('[data-testid^="tool-"]')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThan(8)
    // The marketing hero is gone.
    await expect(page.locator('.hero__title')).toHaveCount(0)
  })

  test('search filters the catalog', async ({ page }) => {
    await page.goto('/en')
    const all = await page.locator('[data-testid^="tool-"]').count()
    await page.locator('.tool-search__input').fill('qibla')
    const cards = page.locator('[data-testid^="tool-"]')
    await expect(cards.first()).toContainText(/Qibla/i) // ranked top
    expect(await cards.count()).toBeLessThan(all)       // and the list is filtered down
  })

  test('the app-launcher is hidden on home, opens + searches on tool pages', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByTestId('app-launcher')).toHaveCount(0) // home IS the menu
    await page.goto('/en/tools/qr-code')
    await page.getByTestId('app-launcher').click()
    await expect(page.getByTestId('app-launcher-panel')).toBeVisible()
    await page.getByTestId('launcher-search').fill('uuid')
    await page.getByTestId('tool-uuid-generator').click()
    await expect(page).toHaveURL(/\/apps\/uuid-generator$/)
  })
})

test.describe('tools', () => {
  test('password: generates and regenerates', async ({ page }) => {
    await page.goto('/en/tools/password-generator')
    const out = page.getByTestId('pw-output')
    await expect(out).toBeVisible()
    const first = (await out.textContent())?.trim()
    expect(first && first.length).toBeGreaterThan(4)
    await page.getByTestId('pw-regenerate').click()
    await expect(out).not.toHaveText(first!)
  })

  test('uuid: generates a v4 uuid', async ({ page }) => {
    await page.goto('/en/tools/uuid-generator')
    await expect(page.getByTestId('uuid-output')).toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}/i)
  })

  test('json formatter: prettifies valid and flags invalid', async ({ page }) => {
    await page.goto('/en/tools/json-formatter')
    await page.getByTestId('json-input').fill('{"b":1,"a":2}')
    await page.getByTestId('json-format').click()
    await expect(page.getByTestId('json-output')).toContainText('"b": 1')
    await page.getByTestId('json-input').fill('{"a":1,}')
    await page.getByTestId('json-format').click()
    await expect(page.getByTestId('json-error')).toBeVisible()
    // CSS format
    await page.getByTestId('fmt-css').click()
    await page.getByTestId('json-input').fill('a{color:red;font-weight:bold}')
    await page.getByTestId('json-format').click()
    await expect(page.getByTestId('json-output')).toContainText('color: red;')
  })

  test('unit converter: length and temperature', async ({ page }) => {
    await page.goto('/en/tools/unit-converter')
    await page.getByTestId('unit-value').fill('1') // default 1 m → ft
    await expect(page.getByTestId('unit-result')).toContainText('3.2808')
    await page.getByTestId('unit-category').selectOption('temperature')
    await page.getByTestId('unit-value').fill('100') // C → F
    await expect(page.getByTestId('unit-result')).toContainText('212')
  })

  test('tafqeet: spells an amount in Arabic', async ({ page }) => {
    await page.goto('/en/tools/tafqeet')
    await page.getByTestId('tafqeet-input').fill('1500')
    await expect(page.getByTestId('tafqeet-output')).toContainText('ألف وخمسمئة')
    await expect(page.getByTestId('tafqeet-output')).toContainText('ريال')
    await page.getByTestId('tafqeet-mode-plain').click()
    await expect(page.getByTestId('tafqeet-output')).toHaveText('ألف وخمسمئة')
  })

  test('iban validator: valid SA IBAN, bank, and checksum failure', async ({ page }) => {
    await page.goto('/en/tools/iban-validator')
    await page.getByTestId('iban-input').fill('SA0380000000608010167519')
    await expect(page.getByTestId('iban-status')).toContainText('Valid')
    await expect(page.getByTestId('iban-bank')).toContainText('Al Rajhi')
    // Share card: holder name + a generated, shareable image.
    await page.getByTestId('iban-name').fill('Mohammed Al-Otaibi')
    await expect(page.getByTestId('iban-card')).toBeVisible()
    await expect(page.getByTestId('iban-share')).toBeVisible()
    await page.getByTestId('iban-input').fill('SA0380000000608010167518')
    await expect(page.getByTestId('iban-status')).toContainText('Invalid')
    await expect(page.getByTestId('iban-card')).toHaveCount(0)
  })

  test('vat calculator: add and remove 15%', async ({ page }) => {
    await page.goto('/en/tools/vat-calculator')
    await page.getByTestId('vat-amount').fill('100')
    await expect(page.getByTestId('vat-vat')).toContainText('15.00')
    await expect(page.getByTestId('vat-gross')).toContainText('115.00')
    await page.getByTestId('vat-mode-remove').click()
    await page.getByTestId('vat-amount').fill('115')
    await expect(page.getByTestId('vat-net')).toContainText('100.00')
  })

  test('arabic poetry: meters reference + verse formatter', async ({ page }) => {
    await page.goto('/en/tools/arabic-poetry')
    await expect(page.getByTestId('bahr-taweel')).toContainText('الطويل')
    await page.getByTestId('poetry-tab-format').click()
    await page.getByTestId('poetry-input').fill('قفا نبك من ذكرى\nبسقط اللوى')
    await expect(page.getByTestId('poetry-output')).toContainText('قفا نبك')
  })

  test('case converter: transforms across cases', async ({ page }) => {
    await page.goto('/en/tools/case-converter')
    await page.getByTestId('case-input').fill('hello world')
    await expect(page.getByTestId('case-title')).toHaveText('Hello World')
    await expect(page.getByTestId('case-camel')).toHaveText('helloWorld')
    await expect(page.getByTestId('case-snake')).toHaveText('hello_world')
  })

  test('image compressor: renders the dropzone', async ({ page }) => {
    await page.goto('/en/tools/image-compressor')
    await expect(page.getByTestId('image-compressor')).toBeVisible()
    await expect(page.getByTestId('imgcomp-drop')).toBeVisible()
    await expect(page.getByText(/never uploaded|never leaves/i)).toBeVisible()
  })

  test('image converter: renders the dropzone', async ({ page }) => {
    await page.goto('/en/tools/image-format-converter')
    await expect(page.getByTestId('image-format-converter')).toBeVisible()
    await expect(page.getByTestId('ifc-drop')).toBeVisible()
    await expect(page.getByText(/never uploaded|never leaves/i)).toBeVisible()
  })

  test('image cropper: renders the dropzone', async ({ page }) => {
    await page.goto('/en/tools/image-cropper')
    await expect(page.getByTestId('image-cropper')).toBeVisible()
    await expect(page.getByTestId('crop-drop')).toBeVisible()
    await expect(page.getByText(/never uploaded|never leaves/i)).toBeVisible()
  })

  test('images to pdf: renders the dropzone', async ({ page }) => {
    await page.goto('/en/tools/images-to-pdf')
    await expect(page.getByTestId('images-to-pdf')).toBeVisible()
    await expect(page.getByTestId('i2p-drop')).toBeVisible()
    await expect(page.getByText(/never uploaded|never leaves/i)).toBeVisible()
  })

  test('pdf merge: renders the dropzone', async ({ page }) => {
    await page.goto('/en/tools/pdf-merge')
    await expect(page.getByTestId('pdf-merge')).toBeVisible()
    await expect(page.getByTestId('pm-drop')).toBeVisible()
    await expect(page.getByText(/never uploaded|never leaves/i)).toBeVisible()
  })

  test('pdf split: renders the dropzone', async ({ page }) => {
    await page.goto('/en/tools/pdf-split')
    await expect(page.getByTestId('pdf-split')).toBeVisible()
    await expect(page.getByTestId('ps-drop')).toBeVisible()
    await expect(page.getByText(/never uploaded|never leaves/i)).toBeVisible()
  })

  test('invoice generator: computes VAT and total from line items', async ({ page }) => {
    await page.goto('/en/tools/invoice-generator')
    await expect(page.getByTestId('invoice-generator')).toBeVisible()
    await page.getByTestId('inv-qty-0').fill('2')
    await page.getByTestId('inv-price-0').fill('100')
    await page.getByTestId('inv-add-row').click()
    await page.getByTestId('inv-qty-1').fill('1')
    await page.getByTestId('inv-price-1').fill('50')
    // subtotal 250, VAT 15% = 37.50, total 287.50
    await expect(page.getByTestId('inv-subtotal')).toContainText('250')
    await expect(page.getByTestId('inv-vat')).toContainText('37.5')
    await expect(page.getByTestId('inv-total')).toContainText('287.5')
    // share button + zoomable preview modal
    await expect(page.getByTestId('inv-share')).toBeVisible()
    await page.getByTestId('inv-preview').click()
    await expect(page.getByTestId('inv-modal')).toBeVisible()
    await expect(page.getByTestId('inv-modal').getByText('287.5', { exact: false })).toBeVisible()
    await page.getByTestId('inv-modal-close').click()
    await expect(page.getByTestId('inv-modal')).toHaveCount(0)
  })

  test('qr studio: renders a code + customization controls', async ({ page }) => {
    await page.goto('/en/tools/qr-code')
    await expect(page.getByTestId('qr-code')).toBeVisible()
    await expect(page.getByTestId('qr-url')).toBeVisible()
    await expect(page.getByTestId('qr-canvas')).toBeVisible()
    await expect(page.getByTestId('qr-share')).toBeVisible()
    await expect(page.getByTestId('qr-preset-0')).toBeVisible()
    await page.getByTestId('qr-dot-liquid').click()
    await page.getByTestId('qr-frame-circle').click()
    await expect(page.getByTestId('qr-label')).toBeVisible()
  })

  test('color tools: shows the picker, values and palettes', async ({ page }) => {
    await page.goto('/en/tools/color-tools')
    await expect(page.getByTestId('color-tools')).toBeVisible()
    await expect(page.getByTestId('color-hex')).toContainText('#')
    await expect(page.getByTestId('color-rgb')).toContainText('rgb(')
    await expect(page.getByTestId('color-palette')).toBeVisible()
  })

  test('hash generator: SHA-256 of "abc" matches the known vector', async ({ page }) => {
    await page.goto('/en/tools/hash-generator')
    await page.getByTestId('hash-algo-SHA-256').click()
    await page.getByTestId('hash-text').fill('abc')
    await expect(page.getByTestId('hash-hex')).toHaveText('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  test('base64: encodes text', async ({ page }) => {
    await page.goto('/en/tools/base64')
    await page.getByTestId('b64-input').fill('Built in Saudi')
    await expect(page.getByTestId('b64-output')).toHaveText('QnVpbHQgaW4gU2F1ZGk=')
  })

  test('date diff: computes a duration', async ({ page }) => {
    await page.goto('/en/tools/date-diff')
    await page.getByTestId('dd-from').fill('2026-01-01')
    await page.getByTestId('dd-to').fill('2026-01-08')
    await expect(page.getByTestId('dd-total-days')).toHaveText('7')
  })

  test('language detector: identifies English', async ({ page }) => {
    await page.goto('/en/tools/detect-language')
    await page.getByTestId('lang-input').fill('the quick brown fox jumps over the lazy dog and it was a great day')
    await expect(page.getByTestId('lang-name')).toHaveText('English')
  })

  test('prayer times: renders hero + list', async ({ page }) => {
    await page.goto('/en/tools/prayer-times')
    await expect(page.getByTestId('next-prayer')).toBeVisible()
    const rows = page.locator('[data-testid^="prow-"]')
    expect(await rows.count()).toBeGreaterThanOrEqual(5)
  })

  test('islamic calendar: renders a month grid', async ({ page }) => {
    await page.goto('/en/tools/islamic-calendar')
    await expect(page.getByTestId('cal-title')).toBeVisible()
    const days = page.locator('.cal2__cell:not(.is-blank)')
    expect(await days.count()).toBeGreaterThan(27)
    // toggling to Gregorian keeps the grid populated
    await page.getByTestId('cal-mode-greg').click()
    expect(await page.locator('.cal2__cell:not(.is-blank)').count()).toBeGreaterThan(27)
  })

  test('hijri calendar: dual month calendars convert both ways, no BC bug', async ({ page }) => {
    await page.goto('/en/tools/hijri-calendar')
    await expect(page.getByTestId('cal-greg-title')).toBeVisible()
    await expect(page.getByTestId('cal-hijri-title')).toBeVisible()
    // Set a known Gregorian date; the Hijri calendar must follow.
    await page.getByTestId('cal-greg-num').fill('03/07/2026')
    await expect(page.getByTestId('cal-hijri-num')).toHaveValue('18/01/1448')
    await expect(page.getByTestId('cal-hijri-title')).toContainText('Muharram 1448')
    // The hero shows the Hijri date with a real era (AH), never a Gregorian "BC".
    const hero = page.getByTestId('hijri-today')
    await expect(hero).toContainText('AH')
    await expect(hero).not.toContainText('BC')
  })

  test('lorem: generates and switches to Arabic', async ({ page }) => {
    await page.goto('/en/tools/lorem-ipsum')
    await expect(page.getByTestId('lorem-out')).toContainText(/lorem/i)
    await page.getByTestId('lorem-flavor-arabic').click()
    await expect(page.getByTestId('lorem-out')).toContainText(/[؀-ۿ]/)
  })

  test('istikhara: shows the du‘a and its source', async ({ page }) => {
    await page.goto('/en/tools/istikhara')
    await expect(page.getByTestId('istikhara-dua')).toContainText('اللَّهُمَّ')
    await expect(page.getByText(/al-Bukhārī/)).toBeVisible()
  })

  test('hisn al-muslim: lists chapters and opens one', async ({ page }) => {
    await page.goto('/en/tools/hisn-al-muslim')
    const chapters = page.locator('[data-testid^="hisn-ch-"]')
    expect(await chapters.count()).toBeGreaterThan(50)
    await chapters.first().click()
    await expect(page.getByTestId('hisn-back')).toBeVisible()
    await page.getByTestId('hisn-back').click()
    await page.getByTestId('hisn-search').fill('الاستيقاظ')
    expect(await page.locator('[data-testid^="hisn-ch-"]').count()).toBeGreaterThanOrEqual(1)
  })

  test('regex tester: highlights matches and counts them', async ({ page }) => {
    await page.goto('/en/apps/regex-tester')
    await page.getByTestId('re-pattern').fill('\\d+')
    await page.getByTestId('re-input').fill('a1 b22 c333')
    await expect(page.getByTestId('re-count')).toContainText('3')
    await expect(page.getByTestId('re-output').locator('mark').first()).toHaveText('1')
  })

  test('remove background: loads a dropzone; picking a file reveals the Remove button', async ({ page }) => {
    await page.goto('/en/apps/remove-background')
    await expect(page.getByTestId('remove-background')).toBeVisible()
    await expect(page.getByTestId('rmbg-drop')).toBeVisible()
    // Selecting an image shows the run button (we don't run the model in CI — heavy).
    await page.setInputFiles('input[type=file]', { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') })
    await expect(page.getByTestId('rmbg-run')).toBeVisible()
  })

  test('jwt decoder: decodes header and payload', async ({ page }) => {
    await page.goto('/en/apps/jwt-decoder')
    // {"alg":"HS256","typ":"JWT"}.{"sub":"1234567890","name":"John Doe"}
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.abc'
    await page.getByTestId('jwt-input').fill(jwt)
    await expect(page.getByTestId('jwt-header')).toContainText('HS256')
    await expect(page.getByTestId('jwt-payload')).toContainText('John Doe')
  })

  test('cron explainer: describes an expression and lists next runs', async ({ page }) => {
    await page.goto('/en/apps/cron-explainer')
    await page.getByTestId('cron-input').fill('0 0 * * *')
    await expect(page.getByTestId('cron-desc')).toContainText('00:00')
    await expect(page.getByTestId('cron-next').locator('li').first()).toBeVisible()
  })

  test('text diff: flags an added line', async ({ page }) => {
    await page.goto('/en/apps/text-diff')
    await page.getByTestId('diff-a').fill('one\ntwo')
    await page.getByTestId('diff-b').fill('one\ntwo\nthree')
    await expect(page.getByTestId('diff-output')).toContainText('three')
    await expect(page.getByTestId('diff-output').getByText('+', { exact: false }).first()).toBeVisible()
  })

  test('unix timestamp: converts epoch 0 to 1970 UTC', async ({ page }) => {
    await page.goto('/en/apps/unix-timestamp')
    await page.getByTestId('ts-input').fill('0')
    await expect(page.getByTestId('ts-out')).toContainText('1970')
    await expect(page.getByTestId('ts-now')).toBeVisible()
  })

  test('url encoder: percent-encodes a component', async ({ page }) => {
    await page.goto('/en/apps/url-encoder')
    await page.getByTestId('ue-input').fill('a b&c=d')
    await expect(page.getByTestId('ue-output')).toHaveValue('a%20b%26c%3Dd')
  })

  test('base converter: 255 decimal is ff hex and 11111111 binary', async ({ page }) => {
    await page.goto('/en/apps/base-converter')
    await page.getByTestId('base-dec').fill('255')
    await expect(page.getByTestId('base-hex')).toHaveValue('ff')
    await expect(page.getByTestId('base-bin')).toHaveValue('11111111')
  })

  test('csv to json: keys rows by header', async ({ page }) => {
    await page.goto('/en/apps/csv-json')
    await page.getByTestId('cj-input').fill('a,b\n1,2')
    await expect(page.getByTestId('cj-output')).toContainText('"a": "1"')
  })

  test('list tools: dedupes and sorts', async ({ page }) => {
    await page.goto('/en/apps/list-tools')
    await page.getByTestId('list-input').fill('banana\napple\nbanana')
    await expect(page.getByTestId('list-output')).toHaveValue('apple\nbanana')
  })

  test('contrast checker: black on white is 21:1', async ({ page }) => {
    await page.goto('/en/apps/color-contrast')
    await page.getByTestId('cc-text').fill('#000000')
    await page.getByTestId('cc-bg').fill('#ffffff')
    await expect(page.getByTestId('cc-ratio')).toHaveText('21.00')
  })

  test('loan calculator: zero-interest monthly is amount/months', async ({ page }) => {
    await page.goto('/en/apps/loan-calculator')
    await page.getByTestId('loan-amount').fill('12000')
    await page.getByTestId('loan-rate').fill('0')
    await page.getByTestId('loan-years').fill('1')
    await expect(page.getByTestId('loan-monthly')).toHaveText('1,000')
  })

  test('percentage calculator: 15% of 200 is 30', async ({ page }) => {
    await page.goto('/en/apps/percentage-calculator')
    await page.getByTestId('pc-q1-p').fill('15')
    await page.getByTestId('pc-q1-of').fill('200')
    await expect(page.getByTestId('pc-q1-result')).toHaveText('30')
  })

  test('bill splitter: 240 across 4 is 60 each', async ({ page }) => {
    await page.goto('/en/apps/split-bill')
    await page.getByTestId('sb-bill').fill('240')
    await page.getByTestId('sb-tip').fill('0')
    await page.getByTestId('sb-people').fill('4')
    await expect(page.getByTestId('sb-per')).toHaveText('60.00')
  })

  test('aspect ratio: 16:9 width 1920 gives height 1080', async ({ page }) => {
    await page.goto('/en/apps/aspect-ratio')
    await page.getByTestId('ar-preset-16x9').click()
    await page.getByTestId('ar-width').fill('1920')
    await expect(page.getByTestId('ar-height')).toHaveValue('1080')
  })

  test('pomodoro: renders the timer at 25:00', async ({ page }) => {
    await page.goto('/en/apps/pomodoro')
    await expect(page.getByTestId('pom-time')).toHaveText('25:00')
    await expect(page.getByTestId('pom-toggle')).toBeVisible()
  })

  test('end-of-service: 7 years at 10000, contract ended', async ({ page }) => {
    await page.goto('/en/apps/end-of-service')
    await page.getByTestId('eos-wage').fill('10000')
    await page.getByTestId('eos-years').fill('7')
    await page.getByTestId('eos-months').fill('0')
    // first 5y: 5*0.5*10000=25000; next 2y: 2*10000=20000; total 45000
    await expect(page.getByTestId('eos-award')).toHaveText('45,000.00')
    // resign at 7y → two-thirds → 30000
    await page.getByTestId('eos-resigned').click()
    await expect(page.getByTestId('eos-award')).toHaveText('30,000.00')
  })

  test('zakat: 2.5% above nisab', async ({ page }) => {
    await page.goto('/en/apps/zakat-calculator')
    await page.getByTestId('zk-cash').fill('100000')
    await page.getByTestId('zk-nisab').fill('4000')
    await expect(page.getByTestId('zk-due')).toHaveText('2,500.00')
  })

  test('age calculator: computes an age from a birth date', async ({ page }) => {
    await page.goto('/en/apps/age-calculator')
    await page.getByTestId('age-input').fill('2000-01-01')
    await expect(page.getByTestId('age-result')).toContainText('years')
    await expect(page.getByTestId('age-next')).toBeVisible()
  })

  test('working days: a Mon–Fri week is 5 working days (Sat–Sun weekend)', async ({ page }) => {
    await page.goto('/en/apps/working-days')
    await page.getByTestId('wd-satsun').click()
    await page.getByTestId('wd-from').fill('2026-07-06') // Monday
    await page.getByTestId('wd-to').fill('2026-07-10')   // Friday
    await expect(page.getByTestId('wd-working')).toHaveText('5')
  })

  test('cubic bezier: preset updates the CSS value', async ({ page }) => {
    await page.goto('/en/apps/cubic-bezier')
    await page.getByTestId('cb-preset-linear').click()
    await expect(page.getByTestId('cb-output')).toHaveText('cubic-bezier(0, 0, 1, 1)')
  })

  test('box shadow: outputs a box-shadow rule', async ({ page }) => {
    await page.goto('/en/apps/box-shadow')
    await expect(page.getByTestId('bs-output')).toContainText('box-shadow:')
    await expect(page.getByTestId('bs-preview')).toBeVisible()
  })

  test('gradient: linear by default, switches to radial', async ({ page }) => {
    await page.goto('/en/apps/gradient-generator')
    await expect(page.getByTestId('gg-output')).toContainText('linear-gradient(')
    await page.getByTestId('gg-radial').click()
    await expect(page.getByTestId('gg-output')).toContainText('radial-gradient(')
  })

  test('ip subnet: /24 network, broadcast and 254 hosts', async ({ page }) => {
    await page.goto('/en/apps/ip-subnet')
    await page.getByTestId('ipc-input').fill('192.168.1.10/24')
    await expect(page.getByTestId('ipc-network')).toHaveText('192.168.1.0/24')
    await expect(page.getByTestId('ipc-broadcast')).toHaveText('192.168.1.255')
    await expect(page.getByTestId('ipc-hosts')).toHaveText('254')
  })

  test('user-agent: detects Firefox from a pasted UA', async ({ page }) => {
    await page.goto('/en/apps/user-agent')
    await page.getByTestId('ua-input').fill('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0')
    await expect(page.getByTestId('ua-browser')).toContainText('Firefox')
    await expect(page.getByTestId('ua-os')).toContainText('Windows')
  })

  test('readability: scores a simple sentence', async ({ page }) => {
    await page.goto('/en/apps/readability')
    await page.getByTestId('rd-input').fill('The cat sat on the mat. The dog ran fast. We had fun today.')
    await expect(page.getByTestId('rd-ease')).toBeVisible()
    await expect(page.getByTestId('rd-grade')).toBeVisible()
  })

  test('random picker: spins and shows a winner', async ({ page }) => {
    await page.goto('/en/apps/random-picker')
    await page.getByTestId('rp-input').fill('Alpha\nBeta\nGamma')
    await page.getByTestId('rp-spin').click()
    await expect(page.getByTestId('rp-result')).toHaveText(/Alpha|Beta|Gamma/, { timeout: 6000 })
  })

  test('random picker: sound toggle persists', async ({ page }) => {
    await page.goto('/en/apps/random-picker')
    const btn = page.getByTestId('rp-sound')
    // aria-pressed = the toggle's on/off state, not "was clicked": sound defaults to ON
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(page.getByTestId('rp-sound')).toHaveAttribute('aria-pressed', 'false')
  })

  test('random picker: ticks while spinning; a mid-spin mute silences the rest', async ({ page }) => {
    // Every sound (tick or ding) creates one WebAudio oscillator, so counting
    // oscillator creations counts sounds played — even in silent headless runs.
    await page.addInitScript(() => {
      window.__soundsPlayed = 0
      const orig = AudioContext.prototype.createOscillator
      AudioContext.prototype.createOscillator = function () { window.__soundsPlayed++; return orig.apply(this) }
    })
    const soundsPlayed = () => page.evaluate(() => window.__soundsPlayed)
    await page.goto('/en/apps/random-picker')
    await page.getByTestId('rp-spin').click()
    await page.waitForTimeout(900) // mid-spin (the spin runs ~3.5s)
    expect(await soundsPlayed()).toBeGreaterThan(0)
    await page.getByTestId('rp-sound').click() // mute mid-spin
    const atMute = await soundsPlayed()
    await expect(page.getByTestId('rp-result')).toBeVisible({ timeout: 6000 })
    expect(await soundsPlayed()).toBe(atMute) // silent after the mute, winner ding included
  })

  test('dice roller: rolls two d6 into a total', async ({ page }) => {
    await page.goto('/en/apps/dice-roller')
    await page.getByTestId('dr-count').fill('2')
    await page.getByTestId('dr-d6').click()
    await page.getByTestId('dr-roll').click()
    await expect(page.getByTestId('dr-total')).toBeVisible()
  })

  test('countdown: shows a live day count for a future date', async ({ page }) => {
    await page.goto('/en/apps/countdown')
    await page.getByTestId('cd-input').fill('2099-01-01T00:00')
    await expect(page.getByTestId('cd-days')).toBeVisible()
  })

  test('typing test: renders a passage and input', async ({ page }) => {
    await page.goto('/en/apps/typing-test')
    await expect(page.getByTestId('typing-test')).toBeVisible()
    await expect(page.getByTestId('tt-input')).toBeVisible()
    await expect(page.getByTestId('tt-wpm')).toBeVisible()
  })

  test('image tools: ascii/meme/favicon/steganography render a dropzone', async ({ page }) => {
    await page.goto('/en/apps/image-to-ascii')
    await expect(page.getByTestId('ascii-drop')).toBeVisible()
    await page.goto('/en/apps/meme-generator')
    await expect(page.getByTestId('meme-drop')).toBeVisible()
    await page.goto('/en/apps/favicon-generator')
    await expect(page.getByTestId('favicon-drop')).toBeVisible()
    await page.goto('/en/apps/steganography')
    await expect(page.getByTestId('stego-drop')).toBeVisible()
    await page.getByTestId('stego-reveal').click()
    await expect(page.getByTestId('stego-drop')).toBeVisible()
  })

  test('media/privacy tools render their entry points', async ({ page }) => {
    await page.goto('/en/apps/screen-recorder')
    await expect(page.getByTestId('screen-recorder')).toBeVisible()
    await page.goto('/en/apps/photo-booth')
    await expect(page.getByTestId('pb-start')).toBeVisible()
    await page.goto('/en/apps/image-redact')
    await expect(page.getByTestId('redact-drop')).toBeVisible()
    await page.goto('/en/apps/file-encrypt')
    await expect(page.getByTestId('fe-drop')).toBeVisible()
  })

  test('meta tags: generates OG tags from the title', async ({ page }) => {
    await page.goto('/en/apps/meta-tags')
    await page.getByTestId('mt-title').fill('My Great Page')
    await expect(page.getByTestId('mt-output')).toContainText('og:title" content="My Great Page"')
  })

  test('robots.txt: block-all disallows everything', async ({ page }) => {
    await page.goto('/en/apps/robots-txt')
    await page.getByTestId('rb-block').click()
    await expect(page.getByTestId('rb-output')).toContainText('Disallow: /')
  })

  test('gitignore: includes selected Node rules', async ({ page }) => {
    await page.goto('/en/apps/gitignore')
    await expect(page.getByTestId('gi-output')).toContainText('node_modules/')
  })

  test('json to types: infers interfaces from a sample', async ({ page }) => {
    await page.goto('/en/apps/json-to-types')
    await expect(page.getByTestId('jt-output')).toContainText('interface Root')
    await expect(page.getByTestId('jt-output')).toContainText('interface Address')
    await expect(page.getByTestId('jt-output')).toContainText('string[]')
  })

  test('writer: counts words as you type', async ({ page }) => {
    await page.goto('/en/apps/writer')
    await page.getByTestId('wr-input').fill('one two three four')
    await expect(page.getByTestId('wr-words')).toContainText('4')
  })

  test('flashcards: add a card then study it', async ({ page }) => {
    await page.goto('/en/apps/flashcards')
    await page.getByTestId('fc-front').fill('Capital of KSA')
    await page.getByTestId('fc-back').fill('Riyadh')
    await page.getByTestId('fc-add').click()
    await page.getByTestId('fc-study').click()
    await expect(page.getByTestId('fc-face')).toHaveText('Capital of KSA')
    await page.getByTestId('fc-card').click()
    await expect(page.getByTestId('fc-face')).toHaveText('Riyadh')
  })

  test('kanban: add a card and move it to Doing', async ({ page }) => {
    await page.goto('/en/apps/kanban')
    await page.getByTestId('kb-input-todo').fill('Write the spec')
    await page.getByTestId('kb-add-todo').click()
    const card = page.getByTestId('kb-card').filter({ hasText: 'Write the spec' })
    await expect(card).toBeVisible()
    await card.getByLabel('move right').click()
    await expect(page.getByTestId('kanban')).toContainText('Write the spec')
  })

  test('tier list: add an item into the pool', async ({ page }) => {
    await page.goto('/en/apps/tier-list')
    await page.getByTestId('tl-input').fill('Coffee')
    await page.getByTestId('tl-add').click()
    await expect(page.getByTestId('tl-pool')).toContainText('Coffee')
    await expect(page.getByTestId('tl-tier-S')).toBeVisible()
  })

  test('readme generator: renders the project title as an H1', async ({ page }) => {
    await page.goto('/en/apps/readme-generator')
    await page.getByTestId('rm-name').fill('Awesome Lib')
    await expect(page.getByTestId('rm-output')).toContainText('# Awesome Lib')
  })

  test('markdown table: builds a GFM table from CSV', async ({ page }) => {
    await page.goto('/en/apps/markdown-table')
    await page.getByTestId('mdt-input').fill('a,b\n1,2')
    await expect(page.getByTestId('mdt-output')).toContainText('| a')
    await expect(page.getByTestId('mdt-output')).toContainText('| 1')
  })

  test('fake data: generates the requested rows as JSON', async ({ page }) => {
    await page.goto('/en/apps/fake-data')
    await page.getByTestId('fd-count').fill('3')
    await page.getByTestId('fd-generate').click()
    await expect(page.getByTestId('fd-output')).toContainText('"name"')
  })

  test('slugify: makes a URL slug', async ({ page }) => {
    await page.goto('/en/apps/slugify')
    await page.getByTestId('sl-input').fill('Hello, World! 2026')
    await expect(page.getByTestId('sl-output')).toHaveText('hello-world-2026')
  })

  test('adhkar: lists remembrances and counts on tap', async ({ page }) => {
    await page.goto('/en/tools/adhkar')
    const kursi = page.getByTestId('dhikr-kursi')
    await expect(kursi).toBeVisible()
    await kursi.click() // count 1 → done (the card dims once complete)
    await expect(kursi).toHaveClass(/opacity-70/)
    await page.getByTestId('adhkar-evening').click()
    await expect(page.getByTestId('dhikr-amsayna-evening')).toBeVisible()
  })
})

test.describe('shell', () => {
  test('language toggle switches to Arabic (RTL) and persists', async ({ page }) => {
    await page.goto('/en')
    await page.locator('.lang-toggle').click()
    await expect(page).toHaveURL(/\/ar$/)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })

  test('the site opts out of browser translation', async ({ page }) => {
    await page.goto('/en/tools/prayer-times')
    await expect(page.locator('html')).toHaveAttribute('translate', 'no')
  })
})

test.describe('line break converter', () => {
  test('single-spaced lines become double-spaced', async ({ page }) => {
    await page.goto('/en/apps/line-breaks')
    await page.getByTestId('newline-input').fill('one\ntwo\nthree')
    await expect(page.getByTestId('newline-output')).toHaveValue('one\n\ntwo\n\nthree')
    await expect(page.getByTestId('newline-message')).toContainText('single line breaks')
  })

  test('double-spaced lines collapse to single', async ({ page }) => {
    await page.goto('/en/apps/line-breaks')
    await page.getByTestId('newline-input').fill('one\n\ntwo\n\nthree')
    await expect(page.getByTestId('newline-output')).toHaveValue('one\ntwo\nthree')
    await expect(page.getByTestId('newline-message')).toContainText('double line breaks')
  })

  test('mixed spacing normalises to double', async ({ page }) => {
    await page.goto('/en/apps/line-breaks')
    await page.getByTestId('newline-input').fill('one\ntwo\n\nthree')
    await expect(page.getByTestId('newline-output')).toHaveValue('one\n\ntwo\n\nthree')
    await expect(page.getByTestId('newline-message')).toContainText('mixed spacing')
  })
})

test.describe('paste to markdown', () => {
  test('converts pasted HTML to Markdown', async ({ page }) => {
    await page.goto('/en/apps/paste-to-markdown')
    const box = page.getByTestId('md-input')
    await expect(box).toBeVisible()
    // Simulate a rich-text paste (clipboardData with text/html).
    await box.evaluate((el) => {
      const html = '<h1>Title</h1><p>Some <strong>bold</strong> and a <a href="https://x.com">link</a>.</p><ul><li>a</li><li>b</li></ul>'
      const dt = new DataTransfer()
      dt.setData('text/html', html)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    const out = page.getByTestId('md-output')
    await expect(out).toHaveValue(/# Title/)
    await expect(out).toHaveValue(/\*\*bold\*\*/)
    await expect(out).toHaveValue(/\[link\]\(https:\/\/x\.com\)/)
    await expect(out).toHaveValue(/- a\n- b/)
    await expect(page.getByTestId('md-message')).toContainText('Converted to Markdown')
  })
})

test.describe('arabic diacritizer', () => {
  test('rejects non-Arabic text before hitting the backend', async ({ page }) => {
    await page.goto('/en/apps/diacritize')
    await page.getByTestId('dc-input').fill('hello world, no arabic here')
    await page.getByTestId('dc-run').click()
    await expect(page.getByTestId('dc-err')).toContainText('Arabic')
  })
})

test.describe('arabic verb conjugator', () => {
  test('conjugates a triliteral Form I root', async ({ page }) => {
    await page.goto('/en/apps/arabic-verbs')
    await page.getByTestId('av-root').fill('كتب')
    // past هو and present هو appear somewhere (stored on data-verb attributes)
    await expect(page.locator('[data-verb="كَتَبَ"]').first()).toBeVisible()
    await expect(page.locator('[data-verb="يَكْتُبُ"]').first()).toBeVisible()
    // derived active participle
    await expect(page.getByTestId('av-derived')).toContainText('كَاتِب')
    // passive voice shows كُتِبَ
    await page.getByTestId('av-passive').click()
    await expect(page.locator('[data-verb="كُتِبَ"]').first()).toBeVisible()
  })

  test('flags a known irregular root', async ({ page }) => {
    await page.goto('/en/apps/arabic-verbs')
    await page.getByTestId('av-root').fill('وصل')
    await expect(page.getByTestId('av-irregular')).toContainText('يَصِلُ')
    await expect(page.getByTestId('av-weak')).toBeVisible()
  })

  test('switches to a quadriliteral form', async ({ page }) => {
    await page.goto('/en/apps/arabic-verbs')
    await page.getByTestId('av-root').fill('دحرج')
    await expect(page.getByTestId('av-form-Q1')).toBeVisible()
    await expect(page.locator('[data-verb="دَحْرَجَ"]').first()).toBeVisible()
  })
})

test.describe('pdf sign + fill', () => {
  test('sign: loads with a signature pad and a document dropzone', async ({ page }) => {
    await page.goto('/en/tools/pdf-sign')
    await expect(page.getByTestId('sign-pad')).toBeVisible()
    await expect(page.getByTestId('sign-drop')).toBeVisible()
  })

  test('fill: loads with a form dropzone', async ({ page }) => {
    await page.goto('/en/tools/pdf-fill')
    await expect(page.getByTestId('fill-drop')).toBeVisible()
  })

  test('edit: loads with a dropzone', async ({ page }) => {
    await page.goto('/en/tools/pdf-edit')
    await expect(page.getByTestId('edit-drop')).toBeVisible()
  })
})

test.describe('privacy', () => {
  test('clear this browser’s data wipes localStorage (two-click confirm), showing the count first', async ({ page }) => {
    await page.goto('/en/privacy')
    await page.evaluate(() => localStorage.setItem('bis-test-key', 'x'))
    await expect(page.getByTestId('local-count')).toContainText(/\d/) // count shown before deleting
    const btn = page.getByTestId('clear-local')
    await expect(btn).toBeVisible()
    await btn.click() // first click → arm confirm
    await btn.click() // second click → clear
    await expect(page.getByTestId('local-cleared')).toBeVisible()
    const left = await page.evaluate(() => localStorage.length)
    expect(left).toBe(0)
  })

  test('download my data exports local + session storage as JSON', async ({ page }) => {
    await page.goto('/en/privacy')
    await page.evaluate(() => { localStorage.setItem('bis-dl-key', 'hello'); sessionStorage.setItem('bis-sess', 'world') })
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-data').click(),
    ])
    const p = await download.path()
    const { readFileSync } = await import('node:fs')
    const json = JSON.parse(readFileSync(p!, 'utf8'))
    expect(json.localStorage['bis-dl-key']).toBe('hello')
    expect(json.sessionStorage['bis-sess']).toBe('world')
    expect(typeof json.exportedAt).toBe('string')
  })
})

test.describe('svg-editor', () => {
  test('loads a canvas with the sample shapes and a layers list', async ({ page }) => {
    await page.goto('/en/apps/svg-editor')
    await expect(page.getByTestId('svg-canvas')).toBeVisible()
    await expect(page.getByTestId('svg-artboard')).toBeVisible()
    // The sample imports to three editable shapes (rect + circle→ellipse + path).
    await expect(page.getByTestId('svg-layer')).toHaveCount(3)
    // Nothing selected yet → the empty-state hint shows.
    await expect(page.getByTestId('svg-noselection')).toBeVisible()
  })

  test('draws a rectangle, selects it, and restyles it', async ({ page }) => {
    await page.goto('/en/apps/svg-editor')
    await page.getByTestId('svg-clear').click()
    await expect(page.getByTestId('svg-layer')).toHaveCount(0)
    // Pick the rectangle tool and drag on the canvas to draw one.
    await page.getByTestId('svg-tool-rect').click()
    const canvas = page.getByTestId('svg-canvas')
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + 80, box.y + 80)
    await page.mouse.down()
    await page.mouse.move(box.x + 200, box.y + 180, { steps: 5 })
    await page.mouse.up()
    // A shape now exists, is selected (style panel visible), and shows resize handles.
    await expect(page.getByTestId('svg-layer')).toHaveCount(1)
    await expect(page.getByTestId('svg-selection')).toBeVisible()
    await expect(page.getByTestId('svg-fill')).toBeVisible()
    // Delete via the layer's trash removes it.
    await page.getByTestId('svg-layer-del').click()
    await expect(page.getByTestId('svg-layer')).toHaveCount(0)
  })

  test('exports optimised SVG and round-trips through the code view', async ({ page }) => {
    await page.goto('/en/apps/svg-editor')
    // The sample document exports to something the optimiser shrinks.
    const size = await page.getByTestId('svg-size').textContent()
    const m = (size || '').match(/(\d+)%\)/) // "… (−NN%)"
    expect(m).not.toBeNull()
    // Flip to code view → apply a fresh SVG → it re-imports as one shape.
    await page.getByTestId('svg-code-toggle').click()
    await page.getByTestId('svg-code').fill('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="5" y="5" width="30" height="30" fill="#c00"/></svg>')
    await page.getByTestId('svg-code-apply').click()
    await expect(page.getByTestId('svg-canvas')).toBeVisible()
    await expect(page.getByTestId('svg-layer')).toHaveCount(1)
  })

  test('edits path nodes — drag, add and remove', async ({ page }) => {
    await page.goto('/en/apps/svg-editor')
    // Load a deterministic 3-point open path via the code view.
    await page.getByTestId('svg-code-toggle').click()
    await page.getByTestId('svg-code').fill('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><polyline points="40,40 150,40 100,150" fill="none" stroke="#0a0" stroke-width="3"/></svg>')
    await page.getByTestId('svg-code-apply').click()
    // Node tool + select the path from the layers list → its 3 nodes appear.
    await page.getByTestId('svg-tool-node').click()
    await page.getByTestId('svg-layer').first().click()
    await expect(page.getByTestId('svg-nodes')).toBeVisible()
    await expect(page.locator('[data-node]')).toHaveCount(3)

    // Drag the first node — it should move on screen.
    const n0 = page.locator('[data-node="0"]')
    const before = (await n0.boundingBox())!
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
    await page.mouse.down()
    await page.mouse.move(before.x + 40, before.y + 30, { steps: 5 })
    await page.mouse.up()
    const after = (await n0.boundingBox())!
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(8)

    // Double-click the midpoint of segment 0–1 → a node is inserted (3 → 4).
    const b0 = (await page.locator('[data-node="0"]').boundingBox())!
    const b1 = (await page.locator('[data-node="1"]').boundingBox())!
    await page.mouse.dblclick((b0.x + b0.width / 2 + b1.x + b1.width / 2) / 2, (b0.y + b0.height / 2 + b1.y + b1.height / 2) / 2)
    await expect(page.locator('[data-node]')).toHaveCount(4)

    // Double-click an existing node → it is removed (4 → 3).
    const bn = (await page.locator('[data-node="2"]').boundingBox())!
    await page.mouse.dblclick(bn.x + bn.width / 2, bn.y + bn.height / 2)
    await expect(page.locator('[data-node]')).toHaveCount(3)
  })
})

test.describe('currency-converter', () => {
  // Stub the public rates feed so the test is deterministic + offline.
  async function stub(page: import('@playwright/test').Page) {
    await page.route('**/v1/currencies/usd.min.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ date: '2026-07-20', usd: { sar: 3.75, eur: 0.9 } }) }))
    await page.route('**/v1/currencies/sar.min.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ date: '2026-07-20', sar: { usd: 0.2667 } }) }))
  }

  test('converts USD→SAR at the fetched daily rate and swaps', async ({ page }) => {
    await stub(page)
    await page.goto('/en/apps/currency-converter')
    // Defaults: 100 USD → SAR at 3.75 → 375.00, with the rate + date shown.
    await expect(page.getByTestId('cur-rate')).toContainText('1 USD = 3.75 SAR')
    await expect(page.getByTestId('cur-result')).toContainText('375')
    await expect(page.getByTestId('cur-date')).toContainText('2026-07-20')
    // Swap → SAR base is fetched and the direction flips.
    await page.getByTestId('cur-swap').click()
    await expect(page.getByTestId('cur-rate')).toContainText('1 SAR = 0.2667 USD')
  })

  test('shows an error when rates cannot be loaded', async ({ page }) => {
    await page.route('**/v1/currencies/**', (r) => r.abort())
    await page.goto('/en/apps/currency-converter')
    await expect(page.getByTestId('cur-error')).toBeVisible()
  })
})
