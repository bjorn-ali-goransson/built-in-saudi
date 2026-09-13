import { test, expect, type Page } from '@playwright/test'

/**
 * Generating MANY passwords at once.
 *
 * The single-password path is covered in `app.spec.ts`; everything here is
 * about what changes when a batch is asked for — the file, the copy, and the
 * two things a batch can get wrong that one password cannot: a list that no
 * longer matches the settings above it, and rows that silently repeat.
 */

async function load(page: Page, locale = 'en') {
  await page.goto(`/${locale}/apps/password-generator`)
  await expect(page.getByTestId('password-generator')).toBeVisible()
}

/** Ask for `n`, then generate. The field is cleared first: `fill` replaces the
 *  value, but typing into a number input that already reads "1" is how a test
 *  ends up asking for 1,250 when it meant 250. */
async function batch(page: Page, n: number) {
  await page.getByTestId('pw-count').fill(String(n))
  await page.getByTestId('pw-regenerate').click()
  await expect(page.getByTestId('pw-download')).toBeVisible({ timeout: 20_000 })
}

/**
 * The DOWNLOADED file, as bytes.
 *
 * Read off the button's own `href` rather than trusting that a list on screen
 * is what a reader receives — the same reason the image editor's export case
 * decodes its blob. The preview is capped at 100 lines, so the file is the only
 * place the whole batch can actually be checked.
 */
async function file(page: Page): Promise<string[]> {
  const href = await page.getByTestId('pw-download').getAttribute('href')
  expect(href).toMatch(/^blob:/)
  const text = await page.evaluate((url) => fetch(url!).then((r) => r.text()), href)
  // One trailing newline is deliberate, so the file ends the way a text file
  // should; the rows are what everything below asserts on.
  expect(text.endsWith('\n')).toBe(true)
  return text.trimEnd().split('\n')
}

test('one password by default — no list, no file', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('pw-output')).toBeVisible()
  await expect(page.getByTestId('pw-list')).toHaveCount(0)
  await expect(page.getByTestId('pw-download')).toHaveCount(0)
  // The property that keeps the batch controls from taxing the common case:
  // asking for one is still the same single-line output it always was.
  await expect(page.getByTestId('pw-count')).toHaveValue('1')
})

test('a batch is newline separated, and the FILE holds every one of them', async ({ page }) => {
  await load(page)
  await batch(page, 250)

  const lines = await file(page)
  expect(lines).toHaveLength(250)
  // Every row is a real password at the chosen length, not padding or a
  // repeated placeholder — a file of 250 identical lines would otherwise pass
  // a count assertion perfectly.
  for (const l of lines) expect(l).toHaveLength(16)
  expect(new Set(lines).size).toBe(250)

  await expect(page.getByTestId('pw-download'))
    .toHaveAttribute('download', 'passwords-250.txt')
})

test('the preview is capped, and says so', async ({ page }) => {
  await load(page)
  await batch(page, 4000)

  // Capped at 100 rendered lines. This is the assertion that would catch the
  // page trying to lay out four thousand line boxes on a phone.
  const shown = (await page.getByTestId('pw-list').textContent()) ?? ''
  expect(shown.trim().split('\n')).toHaveLength(100)
  await expect(page.getByTestId('pw-count-note')).toContainText('100')
  await expect(page.getByTestId('pw-count-note')).toContainText('4,000')

  // …while the file still carries all of them, which is the whole point of
  // capping the preview rather than the batch.
  expect(await file(page)).toHaveLength(4000)
})

test('COPY ALL puts every password on the clipboard, not just the visible ones', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await load(page)
  await batch(page, 300)

  await page.getByTestId('pw-copy').click()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  const lines = text.split('\n')
  expect(lines).toHaveLength(300)
  // Not the 100 on screen: the case exists because copying the preview instead
  // of the batch is the obvious way to get this wrong, and it looks correct.
  expect(lines[299]).toHaveLength(16)
})

test('CHANGING A SETTING CLEARS THE BATCH rather than leaving a stale one', async ({ page }) => {
  await load(page)
  await batch(page, 50)
  const before = await file(page)
  expect(before[0]).toHaveLength(16)

  // Move the length. The list on screen was generated at 16 and no longer
  // describes the settings above it, so it goes — a stale list of passwords is
  // worse than none, because nothing about looking at it says it is stale.
  await page.getByTestId('pw-length').fill('32')
  await expect(page.getByTestId('pw-download')).toHaveCount(0)
  await expect(page.getByTestId('pw-count-note')).not.toBeEmpty()

  // And generating again gives the NEW settings.
  await page.getByTestId('pw-regenerate').click()
  await expect(page.getByTestId('pw-download')).toBeVisible({ timeout: 20_000 })
  for (const l of await file(page)) expect(l).toHaveLength(32)
})

test('repeats in a batch are reported — and NOT when there are none', async ({ page }) => {
  await load(page)

  // THE FIXTURE HAS TO CONTAIN THE HARD CASE, and here that is arithmetic
  // rather than taste. Digits at the shortest length the tool offers is 10^6
  // possible passwords, and 10,000 draws from it collide about FIFTY times by
  // the birthday bound — so the case fires every run. At 2,000 draws the
  // expected count is 2 and a clean run would be ordinary, which is a test that
  // passes most of the time and teaches nothing on the rest.
  await page.getByTestId('pw-lower').uncheck()
  await page.getByTestId('pw-upper').uncheck()
  await page.getByTestId('pw-symbols').uncheck()
  await page.getByTestId('pw-length').fill('6')
  await batch(page, 10000)

  const lines = await file(page)
  const actualDupes = lines.length - new Set(lines).size
  expect(actualDupes, 'the fixture settings did not actually collide').toBeGreaterThan(0)
  await expect(page.getByTestId('pw-dupes')).toBeVisible()

  // THE CONTROL, and the load-bearing half: the same batch size at a real
  // length has no repeats at all, so the note must be absent. Only the SETTINGS
  // differ between the two halves. Without this the note could be permanent
  // decoration and every assertion above would still pass.
  await page.getByTestId('pw-lower').check()
  await page.getByTestId('pw-upper').check()
  await page.getByTestId('pw-symbols').check()
  await page.getByTestId('pw-length').fill('16')
  await batch(page, 10000)
  await expect(page.getByTestId('pw-dupes')).toHaveCount(0)
})

test('the ceiling is 10,000 and typing past it clamps', async ({ page }) => {
  await load(page)
  await page.getByTestId('pw-count').fill('99999')
  // `min`/`max` on a number input are advisory for a typed value, so this is
  // clamped in the handler; without that the page would be asked for 99,999.
  await expect(page.getByTestId('pw-count')).toHaveValue('10000')
})

test('Arabic prints the counts in Arabic-Indic digits', async ({ page }) => {
  await load(page, 'ar')
  await batch(page, 4000)
  // An Arabic test that only asserts prose is not testing the Arabic rendering
  // of anything computed — this repo has shipped that mistake three times.
  await expect(page.getByTestId('pw-count-note')).toContainText('٤٬٠٠٠')
  await expect(page.getByTestId('pw-count-note')).toContainText('١٠٠')
})
