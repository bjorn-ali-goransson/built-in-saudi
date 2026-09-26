// Generate the two illustration bands for `activity-schedule`.
//
// Run by hand, not in the build:  node scripts/gen-schedule-art.mjs
//
// The output is COMMITTED (`public/illustrations/schedule-*.webp`), so the
// site never calls an image API and this script exists only to redo the
// artwork. Needs OPENAI_KEY in the gitignored root `.env`.
//
// Two images, and the count is the point: they are wide bands that repeat on
// every sheet, so more of them would be variety nobody asked for and four more
// things to keep consistent.
//
// The model returns 3:2; a header band is more like 12:1. So each prompt asks
// for the subject arranged along ONE edge with empty space elsewhere, and the
// band is cropped out of that edge — composing for the crop rather than
// cropping whatever came back.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const root = path.resolve(import.meta.dirname, '..')
const outDir = path.join(root, 'public', 'illustrations')
// The raw generations are cached so re-cropping costs no API call. Gitignored:
// they are 1.5MB each and only the cropped bands are shipped.
const rawDir = path.join(root, '.art-cache')

const env = Object.fromEntries(
  readFileSync(path.join(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const KEY = env.OPENAI_KEY
if (!KEY) { console.error('no OPENAI_KEY in .env'); process.exit(1) }

/** The house style, repeated verbatim so the two bands belong together. */
const STYLE = [
  'Flat vector illustration, simple geometric shapes, clean even line-free fills,',
  'NO gradients, NO shadows, NO texture, NO outlines around the whole scene.',
  'Warm Najdi palette only: sand cream #fbf7ef, soft sky blue #dbe7f2, palm green #4f7d4a and #6ba05f,',
  'warm gold #f4c95d, dusty rose #e8b4bc, muted lavender #b6aedb, terracotta #d9695f, brown #9a7b4f.',
  'Cheerful, calm, suitable for a Saudi kindergarten wall.',
  'ABSOLUTELY NO TEXT, no letters, no numbers, no writing of any kind anywhere in the image.',
  'Transparent background.',
].join(' ')

const JOBS = [
  {
    name: 'schedule-header',
    edge: 'top',
    prompt: `A decorative border strip for the TOP of a children's weekly schedule poster.
All the subject matter sits in a single horizontal row across the very TOP quarter of the image;
the lower three quarters are completely empty transparent space.
Along that top row, spread evenly left to right with generous gaps:
a smiling yellow sun with simple rays, two small white clouds, a neat stack of four coloured books,
a cup holding three pencils, a string of small triangular bunting flags,
and two date palm trees with brown trunks at the right end.
Everything small and evenly spaced, like a decorative border. ${STYLE}`,
  },
  {
    name: 'schedule-footer',
    edge: 'bottom',
    prompt: `A decorative border strip for the BOTTOM of a children's weekly schedule poster.
All the subject matter sits in a single horizontal row across the very BOTTOM quarter of the image;
the upper three quarters are completely empty transparent space.
Along that bottom row, standing on a soft pale green grassy strip, spread evenly left to right:
a date palm tree, three small smiling children standing together in simple robes,
a stack of three coloured toy blocks, a ball, two more smiling children,
small simple flowers, and a date palm tree at the right end.
The children are drawn very simply: round heads, plain rounded bodies, tiny dot eyes and a small smile.
Everything small and evenly spaced, like a decorative border. ${STYLE}`,
  },
]

async function generate(job) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: job.prompt,
      size: '1536x1024',
      background: 'transparent',
      output_format: 'png',
      quality: 'high',
      n: 1,
    }),
  })
  if (!res.ok) throw new Error(`${job.name}: ${res.status} ${await res.text()}`)
  const body = await res.json()
  return Buffer.from(body.data[0].b64_json, 'base64')
}

/**
 * Crop to what was actually DRAWN, then re-encode as WebP.
 *
 * Not to a fixed fraction of the image, which is what the first version did
 * and why the books lost their spines and the children lost their heads: the
 * model puts the subject roughly where it was asked to and "roughly" is
 * several percent of 1024 pixels. The alpha channel says exactly where the
 * drawing is, so the band is cropped to its bounding box with a little air —
 * the same answer whatever the model decided to do with the margin.
 *
 * Chromium does the decode and the encode, so there is no image dependency to
 * add for a script that runs about once. WebP because these land on every
 * sheet: the raw PNGs are ~1.5MB and the bands are a twentieth of that.
 */
async function crop(png) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const out = await page.evaluate(async (b64) => {
    const img = new Image()
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/png;base64,' + b64 })
    const full = document.createElement('canvas')
    full.width = img.width
    full.height = img.height
    const fctx = full.getContext('2d')
    fctx.drawImage(img, 0, 0)
    const { data } = fctx.getImageData(0, 0, img.width, img.height)

    // Rows that carry any meaningful opacity. A stray nearly-transparent pixel
    // would otherwise make the bounding box the whole image.
    let top = -1
    let bottom = -1
    for (let y = 0; y < img.height; y++) {
      let solid = 0
      for (let x = 0; x < img.width; x++) if (data[(y * img.width + x) * 4 + 3] > 24) solid++
      if (solid > img.width * 0.004) { if (top < 0) top = y; bottom = y }
    }
    if (top < 0) return null

    const pad = Math.round(img.height * 0.02)
    const y0 = Math.max(0, top - pad)
    const y1 = Math.min(img.height, bottom + pad + 1)
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = y1 - y0
    c.getContext('2d').drawImage(img, 0, y0, img.width, c.height, 0, 0, img.width, c.height)
    return { uri: c.toDataURL('image/webp', 0.9), w: c.width, h: c.height }
  }, png.toString('base64'))
  await browser.close()
  if (!out) throw new Error('the generated image was blank')
  return { buf: Buffer.from(out.uri.split(',')[1], 'base64'), w: out.w, h: out.h }
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
if (!existsSync(rawDir)) mkdirSync(rawDir, { recursive: true })

// `--recrop` re-cuts the cached generations without calling the API again.
const recrop = process.argv.includes('--recrop')

for (const job of JOBS) {
  process.stdout.write(`${job.name}… `)
  const rawPath = path.join(rawDir, `${job.name}.png`)
  let png
  if (recrop && existsSync(rawPath)) png = readFileSync(rawPath)
  else { png = await generate(job); writeFileSync(rawPath, png) }
  const { buf, w, h } = await crop(png)
  writeFileSync(path.join(outDir, `${job.name}.webp`), buf)
  console.log(`${w}x${h}, ${(buf.length / 1024).toFixed(0)}KB  (aspect ${(w / h).toFixed(2)})`)
}
console.log('\nAspect ratios go in `illustrations.ts` — the renderers size the band from them.')
