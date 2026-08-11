import { test, expect, type Page } from '@playwright/test'

// Text Compare, at the granularity that answers the question.
//
// Found by a code sweep: `lib/wordDiff.ts` was written for `pdf-diff` and had
// exactly ONE caller, while the site's primary text comparison tool carried a
// byte-identical copy of the same LCS and highlighted whole LINES. Measured
// (`node evals/diffgrain.mjs`): that paints 4.6x as many words as actually
// changed, and 9-12x on the commonest edit there is.

const load = async (page: Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/text-diff`)
  await expect(page.getByTestId('text-diff')).toBeVisible()
}

const compare = async (page: Page, a: string, b: string) => {
  await page.getByTestId('diff-a').fill(a)
  await page.getByTestId('diff-b').fill(b)
  await expect(page.getByTestId('diff-output')).toBeVisible()
}

/** The words a row actually highlights as changed. */
const marked = (page: Page, row: number) =>
  page.locator(`[data-testid="diff-row-${row}"] [data-changed="yes"]`).allInnerTexts()

test('one word changed in a sentence highlights ONE word, not the sentence', async ({ page }) => {
  // The measured case: eleven words painted to report that one of them moved.
  await load(page)
  await compare(page,
    'The tenant shall pay an annual rent of thirty thousand riyals.',
    'The tenant shall pay an annual rent of sixty thousand riyals.')
  expect((await marked(page, 0)).join(' ').trim()).toBe('thirty')
  expect((await marked(page, 1)).join(' ').trim()).toBe('sixty')
})

test('the unchanged words of that same row are NOT marked', async ({ page }) => {
  // Without this the case above would pass against a tool that marks
  // everything and happens to put the changed word first.
  await load(page)
  await compare(page,
    'The tenant shall pay an annual rent of thirty thousand riyals.',
    'The tenant shall pay an annual rent of sixty thousand riyals.')
  const row = page.locator('[data-testid="diff-row-0"]')
  await expect(row).toContainText('annual rent')
  await expect(row.locator('[data-changed="no"]').first()).toContainText('The tenant')
})

test('a REWRITE is left whole rather than turned into confetti', async ({ page }) => {
  // Two unrelated sentences share "the" and "of"; rendering those as islands
  // of unchanged text inside a rewrite is worse than the whole-line highlight
  // it replaced. Measured: a genuine edit shares at least 79% of its words and
  // a rewrite at most 9%, so the floor sits between them.
  await load(page)
  await compare(page,
    'The supplier warrants the goods for one year.',
    'Nothing in this agreement limits the statutory rights of the buyer.')
  const del = page.locator('[data-testid="diff-row-0"]')
  await expect(del).toHaveAttribute('data-kind', 'del')
  // One part, the whole line — not a scatter of marked and unmarked runs.
  await expect(del.locator('[data-changed]')).toHaveCount(1)
})

test('an inserted line is whole, because it has no partner to compare against', async ({ page }) => {
  await load(page)
  await compare(page, 'Section one.\nSection two.', 'Section one.\nA new clause.\nSection two.')
  const add = page.locator('[data-kind="add"]').first()
  await expect(add).toContainText('A new clause.')
  await expect(add.locator('[data-changed="yes"]')).toHaveCount(1)
})

test('identical texts say so and mark nothing', async ({ page }) => {
  // Deliberately not the `compare` helper: identical texts render the message
  // INSTEAD of the diff, so waiting for the output is waiting for the thing
  // this case asserts is absent.
  await load(page)
  await page.getByTestId('diff-a').fill('Same text here.')
  await page.getByTestId('diff-b').fill('Same text here.')
  await expect(page.getByText('identical')).toBeVisible()
  await expect(page.getByTestId('diff-output')).toHaveCount(0)
})

test('it works on Arabic, where the changed word is one of many', async ({ page }) => {
  await load(page, 'ar')
  await compare(page,
    'يلتزم المستأجر بسداد أجرة سنوية قدرها ثلاثون ألف ريال.',
    'يلتزم المستأجر بسداد أجرة سنوية قدرها ستون ألف ريال.')
  expect((await marked(page, 0)).join(' ').trim()).toBe('ثلاثون')
  expect((await marked(page, 1)).join(' ').trim()).toBe('ستون')
})

test('ignoring whitespace still compares the words', async ({ page }) => {
  await load(page)
  await compare(page, '   padded line   ', 'padded line')
  await page.getByTestId('diff-ignorews').check()
  await expect(page.getByText('identical')).toBeVisible()
})
