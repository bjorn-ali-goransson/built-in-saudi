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

/**
 * The house style, repeated verbatim so the two bands belong together.
 *
 * The first pass asked for "simple geometric shapes" and "generous gaps" and
 * got exactly that: six objects on a lot of white, which read as clip-art
 * spaced out rather than a scene. These sheets go on a nursery wall next to
 * everything else on a nursery wall. So the brief now asks for a DENSE,
 * continuous band — overlapping foliage, things tucked behind other things —
 * and allows soft shading, which the flat-fill brief had forbidden and which
 * is most of what made it look dry.
 */
const STYLE = [
  'Charming modern childrens-book illustration, soft rounded shapes with gentle',
  'shading and soft highlights, warm and cosy, like a high quality kindergarten poster.',
  'A DENSE, CONTINUOUS, LOW AND WIDE decorative band that fills the strip edge to edge',
  'with no large empty gaps: elements overlap and tuck behind one another.',
  'CRITICAL: the band must be SHORT and WIDE — no taller than one fifth of the image height.',
  'Nothing tall: no full-height trees, no towers. Every object is small, squat and wide,',
  'arranged in one long low row like a border running along the edge of a page.',
  'Warm palette: cream #fdf9f0, soft sky blue, fresh leaf greens, warm gold,',
  'dusty rose, soft lavender, terracotta, warm brown.',
  'Cheerful, calm, friendly, suitable for a Saudi kindergarten wall.',
  'ABSOLUTELY NO TEXT, no letters, no numbers, no writing of any kind anywhere.',
  'No flags of any country. Transparent background.',
].join(' ')

const JOBS = [
  {
    name: 'schedule-header',
    edge: 'top',
    prompt: `A rich decorative border band for the TOP of a children's weekly schedule poster.
Everything sits in one dense horizontal row across the TOP THIRD of the image; below it is empty transparent space.
From left to right, overlapping and tucked together with no big gaps:
a cheerful smiling sun with soft rays, fluffy clouds, a leafy green bush,
a tall stack of colourful books with a small apple resting on top,
a mug crowded with pencils and crayons and a pair of scissors,
a paper aeroplane, a few floating stars and hearts, a bunting string of little triangular flags,
a small potted plant, a globe, a couple of SMALL squat potted palms,
and low leafy foliage filling every remaining gap along the band. ${STYLE}`,
  },
  {
    name: 'schedule-footer',
    edge: 'bottom',
    prompt: `A rich decorative border band for the BOTTOM of a children's weekly schedule poster.
Everything sits in one dense horizontal row across the BOTTOM THIRD of the image; above it is empty transparent space.
A soft green grassy strip runs the full width, with flowers, tufts of grass and small bushes along it.
Standing on the grass, overlapping and evenly spread with no big gaps:
low bushes, two smiling children waving, a short stack of toy blocks,
a beach ball, a small wooden toy wagon, three more smiling children of different skin tones
holding books and crayons, a friendly cat, a flower bed, a watering can,
a butterfly, and low bushes filling the far end. NO tall palm trees — keep everything low.
The children are cheerful and simply drawn, with round faces and warm smiles; some wear
simple modest clothing. ${STYLE}`,
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
 * Crop to the BAND at the requested edge, and clean the transparency.
 *
 * Two things the obvious implementations get wrong, both learned the hard way:
 *
 * **A fixed fraction of the image is not the band.** The model puts the
 * subject roughly where it was asked and "roughly" is several percent of 1024
 * pixels — which is how the first pass cost the books their spines and the
 * children their heads.
 *
 * **Nor is the whole alpha bounding box.** Asked for one band it will often
 * paint a second, lighter one at the far edge; the bounding box then spans
 * both and the crop is the entire canvas with a huge empty middle. So this
 * walks in from the requested edge and stops at the first sustained run of
 * empty rows — taking the band it was asked for and leaving whatever else the
 * model decided to add.
 *
 * It also drops nearly-transparent pixels. Generations come back speckled with
 * faint dots that are invisible against the model's own preview and read as
 * dirt on a cream sheet.
 */
async function crop(png, job) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const out = await page.evaluate(async ({ b64, edge }) => {
    const img = new Image()
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/png;base64,' + b64 })
    const full = document.createElement('canvas')
    full.width = img.width
    full.height = img.height
    const fctx = full.getContext('2d')
    fctx.drawImage(img, 0, 0)
    const image = fctx.getImageData(0, 0, img.width, img.height)
    const data = image.data

    // Speckle: anything barely there is not part of the drawing.
    for (let i = 3; i < data.length; i += 4) if (data[i] < 70) data[i] = 0
    fctx.putImageData(image, 0, 0)

    const solidPerRow = []
    for (let y = 0; y < img.height; y++) {
      let n = 0
      for (let x = 0; x < img.width; x++) if (data[(y * img.width + x) * 4 + 3] > 120) n++
      solidPerRow.push(n / img.width)
    }

    const BUSY = 0.03            // a row that is part of the band
    const GAP = Math.round(img.height * 0.06)   // how much quiet ends it
    const order = edge === 'top'
      ? [...solidPerRow.keys()]
      : [...solidPerRow.keys()].reverse()

    let first = -1
    let last = -1
    let quiet = 0
    for (const y of order) {
      if (solidPerRow[y] >= BUSY) {
        if (first < 0) first = y
        last = y
        quiet = 0
      } else if (first >= 0 && ++quiet > GAP) break
    }
    if (first < 0) return null

    const top = Math.min(first, last)
    const bottom = Math.max(first, last)
    const pad = Math.round(img.height * 0.015)
    const y0 = Math.max(0, top - pad)
    const y1 = Math.min(img.height, bottom + pad + 1)

    const c = document.createElement('canvas')
    c.width = img.width
    c.height = y1 - y0
    c.getContext('2d').drawImage(full, 0, y0, img.width, c.height, 0, 0, img.width, c.height)
    return { uri: c.toDataURL('image/webp', 0.92), w: c.width, h: c.height }
  }, { b64: png.toString('base64'), edge: job.edge })
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
  const { buf, w, h } = await crop(png, job)
  writeFileSync(path.join(outDir, `${job.name}.webp`), buf)
  console.log(`${w}x${h}, ${(buf.length / 1024).toFixed(0)}KB  (aspect ${(w / h).toFixed(2)})`)
}
console.log('\nAspect ratios go in `illustrations.ts` — the renderers size the band from them.')
