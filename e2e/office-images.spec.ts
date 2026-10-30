import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { replaceInZip, noisyPng, zipEntries } from './helpers'

// Pictures in the office editors are kept modern and small: WebP, at most 800KB,
// whatever came in — and go back out as JPEG or PNG, which every Office opens.
// The big picture is made at run time: a photograph-like PNG of several MB,
// swapped into a real file, so the limit is tested against the hard case.
const LIMIT = 800 * 1024
const BIG = noisyPng(2400, 1800)

type Doc = { kind: string; data: unknown }
async function storedDocs(p: Page): Promise<Doc[]> {
  return p.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('bis-docs')
    r.onerror = () => reject(r.error)
    r.onsuccess = () => { const t = r.result.transaction('docs', 'readonly').objectStore('docs').getAll(); t.onsuccess = () => resolve(t.result as never) }
  }))
}
const pictures = (v: unknown): string[] => { const out: string[] = []; JSON.stringify(v, (_k, x) => { if (typeof x === 'string' && x.startsWith('data:image/')) out.push(x); return x }); return out }
const bytesOf = (url: string) => Math.floor(url.slice(url.indexOf(',') + 1).length * 3 / 4)

test('the photo really is big, so the limit is tested', () => { expect(BIG.length).toBeGreaterThan(5 * LIMIT) })

for (const [app, fixture, part, name] of [
  ['powerpoint-editor', 'src/tools/powerpoint-editor/io/__fixtures__/python-pptx.pptx', 'ppt/media/image1.png', 'deck.pptx'],
  ['word-editor', 'src/tools/word-editor/io/__fixtures__/python-docx.docx', 'word/media/image1.png', 'report.docx'],
] as const) {
  test(`${app}: a multi-megabyte photo comes in as WebP under 800KB, and goes out as JPEG`, async ({ page: p }) => {
    test.setTimeout(90_000)
    const file = replaceInZip(readFileSync(fixture), part, BIG)
    await p.goto(`/en/apps/${app}/`)
    await p.getByTestId('office-file-input').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: file })
    await expect(p.getByTestId('office-title')).toBeVisible({ timeout: 60_000 })
    await expect.poll(async () => (await storedDocs(p)).length, { timeout: 20_000 }).toBeGreaterThan(0)
    const pics = pictures((await storedDocs(p))[0].data)
    expect(pics.length).toBeGreaterThan(0)
    for (const u of pics) {
      expect(u.startsWith('data:image/webp;base64,') || u.startsWith('data:image/svg')).toBe(true)
      expect(bytesOf(u)).toBeLessThanOrEqual(LIMIT)
    }
    // Out again: the picture every Office opens, not the WebP the editor keeps.
    const ok = p.getByTestId('office-loss-ok')
    if (await ok.isVisible().catch(() => false)) await ok.click()
    await p.getByTestId('office-file').click()
    const ext = app === 'word-editor' ? 'docx' : 'pptx'
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId(`office-export-${ext}`).click()])
    const media = zipEntries(readFileSync(await dl.path())).filter((e) => /\/media\//.test(e.name))
    expect(media.length).toBeGreaterThan(0)
    for (const m of media) {
      expect(m.name).toMatch(/\.(jpe?g|png)$/)
      expect(m.data[0] === 0xff && m.data[1] === 0xd8 ? 'jpeg' : m.data[0] === 0x89 ? 'png' : 'other').not.toBe('other')
    }
  })
}

test('a big picture inserted by hand is stored as WebP under 800KB too', async ({ page: p }) => {
  test.setTimeout(90_000)
  await p.goto('/en/apps/word-editor/')
  await p.getByTestId('office-new').click()
  await p.getByTestId('wd-editor').click()
  await p.getByTestId('wd-picture-input').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: BIG })
  await expect(p.getByTestId('wd-image')).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => pictures((await storedDocs(p))[0]?.data).length, { timeout: 20_000 }).toBe(1)
  const [u] = pictures((await storedDocs(p))[0].data)
  expect(u.startsWith('data:image/webp;base64,')).toBe(true)
  expect(bytesOf(u)).toBeLessThanOrEqual(LIMIT)
})
