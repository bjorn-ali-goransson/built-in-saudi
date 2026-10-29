import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { zipPart, zipNames } from './helpers'
import { startRelay, relayContext, type Relay } from './support/relay'

// The presentation editor. A claim that something was SAVED is read back through
// a different path than the one that wrote it: the IndexedDB record, the
// exported file's own XML, or the other browser in a live session.
const FIX = 'src/tools/powerpoint-editor/io/__fixtures__/'
const slideEl = (p: Page) => p.getByTestId('sl-slide')

type Run = { t: string; b?: boolean; i?: boolean; size?: number; color?: string; link?: string }
type Para = { runs: Run[]; bullet?: string | null; level?: number; align?: string; rtl?: boolean }
type El = { id: string; kind: string; geom?: string; ph?: string; x: number; y: number; w: number; h: number; rot?: number; text?: { paras: Para[] }; fill?: { type: string; color?: string }; media?: string; rows?: { cells: { text: { paras: Para[] } }[] }[] }
type Slide = { id: string; ord: string; layout?: string; elements: El[]; notes?: string; hidden?: boolean; transition?: { kind: string } }
type Deck = { slides: Slide[]; theme: { name: string; colors: Record<string, string> }; media: Record<string, { mime: string }>; rtl?: boolean }
type Stored = { title: string; data: Deck }

async function newBlank(p: Page, locale = 'en') {
  await p.goto(`/${locale}/apps/powerpoint-editor/`)
  await p.getByTestId('office-new').click()
  await expect(slideEl(p)).toBeVisible()
}
async function saved(p: Page) { await expect(p.getByTestId('office-status')).toHaveAttribute('data-status', 'saved') }
/** The stored decks, read straight from IndexedDB — not from the screen. */
async function stored(p: Page): Promise<Stored[]> {
  return p.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('bis-docs')
    r.onerror = () => reject(r.error)
    r.onsuccess = () => {
      const tx = r.result.transaction('docs', 'readonly').objectStore('docs').getAll()
      tx.onsuccess = () => resolve((tx.result as { kind: string }[]).filter((d) => d.kind === 'powerpoint') as never)
    }
  }))
}
async function storedDeck(p: Page): Promise<Deck> { await saved(p); return (await stored(p))[0].data }
const byOrd = (d: Deck) => [...d.slides].sort((a, b) => (a.ord < b.ord ? -1 : 1))
const txt = (e?: El) => (e?.text?.paras || []).map((pa) => pa.runs.map((r) => r.t).join('')).join('\n')
const ph = (s: Slide, k: string) => s.elements.find((e) => e.ph === k)

test('a blank deck: click the title prompt, type, and it reaches the stored deck', async ({ page: p }) => {
  await newBlank(p)
  await expect(p.getByTestId('sl-count')).toContainText('1')
  // The prompt is drawn, never stored.
  await expect(slideEl(p).getByTestId('sl-prompt').first()).toBeVisible()
  await slideEl(p).getByTestId('sl-prompt').first().click()
  await expect(p.getByTestId('sl-text-editor')).toBeVisible()
  await p.keyboard.type('Quarterly review')
  await p.keyboard.press('Escape')
  await expect(p.getByTestId('sl-text-editor')).toHaveCount(0)
  const d = await storedDeck(p)
  expect(d.slides).toHaveLength(1)
  const s = d.slides[0]
  expect(txt(ph(s, 'ctrTitle') || ph(s, 'title'))).toBe('Quarterly review')
  // The other placeholder stays EMPTY in the data — its prompt is not content.
  expect(s.elements.filter((e) => e.ph).map(txt).filter((t) => /click/i.test(t))).toEqual([])
})

/** The canvas scale: screen pixels per slide point. */
async function scale(p: Page) { const b = (await slideEl(p).boundingBox())!; return { k: b.width / 960, b } }
/** A point on the slide, in slide points, as screen coordinates. */
async function at(p: Page, x: number, y: number) { const { k, b } = await scale(p); return { x: b.x + x * k, y: b.y + y * k } }
async function drag(p: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await p.mouse.move(from.x, from.y)
  await p.mouse.down()
  await p.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
  await p.mouse.move(to.x, to.y, { steps: 4 })
  await p.mouse.up()
}
const current = (d: Deck, i = 0) => byOrd(d)[i]
async function addShape(p: Page, geom = 'rect', x = 480, y = 300) {
  await p.getByTestId('tab-insert').click()
  await p.getByTestId('sl-insert-shape').click()
  await p.getByTestId(`sl-shape-${geom}`).click()
  const pt = await at(p, x, y)
  await p.mouse.click(pt.x, pt.y)
  await expect(p.getByTestId('sl-selected')).toHaveCount(1)
}

test('a text box: drawn from Insert, typed into, bold with Ctrl+B — the run is bold in storage', async ({ page: p }) => {
  await newBlank(p)
  await p.getByTestId('tab-insert').click()
  await p.getByTestId('sl-insert-text').click()
  await expect(p.locator('[data-tool="text"]')).toHaveCount(1)
  const pt = await at(p, 100, 420)
  await p.mouse.click(pt.x, pt.y)
  await expect(p.getByTestId('sl-text-editor')).toBeVisible()
  await p.keyboard.type('Plain ')
  await p.keyboard.press('Control+b')
  await p.keyboard.type('loud')
  await p.keyboard.press('Escape')
  const d = await storedDeck(p)
  const box = current(d).elements.find((e) => !e.ph && e.kind === 'shape')!
  expect(Math.round(box.x)).toBe(100)
  expect(box.text!.paras[0].runs).toEqual([{ t: 'Plain ' }, { t: 'loud', b: true }])
})

test('a shape: inserted, moved by dragging and resized from a handle — in slide points', async ({ page: p }) => {
  await newBlank(p)
  await addShape(p, 'roundRect')
  let d = await storedDeck(p)
  const el0 = current(d).elements.find((e) => e.geom === 'roundRect')!
  expect([el0.x, el0.y, el0.w, el0.h]).toEqual([400, 250, 160, 100])
  // Move by 100 points right and 40 down; Alt turns snapping off so the arithmetic is exact.
  const from = await at(p, el0.x + 80, el0.y + 50)
  const to = await at(p, el0.x + 180, el0.y + 90)
  await p.keyboard.down('Alt')
  await drag(p, from, to)
  await p.keyboard.up('Alt')
  await expect.poll(async () => { const e = current(await storedDeck(p)).elements.find((x) => x.id === el0.id)!; return [Math.round(e.x), Math.round(e.y)] }).toEqual([500, 290])
  // Resize from the bottom-right corner handle.
  const h = (await p.getByTestId('sl-handle-se').boundingBox())!
  const { k } = await scale(p)
  await drag(p, { x: h.x + h.width / 2, y: h.y + h.height / 2 }, { x: h.x + h.width / 2 + 40 * k, y: h.y + h.height / 2 + 20 * k })
  await expect.poll(async () => { const e = current(await storedDeck(p)).elements.find((x) => x.id === el0.id)!; return [Math.round(e.w), Math.round(e.h)] }).toEqual([200, 120])
  // The arrow keys nudge a selection one point at a time.
  await p.keyboard.press('ArrowLeft')
  await p.keyboard.press('ArrowLeft')
  await expect.poll(async () => Math.round(current(await storedDeck(p)).elements.find((x) => x.id === el0.id)!.x)).toBe(498)
  d = await storedDeck(p)
  expect(current(d).elements.find((x) => x.id === el0.id)!.fill).toEqual({ type: 'solid', color: 'accent1' })
})

test('typing over a selected box starts editing it, without double-clicking', async ({ page: p }) => {
  await newBlank(p)
  await addShape(p, 'ellipse')
  await p.keyboard.type('Go')
  await expect(p.getByTestId('sl-text-editor')).toBeVisible()
  await p.keyboard.press('Escape')
  let d = await storedDeck(p)
  const ell = current(d).elements.find((e) => e.geom === 'ellipse')!
  expect(txt(ell)).toBe('Go')
  // A double-click puts the caret in it too — after a press that may have begun a drag.
  await p.keyboard.press('Escape')
  const c = await at(p, ell.x + ell.w / 2, ell.y + ell.h / 2)
  await p.mouse.dblclick(c.x, c.y)
  await expect(p.getByTestId('sl-text-editor')).toBeVisible()
  await p.keyboard.press('End')
  await p.keyboard.type('!')
  await p.keyboard.press('Escape')
  d = await storedDeck(p)
  expect(txt(current(d).elements.find((e) => e.geom === 'ellipse'))).toBe('Go!')
})

test('slides: new from a layout, Ctrl+M, duplicate, reorder by dragging, delete from the menu', async ({ page: p }) => {
  await newBlank(p)
  await p.getByTestId('sl-new-slide').click()
  await p.getByTestId('sl-layout-titleContent').click()
  await expect(p.getByTestId('sl-thumb')).toHaveCount(2)
  await expect(p.getByTestId('sl-count')).toContainText('2')
  await slideEl(p).getByTestId('sl-prompt').first().click()
  await p.keyboard.type('Second')
  await p.keyboard.press('Escape')
  await p.keyboard.press('Escape')
  await p.keyboard.press('Control+m')
  await expect(p.getByTestId('sl-thumb')).toHaveCount(3)
  let d = await storedDeck(p)
  expect(byOrd(d).map((s) => s.layout)).toEqual(['title', 'titleContent', 'titleContent'])
  expect(txt(ph(byOrd(d)[1], 'title'))).toBe('Second')
  // Drag the second slide to the end.
  const t = p.getByTestId('sl-thumb')
  const a = (await t.nth(1).boundingBox())!, z = (await t.nth(2).boundingBox())!
  await drag(p, { x: a.x + a.width / 2, y: a.y + a.height / 2 }, { x: z.x + z.width / 2, y: z.y + z.height - 4 })
  await expect.poll(async () => byOrd(await storedDeck(p)).map((s) => txt(ph(s, 'title')))).toEqual(['', '', 'Second'])
  // Delete it from the slide's own menu.
  await t.nth(2).click({ button: 'right' })
  await p.getByTestId('sl-menu-del').click()
  await expect(p.getByTestId('sl-thumb')).toHaveCount(2)
  d = await storedDeck(p)
  expect(d.slides.map((s) => txt(ph(s, 'title')))).not.toContain('Second')
})

test('undo takes my last change back, redo restores it', async ({ page: p }) => {
  await newBlank(p)
  await addShape(p, 'rect')
  // The blank slide's placeholders are rectangles too, so look for the one that is not a placeholder.
  const has = async () => current(await storedDeck(p)).elements.some((e) => e.geom === 'rect' && !e.ph)
  await p.keyboard.press('Delete')
  await expect.poll(has).toBe(false)
  await p.keyboard.press('Control+z')
  await expect.poll(has).toBe(true)
  await p.keyboard.press('Control+z')
  await expect.poll(has).toBe(false)
  await p.keyboard.press('Control+y')
  await expect.poll(has).toBe(true)
})

test('a theme recolours what follows it: the stored fill is the SLOT, the painted colour changes', async ({ page: p }) => {
  await newBlank(p)
  await addShape(p, 'rect')
  const id = await p.getByTestId('sl-selected').getAttribute('data-id')
  const el = p.getByTestId('sl-slide').locator(`[data-el="${id}"] path`).first()
  const before = await el.evaluate((n) => getComputedStyle(n).fill)
  await p.getByTestId('tab-design').click()
  await p.getByTestId('sl-theme-Sunset').click()
  await expect.poll(() => el.evaluate((n) => getComputedStyle(n).fill)).not.toBe(before)
  const d = await storedDeck(p)
  expect(d.theme.name).toBe('Sunset')
  expect(current(d).elements.find((e) => e.geom === 'rect' && !e.ph)!.fill).toEqual({ type: 'solid', color: 'accent1' })
})

test('a table: picked from the grid, typed into by double-clicking a cell, grown from the Table tab', async ({ page: p }) => {
  await newBlank(p)
  await p.getByTestId('tab-insert').click()
  await p.getByTestId('sl-insert-table').click()
  await p.getByTestId('sl-table-2x3').click()
  let d = await storedDeck(p)
  const t0 = current(d).elements.find((e) => e.kind === 'table')!
  expect(t0.rows!.map((r) => r.cells.length)).toEqual([3, 3])
  await slideEl(p).locator(`[data-el="${t0.id}"] [data-cell="1:2"]`).dblclick()
  await expect(p.getByTestId('sl-text-editor')).toBeVisible()
  await p.keyboard.type('135')
  await p.keyboard.press('Escape')
  await p.getByTestId('tab-table').click()
  await p.getByTestId('sl-row-below').click()
  d = await storedDeck(p)
  const t = current(d).elements.find((e) => e.kind === 'table')!
  expect(t.rows!.length).toBe(3)
  expect(t.rows![1].cells[2].text.paras.map((pa) => pa.runs.map((r) => r.t).join('')).join('')).toBe('135')
})

test('a picture is stored once in the deck; a file that is not a picture says why', async ({ page: p }) => {
  await newBlank(p)
  await p.getByTestId('sl-picture-input').setInputFiles('e2e/fixtures/diff-a.png')
  await expect(p.getByTestId('sl-selected')).toHaveCount(1)
  const d = await storedDeck(p)
  const img = current(d).elements.find((e) => e.kind === 'image')!
  expect(d.media[img.media!].mime).toBe('image/png')
  await p.getByTestId('sl-picture-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(p.getByTestId('sl-toast')).toBeVisible()
})

test('speaker notes are kept with their slide', async ({ page: p }) => {
  await newBlank(p)
  await p.getByTestId('sl-notes').fill('Pause for questions')
  await expect.poll(async () => current(await storedDeck(p)).notes).toBe('Pause for questions')
  await expect(p.getByTestId('sl-notes')).toHaveCSS('font-family', /Plex|sans/i)
})

test('copy and paste an element onto another slide, keeping its look', async ({ page: p }) => {
  await newBlank(p)
  await addShape(p, 'star5')
  await p.keyboard.press('Control+c')
  await p.keyboard.press('Escape')
  await p.keyboard.press('Control+m')
  await expect(p.getByTestId('sl-thumb')).toHaveCount(2)
  await slideEl(p).click({ position: { x: 5, y: 5 } })
  await p.keyboard.press('Control+v')
  await expect.poll(async () => byOrd(await storedDeck(p))[1].elements.filter((e) => e.geom === 'star5').length).toBe(1)
  const d = await storedDeck(p)
  const [a, b] = [byOrd(d)[0], byOrd(d)[1]].map((s) => s.elements.find((e) => e.geom === 'star5')!)
  expect(b.id).not.toBe(a.id)
  expect([b.w, b.h, b.fill]).toEqual([a.w, a.h, a.fill])
})

test('find and replace across every slide', async ({ page: p }) => {
  await p.goto('/en/apps/powerpoint-editor/')
  await p.getByTestId('office-template-pitch').click()
  await expect(slideEl(p)).toBeVisible()
  await p.keyboard.press('Control+f')
  await p.getByTestId('sl-find-input').fill('coffee')
  await expect(p.getByTestId('sl-find-count')).toContainText('of')
  await p.getByTestId('sl-replace-input').fill('tea')
  await p.getByTestId('sl-replace-all').click()
  await expect.poll(async () => { const d = await storedDeck(p); return d.slides.flatMap((s) => s.elements.map(txt)).join(' ') }).not.toMatch(/coffee/i)
  const d = await storedDeck(p)
  expect(d.slides.flatMap((s) => s.elements.map(txt)).join(' ')).toContain('tea')
})

test('opening a real .pptx from python-pptx: titles, notes, a hidden slide, and what did not come across', async ({ page: p }) => {
  await p.goto('/en/apps/powerpoint-editor/')
  await p.getByTestId('office-file-input').setInputFiles(FIX + 'python-pptx.pptx')
  await expect(p.getByTestId('office-loss')).toBeVisible()
  await expect(p.getByTestId('office-loss-list')).toContainText(/chart/i)
  await p.getByTestId('office-loss-ok').click()
  await expect(p.getByTestId('sl-thumb')).toHaveCount(5)
  await expect(p.getByTestId('sl-thumb').nth(4).getByTestId('sl-thumb-hidden')).toBeVisible()
  await expect(slideEl(p)).toContainText('Product launch')
  await expect(p.getByTestId('sl-notes')).toHaveValue('Welcome everyone.')
  const d = await storedDeck(p)
  expect(byOrd(d).map((s) => txt(ph(s, 'title') || ph(s, 'ctrTitle')))).toEqual(['Product launch', 'Agenda', 'Shapes and a table', '', 'Hidden slide'])
})

test('opening a .pptx written by LibreOffice', async ({ page: p }) => {
  await p.goto('/en/apps/powerpoint-editor/')
  await p.getByTestId('office-file-input').setInputFiles(FIX + 'libreoffice.pptx')
  const ok = p.getByTestId('office-loss-ok')
  await expect(slideEl(p).or(ok).first()).toBeVisible()
  if (await ok.isVisible()) await ok.click()
  await expect(slideEl(p)).toContainText('Product launch')
  expect((await p.getByTestId('sl-thumb').count())).toBeGreaterThanOrEqual(4)
})

test('a legacy .ppt is named, not opened as junk', async ({ page: p }) => {
  await p.goto('/en/apps/powerpoint-editor/')
  await p.getByTestId('office-file-input').setInputFiles({ name: 'old.ppt', mimeType: 'application/octet-stream', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]) })
  await expect(p.getByTestId('office-import-error')).toContainText(/\.pptx|PowerPoint 97|older/i)
  await expect(slideEl(p)).toHaveCount(0)
})

test('Download as .pptx: real parts, the text, notes, and a hidden slide that stays hidden', async ({ page: p }) => {
  await p.goto('/en/apps/powerpoint-editor/')
  await p.getByTestId('office-file-input').setInputFiles(FIX + 'python-pptx.pptx')
  await p.getByTestId('office-loss-ok').click()
  await expect(slideEl(p)).toBeVisible()
  await p.getByTestId('sl-notes').fill('Our own note')
  await saved(p)
  await p.getByTestId('office-file').click()
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('office-export-pptx').click()])
  expect(dl.suggestedFilename()).toMatch(/\.pptx$/)
  const buf = readFileSync(await dl.path())
  const names = zipNames(buf)
  for (const n of ['[Content_Types].xml', 'ppt/presentation.xml', 'ppt/slides/slide1.xml', 'ppt/slides/slide5.xml', 'ppt/theme/theme1.xml']) expect(names).toContain(n)
  expect(zipPart(buf, 'ppt/slides/slide1.xml')).toContain('Product launch')
  expect(zipPart(buf, 'ppt/slides/slide5.xml')).toContain('show="0"')
  const notes = names.filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).map((n) => zipPart(buf, n)).join('')
  expect(notes).toContain('Our own note')
  expect(zipPart(buf, 'ppt/slides/slide3.xml')).toContain('<a:tbl>')
})

test('an outline in Markdown becomes slides, and a deck goes back out as one', async ({ page: p }) => {
  await p.goto('/en/apps/powerpoint-editor/')
  await p.getByTestId('office-file-input').setInputFiles({ name: 'talk.md', mimeType: 'text/markdown', buffer: Buffer.from('# Launch plan\nRiyadh, 2026\n\n---\n\n# Why now\n- The market **grew**\n  - mostly online\n> Pause here.\n') })
  await expect(p.getByTestId('sl-thumb')).toHaveCount(2)
  const d = await storedDeck(p)
  expect(byOrd(d).map((s) => s.layout)).toEqual(['title', 'titleContent'])
  expect(byOrd(d)[1].notes).toBe('Pause here.')
  await p.getByTestId('office-file').click()
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('office-export-md').click()])
  const md = readFileSync(await dl.path(), 'utf8')
  expect(md).toContain('# Why now')
  expect(md).toContain('- The market **grew**')
  expect(md).toContain('  - mostly online')
  expect(md).toContain('> Pause here.')
})

test('present: arrows and space advance, a hidden slide is skipped, B blanks, Escape returns to the slide you reached', async ({ page: p }) => {
  await p.goto('/en/apps/powerpoint-editor/')
  await p.getByTestId('office-file-input').setInputFiles(FIX + 'python-pptx.pptx')
  await p.getByTestId('office-loss-ok').click()
  await expect(slideEl(p)).toBeVisible()
  await p.getByTestId('sl-present-start').click()
  const show = p.getByTestId('sl-show')
  await expect(show).toBeVisible()
  await expect(show.getByTestId('sl-show-slide')).toContainText('Product launch')
  await p.keyboard.press('ArrowRight')
  await expect(show.getByTestId('sl-show-slide')).toContainText('Agenda')
  await p.keyboard.press('Space')
  await p.keyboard.press('ArrowRight')
  await p.keyboard.press('ArrowRight')
  // Slide 5 is hidden, so the next press is the end of the show, not slide 5.
  await expect(show.getByTestId('sl-end')).toBeVisible()
  await p.keyboard.press('ArrowLeft')
  await p.keyboard.press('b')
  await expect(show.getByTestId('sl-black')).toBeVisible()
  await p.keyboard.press('b')
  await expect(show.getByTestId('sl-black')).toHaveCount(0)
  await p.keyboard.press('Escape')
  await expect(show).toHaveCount(0)
  await expect(p.getByTestId('sl-thumb').nth(3)).toHaveAttribute('data-current', '1')
})

test('presenter view: the notes, the next slide and a timer — the audience never sees the notes', async ({ page: p }) => {
  await p.goto('/en/apps/powerpoint-editor/')
  await p.getByTestId('office-file-input').setInputFiles(FIX + 'python-pptx.pptx')
  await p.getByTestId('office-loss-ok').click()
  await expect(slideEl(p)).toBeVisible()
  await p.getByTestId('tab-show').click()
  await p.getByTestId('sl-show-presenter').click()
  const pv = p.getByTestId('sl-presenter')
  await expect(pv).toBeVisible()
  await expect(pv.getByTestId('sl-present-notes')).toHaveText('Welcome everyone.')
  await expect(pv.getByTestId('sl-present-next-slide')).toContainText('Agenda')
  await expect(pv.getByTestId('sl-present-timer')).toHaveText(/\d\d:\d\d/)
  await expect(pv.getByTestId('sl-audience')).not.toContainText('Welcome everyone.')
  await pv.getByTestId('sl-present-next').click()
  await expect(pv.getByTestId('sl-present-count')).toContainText('2')
  await pv.getByTestId('sl-present-exit').click()
  await expect(pv).toHaveCount(0)
})

test('Arabic: the interface, and a template that runs right to left into the exported file', async ({ page: p }) => {
  await p.goto('/ar/apps/powerpoint-editor/')
  await p.getByTestId('office-template-lesson').click()
  await expect(slideEl(p)).toContainText('دورة الماء')
  await expect(p.getByTestId('tab-home')).toHaveText('الرئيسية')
  const d = await storedDeck(p)
  expect(d.rtl).toBe(true)
  expect(current(d).elements.filter((e) => e.text).every((e) => e.text!.paras.every((pa) => pa.rtl))).toBe(true)
  await p.getByTestId('office-file').click()
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('office-export-pptx').click()])
  const xml = zipPart(readFileSync(await dl.path()), 'ppt/slides/slide1.xml')
  expect(xml).toContain('rtl="1"')
  expect(xml).toContain('lang="ar-SA"')
  expect(xml).toContain('دورة الماء')
})

test.describe('live co-editing, with the owner as the truth', () => {
  let relay: Relay
  test.beforeAll(async () => { relay = await startRelay() })
  test.afterAll(async () => { await relay.close() })

  async function hostAndJoin(browser: import('@playwright/test').Browser, role: 'edit' | 'view' = 'edit') {
    const oc = await relayContext(browser, relay)
    const owner = await oc.newPage()
    await newBlank(owner)
    await slideEl(owner).getByTestId('sl-prompt').first().click()
    await owner.keyboard.type('secret-owner-title')
    await owner.keyboard.press('Escape')
    await owner.getByTestId('office-share').click()
    if (role === 'view') await owner.getByTestId('collab-role-view').click()
    await owner.getByTestId('collab-start').click()
    const link = await owner.getByTestId('collab-link').inputValue()
    await owner.getByTestId('sheet-close').click()
    const gc = await relayContext(browser, relay)
    const guest = await gc.newPage()
    await guest.goto(link.replace(/^https?:\/\/[^/]+/, ''))
    await guest.getByTestId('collab-name').fill('Omar')
    await guest.getByTestId('office-join-go').click()
    await expect(slideEl(guest)).toContainText('secret-owner-title', { timeout: 30_000 })
    return { owner, guest }
  }

  test('edits flow both ways, the owner keeps the copy, and a guest is seen on the slide', async ({ browser }) => {
    const { owner, guest } = await hostAndJoin(browser)
    await addShape(guest, 'ellipse', 200, 350)
    await expect.poll(async () => current(await storedDeck(owner)).elements.some((e) => e.geom === 'ellipse')).toBe(true)
    // Presence: the owner sees what the guest has selected, named.
    await expect(owner.getByTestId('sl-peer')).toBeVisible()
    await expect(owner.getByTestId('sl-peer')).toContainText('Omar')
    // Both add a slide at once: neither is lost, and both browsers agree on the order.
    await Promise.all([owner.keyboard.press('Control+m'), (async () => { await guest.keyboard.press('Escape'); await guest.keyboard.press('Control+m') })()])
    await expect(owner.getByTestId('sl-thumb')).toHaveCount(3)
    await expect(guest.getByTestId('sl-thumb')).toHaveCount(3)
    const ids = async (pg: Page) => pg.getByTestId('sl-thumb').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
    await expect.poll(async () => JSON.stringify(await ids(guest))).toBe(JSON.stringify(await ids(owner)))
    // The guest edits text; it arrives at the owner and is saved there.
    await guest.getByTestId('sl-thumb').first().click()
    await guest.getByTestId('sl-notes').fill('from-guest-notes')
    await expect.poll(async () => current(await storedDeck(owner)).notes).toBe('from-guest-notes')
    // The relay only ever carried the handshake.
    for (const s of ['secret-owner-title', 'from-guest-notes']) expect(relay.bodies.some((b) => b.includes(s))).toBe(false)
  })

  test('a guest can follow the presenter, slide by slide', async ({ browser }) => {
    const { owner, guest } = await hostAndJoin(browser)
    await owner.keyboard.press('Control+m')
    await expect(guest.getByTestId('sl-thumb')).toHaveCount(2)
    await owner.getByTestId('sl-present-start').click()
    await expect(guest.getByTestId('sl-presenting-banner')).toBeVisible()
    await guest.getByTestId('sl-follow').click()
    await expect(guest.getByTestId('sl-following')).toBeVisible()
    await expect(guest.getByTestId('sl-follow-slide')).toContainText('secret-owner-title')
    await owner.keyboard.press('ArrowRight')
    await expect(guest.getByTestId('sl-follow-slide')).not.toContainText('secret-owner-title')
    await owner.keyboard.press('Escape')
    await expect(guest.getByTestId('sl-following')).toHaveCount(0)
  })

  test('a view-only guest cannot change the deck, and is told so', async ({ browser }) => {
    const { owner, guest } = await hostAndJoin(browser, 'view')
    await expect(guest.getByTestId('office-viewonly')).toBeVisible()
    await guest.keyboard.press('Control+m')
    await guest.getByTestId('sl-notes').click()
    await guest.keyboard.type('nope')
    await guest.waitForTimeout(500)
    expect(await owner.getByTestId('sl-thumb').count()).toBe(1)
    expect(current(await storedDeck(owner)).notes).toBeFalsy()
  })
})
