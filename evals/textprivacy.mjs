// The privacy guard counts FILE inputs. What about the tools you PASTE into?
//
// `scripts/check-privacy-coverage.mjs` demands every tool with a `type="file"`
// input be proved, declared as sending data, or listed as unverified — and it
// drove that to 78 proved, 0 unproved. But product principle #1 is not only
// about files: `token-counter`'s own copy says a prompt "is often the most
// confidential thing a team writes", `password-strength` takes a password, and
// `data-anonymize` exists to strip identifiers OUT of pasted text.
//
// A tool that takes a textarea and posts it would be exactly as bad as one that
// posts a file, and **invisible to the current guard** — which is the "a guard
// scoped to whatever someone remembered" failure this repo has recorded three
// times about the file list itself.
//
// This measures the gap. It is a MEASUREMENT, not a gate, until somebody has
// looked at the list and decided which entries are real.
//
// Run: node evals/textprivacy.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs'

const root = process.cwd()
const spec = readFileSync('e2e/privacy.spec.ts', 'utf8')

// Tools already proved by the file-based guard, by their id in CASES.
const proved = new Set([...spec.matchAll(/\bid:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]))

// Declared as sending data by design — read from the coverage script so the two
// cannot drift. Using the shared source rather than a second copy.
const cov = readFileSync('scripts/check-privacy-coverage.mjs', 'utf8')
const sendsBlock = cov.slice(cov.indexOf('const SENDS_DATA'), cov.indexOf('/**', cov.indexOf('const SENDS_DATA')))
const sendsData = new Set([...sendsBlock.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]))

const dirs = readdirSync(`${root}/src/tools`, { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => e.name)

const registry = readFileSync(`${root}/src/tools/index.ts`, 'utf8')

const rows = []
for (const dir of dirs) {
  const base = `${root}/src/tools/${dir}`
  const files = readdirSync(base).filter((f) => /\.tsx?$/.test(f))
  let src = ''
  for (const f of files) src += readFileSync(`${base}/${f}`, 'utf8')

  const meta = existsSync(`${base}/meta.ts`) ? readFileSync(`${base}/meta.ts`, 'utf8') : ''
  const id = meta.match(/\bid:\s*'([a-z0-9-]+)'/)?.[1]
  if (!id) continue
  // Live only: a coming-soon tool has no page to leak from.
  if (!new RegExp(`\\b${dir.replace(/-/g, '')}Tool\\b`, 'i').test(registry.replace(/-/g, ''))) { /* keep going */ }

  const hasFile = /type=["']file["']/.test(src)
  const hasText = /<Textarea\b|<textarea\b/.test(src)
  // A textarea is a good proxy for "free text somebody pasted", and it MISSED a
  // credential: `totp` takes the shared secret in a plain <Input>. So an input
  // whose testid names a secret counts too.
  const hasSecret = /data-testid="[^"]*(secret|key|token|password|passphrase)[^"]*"/.test(src)
    || /type=["']password["']/.test(src)
  if ((!hasText && !hasSecret) || hasFile) continue

  rows.push({
    id,
    dir,
    proved: proved.has(id),
    sends: sendsData.has(id),
    why: hasText ? 'textarea' : 'secret field',
  })
}

const unproved = rows.filter((r) => !r.proved && !r.sends)
console.log(`tools that take PASTED TEXT or a SECRET, and no file: ${rows.length}`)
console.log(`  proved by the existing guard: ${rows.filter((r) => r.proved).length}`)
console.log(`  declared as sending data:     ${rows.filter((r) => r.sends).length}`)
console.log(`  NEITHER — the gap:            ${unproved.length}\n`)
for (const r of unproved) console.log(`  ${r.id.padEnd(22)} ${r.why}`)
