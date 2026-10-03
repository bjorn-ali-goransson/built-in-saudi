import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { inflateSync, inflateRawSync } from 'node:zlib'
import jsQRmod from 'jsqr'
import { ANALYTICS } from './helpers'

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

  await page.getByTestId('as-menu').click()
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

/**
 * A REAL touch press, held for `ms`, then dragged `dy` pixels and released.
 * Returns how far the PAGE scrolled while the finger was down.
 *
 * Through CDP, not `dispatchEvent`. Synthetic pointer events never consult
 * `touch-action` and are never cancelable, so they exercise the handler and
 * not the gesture — which is how a long press passed here while doing nothing
 * at all on a phone.
 *
 * The scroll distance is the half that matters. A native `touchmove` listener
 * fires whether or not the scroller also took the gesture, so the reorder can
 * happen while the sheet slides out from under the finger — which is a drag
 * nobody can aim. The two gestures are told apart by BOTH numbers: a flick
 * scrolls and reorders nothing, a held drag reorders and scrolls nothing.
 */
async function realTouchDrag(
  page: Page, loc: ReturnType<Page['locator']>, hold: boolean, dy: number,
) {
  // Back to the top, and WAIT for it. The previous gesture in this case is a
  // flick that deliberately scrolls the page, and measuring the block before
  // the scroll has settled yields stale coordinates — so the touch lands
  // somewhere that is not the block, no press ever lands, and it reads as a
  // long press that does not work. Which is, of course, the exact thing under
  // test.
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0)
  const box = (await loc.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const cdp = await page.context().newCDPSession(page)
  const point = (ty: number) => [{ x, y: ty, radiusX: 12, radiusY: 12, force: 1 }]

  // Resolved ONCE, before anything moves. `loc` is lazy, so after a reorder
  // `nth(1)` is a different block and reading `data-held` off it would report
  // the one that got out of the way — the same trap this suite already hit
  // with a `.last()` locator.
  const node = (await loc.elementHandle())!

  // A CONTROLLED clock was tried here and is the wrong tool: React's scheduler
  // is driven by timers, so freezing time stops `setHeld` ever flushing and
  // the block reports itself unheld while dragging perfectly. Real time it is
  // — but the whole gesture goes out in ONE round trip rather than five, so it
  // cannot drift into the 400ms press window under a loaded suite. CDP keeps
  // ordering on a session, so these are sent together and awaited once.
  const began = Date.now()
  const sent = [cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(y) })]
  if (hold) {
    await sent[0]
    // A RETRYING assertion, not a sampled read. `getAttribute` has no
    // auto-wait — the `allInnerTexts()` trap in a new place — so sampling it
    // reported the block unheld whenever React had not yet flushed the state
    // the press timer set. This is also the last moment `loc` is safe to use:
    // nothing has reordered yet, so it still resolves to the block under the
    // finger.
    await expect(loc).toHaveAttribute('data-held', '', { timeout: 4000 })
  }
  // Each step must clear the hold tolerance, or a real drag reads as finger
  // tremor — which is the failure this gesture actually had on a phone.
  for (let i = 1; i <= 4; i++) {
    sent.push(cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: point(y + (dy * i) / 4),
    }))
  }
  await Promise.all(sent)
  const moving = Date.now() - began
  // Absence is the stable state here and cannot flake into presence, so the
  // negative case is a plain read off the node pinned before the reorder.
  const held = (await node.getAttribute('data-held')) !== null

  // Waiting for the scroll to SETTLE is free, and it has to be done: a CDP
  // command is acknowledged before the compositor has moved anything, so
  // reading immediately reported 0 under load. It cannot affect the outcome,
  // because by now the moves have either exceeded the hold tolerance (so the
  // press is already cancelled and can never land) or the press has already
  // landed and taken the gesture.
  let scrolled = -1
  for (let i = 0; i < 20; i++) {
    const now = await page.evaluate(() => Math.abs(window.scrollY))
    if (now === scrolled) break
    scrolled = now
    await page.waitForTimeout(50)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  return { scrolled, held, moving }
}

const touchPhone = { hasTouch: true, viewport: { width: 420, height: 900 } }

test('on touch it takes a LONG press to move an activity', async ({ browser }) => {
  // The blocks are nearly the whole sheet. If a press moved one at once, a
  // finger anywhere on the schedule would drag a lesson instead of scrolling.
  const ctx = await browser.newContext(touchPhone)
  const page = await ctx.newPage()
  await page.goto('/en/apps/activity-schedule')
  await expect(page.getByTestId('activity-schedule')).toBeVisible()
  await add(page, 'sun', 'One')
  await add(page, 'sun', 'Two')
  const second = blocks(page, 'sun').nth(1)

  // A flick: the clock never advances, so the press cannot land, and the
  // finger belongs to the scroller.
  const flick = await realTouchDrag(page, second, false, -60)
  // If the machine was so slow that the press could have landed, say THAT
  // rather than reporting a broken gesture.
  expect(flick.moving, 'the flick must finish before the press could land').toBeLessThan(400)
  expect(flick.held).toBe(false)
  expect(flick.scrolled).toBeGreaterThan(20)
  expect(await orderOf(page, 'sun')).toEqual(['One', 'Two'])

  // Held first: the block claims the gesture, so the page must NOT move.
  const drag = await realTouchDrag(page, second, true, -60)
  expect(drag.held).toBe(true)
  expect(await orderOf(page, 'sun')).toEqual(['Two', 'One'])
  expect(drag.scrolled).toBe(0)
  await ctx.close()
})

test('a cancelled touch is not a tap, and a long press never opens the drawer', async ({ browser }) => {
  // This was ONE bug reported as two. A long press on Android raises the
  // context menu at around 500ms, which cancels the touch — and `touchcancel`
  // was wired to the same handler as `touchend`, so the cancel read as a
  // release and opened the drawer. From outside that is "the drawer expands
  // on press" and "dragging does not work".
  const ctx = await browser.newContext(touchPhone)
  const page = await ctx.newPage()
  await page.goto('/en/apps/activity-schedule')
  await expect(page.getByTestId('activity-schedule')).toBeVisible()
  await add(page, 'sun', 'Quran')
  const block = blocks(page, 'sun').first()
  const box = (await block.boundingBox())!
  const cdp = await page.context().newCDPSession(page)
  const pt = [{ x: box.x + box.width / 2, y: box.y + box.height / 2, radiusX: 12, radiusY: 12, force: 1 }]

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await expect(page.getByTestId('as-drawer')).toHaveCount(0)

  // And a press that landed and was then released without moving is a drag
  // somebody thought better of, not a request to edit.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt })
  await page.waitForTimeout(600)
  await expect(block).toHaveAttribute('data-held', '')
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.getByTestId('as-drawer')).toHaveCount(0)
  await cdp.detach()
  await ctx.close()
})

test('a long press raises no context menu, which is what cancels the touch', async ({ browser }) => {
  const ctx = await browser.newContext(touchPhone)
  const page = await ctx.newPage()
  await page.goto('/en/apps/activity-schedule')
  await expect(page.getByTestId('activity-schedule')).toBeVisible()
  await add(page, 'sun', 'Quran')
  const prevented = await blocks(page, 'sun').first().evaluate((el) => {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    el.dispatchEvent(e)
    return e.defaultPrevented
  })
  expect(prevented).toBe(true)
  await ctx.close()
})

test('the drawer sits above the on-screen keyboard', async ({ browser }) => {
  // A fixed element is laid out against the LAYOUT viewport, which the
  // keyboard does not change — it only shrinks the VISUAL one. So a drawer
  // docked to the bottom of the screen sits underneath the keyboard, and the
  // field it has just focused is off-screen along with it.
  const ctx = await browser.newContext(touchPhone)
  const page = await ctx.newPage()
  await page.goto('/en/apps/activity-schedule')
  await expect(page.getByTestId('activity-schedule')).toBeVisible()
  await add(page, 'sun', 'Quran')
  await blocks(page, 'sun').first().tap()
  await expect(page.getByTestId('as-drawer')).toBeVisible()

  const panel = page.getByTestId('as-drawer-panel')
  const before = (await panel.boundingBox())!
  const KB = 320
  await page.evaluate((kb) => {
    // Stand in for the keyboard: shrink the visual viewport the way one does.
    const vv = window.visualViewport!
    Object.defineProperty(vv, 'height', { value: window.innerHeight - kb, configurable: true })
    vv.dispatchEvent(new Event('resize'))
  }, KB)

  const after = (await panel.boundingBox())!
  expect(after.y + after.height).toBeLessThanOrEqual(before.y + before.height - KB + 1)
  // And the field it focused has to be somewhere a person can actually see.
  const field = (await page.getByTestId('as-drawer-name').boundingBox())!
  expect(field.y + field.height).toBeLessThan(900 - KB)
  await ctx.close()
})

test('a short tap on touch opens the drawer', async ({ browser }) => {
  const ctx = await browser.newContext(touchPhone)
  const page = await ctx.newPage()
  await page.goto('/en/apps/activity-schedule')
  await expect(page.getByTestId('activity-schedule')).toBeVisible()
  await add(page, 'sun', 'Quran')
  await blocks(page, 'sun').first().tap()
  await expect(page.getByTestId('as-drawer')).toBeVisible()
  await expect(page.getByTestId('as-drawer-name')).toHaveValue('Quran')
  await ctx.close()
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

test('a cog holds the settings and a kebab holds the schedules', async ({ page }) => {
  // One row, and the split is the point: a cog is for things that change how
  // the sheet is SHAPED, a kebab for acts on the document. They were one
  // button holding both, which is how saving a schedule came to live under a
  // cog. The export is the only filled button, because it is the only one
  // that produces a file.
  await load(page)
  for (const id of ['as-weekend', 'as-save', 'as-new']) {
    await expect(page.getByTestId(id)).toHaveCount(0)
  }

  await page.getByTestId('as-settings').click()
  await expect(page.getByTestId('as-weekend')).toBeVisible()
  for (const id of ['as-save', 'as-new']) {
    await expect(page.getByTestId(id)).toHaveCount(0)
  }
  await page.getByTestId('as-drawer-done').click()

  await page.getByTestId('as-menu').click()
  for (const id of ['as-save', 'as-new']) {
    await expect(page.getByTestId(id)).toBeVisible()
  }
  await expect(page.getByTestId('as-weekend')).toHaveCount(0)

  // There is no share button and no "create a link": the PDF already carries
  // the whole schedule as a QR, which is now a link you can tap as well as
  // scan. A second control for the same thing is a second thing to maintain
  // and a second place for the two to disagree.
  await expect(page.getByTestId('as-share')).toHaveCount(0)
})

test('the two icon controls share a row, and the export is below the sheet', async ({ page }) => {
  // Printing is the LAST thing you do, so it is at the end, under the thing
  // it prints — not competing for attention above a sheet nobody has filled
  // in yet.
  await load(page)
  const sheet = (await page.getByTestId('as-sheet').boundingBox())!
  const dl = (await page.getByTestId('as-download').boundingBox())!
  expect(dl.y).toBeGreaterThan(sheet.y + sheet.height)
  // Their CENTRES, not their tops: the row is vertically centred and the
  // three controls are different heights, so equal tops would be the wrong
  // property and would fail against a row that is perfectly fine.
  const mids = await Promise.all(
    ['as-settings', 'as-menu'].map(async (id) => {
      const b = (await page.getByTestId(id).boundingBox())!
      return { mid: b.y + b.height / 2, x: b.x }
    }),
  )
  for (const m of mids) expect(Math.abs(m.mid - mids[0].mid)).toBeLessThan(2)
  expect(mids[0].x).not.toBe(mids[1].x)

  // The icon buttons carry no chrome of their own; asserting the class would
  // be testing Tailwind, so this reads what the browser actually painted.
  for (const id of ['as-settings', 'as-menu']) {
    const bg = await page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
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

test('the day colour shows down both sides of every lesson', async ({ page }) => {
  // The padding is what makes the white cards read as sitting ON the column
  // rather than as holes cut out of it — their rounded corners need the day's
  // colour to blend into on all four sides, not two.
  //
  // It is asserted in PIXELS off the live rects, not as a class. A block is
  // absolutely positioned, and a percentage on one resolves against the
  // PADDING box of its containing block, so `px-1.5` on the column itself
  // moved nothing at all and the cards ran edge to edge. Only the geometry can
  // tell the two arrangements apart.
  await load(page)
  const block = await add(page, 'sun', 'Quran')
  const col = page.getByTestId('as-col-sun')
  const c = (await col.boundingBox())!
  const b = (await block.boundingBox())!
  expect(b.x - c.x).toBeGreaterThanOrEqual(4)
  expect(c.x + c.width - (b.x + b.width)).toBeGreaterThanOrEqual(4)
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

test('a teacher gets a plain sheet of their own lessons, however many subjects', async ({ page }) => {
  // The teacher is recorded per SUBJECT and the sheet is grouped by the
  // NAME, so somebody teaching two subjects gets one sheet with both on it —
  // from either row, because it is the same person either way.
  test.setTimeout(120_000)
  await load(page)
  await add(page, 'sun', 'Quran')
  await add(page, 'sun', 'English')
  await add(page, 'sun', 'Maths')

  await page.getByTestId('as-teacher-0').fill('Marwa')
  // Deliberately a different spelling of one person.
  await page.getByTestId('as-teacher-1').fill('  marwa ')
  await page.getByTestId('as-teacher-2').fill('Sara')

  const sheetFor = async (row: number) => {
    const dl = page.waitForEvent('download', { timeout: 60_000 })
    await page.getByTestId(`as-teacher-pdf-${row}`).click()
    const pdf = readFileSync((await (await dl).path())!)
    const url = decodeQrFromPdf(pdf)
    expect(url, 'the teacher sheet carries no readable QR').toBeTruthy()
    const ctx = await page.context().browser()!.newContext()
    const p2 = await ctx.newPage()
    await p2.goto(url!.replace(/^https?:\/\/[^/]+/, ''))
    await expect(p2.getByTestId('as-sheet')).toBeVisible()
    const names = await p2.locator('[data-testid="as-col-sun"] [data-testid="as-label"]').allInnerTexts()
    const art = await p2.getByTestId('as-art-header').count()
    await ctx.close()
    // The payload itself, because "everything else is a gap" is a property of
    // the AXIS and the axis is re-derived once the sheet is on screen. The
    // printed copy keeps the whole week's hours so a teacher can read their
    // morning against everybody else's.
    const raw = url!.split('#s=')[1]
    const json = JSON.parse(inflateRawSync(
      Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
    ).toString('utf8'))
    return { names: names.sort(), art, from: json.f as number, to: json.e as number }
  }

  const full = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('bis-schedule-draft') || '{}')
    return { from: d.from as number, to: d.to as number }
  })

  const fromQuran = await sheetFor(0)
  expect(fromQuran.names).toEqual(['English', 'Quran'])
  // The hours she is NOT teaching are still on her sheet, as gaps.
  expect({ from: fromQuran.from, to: fromQuran.to }).toEqual(full)
  // Plain paper: a working document, not the chart on the wall.
  expect(fromQuran.art).toBe(0)

  // The SAME sheet from the other subject she teaches.
  const fromEnglish = await sheetFor(1)
  expect(fromEnglish.names).toEqual(fromQuran.names)
})

test('a subject with nobody named cannot be downloaded', async ({ page }) => {
  // The sheet is grouped by the name, so with none there is no teacher to
  // print and nothing to call the file.
  await load(page)
  await add(page, 'sun', 'Quran')
  await expect(page.getByTestId('as-teacher-pdf-0')).toBeDisabled()
  await page.getByTestId('as-teacher-0').fill('Marwa')
  await expect(page.getByTestId('as-teacher-pdf-0')).toBeEnabled()
})

test('the subject list holds each name once, however often it is taught', async ({ page }) => {
  await load(page)
  await add(page, 'sun', 'Quran')
  await add(page, 'mon', 'Quran')
  await add(page, 'tue', 'Maths')
  await expect(page.getByTestId('as-teachers').locator('li')).toHaveCount(2)
})

test('the drawer closes on the dimmed backdrop, not only the X', async ({ page }) => {
  // The backdrop is a CHILD painted over the container, so the container's
  // "was it me that was clicked" check never fired for it — the one part of
  // the screen that most obviously means "I am done here" was the one part
  // that swallowed the click.
  await load(page)
  const block = await add(page, 'sun', 'Quran')
  await block.click()
  await expect(page.getByTestId('as-drawer')).toBeVisible()
  await page.getByTestId('as-drawer-backdrop').click({ position: { x: 5, y: 5 } })
  await expect(page.getByTestId('as-drawer')).toHaveCount(0)
})

test('the blurb belongs to an empty sheet and to nothing else', async ({ page }) => {
  // Hiding it only for a link was half the rule: open a shared sheet, come
  // back later without the hash, and the draft loads with the explanation
  // back on top of it.
  await load(page)
  await expect(page.getByTestId('as-intro')).toBeVisible()
  await add(page, 'sun', 'Quran')
  await expect(page.getByTestId('as-intro')).toHaveCount(0)
  await page.reload()
  await expect(blocks(page, 'sun').first()).toBeVisible()
  await expect(page.getByTestId('as-intro')).toHaveCount(0)
})

test('the axis is derived from the activities, not typed', async ({ page }) => {
  // It used to be two text fields in the settings — a form asking for
  // something the sheet already knows, and wrong in both directions: too
  // narrow and activities fell outside the axis, too wide and the sheet
  // printed a band of empty morning.
  await load(page)
  await expect(page.getByTestId('as-mark-720')).toBeVisible()   // 12:00, the blank default

  await add(page, 'sun', 'Assembly')
  await add(page, 'sun', 'Quran')
  // Two half-hours from 7:00, so the axis stops at 8:00 and the empty hours
  // after it are gone.
  await expect(page.getByTestId('as-mark-480')).toBeVisible()
  await expect(page.getByTestId('as-mark-510')).toHaveCount(0)
  await expect(page.getByTestId('as-mark-720')).toHaveCount(0)

  // Lengthen the last activity and the axis follows it out.
  await blocks(page, 'sun').nth(1).click()
  await page.getByTestId('as-drawer-longer').click()
  await page.getByTestId('as-drawer-longer').click()
  await page.getByTestId('as-drawer-done').click()
  await expect(page.getByTestId('as-mark-510')).toBeVisible()
})

test('the day colour frames a lesson evenly on all four sides', async ({ page }) => {
  // Asserted in PIXELS off the live rects: a block is absolutely positioned,
  // so a percentage on it resolves against the PADDING box of its containing
  // block and padding on the column itself moves nothing. Only the geometry
  // can tell the two arrangements apart — and the top gap was 4px against
  // 10 at the sides, which reads as a mistake rather than as a frame.
  await load(page)
  const block = await add(page, 'sun', 'Quran')
  const c = (await page.getByTestId('as-col-sun').boundingBox())!
  const b = (await block.boundingBox())!
  const left = b.x - c.x
  const right = c.x + c.width - (b.x + b.width)
  const top = b.y - c.y
  expect(left).toBeGreaterThanOrEqual(8)
  expect(Math.abs(right - left)).toBeLessThan(1)
  expect(Math.abs(top - left)).toBeLessThan(1)
})

test('a lesson still lines up with the time it starts at', async ({ page }) => {
  // The frame above the first lesson shifts every block down by its own
  // height, so the axis labels beside it carry the same offset. Without that
  // the padding would silently decouple the lessons from the times they are
  // read against, which is the one thing this layout exists to get right.
  await load(page)
  const block = await add(page, 'sun', 'Quran')
  const start = Number(await block.getAttribute('data-start'))
  const mark = (await page.getByTestId(`as-mark-${start}`).boundingBox())!
  const b = (await block.boundingBox())!
  expect(Math.abs(b.y - (mark.y + mark.height / 2))).toBeLessThan(6)
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

  await page.getByTestId('as-menu').click()
  await page.getByTestId('as-save').click()
  await page.getByTestId('as-new').click()
  await expect(page.getByTestId('as-sheet-title')).not.toHaveText('Term one')

  await page.getByTestId('as-menu').click()
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

  // The link IS the schedule: there is no id to look up and nothing to fetch.
  // That assertion used to live on a share button; the button is gone, so it
  // belongs to the one surface that still hands the link out.
  expect(decoded).toContain('#s=')

  const fresh = await page.context().browser()!.newContext()
  const p2 = await fresh.newPage()
  const bodies: string[] = []
  p2.on('request', (r) => { if (r.postData()) bodies.push(r.url()) })
  await p2.goto(decoded!.replace(/^https?:\/\/[^/]+/, ''))
  await expect(p2.getByTestId('as-sheet-title')).toHaveText('Grade 1B')
  await expect(blocks(p2, 'sun').first()).toContainText('Assembly')
  expect(bodies.filter((u) => !ANALYTICS.test(u))).toEqual([])
  await fresh.close()

  // And the code is a LINK as well as a picture. A printed sheet is read on a
  // screen at least as often as it is photographed, and there a camera is the
  // wrong tool — so the QR carries a URI annotation over exactly its own
  // rectangle.
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.load(pdf)
  const annots = doc.getPage(0).node.Annots()
  const links: string[] = []
  for (let i = 0; i < (annots?.size() ?? 0); i++) {
    const text = String(doc.context.lookup(annots!.get(i)))
    if (text.includes('/Link')) links.push(text)
  }
  expect(links.length, 'the printed QR carries no link annotation').toBe(1)
  expect(links[0]).toContain('#s=')
})
