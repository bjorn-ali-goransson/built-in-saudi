// Renders one CV from a run to PDF and prints the text an ATS would extract,
// beside the text the JSON implies — for eyeballing where the template loses
// content.  node evals/dump.mjs <tag> <name-substring> [--variant champion]
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/env.mjs'
import { pdfToText } from './lib/extract.mjs'
import { cvToText } from './lib/cvText.mjs'
import { getRenderer } from './lib/render.mjs'

const argv = process.argv.slice(2)
const [tag, needle] = argv.filter((a) => !a.startsWith('--'))
const variant = (argv.indexOf('--variant') >= 0 && argv[argv.indexOf('--variant') + 1]) || 'champion'

const run = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'out', `run-${tag}.json`), 'utf8'))
const row = run.results.find((r) => r?.name?.toLowerCase().includes(String(needle).toLowerCase()) && r.variants?.[variant])
if (!row) { console.error('no such CV in run'); process.exit(1) }

const cv = row.variants[variant].cv
const render = await getRenderer()
const buf = await render(cv)
fs.writeFileSync(path.join(ROOT, 'evals', 'out', 'dump.pdf'), buf)

console.log('══ TEXT EXTRACTED FROM THE RENDERED PDF (what an ATS sees) ══\n')
console.log(await pdfToText(buf))
console.log('\n\n══ TEXT THE CV JSON IMPLIES ══\n')
console.log(cvToText(cv))
console.log('\n(pdf written to evals/out/dump.pdf)')
