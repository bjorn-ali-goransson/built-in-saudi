import { test, expect } from '@playwright/test'

// Words to speaking time.
//
// The tool exists because every "words to minutes" calculator on the web —
// and there are at least eight sites whose whole domain is that one tool —
// applies an ENGLISH rate to whatever you paste. Arabic silent reading is 138
// wpm against English's 228 on the standardized international test, a 73%
// difference. So the cases that matter are the ones that assert the two
// scripts get DIFFERENT answers for the same word count; a spec that only
// checked "a time appeared" would pass against the bug.

const EN_WORD = 'word '
const AR_WORD = 'كلمة '

const timeOf = async (page: import('@playwright/test').Page) =>
  (await page.getByTestId('st-time').textContent())!.trim()

/** m:ss (either digit set) → seconds, so two answers can be compared. */
const secs = (t: string) => {
  const west = t.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const [m, s] = west.split(':').map(Number)
  return m * 60 + s
}

test('the same word count takes longer in Arabic than in English', async ({ page }) => {
  await page.goto('/en/apps/speech-time')
  const box = page.getByTestId('st-text')

  await box.fill(EN_WORD.repeat(300))
  await page.getByTestId('st-silent').click()
  const en = await timeOf(page)

  await box.fill(AR_WORD.repeat(300))
  const ar = await timeOf(page)

  // 300 words at 238 wpm is 76s; at 138 wpm it is 130s.
  expect(secs(en.split('–')[0])).toBeGreaterThan(0)
  expect(secs(ar)).toBeGreaterThan(secs(en.split('–')[0]))
  // Not merely different — different by roughly the measured 73%.
  expect(secs(ar) / secs(en.split('–')[0])).toBeGreaterThan(1.5)
})

test('the script is detected from the text, not from the URL locale', async ({ page }) => {
  // Somebody on the Arabic side of the site pasting an English script wants
  // the English rate. A rate applied because of a URL prefix would be the
  // very mistake this tool exists to fix, one level up.
  await page.goto('/ar/apps/speech-time')
  await page.getByTestId('st-text').fill(EN_WORD.repeat(300))
  await expect(page.getByTestId('st-latin')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('st-text').fill(AR_WORD.repeat(300))
  await expect(page.getByTestId('st-arabic')).toHaveAttribute('aria-pressed', 'true')
})

test('Arabic spoken aloud is a range, and it names the disagreement', async ({ page }) => {
  await page.goto('/en/apps/speech-time')
  await page.getByTestId('st-text').fill(AR_WORD.repeat(280))
  await page.getByTestId('st-aloud').click()
  // 280 words at 104–140 wpm: 2:00 to 2:42.
  expect(await timeOf(page)).toContain('–')
  await expect(page.getByTestId('st-disagree')).toBeVisible()
  await expect(page.getByTestId('st-disagree')).toContainText('140')
  await expect(page.getByTestId('st-disagree')).toContainText('104')
})

test('Arabic silent reading is ONE figure, and says why it is not a range', async ({ page }) => {
  // Only one standardized figure is published, and padding it into an invented
  // band would be exactly the fabrication the disagreement panel refuses.
  await page.goto('/en/apps/speech-time')
  await page.getByTestId('st-text').fill(AR_WORD.repeat(280))
  await page.getByTestId('st-silent').click()
  expect(await timeOf(page)).not.toContain('–')
  await expect(page.getByTestId('st-point')).toBeVisible()
  await expect(page.getByTestId('st-disagree')).toHaveCount(0)
})

test('a custom rate overrides the range and is used', async ({ page }) => {
  await page.goto('/en/apps/speech-time')
  await page.getByTestId('st-text').fill(EN_WORD.repeat(120))
  await page.getByTestId('st-custom').fill('120')
  // 120 words at 120 wpm is exactly one minute.
  expect(await timeOf(page)).toBe('1:00')
})

test('the word budget is the inverse of the time', async ({ page }) => {
  await page.goto('/en/apps/speech-time')
  await page.getByTestId('st-custom').fill('150')
  await page.getByTestId('st-target').fill('10')
  await expect(page.getByTestId('st-budget')).toHaveText('1,500')
})

test('Arabic renders Arabic-Indic digits in the answer', async ({ page }) => {
  // The failure this repo already records: an Arabic page printing Western
  // digits in something computed, invisible to any test that asserts prose.
  await page.goto('/ar/apps/speech-time')
  await page.getByTestId('st-text').fill(AR_WORD.repeat(280))
  await page.getByTestId('st-custom').fill('140')
  const t = await timeOf(page)
  expect(t).toMatch(/^[٠-٩]+:[٠-٩]{2}$/)
  expect(t).not.toMatch(/[0-9]/)
})

test('Word Counter uses the Arabic rate too — it used to use 200 wpm for both', async ({ page }) => {
  // The defect the sweep found in a shipped tool: a hardcoded 200 wpm in both
  // locales understated an Arabic reading time by about 45%. Asserted on the
  // OTHER tool, because that is where the bug was.
  await page.goto('/en/apps/text-counter')
  const box = page.getByTestId('word-counter').getByRole('textbox')

  await box.fill(EN_WORD.repeat(480))
  const en = await page.getByTestId('wc-Reading time').textContent()

  await box.fill(AR_WORD.repeat(480))
  const ar = await page.getByTestId('wc-Reading time').textContent()

  // 480 words: 2 min at 238 wpm, 3 min at 138.
  expect(en).toContain('2')
  expect(ar).toContain('3')
})
