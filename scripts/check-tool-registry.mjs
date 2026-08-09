// The "how to add a tool" checklist, enforced instead of remembered.
//
//   node scripts/check-tool-registry.mjs   (also runs in prebuild)
//
// CLAUDE.md lists what a new tool needs: registered, an entry in `seo.ts` so
// the prerender emits a real page, both locale URLs in `sitemap.xml` **with a
// trailing slash**, and an e2e spec. Two of those were already guarded — the
// disclaimer and the tool doc. The rest were guarded by whoever remembered.
//
// Each omission fails silently and in a way no test would catch:
//
//   - no `seo.ts` entry  -> the prerendered page keeps the DEFAULT description,
//     on every locale, forever;
//   - missing from the sitemap -> the page exists and is never crawled;
//   - no trailing slash -> the URL 301-redirects, because pages are served as
//     directory index.html (CLAUDE.md says so, and it is easy to get wrong);
//   - no e2e reference -> exactly how `file-metadata` sat unprotected while
//     hiding a real bug.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const toolsDir = path.join(root, 'src', 'tools')
const seo = readFileSync(path.join(root, 'src', 'i18n', 'seo.ts'), 'utf8')
const added = readFileSync('src/tools/added.ts', 'utf8')
const sitemap = readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8')

const e2e = readdirSync(path.join(root, 'e2e'))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(path.join(root, 'e2e', f), 'utf8'))
  .join('\n')

const problems = []
let checked = 0

for (const dir of readdirSync(toolsDir)) {
  const metaPath = path.join(toolsDir, dir, 'meta.ts')
  if (!existsSync(metaPath)) continue
  const meta = readFileSync(metaPath, 'utf8')
  if (/status: 'coming-soon'/.test(meta)) continue
  const id = /id: '([^']+)'/.exec(meta)?.[1]
  if (!id) { problems.push(`${dir}/meta.ts has no id`); continue }
  // An external/showcase tool links out and has no page of its own.
  if (/^\s*href:/m.test(meta) && !/component:/.test(meta)) continue
  checked++

  if (!seo.includes(`id: '${id}'`)) {
    problems.push(`${id} is not in src/i18n/seo.ts — its prerendered page will carry the default description`)
  }
  for (const loc of ['en', 'ar']) {
    if (sitemap.includes(`/${loc}/apps/${id}/</loc>`)) continue
    problems.push(
      sitemap.includes(`/${loc}/apps/${id}<`)
        ? `${id} is in the sitemap for /${loc} WITHOUT a trailing slash — that URL 301-redirects`
        : `${id} is missing from public/sitemap.xml for /${loc}`,
    )
  }
  if (!added.includes(`'${id}':`)) {
    problems.push(`${id} is missing from src/tools/added.ts — run \`node scripts/gen-tool-dates.mjs\`. Without it the tool can never appear in "Recently added", which is the one place a returning visitor looks for it.`)
  }
  if (!e2e.includes(id)) {
    problems.push(`${id} is referenced by no e2e spec`)
  }
}

console.log(`live tools checked: ${checked}`)
if (problems.length) {
  console.error('\n' + problems.map((p) => `  ${p}`).join('\n'))
  process.exit(1)
}
console.log('every one has an seo entry, both sitemap URLs, and e2e coverage.')
