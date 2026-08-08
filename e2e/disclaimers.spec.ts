import { test, expect } from '@playwright/test'

// Anything that estimates money, health, entitlements or an official deadline
// must carry a disclaimer, in both languages. Keeping this as a test rather than
// a convention is the point: a new calculator that forgets one fails the build
// instead of shipping quietly.
const NEEDS: { id: string; kind: string }[] = [
  { id: 'calorie-needs', kind: 'medical' },
  { id: 'glucose-units', kind: 'medical' },
  { id: 'water-intake', kind: 'medical' },
  { id: 'sleep-cycle', kind: 'medical' },
  { id: 'medicine-schedule', kind: 'medical' },
  { id: 'end-of-service', kind: 'legal' },
  { id: 'zakat-calculator', kind: 'religious' },
  { id: 'prayer-timetable', kind: 'religious' },
  { id: 'id-expiry', kind: 'official' },
  { id: 'passport-photo', kind: 'official' },
  { id: 'sound-meter', kind: 'official' },
  { id: 'zatca-qr', kind: 'official' },
  { id: 'quotation', kind: 'legal' },
  { id: 'gosi-salary', kind: 'financial' },
  { id: 'vat-registration', kind: 'legal' },
  { id: 'vehicle-renewal', kind: 'official' },
  { id: 'rent-rules', kind: 'legal' },
  { id: 'early-settlement', kind: 'financial' },
  { id: 'leave-overtime', kind: 'legal' },
  { id: 'exit-reentry', kind: 'official' },
  { id: 'electricity-bill', kind: 'financial' },
  // Found by scripts/check-disclaimers.mjs: each of these had a guarded twin
  // carrying the same class of caveat while it carried none.
  { id: 'prayer-times', kind: 'religious' },
  { id: 'invoice-generator', kind: 'legal' },
  { id: 'currency-converter', kind: 'financial' },
  { id: 'vat-calculator', kind: 'financial' },
]

for (const { id, kind } of NEEDS) {
  for (const locale of ['en', 'ar'] as const) {
    test(`${id} carries its ${kind} disclaimer (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/apps/${id}`)
      const note = page.getByTestId('disclaimer')
      await expect(note.first()).toBeVisible()
      await expect(note.first()).toHaveAttribute('data-kind', kind)
      // Not an empty shell: it has to actually say something.
      expect((await note.first().innerText()).trim().length).toBeGreaterThan(40)
    })
  }
}

test('the disclaimer is announced to assistive technology', async ({ page }) => {
  await page.goto('/en/apps/calorie-needs')
  await expect(page.getByTestId('disclaimer')).toHaveRole('note')
})

test('a medical disclaimer says not to change a dose on it', async ({ page }) => {
  await page.goto('/en/apps/calorie-needs')
  await expect(page.getByTestId('disclaimer')).toContainText('never use it to change a dose')
})

test('the Arabic copy is Arabic, not an untranslated fallback', async ({ page }) => {
  await page.goto('/ar/apps/zakat-calculator')
  const text = await page.getByTestId('disclaimer').innerText()
  expect(/[؀-ۿ]/.test(text)).toBe(true)
  expect(text).toContain('فتوى')
})
