// The curated collections must stay connected to the registry.
//
// A collection (`src/lib/collections.ts`) is a hand-written list of tool ids,
// which is exactly the kind of thing that rots silently: rename a tool and the
// collection quietly gets shorter, with nothing to notice it. Every other
// hand-written list on this site is checked, and this is no different.
//
// It also refuses a slug that collides with a category's, because the two share
// the `/c/` route on purpose — a category and a collection are the same thing
// to a reader — and a collision would make one of them unreachable.
//
// Run automatically from `prebuild`. Verified to fail by renaming an id.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8')

// Swept out of the sources rather than imported: `src/lib/collections.ts` is
// pure and could be imported, but `seo.ts` and the metas pull in React through
// `lazyTool`, and a check that can only run in a bundler is a check that does
// not run. Same approach as `check-tool-registry.mjs`.
const collectionsSrc = read('src/lib/collections.ts')
const slugs = [...collectionsSrc.matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1])
const blocks = collectionsSrc.split(/slug: '[a-z0-9-]+'/).slice(1)
const collections = slugs.map((slug, i) => ({
  slug,
  toolIds: [...blocks[i].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]),
}))

// A regex over source is a guess, so it is CHECKED: the sweep must have found
// something, or every assertion below is vacuously true.
if (!collections.length) {
  console.error('check-collections: found no collections at all — the sweep is broken')
  process.exit(1)
}

const liveIds = new Set()
for (const dir of readdirSync(path.join(ROOT, 'src/tools'))) {
  const meta = path.join(ROOT, 'src/tools', dir, 'meta.ts')
  if (!existsSync(meta)) continue
  const src = readFileSync(meta, 'utf8')
  const id = /\bid: '([^']+)'/.exec(src)?.[1]
  // A coming-soon tool has no page to link to.
  if (id && !/status: 'coming-soon'/.test(src)) liveIds.add(id)
}

const categorySlugs = new Set(
  [...read('src/lib/categorySlug.ts').matchAll(/: '([a-z0-9-]+)',/g)].map((m) => m[1]),
)
const seo = read('src/i18n/seo.ts')

const problems = []
for (const c of collections) {
  if (categorySlugs.has(c.slug)) {
    problems.push(`${c.slug}: collides with a category slug — they share the /c/ route`)
  }
  if (!new RegExp(`slug: '${c.slug}', category: ''`).test(seo)) {
    problems.push(`${c.slug}: no collectionSeo entry, so its page would carry the DEFAULT description`)
  }
  if (!c.toolIds.length) problems.push(`${c.slug}: lists no tools`)
  for (const id of c.toolIds) {
    if (!liveIds.has(id)) problems.push(`${c.slug}: lists '${id}', which is not a live tool`)
  }
  const sitemap = read('public/sitemap.xml')
  for (const locale of ['en', 'ar']) {
    if (!sitemap.includes(`/${locale}/c/${c.slug}/`)) {
      problems.push(`${c.slug}: missing from sitemap.xml for /${locale} (with a trailing slash)`)
    }
  }
}

if (problems.length) {
  console.error('check-collections: problems found:')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
const total = collections.reduce((n, c) => n + c.toolIds.length, 0)
console.log(`check-collections: ${collections.length} collections, ${total} tool references, all live.`)
