import { test, expect } from '@playwright/test'
import { inflateRawSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

// Create a ZIP — the missing half of a pair.
//
// Found by a code sweep: `archive-inspector` reads and extracts and nothing
// created one, while `lib/zip.ts` had just learned to compress properly and to
// flag UTF-8 filenames. A capability built and not exposed.
//
// Everything is read off the raw bytes of the downloaded archive, not through
// our own reader.

interface Entry { name: string; method: number; packed: number; raw: number; utf8: boolean; data: Buffer }

function entries(buf: Buffer): Entry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const out: Entry[] = []
  let i = 0
  while (i + 30 <= buf.length && dv.getUint32(i, true) === 0x04034b50) {
    const flag = dv.getUint16(i + 6, true)
    const method = dv.getUint16(i + 8, true)
    const packed = dv.getUint32(i + 18, true)
    const raw = dv.getUint32(i + 22, true)
    const nlen = dv.getUint16(i + 26, true)
    const elen = dv.getUint16(i + 28, true)
    const name = new TextDecoder('utf-8').decode(buf.subarray(i + 30, i + 30 + nlen))
    const start = i + 30 + nlen + elen
    const body = buf.subarray(start, start + packed)
    out.push({ name, method, packed, raw, utf8: (flag & 0x800) !== 0, data: method === 8 ? inflateRawSync(body) : Buffer.from(body) })
    i = start + packed
  }
  return out
}

const load = async (page: import('@playwright/test').Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/zip-create`)
  await expect(page.getByTestId('zip-create')).toBeVisible()
}

const build = async (page: import('@playwright/test').Page) => {
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('zc-build').click(),
  ])
  return { name: dl.suggestedFilename(), buf: readFileSync((await dl.path())!) }
}

test('several files go in and come out intact', async ({ page }) => {
  await load(page)
  await page.getByTestId('zc-file').setInputFiles([
    { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hello alpha') },
    { name: 'b.csv', mimeType: 'text/csv', buffer: Buffer.from('x,y\n1,2\n') },
  ])
  await expect(page.getByTestId('zc-list')).toBeVisible()
  const { name, buf } = await build(page)
  expect(name).toBe('archive.zip')

  const list = entries(buf)
  expect(list.map((e) => e.name).sort()).toEqual(['a.txt', 'b.csv'])
  expect(list.find((e) => e.name === 'a.txt')!.data.toString()).toBe('hello alpha')
})

test('text is DEFLATED, and a PNG is left stored', async ({ page }) => {
  // Per entry, keeping whichever came out smaller: a PNG already carries a
  // deflate stream, so squeezing it again costs time for a few percent.
  await load(page)
  await page.getByTestId('zc-file').setInputFiles([
    { name: 'big.txt', mimeType: 'text/plain', buffer: Buffer.from('the same sentence over and over. '.repeat(400)) },
    { name: 'pic.png', mimeType: 'image/png', buffer: readFileSync('e2e/fixtures/diff-a.png') },
  ])
  const { buf } = await build(page)
  const list = entries(buf)
  const txt = list.find((e) => e.name === 'big.txt')!
  const png = list.find((e) => e.name === 'pic.png')!
  expect(txt.method, 'text should be deflated').toBe(8)
  expect(txt.packed).toBeLessThan(txt.raw * 0.2)
  expect(png.method, 'an already-compressed file should be stored').toBe(0)
})

test('an Arabic filename is flagged UTF-8 and survives', async ({ page }) => {
  await load(page)
  await page.getByTestId('zc-file').setInputFiles([
    { name: 'الرياض.txt', mimeType: 'text/plain', buffer: Buffer.from('نص') },
  ])
  const { buf } = await build(page)
  const [e] = entries(buf)
  expect(e.name).toBe('الرياض.txt')
  expect(e.utf8, 'not flagged UTF-8').toBe(true)
})

test('two files of the same name are numbered, not silently merged', async ({ page }) => {
  // An archive with two entries of the same name extracts to ONE file, and
  // which survives is up to the extractor.
  await load(page)
  await page.getByTestId('zc-file').setInputFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('first') },
  ])
  await page.getByTestId('zc-file').setInputFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('second') },
  ])
  await expect(page.getByTestId('zc-dup')).toBeVisible()
  const { buf } = await build(page)
  const list = entries(buf)
  expect(list).toHaveLength(2)
  expect(new Set(list.map((e) => e.name)).size, 'names collided').toBe(2)
  expect(list[1].name).toBe('notes (2).txt')
  // And both payloads are there — nothing was lost to the rename.
  expect(list.map((e) => e.data.toString()).sort()).toEqual(['first', 'second'])
})

test('a single unique name is NOT numbered', async ({ page }) => {
  // Without this the case above passes against a tool that numbers everything.
  await load(page)
  await page.getByTestId('zc-file').setInputFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('only') },
  ])
  await expect(page.getByTestId('zc-dup')).toHaveCount(0)
  const { buf } = await build(page)
  expect(entries(buf)[0].name).toBe('notes.txt')
})

test('the archive name is used', async ({ page }) => {
  await load(page)
  await page.getByTestId('zc-file').setInputFiles([
    { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
  ])
  await page.getByTestId('zc-name').fill('reports')
  const { name } = await build(page)
  expect(name).toBe('reports.zip')
})

test('the saving is reported, and it is real', async ({ page }) => {
  await load(page)
  await page.getByTestId('zc-file').setInputFiles([
    { name: 'big.txt', mimeType: 'text/plain', buffer: Buffer.from('repeat me. '.repeat(2000)) },
  ])
  await build(page)
  const text = await page.getByTestId('zc-result').textContent()
  expect(text).toMatch(/9[0-9]% smaller/)
})

test('there is no password option, and the reason is given', async ({ page }) => {
  // ZipCrypto has been broken for decades. Offering it would look like
  // protection and not be any.
  await load(page)
  await expect(page.getByTestId('zc-password-note')).toContainText('ZipCrypto')
  await page.getByTestId('zc-encrypt').click()
  await expect(page).toHaveURL(/\/en\/apps\/file-encrypt$/)
})

test('it opens in the tool that goes the other way', async ({ page }) => {
  // The pair is the point: the inverse is the strongest test either has.
  await load(page)
  await page.getByTestId('zc-file').setInputFiles([
    { name: 'alpha.txt', mimeType: 'text/plain', buffer: Buffer.from('hello from the archive') },
  ])
  const { buf } = await build(page)
  const fs = await import('node:fs')
  const tmp = 'test-results/zc-roundtrip.zip'
  fs.mkdirSync('test-results', { recursive: true })
  fs.writeFileSync(tmp, buf)

  await page.goto('/en/apps/archive-inspector')
  await page.getByTestId('zip-file').setInputFiles(tmp)
  await expect(page.getByTestId('zip-list')).toContainText('alpha.txt', { timeout: 20000 })
})

test('it works in Arabic', async ({ page }) => {
  await load(page, 'ar')
  await page.getByTestId('zc-file').setInputFiles([
    { name: 'ملف.txt', mimeType: 'text/plain', buffer: Buffer.from('مرحبا') },
  ])
  await expect(page.getByTestId('zc-entry')).toContainText('ملف.txt')
})
