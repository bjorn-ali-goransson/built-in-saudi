// CV Generator backend — verifies a Google sign-in, rate-limits per user, and
// asks OpenAI to (re)build the CV as strict JSON following the signal-not-noise
// guidelines. Two flows: cvGenerate (fresh from an uploaded CV, 2 per 24h) and
// cvRefine (instruction-driven tweaks of the generated CV). Text-in, JSON-out;
// the browser renders + exports. Nothing is stored but the rate-limit counters —
// the server-saved CV ("save for later") and JD tailoring were removed (#213).
// No new deps. Registered via index.js.

import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'

const { Firestore } = firestore
const db = new Firestore()
const USAGE = 'cvUsage'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const SITE = 'https://built-in-saudi.com'

const UPLOAD_LIMIT = 2 // fresh generations per rolling 24h per user
const OWNER_EMAIL = 'bjorn.a.goransson@gmail.com' // exempt from all rate limits
const POLISH_LIMIT = 1 // user-initiated free-form "tell me what to change" tweaks
const ELABORATE_LIMIT = 2 // "add more detail" rounds when the CV is under a page
const SHORTEN_LIMIT = 2 // "make shorter" rounds
const IMPROVE_LIMIT = 2 // "answer the questions, then raise the ATS score" rounds
const ISSUE_CAP = 5 // most CV problems the model may surface at once
const GAP_CAP = 5 // most follow-up questions the model may ask at once
const WINDOW_MS = 24 * 60 * 60 * 1000

// ATS scoring — the CV is graded 1 (poor) to 5 (excellent) on each of these, and
// the scores render as a heatmap spider chart. Higher is always better. Keep in
// sync with ATS_DIMS in the client (src/tools/cv-generator/CvGeneratorTool.tsx).
const ATS_DIMENSIONS = ['keywords', 'impact', 'clarity', 'format', 'completeness', 'conciseness']

function cors(req, res) {
  const origin = (req.headers && req.headers.origin) || ''
  const ok = /^https:\/\/([a-z0-9-]+\.)?built-in-saudi\.com$/.test(origin)
  res.set('Access-Control-Allow-Origin', ok ? origin : SITE)
  res.set('Vary', 'Origin')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}

// Verify a Google Identity Services ID token (client-side sign-in).
async function verifyGoogle(idToken) {
  if (!idToken) return null
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
    if (!r.ok) return null
    const p = await r.json()
    if (p.aud !== CLIENT_ID) return null
    if (p.exp && Date.now() / 1000 > Number(p.exp)) return null
    return { sub: p.sub, email: p.email }
  } catch {
    return null
  }
}

const RULES = `The purpose of a CV is NOT to get the job — it is to get the INTERVIEW. A recruiter spends ~10 seconds. Keep only SIGNAL, remove all NOISE.

Rules (apply strictly):
- Write the SUMMARY and SKILLS from the WHOLE document, not just any existing summary/skills section. The summary is 2–3 sentences, punchy, and MUST mention total years of experience.
- In "summary" and in experience/project text, wrap the most important keywords in **double asterisks** so they render bold. Bold sparingly — only genuine signal (technologies, scale, notable employers, impact).
- Dates: YEAR ONLY, never months. Ongoing roles use "Present" as endYear.
- Location: country and maybe city only — never a street address. If every role shares the same location, put it once in contact.location and OMIT it from each experience item.
- Links: a short label ("GitHub", "LinkedIn", "Portfolio") with its URL — never the raw URL as the label.
- Phone/email: raw values, no "Phone:" / "Email:" labels.
- REMOVE entirely: photos, references, GPA, university coursework/curriculum, exact addresses, objective-statement fluff, and any irrelevant experience (e.g. unrelated retail/food jobs for an IT professional).
- Prefer strong action-verb bullets with measurable impact. Summarise anything verbose.
- Order experience and education MOST RECENT FIRST (reverse chronological). If you add a role, insert it at the correct chronological position — a newer role goes at the top.
- Skill category labels must be SHORT — 1 to 3 words (e.g. "Cloud", "Languages", "Testing"). They render as a narrow table column, so never use long phrases.
- Education: degree, institution, year only. No scores.
- Keep it truthful — never invent employers, dates, or achievements not supported by the source.

FIX SILENTLY (do not ask, just correct):
- Spelling, grammar and typos.
- Tone: make it professional, confident and concise. Rewrite anything unprofessional, casual, arrogant or over-the-top (e.g. "rockstar ninja", "single-handedly saved the company") into credible, specific, results-focused language.
- Clarity: rewrite vague or confusing statements into clear ones where the meaning is reasonably inferable. Strip buzzword filler.

NEVER ask the candidate anything — you get exactly one pass and there is no back-and-forth. Instead, REPORT what you couldn't fix:
- Put up to 5 problems in "issues": things that are missing, inconsistent or weak in the source CV and that only the candidate can resolve. Examples: a role/seniority with no supporting evidence (e.g. "Developer, 3 years" but no technologies, projects or achievements listed); conflicting or impossible dates; a large unexplained employment gap; a claimed skill never evidenced; no contact email; achievements with no measurable outcome.
- Each issue is { "title": a 3–8 word label, "detail": one or two sentences saying what's wrong and what to add, "severity": "high" | "medium" | "low" }. "high" = a recruiter is likely to reject or distrust the CV over it; "medium" = it noticeably weakens the CV; "low" = a nice-to-have polish.
- Report only what genuinely matters, most severe first, and never invent facts to fill a gap. Always still produce the best CV you can from what's given — issues are informational, never blocking. If nothing material is wrong, return an empty array.

The CV object shape (omit a section with an empty array; omit optional strings by leaving them empty):
{
  "name": string, "role": string, "available": string,
  "contact": { "location": string, "phone": string, "email": string, "links": [{ "label": string, "url": string }] },
  "summary": string,
  "skills": [{ "category": string, "items": string }],
  "experience": [{ "role": string, "company": string, "location": string, "startYear": string, "endYear": string, "bullets": [string] }],
  "projects": [{ "name": string, "description": string }],
  "talks": [{ "title": string, "detail": string, "year": string }],
  "certifications": [{ "title": string, "detail": string, "year": string }],
  "publications": [{ "title": string, "detail": string, "year": string }],
  "education": [{ "degree": string, "institution": string, "year": string }],
  "languages": [{ "name": string, "level": string }]
}

ATS SCORE — also grade the CV YOU PRODUCE on how it will fare in an Applicant Tracking System and a recruiter's 10-second scan. Score each dimension an INTEGER 1 (poor) to 5 (excellent); higher is ALWAYS better. Score honestly the CV as it stands after your edits — if the source is thin, some scores will be low, and that is exactly what the questions below are for.
- keywords: relevant role/industry keywords, skills and technologies are present and easy for a parser to find.
- impact: achievements are concrete and quantified (numbers, scale, outcomes) rather than vague duties.
- clarity: phrasing is clear, professional and free of filler; easy to read.
- format: clean, standard, single-column structure an ATS can parse (clear sections, standard headings, dates).
- completeness: the essentials are present — contact email, a strong summary, dated roles, education, skills.
- conciseness: signal-dense and the right length — a strong, well-filled SINGLE PAGE is the target. Never pad with filler, but never cut real signal (skills, keywords, quantified impact) just to be shorter — that would hurt keywords/completeness. Trim only genuine noise.

QUESTIONS (gaps) — name what only the CANDIDATE can supply that would most RAISE those scores: e.g. missing metrics for an achievement, the target job title/industry to tune keywords toward, a claimed skill with no evidence, missing contact details, an unexplained gap. Ask each as a direct question they can answer in a sentence or two. Whenever an achievement is unquantified, ASK FOR THE NUMBER and show the shape of the answer in the question — a percentage, count, time saved, money or scale (e.g. "By roughly what percentage did you cut infrastructure costs? — e.g. ~15%"). Never put an invented figure on the CV yourself; only the candidate's real answer (folded in on the next pass) may add a number. For each gap set "expects" to "percent" when the ideal answer is a single percentage (a cost cut, a growth or improvement figure), otherwise "text". Give 2 to 5 questions, ordered by how much they'd help; skip anything already well answered. (These overlap with "issues" but are phrased as answerable questions for a follow-up pass.)

Return ONLY JSON of the form: { "cv": { …the CV object above… }, "issues": [ up to 5 issue objects ], "ats": { "keywords": 1-5, "impact": 1-5, "clarity": 1-5, "format": 1-5, "completeness": 1-5, "conciseness": 1-5 }, "gaps": [ up to 5 { "id": short slug, "question": the direct question to the candidate, "why": <= 12 words on what answering it improves, "expects": "percent" or "text" } ] }`

const LENGTH_RULE = `\n\nLENGTH — IMPORTANT: The result must fill close to a FULL A4 page. A one-page CV should carry roughly 300+ words of body content (not counting the name, headline and contact line). If the source material is thin, do NOT return a sparse half-page — instead elaborate PROFESSIONALLY and truthfully: expand each role's responsibilities into specific, credible bullets, draw out scope/scale/tools/impact that is implied by the material, and enrich the summary and skills. NEVER invent employers, job titles, dates, metrics or skills that aren't supported — but a confident, well-filled single page reads far better than a short one, so err toward fuller, richer phrasing grounded in what's there.`

const GENERATE_SYSTEM = `You are an elite technical résumé editor. You receive the raw text of a person's existing CV and you REBUILD it from scratch as JSON. Regenerate everything — do not copy verbatim; tighten, sharpen, and fix issues silently.\n\n${RULES}${LENGTH_RULE}`

const REFINE_SYSTEM = `You are an elite technical résumé editor. You are given the current CV as JSON plus an instruction from the candidate to change something. Apply it, preserve everything untouched, keep the EXACT same CV shape, keep obeying every rule, keep fixing problems silently, and re-evaluate the reported issues.\n\n${RULES}\n\nADDITIONALLY, include a "summary": ONE short past-tense sentence stating the concrete change you made to the CV (e.g. "Added your core stack — Java, Spring Boot, Kafka — to Skills and the Morgan Stanley role."). Re-score the "ats" object and refresh "gaps" to reflect the updated CV. Return { "cv": { …the CV object… }, "issues": [ up to 5 issue objects ], "ats": { …six 1-5 scores… }, "gaps": [ up to 5 question objects ], "summary": "…" }.`

function normalize(cv) {
  const arr = (x) => (Array.isArray(x) ? x : [])
  const str = (x) => (typeof x === 'string' ? x : '')
  const dated = (items) => arr(items).map((t) => ({ title: str(t.title), detail: str(t.detail), year: str(t.year) })).filter((t) => t.title)
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
    skills: arr(cv.skills).map((g) => ({ category: str(g.category), items: str(g.items) })).filter((g) => g.category && g.items),
    experience: arr(cv.experience).map((j) => ({
      role: str(j.role), company: str(j.company), location: str(j.location),
      startYear: str(j.startYear), endYear: str(j.endYear), bullets: arr(j.bullets).map(str).filter(Boolean),
    })).filter((j) => j.role || j.company),
    projects: arr(cv.projects).map((p) => ({ name: str(p.name), description: str(p.description) })).filter((p) => p.name),
    talks: dated(cv.talks),
    certifications: dated(cv.certifications),
    publications: dated(cv.publications),
    education: arr(cv.education).map((e) => ({ degree: str(e.degree), institution: str(e.institution), year: str(e.year) })).filter((e) => e.degree),
    languages: arr(cv.languages).map((l) => ({ name: str(l.name), level: str(l.level) })).filter((l) => l.name),
  }
}

// Problems the model can't fix on its own, shown to the candidate in a dialog
// before the CV itself. Most severe first, capped — a wall of nitpicks is noise.
const SEVERITIES = ['high', 'medium', 'low']
function normalizeIssues(raw) {
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
function clampAts(raw) {
  const out = {}
  for (const k of ATS_DIMENSIONS) {
    const n = Math.round(Number(raw && raw[k]))
    out[k] = Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 3
  }
  return out
}

// Follow-up questions only the candidate can answer, most helpful first.
function normalizeGaps(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((g, n) => ({
      id: String((g && g.id) || `gap${n}`).trim().slice(0, 40) || `gap${n}`,
      question: String((g && g.question) || '').trim().slice(0, 200),
      why: String((g && g.why) || '').trim().slice(0, 120),
      expects: String((g && g.expects) || '').toLowerCase() === 'percent' ? 'percent' : 'text',
    }))
    .filter((g) => g.question)
    .slice(0, GAP_CAP)
}

async function callOpenAI(system, user) {
  if (!OPENAI_API_KEY) {
    const e = new Error('OPENAI_API_KEY not configured')
    e.code = 500
    throw e
  }
  const ai = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  })
  if (!ai.ok) {
    const body = await ai.text()
    console.error('openai error', ai.status, body.slice(0, 300))
    const e = new Error(`AI service error (${ai.status})`)
    e.code = 502
    throw e
  }
  const data = await ai.json()
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
  try {
    const parsed = JSON.parse(content)
    // Tolerate the model returning { cv, issues } or just the CV object.
    const cvObj = parsed && parsed.cv && typeof parsed.cv === 'object' ? parsed.cv : parsed
    const summary = typeof (parsed && parsed.summary) === 'string' ? parsed.summary.trim() : ''
    return {
      cv: normalize(cvObj),
      issues: normalizeIssues(parsed && parsed.issues),
      ats: clampAts(parsed && parsed.ats),
      gaps: normalizeGaps(parsed && parsed.gaps),
      summary,
    }
  } catch {
    const e = new Error('AI returned malformed JSON')
    e.code = 502
    throw e
  }
}

function fail(res, e) {
  res.status(e && e.code ? e.code : 500).json({ error: String((e && e.message) || e) })
}

// POST { idToken, text } → { ok, cv, issues, polishLeft }. Fresh build; 2 per 24h.
http('cvGenerate', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, text } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user) return res.status(401).json({ error: 'sign in with Google first' })
    if (!text || String(text).trim().length < 60) return res.status(400).json({ error: 'CV text too short' })

    const ref = db.collection(USAGE).doc(user.sub)
    const now = Date.now()
    const d = (await ref.get()).data() || {}
    const recent = (Array.isArray(d.uploads) ? d.uploads : []).filter((t) => now - Number(t) < WINDOW_MS)
    if (user.email !== OWNER_EMAIL && recent.length >= UPLOAD_LIMIT) {
      return res.status(429).json({ error: `Limit reached — you can generate ${UPLOAD_LIMIT} CVs per 24 hours. Try again later.` })
    }

    const { cv, issues, ats, gaps } = await callOpenAI(GENERATE_SYSTEM, `Here is the raw CV text. Rebuild it as JSON per the rules:\n\n${String(text).slice(0, 30000)}`)
    // Record the successful upload and reset the tweak budgets for this new CV.
    await ref.set({ uploads: [...recent, now], polishCount: 0, elaborateCount: 0, shortenCount: 0, improveCount: 0, email: user.email, updatedAt: new Date() }, { merge: true })
    res.json({ ok: true, cv, issues, ats, gaps, polishLeft: POLISH_LIMIT, improveLeft: IMPROVE_LIMIT })
  } catch (e) {
    fail(res, e)
  }
})

// POST { idToken, cv, instruction|answers, kind } → { ok, cv, issues, ats, gaps, … }
// kind 'polish' (free tweak), 'elaborate' (fill out a thin CV), 'shorten', or
// 'improve' (fold the candidate's answers to the follow-up questions in to raise
// the ATS score). Every kind re-scores ats + refreshes gaps.
http('cvRefine', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, cv: current, instruction, kind, context, sourceText, answers } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user) return res.status(401).json({ error: 'sign in with Google first' })
    if (!current || typeof current !== 'object') return res.status(400).json({ error: 'missing CV' })

    const isElaborate = kind === 'elaborate'
    const isShorten = kind === 'shorten'
    const isImprove = kind === 'improve'
    // Improve is driven by the candidate's answers to the follow-up questions,
    // not a free-text instruction.
    const filledAnswers = (Array.isArray(answers) ? answers : [])
      .map((a) => ({ question: String((a && a.question) || '').trim().slice(0, 200), answer: String((a && a.answer) || '').trim().slice(0, 800) }))
      .filter((a) => a.question && a.answer)
    if (isImprove) {
      if (!filledAnswers.length) return res.status(400).json({ error: 'answer at least one question first' })
    } else if (!instruction || String(instruction).trim().length < 2) {
      return res.status(400).json({ error: 'missing instruction' })
    }

    const ref = db.collection(USAGE).doc(user.sub)
    const d = (await ref.get()).data() || {}
    let polishCount = Number(d.polishCount || 0)
    let elaborateCount = Number(d.elaborateCount || 0)
    let shortenCount = Number(d.shortenCount || 0)
    let improveCount = Number(d.improveCount || 0)
    const isOwner = user.email === OWNER_EMAIL
    if (!isOwner && isImprove && improveCount >= IMPROVE_LIMIT) {
      return res.status(429).json({ error: `You’ve used all ${IMPROVE_LIMIT} improve rounds for this CV.` })
    }
    if (!isOwner && isElaborate && elaborateCount >= ELABORATE_LIMIT) {
      return res.status(429).json({ error: `You’ve used all ${ELABORATE_LIMIT} “add more detail” rounds for this CV.` })
    }
    if (!isOwner && isShorten && shortenCount >= SHORTEN_LIMIT) {
      return res.status(429).json({ error: `You’ve used all ${SHORTEN_LIMIT} “make shorter” rounds for this CV.` })
    }
    if (!isOwner && !isElaborate && !isShorten && !isImprove && polishCount >= POLISH_LIMIT) {
      return res.status(429).json({ error: `You’ve used your ${POLISH_LIMIT === 1 ? 'one change' : `${POLISH_LIMIT} changes`} for this CV. Upload again to start fresh.` })
    }

    const lead = isImprove
        ? 'The candidate has ANSWERED your follow-up questions (below). Fold their answers into the CV to close the gaps and RAISE the ATS score — add the metrics, keywords, skills, target-role tuning or missing details they supplied, in the right places. Use ONLY what their answers and the existing CV support; never invent facts they did not give, and if an answer is blank leave that aspect as it was. Keep every rule'
        : isElaborate
        ? 'The CV currently fills LESS THAN ONE PAGE. Expand it to better fill a full page — WITHOUT inventing anything: restore useful detail from the original that the first pass trimmed, add specific, credible detail to experience bullets (responsibilities, scope, tools, measurable impact), enrich the summary, and round out the skills. Every addition must be grounded in the original CV or a reasonable, truthful elaboration of what is already there — never fabricate employers, dates, metrics or skills. Keep it signal-first, not padded with filler'
        : isShorten
          ? 'The candidate wants a SHORTER CV — follow the target in their instruction. Condense: cut the least-important detail, merge or trim the weakest bullets, tighten wording, and drop low-signal items, while KEEPING every strong achievement and all key roles. Do not remove whole positions unless clearly irrelevant, and never invent anything'
          : 'The candidate asks you to change something (a polish request)'
    // The previous change, so the candidate can react to it ("no, not like that, like this").
    const prev = typeof context === 'string' && context.trim()
      ? `\n\nYour most recent change to this CV was: "${String(context).slice(0, 400)}". The candidate may be reacting to it — if so, correct it accordingly.`
      : ''
    // The original extracted CV text, so a tweak can pull back anything the first pass missed.
    const src = typeof sourceText === 'string' && sourceText.trim()
      ? `\n\nFor reference, the ORIGINAL CV text the candidate uploaded (use it to recover any detail that may have been dropped, but keep obeying every rule):\n${String(sourceText).slice(0, 12000)}`
      : ''
    const task = isImprove
      ? `${lead}.\n\nThe candidate's answers to your follow-up questions:\n${filledAnswers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n').slice(0, 6000)}`
      : `${lead}:\n${String(instruction).slice(0, 1000)}`
    const { cv, issues, ats, gaps, summary } = await callOpenAI(
      REFINE_SYSTEM,
      `Current CV JSON:\n${JSON.stringify(normalize(current)).slice(0, 24000)}${prev}${src}\n\n${task}`,
    )
    if (isImprove) improveCount += 1
    else if (isElaborate) elaborateCount += 1
    else if (isShorten) shortenCount += 1
    else polishCount += 1
    await ref.update({ polishCount, elaborateCount, shortenCount, improveCount, updatedAt: new Date() })
    res.json({ ok: true, cv, issues, ats, gaps, summary, polishLeft: POLISH_LIMIT - polishCount, elaborateLeft: ELABORATE_LIMIT - elaborateCount, shortenLeft: SHORTEN_LIMIT - shortenCount, improveLeft: IMPROVE_LIMIT - improveCount })
  } catch (e) {
    fail(res, e)
  }
})
