import type { Page } from '@playwright/test'

/**
 * Read a number out of the UI, in either language.
 *
 * **`ar-SA` formats with Arabic-Indic digits** (`٧٩` rather than `79`), so the
 * obvious helper — strip everything that is not `[\d.]` — leaves an empty
 * string on every Arabic page and `Number('')` is **0**. An assertion like
 * `expect(await num(page, 'total')).toBeCloseTo(0)` then passes for the wrong
 * reason, and one that expects a real figure fails with a baffling "received
 * 0". Four specs had a private copy of that helper; this is the one that knows.
 */
export async function readNumber(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).innerText()
  const latin = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    // Converting the digits is not enough, and this cost a red test to learn:
    // ar-SA also uses its OWN separators — ٫ (U+066B) for the decimal point and
    // ٬ (U+066C) for thousands. Strip them as punctuation and ١٬٥٩٨٫٥ becomes
    // 15985, a number a hundred times too big that still looks like a number.
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
  return Number(latin.replace(/[^\d.-]/g, ''))
}
