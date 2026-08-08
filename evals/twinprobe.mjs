// Why does a tool lose to its twin?
//
// Six of the eight remaining bench misses are the same shape: the query names a
// family ("password", "hijri", "cron", "contacts") and the tool that wins is
// the OTHER member of that family. This dumps what each of the pair actually
// indexes, so the cause is visible rather than guessed at.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { scoreTool } from './gen/fuzzy.js'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const reg = readFileSync(`${ROOT}/src/tools/index.ts`, 'utf8')
const dirs = readdirSync(`${ROOT}/src/tools`).filter(
  (d) => existsSync(`${ROOT}/src/tools/${d}/meta.ts`) && reg.includes(`'./${d}/meta'`),
)

const AR_CATEGORY = {
  Generators: 'مولّدات', Images: 'صور', Design: 'تصميم', Converters: 'محوّلات',
  Developer: 'أدوات المطوّرين', Web: 'الويب', Text: 'نصوص', Calculators: 'حاسبات',
  PDF: 'PDF', Business: 'أعمال', Communication: 'تواصل', Files: 'ملفات',
  Utilities: 'أدوات', 'Saudi / Local': 'أدوات سعودية', Islamic: 'إسلاميات', Arabic: 'العربية',
}

const byId = new Map()
for (const d of dirs) {
  const raw = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
  // Strip whole-line // comments BEFORE pulling quoted strings out. Without
  // this the harness reads a comment as data: a note saying why a keyword was
  // removed mentions the word in quotes, and the bench dutifully re-indexed it
  // — reporting the removal as having had no effect. A parser that reads the
  // explanation as the thing being explained is worse than no parser.
  const src = raw.split(String.fromCharCode(10)).filter((l) => !/^\s*\/\//.test(l)).join(String.fromCharCode(10))
  if (/status: 'coming-soon'/.test(src)) continue
  const pick = (k) => (new RegExp(`${k}: '((?:[^'\\\\]|\\\\.)*)'`).exec(src)?.[1] ?? '')
  const kwBlock = /keywords: \[([\s\S]*?)\]/.exec(src)?.[1] ?? ''
  const keywords = [...kwBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1])
  const arBlock = /ar:\s*\{([\s\S]*?)\n  \}/.exec(src)?.[1] ?? ''
  const arPick = (k) => (new RegExp(`${k}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(arBlock)?.[1] ?? '')
  const category = pick('category')
  const t = {
    id: pick('id'),
    name: pick('name'),
    // The UI passes localizeTool(tool, locale).name -- the ar BLOCK'"'"'s name --
    // not the top-level nameAr field, which most metas do not even define. The
    // bench read the field, so for every such tool the Arabic name was simply
    // absent from the index: حاسبة النسبة ranked its own calculator SEVENTH.
    nameAr: arPick('name') || pick('nameAr'),
    tagline: `${arPick('tagline')} ${pick('tagline')}`.trim(),
    category: `${AR_CATEGORY[category] ?? category} ${category}`.trim(),
    keywords,
  }
  byId.set(t.id, t)
}

const PAIRS = [['مسح ضوئي','pdf-ocr','pdf-organise'],['جهات الاتصال','vcard-to-csv','csv-vcard']]

for (const [q, want, beat] of PAIRS) {
  const a = byId.get(want), b = byId.get(beat)
  if (!a || !b) { console.log(`?? missing meta for ${want} / ${beat}`); continue }
  console.log(`\n=== "${q}"`)
  for (const [label, t] of [['WANT ' + want, a], ['GOT  ' + beat, b]]) {
    console.log(`  ${label}  score ${scoreTool(q, t).toFixed(2)}`)
    console.log(`     name     ${t.name}  /  ${t.nameAr}`)
    console.log(`     tagline  ${t.tagline}`)
    console.log(`     keywords ${t.keywords.join(', ')}`)
  }
}
