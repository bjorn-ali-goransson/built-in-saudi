import { test, expect } from '@playwright/test'
import { MockApi, ok, serverError, stubGoogleSignIn } from './support/mockApi'

// A CV shaped like the backend's normalized output, enough for the renderer.
const CV = {
  name: 'Sara Ahmed', role: 'Backend Engineer', available: '',
  contact: { location: 'Riyadh, Saudi Arabia', phone: '', email: 'sara@example.com', links: [] },
  summary: 'Backend engineer with **8 years** building services.',
  skills: [{ id: 'skill-lang', category: 'Languages', items: 'Java, SQL' }],
  experience: [{ id: 'exp-acme', role: 'Engineer', company: 'Acme', location: '', startDate: 'Jan 2019', endDate: 'Present', bullets: ['Cut infra costs'] }],
  projects: [], talks: [], certifications: [], publications: [],
  education: [{ id: 'edu-ksu', degree: 'BSc CS', institution: 'KSU', year: '2016' }], languages: [],
}
const GEN = {
  ok: true, cv: CV,
  issues: [{ title: 'Unexplained employment gap', detail: 'A gap in 2025 with no detail.', severity: 'high' }],
  ats: { keywords: 2, impact: 2, clarity: 4, format: 4, completeness: 3, conciseness: 3 },
  atsBefore: { keywords: 1, impact: 1, clarity: 3, format: 2, completeness: 2, conciseness: 2 },
  gaps: [
    { id: 'costs', question: 'By what % did you cut costs?', why: 'adds impact', expects: 'percent', targets: ['exp-acme'] },
    { id: 'stack', question: 'What is your core stack?', why: 'adds keywords', expects: 'text', targets: ['skills'] },
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

// Upload a text CV (skips real PDF parsing) → sign in → auto-generate.
async function uploadAndSignIn(page: import('@playwright/test').Page) {
  await page.getByTestId('cv-file').setInputFiles({
    name: 'cv.txt', mimeType: 'text/plain',
    buffer: Buffer.from('Sara Ahmed — Backend Engineer. Eight years building Java services at Acme. Cut infra costs. BSc CS, KSU 2016.'),
  })
  await page.getByTestId('cv-generate-cta').click()
}

test('ats review: score, percent stepper, issue CTA and the improve pass (mocked)', async ({ page }) => {
  const api = new MockApi(page)
  await stubGoogleSignIn(page)
  await api.on('**/cv-generate', ok(GEN))
  await api.on('**/cv-refine', ok(IMPROVED))

  await page.goto('/en/apps/ats-cv-optimizer')
  await uploadAndSignIn(page)

  // The review opens automatically over the result.
  const review = page.getByTestId('cv-review')
  await expect(review).toBeVisible()
  await expect(page.getByTestId('cv-ats-radar')).toBeVisible()
  await expect(page.getByTestId('cv-ats-overall')).toHaveText('3') // (2+2+4+4+3+3)/6
  // Before → after: the original scored lower and the delta is shown.
  await expect(page.getByTestId('cv-ats-before')).toHaveText('1.8') // (1+1+3+2+2+2)/6
  await expect(page.getByTestId('cv-ats-delta')).toContainText('1.2')
  await expect(page.getByTestId('cv-ats-radar-before')).toBeAttached()

  // An issue links to the questions via a CTA.
  await expect(page.getByTestId('cv-issue-fix').first()).toBeVisible()

  // The percentage gap is a stepper: empty by default, first "+" starts at 5.
  const pct = page.getByTestId('cv-gap-costs')
  await expect(pct).toHaveValue('')
  await review.getByRole('button', { name: 'increase' }).click()
  await expect(pct).toHaveValue('5')
  await pct.fill('15')
  await page.getByTestId('cv-gap-stack').fill('Java, Spring, Kafka')

  // Improve re-scores the radar and merges the returned patch.
  await page.getByTestId('cv-improve').click()
  await expect(page.getByTestId('cv-ats-overall')).toHaveText('4')
  await expect(page.getByTestId('cv-change-note')).toContainText('cost cut')

  // The report export is available.
  await expect(page.getByTestId('cv-report')).toBeVisible()

  // Generate ran once (the auto-generate guard) and improve once.
  api.expectCalled('**/cv-generate', 1)
  api.expectCalled('**/cv-refine', 1)
})

test('ats optimizer: a backend error does not crash or retry-storm', async ({ page }) => {
  const api = new MockApi(page)
  await stubGoogleSignIn(page)
  await api.on('**/cv-generate', serverError())

  await page.goto('/en/apps/ats-cv-optimizer')
  await uploadAndSignIn(page)

  // The failed generation is attempted exactly once (the autoTried guard stops a
  // failed attempt from re-firing and hammering the API), and never reaches the
  // review. The tool stays mounted and usable.
  await expect.poll(() => api.calls('**/cv-generate')).toBe(1)
  await expect(page.getByTestId('ats-cv-optimizer')).toBeAttached()
  await expect(page.getByTestId('cv-review')).toHaveCount(0)
  // The error is SHOWN (not hidden behind the blurred loading overlay) with a way
  // out — the screen isn't locked.
  await expect(page.getByTestId('cv-error')).toBeVisible()
  await expect(page.getByTestId('cv-loading')).toHaveCount(0)
  await expect(page.getByTestId('cv-start-over')).toBeVisible()
  // The autoTried guard means the failed attempt never re-fires.
  api.expectCalled('**/cv-generate', 1)
})

test('a new deploy is offered (not forced) while a CV is uploaded', async ({ page }) => {
  let build = '1' // matches nothing newer → no update on load
  let loads = 0
  page.on('load', () => loads++)
  await page.route('**/version.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ build, notes: 'fresh' }) }))
  await page.goto('/en/apps/ats-cv-optimizer')

  // Upload a CV → the tool holds work (setWorkInProgress).
  await page.getByTestId('cv-file').setInputFiles({
    name: 'cv.txt', mimeType: 'text/plain',
    buffer: Buffer.from('Sara Ahmed — Backend Engineer with eight years at Acme building Java services and cutting costs.'),
  })
  await expect(page.getByTestId('cv-generate-cta')).toBeVisible() // reached the "ready" state

  const before = loads
  build = '99999999999999' // a newer deploy appears; returning to the tab checks
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

  // It OFFERS the update in the docked bar and does NOT reload over the CV.
  await expect(page.getByTestId('update-offered')).toBeVisible()
  expect(loads).toBe(before)
})

// Smoke test: the tool renders its upload hero client-side.
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
