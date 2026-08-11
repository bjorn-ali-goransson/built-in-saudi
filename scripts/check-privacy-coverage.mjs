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
 * mistake. Four batches took it from 17 to ALL of them. This list is now
 * empty, and the right number of entries for it is zero — a tool here is a
 * page making a promise nothing checks.
 */
const UNVERIFIED = new Set([
  // Empty. Every tool that takes a file is proved or declared as sending data
  // by design. Keep it that way: the coverage script fails the build on a new
  // tool that is neither.
])

/**
 * The same question, one axis across: the tools you PASTE into.
 *
 * Measured 11 August 2026 (`node evals/textprivacy.mjs`): **58 tools take
 * pasted text or a secret and NOT ONE was covered** — including `jwt-decoder`,
 * where the thing you paste IS a credential, `hmac` (a signing key), `totp` (a
 * shared secret) and `curl-convert` (an Authorization header, in practice).
 * The file list had been found short three times by accident; this axis had
 * never been looked at at all.
 *
 * Same three buckets, plus one the file guard did not need: a tool proved by a
 * DIFFERENT spec, named, so the proof is not duplicated and not lost.
 */
const TEXT_SENDS_DATA = new Map([
  ['diacritize', 'posts the text to our backend for the OpenAI pass'],
  ['prompt-analyzer', 'posts the prompt to our backend for the OpenAI pass'],
  ['link-preview', 'fetches the URL you give it — that IS the tool'],
  ['password-strength', 'k-anonymous range query to HIBP; proved by e2e/password-strength.spec.ts'],
])

/** Proved by a spec other than e2e/privacy.spec.ts, named so it can be checked. */
const TEXT_PROVED_ELSEWHERE = new Map([
  ['translate', 'e2e/builtin-ai.spec.ts asserts the typed text never appears in a request'],
  ['summarize', 'e2e/builtin-ai.spec.ts asserts the typed text never appears in a request'],
  ['detect-language', 'e2e/builtin-ai.spec.ts asserts the typed text never appears in a request'],
])

/**
 * Takes pasted text, believed entirely client-side, NOT yet proved.
 *
 * A visible, dated debt rather than an invisible one — exactly how the file
 * list started at 46 before four batches emptied it. **Zero is the right
 * number here too**; every name below is a page making a promise nothing
 * checks. Work it down by FAMILY, not by recency, which is how the file list
 * got short three times before anyone noticed the pattern.
 */
const TEXT_UNVERIFIED = new Set([
  'a11y-check', 'arabic-normalize', 'arabic-numerals', 'arabic-poetry', 'attendance-sheet',
  'bingo-cards', 'case-converter', 'certificate', 'csv-json', 'fix-encoding', 'franco-arabic',
  'invisible-chars', 'json-diff', 'json-formatter', 'json-to-types', 'label-sheet',
  'line-breaks', 'list-tools', 'markdown-table', 'passphrase', 'password-generator',
  'paste-to-markdown', 'quiz-maker', 'quotation', 'random-picker', 'readable-text',
  'readme-generator', 'regex-tester', 'robots-txt', 'saudi-phone', 'seating-chart',
  'speech-time', 'spin-wheel', 'team-maker', 'text-counter', 'typing-test', 'url-encoder',
  'user-agent', 'uuid-generator', 'word-search', 'worksheets',
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

// --- the same question for tools you PASTE into -----------------------------
const textCovered = new Set(
  [...spec.matchAll(/\bid:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]),
)
const takesText = []
for (const d of readdirSync(`${root}/src/tools`)) {
  const meta = `${root}/src/tools/${d}/meta.ts`
  if (!existsSync(meta)) continue
  const files = readdirSync(`${root}/src/tools/${d}`).filter((f) => /\.tsx?$/.test(f))
  let src = ''
  for (const f of files) src += readFileSync(`${root}/src/tools/${d}/${f}`, 'utf8')
  if (/type="file"/.test(src)) continue  // already covered by the file half
  const hasText = /<Textarea\b|<textarea\b/.test(src)
  // `totp` takes a shared secret in a plain <Input>; a textarea proxy missed it.
  const hasSecret = /data-testid="[^"]*(secret|key|token|password|passphrase)[^"]*"/.test(src)
    || /type="password"/.test(src)
  if (!hasText && !hasSecret) continue
  const id = /id: '([^']+)'/.exec(readFileSync(meta, 'utf8'))?.[1]
  if (id) takesText.push(id)
}

const textUnclassified = takesText.filter(
  (id) => !textCovered.has(id) && !TEXT_SENDS_DATA.has(id)
    && !TEXT_PROVED_ELSEWHERE.has(id) && !TEXT_UNVERIFIED.has(id),
)
const textStale = [...TEXT_UNVERIFIED].filter((id) => textCovered.has(id))
const textGone = [...TEXT_UNVERIFIED, ...TEXT_SENDS_DATA.keys(), ...TEXT_PROVED_ELSEWHERE.keys()]
  .filter((id) => !takesText.includes(id))

let textBad = false
if (textUnclassified.length) {
  textBad = true
  console.error('check-privacy-coverage: these tools take pasted text or a secret and are classified nowhere:\n')
  for (const id of textUnclassified) console.error(`  ${id}`)
  console.error('\n  Add a row to TEXT_CASES in e2e/privacy.spec.ts (preferred), or list it in')
  console.error('  TEXT_SENDS_DATA / TEXT_PROVED_ELSEWHERE / TEXT_UNVERIFIED here, with a reason.\n')
}
if (textStale.length) {
  textBad = true
  console.error(`check-privacy-coverage: covered by the spec but still listed as TEXT_UNVERIFIED: ${textStale.join(', ')}`)
}
if (textGone.length) {
  textBad = true
  console.error(`check-privacy-coverage: listed under the text buckets but no longer such a tool: ${textGone.join(', ')}`)
}
if (textBad) process.exit(1)

const textDone = takesText.filter((id) => textCovered.has(id)).length
console.log(
  `check-privacy-coverage: ${takesText.length} tools take pasted text — ${textDone} proved here, `
  + `${TEXT_PROVED_ELSEWHERE.size} proved elsewhere, ${TEXT_UNVERIFIED.size} unproved, `
  + `${TEXT_SENDS_DATA.size} send data by design.`,
)
