import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

declare global {
  /** Installed by the random-picker sound test: how many sounds the page has played. */
  interface Window { bisTestSoundCount: number }
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

  test('qr reader: decodes a real code and flags a deceptive link', async ({ page }) => {
    // Generate genuine QR PNGs with the same library the generator tool uses,
    // so this exercises real decoding rather than a hand-made pattern.
    const QRCode = await import('qrcode')
    const png = async (text: string) => Buffer.from((await QRCode.toDataURL(text, { width: 420, margin: 2 })).split(',')[1], 'base64')

    await page.goto('/en/apps/qr-reader')
    await expect(page.getByTestId('qr-reader')).toBeVisible()
    await expect(page.getByText(/never uploaded|never leave/i)).toBeVisible()

    // A Wi-Fi payload should be broken into readable fields, not just dumped.
    await page.locator('input[type=file]').first().setInputFiles({ name: 'wifi.png', mimeType: 'image/png', buffer: await png('WIFI:S:Majlis Guest;T:WPA;P:hunter2;;') })
    await expect(page.getByTestId('qr-result')).toContainText('Wi-Fi network')
    await expect(page.getByTestId('qr-result')).toContainText('Majlis Guest')
    await expect(page.getByTestId('qr-result')).toContainText('hunter2')
    await expect(page.getByTestId('qr-warn')).toHaveCount(0)

    // The reason to read a code first: this one reads as "apple.com" but isn't.
    await page.getByTestId('qr-again').click()
    await page.locator('input[type=file]').first().setInputFiles({ name: 'evil.png', mimeType: 'image/png', buffer: await png('http://apple.com@192.168.4.9:8080/verify') })
    await expect(page.getByTestId('qr-raw')).toContainText('apple.com@192.168.4.9')
    const warn = page.getByTestId('qr-warn')
    await expect(warn).toContainText(/user@/i)      // the host is not what it looks like
    await expect(warn).toContainText(/IP address/i)
    await expect(warn).toContainText(/unusual port/i)
    await expect(warn).toContainText(/not encrypted/i)

    // And a picture with no code in it says so rather than failing silently.
    await page.getByTestId('qr-again').click()
    const blank = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 200
      const x = c.getContext('2d')!; x.fillStyle = '#ddd'; x.fillRect(0, 0, 200, 200)
      const b: Blob = await new Promise((r) => c.toBlob((v) => r(v!), 'image/png'))
      return Array.from(new Uint8Array(await b.arrayBuffer()))
    })
    await page.locator('input[type=file]').first().setInputFiles({ name: 'blank.png', mimeType: 'image/png', buffer: Buffer.from(blank) })
    await expect(page.getByTestId('qr-none')).toBeVisible()
  })

  test('metadata remover: drops EXIF losslessly and keeps the pixels', async ({ page }) => {
    // A real JPEG with a real APP1/EXIF segment spliced in, so the tool has
    // something genuine to strip.
    const jpeg = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 120; c.height = 90
      const x = c.getContext('2d')!
      x.fillStyle = '#2f5482'; x.fillRect(0, 0, 120, 90)
      x.fillStyle = '#fff'; x.fillRect(20, 20, 40, 30)
      const b: Blob = await new Promise((r) => c.toBlob((v) => r(v!), 'image/jpeg', 0.9))
      return Array.from(new Uint8Array(await b.arrayBuffer()))
    })
    const src = Buffer.from(jpeg)
    // Build an APP1 "Exif\0\0" segment and insert it right after SOI.
    const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.alloc(200, 0x41)])
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff]), payload])
    const withExif = Buffer.concat([src.subarray(0, 2), app1, src.subarray(2)])

    await page.goto('/en/apps/metadata-remove')
    await expect(page.getByTestId('metadata-remove')).toBeVisible()
    await page.locator('input[type=file]').first().setInputFiles({ name: 'holiday.jpg', mimeType: 'image/jpeg', buffer: withExif })

    await expect(page.getByTestId('mr-removed')).toContainText(/EXIF/i)
    // Structural strip, not a re-encode — that is the whole point.
    await expect(page.getByTestId('mr-mode')).toContainText(/not re-compressed/i)
    await expect(page.getByTestId('mr-download')).toHaveAttribute('download', 'holiday.jpg')
    // The cleaned file must be smaller than the one carrying the segment, and
    // still decode to the same dimensions.
    const { w, h } = await page.getByTestId('mr-preview').evaluate((el) => ({ w: (el as HTMLImageElement).naturalWidth, h: (el as HTMLImageElement).naturalHeight }))
    expect(w).toBe(120)
    expect(h).toBe(90)
    await expect(page.getByTestId('mr-size')).toContainText(/saved/i)
  })

  test('hash generator: verifies a pasted checksum and picks the algorithm from it', async ({ page }) => {
    await page.goto('/en/apps/hash-generator')
    await page.getByTestId('hash-text').fill('built in saudi')
    await expect(page.getByTestId('hash-hex')).not.toBeEmpty()
    const sha256 = await page.getByTestId('hash-hex').innerText()

    // Switch away, then paste a SHA-256 — the length alone should switch it back.
    await page.getByTestId('hash-algo-SHA-1').click()
    await page.getByTestId('hash-expected').fill(sha256)
    await expect(page.getByTestId('hash-verdict-match')).toBeVisible()

    // sha256sum output is usually pasted as "<hash>  <filename>".
    await page.getByTestId('hash-expected').fill(`${sha256}  built-in-saudi.txt`)
    await expect(page.getByTestId('hash-verdict-match')).toBeVisible()

    await page.getByTestId('hash-expected').fill(sha256.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')))
    await expect(page.getByTestId('hash-verdict-no')).toBeVisible()
  })

  test('image to text: actually reads words out of a picture, from our own origin', async ({ page }) => {
    // Render crisp black text on white in the page itself, then hand the PNG to
    // the tool. A fixture image would test the same thing, but this keeps the
    // expected string and the pixels in one place.
    const png = await page.evaluate(async () => {
      const c = document.createElement('canvas')
      c.width = 900; c.height = 260
      const x = c.getContext('2d')!
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
      x.fillStyle = '#000'; x.font = 'bold 84px Georgia, "Times New Roman", serif'
      x.fillText('Built in Saudi', 40, 110)
      x.fillText('Invoice 2026', 40, 220)
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
      return Array.from(new Uint8Array(await blob.arrayBuffer()))
    })

    // The engine and the language model must come from us, never a CDN — that is
    // the whole privacy claim. Fail loudly if anything reaches off-origin.
    const offOrigin: string[] = []
    await page.route('**/*', (route) => {
      const u = route.request().url()
      if (/tesseract|traineddata|\.wasm(\.js)?$/i.test(u) && !u.startsWith('http://localhost:4173')) offOrigin.push(u)
      return route.continue()
    })

    await page.goto('/en/apps/image-to-text')
    await expect(page.getByTestId('image-to-text')).toBeVisible()
    await expect(page.getByText(/never uploaded|never leaves/i)).toBeVisible()

    await page.locator('input[type=file]').first().setInputFiles({ name: 'invoice.png', mimeType: 'image/png', buffer: Buffer.from(png) })
    await expect(page.getByTestId('ocr-preview')).toBeVisible()

    await page.getByTestId('ocr-run').click()
    // Loading the wasm core plus a 4MB model is slow the first time.
    await expect(page.getByTestId('ocr-text')).toBeVisible({ timeout: 120_000 })
    const text = await page.getByTestId('ocr-text').inputValue()
    expect(text.toLowerCase()).toContain('built in saudi')
    expect(text).toContain('2026')

    await expect(page.getByTestId('ocr-download')).toHaveAttribute('download', 'invoice.txt')
    expect(offOrigin, `OCR assets must be served from our origin: ${offOrigin.join(', ')}`).toEqual([])
  })

  test('image to text: the picker is not image-only and a bad file explains itself', async ({ page }) => {
    await page.goto('/en/apps/image-to-text')
    const input = page.locator('input[type=file]').first()
    // #225: an image-only accept hides Downloads in Android's gallery picker.
    await expect(input).not.toHaveAttribute('accept', /image/)
    await input.setInputFiles({ name: 'notes.txt', mimeType: '', buffer: Buffer.from('this is not an image') })
    await expect(page.getByTestId('file-error')).toBeVisible()
    await expect(page.getByTestId('ocr-run')).toHaveCount(0)
  })

  test('pdf to images: renders every page and offers each / ZIP', async ({ page }) => {
    // A real 2-page PDF, built here rather than committed as a fixture — the
    // point of the test is that pdf.js actually rasterises pages, so a
    // hand-rolled byte blob that pdf.js merely tolerates would prove nothing.
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.create()
    for (const label of ['Page one', 'Page two']) {
      doc.addPage([200, 280]).drawText(label, { x: 20, y: 140, size: 18 })
    }
    const pdf = Buffer.from(await doc.save())

    await page.goto('/en/apps/pdf-to-images')
    await expect(page.getByTestId('pdf-to-images')).toBeVisible()
    await expect(page.getByText(/never uploaded|never leaves/i)).toBeVisible()

    await page.locator('input[type=file]').first().setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: pdf })
    await expect(page.getByTestId('p2i-count')).toContainText('2 pages')

    await page.getByTestId('p2i-convert').click()
    const tiles = page.getByTestId('p2i-results').locator('a')
    await expect(tiles).toHaveCount(2, { timeout: 30_000 })
    // Both download routes the user asked for, plus the per-page one on each tile.
    await expect(page.getByTestId('p2i-zip')).toBeVisible()
    await expect(page.getByTestId('p2i-each')).toBeVisible()
    await expect(page.getByTestId('p2i-page-1')).toHaveAttribute('download', /sample-p1\.png$/)

    // The thumbnail must be a genuinely decoded raster, not a broken image.
    const w = await page.getByTestId('p2i-page-1').locator('img').evaluate((el) => (el as HTMLImageElement).naturalWidth)
    expect(w).toBeGreaterThan(50)

    // Switching format re-labels the download and clears the stale results.
    await page.getByTestId('p2i-format-jpeg').click()
    await expect(page.getByTestId('p2i-results')).toHaveCount(0)
    await page.getByTestId('p2i-convert').click()
    await expect(page.getByTestId('p2i-page-2')).toHaveAttribute('download', /sample-p2\.jpg$/, { timeout: 30_000 })
  })

  test('pdf to images: a page range limits what is produced', async ({ page }) => {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.create()
    for (let i = 0; i < 5; i++) doc.addPage([120, 160]).drawText(`p${i + 1}`, { x: 10, y: 80, size: 14 })
    const pdf = Buffer.from(await doc.save())

    await page.goto('/en/apps/pdf-to-images')
    await page.locator('input[type=file]').first().setInputFiles({ name: 'five.pdf', mimeType: 'application/pdf', buffer: pdf })
    await expect(page.getByTestId('p2i-count')).toContainText('5 pages')

    await page.getByTestId('p2i-range').fill('2-3, 5')
    await page.getByTestId('p2i-convert').click()
    await expect(page.getByTestId('p2i-results').locator('a')).toHaveCount(3, { timeout: 30_000 })
    await expect(page.getByTestId('p2i-page-2')).toBeVisible()
    await expect(page.getByTestId('p2i-page-5')).toBeVisible()
    await expect(page.getByTestId('p2i-page-1')).toHaveCount(0)

    await page.getByTestId('p2i-range').fill('nonsense')
    await page.getByTestId('p2i-convert').click()
    await expect(page.getByTestId('p2i-error')).toBeVisible()
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
    // Content type is auto-detected from what's typed: digits → Phone, "@" → Email.
    await page.getByTestId('qr-url').fill('0512345678')
    await expect(page.getByTestId('qr-code')).toContainText('Phone')
    await page.getByTestId('qr-url').fill('name@example.com')
    await expect(page.getByTestId('qr-code')).toContainText('Email')
    await page.getByTestId('qr-dot-liquid').click()
    // The frame's text label only appears once a frame ("template") is chosen.
    await expect(page.getByTestId('qr-label')).toHaveCount(0)
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
    await page.setInputFiles('input[type=file]', { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64') })
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
      window.bisTestSoundCount = 0
      const orig = AudioContext.prototype.createOscillator
      AudioContext.prototype.createOscillator = function () { window.bisTestSoundCount++; return orig.apply(this) }
    })
    const soundsPlayed = () => page.evaluate(() => window.bisTestSoundCount)
    await page.goto('/en/apps/random-picker')
    await page.getByTestId('rp-spin').click()
    // "mid-spin" = the wheel has audibly ticked but no winner yet — no duration assumed
    await expect.poll(soundsPlayed).toBeGreaterThan(0)
    await expect(page.getByTestId('rp-result')).toHaveCount(0)
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

  test('hajj-umrah: rite + level switch, tap to mark a step done', async ({ page }) => {
    await page.goto('/en/tools/hajj-umrah')
    // Defaults to ʿUmrah, full guide (recommended visible).
    const tawaf = page.getByTestId('step-u-tawaf')
    await expect(tawaf).toBeVisible()
    await expect(page.getByTestId('step-u-ghusl')).toBeVisible() // a recommended step
    // Tap to complete — the card dims.
    await tawaf.click()
    await expect(tawaf).toHaveClass(/opacity-60/)
    // Obligatory filter hides the sunnah steps.
    await page.getByTestId('level-obligatory').click()
    await expect(page.getByTestId('step-u-ghusl')).toHaveCount(0)
    await expect(page.getByTestId('step-u-tawaf')).toBeVisible()
    // Switching to Ḥajj shows its rites.
    await page.getByTestId('rite-hajj').click()
    await expect(page.getByTestId('step-h-arafah')).toBeVisible()
    await expect(page.getByTestId('step-u-tawaf')).toHaveCount(0)
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

  // A shell served from the service-worker cache carries an OLD <meta name="build">,
  // so version.json never matches it and the update check used to reload on every
  // return to the tab, forever. It must reload once, then stand down.
  test('a stale shell does not put the update check into a reload loop', async ({ page }) => {
    let loads = 0
    page.on('load', () => { loads++ })
    // A build the shell can never become — exactly how a cached shell looks.
    await page.route('**/version.json*', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ build: '9999999999999', notes: 'never arrives' }),
    }))
    await page.goto('/en')
    await expect(page.getByTestId('app-grid').or(page.locator('main'))).toBeVisible()
    const before = loads

    // Returning to the tab fires visibilitychange AND focus — both must not reload twice.
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')) })
    await expect.poll(() => loads, { timeout: 10_000 }).toBe(before + 1) // exactly one reload

    // Now the guard should hold: further returns must NOT reload again.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')) })
      await page.waitForTimeout(400)
    }
    expect(loads).toBe(before + 1)
  })

  // The toast compared build ids for inequality, so an older cached shell counted as
  // an "update" and it reappeared with no deploy behind it.
  test('an older build than the one already seen shows no "Updated" toast', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('bis-last-build', '9999999999999'))
    await page.goto('/en')
    await expect(page.locator('main')).toBeVisible()
    await page.waitForTimeout(800)
    await expect(page.getByTestId('updated-toast')).toHaveCount(0)
    // …and the higher build must survive, so it can't ping-pong on the next visit.
    expect(await page.evaluate(() => localStorage.getItem('bis-last-build'))).toBe('9999999999999')
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

test.describe('to-do lists', () => {
  test('add, tick off, clear finished — all local, no sign-in', async ({ page }) => {
    await page.goto('/en/apps/todo')
    // Starts with one list rather than an empty screen.
    await expect(page.getByTestId('todo-title')).toHaveValue('My tasks')

    await page.getByTestId('todo-input').fill('Buy dates')
    await page.getByTestId('todo-add').click()
    await page.getByTestId('todo-input').fill('Call the plumber')
    await page.getByTestId('todo-add').click()
    await expect(page.getByTestId('todo-item')).toHaveCount(2)
    await expect(page.getByTestId('todo-left')).toContainText('2 left')

    // Ticking one off leaves it listed but struck through.
    await page.getByTestId('todo-toggle').first().click()
    await expect(page.getByTestId('todo-left')).toContainText('1 left')
    await expect(page.getByTestId('todo-item')).toHaveCount(2)

    // Clearing finished drops only the ticked one.
    await page.getByTestId('todo-clear-done').click()
    await expect(page.getByTestId('todo-item')).toHaveCount(1)
    await expect(page.getByTestId('todo-items')).toContainText('Call the plumber')

    // It survives a reload — the whole point of local-first.
    await page.reload()
    await expect(page.getByTestId('todo-items')).toContainText('Call the plumber')
  })

  test('lists are separate, and sharing is gated behind sync', async ({ page }) => {
    await page.goto('/en/apps/todo')
    await page.getByTestId('todo-input').fill('First list task')
    await page.getByTestId('todo-add').click()

    await page.getByTestId('todo-new-list').click()
    await expect(page.getByTestId('todo-list-chip')).toHaveCount(2)
    await expect(page.getByTestId('todo-empty')).toBeVisible() // the new list is its own thing

    // Share only appears once a list is synced; until then it's the sync offer.
    await expect(page.getByTestId('todo-share')).toHaveCount(0)
    await expect(page.getByTestId('todo-enable-sync')).toBeVisible()
    await page.getByTestId('todo-enable-sync').click()
    await expect(page.getByTestId('todo-sync-sheet')).toContainText('stays on this device only')
  })
})

test.describe('image format converter', () => {
  // Android hands over iPhone HEIC photos with an empty or non-image MIME, and the
  // browser can't decode HEIC anyway. Both used to hit a bare `return` — the file
  // vanished with no message at all, which is what made this look like "I can't
  // select HEIC" rather than "HEIC isn't supported".
  test('a HEIC photo explains itself instead of silently doing nothing', async ({ page }) => {
    await page.goto('/en/apps/image-format-converter')
    // ISO-BMFF header with the `heic` brand — recognised by content, not by name.
    const heic = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'),
      Buffer.from([0, 0, 0, 0]), Buffer.from('mif1heic'),
    ])
    await page.locator('input[type=file]').setInputFiles({ name: 'IMG_0042.HEIC', mimeType: '', buffer: heic })
    // A malformed HEIC still has to say so — but must blame the file, not the browser,
    // now that HEIC decoding works (#226).
    const err = page.getByTestId('file-error')
    await expect(err).toBeVisible({ timeout: 20_000 })
    await expect(err).toContainText('HEIC')
    await expect(err).not.toContainText('can’t open HEIC')
  })

  test('an unreadable file says so rather than failing silently', async ({ page }) => {
    await page.goto('/en/apps/image-format-converter')
    await page.locator('input[type=file]').setInputFiles({
      name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not actually a png'),
    })
    await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 10_000 })
  })

  // An image `accept` makes Chrome on Android open the gallery picker, which only
  // lists MediaStore-indexed media — files in Downloads aren't offered at all. The
  // input must stay unrestricted so the full document browser opens.
  test('the picker is unrestricted, so Android opens the document browser', async ({ page }) => {
    await page.goto('/en/apps/image-format-converter')
    await expect(page.locator('input[type=file]')).not.toHaveAttribute('accept', /.+/)
  })
})

// #225: the same two defects existed in every image tool. Drive each one's picker
// with a HEIC and assert it explains itself rather than doing nothing, and that no
// tool re-introduces an image-only `accept` (which hides Downloads on Android).
const HEIC = () => readFileSync('e2e/fixtures/sample.heic')

for (const tool of [
  'favicon-generator', 'image-compressor', 'image-cropper', 'image-format-converter',
  'image-redact', 'image-to-ascii', 'images-to-pdf', 'meme-generator',
  'remove-background', 'steganography',
]) {
  test(`${tool}: accepts a real HEIC, and the picker isn't image-only`, async ({ page }) => {
    await page.goto(`/en/apps/${tool}`)
    const input = page.locator('input[type=file]').first()
    // An image-only accept makes Android open the gallery, which never lists Downloads.
    await expect(input).not.toHaveAttribute('accept', /^image\/\*$/)
    // A genuine HEIF still, with an EMPTY mime — exactly how Android hands one over.
    await input.setInputFiles({ name: 'IMG_0042.HEIC', mimeType: '', buffer: HEIC() })
    // It must decode, not be refused: no error surfaces.
    await expect(page.getByTestId('file-error')).toHaveCount(0, { timeout: 30_000 })
  })
}

// #226: a real HEIC (generated by ffmpeg, ftyp/heic brand) must actually CONVERT,
// not merely be recognised. This is the whole point — before this, every iPhone
// photo was a dead end on Android.
test.describe('HEIC decoding', () => {
  test('a real HEIC converts to JPG instead of being refused', async ({ page }) => {
    await page.goto('/en/apps/image-format-converter')
    await page.locator('input[type=file]').setInputFiles('e2e/fixtures/sample.heic')
    // No error, and the converted output appears (the wasm decoder is fetched lazily,
    // so allow for that download).
    await expect(page.getByTestId('ifc-download')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('file-error')).toHaveCount(0)
  })

  test('the HEIC decoder is not downloaded for an ordinary PNG', async ({ page }) => {
    const fetched: string[] = []
    page.on('request', (r) => { if (/wasm-bundle|libheif/i.test(r.url())) fetched.push(r.url()) })
    await page.goto('/en/apps/image-format-converter')
    await page.locator('input[type=file]').setInputFiles({
      name: 'x.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64'),
    })
    await expect(page.getByTestId('ifc-download')).toBeVisible({ timeout: 20_000 })
    expect(fetched, 'the 1.4MB wasm must not load for non-HEIC files').toEqual([])
  })
})

// #228: the deploy auto-reload must never destroy work, and must be visible when it
// does act — a dimmed UI is a diagnostic signal a user can report.
test.describe('update gate', () => {
  const NEWER = { build: '9999999999999', notes: 'Something changed' }

  test('with no work open, a new build reloads', async ({ page }) => {
    // The blocking overlay only lives for one frame before the tab goes, so assert
    // the reload itself rather than racing the paint.
    let loads = 0
    page.on('load', () => { loads++ })
    await page.route('**/version.json*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NEWER) }))
    await page.goto('/en/apps/qr-code')
    const before = loads
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await expect.poll(() => loads, { timeout: 15_000 }).toBe(before + 1)
  })

  // The dimmed state is a DIAGNOSTIC SIGNAL: a user can say "the screen went grey"
  // and that pinpoints the update path. Assert it on a slow check, where it's stable.
  test('a slow check dims the UI and says controls are paused', async ({ page }) => {
    await page.route('**/version.json*', async (r) => {
      await new Promise((res) => setTimeout(res, 2500)) // slower than the 500ms threshold
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: '1', notes: '' }) })
    })
    await page.goto('/en/apps/qr-code')
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) })
    const gate = page.getByTestId('update-checking')
    await expect(gate).toBeVisible({ timeout: 10_000 })
    await expect(gate).toContainText('Checking for updates')
    await expect(gate).toContainText('paused')
    // It dims rather than hides: the page underneath is still there to be seen.
    await expect(page.getByTestId('qr-code')).toBeAttached()
    // …and it clears itself once the check answers.
    await expect(gate).toHaveCount(0, { timeout: 15_000 })
  })

  test('with an image loaded, the update is OFFERED, never taken', async ({ page }) => {
    await page.goto('/en/apps/image-format-converter')
    // Load a real image so the tool declares work in progress.
    await page.locator('input[type=file]').setInputFiles({
      name: 'x.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64'),
    })
    await expect(page.getByTestId('ifc-download')).toBeVisible({ timeout: 20_000 })

    await page.route('**/version.json*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NEWER) }))
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) })

    // Offered, not applied: the work survives and the page did not reload.
    await expect(page.getByTestId('update-offered')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('update-reloading')).toHaveCount(0)
    await expect(page.getByTestId('ifc-download')).toBeVisible()
    // And the user can take it when ready.
    await expect(page.getByTestId('update-reload-now')).toBeVisible()
  })
})

// Analytics runs cookieless: no identifier is persisted, so there is nothing to
// consent to and no cookie banner. Assert the shell actually says so, and that no
// _ga cookie appears at runtime.
test.describe('analytics', () => {
  test('GA is configured cookieless and sets no _ga cookie', async ({ page, context }) => {
    await page.goto('/en')
    const html = await page.content()
    expect(html).toContain("analytics_storage: 'denied'")
    // The real assertion: GA actually loads here, so if consent were configured
    // wrongly it WOULD write _ga. (It did, when this used the Universal Analytics
    // `client_storage` parameter, which GA4 silently ignores.) Wait for GA to
    // actually fire — that's when the cookie WOULD be written — instead of a blind
    // timer; if GA is blocked (e.g. offline sandbox), fall back.
    await page.waitForRequest((req) => /google-analytics\.com|googletagmanager\.com\/gtag\/js/.test(req.url()), { timeout: 8000 }).catch(() => {})
    const cookies = await context.cookies()
    expect(cookies.filter((c) => c.name.startsWith('_ga')), 'no analytics cookies').toEqual([])
  })

  test('the privacy page states the cookieless position in both locales', async ({ page }) => {
    await page.goto('/en/privacy')
    await expect(page.getByText(/cookieless mode/i)).toBeVisible()
    await expect(page.getByText(/no cookie banner/i)).toBeVisible()
    await page.goto('/ar/privacy')
    await expect(page.getByText(/بلا كوكيز/)).toBeVisible()
  })
})

// #234: cut pieces out of an image, move and rotate them, export the result.
test.describe('rearrange image', () => {
  // A real 40x40 PNG (generated, not hand-written — an invented base64 silently
  // fails to decode and the tool then shows nothing, which is confusing to debug).
  const IMG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAIAAAADnC86AAAK+UlEQVR4nA3NkRqFMACA0SiKoiiKoiiKoiiKRtFoFI36fhhFURSNoiiKolEURVHUU9x7XuB4nofvEXiEHpFH7JF4pB6ZR+5ReJQelUft0XgIj9ZDeiiPzkN79B7GY/AYPSaP2cN6LB6rx+axexwezuP0uDxuj8fj9fg8PM/H9wl8Qp/IJ/ZJfFKfzCf3KXxKn8qn9ml8hE/rI32UT+ejfXof4zP4jD6Tz+xjfRaf1Wfz2X0OH+dz+lw+t8/j8/p8/j8O8AOCgDAgCogDkoA0IAvIA4qAMqAKqAOaABHQBsgAFdAF6IA+wAQMAWPAFDAH2IAlYA3YAvaAI8AFnAFXwB3wBLwBX/CPQ/yQICQMiULikCQkDclC8pAipAypQuqQJkSEtCEyRIV0ITqkDzEhQ8gYMoXMITZkCVlDtpA95AhxIWfIFXKHPCFvyBf+4wg/IogII6KIOCKJSCOyiDyiiCgjqog6ookQEW2EjFARXYSO6CNMxBAxRkwRc4SNWCLWiC1ijzgiXMQZcUXcEU/EG/FF/zjGjwliwpgoJo5JYtKYLCaPKWLKmCqmjmliREwbI2NUTBejY/oYEzPEjDFTzBxjY5aYNWaL2WOOGBdzxlwxd8wT88Z88T9O8BOChDAhSogTkoQ0IUvIE4qEMqFKqBOaBJHQJsgEldAl6IQ+wSQMCWPClDAn2IQlYU3YEvaEI8ElnAlXwp3wJLwJX/KPU/yUICVMiVLilCQlTclS8pQipUypUuqUJkWktCkyRaV0KTqlTzEpQ8qYMqXMKTZlSVlTtpQ95UhxKWfKlXKnPClvypf+4ww/I8gIM6KMOCPJSDOyjDyjyCgzqow6o8kQGW2GzFAZXYbO6DNMxpAxZkwZc4bNWDLWjC1jzzgyXMaZcWXcGU/Gm/Fl/zjHzwlywpwoJ85JctKcLCfPKXLKnCqnzmlyRE6bI3NUTpejc/ockzPkjDlTzpxjc5acNWfL2XOOHJdz5lw5d86T8+Z8+T8u8AuCgrAgKogLkoK0ICvIC4qCsqAqqAuaAlHQFsgCVdAV6IK+wBQMBWPBVDAX2IKlYC3YCvaCo8AVnAVXwV3wFLwFX/GPS/ySoCQsiUrikqQkLclK8pKipCypSuqSpkSUtCWyRJV0JbqkLzElQ8lYMpXMJbZkKVlLtpK95ChxJWfJVXKXPCVvyVf+4wq/IqgIK6KKuCKpSCuyiryiqCgrqoq6oqkQFW2FrFAVXYWu6CtMxVAxVkwVc4WtWCrWiq1irzgqXMVZcVXcFU/FW/FV/7jGrwlqwpqoJq5JatKarCavKWrKmqqmrmlqRE1bI2tUTVeja/oaUzPUjDVTzVxja5aatWar2WuOGldz1lw1d81T89Z89T9u8BuChrAhaogbkoa0IWvIG4qGsqFqqBuaBtHQNsgG1dA16Ia+wTQMDWPD1DA32IalYW3YGvaGo8E1nA1Xw93wNLwNX/OPBb4gEISCSBALEkEqyAS5oBCUgkpQCxqBELQCKVCCTqAFvcAIBsEomASzwAoWwSrYBLvgEDjBKbgEt+ARvIJP/OMWvyVoCVuilrglaUlbspa8pWgpW6qWuqVpES1ti2xRLV2LbulbTMvQMrZMLXOLbVla1patZW85WlzL2XK13C1Py9vytf9Y4ksCSSiJJLEkkaSSTJJLCkkpqSS1pJEISSuREiXpJFrSS4xkkIySSTJLrGSRrJJNsksOiZOckktySx7JK/nkP1b4ikARKiJFrEgUqSJT5IpCUSoqRa1oFELRKqRCKTqFVvQKoxgUo2JSzAqrWBSrYlPsikPhFKfiUtyKR/EqPvWPO/yOoCPsiDrijqQj7cg68o6io+yoOuqOpkN0tB2yQ3V0Hbqj7zAdQ8fYMXXMHbZj6Vg7to694+hwHWfH1XF3PB1vx9f9Y42vCTShJtLEmkSTajJNrik0pabS1JpGIzStRmqUptNoTa8xmkEzaibNrLGaRbNqNs2uOTROc2ouza15NK/m0/+4x+8JesKeqCfuSXrSnqwn7yl6yp6qp+5pekRP2yN7VE/Xo3v6HtMz9Iw9U8/cY3uWnrVn69l7jh7Xc/ZcPXfP0/P2fP0/NviGwBAaIkNsSAypITPkhsJQGipDbWgMwtAapEEZOoM29AZjGAyjYTLMBmtYDKthM+yGw+AMp+Ey3IbH8Bo+848H/IFgIByIBuKBZCAdyAbygWKgHKgG6oFmQAy0A3JADXQDeqAfMAPDwDgwDcwDdmAZWAe2gX3gGHAD58A1cA88A+/AN/zjEX8kGAlHopF4JBlJR7KRfKQYKUeqkXqkGREj7YgcUSPdiB7pR8zIMDKOTCPziB1ZRtaRbWQfOUbcyDlyjdwjz8g78o3/eMKfCCbCiWginkgm0olsIp8oJsqJaqKeaCbERDshJ9REN6En+gkzMUyME9PEPGEnlol1YpvYJ44JN3FOXBP3xDPxTnzTP57xZ4KZcCaaiWeSmXQmm8lniplyppqpZ5oZMdPOyBk1083omX7GzAwz48w0M8/YmWVmndlm9pljxs2cM9fMPfPMvDPf/I8tviWwhJbIElsSS2rJLLmlsJSWylJbGouwtBZpUZbOoi29xVgGy2iZLLPFWhbLatksu+WwOMtpuSy35bG8ls/+4wV/IVgIF6KFeCFZSBeyhXyhWCgXqoV6oVkQC+2CXFAL3YJe6BfMwrAwLkwL84JdWBbWhW1hXzgW3MK5cC3cC8/Cu/At/3jFXwlWwpVoJV5JVtKVbCVfKVbKlWqlXmlWxEq7IlfUSreiV/oVszKsjCvTyrxiV5aVdWVb2VeOFbdyrlwr98qz8q586z/e8DeCjXAj2og3ko10I9vIN4qNcqPaqDeaDbHRbsgNtdFt6I1+w2wMG+PGtDFv2I1lY93YNvaNY8NtnBvXxr3xbLwb3/aPd/ydYCfciXbinWQn3cl28p1ip9ypduqdZkfstDtyR+10O3qn3zE7w864M+3MO3Zn2Vl3tp1959hxO+fOtXPvPDvvzrf/4wP/IDgID6KD+CA5SA+yg/ygOCgPqoP6oDkQB+2BPFAH3YE+6A/MwXAwHkwH84E9WA7Wg+1gPzgO3MF5cB3cB8/Be/Ad/9jhOwJH6IgcsSNxpI7MkTsKR+moHLWjcQhH65AO5egc2tE7jGNwjI7JMTusY3Gsjs2xOw6Hc5yOy3E7Hsfr+Nw/PvFPgpPwJDqJT5KT9CQ7yU+Kk/KkOqlPmhNx0p7IE3XSneiT/sScDCfjyXQyn9iT5WQ92U72k+PEnZwn18l98py8J9/5jy/8i+AivIgu4ovkIr3ILvKL4qK8qC7qi+ZCXLQX8kJddBf6or8wF8PFeDFdzBf2YrlYL7aL/eK4cBfnxXVxXzwX78V3/eMb/ya4CW+im/gmuUlvspv8prgpb6qb+qa5ETftjbxRN92NvulvzM1wM95MN/ONvVlu1pvtZr85btzNeXPd3DfPzXvz3f/4wX8IHsKH6CF+SB7Sh+whfygeyofqoX5oHsRD+yAf1EP3oB/6B/MwPIwP08P8YB+Wh/Vhe9gfjgf3cD5cD/fD8/A+fM8/fvFfgpfwJXqJX5KX9CV7yV+Kl/Kleqlfmhfx0r7IF/XSveiX/sW8DC/jy/Qyv9iX5WV92V72l+PFvZwv18v98ry8L9/7jz/8j+Aj/Ig+4o/kI/3IPvKP4qP8qD7qj+ZDfLQf8kN9dB/6o/8wH8PH+DF9zB/2Y/lYP7aP/eP4cB/nx/Vxfzwf78f38QN7Pdb59jEZyQAAAABJRU5ErkJggg==',
    'base64')

  async function load(page: import('@playwright/test').Page) {
    await page.goto('/en/apps/image-rearrange')
    await page.locator('input[type=file]').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: IMG })
    await expect(page.getByTestId('rearr-canvas')).toBeVisible({ timeout: 15_000 })
  }

  test('dragging on the image cuts out a piece', async ({ page }) => {
    await load(page)
    await expect(page.getByTestId('rearr-count')).toContainText('Nothing cut out')
    const box = (await page.getByTestId('rearr-canvas').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.15)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByTestId('rearr-count')).toContainText('Pieces: 1')
    // A selected piece can be removed again.
    await expect(page.getByTestId('rearr-remove')).toBeVisible()
    await page.getByTestId('rearr-remove').click()
    await expect(page.getByTestId('rearr-count')).toContainText('Nothing cut out')
  })

  test('a tiny tap does not create a stray piece', async ({ page }) => {
    await load(page)
    const box = (await page.getByTestId('rearr-canvas').boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByTestId('rearr-count')).toContainText('Nothing cut out')
  })

  test('the result downloads as a PNG', async ({ page }) => {
    await load(page)
    const box = (await page.getByTestId('rearr-canvas').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 6 })
    await page.mouse.up()
    const dl = page.waitForEvent('download')
    await page.getByTestId('rearr-save').click()
    expect((await dl).suggestedFilename()).toBe('rearranged.png')
  })
})

test.describe('arabic numerals', () => {
  test('flips Arabic-Indic digits to Western and back', async ({ page }) => {
    await page.goto('/en/apps/arabic-numerals')
    await page.getByTestId('num-input').fill('الفاتورة ١٢٣٤٫٥٦ ريال')
    await expect(page.getByTestId('num-detected')).toContainText('Arabic-Indic')
    // Auto-target: text is Arabic-Indic only, so it converts to Western.
    await expect(page.getByTestId('num-output')).toHaveValue('الفاتورة 1234.56 ريال')
    await page.getByTestId('num-to-arabic').click()
    await expect(page.getByTestId('num-output')).toHaveValue('الفاتورة ١٢٣٤٫٥٦ ريال')
  })

  test('a full stop ending a sentence is not turned into a decimal mark', async ({ page }) => {
    await page.goto('/en/apps/arabic-numerals')
    await page.getByTestId('num-input').fill('عدد 5. تم')
    await page.getByTestId('num-to-arabic').click()
    await expect(page.getByTestId('num-output')).toHaveValue('عدد ٥. تم')
  })
})

test.describe('arabic normalizer', () => {
  test('strips tashkeel and unifies alef and yaa', async ({ page }) => {
    await page.goto('/en/apps/arabic-normalize')
    await page.getByTestId('norm-input').fill('مُحَمَّد أحمد إلى مصطفى')
    await expect(page.getByTestId('norm-output')).toHaveValue('محمد احمد الي مصطفي')
    await expect(page.getByTestId('norm-found')).toBeVisible()
  })

  test('turning a rule off leaves those letters alone', async ({ page }) => {
    await page.goto('/en/apps/arabic-normalize')
    await page.getByTestId('norm-input').fill('أحمد')
    await expect(page.getByTestId('norm-output')).toHaveValue('احمد')
    await page.getByTestId('norm-alef').uncheck()
    await expect(page.getByTestId('norm-output')).toHaveValue('أحمد')
  })
})

test.describe('fix garbled text', () => {
  test('recovers Arabic mangled as windows-1252', async ({ page }) => {
    await page.goto('/en/apps/fix-encoding')
    await page.getByTestId('enc-sample').click()
    await expect(page.getByTestId('enc-output')).toHaveValue('السلام عليكم')
    await expect(page.getByTestId('enc-via')).toContainText('windows-1252')
  })

  test('intact text is reported as needing no repair', async ({ page }) => {
    await page.goto('/en/apps/fix-encoding')
    await page.getByTestId('enc-input').fill('perfectly fine text')
    await expect(page.getByTestId('enc-none')).toContainText('already looks intact')
  })
})

test.describe('saudi phone', () => {
  test('normalises every shape of the same mobile number', async ({ page }) => {
    await page.goto('/en/apps/saudi-phone')
    for (const shape of ['0501234567', '+966 50 123 4567', '966501234567', '٠٥٠١٢٣٤٥٦٧']) {
      await page.getByTestId('ph-input').fill(shape)
      await expect(page.getByTestId('ph-e164')).toHaveText('+966501234567')
      await expect(page.getByTestId('ph-nat')).toHaveText('050 123 4567')
      await expect(page.getByTestId('ph-kind')).toHaveText('Mobile')
    }
    // The prefix is reported as an allocation, never as today's operator.
    await expect(page.getByTestId('ph-operator')).toContainText('stc')
  })

  test('recognises a landline and names its region', async ({ page }) => {
    await page.goto('/en/apps/saudi-phone')
    await page.getByTestId('ph-input').fill('011 456 7890')
    await expect(page.getByTestId('ph-kind')).toHaveText('Landline')
    await expect(page.getByTestId('ph-result')).toContainText('Riyadh')
  })

  test('rejects a number that is the wrong length', async ({ page }) => {
    await page.goto('/en/apps/saudi-phone')
    await page.getByTestId('ph-input').fill('05012345')
    await expect(page.getByTestId('ph-invalid')).toBeVisible()
  })

  test('bulk mode counts the valid ones', async ({ page }) => {
    await page.goto('/en/apps/saudi-phone')
    await page.getByTestId('ph-mode-many').click()
    await page.getByTestId('ph-list').fill('0501234567\n0129999999\nnot a number\n+966561112222')
    await expect(page.getByTestId('ph-summary')).toHaveText('3 of 4 valid')
  })
})

test.describe('subtitle editor', () => {
  const SRT = [
    '1', '00:00:01,000 --> 00:00:03,000', 'Hello there', '',
    '2', '00:00:04,500 --> 00:00:06,000', 'Second line', '',
  ].join('\n')

  test('parses, shifts every cue, and exports SRT', async ({ page }) => {
    await page.goto('/en/apps/subtitle-editor')
    await page.getByTestId('sub-paste').fill(SRT)
    await expect(page.getByTestId('sub-count')).toHaveText('2 cues')
    await expect(page.getByTestId('sub-start-0')).toHaveValue('00:00:01,000')

    await page.getByTestId('sub-offset').fill('2')
    await page.getByTestId('sub-later').click()
    await expect(page.getByTestId('sub-start-0')).toHaveValue('00:00:03,000')
    await page.getByTestId('sub-earlier').click()
    await expect(page.getByTestId('sub-start-0')).toHaveValue('00:00:01,000')

    const dl = page.waitForEvent('download')
    await page.getByTestId('sub-download').click()
    expect((await dl).suggestedFilename()).toBe('subtitles.srt')
  })

  test('shifting earlier never produces a negative timestamp', async ({ page }) => {
    await page.goto('/en/apps/subtitle-editor')
    await page.getByTestId('sub-paste').fill(SRT)
    await page.getByTestId('sub-offset').fill('30')
    await page.getByTestId('sub-earlier').click()
    await expect(page.getByTestId('sub-start-0')).toHaveValue('00:00:00,000')
  })

  test('converts to WebVTT, dots and all', async ({ page }) => {
    await page.goto('/en/apps/subtitle-editor')
    await page.getByTestId('sub-paste').fill(SRT)
    await page.getByTestId('sub-fmt-vtt').click()
    await expect(page.getByTestId('sub-start-0')).toHaveValue('00:00:01.000')
    const dl = page.waitForEvent('download')
    await page.getByTestId('sub-download').click()
    expect((await dl).suggestedFilename()).toBe('subtitles.vtt')
  })

  test('a frame-rate fix rescales the timings', async ({ page }) => {
    await page.goto('/en/apps/subtitle-editor')
    await page.getByTestId('sub-paste').fill(SRT)
    await page.getByTestId('sub-from').selectOption('25')
    await page.getByTestId('sub-to').selectOption('23.976')
    await page.getByTestId('sub-rate').click()
    // 1s at 25fps becomes ~1.043s when the film actually runs at 23.976.
    await expect(page.getByTestId('sub-start-0')).toHaveValue('00:00:01,043')
  })

  test('flags a cue that ends before it starts', async ({ page }) => {
    await page.goto('/en/apps/subtitle-editor')
    await page.getByTestId('sub-paste').fill('1\n00:00:05,000 --> 00:00:02,000\nBackwards\n')
    await expect(page.getByTestId('sub-issues')).toContainText('ends before it starts')
  })
})

test.describe('weather', () => {
  // Open-Meteo is mocked: the suite must not depend on a third party being up,
  // and asserting on real weather is impossible anyway.
  async function mockApi(page: import('@playwright/test').Page) {
    await page.route('**/api.open-meteo.com/**', (route) => route.fulfill({
      json: {
        timezone: 'Asia/Riyadh',
        current: {
          temperature_2m: 41.2, apparent_temperature: 45.8, relative_humidity_2m: 12,
          wind_speed_10m: 18, weather_code: 0, is_day: 1,
        },
        hourly: {
          time: Array.from({ length: 24 }, (_, i) => `2026-08-05T${String(i).padStart(2, '0')}:00`),
          temperature_2m: Array.from({ length: 24 }, (_, i) => 30 + i * 0.5),
          weather_code: Array(24).fill(0),
          precipitation_probability: Array(24).fill(0),
        },
        daily: {
          time: ['2026-08-05', '2026-08-06'],
          weather_code: [0, 3], temperature_2m_max: [43, 41], temperature_2m_min: [29, 28],
          sunrise: ['2026-08-05T05:40'], sunset: ['2026-08-05T18:50'],
          uv_index_max: [11, 9], precipitation_probability_max: [0, 30],
        },
      },
    }))
    await page.route('**/air-quality-api.open-meteo.com/**', (route) => route.fulfill({
      json: { current: { pm10: 220, pm2_5: 60, dust: 180 } },
    }))
  }

  test('shows current conditions, dust and per-prayer temperatures', async ({ page }) => {
    await mockApi(page)
    await page.goto('/en/apps/weather')
    await expect(page.getByTestId('wx-temp')).toHaveText('41°')
    await expect(page.getByTestId('wx-desc')).toHaveText('Clear')
    // PM10 of 220 lands in the "Dusty" band, the reading that matters here.
    await expect(page.getByTestId('wx-dust-band')).toHaveText('Dusty')
    await expect(page.getByTestId('wx-prayers').locator('> div')).toHaveCount(6)
    await expect(page.getByTestId('wx-hourly').locator('> div')).toHaveCount(24)
  })

  test('a failing air-quality call still leaves you with a forecast', async ({ page }) => {
    await mockApi(page)
    await page.route('**/air-quality-api.open-meteo.com/**', (route) => route.abort())
    await page.goto('/en/apps/weather')
    await expect(page.getByTestId('wx-temp')).toHaveText('41°')
    await expect(page.getByTestId('wx-dust')).toHaveCount(0)
  })

  test('a dead network surfaces an error rather than an empty page', async ({ page }) => {
    await page.route('**/*.open-meteo.com/**', (route) => route.abort())
    await page.goto('/en/apps/weather')
    await expect(page.getByTestId('wx-error')).toBeVisible()
  })

  test('only a rounded coordinate is ever sent', async ({ page }) => {
    await mockApi(page)
    const urls: string[] = []
    page.on('request', (r) => { if (r.url().includes('open-meteo')) urls.push(r.url()) })
    await page.goto('/en/apps/weather')
    await expect(page.getByTestId('wx-temp')).toBeVisible()
    expect(urls.length).toBeGreaterThan(0)
    for (const u of urls) {
      const lat = new URL(u).searchParams.get('latitude')!
      expect(lat.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
    }
  })
})

test.describe('id expiry', () => {
  test('counts the days left and keeps the document after a reload', async ({ page }) => {
    await page.goto('/en/apps/id-expiry')
    await expect(page.getByTestId('exp-empty')).toBeVisible()
    const soon = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
    await page.getByTestId('exp-date').fill(soon)
    await page.getByTestId('exp-add').click()
    await expect(page.getByTestId('exp-days')).toHaveText('10 days left')
    await page.reload()
    await expect(page.getByTestId('exp-days')).toHaveText('10 days left')
  })

  test('an already-expired document says so', async ({ page }) => {
    await page.goto('/en/apps/id-expiry')
    const past = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
    await page.getByTestId('exp-date').fill(past)
    await page.getByTestId('exp-add').click()
    await expect(page.getByTestId('exp-days')).toContainText('Expired 3 days ago')
  })

  test('a Hijri date is accepted and shown in both calendars', async ({ page }) => {
    await page.goto('/en/apps/id-expiry')
    await page.getByTestId('exp-calendar').selectOption('hijri')
    await page.getByTestId('exp-h-year').fill('1450')
    await page.getByTestId('exp-h-day').fill('15')
    await page.getByTestId('exp-add').click()
    await expect(page.getByTestId('exp-list')).toContainText('1450')
    await expect(page.getByTestId('exp-list')).toContainText(/20\d\d/)
  })

  test('removing a document clears it', async ({ page }) => {
    await page.goto('/en/apps/id-expiry')
    await page.getByTestId('exp-add').click()
    await expect(page.getByTestId('exp-list')).toBeVisible()
    await page.getByTestId('exp-remove').click()
    await expect(page.getByTestId('exp-empty')).toBeVisible()
  })
})

test.describe('2fa code generator', () => {
  // RFC 6238 test vector: the ASCII secret "12345678901234567890" in base32.
  const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

  test('produces the RFC 6238 reference code for a known time', async ({ page }) => {
    // setFixedTime, not install: an installed clock keeps ticking through page
    // load, which pushed T=59s into the next 30-second window and changed the code.
    await page.clock.setFixedTime(new Date(59_000))
    await page.goto('/en/apps/totp')
    await page.getByTestId('totp-secret').fill(RFC_SECRET)
    await page.getByTestId('totp-digits').selectOption('8')
    await page.getByTestId('totp-add').click()
    await expect(page.getByTestId('totp-code')).toHaveText('94287082')
  })

  test('parses an otpauth link and picks up its settings', async ({ page }) => {
    await page.goto('/en/apps/totp')
    await page.getByTestId('totp-secret').fill('otpauth://totp/ACME:me@example.com?secret=' + RFC_SECRET + '&issuer=ACME&digits=6&period=60')
    await page.getByTestId('totp-add').click()
    await expect(page.getByTestId('totp-row')).toContainText('ACME')
    await expect(page.getByTestId('totp-row')).toContainText('me@example.com')
    await expect(page.getByTestId('totp-row')).toContainText('60s')
    await expect(page.getByTestId('totp-code')).toHaveText(/^\d{6}$/)
  })

  test('rejects a secret that is not base32', async ({ page }) => {
    await page.goto('/en/apps/totp')
    await page.getByTestId('totp-secret').fill('not-a-secret-189!')
    await page.getByTestId('totp-add').click()
    await expect(page.getByTestId('totp-error')).toBeVisible()
    await expect(page.getByTestId('totp-empty')).toBeVisible()
  })

  test('nothing is stored unless the user opts in', async ({ page }) => {
    await page.goto('/en/apps/totp')
    await page.getByTestId('totp-secret').fill(RFC_SECRET)
    await page.getByTestId('totp-add').click()
    await expect(page.getByTestId('totp-row')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('bis-totp'))).toBe('[]')

    await page.getByTestId('totp-remember').check()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bis-totp') || '[]').length)).toBe(1)
    await page.reload()
    await expect(page.getByTestId('totp-row')).toBeVisible()
  })
})

test.describe('password strength', () => {
  test('does not let a padded common password look strong', async ({ page }) => {
    await page.goto('/en/apps/password-strength')
    await page.getByTestId('pw-input').fill('Password123!')
    // Raw entropy would call this strong; the penalties are the whole point.
    await expect(page.getByTestId('pw-score')).toHaveText(/Very weak|Weak/)
    await expect(page.getByTestId('pw-findings')).toContainText('common word')
  })

  test('rates a long passphrase highly', async ({ page }) => {
    await page.goto('/en/apps/password-strength')
    await page.getByTestId('pw-input').fill('velvet-harbour-tumble-glint-42')
    await expect(page.getByTestId('pw-score')).toHaveText('Very strong')
    await expect(page.getByTestId('pw-crack')).not.toHaveText('instantly')
  })

  test('names the specific weakness it found', async ({ page }) => {
    await page.goto('/en/apps/password-strength')
    await page.getByTestId('pw-input').fill('qwerty1234')
    await expect(page.getByTestId('pw-findings')).toContainText('keyboard walk')
    await page.getByTestId('pw-input').fill('aaaaaaaaaaaa')
    await expect(page.getByTestId('pw-findings')).toContainText('repeats')
  })

  test('the field is masked until asked otherwise', async ({ page }) => {
    await page.goto('/en/apps/password-strength')
    await expect(page.getByTestId('pw-input')).toHaveAttribute('type', 'password')
    await page.getByTestId('pw-show').check()
    await expect(page.getByTestId('pw-input')).toHaveAttribute('type', 'text')
  })
})
