import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

/** A real PNG of `n`x`n` random pixels — big enough that the fixed data-URI
 *  prefix stops dominating, which is what the asymptotic figure needs. */
function makePng(w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = (x * 7 + y * 13) & 0xff
      raw[row + 2 + x * 3] = (x * 29) & 0xff
      raw[row + 3 + x * 3] = (y * 31) & 0xff
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crcBuf])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function crc32(buf: Buffer): number {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (~c) >>> 0
}

// Image ↔ data URI.
//
// Found by diffing a 661-tool catalogue against ours: "Image to Base64" is a
// staple everywhere and we had neither direction — while our own `base64` tool
// claims `data uri` as a keyword and has no file input, so it took the query
// and could not serve it.
//
// Two findings, both MEASURED locally rather than repeated:
//   · base64 inflates a binary by about a third (36% on a PNG, 34% on a HEIC)
//   · for SVG, minimal percent-encoding is 23% smaller than base64 — while
//     `encodeURIComponent`, the obvious alternative, is 13% BIGGER than base64
//
// The second is the one worth testing hardest: the naive fix is worse than the
// thing it was meant to fix, so a tool that "handles SVG" by reaching for
// encodeURIComponent has made it worse while appearing to help.

const open = async (page: import('@playwright/test').Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/image-base64`)
  await expect(page.getByTestId('image-base64')).toBeVisible()
}

test('a PNG becomes a base64 data URI', async ({ page }) => {
  await open(page)
  await page.getByTestId('ib-file').setInputFiles('e2e/fixtures/diff-a.png')
  await expect(page.getByTestId('ib-output')).toHaveValue(/^data:image\/png;base64,/)
})

test('an SVG takes the SMALLER path, and it really is smaller', async ({ page }) => {
  await open(page)
  const svg = readFileSync('public/icon.svg')
  await page.getByTestId('ib-file').setInputFiles({ name: 'icon.svg', mimeType: 'image/svg+xml', buffer: svg })

  const out = await page.getByTestId('ib-output').inputValue()
  expect(out.startsWith('data:image/svg+xml,'), 'should not be base64').toBe(true)
  expect(out).not.toContain(';base64,')
  await expect(page.getByTestId('ib-minimal')).toBeVisible()

  // Measured, not asserted: the base64 form of the same bytes is bigger.
  const asBase64 = `data:image/svg+xml;base64,${svg.toString('base64')}`
  expect(out.length).toBeLessThan(asBase64.length)
  // And the naive alternative is bigger than BOTH — the trap this exists for.
  const naive = `data:image/svg+xml,${encodeURIComponent(svg.toString('utf8'))}`
  expect(naive.length).toBeGreaterThan(asBase64.length)
})

test('the SVG data URI actually renders as an image', async ({ page }) => {
  // Smaller is worthless if the escaping broke it. The browser is the judge.
  await open(page)
  await page.getByTestId('ib-file').setInputFiles({
    name: 'icon.svg', mimeType: 'image/svg+xml', buffer: readFileSync('public/icon.svg'),
  })
  const uri = await page.getByTestId('ib-output').inputValue()
  const ok = await page.evaluate((src) => new Promise<boolean>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 0)
    img.onerror = () => resolve(false)
    img.src = src
  }), uri)
  expect(ok, 'the percent-encoded SVG did not load').toBe(true)
})

test('the cost of embedding is stated, not left to be discovered', async ({ page }) => {
  // A realistic image, because the asymptotic figure is what the copy claims.
  // The 100-byte fixture reports 58%, which is also true and is why the panel
  // now says the fixed `data:image/png;base64,` prefix dominates a tiny file.
  await open(page)
  await page.getByTestId('ib-file').setInputFiles({
    name: 'big.png', mimeType: 'image/png', buffer: makePng(64, 64),
  })
  const text = await page.getByTestId('ib-size').textContent()
  expect(text).toMatch(/3[0-9]% bigger/)
})

test('a tiny image costs far more than a third, and the panel says why', async ({ page }) => {
  await open(page)
  await page.getByTestId('ib-file').setInputFiles('e2e/fixtures/diff-a.png')
  const text = await page.getByTestId('ib-size').textContent()
  expect(Number(/(\d+)% bigger/.exec(text!)![1])).toBeGreaterThan(40)
  await expect(page.getByTestId('ib-cost')).toContainText('prefix')
})

test('the wrappers are what people actually paste', async ({ page }) => {
  await open(page)
  await page.getByTestId('ib-file').setInputFiles('e2e/fixtures/diff-a.png')
  await page.getByTestId('ib-wrap-css').click()
  await expect(page.getByTestId('ib-output')).toHaveValue(/^background-image: url\("data:image\/png;base64,/)
  await page.getByTestId('ib-wrap-html').click()
  await expect(page.getByTestId('ib-output')).toHaveValue(/^<img src="data:image\/png;base64,/)
  await page.getByTestId('ib-wrap-markdown').click()
  await expect(page.getByTestId('ib-output')).toHaveValue(/^!\[[^\]]*\]\(data:image\/png;base64,/)
})

test('a HEIC is transcoded, because embedding one shows a broken image', async ({ page }) => {
  await open(page)
  await page.getByTestId('ib-file').setInputFiles('e2e/fixtures/sample.heic')
  await expect(page.getByTestId('ib-heic')).toBeVisible({ timeout: 30000 })
  // The output must be something every browser can render — so PNG, not HEIC.
  await expect(page.getByTestId('ib-output')).toHaveValue(/^data:image\/png;base64,/)
})

test('a data URI decodes back to the same bytes', async ({ page }) => {
  await open(page)
  const png = readFileSync('e2e/fixtures/diff-a.png')
  await page.getByTestId('ib-mode-decode').click()
  await page.getByTestId('ib-paste').fill(`data:image/png;base64,${png.toString('base64')}`)
  await expect(page.getByTestId('ib-detected')).toContainText('image/png')

  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('ib-save').click(),
  ])
  expect(dl.suggestedFilename()).toBe('image.png')
  const back = readFileSync((await dl.path())!)
  expect(back.equals(png), 'the round trip changed the bytes').toBe(true)
})

test('a bare base64 blob is accepted, and the format sniffed from the bytes', async ({ page }) => {
  // What people paste half the time. A blob carries no MIME, and saving a PNG
  // as .bin is a file the operating system will not open.
  await open(page)
  await page.getByTestId('ib-mode-decode').click()
  await page.getByTestId('ib-paste').fill(readFileSync('e2e/fixtures/diff-a.png').toString('base64'))
  await expect(page.getByTestId('ib-detected')).toContainText('image/png')
})

test('the percent-encoded SVG form decodes too, rather than being called corrupt', async ({ page }) => {
  // A base64-only decoder rejects this as broken instead of as a different
  // encoding — and it is the encoding this tool itself produces.
  await open(page)
  await page.getByTestId('ib-file').setInputFiles({
    name: 'icon.svg', mimeType: 'image/svg+xml', buffer: readFileSync('public/icon.svg'),
  })
  const uri = await page.getByTestId('ib-output').inputValue()
  await page.getByTestId('ib-mode-decode').click()
  await page.getByTestId('ib-paste').fill(uri)
  await expect(page.getByTestId('ib-detected')).toContainText('image/svg+xml')
})

test('nonsense is reported, not silently accepted', async ({ page }) => {
  await open(page)
  await page.getByTestId('ib-mode-decode').click()
  await page.getByTestId('ib-paste').fill('this is not a data uri at all !!!')
  await expect(page.getByTestId('file-error')).toBeVisible()
})

test('a non-image file is refused with a reason', async ({ page }) => {
  await open(page)
  await page.getByTestId('ib-file').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello'),
  })
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 20000 })
})

test('it works in Arabic', async ({ page }) => {
  await open(page, 'ar')
  await page.getByTestId('ib-file').setInputFiles('e2e/fixtures/diff-a.png')
  await expect(page.getByTestId('ib-output')).toHaveValue(/^data:image\/png;base64,/)
  await expect(page.getByTestId('ib-svg-note')).toContainText('٢٣٪')
})
