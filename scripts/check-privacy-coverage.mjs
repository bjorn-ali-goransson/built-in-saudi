// Every tool that takes a file must be classified for the privacy guard.
//
// "Files are never uploaded" is product principle #1 and appears in the copy of
// over a hundred tools. `e2e/privacy.spec.ts` tests it — but only for the tools
// listed in its CASES array, and that list has now been found short THREE
// times, each time by accident while doing something else. A guard scoped to
// whatever someone remembered is not a guard.
//
// So: every tool with a file input must appear in exactly one of three places.
//
//   CASES in e2e/privacy.spec.ts  — verified: no request carries the file
//   SENDS_DATA below             — legitimately talks to a backend, so the
//                                  claim does not apply and must not be tested
//   UNVERIFIED below             — takes a file, is believed client-side, and
//                                  nobody has proved it. A known debt, visible
//                                  and dated, rather than an unknown one.
//
// A NEW tool with a file input fails the build until it is classified. That is
// the point: the cost of adding a row is trivial, and the cost of shipping an
// untested privacy claim is the brand.
import { readFileSync, readdirSync, existsSync } from 'node:fs'

/**
 * Tools that DO send data, by design. Listing them here is not an exemption
 * from scrutiny — it is a record that the privacy claim on that page must be
 * worded differently, and `e2e/privacy.spec.ts` must NOT assert silence for it.
 */
const SENDS_DATA = new Set([
  'ats-cv-optimizer', // uploads the CV to our backend for the OpenAI pass
  'calls',            // P2P, but the handshake goes through the relay
])

/**
 * Takes a file, believed to be entirely client-side, NOT yet proved.
 *
 * Measured 8 August 2026: of 65 tools that take a file, 17 were proved and 46
 * were not — so the claim on those 46 pages rested on nobody having made a
 * mistake. Work the list down; do not add to it without a reason.
 */
const UNVERIFIED = new Set([
  'audio-trim', 'batch-watermark', 'carousel-split', 'cert-decoder', 'color-palette',
  'colour-blind', 'epub-text', 'favicon-generator', 'file-encrypt', 'hash-generator',
  'ics-builder', 'image-compressor', 'image-cropper', 'image-format-converter',
  'image-rearrange', 'image-redact', 'images-to-pdf', 'image-to-ascii', 'image-to-text',
  'meme-generator', 'metadata-remove', 'passport-photo', 'pdf-booklet', 'pdf-compress',
  'pdf-edit', 'pdf-fill', 'pdf-merge', 'pdf-redact', 'pdf-sign', 'pdf-split', 'pdf-stamp',
  'pdf-to-images', 'qr-code', 'qr-reader', 'remove-background', 'remove-silence',
  'screenshot-frame', 'sheet-diff', 'social-resize', 'steganography', 'svg-editor',
  'video-audio', 'video-gif', 'video-trim', 'xlsx-convert', 'zatca-qr',
])

const root = process.cwd()
const spec = readFileSync('e2e/privacy.spec.ts', 'utf8')
// \b matters: `testid: 'cv-file'` also ends in `id: '`, so without it every
// testid is scooped up as though it were a tool, and the set holds 34 entries
// where 17 are real.
//
// It happens not to change the verdict — a testid never collides with a tool
// id, so the membership test survives — but the same pattern typed into a
// shell to COUNT the covered tools reports 32, and that number was believed
// and reported before this script existed. A regex that is wrong in a way the
// logic tolerates still poisons everything you read off it.
const covered = new Set([...spec.matchAll(/\bid: '([a-z0-9-]+)'/g)].map((m) => m[1]))

const reg = readFileSync('src/tools/index.ts', 'utf8')
const takesFile = []
for (const d of readdirSync(`${root}/src/tools`)) {
  const meta = `${root}/src/tools/${d}/meta.ts`
  if (!existsSync(meta) || !reg.includes(`'./${d}/meta'`)) continue
  const files = readdirSync(`${root}/src/tools/${d}`)
  const hasInput = files.some(
    (f) => /\.tsx?$/.test(f) && readFileSync(`${root}/src/tools/${d}/${f}`, 'utf8').includes('type="file"'),
  )
  if (!hasInput) continue
  const id = /id: '([^']+)'/.exec(readFileSync(meta, 'utf8'))?.[1]
  if (id) takesFile.push(id)
}

const unclassified = takesFile.filter(
  (id) => !covered.has(id) && !SENDS_DATA.has(id) && !UNVERIFIED.has(id),
)
// A tool that was on the debt list and has since been covered should leave it,
// or the list stops meaning anything.
const staleDebt = [...UNVERIFIED].filter((id) => covered.has(id))
// And a tool that no longer exists, or no longer takes a file.
const gone = [...UNVERIFIED, ...SENDS_DATA].filter((id) => !takesFile.includes(id))

let bad = false
if (unclassified.length) {
  bad = true
  console.error('check-privacy-coverage: these tools take a file and are classified nowhere:\n')
  for (const id of unclassified) console.error(`  ${id}`)
  console.error('\n  Add a row to CASES in e2e/privacy.spec.ts (preferred), or list it in')
  console.error('  SENDS_DATA / UNVERIFIED in scripts/check-privacy-coverage.mjs with a reason.\n')
}
if (staleDebt.length) {
  bad = true
  console.error(`check-privacy-coverage: covered by the spec but still listed as UNVERIFIED: ${staleDebt.join(', ')}`)
}
if (gone.length) {
  bad = true
  console.error(`check-privacy-coverage: listed here but no longer a tool with a file input: ${gone.join(', ')}`)
}
if (bad) process.exit(1)

const total = takesFile.length
const done = takesFile.filter((id) => covered.has(id)).length
console.log(
  `check-privacy-coverage: ${total} tools take a file — ${done} proved, ${UNVERIFIED.size} unproved, ${SENDS_DATA.size} send data by design.`,
)
