// CV Generator backend — verifies a Google sign-in, rate-limits per user, and
// asks OpenAI to (re)build the CV as strict JSON following the signal-not-noise
// guidelines. Two flows: cvGenerate (fresh from an uploaded CV, 2 per 24h) and
// cvRefine (up to 3 instruction-driven tweaks of the generated CV). Text-in,
// JSON-out; the browser renders + exports. No new deps. Registered via index.js.

import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'

const { Firestore } = firestore
const db = new Firestore()
const USAGE = 'cvUsage'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const SITE = 'https://built-in-saudi.com'

const UPLOAD_LIMIT = 10 // fresh generations per rolling 24h per user (temporarily raised for testing; set back to 2 for launch)
const ANSWER_LIMIT = 5 // answers to the AI's own gap questions (quality-critical)
const POLISH_LIMIT = 3 // user-initiated free-form tweaks
const QUESTION_CAP = 5 // most questions the model may surface at once
const WINDOW_MS = 24 * 60 * 60 * 1000

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
- Education: degree, institution, year only. No scores.
- Keep it truthful — never invent employers, dates, or achievements not supported by the source.

FIX SILENTLY (do not ask, just correct):
- Spelling, grammar and typos.
- Tone: make it professional, confident and concise. Rewrite anything unprofessional, casual, arrogant or over-the-top (e.g. "rockstar ninja", "single-handedly saved the company") into credible, specific, results-focused language.
- Clarity: rewrite vague or confusing statements into clear ones where the meaning is reasonably inferable. Strip buzzword filler.

ASK (only for MATERIAL gaps you cannot responsibly fix yourself):
- Put up to 5 short, specific questions in "questions" when something important is missing or inconsistent and answering it would materially strengthen the CV. Only include a question if it is genuinely necessary for CV quality. Examples: a role/seniority with no supporting evidence (e.g. "Developer, 3 years" but no technologies, projects or achievements listed); conflicting or impossible dates; a large unexplained employment gap; a claimed skill never evidenced.
- Do NOT ask about trivial things, and never invent facts to fill a gap. Always still produce the best CV you can from what's given — questions are additive, never blocking. If nothing material is missing, return an empty array.

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

Return ONLY JSON of the form: { "cv": { …the CV object above… }, "questions": [ up to 5 short strings ] }`

const GENERATE_SYSTEM = `You are an elite technical résumé editor. You receive the raw text of a person's existing CV and you REBUILD it from scratch as JSON. Regenerate everything — do not copy verbatim; tighten, sharpen, and fix issues silently.\n\n${RULES}`

const REFINE_SYSTEM = `You are an elite technical résumé editor in a short back-and-forth with the candidate. You are given the current CV as JSON plus their message — which is EITHER an answer to one of your earlier questions OR an instruction to change something. Incorporate it: if it answers a gap, weave the new information in and drop that question; if it's an instruction, apply it. Preserve everything untouched, keep the EXACT same CV shape, keep obeying every rule, keep fixing issues silently, and re-evaluate remaining questions.\n\n${RULES}\n\nADDITIONALLY, include a "summary": ONE short past-tense sentence stating the concrete change you made to the CV (e.g. "Added your core stack — Java, Spring Boot, Kafka — to Skills and the Morgan Stanley role."). Return { "cv": { …the CV object… }, "questions": [ up to 5 strings ], "summary": "…" }.`

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
    // Tolerate the model returning { cv, questions } or just the CV object.
    const cvObj = parsed && parsed.cv && typeof parsed.cv === 'object' ? parsed.cv : parsed
    const questions = Array.isArray(parsed && parsed.questions)
      ? parsed.questions.map((q) => String(q).trim()).filter(Boolean).slice(0, QUESTION_CAP)
      : []
    const summary = typeof (parsed && parsed.summary) === 'string' ? parsed.summary.trim() : ''
    return { cv: normalize(cvObj), questions, summary }
  } catch {
    const e = new Error('AI returned malformed JSON')
    e.code = 502
    throw e
  }
}

function fail(res, e) {
  res.status(e && e.code ? e.code : 500).json({ error: String((e && e.message) || e) })
}

// POST { idToken, text } → { ok, cv, questions, answersLeft, polishLeft }. Fresh build; 2 per 24h.
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
    if (recent.length >= UPLOAD_LIMIT) {
      return res.status(429).json({ error: `Limit reached — you can generate ${UPLOAD_LIMIT} CVs per 24 hours. Try again later.` })
    }

    const { cv, questions } = await callOpenAI(GENERATE_SYSTEM, `Here is the raw CV text. Rebuild it as JSON per the rules:\n\n${String(text).slice(0, 30000)}`)
    // Record the successful upload and reset both budgets for this new CV.
    await ref.set({ uploads: [...recent, now], answerCount: 0, polishCount: 0, email: user.email, updatedAt: new Date() }, { merge: true })
    res.json({ ok: true, cv, questions, answersLeft: ANSWER_LIMIT, polishLeft: POLISH_LIMIT })
  } catch (e) {
    fail(res, e)
  }
})

// POST { idToken, cv, instruction, kind } → { ok, cv, questions, answersLeft, polishLeft }
// kind 'answer' (answering the AI's gap questions, up to 5) or 'polish' (free tweak, up to 3).
http('cvRefine', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, cv: current, instruction, kind } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user) return res.status(401).json({ error: 'sign in with Google first' })
    if (!current || typeof current !== 'object') return res.status(400).json({ error: 'missing CV' })
    if (!instruction || String(instruction).trim().length < 2) return res.status(400).json({ error: 'missing instruction' })

    const isAnswer = kind === 'answer'
    const ref = db.collection(USAGE).doc(user.sub)
    const d = (await ref.get()).data() || {}
    let answerCount = Number(d.answerCount || 0)
    let polishCount = Number(d.polishCount || 0)
    if (isAnswer && answerCount >= ANSWER_LIMIT) {
      return res.status(429).json({ error: `You’ve answered the maximum of ${ANSWER_LIMIT} questions for this CV.` })
    }
    if (!isAnswer && polishCount >= POLISH_LIMIT) {
      return res.status(429).json({ error: `You’ve used all ${POLISH_LIMIT} polish requests for this CV. Upload again to start fresh.` })
    }

    const lead = isAnswer
      ? 'The candidate is ANSWERING one or more of your questions'
      : 'The candidate asks you to change something (a polish request)'
    const { cv, questions, summary } = await callOpenAI(
      REFINE_SYSTEM,
      `Current CV JSON:\n${JSON.stringify(normalize(current)).slice(0, 30000)}\n\n${lead}:\n${String(instruction).slice(0, 1000)}`,
    )
    if (isAnswer) answerCount += 1
    else polishCount += 1
    await ref.update({ answerCount, polishCount, updatedAt: new Date() })
    res.json({ ok: true, cv, questions, summary, answersLeft: ANSWER_LIMIT - answerCount, polishLeft: POLISH_LIMIT - polishCount })
  } catch (e) {
    fail(res, e)
  }
})
