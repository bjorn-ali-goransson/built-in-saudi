// Which Cloud Functions a push has to redeploy.
//
//   node scripts/functions-plan.mjs <changed file>...   → one "name entry" per line
//   node scripts/functions-plan.mjs --all               → every function
//
// Every deploy uploads the whole functions/ folder, so a function only needs
// redeploying when code it RUNS has changed. Each module registers its own
// handlers and imports nothing from its siblings except as listed below, so a
// change to call.js touches the Calls/Messages functions and nothing else.
// Anything shared — the entry point that imports every module, the
// dependencies, the workflow itself — redeploys everything, and so does a file
// this table has never heard of: guessing small is the failure that would leave
// a function running old code with nobody noticing.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FUNCTIONS_DIR = fileURLToPath(new URL('../functions/', import.meta.url))

/** module → [function name, entry point] */
export const FUNCTIONS = {
  'index.js': [['subscribe', 'subscribe'], ['unsubscribe', 'unsubscribe'], ['send-due', 'sendDue'], ['touch', 'touch'], ['debug', 'debug']],
  'booking.js': [['booking-google-start', 'bookingGoogleStart'], ['booking-google-callback', 'bookingGoogleCallback'], ['save-schedule', 'saveSchedule'], ['get-availability', 'getAvailability'], ['book', 'book'], ['telegram-webhook', 'telegramWebhook'], ['delete-host', 'deleteHost'], ['my-data', 'myData'], ['host-status', 'hostStatus'], ['get-config', 'getConfig']],
  'cv.js': [['cv-generate', 'cvGenerate'], ['cv-refine', 'cvRefine']],
  'shorten.js': [['shorten', 'shorten'], ['resolve-link', 'resolveLink'], ['my-links', 'myLinks'], ['delete-link', 'deleteLink']],
  'call.js': [['call-signal', 'callSignal'], ['call-register', 'callRegister'], ['call-ring', 'callRing'], ['call-delete', 'callDelete'], ['call-missed', 'callMissed'], ['call-dm', 'callDm'], ['call-msg', 'callMsg']],
  'prompt.js': [['analyze-prompt', 'analyzePrompt'], ['improve-prompt', 'improvePrompt']],
  'diacritize.js': [['diacritize', 'diacritize']],
  'todo.js': [['todo-sync', 'todoSync'], ['todo-mine', 'todoMine'], ['todo-share', 'todoShare'], ['todo-delete', 'todoDelete']],
}

/** Modules imported by another module, so a change to one redeploys the importer. */
const USED_BY = { 'cvPrompts.js': ['cv.js'], 'cvText.js': ['cv.js'], 'cvShape.js': ['cv.js'] }

/** Changes that touch nothing deployed. */
const INERT = new Set(['functions/README.md'])

export function plan(changed) {
  const all = () => Object.values(FUNCTIONS).flat()
  const mods = new Set()
  for (const f of changed) {
    if (INERT.has(f)) continue
    const m = /^functions\/([^/]+)$/.exec(f)
    if (!m) { if (f.startsWith('functions/') || f === '.github/workflows/deploy-functions.yml' || f === 'scripts/functions-plan.mjs') return all(); continue }
    const file = m[1]
    // The entry point imports every module and sets up the shared VAPID
    // singleton, and the dependencies are everybody's: all of it.
    if (file === 'index.js' || file === 'package.json' || file === 'package-lock.json') return all()
    if (FUNCTIONS[file]) mods.add(file)
    else if (USED_BY[file]) USED_BY[file].forEach((x) => mods.add(x))
    else return all()
  }
  return [...mods].flatMap((m) => FUNCTIONS[m])
}

// The table has to name every handler the code registers, or a new function
// would never be deployed by anything.
export function unlisted(dir = FUNCTIONS_DIR) {
  const listed = new Set(Object.values(FUNCTIONS).flat().map(([, e]) => e))
  const out = []
  for (const mod of Object.keys(FUNCTIONS)) {
    const src = readFileSync(`${dir}/${mod}`, 'utf8')
    for (const m of src.matchAll(/\bhttp\(\s*'([A-Za-z0-9]+)'/g)) if (!listed.has(m[1])) out.push(`${mod}: ${m[1]}`)
  }
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const missing = unlisted()
  if (missing.length) {
    console.error('functions-plan: handlers registered in the code but missing from FUNCTIONS:\n  ' + missing.join('\n  '))
    process.exit(1)
  }
  const args = process.argv.slice(2)
  const rows = args.includes('--all') ? Object.values(FUNCTIONS).flat() : plan(args)
  for (const [name, entry] of rows) console.log(`${name} ${entry}`)
}
