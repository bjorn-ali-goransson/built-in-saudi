// Does the CATEGORY OFFER survive the shapes a query actually arrives in?
//
// `evals/inputshapes.mjs` measured this for the RESULTS and the answer was
// brutal — a question mark halved top-1, quotes destroyed it, a pasted URL
// never worked at all. The fix was `lib/normaliseQuery.ts`, wired into
// `searchTools.ts` so home, the launcher and the 404 suggestions cannot drift
// apart on it.
//
// The category offer is rendered BESIDE those results and was never given the
// same treatment: `HomePage` and `AppLauncher` both pass the RAW query to
// `<CategoryOffer>`. So the two halves of the same screen can disagree about
// what was typed — correct results under an offer that did not fire, from one
// query.
//
// Run: npx tsc src/lib/categoryMatch.ts src/lib/normaliseQuery.ts --outDir
//        evals/gen --module esnext --target es2022 --moduleResolution bundler
//      node evals/offershapes.mjs

import { matchGroup } from './gen/categoryMatch.js'
import { normaliseQuery } from './gen/normaliseQuery.js'

// The queries the offer exists for — one per category and collection, in both
// languages, taken from the shapes people type into a search box.
const QUERIES = [
  'pdf tools', 'free pdf tools', 'image tools', 'developer tools', 'text tools',
  'audio tools', 'video tools', 'calculators', 'health', 'time and date',
  'islamic', 'arabic', 'saudi', 'generators', 'design', 'web', 'files',
  'converters', 'security', 'teaching', 'ramadan',
  'أدوات pdf', 'أدوات الصور', 'أدوات المطورين', 'حاسبات', 'صحة', 'إسلامية',
  'أدوات عربية', 'أدوات رمضان', 'التعليم', 'الأمان', 'أدوات الملفات',
]

const SHAPES = {
  'unchanged': (q) => q,
  'question mark': (q) => q + '?',
  'full stop': (q) => q + '.',
  'double quoted': (q) => '"' + q + '"',
  'guillemets': (q) => '«' + q + '»',
  'hyphenated': (q) => q.split(' ').join('-'),
  'extra spaces': (q) => '  ' + q + '  ',
  'UPPER CASE': (q) => q.toUpperCase(),
  // The shape no internal normaliser can handle, and the one this measurement
  // exists for: the link a category page is meant to be SHARED at.
  'pasted URL': (q) => 'https://built-in-saudi.com/en/c/' + q.split(' ').join('-') + '/',
}

const baseline = QUERIES.filter((q) => matchGroup(q))
console.log('category queries: ' + QUERIES.length +
  '   firing unchanged: ' + baseline.length)
console.log('\n(only the queries that already fire unchanged are counted, so a')
console.log(' shape can never be blamed for a query the matcher never knew)\n')
console.log('shape'.padEnd(16), 'raw'.padStart(6), 'normalised'.padStart(12))

const rows = []
for (const [name, shape] of Object.entries(SHAPES)) {
  let raw = 0, norm = 0
  for (const q of baseline) {
    const shaped = shape(q)
    if (matchGroup(shaped)) raw++
    if (matchGroup(normaliseQuery(shaped))) norm++
  }
  rows.push({ name, raw, norm })
  console.log(name.padEnd(16), String(raw).padStart(6), String(norm).padStart(12))
}

const rawTotal = rows.reduce((a, r) => a + r.raw, 0)
const normTotal = rows.reduce((a, r) => a + r.norm, 0)
const possible = rows.length * baseline.length
console.log('\ntotal: raw ' + rawTotal + '/' + possible +
  '   normalised ' + normTotal + '/' + possible)
