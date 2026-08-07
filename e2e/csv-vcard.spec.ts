import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CSV = [
  'Full Name,Mobile,Email,Company,Job Title',
  'Ahmed Al-Otaibi,0512345678,ahmed@example.com,Aramco,Engineer',
  'Sara Al-Harbi,+44 20 7946 0958,sara@example.co.uk,BBC,Producer',
  'محمد القحطاني,0559876543,m@example.com,شركة النور,مدير',
  ',,noname@example.com,,',
].join('\n')

async function load(page: import('@playwright/test').Page, locale = 'en') {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(`/${locale}/apps/csv-vcard`)
  await page.getByTestId('cv-file').setInputFiles({
    name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8'),
  })
  await expect(page.getByTestId('cv-preview')).toBeVisible({ timeout: 15_000 })
}

const vcf = (page: import('@playwright/test').Page) => page.evaluate(() => navigator.clipboard.readText())

test('matches the columns from their headings', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('cv-map-0')).toHaveValue('fullName')
  await expect(page.getByTestId('cv-map-1')).toHaveValue('phone')
  await expect(page.getByTestId('cv-map-2')).toHaveValue('email')
  await expect(page.getByTestId('cv-map-3')).toHaveValue('org')
  await expect(page.getByTestId('cv-map-4')).toHaveValue('title')
})

test('writes N as well as FN, splitting a full name', async ({ page }) => {
  // Address books sort and merge on N. A file with only FN imports as a heap of
  // contacts with no surnames.
  await load(page)
  await page.getByTestId('cv-copy').click()
  const out = await vcf(page)
  expect(out).toContain('N:Al-Otaibi;Ahmed;;;')
  expect(out).toContain('FN:Ahmed Al-Otaibi')
})

test('rewrites Saudi numbers in international form, and leaves others alone', async ({ page }) => {
  await load(page)
  await page.getByTestId('cv-copy').click()
  const out = await vcf(page)
  // 0512345678 is meaningless abroad.
  expect(out).toContain('TEL;TYPE=CELL:+966512345678')
  // A number that is already international is kept, not re-guessed.
  expect(out).toContain('TEL;TYPE=CELL:+442079460958')
})

test('carries Arabic names through', async ({ page }) => {
  await load(page)
  await page.getByTestId('cv-copy').click()
  const out = await vcf(page)
  expect(out).toContain('محمد')
  expect(out).toContain('شركة النور')
})

test('leaves out a row with no name, and says how many', async ({ page }) => {
  await load(page)
  // Four data rows, one of which has no name at all.
  await expect(page.getByTestId('cv-count')).toHaveText('3 contacts')
  await expect(page.getByTestId('cv-skipped')).toContainText('1 row')
  await expect(page.getByTestId('cv-skipped')).toContainText('cannot be imported')
})

test('a remapped column changes the output', async ({ page }) => {
  await load(page)
  await page.getByTestId('cv-map-3').selectOption('note')
  await page.getByTestId('cv-copy').click()
  const out = await vcf(page)
  expect(out).toContain('NOTE:Aramco')
  expect(out).not.toContain('ORG:Aramco')
})

test('asks for a name column before it will export', async ({ page }) => {
  await load(page)
  await page.getByTestId('cv-map-0').selectOption('ignore')
  await expect(page.getByTestId('cv-need-name')).toBeVisible()
  await expect(page.getByTestId('cv-download')).toBeDisabled()
})

test('escapes the characters that are structural in a vCard', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/en/apps/csv-vcard')
  await page.getByTestId('cv-file').setInputFiles({
    name: 'x.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Name,Company\n"Ali, Jr.","Acme; Ltd"', 'utf8'),
  })
  await expect(page.getByTestId('cv-preview')).toBeVisible()
  await page.getByTestId('cv-copy').click()
  const out = await vcf(page)
  expect(out).toContain(String.raw`Ali\, Jr.`)
  expect(out).toContain(String.raw`ORG:Acme\; Ltd`)
})

test('reads an .xlsx as happily as a CSV', async ({ page }) => {
  await page.goto('/en/apps/csv-vcard')
  const buf = readFileSync(fileURLToPath(new URL('./fixtures/sample.xlsx', import.meta.url)))
  await page.getByTestId('cv-file').setInputFiles({
    name: 'sample.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buf,
  })
  await expect(page.getByTestId('cv-preview')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('cv-preview')).toContainText('Ahmed Al-Otaibi')
})

test('downloads a .vcf named after the file', async ({ page }) => {
  await load(page)
  const dl = page.waitForEvent('download')
  await page.getByTestId('cv-download').click()
  expect((await dl).suggestedFilename()).toBe('people.vcf')
})

test('works in Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await expect(page.getByTestId('cv-count')).toBeVisible()
})
