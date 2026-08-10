import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

// Photo print size.
//
// Found by diffing a second large catalogue against ours. The gap is not the
// arithmetic — every site has a print-size calculator — it is that all of them
// print "300 DPI" as though it were a law of printing and make you type the
// pixel dimensions yourself.
//
// It is neither. 300 PPI is one arcminute of human acuity at arm's length:
// 3438 arcminutes per radian divided by 11.46 inches. The tool DERIVES it, and
// therefore also derives what happens when you stand further back — which is
// the difference between "your photo is too small" and "your photo is fine".

const load = async (page: import('@playwright/test').Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/print-size`)
  await expect(page.getByTestId('print-size')).toBeVisible()
}

const set = async (page: import('@playwright/test').Page, id: string, v: string) => {
  await page.getByTestId(id).fill(v)
}

test('the needed density at arm’s length comes out as 300', async ({ page }) => {
  // 11.46 inches is 29.1 cm, and 3438 / 11.46 = 300. That the convention falls
  // out of the geometry is the whole claim.
  await load(page)
  await set(page, 'ps-distance', '29')
  const needed = await readNumber(page, 'ps-needed')
  expect(needed).toBeGreaterThan(295)
  expect(needed).toBeLessThan(306)
})

test('and it falls away with distance — a poster needs a seventh of it', async ({ page }) => {
  await load(page)
  await set(page, 'ps-distance', '200')
  const needed = await readNumber(page, 'ps-needed')
  expect(needed).toBeGreaterThan(40)
  expect(needed).toBeLessThan(48)
})

test('the same photo goes from "short" to "plenty" by stepping back', async ({ page }) => {
  // The result the incumbents cannot produce, because they hard-code the 300.
  await load(page)
  await set(page, 'ps-w', '1920')
  await set(page, 'ps-h', '1080')
  await page.getByTestId('ps-paper').selectOption('a2')
  await set(page, 'ps-distance', '30')
  await expect(page.getByTestId('ps-verdict')).toContainText('Short')
  await set(page, 'ps-distance', '250')
  await expect(page.getByTestId('ps-verdict')).toContainText('Plenty')
})

test('a bigger sheet gives fewer pixels per inch', async ({ page }) => {
  await load(page)
  await set(page, 'ps-w', '4032')
  await set(page, 'ps-h', '3024')
  await page.getByTestId('ps-paper').selectOption('a4')
  const a4 = await readNumber(page, 'ps-ppi')
  await page.getByTestId('ps-paper').selectOption('a2')
  const a2 = await readNumber(page, 'ps-ppi')
  // A2 is FOUR times the area of A4 — A4 to A3 to A2 is two doublings — so the
  // linear scale is 2x and the density halves. (The first version of this
  // assertion said root-two, which is A4 to A3.)
  expect(a2).toBeLessThan(a4)
  expect(a4 / a2).toBeGreaterThan(1.9)
  expect(a4 / a2).toBeLessThan(2.1)
})

test('the printed size keeps the picture’s own proportions and says so', async ({ page }) => {
  // A calculator that quietly stretches the image answers a question nobody
  // asked. A 4:3 photo on A4 (1:√2) must leave a margin, and be told to.
  await load(page)
  await set(page, 'ps-w', '4000')
  await set(page, 'ps-h', '3000')
  await page.getByTestId('ps-paper').selectOption('a4')
  await page.getByTestId('ps-landscape').click()
  const printed = await page.getByTestId('ps-printed').textContent()
  const [w, h] = printed!.match(/[\d.]+/g)!.map(Number)
  expect(w / h).toBeGreaterThan(1.3)
  expect(w / h).toBeLessThan(1.36)
  await expect(page.getByTestId('ps-letterbox')).toBeVisible()
})

test('a sheet of the SAME shape leaves no margin', async ({ page }) => {
  // Without this the case above passes against a tool that always claims one.
  await load(page)
  await set(page, 'ps-w', '2000')
  await set(page, 'ps-h', '3000')
  await page.getByTestId('ps-paper').selectOption('photo20x30')
  await page.getByTestId('ps-portrait').click()
  await expect(page.getByTestId('ps-letterbox')).toHaveCount(0)
})

test('the largest acceptable print is reported, not just a pass or fail', async ({ page }) => {
  await load(page)
  await set(page, 'ps-w', '4032')
  await set(page, 'ps-h', '3024')
  await set(page, 'ps-distance', '29')
  // 4032 px at 300 PPI is 34.1 cm.
  const largest = await readNumber(page, 'ps-largest')
  expect(largest).toBeGreaterThan(33)
  expect(largest).toBeLessThan(35)
})

test('the pixel size is read from the picture, not typed', async ({ page }) => {
  // The differentiator: every incumbent makes you look the number up.
  await load(page)
  await page.getByTestId('ps-file').setInputFiles('e2e/fixtures/diff-a.png')
  await expect(page.getByTestId('ps-name')).toBeVisible({ timeout: 20000 })
  // `readNumber` reads textContent, which is empty for an <input>.
  await expect(page.getByTestId('ps-w')).toHaveValue('40')
  await expect(page.getByTestId('ps-h')).toHaveValue('40')
})

test('a HEIC is read too, so an iPhone photo is not a dead end', async ({ page }) => {
  await load(page)
  await page.getByTestId('ps-file').setInputFiles('e2e/fixtures/sample.heic')
  await expect(page.getByTestId('ps-name')).toBeVisible({ timeout: 30000 })
  expect(Number(await page.getByTestId('ps-w').inputValue())).toBeGreaterThan(0)
})

test('a non-image is refused with a reason', async ({ page }) => {
  await load(page)
  await page.getByTestId('ps-file').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello'),
  })
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 20000 })
})

test('the derivation is stated, not the number repeated', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('ps-dpi-note')).toContainText('3438')
  await expect(page.getByTestId('ps-dpi-note')).toContainText('arcminute')
  await expect(page.getByTestId('ps-pixel-note')).toContainText('metadata')
})

test('it works in Arabic', async ({ page }) => {
  await load(page, 'ar')
  await set(page, 'ps-distance', '29')
  const t = await page.getByTestId('ps-needed').textContent()
  expect(t).toMatch(/[٠-٩]/)
  const needed = await readNumber(page, 'ps-needed')
  expect(needed).toBeGreaterThan(295)
  expect(needed).toBeLessThan(306)
})
