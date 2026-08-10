import { test, expect, type Page } from '@playwright/test'
import { readNumber } from './helpers'

// AI Token Counter.
//
// The exact counts below were computed independently with the real tokenizer in
// node before this file was written — not read off the running tool. They are
// deterministic: the same text through the same BPE ranks is the same number
// every time, which is what makes pinning them worth doing.
//
//   o200k   english 44 tokens / 255 chars   arabic  60 tokens / 228 chars
//   cl100k  english 45 tokens               arabic 162 tokens
//
// That is the whole reason the tool exists: the same meaning in Arabic costs
// 36% more tokens than English on the newer tokenizer and nearly FOUR times as
// much on the older one, while "characters ÷ 4" claims 64 for the English
// (a 45% overestimate) and 57 for the Arabic (an underestimate).

const EN = 'Artificial intelligence is transforming how organisations process documents, answer customer questions and summarise long reports. Teams that once needed a week now do the same work in an afternoon, provided the data is clean and the prompts are specific.'
const AR = 'يعمل الذكاء الاصطناعي على تغيير طريقة معالجة المؤسسات للمستندات والإجابة عن أسئلة العملاء وتلخيص التقارير الطويلة. الفرق التي كانت تحتاج أسبوعا صارت تنجز العمل نفسه في فترة بعد الظهر، شرط أن تكون البيانات نظيفة والتعليمات دقيقة.'

const load = async (page: Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/token-counter`)
  await expect(page.getByTestId('token-counter')).toBeVisible()
}

/** Type text and wait for the worker to answer — the count starts as a dash. */
const count = async (page: Page, text: string): Promise<number> => {
  await page.getByTestId('tc-input').fill(text)
  await expect(page.getByTestId('tc-count')).not.toHaveText('—', { timeout: 30_000 })
  return readNumber(page, 'tc-count')
}

test('it counts exactly, rather than estimating', async ({ page }) => {
  await load(page)
  expect(await count(page, EN)).toBe(44)
  expect(await readNumber(page, 'tc-chars')).toBe(255)
})

test('the rule of thumb OVERSTATES English, and the tool says by how much', async ({ page }) => {
  // 255 ÷ 4 = 64 against a true 44. Everybody budgets with this number.
  await load(page)
  await count(page, EN)
  const rule = page.getByTestId('tc-rule')
  await expect(rule).toContainText('64')
  await expect(rule).toContainText('overestimates')
  await expect(rule).toContainText('45%')
})

test('Arabic costs more tokens than English for the same meaning and fewer characters', async ({ page }) => {
  // The wedge. 228 Arabic characters cost MORE than 255 English ones.
  await load(page)
  const en = await count(page, EN)
  const enChars = await readNumber(page, 'tc-chars')
  const ar = await count(page, AR)
  const arChars = await readNumber(page, 'tc-chars')

  expect(arChars).toBeLessThan(enChars)
  expect(ar).toBeGreaterThan(en)
  expect(ar).toBe(60)
})

test('the older tokenizer is nearly four times worse at Arabic', async ({ page }) => {
  await load(page)
  expect(await count(page, AR)).toBe(60)
  await page.getByTestId('tc-enc-cl100k').click()
  await expect(page.getByTestId('tc-count')).not.toHaveText('—', { timeout: 30_000 })
  expect(await readNumber(page, 'tc-count')).toBe(162)
})

test('and it is NOT simply claiming every text is worse on the older tokenizer', async ({ page }) => {
  // Without this, a tool that always reported a large difference would pass the
  // case above. English barely moves between the two: 44 against 45.
  await load(page)
  expect(await count(page, EN)).toBe(44)
  await page.getByTestId('tc-enc-cl100k').click()
  await expect(page.getByTestId('tc-count')).not.toHaveText('—', { timeout: 30_000 })
  expect(await readNumber(page, 'tc-count')).toBe(45)
})

test('the comparison against the other tokenizer is offered, not forced', async ({ page }) => {
  // The other encoding is another megabyte of BPE ranks, so it is fetched when
  // asked for rather than on every visit.
  await load(page)
  await count(page, AR)
  await expect(page.getByTestId('tc-other')).toHaveCount(0)
  await page.getByTestId('tc-compare').click()
  await expect(page.getByTestId('tc-other')).toContainText('162', { timeout: 30_000 })
})

test('the Arabic note appears for Arabic and not for English', async ({ page }) => {
  await load(page)
  await count(page, EN)
  await expect(page.getByTestId('tc-arabic')).toHaveCount(0)
  await count(page, AR)
  await expect(page.getByTestId('tc-arabic')).toBeVisible()
})

test('it says whether the text fits the context window', async ({ page }) => {
  await load(page)
  await count(page, EN)
  await expect(page.getByTestId('tc-used')).toContainText('%')
  await page.getByTestId('tc-context').fill('40')
  await expect(page.getByTestId('tc-used')).toContainText('does not fit')
})

test('no price is invented — the cost appears only once one is supplied', async ({ page }) => {
  // A built-in price table would go stale without anyone touching the code,
  // which is the one thing this site refuses to do with a number.
  await load(page)
  await count(page, EN)
  await expect(page.getByTestId('tc-cost')).toHaveCount(0)
  await expect(page.getByTestId('tc-no-prices')).toContainText('stale')
  await page.getByTestId('tc-price').fill('10')
  // 44 tokens at $10 per million.
  await expect(page.getByTestId('tc-cost')).toContainText('0.00044')
})

test('it works in Arabic, with Arabic-Indic digits', async ({ page }) => {
  await load(page, 'ar')
  const n = await count(page, AR)
  expect(n).toBe(60)
  const t = await page.getByTestId('tc-count').innerText()
  expect(t).toMatch(/[٠-٩]/)
  expect(t).not.toMatch(/[0-9]/)
})
