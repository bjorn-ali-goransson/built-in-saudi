import { test, expect, type Browser, type Page } from '@playwright/test'
import { startRelay, relayContext, type Relay } from './support/relay'

// In a live session, each editor dims the part of the document area that is
// not on everybody's screen, as the call's whiteboard does. The bigger screen
// sees a clear rectangle the size of the smaller screen's document area; the
// smaller screen sees nothing dimmed. The ribbon is never covered.

let relay: Relay
test.beforeAll(async () => { relay = await startRelay() })
test.afterAll(async () => { await relay.close() })

const EDITORS = [
  { id: 'word-editor', area: 'wd-scroll' },
  { id: 'excel-editor', area: 'xl-grid' },
  { id: 'powerpoint-editor', area: 'sl-canvas-wrap' },
] as const

async function session(browser: Browser, id: string): Promise<{ big: Page; small: Page }> {
  const oc = await relayContext(browser, relay, { relayOnly: true })
  const big = await oc.newPage()
  await big.setViewportSize({ width: 1280, height: 860 })
  await big.goto(`/en/apps/${id}/`)
  await big.getByTestId('office-new').click()
  await big.getByTestId('office-share').click()
  await big.getByTestId('collab-start').click()
  const link = await big.getByTestId('collab-link').inputValue()
  await big.getByTestId('sheet-close').click()
  const gc = await relayContext(browser, relay, { relayOnly: true })
  const small = await gc.newPage()
  await small.setViewportSize({ width: 900, height: 640 })
  await small.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await small.getByTestId('collab-name').fill('Omar')
  await small.getByTestId('office-join-go').click()
  return { big, small }
}

for (const ed of EDITORS) {
  test(`${ed.id}: the bigger screen dims what the smaller one cannot see, below the ribbon only`, async ({ browser }) => {
    const { big, small } = await session(browser, ed.id)
    const area = (p: Page) => p.getByTestId(ed.area).evaluate((el) => {
      // The area the overlay measures is the wrapper around the document view.
      const w = el.parentElement!; return { w: w.clientWidth, h: w.clientHeight }
    })
    const clear = big.getByTestId('office-common-view')
    await expect(clear).toBeVisible({ timeout: 30_000 })
    // The smaller screen's area settles after joining (a banner comes and
    // goes), and the clear rectangle follows it: compare the two as they are.
    await expect.poll(async () => {
      const a = await area(small)
      return [await clear.getAttribute('data-w'), await clear.getAttribute('data-h')].join('x') === `${a.w}x${a.h}`
    }, { timeout: 15_000 }).toBe(true)
    // Inside the document area: it starts below the ribbon, not over it.
    const doc = (await big.getByTestId(ed.area).boundingBox())!
    const box = (await clear.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(doc.y - 1)
    const ribbonBottom = await big.evaluate(() => {
      const r = document.querySelector('[role=tablist]') || document.querySelector('[data-testid$="ribbon"]')
      return r ? r.getBoundingClientRect().bottom : 0
    })
    expect(box.y).toBeGreaterThanOrEqual(ribbonBottom)
    // The smaller screen is the common one: nothing dimmed there.
    await expect(small.getByTestId('office-common-view')).toHaveCount(0)
    // And when the bigger one is no smaller than anyone, its dim goes too.
    await big.setViewportSize({ width: 900, height: 640 })
    await expect(clear).toHaveCount(0)
  })
}

test('with nobody else in the session there is nothing to dim', async ({ browser }) => {
  const oc = await relayContext(browser, relay, { relayOnly: true })
  const p = await oc.newPage()
  await p.goto('/en/apps/word-editor/')
  await p.getByTestId('office-new').click()
  await p.getByTestId('office-share').click()
  await p.getByTestId('collab-start').click()
  await p.getByTestId('sheet-close').click()
  await p.waitForTimeout(500)
  await expect(p.getByTestId('office-common-view')).toHaveCount(0)
})

// A phone shows a Word page at fit-to-width (45% or so): it sees the page's whole
// width and a long stretch of it. In screen pixels the desktop dimmed all but a
// strip the phone's width; in document pixels it dims only below what the phone
// can see (a user's report).
test('word-editor: a zoomed-out phone is measured in document pixels, so its whole page width stays clear', async ({ browser }) => {
  const oc = await relayContext(browser, relay, { relayOnly: true })
  const big = await oc.newPage()
  await big.setViewportSize({ width: 1280, height: 860 })
  await big.goto('/en/apps/word-editor/')
  await big.getByTestId('office-new').click()
  await big.getByTestId('office-share').click()
  await big.getByTestId('collab-start').click()
  const link = await big.getByTestId('collab-link').inputValue()
  await big.getByTestId('sheet-close').click()
  const gc = await relayContext(browser, relay, { relayOnly: true })
  const phone = await gc.newPage()
  await phone.setViewportSize({ width: 390, height: 640 })
  await phone.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await phone.getByTestId('collab-name').fill('Omar')
  await phone.getByTestId('office-join-go').click()
  const zoomOf = (p: Page) => p.locator('[data-zoom]').first().getAttribute('data-zoom').then(Number)
  await expect.poll(() => zoomOf(phone), { timeout: 30_000 }).toBeLessThan(0.7)
  const clear = big.getByTestId('office-common-view')
  await expect(clear).toBeVisible({ timeout: 30_000 })
  // Its size is, per side, the smaller of the phone's area over the phone's zoom
  // and ours over our zoom, drawn at our zoom.
  const areaOf = (p: Page) => p.getByTestId('wd-scroll').evaluate((el) => ({ w: el.parentElement!.clientWidth, h: el.parentElement!.clientHeight }))
  await expect.poll(async () => {
    const a = await areaOf(phone), m = await areaOf(big)
    const zp = await zoomOf(phone), zb = await zoomOf(big)
    const w = Number(await clear.getAttribute('data-w')), h = Number(await clear.getAttribute('data-h'))
    const ew = Math.min(Math.round(a.w / zp), m.w / zb) * zb, eh = Math.min(Math.round(a.h / zp), m.h / zb) * zb
    return `${Math.abs(w - ew) <= 3 && Math.abs(h - eh) <= 3} ${w}x${h} vs ${ew}x${eh} (phone ${a.w}x${a.h} @${zp})`
  }, { timeout: 15_000 }).toMatch(/^true/)
  // ...which is wider than the page itself: nothing across the page is dimmed.
  const page = (await big.getByTestId('wd-page').boundingBox())!
  expect((await clear.boundingBox())!.width).toBeGreaterThanOrEqual(page.width)
  await oc.close(); await gc.close()
})
