import { test, expect } from '@playwright/test'

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

  test('adhkar: lists remembrances and counts on tap', async ({ page }) => {
    await page.goto('/en/tools/adhkar')
    const kursi = page.getByTestId('dhikr-kursi')
    await expect(kursi).toBeVisible()
    await kursi.click() // count 1 → done
    await expect(kursi).toContainText('Done')
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
