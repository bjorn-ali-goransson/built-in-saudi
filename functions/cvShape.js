// The CV shape: normalisation of everything the model returns, kept separate
// from cv.js so the eval harness can apply the EXACT same shaping production
// applies (importing cv.js would register the HTTP handlers and open Firestore).
// Mirrored where relevant by evals/lib/cvText.mjs.

import { ATS_DIMENSIONS } from './cvPrompts.js'

const ISSUE_CAP = 5 // most CV problems the model may surface at once
const GAP_CAP = 5 // most follow-up questions the model may ask at once
// Experience dates, coerced to ONE shape. The prompt asks for "Mar 2023", but a
// model that writes "July 2025" or "07/2025" for a single role leaves the CV
// with mixed date formats, which readers and parsers both read as sloppiness —
// and it is the one thing dragging `format` down that costs nothing to fix
// deterministically. A bare year is left alone (the prompt keeps it when the
// source gives no month) and anything unrecognised passes through untouched.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
export function normalizeDate(raw) {
  const d = String(raw || '').trim()
  if (!d) return ''
  if (/^(present|current|now|ongoing|to date)$/i.test(d)) return 'Present'
  const mon = (i, year) => `${MONTHS[i][0].toUpperCase()}${MONTHS[i].slice(1)} ${year}`
  // "March 2023", "Mar 2023", "Mar. 2023", "Sept 2023"
  let m = d.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/)
  if (m) {
    const w = m[1].toLowerCase()
    let i = MONTH_NAMES.indexOf(w)
    if (i < 0) i = MONTHS.indexOf(w.slice(0, 3))
    if (i >= 0) return mon(i, m[2])
  }
  // "03/2023", "03-2023", "2023-03", "2023/03"
  let num = 0, year = ''
  if ((m = d.match(/^(\d{1,2})[/-](\d{4})$/))) { num = Number(m[1]); year = m[2] }
  else if ((m = d.match(/^(\d{4})[/-](\d{1,2})$/))) { num = Number(m[2]); year = m[1] }
  if (num >= 1 && num <= 12 && year) return mon(num - 1, year)
  return d
}

export function normalize(cv) {
  const arr = (x) => (Array.isArray(x) ? x : [])
  const str = (x) => (typeof x === 'string' ? x : '')
  // Preserve the model's item id (so a targeted improve can patch by it),
  // falling back to a stable per-section slug when it's missing.
  const idOf = (t, prefix, i) => str(t && t.id).trim().slice(0, 40) || `${prefix}-${i + 1}`
  const dated = (items, prefix) => arr(items).map((t, i) => ({ id: idOf(t, prefix, i), title: str(t.title), detail: str(t.detail), year: str(t.year) })).filter((t) => t.title)
  return {
    name: str(cv.name),
    role: str(cv.role),
    available: str(cv.available),
    contact: {
      location: str(cv.contact && cv.contact.location),
      phone: str(cv.contact && cv.contact.phone),
      email: str(cv.contact && cv.contact.email),
      links: arr(cv.contact && cv.contact.links).map((l) => ({ label: str(l.label), url: str(l.url) })).filter((l) => l.label && l.url),
    },
    summary: str(cv.summary),
    skills: arr(cv.skills).map((g, i) => ({ id: idOf(g, 'skill', i), category: str(g.category), items: str(g.items) })).filter((g) => g.category && g.items),
    experience: arr(cv.experience).map((j, i) => ({
      id: idOf(j, 'exp', i), role: str(j.role), company: str(j.company), location: str(j.location),
      startDate: normalizeDate(j.startDate), endDate: normalizeDate(j.endDate), bullets: arr(j.bullets).map(str).filter(Boolean),
    })).filter((j) => j.role || j.company),
    projects: arr(cv.projects).map((p, i) => ({ id: idOf(p, 'proj', i), name: str(p.name), description: str(p.description) })).filter((p) => p.name),
    talks: dated(cv.talks, 'talk'),
    certifications: dated(cv.certifications, 'cert'),
    publications: dated(cv.publications, 'pub'),
    // Keep an entry that names EITHER a degree or an institution: plenty of
    // uploads list only the university (or the extraction mangles the degree),
    // and requiring a degree silently deleted the candidate's only education
    // line — a completeness hit we then had no way to explain.
    education: arr(cv.education).map((e, i) => ({ id: idOf(e, 'edu', i), degree: str(e.degree), institution: str(e.institution), year: str(e.year) })).filter((e) => e.degree || e.institution),
    languages: arr(cv.languages).map((l, i) => ({ id: idOf(l, 'lang', i), name: str(l.name), level: str(l.level) })).filter((l) => l.name),
  }
}

// A section-level PATCH from a targeted improve: normalize ONLY the keys present
// (each present array/scalar is a complete replacement of that section), so
// unchanged sections the model didn't re-emit are left untouched on merge.
const SECTION_KEYS = ['name', 'role', 'available', 'contact', 'summary', 'skills', 'experience', 'projects', 'talks', 'certifications', 'publications', 'education', 'languages']
/** Did this section survive normalization with anything in it? */
function hasContent(v) {
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'string') return v.trim().length > 0
  return v != null && v !== ''
}

export function normalizePatch(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const present = {}
  for (const k of SECTION_KEYS) if (k in raw) present[k] = raw[k]
  // Reuse the full normalizer, then keep only the sections that were present.
  const full = normalize(present)
  const out = {}
  for (const k of Object.keys(present)) {
    // An EMPTY section is dropped from the patch, not carried into it.
    //
    // The client merges section-level — `{ ...cv, ...patch }` — so whatever a
    // patch says about a section replaces it wholesale. In this wire format
    // "unchanged" is expressed by OMITTING the key, which means an empty value
    // carries no information at all: `experience: []` is indistinguishable from
    // a model that simply had nothing to say. Keeping it deleted the
    // candidate's entire work history from the improved CV.
    //
    // The two readings are not symmetric, which is what settles it. A stale
    // section is recoverable — they can improve again. A deleted one is their
    // career missing from the document they send an employer. And the rebuild
    // prompt is preserve-first by contract and forbidden from dropping content,
    // so an empty section is a malformed response rather than an instruction.
    //
    // Verified by `node evals/patchcheck.mjs`, which fails if this regresses.
    if (hasContent(full[k])) out[k] = full[k]
  }
  return out
}

// Problems the model can't fix on its own, shown to the candidate in a dialog
// before the CV itself. Most severe first, capped — a wall of nitpicks is noise.
const SEVERITIES = ['high', 'medium', 'low']
export function normalizeIssues(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((i) => {
      if (typeof i === 'string') return { title: i.trim().slice(0, 120), detail: '', severity: 'medium' }
      if (!i || typeof i !== 'object') return null
      const severity = SEVERITIES.includes(String(i.severity).toLowerCase()) ? String(i.severity).toLowerCase() : 'medium'
      return {
        title: String(i.title || '').trim().slice(0, 120),
        detail: String(i.detail || '').trim().slice(0, 500),
        severity,
      }
    })
    .filter((i) => i && i.title)
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))
    .slice(0, ISSUE_CAP)
}

// ATS scores → a clean { dim: 1-5 } map, defaulting a missing/garbled value to 3.
export function clampAts(raw) {
  const out = {}
  for (const k of ATS_DIMENSIONS) {
    const n = Math.round(Number(raw && raw[k]))
    out[k] = Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 3
  }
  return out
}

// Follow-up questions only the candidate can answer, most helpful first.
export function normalizeGaps(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((g, n) => ({
      id: String((g && g.id) || `gap${n}`).trim().slice(0, 40) || `gap${n}`,
      question: String((g && g.question) || '').trim().slice(0, 200),
      why: String((g && g.why) || '').trim().slice(0, 120),
      expects: String((g && g.expects) || '').toLowerCase() === 'percent' ? 'percent' : 'text',
      targets: (Array.isArray(g && g.targets) ? g.targets : []).map((t) => String(t || '').trim().slice(0, 40)).filter(Boolean).slice(0, 12),
    }))
    .filter((g) => g.question)
    .slice(0, GAP_CAP)
}
