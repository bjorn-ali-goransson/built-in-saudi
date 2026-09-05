// The tool index, loaded from source exactly as the UI would see it.
//
// Extracted from `searchbench.mjs` when a SECOND harness needed the same list.
// A copy is how `relatedcheck.mjs` spent weeks reporting a defect that had been
// fixed, and how a throwaway probe reported one that never existed by iterating
// the imports instead of the exported array — ties fall through to catalogue
// order, so the ORDER is part of being faithful, not a detail.
// Measure the search before touching it.
//
// A bench of queries someone would actually type, each with the tool id they
// obviously mean. Reports where that tool ranks. "Feels better" is not a
// measurement; rank-of-the-right-answer is.
import { readFileSync, readdirSync, existsSync } from 'node:fs'

// Run from the repo root: npx tsc src/lib/fuzzy.ts --outDir evals/gen --module esnext \n//   --target es2022 --moduleResolution bundler && node evals/searchbench.mjs
// '../..' now, not '..': this file moved a directory deeper when it was
// extracted, and a relative root is the thing an extraction silently breaks.
const ROOT = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// --- load the tools straight out of the metas (no TS build needed) ---
const reg = readFileSync(`${ROOT}/src/tools/index.ts`, 'utf8')
const dirs = readdirSync(`${ROOT}/src/tools`).filter(
  (d) => existsSync(`${ROOT}/src/tools/${d}/meta.ts`) && reg.includes(`'./${d}/meta'`),
)
// Mirrors CATEGORY_LABELS in src/i18n/index.tsx — the UI scores against the
// localized label as well as the English one.
// SWEPT out of `src/i18n/index.tsx`, not copied.
//
// It WAS a hand-written copy, and it drifted the moment two categories were
// added: `AR_CATEGORY[category] ?? category` falls back to the ENGLISH label, so
// the harness indexed "Health" where the site indexes «صحة» — and duly reported
// «صحة» as a query returning nothing on a site with seven health tools. That is
// the `relatedcheck` lesson in a new place: an unfaithful measurement invents
// defects as readily as it hides them.
//
// `index.tsx` imports React, so it cannot be imported here; the labels are read
// out of its source instead. A regex over source is a guess, so the guess is
// CHECKED below rather than trusted.
const LABELS_SRC = readFileSync(`${ROOT}/src/i18n/index.tsx`, 'utf8')
const AR_CATEGORY = Object.fromEntries(
  [...LABELS_SRC.matchAll(/^\s*'?([A-Za-z][\w &/]*?)'?: \{ en: '[^']*', ar: '([^']*)' \},$/gm)]
    .map((m) => [m[1].trim(), m[2]]),
)
if (Object.keys(AR_CATEGORY).length < 10) {
  throw new Error('evals/lib/tools.mjs: swept no category labels out of i18n/index.tsx')
}

/** The Arabic label, or a loud failure — never a silent English fallback. */
function arCategory(category) {
  const ar = AR_CATEGORY[category]
  if (!ar) {
    throw new Error(
      `evals/lib/tools.mjs: no Arabic label for category '${category}'. `
      + 'Add it to CATEGORY_LABELS in src/i18n/index.tsx — until then every '
      + 'Arabic measurement over these tools is wrong.',
    )
  }
  return ar
}

const tools = []
for (const d of dirs) {
  const raw = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
  // Strip whole-line // comments BEFORE pulling quoted strings out. Without
  // this the harness reads a comment as data: a note saying why a keyword was
  // removed mentions the word in quotes, and the bench dutifully re-indexed it
  // — reporting the removal as having had no effect. A parser that reads the
  // explanation as the thing being explained is worse than no parser.
  const src = raw.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  if (/status: 'coming-soon'/.test(src)) continue
  const pick = (k) => (new RegExp(`${k}: '((?:[^'\\\\]|\\\\.)*)'`).exec(src)?.[1] ?? '')
  const kwBlock = /keywords: \[([\s\S]*?)\]/.exec(src)?.[1] ?? ''
  const keywords = [...kwBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1])
  // The UI passes the localized AND English tagline/category joined together
  // (see AppLauncher). Passing only the English ones measured a scorer the site
  // does not run: "stopwatch" returned nothing here and one result in the
  // browser, because an Arabic tagline it never saw contained the subsequence.
  const arBlock = /ar:\s*\{([\s\S]*?)\n  \}/.exec(src)?.[1] ?? ''
  const arPick = (k) => (new RegExp(`${k}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(arBlock)?.[1] ?? '')
  const category = pick('category')
  tools.push({
    id: pick('id'),
    name: pick('name'),
    // The UI passes localizeTool(tool, locale).name -- the ar BLOCK'"'"'s name --
    // not the top-level nameAr field, which most metas do not even define. The
    // bench read the field, so for every such tool the Arabic name was simply
    // absent from the index: حاسبة النسبة ranked its own calculator SEVENTH.
    nameAr: arPick('name') || pick('nameAr'),
    tagline: `${arPick('tagline')} ${pick('tagline')}`.trim(),
    category: `${arCategory(category)} ${category}`.trim(),
    // The category as FILED, on its own. `category` above is what the UI SCORES
    // against — the Arabic label and the English one joined — which is right
    // for search and useless to anything counting the catalogue.
    // `scripts/check-roadmap-counts.mjs` needs the plain value, and this is the
    // shared loader, so it is added here rather than swept a second time.
    filed: category,
    keywords,
    // Read from the COMMENT-STRIPPED source, like everything else here.
    inverse: /\binverse: '([a-z0-9-]+)'/.exec(src)?.[1],
  })
}

// Registry order, because that is how the UI iterates and therefore how it
// breaks ties. Reading the directory gives alphabetical order instead, which
// silently resolved every tie the wrong way: "فاتورة" ties the invoice
// generator with the electricity bill at 432.00, and the bench called it a
// failure while the site ranks them the way the catalogue is curated.
const order = [...reg.matchAll(/^  ([a-zA-Z0-9]+Tool),$/gm)].map((m, i) => [m[1], i])
const orderRank = new Map(order)
const varOf = new Map()
for (const d of dirs) {
  const src = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
  const v = /export const ([a-zA-Z0-9]+Tool)/.exec(src)?.[1]
  const id = /id: '([^']+)'/.exec(src)?.[1]
  if (v && id) varOf.set(id, v)
}
tools.sort((a, b) => (orderRank.get(varOf.get(a.id)) ?? 1e9) - (orderRank.get(varOf.get(b.id)) ?? 1e9))

// --- the REAL scorer, compiled from src/lib/fuzzy.ts by tsc ---

export { tools }
