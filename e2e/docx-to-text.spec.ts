import { test, expect } from '@playwright/test'
import { deflateRawSync, crc32 } from 'node:zlib'

/** Minimal ZIP writer — enough to build a real .docx in the test. */
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
    lh.writeUInt16LE(8, 8) // deflate
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

const P = (...runs: string[]) => `<w:p>${runs.map((r) => `<w:r><w:t xml:space="preserve">${r}</w:t></w:r>`).join('')}</w:p>`

function docx(bodyXml: string, extra: { name: string; xml: string }[] = []): Buffer {
  const wrap = (inner: string) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${inner}</w:body></w:document>`
  return zip([
    { name: '[Content_Types].xml', data: Buffer.from('<?xml version="1.0"?><Types/>') },
    { name: 'word/document.xml', data: Buffer.from(wrap(bodyXml), 'utf8') },
    ...extra.map((e) => ({ name: e.name, data: Buffer.from(wrap(e.xml), 'utf8') })),
  ])
}

const pick = (page: import('@playwright/test').Page, buffer: Buffer, name = 'letter.docx') =>
  page.getByTestId('dx-file').setInputFiles({
    name, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer,
  })

test.describe('word to text', () => {
  test('paragraphs stay paragraphs and a split word stays one word', async ({ page }) => {
    // Word splits a run at every formatting or spell-check boundary, so
    // "Riyadh" really does arrive as two runs in real documents.
    const body = P('Contract of employment') + P('Signed in Riy', 'adh') + P('Total 500 SAR')
    await page.goto('/en/apps/docx-to-text')
    await pick(page, docx(body))
    const out = page.getByTestId('dx-output')
    await expect(out).toHaveValue(/Contract of employment/)
    await expect(out).toHaveValue(/Signed in Riyadh/)
    await expect(out).not.toHaveValue(/Riy adh/)
    await expect(out).toHaveValue(/Contract of employment\nSigned in Riyadh\nTotal 500 SAR/)
    await expect(page.getByTestId('dx-count')).toHaveText('3 paragraphs')
  })

  test('a break is a new line and a table row keeps its columns apart', async ({ page }) => {
    const row = '<w:tbl><w:tr><w:tc>' + P('Item') + '</w:tc><w:tc>' + P('120') + '</w:tc></w:tr></w:tbl>'
    const body = '<w:p><w:r><w:t>first</w:t><w:br/><w:t>second</w:t></w:r></w:p>' + row
    await page.goto('/en/apps/docx-to-text')
    await pick(page, docx(body))
    const out = page.getByTestId('dx-output')
    await expect(out).toHaveValue(/first\nsecond/)
    await expect(out).toHaveValue(/Item\t/)
    await expect(out).not.toHaveValue(/Item120/)
  })

  test('headers and footnotes are offered but kept out of the body', async ({ page }) => {
    await page.goto('/en/apps/docx-to-text')
    await pick(page, docx(P('The body of the letter'), [
      { name: 'word/header1.xml', xml: P('Ministry of Everything') },
    ]))
    const out = page.getByTestId('dx-output')
    await expect(out).toHaveValue(/The body of the letter/)
    await expect(out).not.toHaveValue(/Ministry of Everything/)
    await page.getByTestId('dx-extras').check()
    await expect(out).toHaveValue(/Ministry of Everything/)
  })

  test('escaped characters and Arabic come back as themselves', async ({ page }) => {
    await page.goto('/en/apps/docx-to-text')
    await pick(page, docx(P('Fees &amp; charges &lt;25%&gt;') + P('عقد عمل موحّد')))
    const out = page.getByTestId('dx-output')
    await expect(out).toHaveValue(/Fees & charges <25%>/)
    await expect(out).toHaveValue(/عقد عمل موحّد/)
  })

  test('an old .doc says so instead of just failing', async ({ page }) => {
    const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(512)])
    await page.goto('/en/apps/docx-to-text')
    await page.getByTestId('dx-file').setInputFiles({ name: 'old.doc', mimeType: 'application/msword', buffer: ole })
    await expect(page.getByTestId('file-error')).toContainText('old .doc')
  })

  test('a ZIP that is not a Word document is reported', async ({ page }) => {
    const notDocx = zip([{ name: 'readme.txt', data: Buffer.from('hello') }])
    await page.goto('/en/apps/docx-to-text')
    await pick(page, notDocx, 'stuff.zip')
    await expect(page.getByTestId('file-error')).toContainText('not a Word document')
  })

  test('the text downloads as a .txt named after the document', async ({ page }) => {
    await page.goto('/en/apps/docx-to-text')
    await pick(page, docx(P('Hello there')), 'report.docx')
    await expect(page.getByTestId('dx-output')).toHaveValue(/Hello there/)
    const dl = page.waitForEvent('download')
    await page.getByTestId('dx-download').click()
    expect((await dl).suggestedFilename()).toBe('report.txt')
  })
})
