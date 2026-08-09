// A tool that encodes a Saudi authority's rule must be badged BETA.
//
// The badge is an honesty signal, not a maturity one. These tools are as well
// tested as any on the site; what makes them different is that their output can
// become wrong without anyone touching the code — GOSI's pension rate steps
// every July, tariffs and thresholds move, a royal decree lands. "Beta" tells
// the reader to check the number against the authority before acting on it,
// which is the same thing the Disclaimer says in words.
//
// The objective anchor is the SOURCES block: a rule file carries one precisely
// because an authority set the figures in it. So every tool whose logic module
// cites SOURCES must be `status: 'beta'`, and the build fails otherwise.
//
// EXTRA below is the editorial half — tools that satisfy a Saudi requirement
// without a rule module of their own. That judgement cannot be derived, so it
// is written down instead.
import { readFileSync, readdirSync, existsSync } from 'node:fs'

/** Badged beta by judgement, with the reason. */
const EXTRA = {
  'vat-calculator': 'applies the ZATCA VAT rate',
  'zakat-calculator': 'applies zakat rates and nisab',
  'end-of-service': 'applies the Labour Law gratuity formula',
  'id-expiry': 'counts against iqama and ID renewal windows',
  'zatca-qr': 'reads the ZATCA invoice QR (TLV) spec',
  'invoice-generator': 'produces an invoice that must satisfy ZATCA',
  quotation: 'produces a document that must satisfy ZATCA',
}

/** Not badged, deliberately: a naming standard is not a rule that can move. */
// A naming standard is not a rule that can move. Neither is Naegele's rule,
// which is obstetrics from 1812: `due-date` is medical rather than
// regulatory, so nobody republishes it and the badge would be noise.
const NOT_A_RULE = new Set(['saudi-plate', 'short-address', 'saudi-phone', 'name-spelling', 'due-date'])

const root = process.cwd()
const reg = readFileSync('src/tools/index.ts', 'utf8')

const problems = []
let beta = 0
for (const d of readdirSync(`${root}/src/tools`)) {
  const metaPath = `${root}/src/tools/${d}/meta.ts`
  if (!existsSync(metaPath) || !reg.includes(`'./${d}/meta'`)) continue
  const meta = readFileSync(metaPath, 'utf8')
  const id = /id: '([^']+)'/.exec(meta)?.[1]
  const status = /status: '([^']+)'/.exec(meta)?.[1]
  if (!id || status === 'coming-soon') continue

  // Does any module in this tool cite an authority?
  const cites = readdirSync(`${root}/src/tools/${d}`).some(
    (f) => /\.ts$/.test(f) && f !== 'meta.ts' && readFileSync(`${root}/src/tools/${d}/${f}`, 'utf8').includes('SOURCES — checked'),
  )
  const shouldBeBeta = (cites || id in EXTRA) && !NOT_A_RULE.has(id)

  if (shouldBeBeta && status !== 'beta') {
    problems.push(`${id}: ${cites ? 'cites SOURCES' : EXTRA[id]}, so it must be status: 'beta' (is '${status}')`)
  }
  if (status === 'beta') beta += 1
}

if (problems.length) {
  console.error('check-saudi-beta: a tool encoding an authority\'s rule is not badged beta.\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error('\n  The badge says the figure can go stale without the code changing.')
  console.error('  If a tool genuinely encodes no rule, add it to NOT_A_RULE with the reason.\n')
  process.exit(1)
}
console.log(`check-saudi-beta: ${beta} tools badged beta; every rule-citing tool is among them.`)
