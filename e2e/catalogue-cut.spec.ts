import { test, expect } from '@playwright/test'

// November 2026: the catalogue was cut from 244 tools to 114. Every removed
// address still answers. A MERGED tool lands on the tool that now does its job,
// which is the only thing that tells a reader the capability moved rather than
// went; a WITHDRAWN tool lands on the catalogue.

const MERGED: [string, string][] = [
  ['docx-to-text', 'word-editor'], ['docx-markdown', 'word-editor'], ['markdown-docx', 'word-editor'],
  ['markdown-html', 'word-editor'], ['paste-to-markdown', 'word-editor'],
  ['csv-to-xlsx', 'excel-editor'], ['xlsx-convert', 'excel-editor'],
  ['pptx-to-text', 'powerpoint-editor'],
  ['video-trim', 'video-edit'],
  ['image-cropper', 'image-edit'], ['image-redact', 'image-edit'], ['meme-generator', 'image-edit'],
  ['image-format-converter', 'image-compressor'],
  ['pdf-to-text', 'pdf-ocr'],
  ['cron-explainer', 'cron-builder'],
  ['random-picker', 'spin-wheel'],
  ['countdown', 'stopwatch'],
  ['prayer-timetable', 'prayer-times'],
]

for (const [from, to] of MERGED) {
  test(`${from} now lives in ${to}`, async ({ page }) => {
    await page.goto(`/en/apps/${from}`)
    await expect(page).toHaveURL(new RegExp(`/en/apps/${to}/?$`))
  })
}

// One of each reason, plus the two examples that were named when the cut was
// asked for. The full list is what scripts/check-retired.mjs reads off the
// router, so it cannot shrink silently.
for (const id of ['gosi-salary', 'vat-calculator', 'due-date', 'text-counter', 'invoice-generator']) {
  test(`${id} is withdrawn, and its address lands on the catalogue`, async ({ page }) => {
    await page.goto(`/ar/apps/${id}`)
    await expect(page).toHaveURL(/\/ar\/?$/)
    await expect(page.locator('.tool-search__input')).toBeVisible()
  })
}

test('a folded category lands where its tools went', async ({ page }) => {
  await page.goto('/en/c/web/')
  await expect(page).toHaveURL(/\/en\/c\/developer\/$/)
  await page.goto('/en/c/health/')
  await expect(page).toHaveURL(/\/en\/?$/)
})

test('a withdrawn tool is gone from search', async ({ page }) => {
  await page.goto('/en')
  await page.locator('.tool-search__input').fill('gosi')
  await expect(page.locator('[data-testid="tool-gosi-salary"]')).toHaveCount(0)
})
