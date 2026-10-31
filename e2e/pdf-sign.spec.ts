import { test, expect } from '@playwright/test'
import { PDFDocument, PDFName, PDFRawStream, rgb } from 'pdf-lib'
import { readFileSync } from 'node:fs'

test('signature exports with transparency (SMask) so it sits on any background', async ({ page }) => {
  // a page with a solid CYAN background — a white-boxed signature would be obvious
  const doc = await PDFDocument.create()
  const pg = doc.addPage([300, 300])
  pg.drawRectangle({ x: 0, y: 0, width: 300, height: 300, color: rgb(0, 0.7, 0.9) })
  const original = Buffer.from(await doc.save())

  await page.goto('/en/tools/pdf-sign')

  // draw a stroke on the signature pad
  const pad = page.getByTestId('sign-pad')
  const box = (await pad.boundingBox())!
  await page.mouse.move(box.x + 20, box.y + box.height * 0.4)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.7)
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.35)
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.6)
  await page.mouse.up()

  // upload the coloured PDF, place the signature, export
  await page.locator('input[type=file]').setInputFiles({ name: 'bg.pdf', mimeType: 'application/pdf', buffer: original })
  const add = page.getByTestId('sign-add')
  await expect(add).toBeEnabled({ timeout: 15_000 })
  await add.click()
  await page.getByTestId('sign-export').click()
  const dl = page.waitForEvent('download')
  await page.getByTestId('sign-download').click()
  const bytes = new Uint8Array(readFileSync(await (await dl).path()))

  // the placed signature must be an image XObject carrying an SMask (alpha)
  const out = await PDFDocument.load(bytes)
  const res = out.getPage(0).node.Resources()!
  const xobj = res.lookup(PDFName.of('XObject')) as { entries(): [PDFName, unknown][] }
  let hasImage = false, hasSMask = false
  for (const [, ref] of xobj.entries()) {
    const st = out.context.lookup(ref)
    if (!(st instanceof PDFRawStream)) continue
    if (st.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') {
      hasImage = true
      if (st.dict.has(PDFName.of('SMask'))) hasSMask = true
    }
  }
  expect(hasImage).toBe(true)
  expect(hasSMask).toBe(true) // transparent → composites over the cyan, no white box
})

// Sign PDF and Fill PDF Form became modes of Edit PDF in November 2026. The PDF
// picked in one mode is handed to the next, so switching never asks again.
test('switching from signing to filling keeps the same PDF open', async ({ page }) => {
  await page.goto('/en/apps/pdf-sign')
  await expect(page).toHaveURL(/\/en\/apps\/pdf-edit\?mode=sign$/)
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.addPage([300, 300])
  await page.getByTestId('sign-drop').locator('input[type="file"]')
    .setInputFiles({ name: 'contract.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) })
  await expect(page.locator('[data-testid="pdf-sign"] img').first()).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('pe-mode-fill').click()
  // No picker in the fill mode: it opened the same file.
  await expect(page.getByTestId('fill-drop')).toHaveCount(0, { timeout: 30_000 })
  await page.getByTestId('pe-mode-edit').click()
  await expect(page.getByTestId('edit-drop')).toHaveCount(0, { timeout: 30_000 })
})
