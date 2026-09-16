import { test, expect, type Page } from '@playwright/test'
import { deflateSync, crc32 } from 'node:zlib'

/**
 * THE FIXTURE HAS TO CONTAIN THE HARD CASES, which this repo has learned six
 * separate times — the lam-alef sentence, the real HEIC, the grainy scan, the
 * asymmetric caption, the checkerboard subject, the flat colour bars a mosaic
 * cannot be seen in. This picture carries two, and each one exists for exactly
 * one property below:
 *
 *  - A CRISP VERTICAL EDGE down the middle, because that is the only thing that
 *    can show a one-degree tilt. A photograph of anything would look tilted to
 *    a person and identical to an assertion.
 *  - A NOISY BAND, because a mosaic of a flat colour is that same flat colour.
 *    A censor drawn over flat paint is undetectable however hard you look, so a
 *    fixture without grain would let the hiding cases pass having hidden
 *    nothing.
 *
 * It is generated rather than committed: it is four lines of arithmetic and a
 * deflate, and a binary blob in the repo is a thing nobody can see the inside
 * of.
 */
const W = 400
const H = 400
/** Where the noisy band sits, in rows. Kept clear of the two rows the tilt is
 *  measured on, or the edge scan would be reading grain. */
const BAND_TOP = 280
const BAND_BOTTOM = 360

function png(): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0, 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit truecolour
  const raw = Buffer.alloc(H * (W * 3 + 1))
  // A fixed generator, so a failure is reproducible and a pass is not luck.
  let seed = 0x2026
  const rnd = () => {
    seed ^= seed << 13; seed >>>= 0
    seed ^= seed >>> 17
    seed ^= seed << 5; seed >>>= 0
    return seed & 0xff
  }
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1)
    raw[row] = 0 // filter: none
    for (let x = 0; x < W; x++) {
      const o = row + 1 + x * 3
      const v = y >= BAND_TOP && y < BAND_BOTTOM ? rnd() : (x < W / 2 ? 30 : 225)
      raw[o] = v; raw[o + 1] = v; raw[o + 2] = v
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BYTES = png()

async function load(page: Page, locale = 'en') {
  await page.goto(`/${locale}/apps/image-edit`)
  await expect(page.getByTestId('image-edit')).toBeVisible()
}

async function pick(page: Page) {
  await page.getByTestId('ie-file').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: BYTES })
  await expect(page.getByTestId('ie-stage')).toBeVisible({ timeout: 20_000 })
}

/**
 * Drag a rectangle on the stage, in fractions of it.
 *
 * `page.mouse` works in raw VIEWPORT coordinates and does not scroll for you,
 * so a point off the screen reaches nothing at all and the failure looks like a
 * tool that ignored the gesture. The guard is on the POINTS rather than on the
 * element's origin — `scrollIntoViewIfNeeded` leaves it flush with the top and
 * sub-pixel rounding reports y at -0.36, which is the false alarm the video
 * editor's first version of this helper raised against three good drags.
 */
async function drawBox(page: Page, from: [number, number], to: [number, number]) {
  await page.getByTestId('ie-stage').scrollIntoViewIfNeeded()
  const box = await page.getByTestId('ie-stage').boundingBox()
  if (!box) throw new Error('no stage')
  const at = (f: [number, number]) => ({ x: box.x + box.width * f[0], y: box.y + box.height * f[1] })
  const a = at(from), b = at(to)
  const view = page.viewportSize()
  for (const pt of [a, b]) {
    if (pt.x < 0 || pt.y < 0 || (view && (pt.x > view.width || pt.y > view.height))) {
      throw new Error(`drag point (${Math.round(pt.x)}, ${Math.round(pt.y)}) is outside the viewport — `
        + 'page.mouse works in viewport coordinates and the event would reach nothing')
    }
  }
  // A CONTROL THAT IS BEHIND ANOTHER CONTROL IS NOT A CONTROL, and only a hit
  // test says so. The editor's chrome — Back, the tool dock, the export button
  // — floats OVER the stage, so a drag aimed near a corner lands on a button
  // and the failure reads as a tool that ignored the gesture. This cost a
  // debugging round before it was added.
  const onStage = await page.evaluate(
    ([x, y]) => {
      let el = document.elementFromPoint(x, y)
      while (el) {
        const id = el.getAttribute('data-testid')
        if (id === 'ie-stage') return true
        if (id) return id
        el = el.parentElement
      }
      return false
    },
    [a.x, a.y],
  )
  expect(onStage, `the drag would start on ${onStage} rather than on the stage`).toBe(true)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2)
  await page.mouse.move(b.x, b.y)
  await page.mouse.up()
}

/** Drag one crop segment by a delta in fractions of the stage. */
async function dragSeg(page: Page, id: string, dx: number, dy: number) {
  const b = (await page.getByTestId('ie-stage').boundingBox())!
  const seg = (await page.getByTestId(`ie-crop-${id}`).boundingBox())!
  const from = { x: seg.x + seg.width / 2, y: seg.y + seg.height / 2 }
  // A control that is BEHIND another control is not a control, and only a hit
  // test says so — this is how the crop chips were found sitting on top of the
  // corner segment in the video editor.
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.getAttribute('data-testid') ?? null,
    [from.x, from.y],
  )
  expect(hit, `segment ${id} is behind ${hit}`).toBe(`ie-crop-${id}`)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + b.width * dx, from.y + b.height * dy, { steps: 8 })
  await page.mouse.up()
}

/** How many DISTINCT colours a region of the stage holds — what a mosaic
 *  destroys, and what a flat fill cannot show. Quantised to 5 bits a channel
 *  so re-encode noise cannot inflate it. */
function coloursIn(page: Page, r: [number, number, number, number], testid = 'ie-result') {
  return page.getByTestId(testid).evaluate((c: HTMLCanvasElement, box) => {
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx || !c.width) return -1
    const x = Math.round(box[0] * c.width), y = Math.round(box[1] * c.height)
    const w = Math.max(1, Math.round((box[2] - box[0]) * c.width))
    const h = Math.max(1, Math.round((box[3] - box[1]) * c.height))
    const px = ctx.getImageData(x, y, w, h).data
    const seen = new Set<number>()
    for (let i = 0; i < px.length; i += 4) {
      seen.add(((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3))
    }
    return seen.size
  }, r)
}

/** Mean brightness of a region of the stage. */
function meanOf(page: Page, r: [number, number, number, number]) {
  return page.getByTestId('ie-result').evaluate((c: HTMLCanvasElement, box) => {
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx || !c.width) return -1
    const x = Math.round(box[0] * c.width), y = Math.round(box[1] * c.height)
    const w = Math.max(1, Math.round((box[2] - box[0]) * c.width))
    const h = Math.max(1, Math.round((box[3] - box[1]) * c.height))
    const px = ctx.getImageData(x, y, w, h).data
    let sum = 0
    for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / 3
    return sum / (px.length / 4)
  }, r)
}

/**
 * Where the dark-to-light edge sits on one row of the stage, in pixels.
 *
 * This is the ONLY observable that can see a one-degree tilt: the fixture's
 * boundary is a straight vertical line, so with the picture square it is at the
 * same column on every row, and with it turned it is not.
 */
function edgeAt(page: Page, yFrac: number) {
  return page.getByTestId('ie-result').evaluate((c: HTMLCanvasElement, y) => {
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx || !c.width) return -1
    const row = Math.min(c.height - 1, Math.max(0, Math.round(y * c.height)))
    const px = ctx.getImageData(0, row, c.width, 1).data
    for (let x = 0; x < c.width; x++) if (px[x * 4] > 128) return x
    return -1
  }, yFrac)
}

/** The exported picture, decoded — the file a reader actually receives, not an
 *  element the tool happened to render. */
async function decodeExport(page: Page): Promise<{ w: number; h: number }> {
  const href = await page.getByTestId('ie-download').getAttribute('href')
  expect(href).toMatch(/^blob:/)
  return page.evaluate((url) => new Promise<{ w: number; h: number }>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve({ w: i.naturalWidth, h: i.naturalHeight })
    i.onerror = () => reject(new Error('the exported file would not decode'))
    i.src = url!
  }), href)
}

/**
 * How far the fixture's straight vertical boundary leans in the EXPORTED file,
 * in pixels of that file.
 *
 * The stage and the export go through one function, which is the architecture
 * this tool rests on — but that is the claim, not the evidence, and it is the
 * claim that broke once already. So this decodes the blob the download button
 * actually points at.
 */
async function exportedLean(page: Page): Promise<number> {
  const href = await page.getByTestId('ie-download').getAttribute('href')
  expect(href).toMatch(/^blob:/)
  return page.evaluate((url) => new Promise<number>((resolve, reject) => {
    const i = new Image()
    i.onload = () => {
      const c = document.createElement('canvas')
      c.width = i.naturalWidth; c.height = i.naturalHeight
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) { reject(new Error('no context')); return }
      ctx.drawImage(i, 0, 0)
      const edge = (yFrac: number) => {
        const row = Math.min(c.height - 1, Math.max(0, Math.round(yFrac * c.height)))
        const px = ctx.getImageData(0, row, c.width, 1).data
        for (let x = 0; x < c.width; x++) if (px[x * 4] > 128) return x
        return -1
      }
      resolve(Math.abs(edge(0.05) - edge(0.95)))
    }
    i.onerror = () => reject(new Error('the exported file would not decode'))
    i.src = url!
  }), href)
}

/** The region of the fixture's noisy band that the cases draw a box over. */
const GRAIN: [number, number, number, number] = [0.06, 0.74, 0.44, 0.86]

test('the first screen asks for a file and nothing else', async ({ page }) => {
  await load(page)
  // Nothing to fiddle with before there is a picture to fiddle with — and the
  // property that would quietly rot if the editor ever rendered its controls
  // over an empty stage.
  await expect(page.getByTestId('ie-stage')).toHaveCount(0)
  await expect(page.getByTestId('ie-tools')).toHaveCount(0)

  await pick(page)
  await expect(page.getByTestId('ie-tools')).toBeVisible()
  await expect(page.getByTestId('ie-result')).toBeVisible()
  await expect(page.getByTestId('ie-export')).toBeVisible()
})

test('the editor takes the whole screen, chrome included', async ({ page }) => {
  await load(page)
  await expect(page.locator('header').first()).toBeVisible()
  await pick(page)

  // Asserted by GEOMETRY rather than by a class name: `ToolPage`'s wrapper
  // leaves a `transform` on itself for good, and a transformed ancestor becomes
  // the containing block for `position: fixed` — so an assertion on `class` or
  // on computed `position` would stay green while the editor was not full
  // screen at all. That is the trap the video editor records paying for.
  const shell = page.getByTestId('ie-fullscreen')
  const box = await shell.boundingBox()
  const view = page.viewportSize()
  expect(box && view).toBeTruthy()
  expect(box!.x).toBeLessThanOrEqual(1)
  expect(box!.y).toBeLessThanOrEqual(1)
  expect(box!.width).toBeGreaterThanOrEqual(view!.width - 1)
  expect(box!.height).toBeGreaterThanOrEqual(view!.height - 1)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
})

test('leaving asks first, and cancelling keeps the work', async ({ page }) => {
  await load(page)
  await pick(page)
  await page.getByTestId('ie-aspect-1:1').click()

  await page.getByTestId('ie-back').click()
  await expect(page.getByTestId('ie-confirm-back')).toBeVisible()
  // Cancelling keeps the EDITOR and the crop. Without this half the case would
  // pass against a dialog whose two buttons did the same thing.
  await page.getByTestId('ie-back-cancel').click()
  await expect(page.getByTestId('ie-fullscreen')).toBeVisible()
  await expect(page.getByTestId('ie-aspect-1:1')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('ie-back').click()
  await page.getByTestId('ie-back-discard').click()
  await expect(page.getByTestId('ie-fullscreen')).toHaveCount(0)
  await expect(page.getByTestId('ie-file')).toHaveCount(1)
})

/** How far the fixture's straight vertical boundary leans across the stage, in
 *  pixels. Square reads 0; one degree reads several. The ONLY observable that
 *  can tell a one-degree tilt from none. */
async function lean(page: Page) {
  return Math.abs((await edgeAt(page, 0.05)) - (await edgeAt(page, 0.95)))
}

test('THE TILT IS ON BY DEFAULT, in EVERY mode, and turning it off makes the picture square', async ({ page }) => {
  await load(page)
  await pick(page)

  // The control is ON THE FRAME, with the other things that change what the
  // picture looks like — not three taps down inside the settings screen. And
  // `aria-pressed` is what says so: colour alone would leave the state
  // unreadable, and asserting a background class would be testing Tailwind.
  await expect(page.getByTestId('ie-tools').getByTestId('ie-tilt')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('ie-tilt-why')).toHaveCount(0)

  // EVERY MODE, and crop first, because crop is the mode a picture OPENS in and
  // it was the one the tilt missed. It used to be a transform inside `compose`,
  // which draws the output; crop mode draws the whole picture and never calls
  // it, so the opening screen of a tool built on "the preview IS the export"
  // showed a square picture and exported a tilted one. Measured at the time:
  // the edge sat at column 200 on both rows here and at 203/197 elsewhere.
  //
  // A case that checked one mode would have passed against exactly that bug —
  // as the first version of this one did, by stepping out of crop mode before
  // measuring. A feature checked only where it works is not checked.
  for (const mode of ['crop', 'censor', 'text'] as const) {
    if (mode !== 'crop') await page.getByTestId(`ie-mode-${mode}`).click()
    await expect.poll(() => lean(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(3)
  }

  // And off, it is square again — in every mode too, which is the half that
  // makes the joke a control rather than a defect. Without it the case would
  // pass against a tool that tilted the picture and could not stop.
  await page.getByTestId('ie-tilt').click()
  await expect(page.getByTestId('ie-tilt')).toHaveAttribute('aria-pressed', 'false')
  for (const mode of ['crop', 'censor', 'text'] as const) {
    await page.getByTestId(`ie-mode-${mode}`).click()
    await expect.poll(() => lean(page), { timeout: 15_000 }).toBeLessThanOrEqual(1)
  }
})

test('the tilt reaches the EXPORTED file, not just the stage', async ({ page }) => {
  await load(page)
  await pick(page)
  // The stage and the export go through one function, but that is the claim
  // rather than the evidence — and it is the claim that broke. So this reads
  // the bytes a reader actually receives.
  await page.getByTestId('ie-export').click()
  await expect(page.getByTestId('ie-download')).toBeVisible({ timeout: 20_000 })
  expect(await exportedLean(page), 'the exported file is not tilted').toBeGreaterThanOrEqual(3)

  // And square when it is off, so the case cannot pass against a tool that
  // tilts everything it writes regardless of the control.
  await page.getByTestId('ie-tilt').click()
  await page.getByTestId('ie-export').click()
  await expect(page.getByTestId('ie-download')).toBeVisible({ timeout: 20_000 })
  expect(await exportedLean(page), 'the export is tilted with the tilt off').toBeLessThanOrEqual(1)
})

test('cropping shows the WHOLE picture; leaving crop mode applies it', async ({ page }) => {
  await load(page)
  await pick(page)

  // The stage keeps the PICTURE's own shape while cropping, whatever the crop
  // is set to: a rectangle cannot be judged without the thing it is taken out
  // of, and showing the result instead makes the picture appear to zoom with
  // nothing on screen to say what is outside it.
  await page.getByTestId('ie-aspect-9:16').click()
  await expect(page.getByTestId('ie-crop-box')).toBeVisible()
  await expect.poll(
    () => page.getByTestId('ie-result').evaluate((c: HTMLCanvasElement) => c.width / c.height),
    { timeout: 15_000 },
  ).toBeCloseTo(1, 1)

  // And the crop rectangle over it is the 9:16 one — much narrower than tall.
  const box = await page.getByTestId('ie-crop-box').boundingBox()
  expect(box!.width / box!.height).toBeLessThan(0.8)

  // Leaving crop mode applies it: the stage IS the output now.
  await page.getByTestId('ie-mode-censor').click()
  await expect(page.getByTestId('ie-crop-box')).toHaveCount(0)
  await expect.poll(
    () => page.getByTestId('ie-result').evaluate((c: HTMLCanvasElement) => c.width / c.height),
    { timeout: 15_000 },
  ).toBeCloseTo(9 / 16, 1)
})

test('a dragged corner SNAPS onto a format, and a shape between two does not', async ({ page }) => {
  await load(page)
  await pick(page)
  await page.getByTestId('ie-aspect-source').click()
  await expect(page.getByTestId('ie-aspect-free')).toHaveCount(0)

  // Pulled a long way in from one edge, the proportion lands nowhere near an
  // offered format and the bar says so — a RESULT, not a mode to switch into.
  await dragSeg(page, 'e', -0.28, 0)
  await expect(page.getByTestId('ie-aspect-free')).toBeVisible()
  await expect(page.getByTestId('ie-aspect-free')).toHaveAttribute('aria-pressed', 'true')

  // And dragged back out onto a format, it SNAPS to it and the Free chip goes:
  // any drag between two formats crosses the ground between them, so a chip
  // left behind would offer a shape the finger was only travelling through.
  // This is the control half — without it the case would pass against a tool
  // that snapped everything to its nearest chip, which is a tool with no free
  // crop at all. It has to be a DRAG rather than a click on the chip: clicking
  // one picks a shape without saying anything about the free one, and the
  // property here is about where a gesture ENDS.
  await dragSeg(page, 'e', 0.28, 0)
  await expect(page.getByTestId('ie-aspect-source')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('ie-aspect-free')).toHaveCount(0)
})

test('the crop segments are NOT mirrored in Arabic', async ({ page }) => {
  for (const locale of ['en', 'ar']) {
    await load(page, locale)
    await pick(page)
    const nw = (await page.getByTestId('ie-crop-nw').boundingBox())!
    const ne = (await page.getByTestId('ie-crop-ne').boundingBox())!
    const sw = (await page.getByTestId('ie-crop-sw').boundingBox())!
    // A PICTURE DOES NOT MIRROR. The ids are physical, and a CSS grid flows its
    // columns right to left under RTL — so without `dir="ltr"` every cell drags
    // the opposite edge of the frame from the one under the finger.
    expect(nw.x, `nw is not west of ne in ${locale}`).toBeLessThan(ne.x)
    expect(nw.y, `nw is not north of sw in ${locale}`).toBeLessThan(sw.y)
  }
})

test('a box destroys the detail under it, and solid is the one that removes the light', async ({ page }) => {
  await load(page)
  await pick(page)
  await page.getByTestId('ie-aspect-source').click()
  await page.getByTestId('ie-mode-censor').click()
  await expect.poll(() => coloursIn(page, GRAIN), { timeout: 15_000 }).toBeGreaterThan(20)
  const before = await coloursIn(page, GRAIN)

  await drawBox(page, [0.05, 0.73], [0.45, 0.87])
  await expect(page.getByTestId('ie-box-0')).toBeVisible()

  // A mosaic is the AVERAGE of what was there, so it keeps the light — that is
  // exactly WHY it leaks — and what it destroys is the count of different
  // values. Reading brightness instead would report nothing happening.
  await expect.poll(() => coloursIn(page, GRAIN), { timeout: 15_000 }).toBeLessThan(before / 3)
  const lit = await meanOf(page, GRAIN)
  expect(lit).toBeGreaterThan(40)

  // Solid is the only one of the three that removes anything, and this is the
  // measurement that distinguishes the modes rather than which button is
  // pressed.
  await page.getByTestId('ie-box-0-settings').click()
  await page.getByTestId('ie-box-mode-solid').click()
  await expect.poll(() => meanOf(page, GRAIN), { timeout: 15_000 }).toBeLessThan(12)
  await expect(page.getByTestId('ie-box-why')).toContainText('nothing left')
  await page.getByTestId('ie-box-panel-close').click()
})

test('the box is burnt into the EXPORTED picture, not just the stage', async ({ page }) => {
  await load(page)
  await pick(page)
  await page.getByTestId('ie-aspect-source').click()
  await page.getByTestId('ie-mode-censor').click()
  await drawBox(page, [0.05, 0.73], [0.45, 0.87])
  await page.getByTestId('ie-box-0-settings').click()
  await page.getByTestId('ie-box-mode-solid').click()
  await page.getByTestId('ie-box-panel-close').click()

  await page.getByTestId('ie-export').click()
  await expect(page.getByTestId('ie-download')).toBeVisible({ timeout: 60_000 })
  const m = await decodeExport(page)
  expect(m.w).toBe(W)
  expect(m.h).toBe(H)

  // Read off the FILE the reader receives. The internal control is the other
  // half of the grain band, uncensored, in the same encoded picture — so this
  // is not a threshold somebody picked.
  const [hidden, control] = await page.evaluate(async (url) => {
    const i = new Image()
    await new Promise((res, rej) => { i.onload = res; i.onerror = rej; i.src = url })
    const c = document.createElement('canvas')
    c.width = i.naturalWidth; c.height = i.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(i, 0, 0)
    const mean = (x0: number, x1: number) => {
      const px = ctx.getImageData(Math.round(x0 * c.width), Math.round(0.76 * c.height),
        Math.round((x1 - x0) * c.width), Math.round(0.08 * c.height)).data
      let sum = 0
      for (let n = 0; n < px.length; n += 4) sum += px[n]
      return sum / (px.length / 4)
    }
    return [mean(0.1, 0.4), mean(0.6, 0.9)]
  }, await page.getByTestId('ie-download').getAttribute('href'))
  expect(hidden).toBeLessThan(12)
  expect(control).toBeGreaterThan(60)
})

test('a caption is typed onto the picture and drawn into it', async ({ page }) => {
  await load(page)
  await pick(page)
  await page.getByTestId('ie-aspect-source').click()
  await page.getByTestId('ie-mode-text').click()
  await expect.poll(() => coloursIn(page, GRAIN), { timeout: 15_000 }).toBeGreaterThan(0)

  // On the DARK half, where white glyphs have somewhere to show.
  const BAND: [number, number, number, number] = [0.02, 0.1, 0.48, 0.3]
  const bare = await coloursIn(page, BAND)
  await drawBox(page, [0.03, 0.12], [0.47, 0.28])
  const field = page.getByTestId('ie-caption-text-0')
  await expect(field).toBeVisible()
  await field.fill('HELLO')

  // Deselect, so the field is no longer standing in for the caption — while it
  // is open the canvas deliberately carries none of it, or the words appear
  // twice offset by however far the two disagree about wrapping.
  await page.getByTestId('ie-stage').click({ position: { x: 5, y: 5 } })
  await expect.poll(() => coloursIn(page, BAND), { timeout: 15_000 }).toBeGreaterThan(bare)
})

test('Arabic in a caption is shaped and joined, not left as separate letters', async ({ page }) => {
  await load(page, 'ar')
  await pick(page)
  await page.getByTestId('ie-aspect-source').click()
  await page.getByTestId('ie-mode-text').click()
  await drawBox(page, [0.03, 0.12], [0.47, 0.28])
  await page.getByTestId('ie-caption-text-0').fill('سلام')

  // The caption is drawn on the PAGE with the page's own fonts, so the browser's
  // text engine shapes it. Isolated letters are WIDER than joined ones, so the
  // ink drawn for a shaped word is narrower than for four separate glyphs —
  // measured as the span of columns that changed rather than as a string.
  await page.getByTestId('ie-stage').click({ position: { x: 5, y: 5 } })
  await expect.poll(() => coloursIn(page, [0.02, 0.1, 0.48, 0.3]), { timeout: 15_000 }).toBeGreaterThan(2)
})

test('the export is the crop, at the cropped size, in the chosen format', async ({ page }) => {
  await load(page)
  await pick(page)
  await page.getByTestId('ie-aspect-1:1').click()
  await page.getByTestId('ie-settings').click()
  await page.getByTestId('ie-side').selectOption('1080')
  // Never upscaled: a 400×400 crop capped at 1080 is still 400×400, which is
  // the honesty `print-size` applies to paper.
  await expect(page.getByTestId('ie-out-size')).toHaveText('400×400')
  await page.getByTestId('ie-settings-close').click()

  await page.getByTestId('ie-export').click()
  await expect(page.getByTestId('ie-download')).toBeVisible({ timeout: 60_000 })
  const m = await decodeExport(page)
  expect(m.w).toBe(400)
  expect(m.h).toBe(400)
  await expect(page.getByTestId('ie-download')).toHaveAttribute('download', /\.png$/)
})

test('the download GOES when the picture changes under it', async ({ page }) => {
  await load(page)
  await pick(page)
  await page.getByTestId('ie-aspect-source').click()
  await page.getByTestId('ie-export').click()
  await expect(page.getByTestId('ie-download')).toBeVisible({ timeout: 60_000 })

  // A green download is a claim that the file behind it is the picture in front
  // of you. Change the crop and it stops being one — so the file goes and the
  // button goes back to offering to make a new one. Keeping it hands somebody
  // the previous version of their own picture, which is the one lie the
  // preview-is-the-export arrangement exists to make impossible.
  //
  // 9:16 rather than 1:1, and the first version of this used 1:1 and failed:
  // the fixture is SQUARE, so 'Original' and '1:1' are the same crop and
  // nothing about the output had changed. The tool was right and the case was
  // asking it to throw away a file that was still correct.
  await page.getByTestId('ie-aspect-9:16').click()
  await expect(page.getByTestId('ie-download')).toHaveCount(0)
  await expect(page.getByTestId('ie-export')).toBeVisible()
})

test('a file that is not a picture is refused WITH A REASON', async ({ page }) => {
  await load(page)
  // A bad pick must say why. A bare return turns "wrong file" into a dead UI,
  // which is the failure this site refuses for every image intake (#225) — and
  // the picker carries no `accept`, so a bad pick is invited rather than rare.
  await page.getByTestId('ie-file').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('this is not a picture'),
  })
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('ie-stage')).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// THE SCISSORS AND THE PLUS — `image-rearrange` folded into the editor.
//
// Both go through `source`, the one picture every view draws from, so the crop,
// the boxes, the captions and the export inherit them with no code of their
// own. These cases read PIXELS rather than handles for exactly that reason: a
// handle proves a rectangle exists on the overlay, and what is being claimed is
// that the picture underneath changed.
// ---------------------------------------------------------------------------

/** A solid picture of a known colour — the second file, where the fixture is
 *  the first. Known colours are what let "a hole was filled" be told apart from
 *  "the added picture landed here" from "nothing happened". */
function solidPng(w: number, h: number, rgb: [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0, 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2
  const raw = Buffer.alloc(h * (w * 3 + 1))
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < w; x++) {
      const o = row + 1 + x * 3
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

const MAGENTA: [number, number, number] = [255, 0, 255]

/** One pixel of the stage, as [r, g, b]. */
function pixelAt(page: Page, fx: number, fy: number) {
  return page.getByTestId('ie-result').evaluate((c: HTMLCanvasElement, f) => {
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx || !c.width) return [-1, -1, -1]
    const x = Math.min(c.width - 1, Math.round(f[0] * c.width))
    const y = Math.min(c.height - 1, Math.round(f[1] * c.height))
    const d = ctx.getImageData(x, y, 1, 1).data
    return [d[0], d[1], d[2]]
  }, [fx, fy])
}

/** One pixel of the EXPORTED file, decoded from the blob the reader gets. */
async function exportedPixelAt(page: Page, fx: number, fy: number) {
  const href = await page.getByTestId('ie-download').getAttribute('href')
  expect(href).toMatch(/^blob:/)
  return page.evaluate(([url, x, y]) => new Promise<number[]>((resolve, reject) => {
    const i = new Image()
    i.onload = () => {
      const c = document.createElement('canvas')
      c.width = i.naturalWidth; c.height = i.naturalHeight
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) { reject(new Error('no context')); return }
      ctx.drawImage(i, 0, 0)
      const d = ctx.getImageData(
        Math.min(c.width - 1, Math.round(Number(x) * c.width)),
        Math.min(c.height - 1, Math.round(Number(y) * c.height)), 1, 1).data
      resolve([d[0], d[1], d[2]])
    }
    i.onerror = () => reject(new Error('the exported file would not decode'))
    i.src = String(url)
  }), [href as string, fx, fy] as const)
}

/** Grab a handle by its testid and drag it to a fraction of the stage. */
async function dragHandle(page: Page, testid: string, to: [number, number]) {
  const stage = (await page.getByTestId('ie-stage').boundingBox())!
  const h = (await page.getByTestId(testid).boundingBox())!
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(stage.x + stage.width * to[0], stage.y + stage.height * to[1], { steps: 8 })
  await page.mouse.up()
}

async function addPicture(page: Page) {
  await page.getByTestId('ie-add-file')
    .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: solidPng(W, H, MAGENTA) })
  // Adding one puts you in cut mode holding it — the mode where it can be moved.
  await expect(page.getByTestId('ie-mode-cut')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('ie-piece-0')).toBeVisible()
}

test('CUTTING A PIECE MOVES IT AND LEAVES A HOLE', async ({ page }) => {
  await load(page)
  await pick(page)
  await page.getByTestId('ie-mode-cut').click()

  // Out of the DARK half, so the white fill left behind is unmistakable and a
  // hole cannot be confused with the picture that was already there.
  expect((await pixelAt(page, 0.2, 0.55))[0]).toBeLessThan(80)
  await drawBox(page, [0.10, 0.45], [0.35, 0.68])
  await expect(page.getByTestId('ie-piece-0')).toBeVisible()

  // Onto the LIGHT half, dragged by its BODY — `drawBox` would refuse, because
  // its hit test correctly reports the start point as the piece rather than the
  // stage, which is exactly the difference between cutting and moving.
  await dragHandle(page, 'ie-piece-0', [0.725, 0.565])

  expect((await pixelAt(page, 0.2, 0.55))[0], 'the cut left no hole behind').toBeGreaterThan(200)
  expect((await pixelAt(page, 0.7, 0.55))[0], 'the piece did not move').toBeLessThan(80)
})

test('…while an ADDED picture leaves none, and is fitted to what it lands on', async ({ page }) => {
  await load(page)
  await pick(page)
  await addPicture(page)

  // Fitted to 40% of the longest side and centred, so it spans 0.3 to 0.7.
  expect(await pixelAt(page, 0.5, 0.5), 'the added picture is not on the stage').toEqual(MAGENTA)

  // THE LOAD-BEARING HALF, and the control for the case above. A cut leaves a
  // hole because it was lifted OUT of the picture; this came from outside. Get
  // that wrong and it does not look like a bug in the added picture — it paints
  // a rectangle of fill through picture nobody asked to remove, at the added
  // file's own natural size, which here is the whole thing.
  const corner = await pixelAt(page, 0.05, 0.05)
  expect(corner, 'adding a picture punched a hole in the one underneath').not.toEqual([255, 255, 255])
  expect(corner, 'the added picture was placed at full size, covering everything').not.toEqual(MAGENTA)
  expect(corner[0], 'the picture changed outside where the addition landed').toBeLessThan(80)
})

test('a piece can be resized, about its own centre', async ({ page }) => {
  await load(page)
  await pick(page)
  await addPicture(page)
  // Spans 0.3–0.7, so this is outside it.
  expect(await pixelAt(page, 0.2, 0.2)).not.toEqual(MAGENTA)

  // The grip is the piece's bottom-right corner at (0.7, 0.7); pulling it to
  // (0.9, 0.9) doubles its distance from the centre, so the piece doubles about
  // that centre and spans 0.1–0.9.
  await dragHandle(page, 'ie-piece-0-resize', [0.9, 0.9])
  expect(await pixelAt(page, 0.2, 0.2), 'the piece did not resize').toEqual(MAGENTA)
  // Uniform: both edges land in the same place. A stretch would have reached
  // further on one axis than the other.
  expect(await pixelAt(page, 0.05, 0.5), 'it grew further sideways than down').not.toEqual(MAGENTA)
  expect(await pixelAt(page, 0.5, 0.05), 'it grew further down than sideways').not.toEqual(MAGENTA)
})

test('a piece can be turned', async ({ page }) => {
  await load(page)
  await pick(page)
  await addPicture(page)
  // Square, spanning 0.3–0.7, so a point just above its top edge is clear of it.
  expect(await pixelAt(page, 0.5, 0.26)).not.toEqual(MAGENTA)

  // A quarter of a right angle puts the square's CORNER where its flat edge
  // was: half-diagonal 0.283 against half-side 0.2, so it reaches 0.217.
  await dragHandle(page, 'ie-piece-0-rotate', [0.7, 0.3])
  expect(await pixelAt(page, 0.5, 0.26), 'the piece did not turn').toEqual(MAGENTA)
})

test('both reach the EXPORTED file, not just the stage', async ({ page }) => {
  await load(page)
  await pick(page)
  await page.getByTestId('ie-mode-cut').click()
  await drawBox(page, [0.10, 0.45], [0.35, 0.68])
  await dragHandle(page, 'ie-piece-0', [0.725, 0.565])
  await addPicture(page)

  await page.getByTestId('ie-export').click()
  await expect(page.getByTestId('ie-download')).toBeVisible({ timeout: 20_000 })

  // The claim this whole editor rests on is that the preview IS the export,
  // and it is the claim that broke once already — so it is read off the blob
  // the download button points at rather than off the canvas.
  expect(await exportedPixelAt(page, 0.5, 0.5), 'the added picture is missing from the export')
    .toEqual(MAGENTA)
  expect((await exportedPixelAt(page, 0.2, 0.55))[0], 'the hole is missing from the export')
    .toBeGreaterThan(200)
  expect((await exportedPixelAt(page, 0.7, 0.55))[0], 'the moved piece is missing from the export')
    .toBeLessThan(80)
})

test('a file that is not a picture is refused by the ADD input too', async ({ page }) => {
  await load(page)
  await pick(page)
  // Two intake paths means two ways to hand the tool something it cannot read,
  // and both must say why rather than doing nothing.
  await page.getByTestId('ie-add-file').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('this is not a picture'),
  })
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('ie-piece-0')).toHaveCount(0)
})
