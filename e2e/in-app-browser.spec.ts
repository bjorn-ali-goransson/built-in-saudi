import { test, expect } from '@playwright/test'

// Google REFUSES OAuth inside an app's embedded WebView — its stated
// `disallowed_useragent` policy, not something a caller can work around. So on
// every surface that signs in, the button is simply dead there.
//
// `lib/inAppBrowser.ts` had one caller for its whole life (`node
// evals/libreach.mjs`) while SIX surfaces call `loadGis`, so five of them said
// nothing at all. The worst was the Privacy page: exercising the right to have
// your data deleted is the one thing that must not fail silently.

/** The LinkedIn WebView's user agent, which is what `inAppBrowser` sniffs. */
const IN_APP =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LinkedInApp'

const SURFACES = [
  { path: 'apps/ats-cv-optimizer', reason: 'pdf' },
  { path: 'apps/diacritize', reason: 'signin' },
  { path: 'apps/prompt-analyzer', reason: 'signin' },
  { path: 'apps/link-shortener', reason: 'signin' },
  { path: 'privacy', reason: 'signin' },
] as const

for (const { path, reason } of SURFACES) {
  test.describe(`${path} in an in-app browser`, () => {
    test.use({ userAgent: IN_APP })

    test('says why sign-in will not work, and how to escape', async ({ page }) => {
      await page.goto(`/en/${path}`)
      const note = page.getByTestId('inapp-warn')
      await expect(note).toBeVisible()
      await expect(note).toHaveAttribute('data-reason', reason)
      // It has to name the app, or it is a generic warning nobody acts on.
      await expect(note).toContainText('LinkedIn')
      // And the escape hatch, which is the only actionable part.
      await expect(note).toContainText(/Open in browser/i)
    })
  })
}

// The to-do list is behind a sheet, because sync is opt-in and the tool is
// fully usable signed out — so the note cannot be asserted by loading the page.
test.describe('the to-do list in an in-app browser', () => {
  test.use({ userAgent: IN_APP })

  test('the note is on the sync sheet, where the sign-in is', async ({ page }) => {
    await page.goto('/en/apps/todo')
    await page.getByTestId('todo-enable-sync').click()
    await expect(page.getByTestId('todo-sync-sheet').getByTestId('inapp-warn')).toBeVisible()
  })
})

// Without this the fix could have been "always warn", which would put a
// confusing note in front of every ordinary visitor on six surfaces.
test('an ordinary browser sees nothing at all', async ({ page }) => {
  for (const { path } of SURFACES) {
    await page.goto(`/en/${path}`)
    await expect(page.getByTestId('inapp-warn')).toHaveCount(0)
  }
})

test.describe('it speaks Arabic too', () => {
  test.use({ userAgent: IN_APP })

  test('the Arabic copy is Arabic, not an untranslated fallback', async ({ page }) => {
    await page.goto('/ar/privacy')
    const note = page.getByTestId('inapp-warn')
    await expect(note).toBeVisible()
    const text = (await note.innerText()).trim()
    expect(/[؀-ۿ]/.test(text)).toBe(true)
    // The reason, in Arabic — a translation of only the escape hatch would
    // leave the interesting half in English.
    await expect(note).toContainText('جوجل')
  })
})
