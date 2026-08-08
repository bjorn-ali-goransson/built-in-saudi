import { test, expect } from '@playwright/test'

async function open(page: import('@playwright/test').Page, o: { school?: string; qudurat?: string; tahsili?: string } = {}, locale = 'en') {
  await page.goto(`/${locale}/apps/admission-score`)
  await expect(page.getByTestId('admission-score')).toBeVisible()
  if (o.school) await page.getByTestId('as-school').fill(o.school)
  if (o.qudurat) await page.getByTestId('as-qudurat').fill(o.qudurat)
  if (o.tahsili) await page.getByTestId('as-tahsili').fill(o.tahsili)
}

/**
 * Read a number out of the UI, in either language.
 *
 * ar-SA formats with Arabic-Indic digits (٧٩), so stripping non-ASCII digits
 * leaves an empty string and every Arabic assertion silently compares zero.
 */
const num = async (page: import('@playwright/test').Page, id: string) => {
  const text = await page.getByTestId(id).innerText()
  const latin = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  return Number(latin.replace(/[^\d.]/g, ''))
}

test.describe('weighted admission score', () => {
  test('the arithmetic is the published formula', async ({ page }) => {
    // 90×30% + 80×30% + 70×40% = 27 + 24 + 28 = 79
    await open(page, { school: '90', qudurat: '80', tahsili: '70' })
    expect(await num(page, 'as-total')).toBeCloseTo(79, 2)
  })

  test('a different university weighting gives a different answer', async ({ page }) => {
    // KFUPM 20/30/50 on the same scores: 18 + 24 + 35 = 77
    await open(page, { school: '90', qudurat: '80', tahsili: '70' })
    await page.getByTestId('as-w-kfupm').click()
    expect(await num(page, 'as-total')).toBeCloseTo(77, 2)
  })

  test('the comparison shows every weighting at once', async ({ page }) => {
    // The point of the table: which university values what you already have.
    await open(page, { school: '99', qudurat: '70', tahsili: '70' })
    const ksu = await num(page, 'as-row-ksu')
    const kfupm = await num(page, 'as-row-kfupm')
    // A strong school score does better where school is weighted higher.
    expect(ksu).toBeGreaterThan(kfupm)
  })

  test('custom weights are accepted, and refused when they do not total 100', async ({ page }) => {
    await open(page, { school: '90', qudurat: '80', tahsili: '70' })
    await page.getByTestId('as-w-custom').click()
    await page.getByTestId('as-cw-school').fill('50')
    await page.getByTestId('as-cw-qudurat').fill('25')
    await page.getByTestId('as-cw-tahsili').fill('25')
    await expect(page.getByTestId('as-invalid')).toHaveCount(0)
    // 45 + 20 + 17.5 = 82.5
    expect(await num(page, 'as-total')).toBeCloseTo(82.5, 2)

    await page.getByTestId('as-cw-tahsili').fill('40')
    await expect(page.getByTestId('as-invalid')).toContainText('115%')
  })

  test('the levers are ordered by what is still attainable, not by weight', async ({ page }) => {
    // Tahsili is weighted highest but nearly maxed; school has room. The
    // ordering must follow headroom × weight, or the advice is backwards.
    await open(page, { school: '70', qudurat: '90', tahsili: '99' })
    await expect(page.getByTestId('as-lever-0')).toContainText('High school')
  })

  test('a maxed component offers nothing more, whatever its weight', async ({ page }) => {
    await open(page, { school: '100', qudurat: '100', tahsili: '90' })
    await expect(page.getByTestId('as-lever-0')).toContainText('Tahsili')
    expect(await num(page, 'as-total')).toBeCloseTo(96, 2)
  })

  test('the disclaimer says the weighting and the cut-off are the university’s', async ({ page }) => {
    await open(page)
    const d = page.getByTestId('disclaimer')
    await expect(d).toHaveAttribute('data-kind', 'official')
    await expect(d).toContainText('cut-offs move every year')
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, { school: '90', qudurat: '80', tahsili: '70' }, 'ar')
    expect(await num(page, 'as-total')).toBeCloseTo(79, 2)
    await expect(page.getByTestId('as-levers')).toContainText('التحصيلي')
  })
})
