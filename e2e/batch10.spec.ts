import { test, expect } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

async function textPdf(lines: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const page = pdf.addPage([400, 400])
  lines.forEach((line, i) => page.drawText(line, { x: 40, y: 340 - i * 30, size: 16, font }))
  return Buffer.from(await pdf.save())
}

async function textInPdf(bytes: Uint8Array): Promise<string> {
  const doc = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false }).promise
  let out = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    out += (content.items as { str?: string }[]).map((x) => x.str ?? '').join('')
  }
  return out
}

test.describe('pdf redaction', () => {
  test('warns about the black-rectangle mistake before you start', async ({ page }) => {
    await page.goto('/en/apps/pdf-redact')
    await expect(page.getByText(/black rectangle drawn in a PDF viewer hides nothing/)).toBeVisible()
  })

  test('the exported file contains no extractable text at all', async ({ page }) => {
    const pdf = await textPdf(['SECRET WITNESS NAME', 'Salary 45000 SAR'])
    await page.goto('/en/apps/pdf-redact')
    await page.getByTestId('pr-file').setInputFiles({ name: 'case.pdf', mimeType: 'application/pdf', buffer: pdf })
    await expect(page.getByTestId('pr-page-1')).toBeVisible({ timeout: 20_000 })

    const dl = page.waitForEvent('download')
    await page.getByTestId('pr-apply').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('case-redacted.pdf')

    const stream = await file.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c as Buffer)
    const out = Buffer.concat(chunks)
    // The whole point: the words are gone from the file, not merely covered.
    const text = await textInPdf(new Uint8Array(out))
    expect(text).not.toContain('SECRET')
    expect(text).not.toContain('45000')
    expect(text.trim()).toBe('')
    // …and the tool says so, having re-read its own export.
    await expect(page.getByTestId('pr-verified')).toBeVisible()
  })

  test('dragging over the page marks an area', async ({ page }) => {
    const pdf = await textPdf(['Something to hide'])
    await page.goto('/en/apps/pdf-redact')
    await page.getByTestId('pr-file').setInputFiles({ name: 'x.pdf', mimeType: 'application/pdf', buffer: pdf })
    const img = page.getByTestId('pr-page-1')
    await expect(img).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('pr-count')).toHaveText('0 areas marked')
    const box = (await img.boundingBox())!
    await page.mouse.move(box.x + 20, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.7, box.y + 60, { steps: 6 })
    await page.mouse.up()
    await expect(page.getByTestId('pr-count')).toHaveText('1 area marked')
    await page.getByTestId('pr-clear').click()
    await expect(page.getByTestId('pr-count')).toHaveText('0 areas marked')
  })

  test('a tap does not create a stray redaction', async ({ page }) => {
    const pdf = await textPdf(['Hello'])
    await page.goto('/en/apps/pdf-redact')
    await page.getByTestId('pr-file').setInputFiles({ name: 'x.pdf', mimeType: 'application/pdf', buffer: pdf })
    const img = page.getByTestId('pr-page-1')
    await expect(img).toBeVisible({ timeout: 20_000 })
    const box = (await img.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByTestId('pr-count')).toHaveText('0 areas marked')
  })

  test('a file that is not a PDF is reported', async ({ page }) => {
    await page.goto('/en/apps/pdf-redact')
    await page.getByTestId('pr-file').setInputFiles({ name: 'n.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') })
    await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('carousel splitter', () => {
  async function attach(page: import('@playwright/test').Page, w: number, h: number) {
    const dataUrl = await page.evaluate(([cw, ch]) => {
      const c = document.createElement('canvas')
      c.width = cw; c.height = ch
      const ctx = c.getContext('2d')!
      const g = ctx.createLinearGradient(0, 0, cw, 0)
      g.addColorStop(0, '#1f5c3d'); g.addColorStop(1, '#c2903a')
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch)
      return c.toDataURL('image/png')
    }, [w, h])
    await page.getByTestId('cs-file').setInputFiles({
      name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
    })
  }

  test('renders one preview per slide', async ({ page }) => {
    await page.goto('/en/apps/carousel-split')
    await attach(page, 3240, 1350)
    await expect(page.getByTestId('cs-slide-1')).toBeVisible()
    await expect(page.getByTestId('cs-slide-3')).toBeVisible()
    await expect(page.getByTestId('cs-slide-4')).toHaveCount(0)
    await page.getByTestId('cs-slides').fill('5')
    await expect(page.getByTestId('cs-slide-5')).toBeVisible()
  })

  test('states the source width the settings need', async ({ page }) => {
    await page.goto('/en/apps/carousel-split')
    // 3 square slides at 1350 high → 1350 wide each → 4050 total.
    await expect(page.getByTestId('cs-needed')).toContainText('4050 × 1350')
    await page.getByTestId('cs-ratio').selectOption('4:5')
    // 4:5 at 1350 high → 1080 wide → 3240.
    await expect(page.getByTestId('cs-needed')).toContainText('3240 × 1350')
  })

  test('warns when the source is too narrow to stay sharp', async ({ page }) => {
    await page.goto('/en/apps/carousel-split')
    await attach(page, 600, 400)
    await expect(page.getByTestId('cs-narrow')).toBeVisible()
  })

  test('downloads a zip of numbered slides', async ({ page }) => {
    await page.goto('/en/apps/carousel-split')
    await attach(page, 3240, 1350)
    const dl = page.waitForEvent('download')
    await page.getByTestId('cs-zip').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('carousel.zip')
    const stream = await file.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c as Buffer)
    const zip = Buffer.concat(chunks).toString('latin1')
    // Zero-padded, so a filename sort is the slide order.
    expect(zip).toContain('slide-01.jpg')
    expect(zip).toContain('slide-03.jpg')
  })
})

test.describe('csv merge', () => {
  const A = 'id,name\n1,Ahmed\n2,Fatimah\n3,Khalid'
  const B = 'id,city\n1,Riyadh\n2,Jeddah\n9,Dammam'

  test('joins two files on a shared column', async ({ page }) => {
    await page.goto('/en/apps/csv-merge')
    await page.getByTestId('cm-text-a').fill(A)
    await page.getByTestId('cm-text-b').fill(B)
    await expect(page.getByTestId('cm-matched')).toHaveText('2 matched')
    const out = page.getByTestId('cm-output')
    await expect(out).toHaveValue(/^id,name,city/)
    await expect(out).toHaveValue(/1,Ahmed,Riyadh/)
    // The key column is not duplicated in the output.
    await expect(out).not.toHaveValue(/id,name,id,city/)
  })

  test('reports rows on each side that found no match', async ({ page }) => {
    await page.goto('/en/apps/csv-merge')
    await page.getByTestId('cm-text-a').fill(A)
    await page.getByTestId('cm-text-b').fill(B)
    await expect(page.getByTestId('cm-unmatched')).toContainText('1 from the first file')
    // Khalid has no city, but is kept with an empty cell by default.
    await expect(page.getByTestId('cm-output')).toHaveValue(/3,Khalid,/)
    await page.getByTestId('cm-keep').uncheck()
    await expect(page.getByTestId('cm-output')).not.toHaveValue(/Khalid/)
  })

  test('stacking aligns by column name, not position', async ({ page }) => {
    await page.goto('/en/apps/csv-merge')
    await page.getByTestId('cm-mode-append').click()
    await page.getByTestId('cm-text-a').fill('name,city\nAhmed,Riyadh')
    // Same columns, opposite order — a positional stack would swap the values.
    await page.getByTestId('cm-text-b').fill('city,name\nJeddah,Fatimah')
    const out = page.getByTestId('cm-output')
    await expect(out).toHaveValue(/Fatimah,Jeddah/)
    await expect(out).not.toHaveValue(/Jeddah,Fatimah/)
  })

  test('a duplicate column name is suffixed rather than lost', async ({ page }) => {
    await page.goto('/en/apps/csv-merge')
    await page.getByTestId('cm-text-a').fill('id,note\n1,alpha')
    await page.getByTestId('cm-text-b').fill('id,note\n1,beta')
    await expect(page.getByTestId('cm-dupcols')).toContainText('note')
    const out = page.getByTestId('cm-output')
    await expect(out).toHaveValue(/note,note_2/)
    await expect(out).toHaveValue(/1,alpha,beta/)
  })

  test('mismatched columns are flagged when stacking', async ({ page }) => {
    await page.goto('/en/apps/csv-merge')
    await page.getByTestId('cm-mode-append').click()
    await page.getByTestId('cm-text-a').fill('name,city\nAhmed,Riyadh')
    await page.getByTestId('cm-text-b').fill('name,email\nFatimah,f@x.com')
    await expect(page.getByTestId('cm-mismatch')).toBeVisible()
    // The union keeps both columns, with blanks where a file had none.
    await expect(page.getByTestId('cm-output')).toHaveValue(/name,city,email/)
  })
})

test.describe('video to gif', () => {
  test('explains the shared-palette choice up front', async ({ page }) => {
    await page.goto('/en/apps/video-gif')
    await expect(page.getByText(/All frames share one palette/)).toBeVisible()
  })

  test('a file with no playable video is reported', async ({ page }) => {
    await page.goto('/en/apps/video-gif')
    await page.getByTestId('vg-file').setInputFiles({ name: 'x.bin', mimeType: '', buffer: Buffer.from('not a video') })
    await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 15_000 })
  })
})
