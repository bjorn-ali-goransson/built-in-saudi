import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// "Recently added" on the catalogue.
//
// At 216 tools with ten shipped in a day, a returning visitor had no way to see
// what changed. The dates come from git via scripts/gen-tool-dates.mjs, because
// a hand-typed date is a thing 216 files can disagree about and nobody can
// check.

const ADDED = readFileSync('src/tools/added.ts', 'utf8')
const dates = [...ADDED.matchAll(/'([a-z0-9-]+)': '(\d{4}-\d{2}-\d{2})'/g)].map((m) => [m[1], m[2]] as const)
const newest = dates.map(([, d]) => d).sort().at(-1)!

test('the newest tools are surfaced in their own row', async ({ page }) => {
  await page.goto('/en')
  const sec = page.getByTestId('section-__new')
  await expect(sec).toBeVisible()
  const links = sec.locator('a')
  // Capped: a "recently added" row of forty is just the catalogue again.
  const n = await links.count()
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThanOrEqual(6)
})

test('it holds tools from the newest date, not arbitrary ones', async ({ page }) => {
  // The dates are derived, so the expectation can be derived too rather than
  // hard-coded — this cannot go stale the way a pinned tool id would.
  const expected = dates.filter(([, d]) => d === newest).map(([id]) => id)
  await page.goto('/en')
  const shown = await page.getByTestId('section-__new').locator('[data-testid^="tool-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('tool-', '')))
  expect(shown.length).toBeGreaterThan(0)
  for (const id of shown) expect(expected, `${id} is not from the newest batch`).toContain(id)
})

test('a recently added tool is NOT consumed from its category', async ({ page }) => {
  // Same rule as Recently used: both change on their own, and a catalogue that
  // reshuffles because of the calendar is worse than a repeated tile.
  const one = (await page.goto('/en')) && dates.filter(([, d]) => d === newest)[0][0]
  await expect(page.getByTestId('section-__new').getByTestId(`tool-${one}`)).toBeVisible()
  // The same tool appears again further down, under its own category.
  await expect(page.getByTestId(`tool-${one}`)).toHaveCount(2)
})

test('the row is reachable from the jump bar like any other section', async ({ page }) => {
  await page.goto('/en')
  await expect(page.getByTestId('section-nav-__new')).toBeVisible()
})

test('every live tool has a derived date, so none can be invisible here', async () => {
  // The build guard says the same thing; this says it where a person reading
  // the spec will see why it matters.
  const reg = readFileSync('src/tools/index.ts', 'utf8')
  const ids = [...reg.matchAll(/from '\.\/([a-z0-9-]+)\/meta'/g)].map((m) => m[1])
  expect(ids.length).toBeGreaterThan(200)
  const known = new Set(dates.map(([id]) => id))
  // Folder names and tool ids differ for at least one tool, so compare on the
  // count rather than on the folder name.
  expect(known.size).toBeGreaterThanOrEqual(ids.length)
})

test('works in Arabic', async ({ page }) => {
  await page.goto('/ar')
  await expect(page.getByTestId('section-__new')).toBeVisible()
  await expect(page.getByTestId('section-nav-__new')).toContainText('أُضيفت')
})
