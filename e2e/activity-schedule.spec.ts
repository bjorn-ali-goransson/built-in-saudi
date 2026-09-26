import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { inflateSync, inflateRawSync } from 'node:zlib'
import jsQRmod from 'jsqr'

const jsQR = (jsQRmod as unknown as { default?: typeof jsQRmod }).default ?? jsQRmod

// Activity Schedule.
//
// The illustrated routine sheet: an icon on every activity, a link that
// carries the whole thing, and the one check the wall charts this was modelled
// on cannot do for themselves — whether the times in a row actually agree.

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

const setTime = async (page: Page, r: number, day: string, v: string) => {
  await page.getByTestId(`as-time-${r}-${day}`).fill(v)
  await page.getByTestId(`as-time-${r}-${day}`).press('Escape')
}

const setName = async (page: Page, r: number, day: string, v: string) => {
  await page.getByTestId(`as-name-${r}-${day}`).fill(v)
  await page.getByTestId(`as-name-${r}-${day}`).press('Escape')
}

/** Sunday, Monday and Tuesday agreeing on one period; Tuesday then moved off it. */
async function rowWithOneOddDay(page: Page) {
  await setName(page, 0, 'sun', 'Assembly')
  await setTime(page, 0, 'sun', '7:00 - 7:30')
  await setName(page, 0, 'mon', 'Assembly')
  await setName(page, 0, 'tue', 'Assembly')
  await setTime(page, 0, 'tue', '9:00 - 9:30')
}

test('a time that disagrees with the rest of its row is named, and says what the row uses', async ({ page }) => {
  // The defect this tool exists for. The sheet it was built from had four rows
  // where one day had drifted, and nobody reads a wall chart column by column.
  await load(page)
  await rowWithOneOddDay(page)

  const hint = page.getByTestId('as-hint-0-tue')
  await expect(hint).toBeVisible()
  await expect(hint).toHaveAttribute('data-trouble', 'odd')
  await expect(hint).toContainText('7:00 - 7:30')

  // And the days that agree are NOT flagged — without this the check could be
  // "flag everything" and the first assertion would still pass.
  await expect(page.getByTestId('as-hint-0-sun')).toHaveCount(0)
  await expect(page.getByTestId('as-hint-0-mon')).toHaveCount(0)
})

test('the fix button puts the odd day back on the row’s time', async ({ page }) => {
  await load(page)
  await rowWithOneOddDay(page)
  await page.getByTestId('as-fix-0-tue').click()
  await expect(page.getByTestId('as-time-0-tue')).toHaveValue('7:00 - 7:30')
  await expect(page.getByTestId('as-hint-0-tue')).toHaveCount(0)
})

test('a row with no majority suggests nothing', async ({ page }) => {
  // Two days saying one thing and two saying another is a row with no
  // consensus. Picking the first would be inventing one — and a check that
  // did would pass every other case in this file.
  await load(page)
  await setName(page, 0, 'sun', 'A')
  await setTime(page, 0, 'sun', '7:00 - 7:30')
  await setName(page, 0, 'mon', 'B')
  await setTime(page, 0, 'mon', '7:00 - 7:30')
  await setName(page, 0, 'tue', 'C')
  await setTime(page, 0, 'tue', '9:00 - 9:30')
  await setName(page, 0, 'wed', 'D')
  await setTime(page, 0, 'wed', '9:00 - 9:30')

  for (const d of ['sun', 'mon', 'tue', 'wed']) {
    await expect(page.getByTestId(`as-hint-0-${d}`)).toHaveCount(0)
  }
})

test('a range that ends where it starts is caught on its own, with no row to compare against', async ({ page }) => {
  // `9:30 – 9:30` and `10:45 – 10:45` were both on the reference sheet. This
  // is the half the row check structurally cannot see: the typo can be the
  // only entry in its row.
  await load(page)
  await setName(page, 1, 'sun', 'Snack')
  await setTime(page, 1, 'sun', '9:30 - 9:30')
  await expect(page.getByTestId('as-hint-1-sun')).toHaveAttribute('data-trouble', 'zero')

  await setTime(page, 1, 'sun', '11:00 - 10:00')
  await expect(page.getByTestId('as-hint-1-sun')).toHaveAttribute('data-trouble', 'backwards')

  await setTime(page, 1, 'sun', '9:30 - 10:00')
  await expect(page.getByTestId('as-hint-1-sun')).toHaveCount(0)
})

test('one aligning pass fixes a row where several days drifted', async ({ page }) => {
  await load(page)
  await setName(page, 0, 'sun', 'Quran')
  await setTime(page, 0, 'sun', '8:00 - 8:30')
  await setName(page, 0, 'mon', 'Quran')
  await setTime(page, 0, 'mon', '8:00 - 8:30')
  await setName(page, 0, 'tue', 'Quran')
  await setTime(page, 0, 'tue', '8:15 - 8:30')
  await setName(page, 0, 'wed', 'Quran')
  await setTime(page, 0, 'wed', '8:05 - 8:30')

  await expect(page.getByTestId('as-harmony-count')).toContainText('2')
  await page.getByTestId('as-align-all').click()
  await expect(page.getByTestId('as-time-0-tue')).toHaveValue('8:00 - 8:30')
  await expect(page.getByTestId('as-time-0-wed')).toHaveValue('8:00 - 8:30')
  await expect(page.getByTestId('as-harmony')).toHaveCount(0)
})

test('the time set once spreads across the row, in either typing order', async ({ page }) => {
  // The reason the harmony check is rarely needed in the first place: setting
  // the period once is the normal case, and a cell typed afterwards inherits
  // it too — people set the times first as often as the activities first.
  await load(page)
  await setName(page, 2, 'sun', 'English')
  await setName(page, 2, 'mon', 'English')
  await setTime(page, 2, 'sun', '10:00 - 10:30')
  await expect(page.getByTestId('as-time-2-mon')).toHaveValue('10:00 - 10:30')

  await setName(page, 2, 'tue', 'English')
  await expect(page.getByTestId('as-time-2-tue')).toHaveValue('10:00 - 10:30')
})

test('an icon is guessed from the words in the name', async ({ page }) => {
  await load(page)
  await setName(page, 0, 'sun', 'قرآن')
  await expect(page.getByTestId('as-icon-0-sun')).toContainText('📖')
})

test('the icon chosen for an activity comes back for the same name — in a LATER schedule', async ({ page }) => {
  // The headline of the tool: choosing once teaches it, and the memory spans
  // every sheet rather than the open one.
  await load(page)
  await setName(page, 0, 'sun', 'Circle time')
  await page.getByTestId('as-icon-0-sun').click()
  await page.getByTestId('as-icon-0-sun-pick-🧩').click()
  await expect(page.getByTestId('as-icon-0-sun')).toContainText('🧩')

  await page.getByTestId('as-save').click()
  await page.getByTestId('as-new').click()

  await setName(page, 3, 'thu', 'Circle time')
  await expect(page.getByTestId('as-icon-3-thu')).toContainText('🧩')
})

test('a chosen icon outranks the guess', async ({ page }) => {
  // A guess that overrules a choice is the tool arguing about somebody's own
  // sheet. «قرآن» would be guessed 📖; it must stay as chosen.
  await load(page)
  await setName(page, 0, 'sun', 'قرآن')
  await page.getByTestId('as-icon-0-sun').click()
  await page.getByTestId('as-icon-0-sun-pick-🎵').click()
  await setName(page, 1, 'mon', 'قرآن')
  await expect(page.getByTestId('as-icon-1-mon')).toContainText('🎵')
})

test('the suggestions under an activity box come from an earlier SAVED schedule', async ({ page }) => {
  await load(page)
  await setName(page, 0, 'sun', 'Mathematics')
  await page.getByTestId('as-save').click()
  await page.getByTestId('as-new').click()

  const box = page.getByTestId('as-name-1-mon')
  await box.click()                       // opens on FOCUS, not on the first keystroke
  const list = page.getByTestId('as-name-1-mon-list')
  await expect(list).toBeVisible()
  await expect(list).toContainText('Mathematics')
  await page.getByTestId('as-name-1-mon-opt-0').click()
  await expect(box).toHaveValue('Mathematics')
})

test('picking a suggestion brings its icon with it', async ({ page }) => {
  await load(page)
  await setName(page, 0, 'sun', 'Story')
  await page.getByTestId('as-icon-0-sun').click()
  await page.getByTestId('as-icon-0-sun-pick-🧸').click()

  await page.getByTestId('as-name-2-wed').click()
  await page.getByTestId('as-name-2-wed-opt-0').click()
  await expect(page.getByTestId('as-name-2-wed')).toHaveValue('Story')
  await expect(page.getByTestId('as-icon-2-wed')).toContainText('🧸')
})

test('the share link carries the whole sheet, and opening it fetches nothing', async ({ page }) => {
  await load(page)
  await setName(page, 0, 'sun', 'Assembly')
  await setTime(page, 0, 'sun', '7:00 - 7:30')
  await page.getByTestId('as-title').fill('Grade 1B')

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByTestId('as-share').click()
  const shared = await page.evaluate(() => navigator.clipboard.readText())
  expect(shared).toContain('#s=')

  // A clean context, so nothing can come from localStorage.
  const fresh = await page.context().browser()!.newContext()
  const p2 = await fresh.newPage()
  const bodies: string[] = []
  p2.on('request', (r) => { if (r.postData()) bodies.push(r.url()) })
  await p2.goto(shared)
  await expect(p2.getByTestId('as-from-link')).toBeVisible()
  await expect(p2.getByTestId('as-title')).toHaveValue('Grade 1B')
  await expect(p2.getByTestId('as-name-0-sun')).toHaveValue('Assembly')
  await expect(p2.getByTestId('as-time-0-sun')).toHaveValue('7:00 - 7:30')
  expect(bodies.filter((u) => !/analytics|googletagmanager|google-analytics/.test(u))).toEqual([])
  await fresh.close()
})

test('a saved schedule can be reopened and deleted', async ({ page }) => {
  await load(page)
  await page.getByTestId('as-title').fill('Term one')
  await setName(page, 0, 'sun', 'Assembly')
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

test('what was typed survives a reload without being saved', async ({ page }) => {
  await load(page)
  await setName(page, 1, 'tue', 'Art')
  await page.reload()
  await expect(page.getByTestId('as-name-1-tue')).toHaveValue('Art')
})

/**
 * The day cards LEFT TO RIGHT on screen — geometry, not DOM order.
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

test('in Arabic Sunday is the RIGHTMOST card, where the reader starts', async ({ page }) => {
  await load(page, 'ar')
  expect(await cardOrder(page)).toEqual(['thu', 'wed', 'tue', 'mon', 'sun'])
  await expect(page.getByTestId('as-head-sun')).toContainText('الأحد')
})

test('in English Sunday is the leftmost card', async ({ page }) => {
  await load(page)
  expect(await cardOrder(page)).toEqual(['sun', 'mon', 'tue', 'wed', 'thu'])
})

test('the weekend is added at the END of the week', async ({ page }) => {
  await load(page)
  await page.getByTestId('as-weekend').check()
  expect(await cardOrder(page)).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
  await load(page, 'ar')
  await page.getByTestId('as-weekend').check()
  expect(await cardOrder(page)).toEqual(['sat', 'fri', 'thu', 'wed', 'tue', 'mon', 'sun'])
})

test('a hint moves every day in that row down together', async ({ page }) => {
  // A row is a period shared across the week, so the cells of one row have to
  // stay in the same band. Before subgrid each card stacked its own rows, so a
  // hint grew one cell and slid every row below it out of step with the other
  // four days — which is the sheet contradicting the idea it is built on.
  await load(page)
  await rowWithOneOddDay(page)
  await expect(page.getByTestId('as-hint-0-tue')).toBeVisible()

  const tops = await page.evaluate(() => ['sun', 'mon', 'tue', 'wed', 'thu']
    .map((d) => Math.round(document.querySelector(`[data-testid="as-cell-1-${d}"]`)!.getBoundingClientRect().top)))
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1)
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
  await setName(page, 0, 'sun', 'Assembly')
  await setTime(page, 0, 'sun', '7:00 - 7:30')
  await page.getByTestId('as-title').fill('Grade 1B')
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  expect((await dl).suggestedFilename()).toBe('Grade-1B.pdf')
  await expect(page.getByTestId('as-qr-problem')).toHaveCount(0)
})

test('the Arabic PDF is produced too', async ({ page }) => {
  await load(page, 'ar')
  await setName(page, 0, 'sun', 'قرآن')
  await setTime(page, 0, 'sun', '8:00 - 8:30')
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  expect((await dl).suggestedFilename()).toMatch(/\.pdf$/)
})

/**
 * Write a sheet straight into the draft, to reach sizes typing cannot.
 *
 * `distinct` is the whole variable. A real sheet repeats one activity across
 * the week; the dictionary in the encoding collapses that and deflate removes
 * what is left, so an 80-row Arabic schedule is still only 1,239 bytes and a
 * 52mm code. Only a sheet where every single cell differs — which no wall
 * chart is — gets anywhere near the ceiling, and it takes 32 rows of it.
 */
const seedSheet = async (page: Page, rows: number, distinct: boolean) => {
  await page.evaluate(({ rows, distinct }) => {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu']
    const words = ['طابور وأذكار الصباح', 'قرآن', 'رياضيات', 'إنجليزي', 'وجبة', 'أركان', 'لعب حر', 'انصراف']
    localStorage.setItem('bis-schedule-draft', JSON.stringify({
      id: 'big', title: 'الجدول الأسبوعي', note: 'أيام الدراسة', art: true, updated: Date.now(), days,
      rows: Array.from({ length: rows }, (_, r) => ({
        cells: Object.fromEntries(days.map((d, i) => [d, {
          name: distinct ? `${words[(r * 5 + i) % words.length]} ${r * 5 + i}` : words[r % words.length],
          icon: '📖',
          time: `${7 + Math.floor(r / 2)}:${r % 2 ? '30' : '00'} - ${8 + Math.floor(r / 2)}:${r % 2 ? '30' : '00'}`,
        }])),
      })),
    }))
  }, { rows, distinct })
  await page.reload()
  await expect(page.getByTestId('activity-schedule')).toBeVisible()
}

test('a normal sheet, even a very long one, still gets its QR', async ({ page }) => {
  // The measurement the ceiling is set against: 24 rows of Arabic, one
  // activity per row, deflates to 700 bytes — an 89-module code, 41mm, well
  // inside the 60mm the sheet allows. Without this the refusals below could be
  // satisfied by a tool that never manages a QR at all.
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
  await seedSheet(page, 40, true)
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  await dl
  await expect(page.getByTestId('as-qr-problem')).toHaveAttribute('data-why', 'too-dense')
})

test('a sheet past the 2,953-byte QR limit says THAT instead', async ({ page }) => {
  // A different refusal with a different remedy, so it gets a different
  // message: past this there is no code at all, at any size.
  await load(page, 'ar')
  await seedSheet(page, 80, true)
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.getByTestId('as-download').click()
  await dl
  await expect(page.getByTestId('as-qr-problem')).toHaveAttribute('data-why', 'too-long')
})

test('the QR on the printed sheet decodes, and reopens the same schedule', async ({ page }) => {
  // A QR nobody has decoded is a picture, and this one was — twice. It is read
  // out of the PDF ITSELF rather than the canvas it was composed from, because
  // the code is embedded as its own high-resolution image and the canvas no
  // longer carries it; and with jsQR, so the check is not our encoder agreeing
  // with itself.
  await load(page)
  await page.getByTestId('as-title').fill('Grade 1B')
  await setName(page, 0, 'sun', 'Assembly')
  await setTime(page, 0, 'sun', '7:00 - 7:30')
  await setName(page, 1, 'mon', 'Quran')

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
  await expect(p2.getByTestId('as-name-0-sun')).toHaveValue('Assembly')
  await expect(p2.getByTestId('as-name-1-mon')).toHaveValue('Quran')
  await fresh.close()
})

test('it says why it checks a row, and why the link is large', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('as-why-harmony')).toContainText('wall chart')
  await expect(page.getByTestId('as-why-share')).toContainText('never sent to a server')
})
