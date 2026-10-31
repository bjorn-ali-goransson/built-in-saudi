import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { deflateSync, crc32 } from 'node:zlib'

declare global {
  /** Installed by the random-picker sound test: how many sounds the page has played. */
  interface Window { bisTestSoundCount: number }
}

test.describe('home', () => {
  // `await locator.count()` resolves once and never retries: on a slow runner the
  // lazily-loaded tool chunk has not rendered yet, the count reads 0, and a
  // perfectly healthy page fails the assertion. Every count assertion here uses
  // expect.poll, which re-reads until it passes or times out. This suite runs
  // with retries:0 on purpose, so a test that depends on render timing is a
  // defect in the test.
  test('opens to the app grid + search', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('.tool-search__input')).toBeVisible()
    const cards = page.locator('[data-testid^="tool-"]')
    await expect(cards.first()).toBeVisible()
    await expect.poll(() => cards.count()).toBeGreaterThan(8)
    // The marketing hero is gone.
    await expect(page.locator('.hero__title')).toHaveCount(0)
  })

  test('search filters the catalog', async ({ page }) => {
    await page.goto('/en')
    const all = await page.locator('[data-testid^="tool-"]').count()
    await page.locator('.tool-search__input').fill('qibla')
    const cards = page.locator('[data-testid^="tool-"]')
    await expect(cards.first()).toContainText(/Qibla/i) // ranked top
    await expect.poll(() => cards.count()).toBeLessThan(all) // and the list is filtered down
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

  test('pdf merge: renders the dropzone', async ({ page }) => {
    await page.goto('/en/tools/pdf-merge')
    await expect(page.getByTestId('pdf-merge')).toBeVisible()
    await expect(page.getByTestId('pm-drop')).toBeVisible()
    await expect(page.getByText(/leaves your device/i).first()).toBeVisible()
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
    await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(5)
  })

  test('islamic calendar: renders a month grid', async ({ page }) => {
    await page.goto('/en/tools/islamic-calendar')
    await expect(page.getByTestId('cal-title')).toBeVisible()
    const days = page.locator('.cal2__cell:not(.is-blank)')
    await expect.poll(() => days.count()).toBeGreaterThan(27)
    // toggling to Gregorian keeps the grid populated
    await page.getByTestId('cal-mode-greg').click()
    await expect.poll(() => page.locator('.cal2__cell:not(.is-blank)').count()).toBeGreaterThan(27)
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

  test('istikhara: shows the du‘a and its source', async ({ page }) => {
    await page.goto('/en/tools/istikhara')
    await expect(page.getByTestId('istikhara-dua')).toContainText('اللَّهُمَّ')
    await expect(page.getByText(/al-Bukhārī/)).toBeVisible()
  })

  test('hisn al-muslim: lists chapters and opens one', async ({ page }) => {
    await page.goto('/en/tools/hisn-al-muslim')
    const chapters = page.locator('[data-testid^="hisn-ch-"]')
    await expect.poll(() => chapters.count()).toBeGreaterThan(50)
    await chapters.first().click()
    await expect(page.getByTestId('hisn-back')).toBeVisible()
    await page.getByTestId('hisn-back').click()
    await page.getByTestId('hisn-search').fill('الاستيقاظ')
    await expect.poll(() => page.locator('[data-testid^="hisn-ch-"]').count()).toBeGreaterThanOrEqual(1)
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

  test('csv to json: a BOM does not become part of the first key', async ({ page }) => {
    // Excel writes a UTF-8 BOM, and so do this site's OWN csv tools on purpose,
    // so Excel reads Arabic rather than mojibake. The private parser this tool
    // used to carry did not strip it, so the first JSON key came out as
    // "﻿name" — invisible in any viewer, and undefined for every consumer
    // downstream.
    await page.goto('/en/apps/csv-json')
    await page.getByTestId('cj-input').fill('﻿name,city\nSara,Riyadh')
    await expect(page.getByTestId('cj-output')).toContainText('"name": "Sara"')
    // Checked by codepoint, not by substring: U+FEFF is zero-width, so
    // `not.toContainText('﻿')` compares against what is effectively the
    // empty string and can never hold. An assertion that cannot pass is as
    // useless as one that cannot fail.
    const out = await page.getByTestId('cj-output').inputValue()
    expect([...out].some((c) => c.codePointAt(0) === 0xfeff)).toBe(false)
  })

  test('csv to json: a semicolon file is not one column', async ({ page }) => {
    // The default separator in several European and Arabic Excel locales.
    await page.goto('/en/apps/csv-json')
    await page.getByTestId('cj-input').fill('name;city\nSara;Riyadh')
    await expect(page.getByTestId('cj-output')).toContainText('"city": "Riyadh"')
  })

  test('bill splitter: 240 across 4 is 60 each', async ({ page }) => {
    await page.goto('/en/apps/split-bill')
    await page.getByTestId('sb-bill').fill('240')
    await page.getByTestId('sb-tip').fill('0')
    await page.getByTestId('sb-people').fill('4')
    await expect(page.getByTestId('sb-per')).toHaveText('60.00')
  })

  test('pomodoro: the third mode of the stopwatch starts at 25:00', async ({ page }) => {
    await page.goto('/en/apps/stopwatch')
    await page.getByTestId('sw-pomodoro').click()
    await expect(page.getByTestId('pom-time')).toHaveText('25:00')
    await expect(page.getByTestId('pom-toggle')).toBeVisible()
  })

  test('zakat: 2.5% above nisab', async ({ page }) => {
    await page.goto('/en/apps/zakat-calculator')
    await page.getByTestId('zk-cash').fill('100000')
    await page.getByTestId('zk-nisab').fill('4000')
    await expect(page.getByTestId('zk-due')).toHaveText('2,500.00')
  })

  test('age calculator: computes an age from a birth date', async ({ page }) => {
    await page.goto('/en/apps/date-diff')
    await page.getByTestId('dd-cal-age').click()
    await page.getByTestId('age-input').fill('2000-01-01')
    await expect(page.getByTestId('age-result')).toContainText('years')
    await expect(page.getByTestId('age-next')).toBeVisible()
  })

  test('working days: a Mon–Fri week is 5 working days (Sat–Sun weekend)', async ({ page }) => {
    await page.goto('/en/apps/date-diff')
    await page.getByTestId('dd-satsun').click()
    await page.getByTestId('dd-from').fill('2026-07-06') // Monday
    await page.getByTestId('dd-to').fill('2026-07-10')   // Friday
    await expect(page.getByTestId('dd-working')).toHaveText('5')
    // The Saudi weekend takes the Friday out.
    await page.getByTestId('dd-frisat').click()
    await expect(page.getByTestId('dd-working')).toHaveText('4')
  })

  for (const [from, to] of [['age-calculator', 'date-diff'], ['working-days', 'date-diff'], ['pomodoro', 'stopwatch'], ['team-maker', 'spin-wheel'], ['dice-roller', 'spin-wheel']]) {
    test(`${from} now lives in ${to}`, async ({ page }) => {
      await page.goto(`/en/apps/${from}`)
      await expect(page).toHaveURL(new RegExp(`/en/apps/${to}/?$`))
    })
  }

  test('cubic bezier: preset updates the CSS value', async ({ page }) => {
    await page.goto('/en/apps/cubic-bezier')
    await page.getByTestId('cb-preset-linear').click()
    await expect(page.getByTestId('cb-output')).toHaveText('cubic-bezier(0, 0, 1, 1)')
  })

  test('dice roller: rolls two d6 into a total', async ({ page }) => {
    await page.goto('/en/apps/spin-wheel'); await page.getByTestId('rp-mode-dice').click()
    await page.getByTestId('dr-count').fill('2')
    await page.getByTestId('dr-d6').click()
    await page.getByTestId('dr-roll').click()
    await expect(page.getByTestId('dr-total')).toBeVisible()
  })

  test('typing test: renders a passage and input', async ({ page }) => {
    await page.goto('/en/apps/typing-test')
    await expect(page.getByTestId('typing-test')).toBeVisible()
    await expect(page.getByTestId('tt-input')).toBeVisible()
    await expect(page.getByTestId('tt-wpm')).toBeVisible()
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

// #225: the same two defects existed in every image tool. Drive each one's picker
// with a HEIC and assert it explains itself rather than doing nothing, and that no
// tool re-introduces an image-only `accept` (which hides Downloads on Android).
const HEIC = () => readFileSync('e2e/fixtures/sample.heic')

for (const tool of [ 'image-compressor', 'image-to-ascii', 'pdf-merge',
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
    // Route installed BEFORE navigating: otherwise a focus/visibility check fired
    // during page load races the one this test dispatches, and on a slow runner
    // the real version.json wins.
    await page.route('**/version.json*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NEWER) }))
    await page.goto('/en/apps/image-compressor')
    // Load a real image so the tool declares work in progress.
    await page.locator('input[type=file]').setInputFiles({
      name: 'x.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64'),
    })
    await expect(page.getByTestId('imgcomp-download')).toBeVisible({ timeout: 20_000 })

    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) })

    // Offered, not applied: the work survives and the page did not reload.
    await expect(page.getByTestId('update-offered')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('update-reloading')).toHaveCount(0)
    await expect(page.getByTestId('imgcomp-download')).toBeVisible()
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
    // A LOOSE match broke the moment a second analytics provider was disclosed
    // (#249): both paragraphs say «بلا كوكيز», so `getByText` matched two
    // elements and failed on strict mode — a true page and a red test. Pin the
    // sentence that carries the claim rather than the phrase both share.
    await expect(page.getByText(/ويعمل بوضع بلا كوكيز/)).toBeVisible()
  })

  test('both analytics providers are disclosed, in both locales', async ({ page }) => {
    // The disclosure is the claim; the count of providers is what can go stale.
    // Named per locale so adding a third cannot pass silently.
    await page.goto('/en/privacy')
    await expect(page.getByText(/analytics\.ali-web-services\.com/)).toBeVisible()
    await expect(page.getByText(/Google Analytics|Analytics is configured/i).first()).toBeVisible()
    await page.goto('/ar/privacy')
    await expect(page.getByText(/analytics\.ali-web-services\.com/)).toBeVisible()
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
  /**
   * A date `n` days from today in LOCAL terms — which is how the tool counts,
   * and how a person means it.
   *
   * `toISOString().slice(0, 10)` was used here and is wrong east of Greenwich:
   * between local midnight and UTC midnight it names YESTERDAY, so the tool
   * counted one day more (or fewer) than the test expected. Caught at 00:25
   * Riyadh time — the failure window is three hours a night and had been there
   * all along.
   */
  const localDay = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  test('counts the days left and keeps the document after a reload', async ({ page }) => {
    await page.goto('/en/apps/id-expiry')
    await expect(page.getByTestId('exp-empty')).toBeVisible()
    const soon = localDay(10)
    await page.getByTestId('exp-date').fill(soon)
    await page.getByTestId('exp-add').click()
    await expect(page.getByTestId('exp-days')).toHaveText('10 days left')
    await page.reload()
    await expect(page.getByTestId('exp-days')).toHaveText('10 days left')
  })

  test('an already-expired document says so', async ({ page }) => {
    await page.goto('/en/apps/id-expiry')
    const past = localDay(-3)
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

test.describe('retired tools', () => {
  test('a removed tool redirects to the catalogue rather than 404ing', async ({ page }) => {
    // loan-calculator was withdrawn: an interest-based calculator contradicts a
    // stated product rule. Old links and search results still point at it.
    await page.goto('/en/apps/loan-calculator')
    await expect(page).toHaveURL(/\/en\/?$/)
    await expect(page.locator('.tool-search__input')).toBeVisible()
  })

  test('it is gone from search and the catalogue', async ({ page }) => {
    await page.goto('/en')
    await page.locator('.tool-search__input').fill('loan')
    await expect(page.locator('[data-testid="tool-loan-calculator"]')).toHaveCount(0)
  })

  test('the instrument tuner is withdrawn too', async ({ page }) => {
    // Withdrawn for the same shape of reason as loan-calculator: a subject the
    // catalogue does not want to be in, rather than a tool that worked badly.
    await page.goto('/en/apps/tuner')
    await expect(page).toHaveURL(/\/en\/?$/)
    await expect(page.locator('.tool-search__input')).toBeVisible()
  })

  test('the tuner is gone from search and the catalogue', async ({ page }) => {
    await page.goto('/en')
    await page.locator('.tool-search__input').fill('tuner')
    await expect(page.locator('[data-testid="tool-tuner"]')).toHaveCount(0)
  })

  test('a MERGED tool goes to the tool that took its job, not to the catalogue', async ({ page }) => {
    // `image-rearrange` cut pieces out of a picture and laid other pictures on
    // it; `image-edit` does both now, with the crop and the boxes and the
    // captions in the same session. That is a rename of where the capability
    // lives rather than a withdrawal, so the two are told apart by WHERE the
    // old link lands — a withdrawal goes to the catalogue, and this must not.
    await page.goto('/en/apps/image-rearrange')
    await expect(page).toHaveURL(/\/en\/apps\/image-edit\/?$/)
    await expect(page.getByTestId('image-edit')).toBeVisible()
  })

  test('it is gone from the catalogue, and the editor answers for it', async ({ page }) => {
    await page.goto('/en')
    await page.locator('.tool-search__input').fill('rearrange')
    await expect(page.locator('[data-testid="tool-image-rearrange"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="tool-image-edit"]')).toBeVisible()
  })
})

test.describe('qr email fields (#sweep)', () => {
  // `buildEmail` was written with subject and body and NOTHING called it — the
  // auto field produced a bare `mailto:`, so a QR on a poster opened a blank
  // message rather than a filled-in one, which is the whole point of an email
  // QR. The i18n strings for the fields existed too. Found by a sweep for
  // exports with no callers.
  test('an email QR carries the subject and body, not just the address', async ({ page }) => {
    await page.goto('/en/apps/qr-code')
    await page.getByTestId('qr-mode-email').click()
    await page.getByTestId('qr-email-to').fill('support@example.com')
    await page.getByTestId('qr-email-subject').fill('Broken light')
    await page.getByTestId('qr-email-body').fill('Gate 3, second lamp')
    await expect(page.getByTestId('qr-canvas')).toBeVisible()

    // The encoded string is what the code MEANS; a canvas cannot be asserted
    // on, so it carries the value as a data attribute.
    const value = await page.getByTestId('qr-canvas').getAttribute('data-value')
    expect(value).toContain('mailto:support@example.com')
    expect(value).toContain('subject=Broken+light')
    expect(value).toContain('body=Gate+3')
  })

  test('the address alone still works, so the fields are optional', async ({ page }) => {
    await page.goto('/en/apps/qr-code')
    await page.getByTestId('qr-mode-email').click()
    await page.getByTestId('qr-email-to').fill('a@b.com')
    expect(await page.getByTestId('qr-canvas').getAttribute('data-value')).toBe('mailto:a@b.com')
  })
})

test('photo booth renders its entry point', async ({ page }) => {
  await page.goto('/en/apps/photo-booth')
  await expect(page.getByTestId('pb-start')).toBeVisible()
})

// The explainer was its own tool until November 2026 and now lives under the
// builder (the redirect itself is checked in catalogue-cut.spec.ts).
test('cron builder: explains a pasted expression and lists next runs', async ({ page }) => {
  await page.goto('/en/apps/cron-builder')
  await page.getByTestId('cron-input').fill('0 0 * * *')
  await expect(page.getByTestId('cron-desc')).toContainText('00:00')
  await expect(page.getByTestId('cron-next').locator('li').first()).toBeVisible()
})
