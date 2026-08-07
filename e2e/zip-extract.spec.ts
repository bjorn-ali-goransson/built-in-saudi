import { test, expect } from '@playwright/test'
import { deflateRawSync, crc32 } from 'node:zlib'

/**
 * A ZIP writer with the knobs this test needs: per-entry compression method,
 * the encryption flag, and a local header whose extra field is a DIFFERENT
 * length from the central directory's — which is the classic way to read a zip
 * and get garbage, and the reason the data offset must come from the local
 * header.
 */
function zip(files: { name: string; data: Buffer; store?: boolean; encrypted?: boolean; localExtra?: number }[]): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const body = f.store ? f.data : deflateRawSync(f.data)
    const crc = crc32(f.data)
    const flags = f.encrypted ? 1 : 0
    const method = f.store ? 0 : 8
    const extra = Buffer.alloc(f.localExtra ?? 0)

    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(flags, 6)
    lh.writeUInt16LE(method, 8)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(body.length, 18)
    lh.writeUInt32LE(f.data.length, 22)
    lh.writeUInt16LE(name.length, 26)
    lh.writeUInt16LE(extra.length, 28)
    locals.push(lh, name, extra, body)

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(flags, 8)
    cd.writeUInt16LE(method, 10)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(body.length, 20)
    cd.writeUInt32LE(f.data.length, 24)
    cd.writeUInt16LE(name.length, 28)
    // Deliberately zero here even when the local header has extra bytes.
    cd.writeUInt16LE(0, 30)
    cd.writeUInt32LE(offset, 42)
    central.push(cd, name)
    offset += lh.length + name.length + extra.length + body.length
  }
  const cdBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cdBuf, eocd])
}

const open = async (page: import('@playwright/test').Page, buffer: Buffer, name = 'bundle.zip') => {
  await page.goto('/en/apps/archive-inspector')
  await page.getByTestId('zip-file').setInputFiles({ name, mimeType: 'application/zip', buffer })
  await expect(page.getByTestId('zip-list')).toBeVisible()
}

test.describe('zip inspector: getting a file out', () => {
  test('a deflated entry downloads, named after the leaf', async ({ page }) => {
    await open(page, zip([
      { name: 'docs/notes.txt', data: Buffer.from('the quick brown fox '.repeat(40)) },
    ]))
    const dl = page.waitForEvent('download')
    await page.getByTestId('zip-get-0').click()
    expect((await dl).suggestedFilename()).toBe('notes.txt')
  })

  test('the data offset comes from the local header, not the central directory', async ({ page }) => {
    // The local header carries 12 extra bytes that the central directory says
    // nothing about. Computing the offset from the central record lands 12
    // bytes early and inflates to noise.
    await open(page, zip([
      { name: 'config.json', data: Buffer.from('{"city":"Riyadh","ok":true}'), localExtra: 12 },
    ]))
    await page.getByTestId('zip-preview-0').click()
    await expect(page.getByTestId('zip-preview-panel')).toContainText('"city":"Riyadh"')
  })

  test('a stored entry works as well as a deflated one', async ({ page }) => {
    await open(page, zip([
      { name: 'plain.txt', data: Buffer.from('stored, not compressed'), store: true },
    ]))
    await page.getByTestId('zip-preview-0').click()
    await expect(page.getByTestId('zip-preview-panel')).toContainText('stored, not compressed')
  })

  test('a password-protected entry is marked and refused, not silently mangled', async ({ page }) => {
    await open(page, zip([
      { name: 'secret.txt', data: Buffer.from('cannot be read without the password'), encrypted: true },
    ]))
    await expect(page.getByTestId('zip-locked-0')).toBeVisible()
    await page.getByTestId('zip-get-0').click()
    await expect(page.getByTestId('zip-note')).toContainText('encrypted')
    // And nothing was handed over that looks like a real file.
    await expect(page.getByTestId('zip-preview-panel')).toHaveCount(0)
  })

  test('preview is offered only where it would be readable', async ({ page }) => {
    await open(page, zip([
      { name: 'readme.md', data: Buffer.from('# Title') },
      { name: 'photo.jpg', data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]) },
    ]))
    await expect(page.getByTestId('zip-preview-0')).toBeVisible()
    await expect(page.getByTestId('zip-preview-1')).toHaveCount(0)
    // But it can still be saved.
    await expect(page.getByTestId('zip-get-1')).toBeVisible()
  })

  test('a folder has nothing to extract', async ({ page }) => {
    await open(page, zip([
      { name: 'src/', data: Buffer.alloc(0), store: true },
      { name: 'src/main.ts', data: Buffer.from('export {}') },
    ]))
    await expect(page.getByTestId('zip-get-0')).toHaveCount(0)
    await expect(page.getByTestId('zip-get-1')).toBeVisible()
  })

  test('the preview closes again', async ({ page }) => {
    await open(page, zip([{ name: 'a.txt', data: Buffer.from('hello') }]))
    await page.getByTestId('zip-preview-0').click()
    await expect(page.getByTestId('zip-preview-panel')).toBeVisible()
    await page.getByTestId('zip-preview-close').click()
    await expect(page.getByTestId('zip-preview-panel')).toHaveCount(0)
  })
})
