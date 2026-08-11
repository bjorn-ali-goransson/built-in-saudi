import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// When can I retire? (GOSI)
//
// Found by sweeping the vertical between employees and companies — the
// self-employed. The freelance document itself turned out to be free and
// procedural, and its optional GOSI rate is described everywhere as "higher,
// because they bear both shares" with no figure anybody publishes, so no
// calculator was built for it. What the sweep did surface is far bigger: the
// Social Insurance Law in force from 3 July 2024 means **the retirement age is
// no longer 60 for anybody**, and almost every source still says 60.
//
// Corroborated across GOSI's own statements and independent summaries (Asharq,
// Okaz, Lockton, DLA Piper, Saudi Gazette) before anything was encoded.

test.use({ timezoneId: 'Asia/Riyadh' })

const load = async (page: Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/retirement-age`)
  await expect(page.getByTestId('retirement-age')).toBeVisible()
}

test('one date decides the system, and it is not age or employer', async ({ page }) => {
  await load(page)
  await page.getByTestId('ra-born').fill('1995-06-15')
  await page.getByTestId('ra-before').check()
  await expect(page.getByTestId('ra-scheme')).toHaveAttribute('data-value', 'existing')
  await page.getByTestId('ra-before').uncheck()
  await expect(page.getByTestId('ra-scheme')).toHaveAttribute('data-value', 'new')
})

test('a new entrant retires at 65, and no earlier than 55', async ({ page }) => {
  await load(page)
  await page.getByTestId('ra-born').fill('1995-06-15')
  await page.getByTestId('ra-before').uncheck()
  await expect(page.getByTestId('ra-standard')).toContainText('65')
  await expect(page.getByTestId('ra-dates')).toContainText('2060')
  // Early retirement is a floor, not a discount: ten years before, and no more.
  await expect(page.getByTestId('ra-early')).toContainText('55')
  await expect(page.getByTestId('ra-early')).toContainText('2050')
})

test('an existing contributor gets the BAND, because the ladder is not published', async ({ page }) => {
  // The refusal that matters. The 58-to-65 band and the four-month step are
  // both published; the ladder mapping an age on 3 July 2024 to a retirement
  // age is not, and inventing it would put a date on the page somebody might
  // plan a life around.
  await load(page)
  await page.getByTestId('ra-born').fill('1980-03-01')
  await page.getByTestId('ra-before').check()
  await expect(page.getByTestId('ra-standard')).toContainText('58')
  await expect(page.getByTestId('ra-standard')).toContainText('65')
  await expect(page.getByTestId('ra-dates')).toContainText('2038')
  await expect(page.getByTestId('ra-dates')).toContainText('2045')
  await expect(page.getByTestId('ra-refuses')).toContainText('not')
  // And it does NOT offer an early-retirement floor it cannot stand behind.
  await expect(page.getByTestId('ra-early')).toHaveCount(0)
})

test('the refusal is shown only where it applies', async ({ page }) => {
  // Without this the explanation could be permanent decoration, and the
  // new-system answer would look as hedged as the one that has to be.
  await load(page)
  await page.getByTestId('ra-before').uncheck()
  await expect(page.getByTestId('ra-refuses')).toHaveCount(0)
})

test('the pension is months over 480, so a year buys 2.5%', async ({ page }) => {
  // NOT `readNumber` here: it keeps `-` as a minus sign, and this line's prose
  // says "two-year", so "25.0% of your final two-year average" parses as
  // "25.0-" and comes back NaN. The helper is right for a number standing on
  // its own; a number inside a sentence needs the sentence.
  await load(page)
  await page.getByTestId('ra-months').fill('120')
  await expect(page.getByTestId('ra-share')).toContainText('25.0%')
  await page.getByTestId('ra-months').fill('480')
  await expect(page.getByTestId('ra-share')).toContainText('100.0%')
  // And it cannot promise more than the wage it is based on.
  await page.getByTestId('ra-months').fill('600')
  await expect(page.getByTestId('ra-share')).toContainText('100.0%')
})

test('it says plainly that 60 is the old rule', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('ra-not-sixty')).toContainText('60')
  await expect(page.getByTestId('ra-not-sixty')).toContainText('2024')
})

test('the dates export to a calendar, each with its own uid', async ({ page }) => {
  await load(page)
  await page.getByTestId('ra-born').fill('1995-06-15')
  await page.getByTestId('ra-before').uncheck()
  const dl = page.waitForEvent('download')
  await page.getByTestId('ra-ics').click()
  const ics = readFileSync((await (await dl).path())!, 'utf8')
  const uids = ics.match(/UID:.*/g) ?? []
  expect(uids.length).toBe(2)
  expect(new Set(uids).size).toBe(2)
  expect(ics).toContain('20600615')
})

test('it works in Arabic, with Arabic-Indic digits', async ({ page }) => {
  await load(page, 'ar')
  await page.getByTestId('ra-months').fill('120')
  const t = await page.getByTestId('ra-share').innerText()
  expect(t).toMatch(/[٠-٩]/)
  expect(t).not.toMatch(/[0-9]/)
  expect(t).toContain('٢٥')
})
