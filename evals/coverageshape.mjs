// Which tools are big and barely tested?
//
// `file-metadata` was once the only tool of 193 with no e2e coverage at all,
// and writing that coverage found a real bug — a PDF's info dictionary is
// usually not in the clear, so the tool showed a version number and nothing
// else for a large share of real files. `check-tool-registry.mjs` now fails the
// build when a live tool is referenced by NO spec, so the zero case cannot
// happen again.
//
// One case is not zero, and it is not coverage either. This ranks tools by how
// little is asserted about them relative to how much code they are, so the thin
// end is visible rather than being found by accident a second time.
//
// It is a MEASUREMENT, not a gate: a big tool can be legitimately simple, and a
// small one can deserve ten cases. The number is a place to look.
//
// Run: node evals/coverageshape.mjs

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const specs = readdirSync(`${ROOT}/e2e`).filter((f) => f.endsWith('.spec.ts'))
const specText = specs.map((f) => readFileSync(`${ROOT}/e2e/${f}`, 'utf8')).join('\n')

const rows = []
for (const dir of readdirSync(`${ROOT}/src/tools`)) {
  const metaPath = `${ROOT}/src/tools/${dir}/meta.ts`
  if (!existsSync(metaPath)) continue
  const meta = readFileSync(metaPath, 'utf8')
  const id = /\bid: '([^']+)'/.exec(meta)?.[1]
  if (!id || /status: 'coming-soon'/.test(meta)) continue

  // Lines of tool code, excluding the meta and any spec.
  let lines = 0
  const walk = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const full = `${p}/${e.name}`
      if (e.isDirectory()) { walk(full); continue }
      if (!/\.tsx?$/.test(e.name) || e.name === 'meta.ts') continue
      lines += readFileSync(full, 'utf8').split('\n').length
    }
  }
  walk(`${ROOT}/src/tools/${dir}`)
  void statSync

  // Cases that mention this tool's route or its testid prefix. Counting
  // `test(` inside a file dedicated to the tool is the strong signal; a
  // mention elsewhere counts as one.
  const own = specs.filter((f) => f.replace('.spec.ts', '') === id || f.replace('.spec.ts', '') === dir)
  let cases = 0
  for (const f of own) {
    cases += (readFileSync(`${ROOT}/e2e/${f}`, 'utf8').match(/^\s*test\(/gm) || []).length
  }
  if (!cases) {
    // Not in a file of its own: count the mentions of its route instead.
    // BOTH route forms. The first version of this counted only `/apps/<id>`
    // and reported 21 tools as untested — on a site whose build FAILS when a
    // tool is referenced by no spec. `/tools/<id>` is the legacy path that
    // 301-redirects, and a good number of the older specs still use it. An
    // unfaithful measurement invents defects as readily as it hides them.
    const hits = (specText.split(`/apps/${id}`).length - 1)
      + (specText.split(`/tools/${id}`).length - 1)
    cases = hits
  }
  rows.push({ id, lines, cases, ratio: cases ? lines / cases : Infinity })
}

rows.sort((a, b) => b.ratio - a.ratio)

console.log(`live tools: ${rows.length}`)
console.log(`\nthinnest coverage first — lines of tool code per assertion-bearing case\n`)
console.log('tool'.padEnd(24), 'lines'.padStart(6), 'cases'.padStart(6), 'lines/case'.padStart(11))
for (const r of rows.slice(0, 20)) {
  console.log(r.id.padEnd(24), String(r.lines).padStart(6), String(r.cases).padStart(6),
    (r.ratio === Infinity ? 'NO CASES' : r.ratio.toFixed(0)).padStart(11))
}

const none = rows.filter((r) => r.cases === 0)
console.log(`\ntools with no case that names them: ${none.length}${none.length ? ' -> ' + none.map((r) => r.id).join(', ') : ''}`)
const median = rows.map((r) => r.ratio).filter(Number.isFinite).sort((a, b) => a - b)[Math.floor(rows.length / 2)]
console.log(`median lines per case: ${median?.toFixed(0)}`)
