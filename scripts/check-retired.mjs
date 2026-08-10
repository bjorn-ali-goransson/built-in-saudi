// A tool that was deliberately WITHDRAWN must not come back by accident.
//
// `docs/ROADMAP.md` has excluded loan / EMI / interest calculators for Shariah
// reasons since the beginning. One was built anyway in July 2026, sat live for
// a month, and was withdrawn in `546448f` — "a disclaimer does not fix a tool
// that should not exist" — leaving `/apps/loan-calculator` redirecting to the
// catalogue so old links and search results would not dead-end.
//
// **In August 2026 a web sweep re-proposed exactly that tool and it was rebuilt
// in full** — module, UI, meta, seo, sitemap, disclaimer, spec — before anything
// objected. What finally objected was the redirect: the page rendered the
// catalogue instead of the tool, and only chasing that found the rule.
//
// That is a tripwire in the wrong place. A withdrawal is a decision, and the
// decision lived in one `RetiredToolRedirect` line in the router and in prose in
// the roadmap — neither of which is consulted while adding a tool. This makes it
// the same kind of thing as `check-tool-registry` and `check-saudi-beta`: a
// build failure that names the rule.
//
// Deliberately NOT a keyword or subject-matter check. "Does this tool concern
// interest?" is not decidable by a regex, and a guess would fire on
// `early-settlement`, which encodes the rule REPLACING interest charges. The
// retired-route list is objective: somebody wrote that line on purpose.
//
// Run automatically from `prebuild`. Verified to fail by re-adding the tool.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const router = readFileSync(path.join(ROOT, 'src/router.tsx'), 'utf8')

// `{ path: 'apps/<id>', element: <RetiredToolRedirect /> }`
const retired = [...router.matchAll(/path: 'apps\/([a-z0-9-]+)', element: <RetiredToolRedirect/g)]
  .map((m) => m[1])

// A regex over source is a guess, so it is CHECKED — otherwise every assertion
// below is vacuously true and this file is decoration.
if (!retired.length) {
  console.error('check-retired: found no retired routes in router.tsx — the sweep is broken')
  process.exit(1)
}

const problems = []
for (const dir of readdirSync(path.join(ROOT, 'src/tools'))) {
  const meta = path.join(ROOT, 'src/tools', dir, 'meta.ts')
  if (!existsSync(meta)) continue
  const id = /\bid: '([^']+)'/.exec(readFileSync(meta, 'utf8'))?.[1]
  if (id && retired.includes(id)) {
    problems.push(
      `src/tools/${dir}/ defines '${id}', which is a RETIRED route in router.tsx.\n`
      + `    That tool was withdrawn on purpose — see docs/ROADMAP.md "Out of scope"\n`
      + `    and the commit that removed it. If the decision has genuinely changed,\n`
      + `    change it in the roadmap and delete the RetiredToolRedirect first.`,
    )
  }
}

if (problems.length) {
  console.error('check-retired: a withdrawn tool has come back:')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`check-retired: ${retired.length} withdrawn tool(s) still withdrawn.`)
