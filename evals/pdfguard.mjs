// The two regressions that silently ruined every CV the tool had ever made,
// checkable WITHOUT an API key.
//
//   node evals/pdfguard.mjs
//
// `atscheck.mjs` already inspects these — but it takes a <run-tag>, so it can
// only run after a generate pass, which needs OpenAI. With the key dead, the
// guard on the two worst failure modes this template has ever had was itself
// unavailable. This renders ONE fixed synthetic CV through the real template
// and checks the same two things, so the guard works regardless.
//
//   1. LETTER-SPACED HEADINGS. Above roughly 0.12em at heading size, PDF text
//      extractors read the glyph gaps as spaces and "EXPERIENCE" comes back as
//      "E X P E R I E N C E". Section detection is the first thing a résumé
//      parser does; measured at the old 0.15em, 168 of 175 headings across
//      32 of 32 CVs were unreadable.
//   2. GLUED KEYWORDS AT A BOLD BOUNDARY. The four bundled weights were all
//      subset from Regular and kept its name table, so react-pdf embedded them
//      as ONE face — every CV rendered entirely in Regular, and with a single
//      font in play the text runs merge, eating the space at a bold boundary
//      ("using **Python**" -> "usingPython"), which costs the keyword in every
//      ATS.
//
// A third check comes free and is the root cause of (2): the four bundled TTFs
// must have DISTINCT internal PostScript names. `scripts/fix-font-names.mjs`
// rewrites them; re-run it if the subsets are ever regenerated.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/env.mjs'
import { pdfToText } from './lib/extract.mjs'
import { getRenderer } from './lib/render.mjs'

// ── the fonts' internal names ──────────────────────────────────────────────

/** Read the PostScript name (nameID 6) out of a TTF's name table. */
function postScriptName(file) {
  const b = fs.readFileSync(file)
  const numTables = b.readUInt16BE(4)
  let nameOff = 0
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16
    if (b.toString('latin1', rec, rec + 4) === 'name') { nameOff = b.readUInt32BE(rec + 8); break }
  }
  if (!nameOff) return null
  const count = b.readUInt16BE(nameOff + 2)
  const strOff = nameOff + b.readUInt16BE(nameOff + 4)
  for (let i = 0; i < count; i++) {
    const rec = nameOff + 6 + i * 12
    if (b.readUInt16BE(rec + 6) !== 6) continue
    const len = b.readUInt16BE(rec + 8)
    const off = b.readUInt16BE(rec + 10)
    const platform = b.readUInt16BE(rec)
    const raw = b.subarray(strOff + off, strOff + off + len)
    // Platform 3 (Windows) is UTF-16BE; platform 1 (Mac) is single-byte.
    // Platform 3 stores UTF-16 BIG-endian; Node only decodes little, so swap
    // first. Decoding it the wrong way round still yields a distinct string per
    // face, so the uniqueness check passes while the printout is mojibake —
    // which is how this went unnoticed until someone read the output.
    return platform === 3 ? Buffer.from(raw).swap16().toString('utf16le') : raw.toString('latin1')
  }
  return null
}

const weights = [400, 500, 600, 700]
const names = weights.map((w) => ({ w, name: postScriptName(path.join(ROOT, 'public', 'fonts', `ibm-plex-sans-${w}.ttf`)) }))
const unique = new Set(names.map((n) => n.name)).size

console.log('=== bundled font names ===')
for (const n of names) console.log(`  ${n.w}: ${n.name}`)
console.log(`  distinct: ${unique}/${weights.length}${unique === weights.length ? '' : '   <-- react-pdf will collapse these into ONE face'}`)

// ── the rendered PDF ───────────────────────────────────────────────────────

const cv = {
  name: 'Sara Al-Otaibi',
  role: 'Senior Data Analyst',
  contact: { location: 'Riyadh, Saudi Arabia', email: 'sara@example.com', phone: '0501234567', links: [] },
  summary: 'Data analyst with eight years building reporting in **Python** and **SQL** for large operations teams.',
  skills: [{ category: 'Languages & Core', items: 'Python, SQL, Power BI' }],
  experience: [{
    role: 'Senior Analyst',
    company: 'Aramco',
    startDate: 'Mar 2021',
    endDate: 'Present',
    bullets: [
      'Cut monthly reporting time by 40% by rewriting the pipeline using **Python**',
      'Led a team of 6 analysts across two sites',
    ],
  }],
  projects: [],
  talks: [],
  certifications: [],
  publications: [],
  education: [{ degree: 'BSc Computer Science', institution: 'King Saud University', year: '2015' }],
  languages: [{ name: 'Arabic', level: 'Native' }, { name: 'English', level: 'Fluent' }],
}

const render = await getRenderer()
const pdf = await render(cv)
const text = await pdfToText(pdf)

console.log('\n=== headings, as a parser reads them ===')
// A letter-spaced heading arrives with a space between every glyph.
const spacedOut = text.split('\n').filter((l) => /\b(?:[A-Z]\s){3,}[A-Z]\b/.test(l))
const HEADINGS = ['EXPERIENCE', 'SKILLS', 'EDUCATION', 'LANGUAGES']
const found = HEADINGS.filter((h) => text.includes(h))
console.log(`  intact: ${found.join(', ') || 'none'}`)
console.log(`  letter-spaced apart: ${spacedOut.length}${spacedOut.length ? '  ' + JSON.stringify(spacedOut) : ''}`)

console.log('\n=== bold boundaries ===')
// The check has to SEE the boundary to mean anything: a run that finds neither
// the good string nor the bad one is vacuously green. So the lines are printed,
// and the assertion is that the bolded word is present with its space intact.
const keywordLines = text.split('\n').filter((l) => /Python|SQL/.test(l))
console.log(keywordLines.map((l) => '  | ' + JSON.stringify(l)).join('\n') || '  (no line mentions the bolded keywords — the check would be vacuous)')
const glued = keywordLines.filter((l) => /[a-z]Python|[a-z]SQL/.test(l))
const boundaryPresent = keywordLines.some((l) => /using Python|Python, SQL|and \*?\*?SQL/.test(l))
console.log(`  boundary visible in the text: ${boundaryPresent}`)
console.log(`  glued: ${glued.length ? JSON.stringify(glued) : 'none'}`)

const ok = unique === weights.length && spacedOut.length === 0 && glued.length === 0 && found.length === HEADINGS.length && boundaryPresent
console.log(`\n${ok ? 'PASS' : 'FAIL'} — fonts distinct: ${unique === weights.length}, headings readable: ${found.length}/${HEADINGS.length}, no letter-spacing: ${spacedOut.length === 0}, no glued keywords: ${glued.length === 0}, boundary actually checked: ${boundaryPresent}`)
process.exit(ok ? 0 : 1)
