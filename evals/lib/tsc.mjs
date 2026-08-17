// Compile a production module standalone so a harness can call the REAL thing
// rather than a copy of it — the arrangement `relatedPick.ts` and `cvPatch.ts`
// exist for, and the fix for the drift `relatedcheck` once spent weeks inside.
//
// **`tsc` emits an import specifier exactly as it was written**, so a source
// `from './unzip'` stays extensionless and is unresolvable under Node ESM. The
// product's own imports are deliberately left alone — adding `.js` there would
// make one file inconsistent with every other in `src/` — so the fix belongs
// on the generated copy.
//
// This is shared because the same trap has now been hit three times and patched
// two different ways: `relatedcheck.mjs` and `check-orphans.mjs` each hardcoded
// a rewrite of `./fuzzy`, which fixes the one specifier that existed when they
// were written and breaks the moment the module gains another; `docxguard.mjs`
// did not patch at all, so `lib/docx.ts` importing `./unzip` made the gate FAIL
// on a clean checkout — a guard reporting a defect the code does not have.
// Rewrite every relative specifier, not the one you happen to know about.

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import path from 'node:path'

// `from './x'`, `from "./x"` and `import('./x')` — relative, and only when the
// last segment carries no extension. `./fuzzy` gains `.js`; `./data.json` and
// the bare-package specifiers around it are left alone.
const RELATIVE = /(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g

/** Add `.js` to every extensionless relative specifier in one emitted file. */
export function fixSpecifiers(file) {
  const before = readFileSync(file, 'utf8')
  const after = before.replace(RELATIVE, (whole, lead, q, spec) => (
    path.extname(spec) ? whole : `${lead}${q}${spec}.js${q}`
  ))
  if (after !== before) writeFileSync(file, after)
  return after !== before
}

/** Every .js under a directory, recursively. */
function emitted(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...emitted(full))
    else if (full.endsWith('.js')) out.push(full)
  }
  return out
}

/**
 * Compile `sources` (absolute paths) into `outDir` and make the output
 * importable by Node. `tsc` is invoked through `process.execPath` rather than
 * `npx`, which is `EINVAL` on Windows without a shell.
 */
export function compile(root, sources, outDir, extra = []) {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules/typescript/bin/tsc'),
    ...sources,
    '--outDir', outDir,
    '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
    ...extra,
  ], { stdio: 'inherit' })
  for (const f of emitted(outDir)) fixSpecifiers(f)
}
