import { test, expect, type Page } from '@playwright/test'

// Readable Text.
//
// Found by sweeping the assistive-reading market, where every guide gives the
// same three pieces of advice — bigger text, more line spacing, MORE LETTER
// SPACING — and the third is Latin advice presented as universal.
//
// Arabic is cursive: the letters join, and the join is part of the letterform
// rather than a gap between two shapes, so tracking stretches or breaks the
// connecting stroke and the word stops looking like a word. This repo already
// knew it in practice and had never written it down — 16 places in `src/` carry
// `rtl:tracking-normal`.
//
// The contract is `data-tracking` on the output. Asserting a computed CSS
// string would be testing the browser's serialisation; the attribute is what
// the code MEANS — the same testable-contract move as `data-why` and
// `data-scroll`.

const EN = 'The quick brown fox jumps over the lazy dog and keeps running until it reaches the far side of the field.'
const AR = 'الثعلب البني السريع يقفز فوق الكلب الكسول ويواصل الجري حتى يبلغ الطرف الآخر من الحقل الواسع.'

const load = async (page: Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/readable-text`)
  await expect(page.getByTestId('readable-text')).toBeVisible()
}

const type = async (page: Page, text: string) => {
  await page.getByTestId('rt-input').fill(text)
}

test('letter spacing applies to Latin text', async ({ page }) => {
  await load(page)
  await type(page, EN)
  await page.getByTestId('rt-letter').fill('8')
  await expect(page.getByTestId('rt-output')).toHaveAttribute('data-tracking', '0.08')
})

test('and is forced to zero for Arabic, however far the slider is pushed', async ({ page }) => {
  // The whole reason the tool is worth building rather than copying.
  await load(page)
  await type(page, AR)
  await page.getByTestId('rt-letter').fill('12')
  await expect(page.getByTestId('rt-output')).toHaveAttribute('data-tracking', '0')
  // And it explains itself rather than silently ignoring the control.
  await expect(page.getByTestId('rt-tracking-off')).toBeVisible()
})

test('the explanation appears only when the setting is actually being overridden', async ({ page }) => {
  // Without this, the panel could be permanent decoration on the Arabic side.
  await load(page)
  await type(page, AR)
  await page.getByTestId('rt-letter').fill('0')
  await expect(page.getByTestId('rt-tracking-off')).toHaveCount(0)
})

test('the script is detected from the TEXT, not from the interface language', async ({ page }) => {
  // Somebody reading an English article on the Arabic side of the site wants
  // the Latin treatment. Deciding from a URL prefix would be the same mistake
  // `readingRate` records one level up.
  await load(page, 'ar')
  await type(page, EN)
  await page.getByTestId('rt-letter').fill('6')
  await expect(page.getByTestId('rt-output')).toHaveAttribute('data-tracking', '0.06')
  await expect(page.getByTestId('rt-output')).toHaveAttribute('dir', 'ltr')
})

test('line length is judged against the range typography settled on', async ({ page }) => {
  await load(page)
  await type(page, EN)
  await page.getByTestId('rt-measure').fill('66')
  await expect(page.getByTestId('rt-measure-note')).toContainText('Within')
  await page.getByTestId('rt-measure').fill('95')
  await expect(page.getByTestId('rt-measure-note')).toContainText('Longer')
  await page.getByTestId('rt-measure').fill('34')
  await expect(page.getByTestId('rt-measure-note')).toContainText('Shorter')
})

test('bolding the start of a word leaves some of it unbolded', async ({ page }) => {
  // An entirely bold word is emphasis that emphasises nothing.
  await load(page)
  await type(page, EN)
  await page.getByTestId('rt-emphasis').check()
  const strongs = page.getByTestId('rt-output').locator('strong')
  expect(await strongs.count()).toBeGreaterThan(5)
  const whole = (await page.getByTestId('rt-output').innerText()).replace(/\s+/g, '')
  const bold = (await strongs.allInnerTexts()).join('').replace(/\s+/g, '')
  expect(bold.length).toBeGreaterThan(0)
  expect(bold.length).toBeLessThan(whole.length)
})

test('settings survive a reload', async ({ page }) => {
  await load(page)
  await type(page, EN)
  await page.getByTestId('rt-size').fill('34')
  await page.getByTestId('rt-theme-dark').click()
  await page.reload()
  await expect(page.getByTestId('rt-size')).toHaveValue('34')
})

test('the machine-reading caveat is stated, because tracking cuts both ways', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('rt-machine')).toContainText('0.1')
  await expect(page.getByTestId('rt-machine')).toContainText('E X P E R I E N C E')
})
