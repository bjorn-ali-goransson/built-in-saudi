// Eval runner.
//
//   node evals/run.mjs [--variants champion,challenger] [--n 8] [--samples 3]
//                      [--roundtrip] [--only <substring>] [--concurrency 4]
//
// For every CV it: extracts the text the browser would extract, runs each
// variant, then blind-scores the ORIGINAL and each RESULT with the same
// instrument (evals/lib/judge.mjs) so the before/after delta is measured rather
// than asserted by the model that did the rewriting. --roundtrip additionally
// feeds each result back in as if the candidate re-uploaded the CV we gave them,
// which is the case users report as "it lowered my score".
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/env.mjs'
import { extractFile } from './lib/extract.mjs'
import { cvToText, bodyWordCount } from './lib/cvText.mjs'
import { scoreCv, diffContent, DIMS } from './lib/judge.mjs'
import { retention } from './lib/retention.mjs'
import { pool, usage } from './lib/openai.mjs'

const argv = process.argv.slice(2)
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : def
}
const has = (name) => argv.includes(`--${name}`)

const CVS_DIR = path.join(ROOT, 'evals', 'cvs')
const OUT_DIR = path.join(ROOT, 'evals', 'out')
const N = Number(flag('n', 0)) || 0
const SAMPLES = Number(flag('samples', 3))
const CONCURRENCY = Number(flag('concurrency', 4))
const ROUNDTRIP = has('roundtrip')
const ONLY = flag('only', '')
const VARIANT_IDS = String(flag('variants', 'champion')).split(',').map((s) => s.trim()).filter(Boolean)
const TAG = flag('tag', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19))

const variants = []
for (const id of VARIANT_IDS) variants.push((await import(`./variants/${id}.mjs`)).default)

let files = fs.readdirSync(CVS_DIR).filter((f) => /\.(pdf|docx|txt|md)$/i.test(f)).sort()
if (ONLY) files = files.filter((f) => f.toLowerCase().includes(ONLY.toLowerCase()))
if (N) files = files.slice(0, N)

console.log(`${files.length} CVs × ${variants.length} variant(s) — judge samples: ${SAMPLES}, roundtrip: ${ROUNDTRIP}\n`)

const results = await pool(files, CONCURRENCY, async (file) => {
  const name = file.replace(/\.[^.]+$/, '')
  try {
    const source = await extractFile(path.join(CVS_DIR, file))
    // The original is scored through the identical instrument as every result.
    const before = await scoreCv(source, { samples: SAMPLES })
    const row = { file, name, sourceWords: source.split(/\s+/).filter(Boolean).length, before, variants: {} }

    for (const v of variants) {
      const gen = await v.generate(source)
      const text = cvToText(gen.cv)
      const [after, diff] = await Promise.all([
        scoreCv(text, { samples: SAMPLES }),
        diffContent(source, text),
      ])
      const entry = {
        after,
        diff,
        retention: retention(source, text),
        words: bodyWordCount(gen.cv),
        // What production TOLD the user, for comparison with what we measured.
        claimedAts: gen.ats,
        claimedBefore: gen.atsBefore,
        issues: gen.issues?.length || 0,
        gaps: gen.gaps?.length || 0,
        cv: gen.cv,
        text,
      }
      if (ROUNDTRIP) {
        // Re-upload our own output, exactly as the user described doing.
        const again = await v.generate(text)
        const againText = cvToText(again.cv)
        entry.roundtrip = {
          claimedBefore: again.atsBefore, // production's grade for OUR OWN output
          claimedAts: again.ats,
          measured: await scoreCv(againText, { samples: SAMPLES }),
        }
      }
      row.variants[v.id] = entry
    }
    process.stdout.write(`  ✓ ${name}\n`)
    return row
  } catch (e) {
    process.stdout.write(`  ✗ ${name}: ${e.message}\n`)
    return { file, name, error: String(e.message) }
  }
})

// ── report ───────────────────────────────────────────────────────────────────
const ok = results.filter((r) => r && !r.error)
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const f1 = (n) => (n >= 0 ? '+' : '') + n.toFixed(2)

console.log('\n' + '='.repeat(78))
console.log('BLIND-JUDGED BEFORE → AFTER  (independent scorer, same rubric both sides)')
console.log('='.repeat(78))

for (const v of variants) {
  const rows = ok.filter((r) => r.variants[v.id])
  if (!rows.length) continue
  console.log(`\n── ${v.label} (${v.id}) — ${rows.length} CVs`)
  console.log('  dimension        before   after    delta')
  for (const d of [...DIMS, 'overall']) {
    const b = mean(rows.map((r) => r.before[d]))
    const a = mean(rows.map((r) => r.variants[v.id].after[d]))
    const bar = a - b >= 0 ? '' : '   ← REGRESSION'
    console.log(`  ${d.padEnd(15)} ${b.toFixed(2).padStart(6)} ${a.toFixed(2).padStart(8)} ${f1(a - b).padStart(8)}${bar}`)
  }
  const bp = mean(rows.map((r) => r.before.interviewProbability))
  const ap = mean(rows.map((r) => r.variants[v.id].after.interviewProbability))
  console.log(`  ${'interview %'.padEnd(15)} ${bp.toFixed(1).padStart(6)} ${ap.toFixed(1).padStart(8)} ${f1(ap - bp).padStart(8)}`)

  const worse = rows.filter((r) => r.variants[v.id].after.overall < r.before.overall)
  console.log(`\n  CVs made WORSE overall: ${worse.length}/${rows.length}` + (worse.length ? ` → ${worse.map((r) => r.name.slice(0, 22)).join(', ')}` : ''))

  const hiDrop = rows.flatMap((r) => r.variants[v.id].diff.dropped.filter((d) => d.severity === 'high'))
  const inv = rows.flatMap((r) => r.variants[v.id].diff.invented.filter((d) => d.severity !== 'low'))
  console.log(`  High-severity content DROPPED: ${hiDrop.length} across ${rows.filter((r) => r.variants[v.id].diff.dropped.some((d) => d.severity === 'high')).length} CVs`)
  console.log(`  Facts INVENTED (med+high):     ${inv.length}`)
  console.log(`  Tech-keyword retention:  ${mean(rows.map((r) => r.variants[v.id].retention.tech.kept)).toFixed(1)}%`)
  console.log(`  Metric retention:        ${mean(rows.map((r) => r.variants[v.id].retention.metrics.kept)).toFixed(1)}%`)
  console.log(`  Body words:              ${mean(rows.map((r) => r.variants[v.id].words)).toFixed(0)} (source ${mean(rows.map((r) => r.sourceWords)).toFixed(0)})`)

  // Production's self-reported numbers vs the blind instrument.
  const claimed = rows.filter((r) => r.variants[v.id].claimedAts && r.variants[v.id].claimedBefore)
  if (claimed.length) {
    const cb = mean(claimed.map((r) => mean(DIMS.map((d) => r.variants[v.id].claimedBefore[d]))))
    const ca = mean(claimed.map((r) => mean(DIMS.map((d) => r.variants[v.id].claimedAts[d]))))
    console.log(`\n  What the tool TELLS the user:  ${cb.toFixed(2)} → ${ca.toFixed(2)}  (${f1(ca - cb)})`)
    const mb = mean(claimed.map((r) => r.before.overall))
    const ma = mean(claimed.map((r) => r.variants[v.id].after.overall))
    console.log(`  What the blind judge measures: ${mb.toFixed(2)} → ${ma.toFixed(2)}  (${f1(ma - mb)})`)
  }

  if (ROUNDTRIP) {
    const rt = rows.filter((r) => r.variants[v.id].roundtrip)
    if (rt.length) {
      const told = mean(rt.map((r) => mean(DIMS.map((d) => r.variants[v.id].claimedAts?.[d] ?? 0))))
      const reGraded = mean(rt.map((r) => mean(DIMS.map((d) => r.variants[v.id].roundtrip.claimedBefore?.[d] ?? 0))))
      console.log(`\n  ROUND TRIP — re-uploading our own output:`)
      console.log(`    tool scored it (as its own output):   ${told.toFixed(2)}`)
      console.log(`    tool scored it (as a fresh upload):   ${reGraded.toFixed(2)}   ${f1(reGraded - told)}`)
      const drops = rt.filter((r) => {
        const a = mean(DIMS.map((d) => r.variants[v.id].claimedAts?.[d] ?? 0))
        const b = mean(DIMS.map((d) => r.variants[v.id].roundtrip.claimedBefore?.[d] ?? 0))
        return b < a
      })
      console.log(`    CVs where re-upload scores LOWER:     ${drops.length}/${rt.length}`)
      const m1 = mean(rt.map((r) => r.variants[v.id].after.overall))
      const m2 = mean(rt.map((r) => r.variants[v.id].roundtrip.measured.overall))
      console.log(`    blind judge, pass 1 → pass 2:         ${m1.toFixed(2)} → ${m2.toFixed(2)}  (${f1(m2 - m1)})`)
    }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const outFile = path.join(OUT_DIR, `run-${TAG}.json`)
fs.writeFileSync(outFile, JSON.stringify({ tag: TAG, variants: VARIANT_IDS, samples: SAMPLES, roundtrip: ROUNDTRIP, usage, results }, null, 2))
console.log(`\nOpenAI: ${usage.calls} calls, ${(usage.in / 1000).toFixed(0)}k in / ${(usage.out / 1000).toFixed(0)}k out`)
console.log(`Full results → ${path.relative(ROOT, outFile)}`)
