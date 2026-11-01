import { test, expect, type Page } from '@playwright/test'
import { gzipSync, gunzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipEntries, makeZip } from './helpers'

// Every archive this tool MAKES is read back by somebody else's code — Node's
// zlib and the system `tar` — and every archive it OPENS that is not a fixture
// was made by somebody else's code. Two hand-written implementations agreeing
// is weaker evidence than one being right.

async function open(page: Page, name: string, buffer: Buffer, mimeType = 'application/octet-stream') {
  await page.goto('/en/apps/archives')
  await page.getByTestId('ar-file').setInputFiles({ name, mimeType, buffer })
}

async function download(page: Page, click: () => Promise<void>): Promise<{ name: string; bytes: Buffer }> {
  const [dl] = await Promise.all([page.waitForEvent('download'), click()])
  return { name: dl.suggestedFilename(), bytes: readFileSync((await dl.path())!) }
}

function systemTarGz(files: Record<string, string>): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'ar-'))
  for (const [n, body] of Object.entries(files)) {
    mkdirSync(join(dir, 'src', n, '..'), { recursive: true })
    writeFileSync(join(dir, 'src', n), body)
  }
  execFileSync('tar', ['-czf', join(dir, 'out.tar.gz'), '-C', join(dir, 'src'), ...Object.keys(files)])
  return readFileSync(join(dir, 'out.tar.gz'))
}

function systemTarList(buf: Buffer, flags: string): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'ar-'))
  writeFileSync(join(dir, 'in'), buf)
  mkdirSync(join(dir, 'x'))
  execFileSync('tar', [flags, join(dir, 'in'), '-C', join(dir, 'x')])
  // Walk what was extracted rather than parsing `tar -t`, which escapes a
  // non-ASCII name as octal under a C locale.
  const root = join(dir, 'x')
  return Object.fromEntries((readdirSync(root, { recursive: true }) as string[])
    .filter((n) => statSync(join(root, n)).isFile())
    .map((n) => [n, readFileSync(join(root, n), 'utf8')]))
}

test.describe('archives — open', () => {
  test('a RAR lists its files and hands one back byte for byte', async ({ page }) => {
    await open(page, 'sample.rar', readFileSync('e2e/fixtures/sample.rar'))
    await expect(page.getByTestId('ar-kind')).toHaveAttribute('data-kind', 'rar')
    await expect(page.getByTestId('ar-entry-0')).toHaveAttribute('data-name', 'hello.txt')
    await expect(page.getByTestId('ar-entry-1')).toHaveAttribute('data-name', 'docs/notes.txt')
    const one = await download(page, () => page.getByTestId('ar-take-0').click())
    expect(one.name).toBe('hello.txt')
    expect(one.bytes.toString()).toBe('hello from a rar archive\n')
  })

  test('everything in a RAR comes out as one .zip, folders kept', async ({ page }) => {
    await open(page, 'sample.rar', readFileSync('e2e/fixtures/sample.rar'))
    const all = await download(page, () => page.getByTestId('ar-all').click())
    expect(all.name).toBe('sample.zip')
    const got = Object.fromEntries(zipEntries(all.bytes).map((e) => [e.name, e.data.toString()]))
    expect(got).toEqual({ 'hello.txt': 'hello from a rar archive\n', 'docs/notes.txt': 'second file, in a folder\n' })
  })

  test('a .tar.gz made by the system tar opens as its FILES, not one .tar', async ({ page }) => {
    const tgz = systemTarGz({ 'a.txt': 'alpha\n', 'deep/b.txt': 'bravo\n' })
    await open(page, 'bundle.tar.gz', tgz, 'application/gzip')
    await expect(page.getByTestId('ar-kind')).toHaveAttribute('data-kind', 'gzip')
    await expect(page.getByTestId('ar-kind')).toContainText('TAR')
    const names = await page.getByTestId('ar-list').locator('li').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-name')))
    expect(names).toEqual(expect.arrayContaining(['a.txt', 'deep/b.txt']))
    const i = names.indexOf('deep/b.txt')
    const one = await download(page, () => page.getByTestId(`ar-take-${i}`).click())
    expect(one.name).toBe('b.txt')
    expect(one.bytes.toString()).toBe('bravo\n')
  })

  test('a plain .gz gives back the one file inside, under its own name', async ({ page }) => {
    await open(page, 'report.csv.gz', gzipSync(Buffer.from('x,y\n1,2\n')), 'application/gzip')
    await expect(page.getByTestId('ar-entry-0')).toHaveAttribute('data-name', 'report.csv')
    const one = await download(page, () => page.getByTestId('ar-take-0').click())
    expect(one.bytes.toString()).toBe('x,y\n1,2\n')
  })

  test('an encrypted ZIP entry is named, not failed silently', async ({ page }) => {
    const zip = makeZip([{ name: 'open.txt', data: Buffer.from('fine') }, { name: 'secret.txt', data: Buffer.from('xxxx') }])
    // Set bit 0 (encrypted) in the second entry's local header flags.
    const second = zip.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 1)
    zip.writeUInt16LE(zip.readUInt16LE(second + 6) | 1, second + 6)
    await open(page, 'mixed.zip', zip, 'application/zip')
    await expect(page.getByTestId('ar-problem-1')).toBeVisible()
    await expect(page.getByTestId('ar-take-0')).toBeVisible()
    await expect(page.getByTestId('ar-problem-0')).toHaveCount(0)
  })

  test('a format it cannot open is NAMED; a file that is no archive says so', async ({ page }) => {
    await open(page, 'thing.7z', Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4, ...new Array(40).fill(0)]))
    await expect(page.getByTestId('ar-why')).toHaveAttribute('data-why', 'unsupported')
    await expect(page.getByTestId('file-error')).toContainText('7-Zip')
    await page.getByTestId('ar-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('just some words') })
    await expect(page.getByTestId('ar-why')).toHaveAttribute('data-why', 'unknown')
  })

  test('a truncated RAR is reported as damaged rather than as a password problem', async ({ page }) => {
    const rar = readFileSync('e2e/fixtures/sample.rar')
    await open(page, 'cut.rar', rar.subarray(0, 40))
    await expect(page.getByTestId('ar-why')).toHaveAttribute('data-why', /damaged/)
    await expect(page.getByTestId('ar-password')).toHaveCount(0)
  })
})

test.describe('archives — make', () => {
  test('a .zip of two files, one with an Arabic name, reads back through zlib', async ({ page }) => {
    await page.goto('/en/apps/archives?mode=create')
    await page.getByTestId('ar-add').setInputFiles([
      { name: 'readme.txt', mimeType: 'text/plain', buffer: Buffer.from('hello '.repeat(200)) },
      { name: 'ملاحظة.txt', mimeType: 'text/plain', buffer: Buffer.from('مرحبا') },
    ])
    await expect(page.getByTestId('ar-count')).toContainText('2')
    await page.getByTestId('ar-name').fill('bundle')
    const zip = await download(page, () => page.getByTestId('ar-make').click())
    expect(zip.name).toBe('bundle.zip')
    const got = Object.fromEntries(zipEntries(zip.bytes).map((e) => [e.name, e.data.toString()]))
    expect(got).toEqual({ 'readme.txt': 'hello '.repeat(200), 'ملاحظة.txt': 'مرحبا' })
    // Compressed, not stored: twelve hundred repeated bytes deflate to a few dozen.
    expect(zip.bytes.length).toBeLessThan(600)
  })

  test('a .tar.gz with a name past the 100-byte field opens in the system tar', async ({ page }) => {
    const long = `${'مجلد/'.repeat(12)}ملف.txt`
    expect(Buffer.byteLength(long)).toBeGreaterThan(100)
    await page.goto('/en/apps/archives?mode=create')
    await page.getByTestId('ar-add').setInputFiles([
      { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('alpha\n') },
    ])
    // A folder pick names each file by its path; a long Arabic path is the case.
    await page.getByTestId('ar-add').evaluate((el: HTMLInputElement, path) => {
      const f = new File(['deep\n'], 'ملف.txt')
      Object.defineProperty(f, 'webkitRelativePath', { value: path })
      const dt = new DataTransfer()
      dt.items.add(f)
      el.files = dt.files
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, long)
    await page.getByTestId('ar-format').selectOption('tar.gz')
    const tgz = await download(page, () => page.getByTestId('ar-make').click())
    expect(tgz.name).toMatch(/\.tar\.gz$/)
    expect(gunzipSync(tgz.bytes).subarray(257, 262).toString()).toBe('ustar')
    expect(systemTarList(tgz.bytes, '-xzf')).toEqual({ 'a.txt': 'alpha\n', [long]: 'deep\n' })
  })

  test('.gz takes exactly one file, and says so rather than dropping the rest', async ({ page }) => {
    await page.goto('/en/apps/archives?mode=create')
    await page.getByTestId('ar-add').setInputFiles([
      { name: 'one.txt', mimeType: 'text/plain', buffer: Buffer.from('1') },
      { name: 'two.txt', mimeType: 'text/plain', buffer: Buffer.from('2') },
    ])
    await page.getByTestId('ar-format').selectOption('gz')
    await expect(page.getByTestId('ar-gz-one')).toBeVisible()
    await expect(page.getByTestId('ar-make')).toBeDisabled()
    await page.getByTestId('ar-remove-1').click()
    await expect(page.getByTestId('ar-gz-one')).toHaveCount(0)
    const gz = await download(page, () => page.getByTestId('ar-make').click())
    expect(gz.name).toBe('one.txt.gz')
    expect(gunzipSync(gz.bytes).toString()).toBe('1')
  })

  test('RAR creation is stated as impossible, on the screen that would offer it', async ({ page }) => {
    await page.goto('/en/apps/archives?mode=create')
    await expect(page.getByTestId('ar-no-rar')).toContainText('proprietary')
    await page.getByTestId('ar-add').setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('a') })
    await expect(page.getByTestId('ar-format').locator('option')).toHaveText(['.zip', '.tar.gz', '.tar', '.gz'])
  })
})

test.describe('archives — old addresses', () => {
  test('the zip maker\'s old link opens the make mode', async ({ page }) => {
    await page.goto('/en/apps/zip-create')
    await expect(page).toHaveURL(/\/apps\/archives\/?\?mode=create/)
    await expect(page.getByTestId('ar-add')).toBeAttached()
  })

  test('the archive inspector\'s old link opens the archive tool', async ({ page }) => {
    await page.goto('/en/apps/archive-inspector')
    await expect(page).toHaveURL(/\/apps\/archives/)
    await expect(page.getByTestId('ar-file')).toBeAttached()
  })
})
