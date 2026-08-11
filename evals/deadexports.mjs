// An export nothing calls is a half-done feature, a duplicate, or dead weight.
//
// That sweep found real bugs once — `hashPrefix` was exported so a spec could
// assert what is sent to Have I Been Pwned and the spec never used it, leaving a
// vacuous green on the site's one network call about a password; and
// `disposeImageDecoder` was written with the comment "call when a tool unmounts"
// and nothing called it, so a 1.4MB wasm worker outlived every tool that had
// decoded a HEIC.
//
// **A later attempt to repeat it was abandoned as untrustworthy**, and the
// reason is the whole design of this one. It counted an identifier's
// appearances in OTHER files and called anything with none "dead" — which
// conflates two completely different things:
//
//   · **over-exported** — used inside its own file, exported for no reason.
//     Tidy-up at most, and there are dozens.
//   · **dead** — used NOWHERE, including where it was written. That is the one
//     that is a bug, and it is rare.
//
// It reported 114 and both spot-checks were the first kind, so the list said
// nothing. This one separates them, and counts the tests and the evals as
// callers, because an export kept alive for a test is not dead — it is tested.
//
// Run: node evals/deadexports.mjs

import { readFileSync, readdirSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const files = []
const walk = (dir, into) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'gen' || e.name === 'dist') continue
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) { walk(full, into); continue }
    if (/\.(?:tsx?|mjs)$/.test(e.name)) into.push([full, readFileSync(full, 'utf8')])
  }
}
walk(`${ROOT}/src`, files)

// Anything outside src/ that legitimately keeps an export alive.
const outside = []
for (const dir of ['e2e', 'evals', 'scripts', 'functions']) {
  try { walk(`${ROOT}/${dir}`, outside) } catch { /* optional */ }
}
// The ROOT config files too. The first run reported `staticPageSeo` and
// `liveToolSeo` dead — they are imported by the prerender plugin in
// `vite.config.ts`, which is neither in src/ nor in any of the directories
// above. A sweep that cannot see a caller invents a defect.
for (const f of ['vite.config.ts', 'playwright.config.ts']) {
  try { outside.push([f, readFileSync(`${ROOT}/${f}`, 'utf8')]) } catch { /* optional */ }
}
const outsideText = outside.map(([, t]) => t).join('\n')

const DECL = /export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+([A-Za-z_$][\w$]*)/g

/** Occurrences of an identifier as a WHOLE word. */
function countIn(text, name) {
  const re = new RegExp(`(?<![\\w$])${name}(?![\\w$])`, 'g')
  return (text.match(re) || []).length
}

const dead = []
const overExported = []

for (const [file, src] of files) {
  for (const m of src.matchAll(DECL)) {
    const name = m[1]
    let elsewhere = 0
    for (const [other, text] of files) {
      if (other === file) continue
      elsewhere += countIn(text, name)
    }
    if (elsewhere > 0) continue
    if (countIn(outsideText, name) > 0) continue

    // Inside its own file: one for the declaration itself, plus any use. A type
    // or interface used only as an annotation still counts as used.
    const own = countIn(src, name)
    const rel = file.slice(ROOT.length + 1)
    if (own <= 1) dead.push([rel, name])
    else overExported.push([rel, name])
  }
}

console.log(`files scanned: ${files.length}`)
console.log(`\nDEAD — used nowhere at all, including its own file: ${dead.length}`)
for (const [f, n] of dead) console.log(`  ${n.padEnd(28)} ${f}`)
console.log(`\nover-exported — used only inside its own file: ${overExported.length}`)
console.log('  (tidy-up at most; NOT the bug this instrument is for)')
