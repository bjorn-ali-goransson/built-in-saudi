// Keeps docs/tools/ from describing a site that no longer exists.
//
//   node scripts/check-tool-docs.mjs   (also runs in prebuild)
//
// A stale doc is a bug — CLAUDE.md opens by saying so — and this set had gone
// stale in three ways at once, quietly, because nothing read them:
//
//   - ALL TWENTY specs gave the route as `/tools/<id>`, which only
//     301-redirects; the real route has been `/apps/<id>` for a long time.
//   - EIGHTEEN said "Status: Coming soon", and SIXTEEN of those tools had long
//     since shipped. Anyone reading the folder to understand the product would
//     have concluded the site barely existed.
//   - THREE were named for a tool that was renamed before it shipped, so the
//     document could not be connected to any tool at all.
//
// None of that is catchable by a typecheck or a browser test, which is exactly
// why it survived. It is catchable by three greps.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const toolsDir = path.join(root, 'src', 'tools')
const docsDir = path.join(root, 'docs', 'tools')

const ids = new Set()
for (const dir of readdirSync(toolsDir)) {
  const meta = path.join(toolsDir, dir, 'meta.ts')
  if (!existsSync(meta)) continue
  const id = /id: '([^']+)'/.exec(readFileSync(meta, 'utf8'))?.[1]
  if (id) ids.add(id)
}

const problems = []
for (const name of readdirSync(docsDir)) {
  if (!name.endsWith('.md')) continue
  const id = name.slice(0, -3)
  const src = readFileSync(path.join(docsDir, name), 'utf8')

  if (!ids.has(id)) {
    problems.push(`${name} does not name a registered tool — rename it to the tool's id, or delete it`)
    continue
  }
  if (/`\/tools\/[a-z0-9-]+`/.test(src)) {
    problems.push(`${name} still gives the route as /tools/… — it is /apps/…, and /tools only redirects`)
  }
  if (/\*\*Status:\*\*\s*Coming soon/.test(src)) {
    problems.push(`${name} says "Coming soon" but ${id} is registered and live`)
  }
}

console.log(`tool specs: ${readdirSync(docsDir).filter((f) => f.endsWith('.md')).length}`)
if (problems.length) {
  console.error('\n' + problems.map((p) => `  ${p}`).join('\n'))
  process.exit(1)
}
console.log('in step with the registry.')
