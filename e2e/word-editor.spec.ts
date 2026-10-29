import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { zipPart, zipNames } from './helpers'
import { startRelay, relayContext, type Relay } from './support/relay'

// The document editor. A claim that something was SAVED is read back through a
// different path than the one that wrote it: the IndexedDB record, the exported
// file's own XML, or the other browser in a live session.
const FIX = 'src/tools/word-editor/io/__fixtures__/'
const editor = (p: Page) => p.getByTestId('wd-editor')
/** The document's text, without the name labels on collaborators' cursors (widgets, not text). */
const docText = (p: Page) => editor(p).evaluate((el) => { const c = el.cloneNode(true) as HTMLElement; c.querySelectorAll('.wd-caret').forEach((x) => x.remove()); return c.innerText.trim() })

async function newBlank(p: Page, locale = 'en') {
  await p.goto(`/${locale}/apps/word-editor/`)
  await p.getByTestId('office-new').click()
  await expect(editor(p)).toBeVisible()
  await editor(p).click()
}
type Stored = { title: string; data: { doc: Node; page: { width: number; height: number; landscape?: boolean }; header?: string; footer?: string; rtl?: boolean } }
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] }
/** The stored document, read straight from IndexedDB — not from the screen. */
async function stored(p: Page): Promise<Stored[]> {
  return p.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('bis-docs')
    r.onerror = () => reject(r.error)
    r.onsuccess = () => {
      const tx = r.result.transaction('docs', 'readonly').objectStore('docs').getAll()
      tx.onsuccess = () => resolve((tx.result as { kind: string }[]).filter((d) => d.kind === 'word') as never)
    }
  }))
}
const walk = (n: Node, f: (n: Node) => void) => { f(n); n.content?.forEach((c) => walk(c, f)) }
const nodes = (n: Node, type: string) => { const out: Node[] = []; walk(n, (x) => { if (x.type === type) out.push(x) }); return out }
const text = (n: Node): string => n.text ?? (n.content || []).map(text).join('')
async function saved(p: Page) { await expect(p.getByTestId('office-status')).toHaveAttribute('data-status', 'saved') }
async function storedDoc(p: Page): Promise<Stored> {
  await saved(p)
  const all = await stored(p)
  return all[0]
}

test('write with the keyboard: styles, bold and a list reach the stored document', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('Annual plan')
  await p.getByTestId('wd-style-h1').click()
  await p.keyboard.press('Enter')
  await p.keyboard.type('We will ')
  await p.keyboard.press('Control+b')
  await p.keyboard.type('grow')
  await p.keyboard.press('Control+b')
  await p.keyboard.type(' this year.')
  await p.keyboard.press('Enter')
  await p.getByTestId('wd-bullets').click()
  await p.keyboard.type('Hire')
  await p.keyboard.press('Enter')
  await p.keyboard.type('Expand')
  await expect(editor(p).locator('h1')).toHaveText('Annual plan')
  const d = await storedDoc(p)
  const h = nodes(d.data.doc, 'heading')
  expect(h.map((x) => [x.attrs!.level, text(x)])).toEqual([[1, 'Annual plan']])
  const bold = nodes(d.data.doc, 'text').find((t) => t.text === 'grow')!
  expect(bold.marks!.map((m) => m.type)).toEqual(['bold'])
  const list = nodes(d.data.doc, 'bullet_list')[0]
  expect(list.content!.map(text)).toEqual(['Hire', 'Expand'])
})

test('typing shortcuts: # heading, numbered and checklist items, and ticking one', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('## Tasks')
  await p.keyboard.press('Enter')
  await p.keyboard.type('1. first')
  await p.keyboard.press('Enter')
  await p.keyboard.type('second')
  await p.keyboard.press('Enter')
  await p.keyboard.press('Enter')
  await p.keyboard.type('[ ] buy dates')
  await expect(editor(p).locator('h2')).toHaveText('Tasks')
  await expect(editor(p).locator('ol > li')).toHaveCount(2)
  const box = p.getByTestId('wd-checkbox')
  await expect(box).toHaveCount(1)
  await box.click()
  await expect(box).toBeChecked()
  const d = await storedDoc(p)
  const items = nodes(d.data.doc, 'list_item').filter((x) => x.attrs?.checked !== null && x.attrs?.checked !== undefined)
  expect(items.map((x) => [text(x), x.attrs!.checked])).toEqual([['buy dates', true]])
})

test('undo takes the last change back and redo restores it', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('keep')
  await p.waitForTimeout(600) // history groups typing within 500ms into one step
  await p.keyboard.type(' gone')
  await p.getByTestId('office-undo').click()
  await expect(editor(p)).toHaveText('keep')
  await p.getByTestId('office-redo').click()
  await expect(editor(p)).toHaveText('keep gone')
})

test('a table: inserted from the grid picker, typed into, grown from the Table tab', async ({ page: p }) => {
  await newBlank(p)
  await p.getByTestId('tab-insert').click()
  await p.getByTestId('wd-insert-table').click()
  await p.getByTestId('wd-table-2x3').click()
  await expect(editor(p).locator('table tr')).toHaveCount(2)
  await p.keyboard.type('Name')
  await p.keyboard.press('Tab')
  await p.keyboard.type('Role')
  await expect(p.getByTestId('tab-table')).toBeVisible()
  await p.getByTestId('tab-table').click()
  await p.getByTestId('wd-row-after').click()
  await expect(editor(p).locator('table tr')).toHaveCount(3)
  const d = await storedDoc(p)
  const t = nodes(d.data.doc, 'table')[0]
  expect(t.content!.length).toBe(3)
  expect(t.content![0].content!.map((c) => [c.type, text(c)])).toEqual([['table_header', 'Name'], ['table_header', 'Role'], ['table_header', '']])
})

test('links: Ctrl+K on a selection, kept as a link mark; a javascript: address is refused', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('see the site')
  // The editor reads typed text from the page on its own schedule; select only once
  // the last letter is in it, as a person (who is never that fast) always would.
  await expect(editor(p)).toHaveText('see the site')
  await p.keyboard.down('Shift')
  for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowLeft')
  await p.keyboard.up('Shift')
  await p.keyboard.press('Control+k')
  await p.getByTestId('wd-link-url').fill('javascript:alert(1)')
  await expect(p.getByTestId('wd-link-save')).toBeDisabled()
  await p.getByTestId('wd-link-url').fill('example.com/about')
  await p.getByTestId('wd-link-save').click()
  await expect(editor(p).locator('a')).toHaveAttribute('href', 'https://example.com/about')
  const d = await storedDoc(p)
  const linked = nodes(d.data.doc, 'text').find((t) => t.marks?.some((m) => m.type === 'link'))!
  expect(linked.text).toBe('site')
})

test('find and replace across the document', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('red apple, red car')
  await p.keyboard.press('Enter')
  await p.keyboard.type('a Red door')
  await p.keyboard.press('Control+h')
  await p.getByTestId('wd-find-input').fill('red')
  await expect(p.getByTestId('wd-find-count')).toHaveText('1 of 3')
  await p.getByTestId('wd-find-case').check()
  await expect(p.getByTestId('wd-find-count')).toHaveText('1 of 2')
  await p.getByTestId('wd-replace-input').fill('green')
  await p.getByTestId('wd-replace-all').click()
  await expect(p.getByTestId('wd-find-count')).toHaveText('Replaced 2')
  await expect(editor(p)).toContainText('green apple, green car')
  await expect(editor(p)).toContainText('a Red door')
})

test('a picture: inserted, resized from the Picture tab, and stored with its size', async ({ page: p }) => {
  await newBlank(p)
  await p.getByTestId('wd-picture-input').setInputFiles('e2e/fixtures/diff-a.png')
  await expect(p.getByTestId('wd-image')).toBeVisible()
  await p.getByTestId('wd-image').click()
  await expect(p.getByTestId('tab-picture')).toBeVisible()
  await p.getByTestId('tab-picture').click()
  await p.getByTestId('wd-picture-width').fill('120')
  await expect(p.getByTestId('wd-image')).toHaveAttribute('data-width', '120')
  const d = await storedDoc(p)
  const img = nodes(d.data.doc, 'image')[0]
  expect(img.attrs!.width).toBe(120)
  expect(String(img.attrs!.src)).toMatch(/^data:image\/png;base64,/)
})

test('a file that is not a picture says why rather than doing nothing', async ({ page: p }) => {
  await newBlank(p)
  await p.getByTestId('wd-picture-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(p.getByTestId('wd-toast')).toBeVisible()
  await expect(p.getByTestId('wd-image')).toHaveCount(0)
})

test('opening a real .docx from python-docx: styles, runs, a table and a picture', async ({ page: p }) => {
  await p.goto('/en/apps/word-editor/')
  await p.getByTestId('office-file-input').setInputFiles(FIX + 'python-docx.docx')
  await expect(editor(p)).toBeVisible({ timeout: 20_000 })
  await expect(editor(p).locator('h1')).toHaveText('Quarterly report')
  await expect(editor(p).locator('strong', { hasText: 'twelve percent' })).toBeVisible()
  await expect(editor(p).locator('table')).toBeVisible()
  await expect(p.getByTestId('wd-image')).toBeVisible()
  await expect(p.getByTestId('office-title')).toHaveValue('Quarterly report')
})

test('opening .docx and .odt written by LibreOffice: a list that starts at 3, and a footnote', async ({ page: p }) => {
  for (const f of ['libreoffice.docx', 'libreoffice.odt']) {
    await p.goto('/en/apps/word-editor/')
    await p.getByTestId('office-file-input').setInputFiles(FIX + f)
    await expect(editor(p)).toBeVisible({ timeout: 20_000 })
    await expect(editor(p).locator('ol').first()).toHaveAttribute('start', '3')
    await expect(p.getByTestId('wd-footnotes')).toContainText('The footnote text.')
    await p.getByTestId('office-back').click()
  }
})

test('a legacy .doc is named, not opened as junk', async ({ page: p }) => {
  await p.goto('/en/apps/word-editor/')
  await p.getByTestId('office-file-input').setInputFiles({ name: 'old.docx', mimeType: 'application/octet-stream', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]) })
  await expect(p.getByTestId('office-import-error')).toContainText('old binary Office file')
})

test('opening a saved web page drops pictures from the web and script links', async ({ page: p }) => {
  const hits: string[] = []
  p.on('request', (r) => { if (r.url().includes('tracker.example')) hits.push(r.url()) })
  await p.goto('/en/apps/word-editor/')
  await p.getByTestId('office-file-input').setInputFiles({
    name: 'page.html', mimeType: 'text/html',
    buffer: Buffer.from('<html><head><title>Saved page</title></head><body><h2>Hello</h2><p>Text <a href="javascript:alert(1)">bad</a> and <a href="https://ok.example/">good</a></p><img src="https://tracker.example/pixel.gif"><script>window.__pwned=1</script></body></html>'),
  })
  await expect(editor(p).locator('h2')).toHaveText('Hello')
  await expect(editor(p).locator('a')).toHaveCount(1)
  await expect(editor(p).locator('a')).toHaveAttribute('href', 'https://ok.example/')
  await expect(p.getByTestId('office-loss')).toContainText('linked from the web')
  expect(await p.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  expect(hits).toEqual([])
})

test('Download as .docx: the XML carries the text, a real heading style and bold', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('Report title')
  await p.getByTestId('wd-style-h1').click()
  await p.keyboard.press('Enter')
  await p.keyboard.press('Control+b')
  await p.keyboard.type('strong words')
  await saved(p)
  await p.getByTestId('office-file').click()
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('office-export-docx').click()])
  const buf = readFileSync(await dl.path())
  expect(zipNames(buf)).toEqual(expect.arrayContaining(['word/document.xml', 'word/styles.xml', '[Content_Types].xml']))
  const xml = zipPart(buf, 'word/document.xml')
  expect(xml).toMatch(/<w:pStyle w:val="Heading1"\/>[\s\S]*Report title/)
  expect(xml).toMatch(/<w:b\/>[\s\S]*strong words/)
  expect(zipPart(buf, 'word/styles.xml')).toContain('w:name w:val="heading 1"')
})

test('Download as Markdown says what Markdown cannot carry', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('Centred')
  await p.getByTestId('wd-align-center').click()
  await p.keyboard.press('Enter')
  await p.keyboard.type('- item')
  await saved(p)
  await p.getByTestId('office-file').click()
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('office-export-md').click()])
  const md = readFileSync(await dl.path(), 'utf8')
  expect(md).toContain('Centred')
  expect(md).toMatch(/^[-*] item$/m)
  await expect(p.getByTestId('office-loss')).toContainText('Markdown carries')
})

test('Save to a file on this device writes the document back on every save', async ({ page: p }) => {
  await p.addInitScript(() => {
    const pick = async () => (await navigator.storage.getDirectory()).getFileHandle('notes.docx', { create: true })
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = pick
    ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => [await pick()]
  })
  await newBlank(p)
  await p.keyboard.type('first save')
  await p.getByTestId('office-file').click()
  await p.getByTestId('office-link').click()
  await expect(p.getByTestId('office-status')).toContainText('notes.docx')
  await editor(p).click()
  await p.keyboard.press('End')
  await p.keyboard.type(' then the second')
  await p.keyboard.press('Control+s')
  await saved(p)
  const bytes = async () => p.evaluate(async () => Array.from(new Uint8Array(await (await (await (await navigator.storage.getDirectory()).getFileHandle('notes.docx')).getFile()).arrayBuffer())))
  await expect.poll(async () => { const b = Buffer.from(await bytes()); return b.length && zipNames(b).includes('word/document.xml') ? zipPart(b, 'word/document.xml') : '' }).toContain('then the second')
})

test('page setup, header and footer are kept with the document', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('body')
  const portrait = await p.getByTestId('wd-page').boundingBox()
  await p.getByTestId('tab-layout').click()
  await p.getByTestId('wd-landscape').click()
  await expect.poll(async () => (await p.getByTestId('wd-page').boundingBox())!.width).toBeGreaterThan(portrait!.width * 1.2)
  await p.getByTestId('wd-header').fill('Confidential')
  await p.getByTestId('wd-footer').fill('Page {page} of {pages}')
  const d = await storedDoc(p)
  expect(d.data.page.landscape).toBe(true)
  expect(d.data.page.width).toBeGreaterThan(d.data.page.height)
  expect(d.data.header).toBe('Confidential')
  expect(d.data.footer).toBe('Page {page} of {pages}')
  // And it reaches the Word file.
  await p.getByTestId('office-file').click()
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('office-export-docx').click()])
  const buf = readFileSync(await dl.path())
  expect(zipPart(buf, 'word/document.xml')).toContain('w:orient="landscape"')
  expect(zipNames(buf).some((n) => /word\/header\d*\.xml/.test(n))).toBe(true)
})

test('a page break and a footnote', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('Chapter one')
  await p.keyboard.press('Control+Enter')
  await p.keyboard.type('Chapter two')
  await expect(editor(p).locator('.page-break')).toHaveCount(1)
  await expect(p.getByTestId('wd-pages')).toHaveText('Page 2 of 2')
  await expect(p.getByTestId('wd-page-boundary')).toHaveCount(1)
  await p.getByTestId('tab-insert').click()
  await p.getByTestId('wd-insert-footnote').click()
  await p.getByTestId('wd-footnote-text').fill('A source.')
  await p.getByTestId('wd-footnote-save').click()
  await expect(p.getByTestId('wd-footnotes')).toContainText('A source.')
  const d = await storedDoc(p)
  expect(nodes(d.data.doc, 'page_break')).toHaveLength(1)
  expect(nodes(d.data.doc, 'footnote')[0].attrs!.text).toBe('A source.')
})

test('the outline lists the headings and jumps to one', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('# One')
  await p.keyboard.press('Enter')
  await p.keyboard.type('text')
  await p.keyboard.press('Enter')
  await p.keyboard.type('## Two')
  await p.getByTestId('tab-view').click()
  await p.getByTestId('wd-outline').click()
  await expect(p.getByTestId('wd-outline-item')).toHaveText(['One', 'Two'])
  await p.getByTestId('wd-outline-item').first().click()
  await p.keyboard.type('!')
  await expect(editor(p).locator('h1')).toHaveText('!One')
})

test('the word count counts Arabic words as words', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('مرحبا بكم في الرياض and Jeddah')
  await expect(p.getByTestId('wd-words')).toHaveAttribute('data-count', '6')
})

test('Arabic: the interface, and a template that runs right to left', async ({ page: p }) => {
  await p.goto('/ar/apps/word-editor/')
  await p.getByTestId('office-template-report').click()
  await expect(p.getByTestId('tab-home')).toHaveText('الرئيسية')
  await expect(p.getByTestId('wd-page')).toHaveAttribute('dir', 'rtl')
  await expect(editor(p).locator('h1')).toHaveText('التقرير الربعي')
  await expect(editor(p).locator('ol').first()).toHaveAttribute('data-kind', 'arabic-indic')
  // Saved in Arabic Word terms: the run is marked right to left with an Arabic language.
  await saved(p)
  await p.getByTestId('office-file').click()
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('office-export-docx').click()])
  const xml = zipPart(readFileSync(await dl.path()), 'word/document.xml')
  expect(xml).toContain('<w:bidi/>')
  expect(xml).toMatch(/<w:rtl\/>[\s\S]*التقرير/)
  expect(xml).toMatch(/w:bidi="ar-SA"/)
})

test('library: rename, duplicate and delete a document', async ({ page: p }) => {
  await newBlank(p)
  await p.keyboard.type('content')
  await p.getByTestId('office-title').fill('Original')
  await saved(p)
  await p.getByTestId('office-back').click()
  await expect(p.getByTestId('office-doc-title')).toHaveText('Original')
  await p.getByTestId('office-doc-menu').first().click()
  await p.getByTestId('office-doc-duplicate').click()
  await expect(p.getByTestId('office-doc')).toHaveCount(2)
  await p.getByTestId('office-doc-menu').first().click()
  await p.getByTestId('office-doc-delete').click()
  await p.getByTestId('office-confirm-delete-go').click()
  await expect(p.getByTestId('office-doc')).toHaveCount(1)
})

test.describe('live co-writing, with the owner as the truth', () => {
  let relay: Relay
  test.beforeAll(async () => { relay = await startRelay() })
  test.afterAll(async () => { await relay.close() })

  async function hostAndJoin(browser: import('@playwright/test').Browser, role: 'edit' | 'view' = 'edit') {
    const oc = await relayContext(browser, relay)
    const owner = await oc.newPage()
    await newBlank(owner)
    await owner.keyboard.type('secret-owner-text')
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
    await expect.poll(() => docText(guest), { timeout: 30_000 }).toBe('secret-owner-text')
    return { owner, guest }
  }

  test('a guest sees the owner document, and writing flows both ways in the same order', async ({ browser }) => {
    const { owner, guest } = await hostAndJoin(browser)
    await editor(guest).click()
    await guest.keyboard.press('Control+End')
    await guest.keyboard.press('Enter')
    await guest.keyboard.type('from-guest')
    await expect(editor(owner)).toContainText('from-guest')
    // Both type at once, in different places: neither loses anything.
    await editor(owner).locator('p').first().click({ position: { x: 1, y: 4 } })
    await owner.keyboard.press('Home')
    await Promise.all([owner.keyboard.type('AAA '), guest.keyboard.type(' BBB')])
    await expect(editor(owner)).toContainText('AAA secret-owner-text')
    await expect(editor(owner)).toContainText('from-guest BBB')
    await expect.poll(() => docText(guest)).toBe(await docText(owner))
    // The owner's copy is the one saved.
    const d = await storedDoc(owner)
    expect(text(d.data.doc)).toContain('from-guest BBB')
    // Presence: the owner sees where the guest is, named.
    await expect(owner.getByTestId('wd-peer-caret')).toBeVisible()
    await expect(owner.getByTestId('wd-peer-caret')).toContainText('Omar')
    // Page setup travels too.
    await guest.getByTestId('wd-header').fill('Shared header')
    await expect(owner.getByTestId('wd-header')).toHaveValue('Shared header')
    for (const s of ['secret-owner-text', 'from-guest', 'Shared header']) expect(relay.bodies.some((b) => b.includes(s))).toBe(false)
  })

  test('a view-only guest cannot write, and is told so', async ({ browser }) => {
    const { owner, guest } = await hostAndJoin(browser, 'view')
    await expect(guest.getByTestId('office-viewonly')).toBeVisible()
    await expect(editor(guest)).toHaveAttribute('contenteditable', 'false')
    await editor(guest).click()
    await guest.keyboard.type('nope')
    await guest.waitForTimeout(500)
    expect(await docText(owner)).toBe('secret-owner-text')
    expect(await docText(guest)).toBe('secret-owner-text')
  })

  test('when the owner ends the session, the guest is told and can keep a copy', async ({ browser }) => {
    const { owner, guest } = await hostAndJoin(browser)
    await owner.getByTestId('office-share').click()
    await owner.getByTestId('collab-stop').click()
    await expect(guest.getByTestId('office-banner')).toBeVisible({ timeout: 15_000 })
    await guest.getByTestId('office-banner-save').click()
    await expect.poll(() => docText(guest)).toBe('secret-owner-text')
    await expect(guest.getByTestId('office-status')).toBeVisible()
  })
})
