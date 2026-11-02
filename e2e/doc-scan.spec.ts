import { test, expect, type Page } from '@playwright/test'

// Photo to Scan.
//
// Found by sweeping what people download APPS for rather than what they search
// the web for — a different source, and it points at device capabilities this
// site barely uses. Document scanning is one of the biggest free-app categories
// and the web versions mostly upload.
//
// The maths was verified separately before any of this: `homography()` maps a
// known quadrilateral's four corners exactly onto the rectangle, and returns
// null for a degenerate one. That check found a real bug — `row[i][i]` indexes
// into a number — which the typechecker caught before it could render noise.

/** A photo-like page: mid-grey "paper" with darker "ink", so the clean-up has
 *  something to do and the size claim is measurable. */
async function pagePhoto(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 900; c.height = 1200
    const ctx = c.getContext('2d')!
    // A gradient across the paper is exactly what a room light does, and it is
    // why a photograph of a page does not compress like a scan.
    const g = ctx.createLinearGradient(0, 0, 900, 1200)
    g.addColorStop(0, '#b8b3a8')
    g.addColorStop(1, '#8e8a80')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 900, 1200)
    ctx.fillStyle = '#3a3833'
    for (let i = 0; i < 30; i++) ctx.fillRect(80, 100 + i * 34, 500 + (i % 5) * 40, 12)
    // SENSOR NOISE. The first version of this fixture was a smooth gradient and
    // compressed to 39KB — smaller than the cleaned output — so it refuted the
    // tool's own claim. What makes a real phone photo of a page several
    // megabytes is grain: a photographic codec cannot predict it, so it stores
    // it, and flattening the paper to white is what throws it away. A fixture
    // that leaves the noise out is missing the property under test.
    const img = ctx.getImageData(0, 0, 900, 1200)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 46
      d[i] += n; d[i + 1] += n; d[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.92)!)
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (const b of buf) s += String.fromCharCode(b)
    return btoa(s)
  })
}

// Photo to Scan lives in the image editor now (November 2026): its old
// address opens the editor on the four corners, the result REPLACES the photo,
// and the size claim is read off the editor's own estimate — an actual encode.

const load = async (page: Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/doc-scan`)
  await expect(page).toHaveURL(new RegExp(`/${locale}/apps/image-edit\\?mode=scan$`))
  const b64 = await pagePhoto(page)
  await page.getByTestId('ie-file').setInputFiles({
    name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64'),
  })
  await expect(page.getByTestId('ie-page-bar')).toBeVisible({ timeout: 30_000 })
  for (const k of ['tl', 'tr', 'br', 'bl']) await expect(page.getByTestId(`ie-corner-${k}`)).toBeVisible()
}

/** Straighten, then read what the export would weigh from the settings. */
async function straightenAndWeigh(page: Page): Promise<number> {
  await page.getByTestId('ie-page-apply').click()
  await expect(page.getByTestId('ie-page-bar')).toHaveCount(0, { timeout: 30_000 })
  await page.getByTestId('ie-settings').click()
  const est = page.getByTestId('ie-estimate')
  let n = 0
  await expect.poll(async () => { n = Number(await est.getAttribute('data-bytes') || 0); return n > 0 }, { timeout: 30_000 }).toBe(true)
  return n
}

test('a scan visit lands on the corners, and straightening maps them onto a rectangle', async ({ page }) => {
  await load(page)
  await page.getByTestId('ie-page-apply').click()
  await expect(page.getByTestId('ie-page-bar')).toHaveCount(0, { timeout: 30_000 })
  // The default corners are inset by a tenth of a 900×1200 photo, so the
  // page that comes out is 720×960 — the quadrilateral's own size.
  await page.getByTestId('ie-settings').click()
  await expect(page.getByTestId('ie-out-size')).toHaveText('720×960')
  // And it can be taken back to the photo as it was.
  await page.getByTestId('ie-page-undo').click()
  await expect(page.getByTestId('ie-out-size')).toHaveText('900×1200')
})

test('the cleaned page is a fraction of the size of the photo', async ({ page }) => {
  // The measured claim the tool is built on: a phone photo of a document is
  // large because the paper is not white, not because of detail.
  await load(page)
  await straightenAndWeigh(page)
  await expect(page.getByTestId('ie-estimate')).toContainText('smaller')
})

test('and turning the clean-up off gives that saving back', async ({ page }) => {
  // Without this, the case above would pass against a tool that simply
  // re-encoded everything smaller — the saving has to come from the clean-up.
  await load(page)
  const cleaned = await straightenAndWeigh(page)
  await page.getByTestId('ie-page-undo').click()
  await page.getByTestId('ie-page').click()
  await page.getByTestId('ie-clean').fill('0')
  const raw = await straightenAndWeigh(page)
  expect(raw).toBeGreaterThan(cleaned)
})

test('a corner can be moved with the keyboard, which is what makes it checkable', async ({ page }) => {
  // Automatic edge detection is what makes a scanner app feel magic and what
  // makes it fail silently on a patterned tablecloth. Four handles you can see
  // — and reach without a mouse — cannot be wrong without you seeing it.
  await load(page)
  const before = await page.getByTestId('ie-corner-tl').boundingBox()
  await page.getByTestId('ie-corner-tl').focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  const after = await page.getByTestId('ie-corner-tl').boundingBox()
  expect(after!.x).toBeGreaterThan(before!.x)
})

test('corners that make no shape are refused rather than rendered as noise', async ({ page }) => {
  // A degenerate quadrilateral has no transform. Dividing by zero and drawing
  // the result is the alternative.
  await load(page)
  // A SLIVER, not a line: the top corners on the top edge and the bottom ones
  // a hundredth below. Exactly collinear corners the solver refuses by itself;
  // a sliver it would happily warp into a page a dozen pixels high.
  for (const [k, n] of [['tl', 20], ['tr', 20], ['br', 89], ['bl', 89]] as const) {
    await page.getByTestId(`ie-corner-${k}`).focus()
    for (let i = 0; i < n; i++) await page.keyboard.press('ArrowUp')
  }
  await page.getByTestId('ie-page-apply').click()
  await expect(page.getByTestId('ie-page-error')).toBeVisible({ timeout: 30_000 })
  // Still placing corners: nothing was replaced with a picture of nothing.
  await expect(page.getByTestId('ie-page-bar')).toBeVisible()
})

test('it works in Arabic', async ({ page }) => {
  await load(page, 'ar')
  await straightenAndWeigh(page)
  await expect(page.getByTestId('ie-estimate')).toContainText('أصغر')
})
