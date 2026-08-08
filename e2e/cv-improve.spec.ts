import { test, expect } from '@playwright/test'
import { MockApi, ok, stubGoogleSignIn } from './support/mockApi'

// The CV optimizer's generate → review → improve flow, against a mocked backend.
//
// It existed because of a gap this suite could not otherwise close. The improve
// pass returns only the CHANGED sections as a `patch`, and both sides merge it
// section-level — so an empty section in a patch would REPLACE a real one.
// `evals/patchcheck.mjs` proves the server drops empties; the mirrored guard in
// `src/lib/cvApi.ts` had nothing exercising it at all, and it is the half that
// matters when a rollback pairs a new client with an old server (Pages and the
// functions ship through different workflows).
//
// A mock is the only honest way to test this: the real endpoint costs an OpenAI
// call, is rate-limited to 2 per day per user, and would make the assertion
// depend on what a model happened to return.

// Exactly the shape `normalize()` guarantees on the server — the client is
// entitled to assume it, so a mock that invents a near-miss is testing nothing.
// Two fields are easy to get wrong and both crashed the renderer outright while
// this was being written: `skills[].items` is a comma-joined STRING, not an
// array, and experience uses `company` + `startDate`/`endDate` rather than an
// employer and a period.
const CV = {
  name: 'Sara Al-Otaibi',
  role: 'Data Engineer',
  contact: { email: 'sara@example.com', phone: '0501234567', location: 'Riyadh, Saudi Arabia', links: [] },
  summary: 'Nine years building **data pipelines**.',
  skills: [{ id: 'skills-1', category: 'Data', items: 'Python, Airflow, dbt' }],
  experience: [
    { id: 'experience-1', role: 'Senior Data Engineer', company: 'Aramco', startDate: 'Jan 2021', endDate: 'Present', bullets: ['Cut ETL runtime by **40%**'] },
    { id: 'experience-2', role: 'Data Engineer', company: 'STC', startDate: 'Jan 2018', endDate: 'Dec 2020', bullets: ['Built the ingest layer'] },
  ],
  projects: [], talks: [], certifications: [], publications: [],
  education: [{ id: 'education-1', degree: 'BSc Computer Science', institution: 'King Saud University', year: '2018' }],
  languages: [{ id: 'languages-1', name: 'Arabic', level: 'Native' }],
}

const UPLOAD = [
  'Sara Al-Otaibi — Data Engineer — Riyadh, Saudi Arabia',
  'sara@example.com | 0501234567',
  '',
  'SUMMARY',
  'Data engineer with nine years of experience building and operating batch and streaming',
  'pipelines for large organisations, working mostly in Python, Airflow and dbt on AWS.',
  '',
  'EXPERIENCE',
  'Senior Data Engineer, Aramco — 2021 to Present',
  '- Rebuilt the nightly ETL and cut its runtime by 40 percent.',
  '- Led the migration of the reporting warehouse onto a managed platform.',
  '- Mentored two junior engineers through their first year.',
  'Data Engineer, STC — 2018 to 2021',
  '- Built the ingest layer that fed the customer analytics platform.',
  '- Introduced testing to a codebase that had none.',
  '',
  'EDUCATION',
  'BSc Computer Science, King Saud University — 2014 to 2018',
  '',
  'SKILLS',
  'Python, SQL, Airflow, dbt, Spark, AWS, Kafka, Terraform, Docker',
].join('\n')

const ATS = { keywords: 4, impact: 3, clarity: 4, format: 4, completeness: 4, conciseness: 4 }
const ATS_BEFORE = { keywords: 3, impact: 2, clarity: 3, format: 3, completeness: 3, conciseness: 3 }

const GENERATE = {
  ok: true,
  cv: CV,
  ats: ATS,
  atsBefore: ATS_BEFORE,
  issues: [{ title: 'Few numbers in your bullets', detail: 'Only one bullet carries a figure.', severity: 'high' }],
  gaps: [{ id: 'exp2-number', question: 'What did the ingest layer handle, in numbers?', why: 'impact', expects: 'text', targets: ['experience-2'] }],
  summary: 'A solid CV that under-sells its results.',
  polishLeft: 2,
  improveLeft: 2,
}

async function generate(page: import('@playwright/test').Page, api: MockApi) {
  await stubGoogleSignIn(page)
  await api.on('**/cv-generate', ok(GENERATE))
  await page.goto('/en/apps/ats-cv-optimizer')
  // Long enough to clear the tool's own "couldn't read enough text" gate — it
  // refuses a near-empty extraction rather than sending it off to be rewritten,
  // which is right, and was the first thing this spec tripped over.
  await page.getByTestId('cv-file').setInputFiles({
    name: 'sara.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(UPLOAD),
  })
  await page.getByTestId('cv-generate-cta').click()
  await expect(page.getByTestId('cv-review')).toBeVisible({ timeout: 20000 })
}

test('the review shows the before/after scores and the questions', async ({ page }) => {
  const api = new MockApi(page)
  await generate(page, api)
  await expect(page.getByTestId('cv-ats-radar')).toBeVisible()
  // The original CV is overlaid as a dashed outline, which is the whole point
  // of scoring the upload separately.
  await expect(page.getByTestId('cv-ats-radar-before')).toBeVisible()
  await expect(page.getByTestId('cv-issue')).toContainText('Few numbers')
  await expect(page.getByTestId('cv-questions')).toContainText('in numbers')
})

// The patch-merge guard itself is checked by `node evals/patchcheck.mjs`, not
// here. It was attempted here first and could not be asserted: the CV preview is
// a react-pdf canvas, so no text assertion reaches it, and downloading and
// re-extracting a PDF to prove a four-line merge would be a worse test than the
// harness. The merge lives in `src/lib/cvPatch.ts` precisely so a node harness
// can exercise the REAL function on both sides of the wire.

test('the improve budget is spent, and says so when it runs out', async ({ page }) => {
  const api = new MockApi(page)
  await generate(page, api)
  await api.on('**/cv-refine', ok({
    ok: true,
    patch: { summary: 'Tightened.' },
    ats: ATS, issues: [], summary: 'Improved.', polishLeft: 2, improveLeft: 0,
    gaps: [{ id: 'more', question: 'Anything else?', why: 'impact', expects: 'text', targets: [] }],
  }))
  await page.getByTestId('cv-gap-exp2-number').fill('Around 4 TB a day.')
  await page.getByTestId('cv-improve').click()
  // With no improves left the form is withdrawn rather than left to fail.
  await expect(page.getByTestId('cv-no-improve')).toBeVisible({ timeout: 20000 })
})
