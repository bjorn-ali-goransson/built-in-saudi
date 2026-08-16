import { test, expect, type Page } from '@playwright/test'

async function problemsOn(page: Page): Promise<string[]> {
  return page.getByTestId('ws-problems').locator('> div').allInnerTexts()
}

test.describe('maths worksheets', () => {
  test('the sheet code makes the sheet reproducible', async ({ page }) => {
    // This is the whole reason the seed is exposed: a reprint after a paper jam
    // must match the answer key already in the teacher's hand.
    await page.goto('/en/apps/worksheets')
    // The documented `allInnerTexts()` hazard: it has no auto-wait, so on a
    // lazily-loaded tool the first read can be [] under a loaded suite.
    await expect(page.getByTestId('worksheets')).toBeVisible()
    await expect.poll(() => problemsOn(page).then((p) => p.length)).toBeGreaterThan(0)
    const first = await problemsOn(page)

    // `fill` resolves when the value is set, NOT when React has repainted from
    // it — so reading straight after is a render race that passes every time
    // the file runs alone and fails under a loaded suite. Poll for the thing
    // under test rather than for time to pass.
    await page.getByTestId('ws-seed').fill('ZZZ999')
    await expect.poll(() => problemsOn(page)).not.toEqual(first)

    await page.getByTestId('ws-seed').fill('ABC123')
    await expect.poll(() => problemsOn(page)).toEqual(first)
  })

  test('“new sheet” actually changes the sheet code', async ({ page }) => {
    await page.goto('/en/apps/worksheets')
    await page.getByTestId('ws-regenerate').click()
    await expect(page.getByTestId('ws-seed')).not.toHaveValue('ABC123')
  })

  test('every division problem divides exactly', async ({ page }) => {
    await page.goto('/en/apps/worksheets')
    for (const op of ['add', 'sub']) await page.getByTestId(`ws-op-${op}`).click()
    await page.getByTestId('ws-op-div').click()
    await page.getByTestId('ws-count').fill('40')
    const rows = await problemsOn(page)
    expect(rows.length).toBe(40)
    for (const row of rows) {
      // "12 ÷ 4 = 3" — the answer cell is rendered even when hidden.
      const m = /(\d+)\s*÷\s*(\d+)\s*=\s*(\d+)/.exec(row.replace(/\s+/g, ' '))
      expect(m, row).not.toBeNull()
      const [, a, b, ans] = m!.map(Number) as unknown as number[]
      expect(Number(b)).toBeGreaterThan(0)
      expect(Number(a) % Number(b)).toBe(0)
      expect(Number(a) / Number(b)).toBe(Number(ans))
    }
  })

  test('subtraction can be held at or above zero', async ({ page }) => {
    await page.goto('/en/apps/worksheets')
    await page.getByTestId('ws-op-add').click()
    await page.getByTestId('ws-count').fill('40')
    for (const row of await problemsOn(page)) {
      const m = /(\d+)\s*−\s*(\d+)\s*=\s*(-?\d+)/.exec(row.replace(/\s+/g, ' '))
      if (m) expect(Number(m[3])).toBeGreaterThanOrEqual(0)
    }
    await page.getByTestId('ws-no-negative').uncheck()
    // With the guard off, a big enough set must contain at least one negative.
    const rows = await problemsOn(page)
    expect(rows.some((r) => /=\s*-\d/.test(r.replace(/\s+/g, ' ')))).toBe(true)
  })

  test('answers are hidden until asked for', async ({ page }) => {
    await page.goto('/en/apps/worksheets')
    await expect(page.getByTestId('ws-answer-0')).toHaveClass(/text-transparent/)
    await page.getByTestId('ws-show-key').check()
    await expect(page.getByTestId('ws-answer-0')).not.toHaveClass(/text-transparent/)
  })

  test('Arabic-Indic numerals are an option', async ({ page }) => {
    await page.goto('/ar/apps/worksheets')
    await page.getByTestId('ws-arabic-digits').check()
    await expect(page.getByTestId('ws-problem-0')).toContainText(/[٠-٩]/)
  })

  test('downloads a PDF named after the sheet code', async ({ page }) => {
    await page.goto('/en/apps/worksheets')
    await page.getByTestId('ws-count').fill('12')
    const dl = page.waitForEvent('download')
    await page.getByTestId('ws-download').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('worksheet-ABC123.pdf')
  })
})

test.describe('bingo cards', () => {
  test('a list too short for one card says so instead of printing nonsense', async ({ page }) => {
    await page.goto('/en/apps/bingo-cards')
    await page.getByTestId('bg-items').fill('one\ntwo\nthree')
    await expect(page.getByTestId('bg-too-few')).toContainText('24')
    await expect(page.getByTestId('bg-download')).toBeDisabled()
  })

  test('a 5×5 card has 25 cells with a free centre and no repeats', async ({ page }) => {
    await page.goto('/en/apps/bingo-cards')
    await page.getByTestId('bg-sample').click()
    const cells = page.getByTestId('bg-preview').locator('> div')
    await expect(cells).toHaveCount(25)
    await expect(page.getByTestId('bg-cell-12')).toHaveText('★')
    const texts = (await cells.allInnerTexts()).filter((t) => t !== '★')
    expect(new Set(texts).size).toBe(texts.length)
  })

  test('turning the free square off fills all 25 from the list', async ({ page }) => {
    await page.goto('/en/apps/bingo-cards')
    await page.getByTestId('bg-sample').click()
    await page.getByTestId('bg-free').uncheck()
    await expect(page.getByTestId('bg-cell-12')).not.toHaveText('★')
    await expect(page.getByTestId('bg-pool')).toContainText('25 needed per card')
  })

  test('it warns when the list barely covers one card', async ({ page }) => {
    await page.goto('/en/apps/bingo-cards')
    // Exactly enough items for one 3×3 card with a free centre. The cards are
    // technically distinct — the items are only shuffled into new positions —
    // so nothing errors, and a generator that stayed quiet here would hand over
    // a set where one call marks a square on every card at once.
    await page.getByTestId('bg-size-3').click()
    await page.getByTestId('bg-items').fill(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n'))
    await expect(page.getByTestId('bg-thin')).toBeVisible()
    await expect(page.getByTestId('bg-download')).toBeEnabled()
    // Doubling the list clears it.
    await page.getByTestId('bg-items').fill('abcdefghijklmnop'.split('').join('\n'))
    await expect(page.getByTestId('bg-thin')).toHaveCount(0)
  })

  test('the set code makes the same cards again', async ({ page }) => {
    await page.goto('/en/apps/bingo-cards')
    await page.getByTestId('bg-sample').click()
    const card = () => page.getByTestId('bg-preview').innerText()
    const before = await card()
    await page.getByTestId('bg-regenerate').click()
    expect(await card()).not.toBe(before)
    await page.getByTestId('bg-seed').fill('ABC123')
    expect(await card()).toBe(before)
  })

  test('the call list is shuffled, not the order you typed', async ({ page }) => {
    await page.goto('/en/apps/bingo-cards')
    await page.getByTestId('bg-sample').click()
    const calls = await page.getByTestId('bg-calls').locator('li').allInnerTexts()
    expect(calls.length).toBe(25)
    const typed = (await page.getByTestId('bg-items').inputValue()).split('\n')
    const called = calls.map((c) => c.replace(/^\d+\.\s*/, ''))
    expect(called).not.toEqual(typed)
    expect([...called].sort()).toEqual([...typed].sort())
  })

  test('downloads a PDF', async ({ page }) => {
    await page.goto('/en/apps/bingo-cards')
    await page.getByTestId('bg-sample').click()
    await page.getByTestId('bg-count').fill('2')
    const dl = page.waitForEvent('download')
    await page.getByTestId('bg-download').click()
    expect((await dl).suggestedFilename()).toBe('bingo-ABC123.pdf')
  })
})

test.describe('quiz maker', () => {
  async function buildQuiz(page: Page) {
    await page.goto('/en/apps/quiz-maker')
    await page.getByTestId('qz-title').fill('Capitals')
    await page.getByTestId('qz-text-0').fill('Capital of Saudi Arabia?')
    await page.getByTestId('qz-choice-0-0').fill('Riyadh')
    await page.getByTestId('qz-choice-0-1').fill('Jeddah')
    await page.getByTestId('qz-correct-0-0').check()
    await page.getByTestId('qz-add').click()
    await page.getByTestId('qz-kind-1').selectOption('tf')
    await page.getByTestId('qz-text-1').fill('Jeddah is on the Red Sea.')
    await page.getByTestId('qz-correct-1-0').check()
  }

  test('an unfinished question is counted and left out', async ({ page }) => {
    await page.goto('/en/apps/quiz-maker')
    await expect(page.getByTestId('qz-incomplete')).toContainText('1 question is unfinished')
    await expect(page.getByTestId('qz-download')).toBeDisabled()
    await expect(page.getByTestId('qz-share')).toBeDisabled()
  })

  test('you can take your own quiz and it marks it', async ({ page }) => {
    await buildQuiz(page)
    await page.getByTestId('qz-play').click()
    await expect(page.getByTestId('qz-submit')).toBeDisabled()
    await page.getByTestId('qz-play-choice-0-0').check()   // Riyadh — right
    await page.getByTestId('qz-play-choice-1-1').check()   // False — wrong
    await page.getByTestId('qz-submit').click()
    await expect(page.getByTestId('qz-score')).toHaveText('1 of 2 correct')
    await expect(page.getByTestId('qz-result-1')).toContainText('True')
  })

  test('the share link keeps the quiz in the fragment, where no server sees it', async ({ page, context }) => {
    await buildQuiz(page)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('qz-share').click()
    const link = await page.evaluate(() => navigator.clipboard.readText())
    expect(link).toContain('#q=')
    // Everything after the # — nothing identifying the quiz is in the path.
    expect(link.split('#')[0]).not.toContain('Riyadh')

    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await page.goto(link)
    await expect(page.getByTestId('qz-play-view')).toBeVisible()
    await expect(page.getByTestId('qz-play-q-0')).toContainText('Capital of Saudi Arabia?')
    // A fragment is never put on the wire; assert that rather than trusting it.
    const payload = link.split('#q=')[1]
    expect(requests.some((u) => u.includes(payload))).toBe(false)
  })

  test('a shared quiz can be opened as an editable copy', async ({ page, context }) => {
    await buildQuiz(page)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('qz-share').click()
    const link = await page.evaluate(() => navigator.clipboard.readText())
    await page.goto(link)
    await page.getByTestId('qz-edit-copy').click()
    await expect(page.getByTestId('qz-title')).toHaveValue('Capitals')
    await expect(page.getByTestId('qz-choice-0-0')).toHaveValue('Riyadh')
    // The fragment is dropped so a refresh does not bounce back into play mode.
    expect(page.url()).not.toContain('#q=')
  })

  test('a short answer is marked case-insensitively', async ({ page }) => {
    await page.goto('/en/apps/quiz-maker')
    await page.getByTestId('qz-kind-0').selectOption('short')
    await page.getByTestId('qz-text-0').fill('Which sea is Jeddah on?')
    await page.getByTestId('qz-answer-0').fill('Red Sea')
    await page.getByTestId('qz-play').click()
    await page.getByTestId('qz-play-input-0').fill('  red sea ')
    await page.getByTestId('qz-submit').click()
    await expect(page.getByTestId('qz-score')).toHaveText('1 of 1 correct')
  })

  test('downloads a question paper', async ({ page }) => {
    await buildQuiz(page)
    const dl = page.waitForEvent('download')
    await page.getByTestId('qz-download').click()
    expect((await dl).suggestedFilename()).toBe('Capitals.pdf')
  })

  test('works in Arabic too', async ({ page }) => {
    await page.goto('/ar/apps/quiz-maker')
    await page.getByTestId('qz-text-0').fill('ما عاصمة السعودية؟')
    await page.getByTestId('qz-choice-0-0').fill('الرياض')
    await page.getByTestId('qz-choice-0-1').fill('جدة')
    await page.getByTestId('qz-correct-0-0').check()
    await page.getByTestId('qz-play').click()
    await page.getByTestId('qz-play-choice-0-0').check()
    await page.getByTestId('qz-submit').click()
    await expect(page.getByTestId('qz-score')).toContainText('1')
  })
})
