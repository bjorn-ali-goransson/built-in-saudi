// The six ATS dimensions are written down in THREE places. Keep them identical.
//
//   1. src/tools/cv-generator/CvGeneratorTool.tsx   ATS_DIMS   (drives the radar)
//   2. functions/cvPrompts.js                       ATS_DIMENSIONS
//   3. functions/cvPrompts.js                       the JSON shape inside the
//                                                   scoring prompt itself
//
// Nothing checked that they agree, and the failure is silent AND misleading.
// The radar reads `scores[ATS_DIMS[i].key] || 0`, so a dimension renamed on the
// server makes the client read `undefined`, fall back to 0, and draw that axis
// at the origin — where `heat()` paints it bright red. The candidate is shown a
// confident failing score on a dimension that actually scored fine, and the
// number they are being sold on is the one that is wrong.
//
// A missing entry the other way is quieter but still wrong: a dimension the
// model scores and pays for, that is never rendered.
//
// Verified to fail: renaming `impact` in either file, or dropping it from the
// prompt's JSON shape, is named by this script.
import { readFileSync } from 'node:fs'

const CLIENT = 'src/tools/cv-generator/CvGeneratorTool.tsx'
const SERVER = 'functions/cvPrompts.js'

const client = readFileSync(CLIENT, 'utf8')
const server = readFileSync(SERVER, 'utf8')

/** ATS_DIMS = [ { key: 'keywords', ... }, ... ] */
const clientBlock = /const ATS_DIMS\s*=\s*\[([\s\S]*?)\n\]/.exec(client)?.[1]
if (!clientBlock) {
  console.error(`check-ats-dims: could not find ATS_DIMS in ${CLIENT}.`)
  process.exit(1)
}
const clientDims = [...clientBlock.matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1])

/** export const ATS_DIMENSIONS = ['keywords', ...] */
const serverBlock = /ATS_DIMENSIONS\s*=\s*\[([^\]]*)\]/.exec(server)?.[1]
if (!serverBlock) {
  console.error(`check-ats-dims: could not find ATS_DIMENSIONS in ${SERVER}.`)
  process.exit(1)
}
const serverDims = [...serverBlock.matchAll(/'([^']+)'/g)].map((m) => m[1])

/**
 * The JSON shape the scoring prompt asks the model to return. This is the one
 * that actually decides what comes back, so a list that agrees with itself in
 * two places and not with the prompt is still broken.
 */
// Anchored inside SCORE_SYSTEM, not to the first "Return ONLY JSON:" in the
// file — there are three, and the rebuild prompt's comes first. The first
// version of this check matched that one, compared [cv] against the six
// dimensions and failed on a clean tree. Loudly wrong beat quietly wrong, but
// it is the same class of mistake as a vacuous green: anchor to the thing you
// mean, not to the first thing that looks like it.
const scoreSystem = server.slice(server.indexOf('export const SCORE_SYSTEM'))
const shape = /Return ONLY JSON:\s*\{([^}]*)\}/.exec(scoreSystem)?.[1]
if (!shape) {
  console.error(`check-ats-dims: could not find the scoring prompt's JSON shape in ${SERVER}.`)
  process.exit(1)
}
const promptDims = [...shape.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1])

const problems = []
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

// Order matters for the client (it is the order of the radar's axes) but not
// between the two server lists, so compare as sets there and as a list here.
if (!same([...clientDims].sort(), [...serverDims].sort())) {
  problems.push(`client ATS_DIMS  [${clientDims.join(', ')}]\n  server ATS_DIMENSIONS [${serverDims.join(', ')}]`)
}
if (!same([...serverDims].sort(), [...promptDims].sort())) {
  problems.push(`server ATS_DIMENSIONS [${serverDims.join(', ')}]\n  prompt JSON shape     [${promptDims.join(', ')}]`)
}

if (problems.length) {
  console.error('check-ats-dims: the ATS dimensions have drifted apart.\n')
  for (const p of problems) console.error('  ' + p + '\n')
  console.error('  A renamed dimension makes the radar draw that axis at ZERO and colour it red,')
  console.error('  so the candidate is shown a failing score on a dimension that scored fine.')
  process.exit(1)
}

console.log(`check-ats-dims: ${clientDims.length} dimensions agree across client, server and prompt.`)
