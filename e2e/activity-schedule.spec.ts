import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { inflateSync, inflateRawSync } from 'node:zlib'
import jsQRmod from 'jsqr'

const jsQR = (jsQRmod as unknown as { default?: typeof jsQRmod }).default ?? jsQRmod

// Activity Schedule.
//
// The illustrated routine sheet, on one time axis: an icon on every activity,
// activities that can be moved to the quarter hour and are free to differ from
// day to day, and a link that carries the whole thing.

/**
 * Pull the QR out of the PDF and decode it.
 *
 * Off the raw bytes, the way this repo reads its other generated documents:
 * find the image XObjects, take the square one — the page raster is landscape
 * — inflate its stream and hand the pixels to jsQR. Reading it back through
 * anything of ours would only prove we agree with ourselves.
 */
function decodeQrFromPdf(pdf: Buffer): string | null {
  const latin = pdf.toString('latin1')
  const re = /\/Subtype\s*\/Image[^>]*?\/Width\s+(\d+)[^>]*?\/Height\s+(\d+)[^>]*?>>\s*stream\r?\n/g
  for (let m = re.exec(latin); m; m = re.exec(latin)) {
    const w = Number(m[1])
    const h = Number(m[2])
    if (w !== h) continue                       // the page raster, not the code
    const start = m.index + m[0].length
    const raw = inflateRawOrZlib(pdf.subarray(start, latin.indexOf('endstream', start)))
    const bpp = raw.length / (w * h)
    const rgba = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = raw[i * bpp]
      rgba[i * 4 + 1] = raw[i * bpp + (bpp > 1 ? 1 : 0)]
      rgba[i * 4 + 2] = raw[i * bpp + (bpp > 2 ? 2 : 0)]
      rgba[i * 4 + 3] = 255
    }
    return jsQR(rgba, w, h)?.data ?? null
  }
  return null
}

const inflateRawOrZlib = (b: Buffer): Buffer => {
  try { return inflateSync(b) } catch { return inflateRawSync(b) }
}

const load = async (page: Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/activity-schedule`)
  await expect(page.getByTestId('activity-schedule')).toBeVisible()
}

/** Every activity block in one day column, top to bottom. */
const blocks = (page: Page, day: string) =>
  page.locator(`[data-testid="as-col-${day}"] [data-testid^="as-item-"]`)

/** The [start, end] a block claims, in minutes from midnight. */
const spanOf = async (loc: ReturnType<Page['locator']>): Promise<[number, number]> => {
  const [s, e] = await Promise.all([loc.getAttribute('data-start'), loc.getAttribute('data-end')])
  return [Number(s), Number(e)]
}

/**
 * Add an activity to a day and name it, returning a STABLE locator for it.
 *
 * Resolved to its own testid rather than handed back as `.last()`: a locator
 * is lazy, so two `.last()` handles both point at whatever is last by the time
 * they are read — which made two different blocks measure as one element and
 * looked exactly like the side-by-side packing having failed.
 */
async function add(page: Page, day: string, name: string) {
  await page.getByTestId(`as-add-${day}`).click()
  const fresh = blocks(page, day).last()
  const box = fresh.locator('[data-testid^="as-name-"]')
  await box.fill(name)
  await box.press('Escape')
  return page.getByTestId((await fresh.getAttribute('data-testid'))!)
}

test('an activity lands on the axis at a quarter-hour', async ({ page }) => {
  await load(page)
  const block = await add(page, 'sun', 'Assembly')
  const [start, end] = await spanOf(block)
  expect(start % 15).toBe(0)
  expect(end % 15).toBe(0)
  expect(start).toBe(7 * 60)          // the default day starts at 7:00
  expect(end - start).toBe(30)
})

test('the arrow keys move it by exactly a quarter of an hour', async ({ page }) => {
  // The keyboard is the accessible path AND the only one a spec can assert
  // on: a pointer drag cannot be checked to the minute.
  await load(page)
  const block = await add(page, 'sun', 'Assembly')
  const [before] = await spanOf(block)

  await block.press('ArrowDown')
  expect((await spanOf(block))[0]).toBe(before + 15)
  await block.press('ArrowDown')
  expect((await spanOf(block))[0]).toBe(before + 30)
  await block.press('ArrowUp')
  expect((await spanOf(block))[0]).toBe(before + 15)
})

test('moving keeps the length; Shift resizes instead', async ({ page }) => {
  await load(page)
  const block = await add(page, 'sun', 'Quran')
  const [s0, e0] = await spanOf(block)

  await block.press('ArrowDown')
  const [s1, e1] = await spanOf(block)
  expect(e1 - s1).toBe(e0 - s0)

  await block.press('Shift+ArrowDown')
  const [s2, e2] = await spanOf(block)
  expect(s2).toBe(s1)
  expect(e2).toBe(e1 + 15)
})

test('it cannot be pushed off either end of the axis', async ({ page }) => {
  await load(page)
  const block = await add(page, 'sun', 'Assembly')
  for (let i = 0; i < 6; i++) await block.press('ArrowUp')
  expect((await spanOf(block))[0]).toBe(7 * 60)      // the axis starts here

  for (let i = 0; i < 40; i++) await block.press('ArrowDown')
  expect((await spanOf(block))[1]).toBeLessThanOrEqual(12 * 60)
})

test('an activity cannot be shrunk to nothing', async ({ page }) => {
  await load(page)
  const block = await add(page, 'sun', 'Snack')
  for (let i = 0; i < 6; i++) await block.press('Shift+ArrowUp')
  const [start, end] = await spanOf(block)
  expect(end - start).toBe(15)
})

test('the days are free to differ — that is the point of the axis', async ({ page }) => {
  // The reason the times are not locked to a shared row: assembly only on
  // Sunday, an early finish on Thursday. A move on one day must not drag the
  // others with it, and must not be snapped back.
  await load(page)
  await add(page, 'sun', 'Quran')
  await add(page, 'thu', 'Quran')

  const thu = blocks(page, 'thu').first()
  await thu.press('ArrowDown')
  await thu.press('ArrowDown')

  const [sunStart] = await spanOf(blocks(page, 'sun').first())
  const [thuStart] = await spanOf(thu)
  expect(thuStart).toBe(sunStart + 30)
})

test('two activities at once on one day are named', async ({ page }) => {
  // An overlap is the defect a time axis can see and a grid of boxes cannot,
  // because boxes are the same size whatever they say.
  await load(page)
  const first = await add(page, 'sun', 'Quran')
  const second = await add(page, 'sun', 'Maths')
  await second.press('ArrowUp')                 // into the first one's half hour

  await expect(second).toHaveAttribute('data-trouble', 'overlap')
  // BOTH are reported, not the pair: each activity is individually in the
  // wrong place, and each is individually marked on the sheet.
  await expect(first).toHaveAttribute('data-trouble', 'overlap')
  await expect(page.getByTestId('as-clash-count')).toContainText('2')
})

test('and BOTH of them stay visible, side by side', async ({ page }) => {
  // Its own case, because drawing one on top of the other would be worse than
  // the overlap it is reporting — and because as one assertion inside the test
  // above it was masked: that test fails at the flag before ever measuring.
  await load(page)
  const first = await add(page, 'sun', 'Quran')
  const second = await add(page, 'sun', 'Maths')
  await second.press('ArrowUp')

  const a = (await first.boundingBox())!
  const b = (await second.boundingBox())!
  expect(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1).toBe(true)
  // And each is half a column, not a full one hiding the other.
  const col = (await page.getByTestId('as-col-sun').boundingBox())!
  expect(a.width).toBeLessThan(col.width * 0.6)
})

test('a day with no overlap reports nothing', async ({ page }) => {
  // Without this the overlap check could be "always complain" and every other
  // case in this file would still pass.
  await load(page)
  await add(page, 'sun', 'Quran')
  const second = await add(page, 'sun', 'Maths')
  await expect(second).not.toHaveAttribute('data-trouble', /.+/)
  await expect(page.getByTestId('as-clash')).toHaveCount(0)
})

test('one day can be copied across the week', async ({ page }) => {
  // The ordinary school week is four identical days and one that differs, so
  // without this the axis would be worse than the grid it replaced for the
  // common case: the same eight activities placed five times.
  await load(page)
  await add(page, 'sun', 'Quran')
  await add(page, 'sun', 'Maths')
  await page.getByTestId('as-copy-sun').click()

  for (const day of ['mon', 'tue', 'wed', 'thu']) {
    await expect(blocks(page, day)).toHaveCount(2)
    await expect(blocks(page, day).first().locator('[data-testid^="as-name-"]')).toHaveValue('Quran')
  }
  expect(await spanOf(blocks(page, 'thu').first()))
    .toEqual(await spanOf(blocks(page, 'sun').first()))
})

test('Enter in the name box starts the next activity below it', async ({ page }) => {
  // What makes filling a day a typing job rather than forty trips to a button.
  await load(page)
  const first = await add(page, 'sun', 'Assembly')
  const [, firstEnd] = await spanOf(first)

  await first.locator('[data-testid^="as-name-"]').press('Enter')
  await expect(blocks(page, 'sun')).toHaveCount(2)
  expect((await spanOf(blocks(page, 'sun').nth(1)))[0]).toBe(firstEnd)
})

test('a block is as tall as its activity is long', async ({ page }) => {
  await load(page)
  const half = await add(page, 'sun', 'Quran')
  const hour = await add(page, 'mon', 'Art')
  await hour.press('Shift+ArrowDown')
  await hour.press('Shift+ArrowDown')            // 30 -> 60 minutes

  const a = await half.boundingBox()
  const b = await hour.boundingBox()
  expect(b!.height / a!.height).toBeGreaterThan(1.8)
  expect(b!.height / a!.height).toBeLessThan(2.2)
})

test('the class goes on the sheet, under the title and the note', async ({ page }) => {
  // Every one of these charts names the class, set apart and emphasised — it
  // is the thing a parent looks for first to know whether the sheet on the
  // wall is their child's.
  await load(page, 'ar')
  await page.getByTestId('as-group').fill('KG2 - براعم 2')
  await expect(page.getByTestId('as-sheet-group')).toHaveText('KG2 - براعم 2')

  // The title, the note and the class are three LINES. As inline-block
  // siblings in a centred box they flowed together and the note pill sat
  // beside the title banner on one row.
  const ys = await Promise.all(
    ['as-sheet-title', 'as-sheet-note', 'as-sheet-group']
      .map(async (id) => (await page.getByTestId(id).boundingBox())!.y),
  )
  expect(ys[1]).toBeGreaterThan(ys[0])
  expect(ys[2]).toBeGreaterThan(ys[1])
})

test('the axis is labelled, and the sheet says where the day starts and ends', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('as-mark-420')).toContainText('7:00')
  await expect(page.getByTestId('as-mark-720')).toContainText('12:00')

  await page.getByTestId('as-to').fill('10:00')
  await page.getByTestId('as-to').blur()
  await expect(page.getByTestId('as-mark-720')).toHaveCount(0)
  await expect(page.getByTestId('as-mark-600')).toContainText('10:00')
})

test('shortening the day pulls activities back inside it', async ({ page }) => {
  // Otherwise the axis and its contents disagree, and the sheet prints an
  // activity in the margin.
  await load(page)
  const block = await add(page, 'sun', 'Home time')
  for (let i = 0; i < 12; i++) await block.press('ArrowDown')
  expect((await spanOf(block))[1]).toBeGreaterThan(9 * 60)

  await page.getByTestId('as-to').fill('9:00')
  await page.getByTestId('as-to').blur()
  expect((await spanOf(blocks(page, 'sun').first()))[1]).toBeLessThanOrEqual(9 * 60)
})

test('an icon is guessed from the words in the name', async ({ page }) => {
  await load(page)
  const block = await add(page, 'sun', 'قرآن')
  await expect(block.locator('[data-testid^="as-icon-"]').first()).toContainText('📖')
})

test('the icon chosen for an activity comes back for the same name — in a LATER schedule', async ({ page }) => {
  await load(page)
  const block = await add(page, 'sun', 'Circle time')
  const id = (await block.getAttribute('data-testid'))!.replace('as-item-', '')
  await page.getByTestId(`as-icon-${id}`).click()
  await page.getByTestId(`as-icon-${id}-pick-🧩`).click()
  await expect(page.getByTestId(`as-icon-${id}`)).toContainText('🧩')

  await page.getByTestId('as-save').click()
  await page.getByTestId('as-new').click()

  const later = await add(page, 'thu', 'Circle time')
  await expect(later.locator('[data-testid^="as-icon-"]').first()).toContainText('🧩')
})

test('a chosen icon outranks the guess', async ({ page }) => {
  await load(page)
  const block = await add(page, 'sun', 'قرآن')
  const id = (await block.getAttribute('data-testid'))!.replace('as-item-', '')
  await page.getByTestId(`as-icon-${id}`).click()
  await page.getByTestId(`as-icon-${id}-pick-🎵`).click()

  const again = await add(page, 'mon', 'قرآن')
  await expect(again.locator('[data-testid^="as-icon-"]').first()).toContainText('🎵')
})

test('the suggestions under an activity box come from an earlier SAVED schedule', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'Mathematics')
  await page.getByTestId('as-save').click()
  await page.getByTestId('as-new').click()

  await page.getByTestId('as-add-mon').click()
  const box = blocks(page, 'mon').last().locator('[data-testid^="as-name-"]')
  const id = (await box.getAttribute('data-testid'))!
  await box.click()                       // opens on FOCUS, not on the first keystroke
  await expect(page.getByTestId(`${id}-list`)).toContainText('Mathematics')
  await page.getByTestId(`${id}-opt-0`).click()
  await expect(box).toHaveValue('Mathematics')
})

test('an activity can be removed', async ({ page }) => {
  await load(page)
  const block = await add(page, 'sun', 'Assembly')
  const id = (await block.getAttribute('data-testid'))!.replace('as-item-', '')
  await page.getByTestId(`as-remove-${id}`).click()
  await expect(blocks(page, 'sun')).toHaveCount(0)
})

test('a sheet saved before the axis existed still opens', async ({ page }) => {
  // The tool shipped once with a time written into every cell. A schedule
  // somebody built and printed is not ours to throw away because we changed
  // our minds about the model, so the old shape is READ rather than discarded.
  await load(page)
  await page.evaluate(() => {
    localStorage.setItem('bis-schedule-draft', JSON.stringify({
      id: 'old', title: 'Last term', note: '', art: true, updated: Date.now(),
      days: ['sun', 'mon', 'tue', 'wed', 'thu'],
      rows: [
        { cells: { sun: { name: 'Assembly', icon: '🔔', time: '7:00 - 7:30' },
                   mon: { name: 'Assembly', icon: '🔔', time: '7:00 - 7:30' } } },
        { cells: { sun: { name: 'Quran', icon: '📖', time: '7:30 - 8:15' } } },
      ],
    }))
  })
  await page.reload()
  await expect(page.getByTestId('activity-schedule')).toBeVisible()

  await expect(page.getByTestId('as-title')).toHaveValue('Last term')
  await expect(blocks(page, 'sun')).toHaveCount(2)
  expect(await spanOf(blocks(page, 'sun').first())).toEqual([7 * 60, 7 * 60 + 30])
  expect(await spanOf(blocks(page, 'sun').nth(1))).toEqual([7 * 60 + 30, 8 * 60 + 15])
  await expect(blocks(page, 'mon')).toHaveCount(1)
})

test('the share link carries the whole sheet, and opening it fetches nothing', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'Assembly')
  await page.getByTestId('as-title').fill('Grade 1B')

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByTestId('as-share').click()
  const shared = await page.evaluate(() => navigator.clipboard.readText())
  expect(shared).toContain('#s=')

  const fresh = await page.context().browser()!.newContext()
  const p2 = await fresh.newPage()
  const bodies: string[] = []
  p2.on('request', (r) => { if (r.postData()) bodies.push(r.url()) })
  await p2.goto(shared)
  await expect(p2.getByTestId('as-from-link')).toBeVisible()
  await expect(p2.getByTestId('as-title')).toHaveValue('Grade 1B')
  await expect(blocks(p2, 'sun').first().locator('[data-testid^="as-name-"]')).toHaveValue('Assembly')
  expect(await spanOf(blocks(p2, 'sun').first())).toEqual([7 * 60, 7 * 60 + 30])
  expect(bodies.filter((u) => !/analytics|googletagmanager|google-analytics/.test(u))).toEqual([])
  await fresh.close()
})

test('a saved schedule can be reopened and deleted', async ({ page }) => {
  await load(page)
  await page.getByTestId('as-title').fill('Term one')
  await add(page, 'sun', 'Assembly')
  await page.getByTestId('as-save').click()
  await page.getByTestId('as-new').click()
  await expect(page.getByTestId('as-title')).not.toHaveValue('Term one')

  const open = page.locator('[data-testid^="as-open-"]').first()
  await expect(open).toContainText('Term one')
  await open.click()
  await expect(page.getByTestId('as-title')).toHaveValue('Term one')

  await page.locator('[data-testid^="as-delete-"]').first().click()
  await expect(page.getByTestId('as-saved')).toHaveCount(0)
})

test('what was placed survives a reload without being saved', async ({ page }) => {
  await load(page)
  await add(page, 'tue', 'Art')
  await page.reload()
  await expect(blocks(page, 'tue').first().locator('[data-testid^="as-name-"]')).toHaveValue('Art')
})

/**
 * The day columns LEFT TO RIGHT on screen — geometry, not DOM order.
 *
 * The two are opposite under `dir="rtl"`, which is how both grids on this site
 * shipped with Sunday on the wrong side while their specs stayed green: they
 * asserted the source order, which was the half that was already right.
 */
const cardOrder = async (page: Page) =>
  page.locator('[data-day]').evaluateAll(
    (els) => els
      .map((e) => ({ d: e.getAttribute('data-day')!, x: e.getBoundingClientRect().x }))
      .sort((a, b) => a.x - b.x)
      .map((o) => o.d),
  )

test('in Arabic Sunday is the RIGHTMOST column, and the axis is beside it', async ({ page }) => {
  await load(page, 'ar')
  expect(await cardOrder(page)).toEqual(['thu', 'wed', 'tue', 'mon', 'sun'])
  await expect(page.getByTestId('as-head-sun')).toContainText('الأحد')

  // The axis sits on the side the reader starts from, past Sunday.
  const axis = (await page.getByTestId('as-axis').boundingBox())!
  const sun = (await page.getByTestId('as-col-sun').boundingBox())!
  expect(axis.x).toBeGreaterThan(sun.x)
})

test('in English Sunday is the leftmost column, and the axis is to its left', async ({ page }) => {
  await load(page)
  expect(await cardOrder(page)).toEqual(['sun', 'mon', 'tue', 'wed', 'thu'])
  const axis = (await page.getByTestId('as-axis').boundingBox())!
  const sun = (await page.getByTestId('as-col-sun').boundingBox())!
  expect(axis.x).toBeLessThan(sun.x)
})

test('the weekend is added at the END of the week', async ({ page }) => {
  await load(page)
  await page.getByTestId('as-weekend').check()
  expect(await cardOrder(page)).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
  await load(page, 'ar')
  await page.getByTestId('as-weekend').check()
  expect(await cardOrder(page)).toEqual(['sat', 'fri', 'thu', 'wed', 'tue', 'mon', 'sun'])
})

test('the illustrations are on the sheet, and can be turned off', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('as-art-header')).toBeVisible()
  await expect(page.getByTestId('as-art-footer')).toBeVisible()

  // They must actually DECODE, not merely be present. A missing file under
  // `public/` does not 404 here — the SPA fallback answers 200 with
  // index.html, so a mistyped path gives an `<img>` that looks fine to every
  // assertion except this one. `naturalWidth` is zero for an image that never
  // loaded, whatever the server said.
  for (const id of ['as-art-header', 'as-art-footer']) {
    await expect
      .poll(() => page.getByTestId(id).evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)
  }

  await page.getByTestId('as-art').uncheck()
  await expect(page.getByTestId('as-art-header')).toHaveCount(0)
  await expect(page.getByTestId('as-art-footer')).toHaveCount(0)
})

test('it prints a PDF of what is on screen', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'Assembly')
  await page.getByTestId('as-title').fill('Grade 1B')
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  expect((await dl).suggestedFilename()).toBe('Grade-1B.pdf')
  await expect(page.getByTestId('as-qr-problem')).toHaveCount(0)
})

test('the Arabic PDF is produced too', async ({ page }) => {
  await load(page, 'ar')
  await add(page, 'sun', 'قرآن')
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  expect((await dl).suggestedFilename()).toMatch(/\.pdf$/)
})

test('the QR on the printed sheet decodes, and reopens the same schedule', async ({ page }) => {
  // A QR nobody has decoded is a picture, and this one was — twice. It is read
  // out of the PDF ITSELF rather than the canvas it was composed from, because
  // the code is embedded as its own high-resolution image and the canvas no
  // longer carries it; and with jsQR, so the check is not our encoder agreeing
  // with itself.
  await load(page)
  await page.getByTestId('as-title').fill('Grade 1B')
  await add(page, 'sun', 'Assembly')
  await add(page, 'mon', 'Quran')

  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  const pdf = readFileSync((await (await dl).path())!)

  const decoded = decodeQrFromPdf(pdf)
  expect(decoded, 'the QR in the printed PDF could not be decoded').toBeTruthy()
  expect(decoded).toContain('/apps/activity-schedule/')
  expect(decoded).toContain('#s=')

  const fresh = await page.context().browser()!.newContext()
  const p2 = await fresh.newPage()
  await p2.goto(decoded!.replace(/^https?:\/\/[^/]+/, ''))
  await expect(p2.getByTestId('as-title')).toHaveValue('Grade 1B')
  await expect(blocks(p2, 'sun').first().locator('[data-testid^="as-name-"]')).toHaveValue('Assembly')
  await expect(blocks(p2, 'mon').first().locator('[data-testid^="as-name-"]')).toHaveValue('Quran')
  await fresh.close()
})

/**
 * Write a sheet straight into the draft, to reach sizes typing cannot.
 *
 * `distinct` is the whole variable. A real sheet repeats one activity across
 * the week; the dictionary in the encoding collapses that and deflate removes
 * what is left. Only a sheet where every single cell differs — which no wall
 * chart is — gets anywhere near the ceiling.
 */
const seedSheet = async (page: Page, rows: number, distinct: boolean) => {
  await page.evaluate(({ rows, distinct }) => {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu']
    const words = ['طابور وأذكار الصباح', 'قرآن', 'رياضيات', 'إنجليزي', 'وجبة', 'أركان', 'لعب حر', 'انصراف']
    const items: Record<string, unknown[]> = {}
    days.forEach((d, di) => {
      items[d] = Array.from({ length: rows }, (_, r) => ({
        id: `${d}${r}`,
        name: distinct ? `${words[(r * 5 + di) % words.length]} ${r * 5 + di}` : words[r % words.length],
        icon: '📖',
        start: 7 * 60 + r * 15,
        end: 7 * 60 + r * 15 + 15,
      }))
    })
    localStorage.setItem('bis-schedule-draft', JSON.stringify({
      id: 'big', title: 'الجدول الأسبوعي', note: 'أيام الدراسة', art: true, updated: Date.now(),
      days, from: 7 * 60, to: 7 * 60 + rows * 15 + 60, items,
    }))
  }, { rows, distinct })
  await page.reload()
  await expect(page.getByTestId('activity-schedule')).toBeVisible()
}

test('a normal sheet, even a very long one, still gets its QR', async ({ page }) => {
  // Without this the refusals below could be satisfied by a tool that never
  // manages a QR at all.
  await load(page, 'ar')
  await seedSheet(page, 24, false)
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  await dl
  await expect(page.getByTestId('as-qr-problem')).toHaveCount(0)
})

test('a sheet whose code would print finer than a camera can read refuses it', async ({ page }) => {
  // A QR denser than about 0.42mm per module, printed on A4, looks like a
  // working code and is a picture. The PDF is still produced — the schedule is
  // the point and the code is the extra — and the reason is named.
  await load(page, 'ar')
  await seedSheet(page, 46, true)
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  await dl
  await expect(page.getByTestId('as-qr-problem')).toHaveAttribute('data-why', 'too-dense')
})

test('a sheet past the 2,953-byte QR limit says THAT instead', async ({ page }) => {
  // A different refusal with a different remedy, so it gets a different
  // message: past this there is no code at all, at any size.
  await load(page, 'ar')
  await seedSheet(page, 90, true)
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  await dl
  await expect(page.getByTestId('as-qr-problem')).toHaveAttribute('data-why', 'too-long')
})

test('it says why there is one axis, and why the link is large', async ({ page }) => {
  await load(page)
  // Aimed at the BODY, not the heading — `free to differ` is the panel's
  // title, and asserting it here would pass against an empty explanation.
  await expect(page.getByTestId('as-why-axis')).toContainText('not locked together')
  await expect(page.getByTestId('as-why-share')).toContainText('never sent to a server')
})
