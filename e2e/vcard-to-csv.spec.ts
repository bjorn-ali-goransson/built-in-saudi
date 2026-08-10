import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { zipPart } from './helpers'

const CRLF = (lines: string[]) => lines.join('\r\n') + '\r\n'

async function load(page: import('@playwright/test').Page, vcf: string, name = 'contacts.vcf') {
  await page.goto('/en/apps/vcard-to-csv')
  await page.getByTestId('vc-file').setInputFiles({ name, mimeType: 'text/vcard', buffer: Buffer.from(vcf, 'utf8') })
}

async function csv(page: import('@playwright/test').Page): Promise<string> {
  const dl = page.waitForEvent('download')
  await page.getByTestId('vc-csv').click()
  return readFileSync((await (await dl).path())!, 'utf8')
}

test.describe('vcard to csv', () => {
  test('a plain card becomes a row', async ({ page }) => {
    await load(page, CRLF([
      'BEGIN:VCARD', 'VERSION:3.0', 'N:Al-Otaibi;Sara;;;', 'FN:Sara Al-Otaibi',
      'TEL;TYPE=CELL:+966501234567', 'EMAIL;TYPE=INTERNET:sara@example.com',
      'ORG:Aramco;IT', 'TITLE:Engineer', 'END:VCARD',
    ]))
    await expect(page.getByTestId('vc-count')).toHaveText('1 contact')
    const text = await csv(page)
    expect(text).toContain('Sara Al-Otaibi')
    expect(text).toContain('+966501234567')
    expect(text).toContain('sara@example.com')
    expect(text).toContain('Engineer')
    // ORG's structured parts are joined rather than one of them being dropped.
    expect(text).toMatch(/Aramco.*IT/)
  })

  test('a folded line is rejoined before anything else happens', async ({ page }) => {
    // The fold is at 75 octets and lands mid-value; the continuation begins
    // with a single space, which is not part of the data.
    await load(page, CRLF([
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Mohammed', 'N:;Mohammed;;;',
      'NOTE:This note is long enough that a real exporter would have folded it in',
      ' to two physical lines right here',
      'END:VCARD',
    ]))
    const text = await csv(page)
    expect(text).toContain('folded it into two physical lines')
  })

  test('an Android quoted-printable Arabic name comes out as the name', async ({ page }) => {
    // What Android's exporter actually writes for "سارة".
    await load(page, CRLF([
      'BEGIN:VCARD', 'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D8=B3=D8=A7=D8=B1=D8=A9;;;;',
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D8=B3=D8=A7=D8=B1=D8=A9',
      'TEL;CELL:0501234567',
      'END:VCARD',
    ]))
    const text = await csv(page)
    expect(text).toContain('سارة')
    expect(text).not.toContain('=D8=B3')
    // The 2.1 shorthand parameter (TEL;CELL:, no TYPE=) is still a phone.
    expect(text).toContain('0501234567')
  })

  test('an Apple item-group property is not dropped', async ({ page }) => {
    await load(page, CRLF([
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Omar', 'N:;Omar;;;',
      'item1.TEL;type=pref:0559876543',
      'item2.URL:https://example.com/omar',
      'END:VCARD',
    ]))
    const text = await csv(page)
    expect(text).toContain('0559876543')
    // The colon inside the URL must not be mistaken for the name/value split.
    expect(text).toContain('https://example.com/omar')
  })

  test('a contact with three numbers gets three columns', async ({ page }) => {
    await load(page, CRLF([
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Nora', 'N:;Nora;;;',
      'TEL;TYPE=CELL:0500000001', 'TEL;TYPE=HOME:0500000002', 'TEL;TYPE=WORK:0500000003',
      'END:VCARD',
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Khalid', 'N:;Khalid;;;', 'TEL:0500000004', 'END:VCARD',
    ]))
    await expect(page.getByTestId('vc-count')).toHaveText('2 contacts')
    const text = await csv(page)
    expect(text).toContain('Phone 1')
    expect(text).toContain('Phone 3')
    expect(text).toContain('0500000003')
  })

  test('escaped commas and semicolons survive the round trip into CSV', async ({ page }) => {
    await load(page, CRLF([
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Ali', 'N:;Ali;;;',
      'ADR;TYPE=HOME:;;King Fahd Rd\\, Building 3;Riyadh;;12345;',
      'END:VCARD',
    ]))
    const text = await csv(page)
    // The comma is real data, so the CSV must quote the field rather than
    // letting it become a column break.
    expect(text).toContain('"King Fahd Rd, Building 3, Riyadh, 12345"')
  })

  test('a photo blob is left out rather than pasted into a cell', async ({ page }) => {
    await load(page, CRLF([
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Faisal', 'N:;Faisal;;;',
      'PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRgABAQEASABIAAD',
      'END:VCARD',
    ]))
    const text = await csv(page)
    expect(text).toContain('Faisal')
    expect(text).not.toContain('9j/4AAQ')
  })

  test('a file with no cards says so instead of showing an empty table', async ({ page }) => {
    await load(page, 'this is just some text\n', 'notes.txt')
    await expect(page.getByTestId('file-error')).toBeVisible()
    await expect(page.getByTestId('vc-preview')).toHaveCount(0)
  })

  test('the Excel export is downloadable and named after the file', async ({ page }) => {
    await load(page, CRLF(['BEGIN:VCARD', 'VERSION:3.0', 'FN:Sara', 'N:;Sara;;;', 'TEL:0501234567', 'END:VCARD']), 'phone-backup.vcf')
    const dl = page.waitForEvent('download')
    await page.getByTestId('vc-xlsx').click()
    const d = await dl
    expect(d.suggestedFilename()).toBe('phone-backup.xlsx')
    // The number must be text in the workbook, or Excel eats the leading zero.
    // The sheet is DEFLATED now, so it is inflated rather than grepped out of
    // the raw archive. Strings are written inline, so the number is in the
    // sheet part itself.
    const buf = readFileSync((await d.path())!)
    expect(zipPart(buf, 'xl/worksheets/sheet1.xml')).toContain('0501234567')
  })
})
