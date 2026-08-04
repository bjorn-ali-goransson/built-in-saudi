// CV Generator backend — verifies a Google sign-in, rate-limits per user, and
// asks OpenAI to (re)build the CV as strict JSON following the signal-not-noise
// guidelines. Two flows: cvGenerate (fresh from an uploaded CV, 2 per 24h) and
// cvRefine (instruction-driven tweaks of the generated CV). Text-in, JSON-out;
// the browser renders + exports. Nothing is stored but the rate-limit counters —
// the server-saved CV ("save for later") and JD tailoring were removed (#213).
// No new deps. Registered via index.js.

import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'
// Prompt text lives in its own module so evals/ can exercise the real prompts.
import { ATS_DIMENSIONS, GENERATE_SYSTEM, REFINE_SYSTEM, SCORE_SYSTEM } from './cvPrompts.js'
import { cvToText } from './cvText.js'
import { normalize, normalizePatch, normalizeIssues, normalizeGaps, clampAts } from './cvShape.js'

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

async function openaiJSON(system, user, { temperature = 0.3 } = {}) {
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
      temperature,
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
    return JSON.parse(content)
  } catch {
    const e = new Error('AI returned malformed JSON')
    e.code = 502
    throw e
  }
}

async function callOpenAI(system, user, { patch = false } = {}) {
  const parsed = await openaiJSON(system, user)
  // Tolerate the model returning { cv, issues } or just the CV object.
  const cvObj = parsed && parsed.cv && typeof parsed.cv === 'object' ? parsed.cv : parsed
  const summary = typeof (parsed && parsed.summary) === 'string' ? parsed.summary.trim() : ''
  const base = {
    issues: normalizeIssues(parsed && parsed.issues),
    gaps: normalizeGaps(parsed && parsed.gaps),
    summary,
  }
  // Improve returns only the changed sections (a patch merged client-side);
  // every other pass returns the whole CV.
  return patch ? { patch: normalizePatch(cvObj), ...base } : { cv: normalize(cvObj), ...base }
}

// Grade ONE document, blind. The rewriter never scores — see cvPrompts.js. The
// same call grades the candidate's upload and our rebuild, so the two numbers
// are comparable and re-uploading our own output returns the score we gave it,
// instead of the ~1 point drop the old self-scoring pass produced.
// Temperature 0: a score should be a property of the document, not a sample.
async function scoreDocument(text) {
  if (!text || !String(text).trim()) return null
  try {
    return clampAts(await openaiJSON(SCORE_SYSTEM, `RESUME TEXT:\n\n${String(text).slice(0, 24000)}`, { temperature: 0 }))
  } catch (e) {
    // A scoring hiccup must never cost the candidate their rebuilt CV.
    console.error('ats scoring failed', e && e.message)
    return null
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

    const { cv, issues, gaps } = await callOpenAI(GENERATE_SYSTEM, `Here is the raw CV text. Rebuild it as JSON per the rules:\n\n${String(text).slice(0, 30000)}`)
    // Score the upload and the rebuild with the SAME blind scorer, in parallel.
    const [atsBefore, ats] = await Promise.all([scoreDocument(text), scoreDocument(cvToText(cv))])
    // Record the successful upload and reset the tweak budgets for this new CV.
    await ref.set({ uploads: [...recent, now], polishCount: 0, elaborateCount: 0, shortenCount: 0, improveCount: 0, email: user.email, updatedAt: new Date() }, { merge: true })
    res.json({ ok: true, cv, issues, ats, gaps, atsBefore, polishLeft: POLISH_LIMIT, improveLeft: IMPROVE_LIMIT })
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
      ? `${lead}.\n\nThe candidate's answers to your follow-up questions:\n${filledAnswers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n').slice(0, 6000)}\n\nRETURN ONLY CHANGED SECTIONS (this OVERRIDES the return shape above): under "cv" include ONLY the sections your edits actually change — for any array section you touch include the COMPLETE section (every item, ids preserved); include "summary" only if you rewrote it; OMIT every section you leave unchanged (the client keeps those, which saves tokens). Still return "ats", "gaps" and "summary".`
      : `${lead}:\n${String(instruction).slice(0, 1000)}`
    const { cv, patch, issues, gaps, summary } = await callOpenAI(
      REFINE_SYSTEM,
      `Current CV JSON:\n${JSON.stringify(normalize(current)).slice(0, 24000)}${prev}${src}\n\n${task}`,
      { patch: isImprove },
    )
    // Re-score the refined CV through the same blind scorer. An improve returns
    // only the sections it changed, so merge them over the current CV first —
    // otherwise we would be grading a fragment.
    const scored = isImprove ? { ...normalize(current), ...patch } : cv
    const ats = await scoreDocument(cvToText(scored))
    if (isImprove) improveCount += 1
    else if (isElaborate) elaborateCount += 1
    else if (isShorten) shortenCount += 1
    else polishCount += 1
    await ref.update({ polishCount, elaborateCount, shortenCount, improveCount, updatedAt: new Date() })
    // Improve returns a section-level `patch`; the other kinds return the whole `cv`.
    const shaped = isImprove ? { patch } : { cv }
    res.json({ ok: true, ...shaped, issues, ats, gaps, summary, polishLeft: POLISH_LIMIT - polishCount, elaborateLeft: ELABORATE_LIMIT - elaborateCount, shortenLeft: SHORTEN_LIMIT - shortenCount, improveLeft: IMPROVE_LIMIT - improveCount })
  } catch (e) {
    fail(res, e)
  }
})
