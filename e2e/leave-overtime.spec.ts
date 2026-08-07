import { test, expect } from '@playwright/test'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Local, not UTC — see the id-expiry note in CLAUDE.md. */
const yearsAgo = (y: number, days = 0) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - y)
  d.setDate(d.getDate() + days)
  return iso(d)
}

async function open(page: import('@playwright/test').Page, o: { start?: string; wage?: string; hours?: string } = {}, locale = 'en') {
  await page.goto(`/${locale}/apps/leave-overtime`)
  await expect(page.getByTestId('leave-overtime')).toBeVisible()
  if (o.start) await page.getByTestId('lo-start').fill(o.start)
  if (o.wage) await page.getByTestId('lo-wage').fill(o.wage)
  if (o.hours !== undefined) await page.getByTestId('lo-hours').fill(o.hours)
}

test.describe('leave, overtime and notice', () => {
  test('leave steps from 21 to 30 at five years, to the day', async ({ page }) => {
    // The cliff nobody is told about. A day either side changes the answer.
    await open(page, { start: yearsAgo(5, 2), wage: '12000' })
    await expect(page.getByTestId('lo-leave')).toContainText('21')
    await page.getByTestId('lo-start').fill(yearsAgo(5, -2))
    await expect(page.getByTestId('lo-leave')).toContainText('30')
  })

  test('before the step it names the date it arrives', async ({ page }) => {
    await open(page, { start: yearsAgo(3), wage: '12000' })
    await expect(page.getByTestId('lo-step')).toContainText('Rises to 30 days')
    await expect(page.getByTestId('lo-step')).toContainText(/continuous/i)
  })

  test('after the step it stops promising a future date', async ({ page }) => {
    await open(page, { start: yearsAgo(7), wage: '12000' })
    await expect(page.getByTestId('lo-step')).not.toContainText('Rises to')
    await expect(page.getByTestId('lo-years')).toContainText('7 years')
  })

  test('a day of leave is a day of wage, and overtime is 150% of the hour', async ({ page }) => {
    await open(page, { start: yearsAgo(2), wage: '12000', hours: '10' })
    // 12000 / 30 = 400 a day; / 8 = 50 an hour; overtime hour = 75.
    await expect(page.getByTestId('lo-dayvalue')).toContainText('400')
    await expect(page.getByTestId('lo-daily')).toContainText('400')
    await expect(page.getByTestId('lo-hourly')).toContainText('50')
    await expect(page.getByTestId('lo-othourly')).toContainText('75')
    // 10 hours at 75 = 750.
    await expect(page.getByTestId('lo-otpay')).toContainText('750')
  })

  test('the 720-hour cap is flagged when passed, and framed as a right', async ({ page }) => {
    await open(page, { start: yearsAgo(2), wage: '12000', hours: '700' })
    await expect(page.getByTestId('lo-overcap')).toHaveCount(0)
    await page.getByTestId('lo-hours').fill('800')
    await expect(page.getByTestId('lo-overcap')).toContainText('80 hours past the cap')
    await expect(page.getByText(/cap protects you/)).toBeVisible()
  })

  test('notice is asymmetric, and says which side each number belongs to', async ({ page }) => {
    // The detail people assume is a single number.
    await open(page)
    const notice = page.getByTestId('lo-notice')
    await expect(notice).toContainText('resign: 30 days')
    await expect(notice).toContainText('employer ends it: 60 days')
  })

  test('probation is capped and cannot be extended', async ({ page }) => {
    await open(page)
    await expect(page.getByTestId('lo-probation')).toContainText('180 days')
    await expect(page.getByTestId('lo-probation')).toContainText('cannot be extended')
  })

  test('the disclaimer says a contract can only do better, never worse', async ({ page }) => {
    await open(page)
    const d = page.getByTestId('disclaimer')
    await expect(d).toHaveAttribute('data-kind', 'legal')
    await expect(d).toContainText('cannot give you less')
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, { start: yearsAgo(7), wage: '12000' }, 'ar')
    await expect(page.getByTestId('lo-leave')).toContainText('30')
    await expect(page.getByTestId('lo-notice')).toContainText('استقلت')
  })
})
