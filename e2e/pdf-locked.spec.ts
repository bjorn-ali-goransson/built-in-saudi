import { test, expect } from '@playwright/test'

// Every tool built on pdf-lib, driven with a real password-protected PDF and
// with a file that is not a PDF at all.
//
// Both halves matter, and each catches a bug that was really shipped. Three of
// these tools (fill, compress, edit) reported EVERY failure as "locked /
// encrypted", so a damaged file was blamed on a password it does not have.
// Three more (stamp, booklet, redact) reported every failure as unreadable, so
// a genuinely locked file got no reason and nowhere to go. A spec that only
// ever fed one kind of file would have passed against both.

const TOOLS: { id: string; pick: string; within: boolean; act?: string }[] = [
  // pdf-stamp does not open the file at pick time — it only reads it when
  // stamping, so the reason appears at the action rather than on arrival.
  { id: 'pdf-stamp', pick: 'ps-file', within: false, act: 'ps-apply' },
  { id: 'pdf-booklet', pick: 'pb-file', within: false },
  { id: 'pdf-redact', pick: 'pr-file', within: false },
  { id: 'pdf-fill', pick: 'fill-drop', within: true },
  { id: 'pdf-compress', pick: 'cmp-drop', within: true },
  { id: 'pdf-edit', pick: 'edit-drop', within: true },
  { id: 'pdf-sign', pick: 'sign-drop', within: true },
]

// Most of these put the testid on the dropzone rather than on the <input>, so
// reach in through the container instead of editing seven product files for a
// test — the same arrangement the privacy guard uses.
const input = (page: import('@playwright/test').Page, t: typeof TOOLS[number]) =>
  t.within ? page.getByTestId(t.pick).locator('input[type="file"]') : page.getByTestId(t.pick)

for (const t of TOOLS) {
  test(`${t.id}: a locked PDF is named as locked, and routed`, async ({ page }) => {
    await page.goto(`/en/apps/${t.id}`)
    await input(page, t).setInputFiles('e2e/fixtures/locked.pdf')
    if (t.act) await page.getByTestId(t.act).click()
    const note = page.getByTestId('pdf-failure')
    await expect(note).toBeVisible({ timeout: 20_000 })
    await expect(note).toHaveAttribute('data-why', 'encrypted')
    // pdf-lib cannot open it; pdf.js can, with the password the reader has.
    await expect(page.getByTestId('pdf-failure-to-text')).toBeVisible()
  })

  test(`${t.id}: a file that is not a PDF is not blamed on a password`, async ({ page }) => {
    await page.goto(`/en/apps/${t.id}`)
    await input(page, t).setInputFiles('e2e/fixtures/diff-small.png')
    if (t.act) await page.getByTestId(t.act).click()
    const note = page.getByTestId('pdf-failure')
    await expect(note).toBeVisible({ timeout: 20_000 })
    await expect(note).toHaveAttribute('data-why', 'unreadable')
    await expect(page.getByTestId('pdf-failure-to-text')).toHaveCount(0)
  })
}

test('the note reads in Arabic too', async ({ page }) => {
  await page.goto('/ar/apps/pdf-compress')
  await page.getByTestId('cmp-drop').locator('input[type="file"]').setInputFiles('e2e/fixtures/locked.pdf')
  await expect(page.getByTestId('pdf-failure')).toContainText('كلمة مرور')
  await expect(page.getByTestId('pdf-failure-to-text')).toBeVisible()
})
