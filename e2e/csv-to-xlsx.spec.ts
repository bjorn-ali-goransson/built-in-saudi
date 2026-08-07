import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

/**
 * Read a part out of a ZIP by walking the central directory — the same job the
 * app's own unzip does, done independently here so the test does not simply
 * agree with the code it is testing.
 */
function zipPart(buf: Buffer, want: string): string | null {
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) return null
  let off = buf.readUInt32LE(eocd + 16)
  const count = buf.readUInt16LE(eocd + 10)
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8')
    const local = buf.readUInt32LE(off + 42)
    const method = buf.readUInt16LE(off + 10)
    const size = buf.readUInt32LE(off + 20)
    if (name === want) {
      // The local header's extra field can be a different length to the
      // central one's, so the data offset comes from the local header.
      const lnLen = buf.readUInt16LE(local + 26)
      const lxLen = buf.readUInt16LE(local + 28)
      const start = local + 30 + lnLen + lxLen
      const data = buf.subarray(start, start + size)
      return (method === 0 ? data : inflateRawSync(data)).toString('utf8')
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return null
}

async function convert(page: import('@playwright/test').Page, csv: string, name = 'people.csv') {
  await page.goto('/en/apps/csv-to-xlsx')
  await page.getByTestId('cx-file').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') })
  await expect(page.getByTestId('cx-preview')).toBeVisible()
}

async function download(page: import('@playwright/test').Page): Promise<Buffer> {
  const dl = page.waitForEvent('download')
  await page.getByTestId('cx-save').click()
  const file = await (await dl).path()
  expect(file && existsSync(file)).toBeTruthy()
  return readFileSync(file!)
}

test.describe('csv to excel', () => {
  test('a leading zero survives, which is the whole point', async ({ page }) => {
    await convert(page, 'name,mobile\nSara,0501234567\n')
    await expect(page.getByTestId('cx-protected')).toContainText('1 value would have been damaged')
    const sheet = zipPart(await download(page), 'xl/worksheets/sheet1.xml')!
    // Written as an inline string, so Excel has nothing to guess about.
    expect(sheet).toContain('<t xml:space="preserve">0501234567</t>')
    expect(sheet).not.toMatch(/<v>0501234567<\/v>/)
  })

  test('a 16-digit IBAN-length number is kept as text, a normal number is not', async ({ page }) => {
    await convert(page, 'account,amount\n1234567890123456,250\n')
    const sheet = zipPart(await download(page), 'xl/worksheets/sheet1.xml')!
    expect(sheet).toContain('<t xml:space="preserve">1234567890123456</t>')
    // 250 is safe, so it stays a real number and can be summed.
    expect(sheet).toContain('<v>250</v>')
  })

  test('Arabic goes in as Arabic', async ({ page }) => {
    await convert(page, 'الاسم,المدينة\nسارة,الرياض\n')
    const sheet = zipPart(await download(page), 'xl/worksheets/sheet1.xml')!
    expect(sheet).toContain('الرياض')
  })

  test('a column can be forced to text', async ({ page }) => {
    await convert(page, 'code,qty\n42,7\n')
    let sheet = zipPart(await download(page), 'xl/worksheets/sheet1.xml')!
    expect(sheet).toContain('<v>42</v>')
    await page.getByTestId('cx-kind-0-text').click()
    sheet = zipPart(await download(page), 'xl/worksheets/sheet1.xml')!
    expect(sheet).toContain('<t xml:space="preserve">42</t>')
    expect(sheet).not.toContain('<v>42</v>')
  })

  test('the header row is bold, and turning the header off makes it data', async ({ page }) => {
    await convert(page, 'name,age\nSara,30\n')
    await expect(page.getByTestId('cx-size')).toHaveText('1 rows × 2 columns')
    let sheet = zipPart(await download(page), 'xl/worksheets/sheet1.xml')!
    expect(sheet).toMatch(/<c r="A1" s="1"/)
    await page.getByTestId('cx-header').uncheck()
    await expect(page.getByTestId('cx-size')).toHaveText('2 rows × 2 columns')
    sheet = zipPart(await download(page), 'xl/worksheets/sheet1.xml')!
    expect(sheet).not.toMatch(/s="1"/)
  })

  test('the workbook it writes is one our own reader can open', async ({ page }) => {
    await convert(page, 'name,mobile\nSara,0501234567\nOmar,0559876543\n', 'staff.csv')
    const buf = await download(page)
    // Round-trip through the xlsx reader on the other side of the site.
    await page.goto('/en/apps/xlsx-convert')
    await page.getByTestId('xl-file').setInputFiles({
      name: 'staff.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buf,
    })
    const preview = page.getByTestId('xl-preview')
    await expect(preview).toContainText('0501234567')
    await expect(preview).toContainText('Omar')
    // And the sheet carries the CSV's name, not "Sheet1".
    await expect(page.getByTestId('xl-sheet')).toContainText('staff')
  })

  test('the file is named after the CSV', async ({ page }) => {
    await convert(page, 'a,b\n1,2\n', 'report.csv')
    const dl = page.waitForEvent('download')
    await page.getByTestId('cx-save').click()
    expect((await dl).suggestedFilename()).toBe('report.xlsx')
  })
})
