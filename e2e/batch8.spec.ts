import { test, expect } from '@playwright/test'

test.describe('franco-arabic', () => {
  test('converts the digit letters to Arabic', async ({ page }) => {
    await page.goto('/en/apps/franco-arabic')
    await page.getByTestId('fa-input').fill('3ala 7ammam 5alid')
    const out = page.getByTestId('fa-output')
    await expect(out).toHaveValue(/على/)   // dictionary word
    await expect(out).toHaveValue(/ح/)     // 7
    await expect(out).toHaveValue(/خ/)     // 5
  })

  test('recognises whole words rather than spelling them out', async ({ page }) => {
    await page.goto('/en/apps/franco-arabic')
    await page.getByTestId('fa-input').fill('inshallah shukran habibi')
    await expect(page.getByTestId('fa-output')).toHaveValue('إن شاء الله شكرًا حبيبي')
  })

  test('the definite article becomes ال', async ({ page }) => {
    await page.goto('/en/apps/franco-arabic')
    await page.getByTestId('fa-input').fill('elbeit')
    await expect(page.getByTestId('fa-output')).toHaveValue(/^ال/)
  })

  test('goes the other way too', async ({ page }) => {
    await page.goto('/en/apps/franco-arabic')
    await page.getByTestId('fa-tofr').click()
    await page.getByTestId('fa-input').fill('حبيبي')
    await expect(page.getByTestId('fa-output')).toHaveValue('7byby')
  })

  test('names the letters that are ambiguous', async ({ page }) => {
    await page.goto('/en/apps/franco-arabic')
    await page.getByTestId('fa-input').fill('salam ya sadiq')
    await expect(page.getByTestId('fa-ambiguous')).toBeVisible()
  })

  test('offers to swap when the input is the wrong script', async ({ page }) => {
    await page.goto('/en/apps/franco-arabic')
    await page.getByTestId('fa-input').fill('مرحبا')
    await expect(page.getByTestId('fa-swap')).toBeVisible()
  })
})

test.describe('team maker', () => {
  const NAMES = 'Ahmed\nFatimah\nKhalid\nNoura\nSalem\nHessa'

  test('splits names into the requested number of teams', async ({ page }) => {
    await page.goto('/en/apps/team-maker')
    await page.getByTestId('tm-names').fill(NAMES)
    await expect(page.getByTestId('tm-count')).toHaveText('6 names')
    await expect(page.getByTestId('tm-teams').locator('> div')).toHaveCount(2)
    await page.getByTestId('tm-number').fill('3')
    await expect(page.getByTestId('tm-teams').locator('> div')).toHaveCount(3)
  })

  test('splitting by team size makes enough teams to hold everyone', async ({ page }) => {
    await page.goto('/en/apps/team-maker')
    await page.getByTestId('tm-names').fill(NAMES)
    await page.getByTestId('tm-mode-size').click()
    await page.getByTestId('tm-number').fill('2')
    await expect(page.getByTestId('tm-teams').locator('> div')).toHaveCount(3)
  })

  test('every name is placed exactly once', async ({ page }) => {
    await page.goto('/en/apps/team-maker')
    await page.getByTestId('tm-names').fill(NAMES)
    await page.getByTestId('tm-number').fill('4')
    const text = await page.getByTestId('tm-teams').innerText()
    for (const name of NAMES.split('\n')) {
      expect(text.split(name).length - 1).toBe(1)
    }
  })

  test('people kept apart land on different teams', async ({ page }) => {
    await page.goto('/en/apps/team-maker')
    await page.getByTestId('tm-names').fill(NAMES)
    await page.getByTestId('tm-apart').fill('Ahmed, Khalid')
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('tm-make').click()
      const teams = await page.getByTestId('tm-teams').locator('> div').allInnerTexts()
      const withAhmed = teams.findIndex((t) => t.includes('Ahmed'))
      const withKhalid = teams.findIndex((t) => t.includes('Khalid'))
      expect(withAhmed).not.toBe(withKhalid)
    }
  })

  test('the list survives a reload', async ({ page }) => {
    await page.goto('/en/apps/team-maker')
    await page.getByTestId('tm-names').fill(NAMES)
    await page.reload()
    await expect(page.getByTestId('tm-count')).toHaveText('6 names')
  })
})

test.describe('quotation & receipt', () => {
  test('computes the line totals, VAT and grand total', async ({ page }) => {
    await page.goto('/en/apps/quotation')
    await page.getByTestId('qt-desc-0').fill('Design work')
    await page.getByTestId('qt-qty-0').fill('4')
    await page.getByTestId('qt-price-0').fill('250')
    await expect(page.getByTestId('qt-line-0')).toContainText('1,000.00')
    await expect(page.getByTestId('qt-subtotal')).toContainText('1,000.00')
    await expect(page.getByTestId('qt-vatamount')).toContainText('150.00')
    await expect(page.getByTestId('qt-total')).toContainText('1,150.00')
  })

  test('VAT can be switched off', async ({ page }) => {
    await page.goto('/en/apps/quotation')
    await page.getByTestId('qt-qty-0').fill('1')
    await page.getByTestId('qt-price-0').fill('100')
    await page.getByTestId('qt-vat').uncheck()
    await expect(page.getByTestId('qt-total')).toContainText('100.00')
    await expect(page.getByTestId('qt-vatamount')).toHaveCount(0)
  })

  test('switching document type changes the title and the fields', async ({ page }) => {
    await page.goto('/en/apps/quotation')
    await expect(page.getByTestId('qt-title')).toHaveText('Quotation')
    await expect(page.getByTestId('qt-valid')).toBeVisible()
    await page.getByTestId('qt-receipt').click()
    await expect(page.getByTestId('qt-title')).toHaveText('Receipt')
    await expect(page.getByTestId('qt-method')).toBeVisible()
    await expect(page.getByTestId('qt-valid')).toHaveCount(0)
    await expect(page.getByTestId('qt-received')).toBeVisible()
  })

  test('each document says it is not a tax invoice', async ({ page }) => {
    await page.goto('/en/apps/quotation')
    await expect(page.getByTestId('qt-disclaimer')).toContainText('not a tax invoice')
    await page.getByTestId('qt-receipt').click()
    await expect(page.getByTestId('qt-disclaimer')).toContainText('not a tax invoice')
  })

  test('lines can be added and removed', async ({ page }) => {
    await page.goto('/en/apps/quotation')
    await expect(page.getByTestId('qt-rows').locator('> div')).toHaveCount(1)
    await page.getByTestId('qt-add').click()
    await expect(page.getByTestId('qt-rows').locator('> div')).toHaveCount(2)
    await page.getByTestId('qt-del-1').click()
    await expect(page.getByTestId('qt-rows').locator('> div')).toHaveCount(1)
  })
})

test.describe('character finder', () => {
  test('finds a character by an English keyword', async ({ page }) => {
    await page.goto('/en/apps/char-finder')
    await page.getByTestId('cf-query').fill('peace be upon him')
    await expect(page.getByTestId('cf-results')).toContainText('ﷺ')
  })

  test('finds the rial sign', async ({ page }) => {
    await page.goto('/en/apps/char-finder')
    await page.getByTestId('cf-query').fill('riyal')
    await expect(page.getByTestId('cf-results')).toContainText('﷼')
  })

  test('pasting the character itself finds it', async ({ page }) => {
    await page.goto('/en/apps/char-finder')
    await page.getByTestId('cf-query').fill('→')
    await expect(page.getByTestId('cf-count')).toHaveText('1 character')
    await expect(page.getByTestId('cf-results')).toContainText('Rightwards arrow')
  })

  test('filters by group', async ({ page }) => {
    await page.goto('/en/apps/char-finder')
    await page.getByTestId('cf-group-currency').click()
    const all = await page.getByTestId('cf-results').locator('button').count()
    expect(all).toBeGreaterThan(3)
    await expect(page.getByTestId('cf-results')).toContainText('€')
    await expect(page.getByTestId('cf-results')).not.toContainText('→')
  })

  test('inspect mode names each character and its bytes', async ({ page }) => {
    await page.goto('/en/apps/char-finder')
    await page.getByTestId('cf-mode-inspect').click()
    await page.getByTestId('cf-paste').fill('a→')
    const rows = page.getByTestId('cf-inspected')
    await expect(rows).toContainText('U+0061')
    await expect(rows).toContainText('U+2192')
    await expect(rows).toContainText('Rightwards arrow')
    // UTF-8 for U+2192 is E2 86 92.
    await expect(rows).toContainText('E2 86 92')
  })

  test('a character outside the curated list still gets its block name', async ({ page }) => {
    await page.goto('/en/apps/char-finder')
    await page.getByTestId('cf-mode-inspect').click()
    await page.getByTestId('cf-paste').fill('م')
    await expect(page.getByTestId('cf-inspected')).toContainText('Arabic')
  })
})
