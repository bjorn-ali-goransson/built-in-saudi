import { test, expect } from '@playwright/test'

async function paste(page: import('@playwright/test').Page, html: string, locale = 'en') {
  await page.goto(`/${locale}/apps/a11y-check`)
  await expect(page.getByTestId('a11y-check')).toBeVisible()
  await page.getByTestId('a11y-input').fill(html)
}

test.describe('accessibility checker', () => {
  test('a missing alt and an empty alt are different things', async ({ page }) => {
    // The distinction that matters most and is easiest to get wrong: alt="" is
    // how you say "decorative, skip me", and a MISSING alt is how a screen
    // reader ends up reading a file name aloud.
    await paste(page, '<img src="a.png"><img src="b.png" alt="">')
    await expect(page.getByTestId('a11y-issue-img-no-alt')).toHaveCount(1)
    await expect(page.getByTestId('a11y-count')).toHaveText('1 problem')
  })

  test('alt text that is only the file name is caught', async ({ page }) => {
    await paste(page, '<img src="x.png" alt="logo.png"><img src="y.png" alt="image1">')
    await expect(page.getByTestId('a11y-issue-img-filename-alt')).toBeVisible()
    await expect(page.getByTestId('a11y-issue-img-weak-alt')).toBeVisible()
  })

  test('a skipped heading level is reported with both levels', async ({ page }) => {
    await paste(page, '<h1>Title</h1><h2>Section</h2><h4>Deep</h4>')
    await expect(page.getByTestId('a11y-issue-heading-skip')).toContainText('h2 to h4')
  })

  test('a placeholder is not a label', async ({ page }) => {
    await paste(page, '<input type="email" placeholder="Email">')
    await expect(page.getByTestId('a11y-issue-input-no-label')).toBeVisible()
    // ...and a real label clears it, by either route.
    await paste(page, '<label for="e">Email</label><input id="e" type="email">')
    await expect(page.getByTestId('a11y-issue-input-no-label')).toHaveCount(0)
    await paste(page, '<label>Email <input type="email"></label>')
    await expect(page.getByTestId('a11y-issue-input-no-label')).toHaveCount(0)
  })

  test('vague link text is caught but real link text is not', async ({ page }) => {
    await paste(page, '<a href="/a">click here</a><a href="/b">Download the 2026 timetable</a>')
    await expect(page.getByTestId('a11y-issue-link-vague')).toHaveCount(1)
  })

  test('an icon-only button needs a name, and an aria-label gives it one', async ({ page }) => {
    await paste(page, '<button><svg></svg></button>')
    await expect(page.getByTestId('a11y-issue-button-no-name')).toBeVisible()
    await paste(page, '<button aria-label="Close"><svg></svg></button>')
    await expect(page.getByTestId('a11y-issue-button-no-name')).toHaveCount(0)
  })

  test('duplicate ids and positive tabindex are reported', async ({ page }) => {
    await paste(page, '<div id="x"></div><div id="x"></div><a href="/" tabindex="3">Home</a>')
    await expect(page.getByTestId('a11y-issue-duplicate-id')).toBeVisible()
    await expect(page.getByTestId('a11y-issue-positive-tabindex')).toBeVisible()
  })

  test('clean markup says so WITHOUT calling it accessible', async ({ page }) => {
    // The honest bit. A tool that only looked at half the problem must not
    // hand out a pass for the whole of it.
    await paste(page, '<h1>Title</h1><p>Some prose with a <a href="/x">link to the timetable</a>.</p>')
    await expect(page.getByTestId('a11y-none')).toContainText('not the same as accessible')
    await expect(page.getByTestId('a11y-cannot')).toContainText('MEANINGFUL')
  })

  test('it works in Arabic', async ({ page }) => {
    await paste(page, '<img src="a.png">', 'ar')
    await expect(page.getByTestId('a11y-cannot')).toContainText('النص البديل')
  })
})
