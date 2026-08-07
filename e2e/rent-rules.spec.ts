import { test, expect } from '@playwright/test'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }

// The decree's effective date is the hinge the whole tool turns on.
const BEFORE = '2025-09-24'
const AFTER = '2025-09-26'

async function open(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/rent-rules`)
  await expect(page.getByTestId('rent-rules')).toBeVisible()
}

test.describe('rent increase and renewal rules', () => {
  test('a contract signed after the decree is frozen', async ({ page }) => {
    await open(page)
    await page.getByTestId('rr-signed').fill(AFTER)
    await expect(page.getByTestId('rr-answer')).toHaveText('No')
    await expect(page.getByTestId('rr-reason')).toContainText('cannot be applied during the freeze')
  })

  test('an escalation clause from before the decree still stands — the exception', async ({ page }) => {
    // The whole reason the signing date is asked for. Two tenants in one
    // building, different answers, decided by one day.
    await open(page)
    await page.getByTestId('rr-signed').fill(BEFORE)
    await page.getByTestId('rr-escalation').check()
    await expect(page.getByTestId('rr-answer')).toHaveText('Yes')
    await expect(page.getByTestId('rr-reason')).toContainText('stay valid and enforceable')

    // The same clause in a contract signed two days later does not.
    await page.getByTestId('rr-signed').fill(AFTER)
    await expect(page.getByTestId('rr-answer')).toHaveText('No')
  })

  test('a pre-decree contract with no escalation clause is still frozen', async ({ page }) => {
    await open(page)
    await page.getByTestId('rr-signed').fill(BEFORE)
    await expect(page.getByTestId('rr-escalation')).not.toBeChecked()
    await expect(page.getByTestId('rr-answer')).toHaveText('No')
  })

  test('the reference rent depends on what the property was doing', async ({ page }) => {
    await open(page)
    await page.getByTestId('rr-signed').fill(AFTER)
    await expect(page.getByTestId('rr-reference')).toContainText('25 September 2025')
    await page.getByTestId('rr-sit-vacant').click()
    await expect(page.getByTestId('rr-reference')).toContainText('last contract registered on Ejar')
    await page.getByTestId('rr-sit-never').click()
    await expect(page.getByTestId('rr-reference')).toContainText('agreed')
  })

  test('outside Riyadh the freeze does not apply, but the notice rule still does', async ({ page }) => {
    await open(page)
    await page.getByTestId('rr-elsewhere').click()
    await expect(page.getByTestId('rr-answer')).toHaveText('Yes')
    await expect(page.getByTestId('rr-reason')).toContainText('Riyadh rule')
    // Nationwide, so it must still be shown.
    await expect(page.getByTestId('rr-notice')).toBeVisible()
    // And the Riyadh-only questions go away rather than misleading.
    await expect(page.getByTestId('rr-situation')).toHaveCount(0)
    await expect(page.getByTestId('rr-refuse')).toHaveCount(0)
  })

  test('the 60-day notice deadline counts down, and says when it has gone', async ({ page }) => {
    await open(page)
    await page.getByTestId('rr-ends').fill(inDays(90))
    await expect(page.getByTestId('rr-notice')).toContainText('Give notice by')
    await expect(page.getByTestId('rr-notice')).toContainText('30 days left')
    // Inside 60 days of the end, the lease has already renewed itself.
    await page.getByTestId('rr-ends').fill(inDays(30))
    await expect(page.getByTestId('rr-notice')).toContainText('That date has passed')
  })

  test('Riyadh landlords can only refuse renewal on limited grounds', async ({ page }) => {
    await open(page)
    await expect(page.getByTestId('rr-refuse')).toContainText('not paid')
    await expect(page.getByTestId('rr-refuse')).toContainText('structural defect')
  })

  test('the disclaimer admits the thing it cannot know', async ({ page }) => {
    await open(page)
    const d = page.getByTestId('disclaimer')
    await expect(d).toHaveAttribute('data-kind', 'legal')
    // The freeze turns on the urban boundary, and no calculator knows an address.
    await expect(d).toContainText('urban boundary')
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, 'ar')
    await page.getByTestId('rr-signed').fill(AFTER)
    await expect(page.getByTestId('rr-answer')).toHaveText('لا')
  })
})
