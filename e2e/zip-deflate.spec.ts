import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// The ZIP writer learned to compress, and to name Arabic files correctly.
//
// `lib/unzip.ts` already READ deflate via `DecompressionStream('deflate-raw')`;
// its mirror `CompressionStream` makes writing it free of any dependency.
// Whether that was worth doing is a question about the payloads, and it was
// measured (`node evals/zipsize.mjs`) rather than assumed: OOXML 97.9%, SVG
// 85.8%, CSV 83.0% — and PDF, PNG and an existing .xlsx about 5%, because they
// already carry deflate streams inside them.
//
// Everything below is read off the RAW BYTES of the downloaded archive. Two
// hand-written implementations agreeing is weaker evidence than one being
// right, so the local headers are parsed here rather than trusted to our own
// reader — and only the last case does the round trip.

interface Header { name: string; method: number; packed: number; raw: number; utf8: boolean }

/** Walk the local file headers of a ZIP, in file order. */
function headers(bytes: Buffer): Header[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out: Header[] = []
  let i = 0
  while (i + 30 <= bytes.length && dv.getUint32(i, true) === 0x04034b50) {
    const flag = dv.getUint16(i + 6, true)
    const method = dv.getUint16(i + 8, true)
    const packed = dv.getUint32(i + 18, true)
    const raw = dv.getUint32(i + 22, true)
    const nlen = dv.getUint16(i + 26, true)
    const elen = dv.getUint16(i + 28, true)
    const name = new TextDecoder('utf-8').decode(bytes.subarray(i + 30, i + 30 + nlen))
    out.push({ name, method, packed, raw, utf8: (flag & 0x800) !== 0 })
    i += 30 + nlen + elen + packed
  }
  return out
}

const grab = async (page: import('@playwright/test').Page, testid: string) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId(testid).click(),
  ])
  return { path: (await download.path())!, bytes: readFileSync((await download.path())!) }
}

test('a .docx comes out DEFLATED, and much smaller than stored', async ({ page }) => {
  await page.goto('/en/apps/markdown-docx')
  // Enough repetitive OOXML for the difference to be unmistakable.
  const md = Array.from({ length: 300 }, (_, i) => `## Heading ${i}\n\nParagraph number ${i} with **bold** in it.\n`).join('\n')
  await page.getByTestId('md-input').fill(md)
  const { bytes } = await grab(page, 'md-download')

  const h = headers(bytes)
  const doc = h.find((x) => x.name === 'word/document.xml')
  expect(doc, 'word/document.xml missing').toBeTruthy()
  expect(doc!.method, 'document.xml should be deflated').toBe(8)
  // Measured at 97.9% on OOXML; a conservative floor keeps this a test of the
  // mechanism rather than of one compression level.
  expect(doc!.packed).toBeLessThan(doc!.raw * 0.5)
})

test('the EPUB mimetype is still the FIRST entry and still STORED', async ({ page }) => {
  // It used to be free, because the writer stored everything. Now that entries
  // are deflated it is an explicit `store: true`, and getting it wrong gives a
  // book readers silently refuse rather than explaining.
  await page.goto('/en/apps/markdown-epub')
  await page.getByTestId('me-input').fill('# Chapter one\n\n' + 'Some text. '.repeat(200) + '\n\n# Chapter two\n\nMore text.\n')
  const { bytes } = await grab(page, 'me-download')

  const h = headers(bytes)
  expect(h[0].name).toBe('mimetype')
  expect(h[0].method, 'mimetype must be stored').toBe(0)
  // And the rest of the book IS compressed, so the store is deliberate rather
  // than the writer having quietly stayed store-only.
  expect(h.some((x) => x.method === 8), 'nothing else was compressed').toBe(true)
})

test('an Arabic filename is flagged UTF-8 — it was not, and read as mojibake', async ({ page }) => {
  // General-purpose bit 11 says "this name is UTF-8". Without it an extractor
  // is entitled to read the name as CP437. These tools name entries after the
  // user's own file or after a column value, both routinely Arabic here.
  await page.goto('/en/apps/csv-split')
  await page.getByTestId('cs-file').setInputFiles({
    name: 'cities.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('المدينة,العدد\nالرياض,10\nجدة,20\nالرياض,30\n', 'utf8'),
  })
  await page.getByTestId('cs-mode-column').click()
  const { bytes } = await grab(page, 'cs-download')

  const arabic = headers(bytes).filter((x) => /[؀-ۿ]/.test(x.name))
  expect(arabic.length, 'no Arabic-named entry was produced').toBeGreaterThan(0)
  for (const x of arabic) expect(x.utf8, `${x.name} not flagged UTF-8`).toBe(true)
})

test('an ASCII name is NOT flagged, so the flag means something', async ({ page }) => {
  // Setting it unconditionally would make the previous case pass against a
  // writer that had learned nothing.
  await page.goto('/en/apps/markdown-docx')
  await page.getByTestId('md-input').fill('# Title\n\nText.\n')
  const { bytes } = await grab(page, 'md-download')
  for (const x of headers(bytes)) expect(x.utf8, `${x.name} should not be flagged`).toBe(false)
})

test('the archive still opens in our own reader — a full round trip', async ({ page }) => {
  // The byte-level checks say the headers are right; this says the file works.
  await page.goto('/en/apps/markdown-epub')
  await page.getByTestId('me-input').fill('# Chapter one\n\nHello **world**.\n')
  await page.getByTestId('me-title').fill('Round trip')
  const { path } = await grab(page, 'me-download')

  await page.goto('/en/apps/epub-text')
  await page.getByTestId('ep-file').setInputFiles(path)
  await expect(page.getByTestId('ep-output')).toContainText('Chapter one', { timeout: 20000 })
})
