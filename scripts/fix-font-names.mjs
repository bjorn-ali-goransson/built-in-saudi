// One-off maintenance script — kept for the record and for the next time these
// subsets are regenerated.
//
// public/fonts/ibm-plex-sans-{400,500,600,700}.ttf are four genuinely different
// weights (their OS/2 usWeightClass is correct), but all four were subset from
// the Regular source and kept its name table, so every one of them reports the
// PostScript name "IBMPlexSans-Regular". @react-pdf/renderer embeds fonts by
// that internal name, so registering all four collapsed them into ONE embedded
// face and the exported CV rendered entirely in Regular — no bold keywords, no
// semibold headings. Worse, with a single font in play the PDF text operators
// merge, and the space at a bold-run boundary is lost ("using **Python**" comes
// out as "usingPython"), which costs the candidate the keyword in every ATS.
//
// The fix: give each file a unique PostScript name. Replacements are the SAME
// byte length as the original, so the name table's offsets and lengths stay
// valid and no other table has to be touched — the strings are simply
// overwritten in place, in both the Mac (ASCII) and Windows (UTF-16BE) records.
//
//   node scripts/fix-font-names.mjs [--check]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'public', 'fonts')
const OLD = 'IBMPlexSans-Regular'
// Same length as OLD (19 chars) so the replacement is a pure in-place overwrite.
const NEW = { 400: 'IBMPlexSans-Regular', 500: 'IBMPlexSans-Medium0', 600: 'IBMPlexSans-SemiBd0', 700: 'IBMPlexSans-Bold000' }
const CHECK = process.argv.includes('--check')

const utf16be = (s) => Buffer.from(Array.from(s).flatMap((c) => [0, c.charCodeAt(0)]))

let changed = 0
for (const [weight, name] of Object.entries(NEW)) {
  const file = path.join(DIR, `ibm-plex-sans-${weight}.ttf`)
  const buf = fs.readFileSync(file)
  if (name === OLD) { console.log(`  ${weight}: left as "${OLD}" (the genuine Regular)`); continue }
  if (name.length !== OLD.length) throw new Error(`replacement for ${weight} must be ${OLD.length} chars`)

  let hits = 0
  for (const [from, to] of [[Buffer.from(OLD, 'latin1'), Buffer.from(name, 'latin1')], [utf16be(OLD), utf16be(name)]]) {
    let i = 0
    while ((i = buf.indexOf(from, i)) !== -1) { to.copy(buf, i); i += from.length; hits++ }
  }
  if (!hits) { console.log(`  ${weight}: nothing to do (already renamed?)`); continue }
  if (!CHECK) fs.writeFileSync(file, buf)
  changed++
  console.log(`  ${weight}: "${OLD}" → "${name}"  (${hits} record${hits === 1 ? '' : 's'})${CHECK ? '  [dry run]' : ''}`)
}

// Verify the result parses and now reports distinct identities.
const fontkit = (await import('fontkit')).default ?? (await import('fontkit'))
console.log('\nresulting identities:')
for (const weight of Object.keys(NEW)) {
  const f = fontkit.openSync(path.join(DIR, `ibm-plex-sans-${weight}.ttf`))
  console.log(`  ${weight}: postscriptName=${f.postscriptName}  usWeightClass=${f['OS/2'].usWeightClass}  glyphs=${f.numGlyphs}`)
}
console.log(changed ? `\n${changed} file(s) rewritten.` : '\nno changes.')
