// Can an improve pass DELETE part of the candidate's CV?
//
//   node evals/patchcheck.mjs
//
// No API key needed, and it guards the highest-stakes code in the CV pipeline.
//
// The improve pass returns only the CHANGED sections as a `patch`, to save
// output tokens, and the client merges it shallowly: `{ ...cv, ...patch }`
// (`src/lib/cvApi.ts`). That merge is section-level, so whatever the patch says
// about a section REPLACES it wholesale.
//
// Which makes one question load-bearing: what does the protocol do when a model
// emits a section as `null`, `[]` or `{}`? In this wire format "unchanged" is
// expressed by OMITTING the key — so an empty value is indistinguishable from
// "delete everything under this heading". `normalizePatch` decides, and its
// test is `k in raw`, which treats present-but-empty as present.
//
// The safe reading is obvious once stated: a stale section is recoverable and a
// deleted one is the candidate's career missing from their CV. The rebuild
// prompt is preserve-first by design and is explicitly forbidden from dropping
// content, so a patch that empties a section is a malformed response, not an
// instruction.
import { normalizePatch } from '../functions/cvShape.js'

const CV = {
  name: 'Sara Al-Otaibi',
  title: 'Data Engineer',
  summary: 'Nine years building pipelines.',
  skills: ['Python', 'Airflow', 'dbt'],
  experience: [
    { id: 'experience-1', role: 'Senior Data Engineer', employer: 'Aramco', bullets: ['Cut ETL runtime 40%'] },
    { id: 'experience-2', role: 'Data Engineer', employer: 'STC', bullets: ['Built the ingest layer'] },
  ],
  education: [{ id: 'education-1', degree: 'BSc Computer Science', school: 'KSU' }],
}

const cases = [
  ['a section omitted entirely', {}],
  ['a section explicitly null', { experience: null }],
  ['a section as an empty array', { experience: [] }],
  ['a section as an empty string', { summary: '' }],
  ['skills emptied', { skills: [] }],
  ['a genuine one-section change', { summary: 'Nine years building pipelines that pay for themselves.' }],
]

let failures = 0
console.log('what a patch does to the merged CV (client does { ...cv, ...patch })\n')
for (const [label, raw] of cases) {
  const patch = normalizePatch(raw)
  const merged = { ...CV, ...patch }
  const lost = []
  for (const k of Object.keys(CV)) {
    const before = CV[k]
    const after = merged[k]
    const size = (v) => (Array.isArray(v) ? v.length : typeof v === 'string' ? v.length : v ? 1 : 0)
    if (size(before) > 0 && size(after) === 0) lost.push(k)
  }
  const verdict = lost.length ? `LOST ${lost.join(', ')}` : 'nothing lost'
  if (lost.length) failures++
  console.log(`  ${label.padEnd(32)} keys in patch: ${JSON.stringify(Object.keys(patch))}  ->  ${verdict}`)
}

console.log()
if (failures) {
  console.error(`patchcheck: ${failures} case(s) delete part of the CV.`)
  console.error('  An empty section in a patch must be treated as "unchanged", not as "delete".')
  console.error('  In this wire format "unchanged" is expressed by omitting the key, so an empty')
  console.error('  value carries no information — and the two readings are not symmetric: a stale')
  console.error('  section is recoverable, a deleted one is the candidate\'s career gone missing.')
  process.exit(1)
}
console.log('patchcheck: no patch shape can empty a section that had content.')
