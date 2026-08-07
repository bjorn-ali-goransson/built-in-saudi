import { test, expect } from '@playwright/test'
import { deflateRawSync, crc32 } from 'node:zlib'

/** Minimal ZIP writer — enough to build a real .pptx in the test. */
function zip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const comp = deflateRawSync(f.data)
    const crc = crc32(f.data)

    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(8, 8)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(comp.length, 18)
    lh.writeUInt32LE(f.data.length, 22)
    lh.writeUInt16LE(name.length, 26)
    locals.push(lh, name, comp)

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(8, 10)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(comp.length, 20)
    cd.writeUInt32LE(f.data.length, 24)
    cd.writeUInt16LE(name.length, 28)
    cd.writeUInt32LE(offset, 42)
    central.push(cd, name)
    offset += lh.length + name.length + comp.length
  }
  const cdBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cdBuf, eocd])
}

/** One paragraph, optionally split across runs the way PowerPoint does. */
const P = (...runs: string[]) => `<a:p>${runs.map((r) => `<a:r><a:t>${r}</a:t></a:r>`).join('')}</a:p>`

const part = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${inner}</p:spTree></p:cSld></p:sld>`

function pptx(slides: string[], notes: Record<number, string> = {}): Buffer {
  return zip([
    { name: '[Content_Types].xml', data: Buffer.from('<?xml version="1.0"?><Types/>') },
    ...slides.map((body, i) => ({ name: `ppt/slides/slide${i + 1}.xml`, data: Buffer.from(part(body), 'utf8') })),
    ...Object.entries(notes).map(([n, body]) => ({
      name: `ppt/notesSlides/notesSlide${n}.xml`, data: Buffer.from(part(body), 'utf8'),
    })),
  ])
}

const pick = (page: import('@playwright/test').Page, buffer: Buffer, name = 'deck.pptx') =>
  page.getByTestId('pt-file').setInputFiles({
    name, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer,
  })

test.describe('powerpoint to text', () => {
  test('slide 10 does not land between 1 and 2', async ({ page }) => {
    // The whole reason this needs a numeric sort: slide10.xml sorts before
    // slide2.xml as a string, and a twelve-slide deck comes out shuffled.
    const slides = Array.from({ length: 11 }, (_, i) => P(`This is slide ${i + 1}`))
    await page.goto('/en/apps/pptx-to-text')
    await pick(page, pptx(slides))
    await expect(page.getByTestId('pt-count')).toHaveText('11 slides')
    const text = await page.getByTestId('pt-output').inputValue()
    expect(text.indexOf('This is slide 2')).toBeLessThan(text.indexOf('This is slide 10'))
    expect(text.indexOf('This is slide 9')).toBeLessThan(text.indexOf('This is slide 10'))
  })

  test('a line split across runs stays one word', async ({ page }) => {
    await page.goto('/en/apps/pptx-to-text')
    await pick(page, pptx([P('Welcome to Riy', 'adh'), P('Second slide')]))
    const out = page.getByTestId('pt-output')
    await expect(out).toHaveValue(/Welcome to Riyadh/)
    await expect(out).not.toHaveValue(/Riy adh/)
  })

  test('speaker notes are offered but off by default', async ({ page }) => {
    await page.goto('/en/apps/pptx-to-text')
    await pick(page, pptx([P('What the audience sees')], { 1: P('What the presenter says') }))
    const out = page.getByTestId('pt-output')
    await expect(out).toHaveValue(/What the audience sees/)
    await expect(out).not.toHaveValue(/presenter says/)
    await expect(page.getByTestId('pt-notes-count')).toHaveText('1 with notes')
    await page.getByTestId('pt-notes').check()
    await expect(out).toHaveValue(/What the presenter says/)
  })

  test('the slide number PowerPoint hides in the notes part is not a note', async ({ page }) => {
    await page.goto('/en/apps/pptx-to-text')
    await pick(page, pptx([P('Body'), P('Body two')], { 2: P('2') + P('The real note') }))
    await page.getByTestId('pt-notes').check()
    const text = await page.getByTestId('pt-output').inputValue()
    expect(text).toContain('The real note')
    expect(text).not.toMatch(/\[Notes\] 2\b/)
  })

  test('slide numbering can be turned off', async ({ page }) => {
    await page.goto('/en/apps/pptx-to-text')
    await pick(page, pptx([P('Alpha'), P('Beta')]))
    const out = page.getByTestId('pt-output')
    await expect(out).toHaveValue(/--- Slide 1 ---/)
    await page.getByTestId('pt-numbers').uncheck()
    await expect(out).not.toHaveValue(/--- Slide/)
    await expect(out).toHaveValue(/Alpha/)
  })

  test('a picture-only slide is counted, not treated as a failure', async ({ page }) => {
    await page.goto('/en/apps/pptx-to-text')
    await pick(page, pptx([P('Has words'), '<p:pic/>']))
    await expect(page.getByTestId('pt-empty')).toContainText('1 with no text')
    await expect(page.getByTestId('pt-count')).toHaveText('2 slides')
  })

  test('Arabic and escaped characters survive', async ({ page }) => {
    await page.goto('/en/apps/pptx-to-text')
    await pick(page, pptx([P('الرؤية 2030'), P('Q&amp;A &lt;live&gt;')]))
    const out = page.getByTestId('pt-output')
    await expect(out).toHaveValue(/الرؤية 2030/)
    await expect(out).toHaveValue(/Q&A <live>/)
  })

  test('a ZIP with no slides in it is reported, not shown empty', async ({ page }) => {
    await page.goto('/en/apps/pptx-to-text')
    await pick(page, zip([{ name: 'readme.txt', data: Buffer.from('hello') }]), 'stuff.zip')
    await expect(page.getByTestId('file-error')).toContainText('no slides')
  })

  test('the text downloads as a .txt named after the deck', async ({ page }) => {
    await page.goto('/en/apps/pptx-to-text')
    await pick(page, pptx([P('Hello')]), 'quarterly.pptx')
    await expect(page.getByTestId('pt-output')).toHaveValue(/Hello/)
    const dl = page.waitForEvent('download')
    await page.getByTestId('pt-download').click()
    expect((await dl).suggestedFilename()).toBe('quarterly.txt')
  })
})
