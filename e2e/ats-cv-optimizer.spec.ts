import { test, expect } from '@playwright/test'

// A CV shaped like the backend's normalized output, enough for the renderer.
const CV = {
  name: 'Sara Ahmed', role: 'Backend Engineer', available: '',
  contact: { location: 'Riyadh, Saudi Arabia', phone: '', email: 'sara@example.com', links: [] },
  summary: 'Backend engineer with **8 years** building services.',
  skills: [{ category: 'Languages', items: 'Java, SQL' }],
  experience: [{ role: 'Engineer', company: 'Acme', location: '', startYear: '2019', endYear: 'Present', bullets: ['Cut infra costs'] }],
  projects: [], talks: [], certifications: [], publications: [],
  education: [{ degree: 'BSc CS', institution: 'KSU', year: '2016' }], languages: [],
}
const GEN = {
  ok: true, cv: CV,
  issues: [{ title: 'Unexplained employment gap', detail: 'A gap in 2025 with no detail.', severity: 'high' }],
  ats: { keywords: 2, impact: 2, clarity: 4, format: 4, completeness: 3, conciseness: 3 },
  gaps: [
    { id: 'costs', question: 'By what % did you cut costs?', why: 'adds impact', expects: 'percent' },
    { id: 'stack', question: 'What is your core stack?', why: 'adds keywords', expects: 'text' },
  ],
  polishLeft: 1, improveLeft: 2,
}
// Improve returns only the CHANGED sections as a patch (merged client-side).
const IMPROVED = {
  ok: true,
  patch: { summary: 'Backend engineer with **8 years** who cut infra costs **15%**.' },
  issues: [],
  ats: { keywords: 4, impact: 4, clarity: 4, format: 4, completeness: 4, conciseness: 4 },
  gaps: [], summary: 'Folded in your 15% cost cut and core stack.', polishLeft: 1, improveLeft: 1,
}

// Stub Google Identity Services + the backend so Playwright can drive the whole
// signed-in flow (sign-in, generate, the ATS review, the improve pass) without
// hitting Google or OpenAI.
async function mockCvBackend(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const id = {
      _cb: null as null | ((r: { credential: string }) => void),
      initialize(cfg: { callback: (r: { credential: string }) => void }) { this._cb = cfg && cfg.callback },
      renderButton() { /* not needed — One-Tap path is used */ },
      disableAutoSelect() {},
      prompt() { this._cb?.({ credential: 'test.jwt.token' }) },
    }
    ;(window as unknown as { google: unknown }).google = { accounts: { id } }
  })
  await page.route('**/cv-generate', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GEN) }))
  await page.route('**/cv-refine', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(IMPROVED) }))
}

test('ats review: score, percent stepper, issue CTA and the improve pass (mocked)', async ({ page }) => {
  await mockCvBackend(page)
  await page.goto('/en/apps/ats-cv-optimizer')

  // Upload a text CV (skips real PDF parsing) → sign in → auto-generate.
  await page.getByTestId('cv-file').setInputFiles({
    name: 'cv.txt', mimeType: 'text/plain',
    buffer: Buffer.from('Sara Ahmed — Backend Engineer. Eight years building Java services at Acme. Cut infra costs. BSc CS, KSU 2016.'),
  })
  await page.getByTestId('cv-generate-cta').click()

  // The review opens automatically over the result.
  const review = page.getByTestId('cv-review')
  await expect(review).toBeVisible()
  await expect(page.getByTestId('cv-ats-radar')).toBeVisible()
  await expect(page.getByTestId('cv-ats-overall')).toHaveText('3') // (2+2+4+4+3+3)/6

  // An issue links to the questions via a CTA.
  await expect(page.getByTestId('cv-issue-fix').first()).toBeVisible()

  // The percentage gap is a stepper: empty by default, first "+" starts at 5.
  const pct = page.getByTestId('cv-gap-costs')
  await expect(pct).toHaveValue('')
  await review.getByRole('button', { name: 'increase' }).click()
  await expect(pct).toHaveValue('5')
  await pct.fill('15')
  await page.getByTestId('cv-gap-stack').fill('Java, Spring, Kafka')

  // Improve re-scores the radar.
  await page.getByTestId('cv-improve').click()
  await expect(page.getByTestId('cv-ats-overall')).toHaveText('4')
  await expect(page.getByTestId('cv-change-note')).toContainText('cost cut')

  // The report export is available.
  await expect(page.getByTestId('cv-report')).toBeVisible()
})

// Smoke test: the tool renders its upload hero client-side. The AI rebuild, the
// ATS score radar and the follow-up questions all need Google auth + the live
// function, so they're out of scope for e2e (same stance as the Prompt Analyzer).
test('ats cv optimizer renders the upload hero', async ({ page }) => {
  await page.goto('/en/apps/ats-cv-optimizer')
  await expect(page.getByTestId('ats-cv-optimizer')).toBeVisible()
  await expect(page.getByText('Optimize your CV')).toBeVisible()
  await expect(page.getByTestId('cv-file')).toBeAttached()
})

// The old /apps/cv-generator URL redirects to the new id.
test('old cv-generator URL redirects to ats-cv-optimizer', async ({ page }) => {
  await page.goto('/en/apps/cv-generator')
  await expect(page).toHaveURL(/\/en\/apps\/ats-cv-optimizer$/)
  await expect(page.getByTestId('ats-cv-optimizer')).toBeVisible()
})
