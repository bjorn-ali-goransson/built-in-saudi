import { test, expect } from '@playwright/test'
import { MockApi, ok, serverError, stubGoogleSignIn } from './support/mockApi'

// Smoke: the tool validates client-side before any sign-in / backend call.
test('prompt analyzer renders and rejects a too-short prompt', async ({ page }) => {
  await page.goto('/en/apps/prompt-analyzer')
  await expect(page.getByTestId('prompt-analyzer')).toBeVisible()
  await expect(page.getByTestId('pa-input')).toBeVisible()

  await page.getByTestId('pa-input').fill('too short')
  await page.getByTestId('pa-run').click()
  await expect(page.getByTestId('pa-err')).toContainText('longer')
})

const SCORES = {
  purpose_coherence: 4, context_instruction_harmony: 3, even_signal: 2, calm_tone: 4,
  non_contradictory: 5, positive_framing: 3, escape_hatch: 2, stakes_clarity: 4,
}
const ANALYSIS = {
  ok: true, scores: SCORES,
  issues: [{ headline: 'Shouting in caps', description: 'Several ALL-CAPS commands; soften them.' }],
  gaps: [{ id: 'purpose', question: 'What is the true purpose?', why: 'sharpens focus' }],
  summary: 'A solid prompt with a couple of spiky spots.',
}

test('prompt analyzer: analyse then rewrite (mocked backend + sign-in)', async ({ page }) => {
  const api = new MockApi(page)
  await stubGoogleSignIn(page)
  await api.on('**/analyze-prompt', ok(ANALYSIS))
  await api.on('**/improve-prompt', ok({ ok: true, improved: 'A calmer, clearer rewritten prompt.', notes: 'Removed the ALL-CAPS.' }))

  await page.goto('/en/apps/prompt-analyzer')
  await page.getByTestId('pa-input').fill('You are a helpful assistant. ALWAYS do X. NEVER do Y. Be concise and helpful.')
  await page.getByTestId('pa-run').click() // signs in on demand, then analyses

  await expect(page.getByTestId('pa-result')).toBeVisible()
  await expect(page.getByTestId('pa-result')).toContainText('Shouting in caps')

  // Second pass: fill the gap and rewrite.
  await page.getByTestId('pa-suggest').click()
  await page.getByTestId('pa-gap-purpose').fill('To triage support tickets.')
  await page.getByTestId('pa-generate').click()
  await expect(page.getByTestId('pa-improved-text')).toContainText('rewritten prompt')

  api.expectCalled('**/analyze-prompt', 1)
  api.expectCalled('**/improve-prompt', 1)
})

test('prompt analyzer: a backend error is surfaced, not swallowed', async ({ page }) => {
  const api = new MockApi(page)
  await stubGoogleSignIn(page)
  await api.on('**/analyze-prompt', serverError())

  await page.goto('/en/apps/prompt-analyzer')
  await page.getByTestId('pa-input').fill('You are a helpful assistant that does a great many useful things.')
  await page.getByTestId('pa-run').click()

  await expect(page.getByTestId('pa-err')).toBeVisible()
  await expect(page.getByTestId('pa-result')).toHaveCount(0)
})
