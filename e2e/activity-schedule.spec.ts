import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { inflateSync, inflateRawSync } from 'node:zlib'
import jsQRmod from 'jsqr'

const jsQR = (jsQRmod as unknown as { default?: typeof jsQRmod }).default ?? jsQRmod

// Activity Schedule.
//
// The illustrated routine sheet, on one time axis. A day is a SEQUENCE:
// dragging a lesson reorders it and the rest close up, and a drag into another
// column moves it there. Nothing is edited on the sheet itself — tapping
// anything opens the drawer.

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
 * The activity names down one day, in the order they are timetabled.
 *
 * Read off the name element rather than the block's `textContent`, which
 * runs the icon, the name and the time together into one string with
 * nothing between them — and then every comparison fails for a reason that
 * has nothing to do with the order.
 */
const orderOf = (page: Page, day: string) =>
  blocks(page, day).locator('[data-testid="as-label"]')
    .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ''))

/**
 * Add an activity to a day and name it through the DRAWER.
 *
 * Which is the only way now: a block holds no form, so the name is typed where
 * everything else is edited. Adding opens the drawer by itself, because an
 * unnamed block is not an edit yet.
 */
async function add(page: Page, day: string, name: string) {
  await page.getByTestId(`as-add-${day}`).click()
  await expect(page.getByTestId('as-drawer')).toBeVisible()
  await page.getByTestId('as-drawer-name').fill(name)
  await page.getByTestId('as-drawer-done').click()
  await expect(page.getByTestId('as-drawer')).toHaveCount(0)
  return blocks(page, day).last()
}

test('a lesson holds no form — tapping it opens the drawer', async ({ page }) => {
  // The sheet IS the document. Earlier every lesson carried a name box, an
  // icon button and a delete, which made the schedule a wall of chrome; now
  // the one place anything is edited is the drawer at the bottom of the screen.
  await load(page)
  const block = await add(page, 'sun', 'Quran')
  await expect(block.locator('input')).toHaveCount(0)

  await block.click()
  await expect(page.getByTestId('as-drawer')).toBeVisible()
  await expect(page.getByTestId('as-drawer-name')).toHaveValue('Quran')

  await page.getByTestId('as-drawer-name').fill('Maths')
  await expect(block).toContainText('Maths')
})

test('the drawer picks the icon, and the sheet shows it', async ({ page }) => {
  await load(page)
  const block = await add(page, 'sun', 'Circle time')
  await block.click()
  await page.getByTestId('as-drawer-icon').click()
  await page.getByTestId('as-drawer-pick-🧩').click()
  await expect(block).toContainText('🧩')
})

test('an icon chosen once comes back for the same name, in a LATER schedule', async ({ page }) => {
  await load(page)
  const block = await add(page, 'sun', 'Circle time')
  await block.click()
  await page.getByTestId('as-drawer-icon').click()
  await page.getByTestId('as-drawer-pick-🧩').click()
  await page.getByTestId('as-drawer-done').click()

  await page.getByTestId('as-settings').click()
  await page.getByTestId('as-save').click()
  await page.getByTestId('as-new').click()

  const later = await add(page, 'thu', 'Circle time')
  await expect(later).toContainText('🧩')
})

test('name suggestions are FUZZY, and the best one comes first', async ({ page }) => {
  // The names people reuse are long — «طابور وأذكار الصباح» — and nobody types
  // one from the beginning to find it. A prefix filter would offer nothing for
  // a word from the middle.
  await load(page)
  await add(page, 'sun', 'Morning assembly')
  await add(page, 'sun', 'Maths')
  await add(page, 'sun', 'Music')

  await page.getByTestId('as-add-mon').click()
  await page.getByTestId('as-drawer-name').fill('assem')
  await expect(page.getByTestId('as-drawer-suggestion-0')).toContainText('Morning assembly')

  // And a word that starts one beats a word that merely contains the letters.
  await page.getByTestId('as-drawer-name').fill('mat')
  await expect(page.getByTestId('as-drawer-suggestion-0')).toContainText('Maths')
})

test('a one-letter slip still finds the lesson', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'Mathematics')
  await page.getByTestId('as-add-mon').click()
  await page.getByTestId('as-drawer-name').fill('Mathemetics')
  await expect(page.getByTestId('as-drawer-suggestion-0')).toContainText('Mathematics')
})

test('an arrow key moves an activity one PLACE, not one quarter hour', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'One')
  await add(page, 'sun', 'Two')
  await add(page, 'sun', 'Three')
  expect(await orderOf(page, 'sun')).toEqual(['One', 'Two', 'Three'])

  await blocks(page, 'sun').nth(2).press('ArrowUp')
  expect(await orderOf(page, 'sun')).toEqual(['One', 'Three', 'Two'])
})

test('reordering keeps the day the same length, and leaves no hole', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'One')
  const two = await add(page, 'sun', 'Two')
  await add(page, 'sun', 'Three')
  await two.press('Shift+ArrowDown')

  const read = () => blocks(page, 'sun').evaluateAll(
    (els) => els.map((e) => [Number(e.getAttribute('data-start')), Number(e.getAttribute('data-end'))]),
  )
  const before = await read()
  const span = [before[0][0], before[before.length - 1][1]]
  const lengths = before.map(([a, b]) => b - a).sort()

  await blocks(page, 'sun').nth(2).press('ArrowUp')

  const after = await read()
  expect([after[0][0], after[after.length - 1][1]]).toEqual(span)
  expect(after.map(([a, b]) => b - a).sort()).toEqual(lengths)
  for (let i = 1; i < after.length; i++) expect(after[i][0]).toBe(after[i - 1][1])
})

test('a mouse drag reorders within the day', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'One')
  await add(page, 'sun', 'Two')
  const second = blocks(page, 'sun').nth(1)
  const box = (await second.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 8 })
  await page.mouse.up()
  expect(await orderOf(page, 'sun')).toEqual(['Two', 'One'])
})

test('a drag into ANOTHER day moves the lesson there', async ({ page }) => {
  // "At least in the same day" was the ask; across days is the same gesture
  // and the same edit, applied to two days at once so the sheet never holds
  // the lesson twice or not at all.
  await load(page)
  await add(page, 'sun', 'One')
  await add(page, 'mon', 'Other')

  const block = blocks(page, 'sun').first()
  const from = (await block.boundingBox())!
  const to = (await page.getByTestId('as-col-mon').boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, from.y + from.height / 2 + 20, { steps: 10 })
  await page.mouse.up()

  await expect(blocks(page, 'sun')).toHaveCount(0)
  expect(await orderOf(page, 'mon')).toContain('One')
})

/** A touch press, held for `ms`, then dragged `dy` pixels and released. */
async function touchDrag(loc: ReturnType<Page['locator']>, ms: number, dy: number) {
  const box = (await loc.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const opts = { pointerType: 'touch', pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }
  await loc.dispatchEvent('pointerdown', { ...opts, clientX: x, clientY: y })
  await loc.page().waitForTimeout(ms)
  await loc.dispatchEvent('pointermove', { ...opts, clientX: x, clientY: y + dy })
  await loc.dispatchEvent('pointerup', { ...opts, clientX: x, clientY: y + dy })
}

test('on touch it takes a LONG press to move an activity', async ({ page }) => {
  // The blocks are nearly the whole sheet. If a press moved one at once, a
  // finger anywhere on the schedule would drag a lesson instead of scrolling.
  await load(page)
  await add(page, 'sun', 'One')
  await add(page, 'sun', 'Two')
  const second = blocks(page, 'sun').nth(1)

  await touchDrag(second, 80, -60)          // a flick: a scroll, not a drag
  expect(await orderOf(page, 'sun')).toEqual(['One', 'Two'])

  await touchDrag(second, 600, -60)         // held, then dragged
  expect(await orderOf(page, 'sun')).toEqual(['Two', 'One'])
})

test('the title, the line under it and the class are edited in the drawer', async ({ page }) => {
  // No form above the sheet: a sheet with a form beside it is two documents
  // pretending to be one, and the form always wins the attention.
  await load(page)
  for (const [testId, value] of [
    ['as-sheet-title', 'Grade 1B'],
    ['as-sheet-note', 'Sunday to Thursday'],
    ['as-sheet-group', 'KG2'],
  ] as const) {
    await page.getByTestId(testId).click()
    await expect(page.getByTestId('as-drawer')).toBeVisible()
    await page.getByTestId('as-drawer-text').fill(value)
    await page.getByTestId('as-drawer-done').click()
    await expect(page.getByTestId(testId)).toHaveText(value)
  }
})

test('the illustrations are removed by clicking them', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('as-art-header')).toBeVisible()
  // They must actually DECODE, not merely be present: a missing file under
  // `public/` answers 200 with index.html here, so a mistyped path gives an
  // image that satisfies every other assertion.
  await expect
    .poll(() => page.getByTestId('as-art-header').locator('img')
      .evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0)

  await page.getByTestId('as-art-header').click()
  await expect(page.getByTestId('as-art-header')).toHaveCount(0)
  await expect(page.getByTestId('as-art-footer')).toHaveCount(0)

  // And they can come back, or clicking them would be a one-way door. It is a
  // button rather than a checkbox: a box that vanishes when you tick it is an
  // action pretending to be a setting — and `check()` can never confirm it.
  await page.getByTestId('as-settings').click()
  await page.getByTestId('as-show-art').click()
  await page.getByTestId('as-drawer-done').click()
  await expect(page.getByTestId('as-art-header')).toBeVisible()
})

test('every other setting is behind the ⋯, not beside the sheet', async ({ page }) => {
  await load(page)
  for (const id of ['as-weekend', 'as-from', 'as-to', 'as-save', 'as-new']) {
    await expect(page.getByTestId(id)).toHaveCount(0)
  }
  await page.getByTestId('as-settings').click()
  for (const id of ['as-weekend', 'as-from', 'as-to', 'as-save', 'as-new']) {
    await expect(page.getByTestId(id)).toBeVisible()
  }
})

test('the weekend is added at the END of the week', async ({ page }) => {
  const cardOrder = async () =>
    page.locator('[data-day]').evaluateAll(
      (els) => els
        .map((e) => ({ d: e.getAttribute('data-day')!, x: e.getBoundingClientRect().x }))
        .sort((a, b) => a.x - b.x)
        .map((o) => o.d),
    )
  await load(page)
  await page.getByTestId('as-settings').click()
  await page.getByTestId('as-weekend').check()
  await page.getByTestId('as-drawer-done').click()
  expect(await cardOrder()).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])

  await load(page, 'ar')
  await page.getByTestId('as-settings').click()
  await page.getByTestId('as-weekend').check()
  await page.getByTestId('as-drawer-done').click()
  expect(await cardOrder()).toEqual(['sat', 'fri', 'thu', 'wed', 'tue', 'mon', 'sun'])
})

test('in Arabic Sunday is the RIGHTMOST column, and the axis is beside it', async ({ page }) => {
  // Geometry, not DOM order: the two are opposite under `dir="rtl"`, which is
  // how both grids on this site shipped with Sunday on the wrong side while
  // their specs stayed green.
  await load(page, 'ar')
  const order = await page.locator('[data-day]').evaluateAll(
    (els) => els
      .map((e) => ({ d: e.getAttribute('data-day')!, x: e.getBoundingClientRect().x }))
      .sort((a, b) => a.x - b.x)
      .map((o) => o.d),
  )
  expect(order).toEqual(['thu', 'wed', 'tue', 'mon', 'sun'])
  const axis = (await page.getByTestId('as-axis').boundingBox())!
  const sun = (await page.getByTestId('as-col-sun').boundingBox())!
  expect(axis.x).toBeGreaterThan(sun.x)
})

test('nothing on the sheet is outlined', async ({ page }) => {
  // The column is the day's solid colour and the lesson is a white card on it;
  // an outline round every lesson on an outlined column inside an outlined
  // sheet is three lines doing one job.
  await load(page)
  const block = await add(page, 'sun', 'Quran')
  for (const loc of [page.getByTestId('as-sheet'), page.getByTestId('as-col-sun'), block]) {
    const w = await loc.evaluate((el) => {
      const cs = getComputedStyle(el)
      return [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth]
    })
    expect(w).toEqual(['0px', '0px', '0px', '0px'])
  }
})

test('a schedule opened from a link explains nothing', async ({ page }) => {
  // Somebody who followed a QR code is looking at their own schedule. They do
  // not need to be told what this is, or that they followed a link.
  await load(page)
  await expect(page.getByTestId('as-intro')).toBeVisible()

  await page.goto('/ar/apps/activity-schedule/#t=sample')
  await expect(page.getByTestId('as-sheet')).toBeVisible()
  await expect(page.getByTestId('as-intro')).toHaveCount(0)
  await expect(page.getByTestId('as-from-link')).toHaveCount(0)
})

test('the explanatory panels and the timetable link are gone', async ({ page }) => {
  await load(page, 'ar')
  for (const id of ['as-why-axis', 'as-why-icon', 'as-why-share']) {
    await expect(page.getByTestId(id)).toHaveCount(0)
  }
  await expect(page.getByTestId('activity-schedule')).not.toContainText('شبكة بسيطة بلا أيقونات')
})

/** A day written the way an older, free-positioned link wrote it. */
const seedOverlap = async (page: Page) => {
  await page.evaluate(() => {
    localStorage.setItem('bis-schedule-draft', JSON.stringify({
      id: 'old', title: 'T', note: '', group: '', art: false, updated: Date.now(),
      days: ['sun', 'mon', 'tue', 'wed', 'thu'], from: 7 * 60, to: 12 * 60,
      items: {
        sun: [
          { id: 'a', name: 'Quran', icon: '', start: 7 * 60, end: 7 * 60 + 30 },
          { id: 'b', name: 'Maths', icon: '', start: 7 * 60 + 15, end: 7 * 60 + 45 },
        ],
      },
    }))
  })
  await page.reload()
  await expect(page.getByTestId('activity-schedule')).toBeVisible()
}

test('two activities at once are flagged, and both stay visible', async ({ page }) => {
  // Reordering makes an overlap impossible to CREATE — but a link made before
  // the sequence existed can still carry one.
  await load(page)
  await seedOverlap(page)
  await expect(blocks(page, 'sun').first()).toHaveAttribute('data-trouble', 'overlap')
  await expect(page.getByTestId('as-clash-count')).toContainText('2')

  const a = (await blocks(page, 'sun').first().boundingBox())!
  const b = (await blocks(page, 'sun').nth(1).boundingBox())!
  expect(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1).toBe(true)
})

test('a day with no overlap reports nothing', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'Quran')
  await add(page, 'sun', 'Maths')
  await expect(page.getByTestId('as-clash')).toHaveCount(0)
})

test('there is no dice anywhere, including in a sheet that already had one', async ({ page }) => {
  // The icon is stored ON the activity, so taking it out of the palette does
  // not reach a sheet already saved. It is retired wherever one is READ.
  await load(page)
  await page.evaluate(() => {
    localStorage.setItem('bis-schedule-draft', JSON.stringify({
      id: 'old', title: 'T', note: '', group: '', art: false, updated: Date.now(),
      days: ['sun', 'mon', 'tue', 'wed', 'thu'], from: 7 * 60, to: 12 * 60,
      items: { sun: [{ id: 'a', name: 'لعب حر', icon: '🎲', start: 7 * 60, end: 7 * 60 + 30 }] },
    }))
  })
  await page.reload()
  await expect(blocks(page, 'sun').first()).toContainText('⚽')
  await expect(blocks(page, 'sun').first()).not.toContainText('🎲')

  await blocks(page, 'sun').first().click()
  await page.getByTestId('as-drawer-icon').click()
  await expect(page.getByTestId('as-drawer-palette')).not.toContainText('🎲')
})

test('one day can be copied across the week', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'Quran')
  await add(page, 'sun', 'Maths')
  await page.getByTestId('as-copy-sun').click()
  for (const day of ['mon', 'tue', 'wed', 'thu']) {
    await expect(blocks(page, day)).toHaveCount(2)
  }
})

test('the starter opens from a short link, in the language of the page', async ({ page }) => {
  await page.goto('/ar/apps/activity-schedule/#t=sample')
  await expect(page.getByTestId('activity-schedule')).toBeVisible()
  await expect(page.getByTestId('as-sheet-group')).toHaveText('فصل تجريبي')
  await expect(blocks(page, 'sun')).toHaveCount(8)

  await page.goto('/en/apps/activity-schedule/#t=sample')
  await expect(page.getByTestId('as-sheet-group')).toHaveText('Sample class')
})

test('the share link carries the whole sheet, and opening it fetches nothing', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'Assembly')
  await page.getByTestId('as-sheet-title').click()
  await page.getByTestId('as-drawer-text').fill('Grade 1B')
  await page.getByTestId('as-drawer-done').click()

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByTestId('as-share').click()
  const shared = await page.evaluate(() => navigator.clipboard.readText())
  expect(shared).toContain('#s=')

  const fresh = await page.context().browser()!.newContext()
  const p2 = await fresh.newPage()
  const bodies: string[] = []
  p2.on('request', (r) => { if (r.postData()) bodies.push(r.url()) })
  await p2.goto(shared)
  await expect(p2.getByTestId('as-sheet-title')).toHaveText('Grade 1B')
  await expect(blocks(p2, 'sun').first()).toContainText('Assembly')
  expect(bodies.filter((u) => !/analytics|googletagmanager|google-analytics/.test(u))).toEqual([])
  await fresh.close()
})

test('what was placed survives a reload without being saved', async ({ page }) => {
  await load(page)
  await add(page, 'tue', 'Art')
  await page.reload()
  await expect(blocks(page, 'tue').first()).toContainText('Art')
})

test('a saved schedule can be reopened and deleted', async ({ page }) => {
  await load(page)
  await page.getByTestId('as-sheet-title').click()
  await page.getByTestId('as-drawer-text').fill('Term one')
  await page.getByTestId('as-drawer-done').click()
  await add(page, 'sun', 'Assembly')

  await page.getByTestId('as-settings').click()
  await page.getByTestId('as-save').click()
  await page.getByTestId('as-new').click()
  await expect(page.getByTestId('as-sheet-title')).not.toHaveText('Term one')

  await page.getByTestId('as-settings').click()
  const open = page.locator('[data-testid^="as-open-"]').first()
  await expect(open).toContainText('Term one')
  await open.click()
  await expect(page.getByTestId('as-sheet-title')).toHaveText('Term one')
})

test('it prints a PDF of what is on screen', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'Assembly')
  await page.getByTestId('as-sheet-title').click()
  await page.getByTestId('as-drawer-text').fill('Grade 1B')
  await page.getByTestId('as-drawer-done').click()
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  expect((await dl).suggestedFilename()).toBe('Grade-1B.pdf')
  await expect(page.getByTestId('as-qr-problem')).toHaveCount(0)
})

test('the QR on the printed sheet decodes, and reopens the same schedule', async ({ page }) => {
  // A QR nobody has decoded is a picture, and this one was — twice. It is read
  // out of the PDF ITSELF, with jsQR, so the check is not our encoder agreeing
  // with itself.
  await load(page)
  await page.getByTestId('as-sheet-title').click()
  await page.getByTestId('as-drawer-text').fill('Grade 1B')
  await page.getByTestId('as-drawer-done').click()
  await add(page, 'sun', 'Assembly')

  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  const pdf = readFileSync((await (await dl).path())!)

  const decoded = decodeQrFromPdf(pdf)
  expect(decoded, 'the QR in the printed PDF could not be decoded').toBeTruthy()
  expect(decoded).toContain('/apps/activity-schedule/')

  const fresh = await page.context().browser()!.newContext()
  const p2 = await fresh.newPage()
  await p2.goto(decoded!.replace(/^https?:\/\/[^/]+/, ''))
  await expect(p2.getByTestId('as-sheet-title')).toHaveText('Grade 1B')
  await expect(blocks(p2, 'sun').first()).toContainText('Assembly')
  await fresh.close()
})
