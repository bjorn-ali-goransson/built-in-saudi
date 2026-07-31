// Prompt Analyzer. One LLM call grades a system prompt on eight dimensions
// (1–5), lists concrete issues, and names the gaps only the author can fill; an
// optional rewrite takes the author's answers to those gaps and rewrites the
// prompt into a stronger version. The rewrite is a two-pass job — a draft, then
// a review-and-refine pass that catches a draft that came out weaker than the
// original before it's returned (#245). Google sign-in required; three analyses
// (and three rewrites) per rolling 24h per user. Same OpenAI + Firestore usage
// pattern as the CV tool.
import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'

const { Firestore } = firestore
const db = new Firestore()
const USAGE = 'promptUsage'
const SITE = 'https://built-in-saudi.com'
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const OWNER_EMAIL = 'bjorn.a.goransson@gmail.com'
const WINDOW_MS = 24 * 3600000
const ANALYZE_LIMIT = 3 // three analyses per rolling 24h per user
const IMPROVE_LIMIT = 3 // three rewrites per rolling 24h per user

export const DIMENSIONS = [
  'purpose_coherence', 'context_instruction_harmony', 'even_signal', 'calm_tone',
  'non_contradictory', 'positive_framing', 'escape_hatch', 'stakes_clarity',
]

const SYSTEM = `You are an expert reviewer of LLM system prompts. Language models both draw conclusions from the context you give them and follow your explicit instructions — and the two can clash. A strong prompt is a tonally and factually coherent explanation of the situation and its purpose, so the model can reason with you; a weak one bolts on unreconciled commands ("ALWAYS", "NEVER"), shouts, contradicts itself or the model's own baseline, piles up prohibitions, or corners the model with no graceful way out. Weak prompts produce rambling, circular, contradictory, error-prone output.

Assess the author's prompt (given as the user message) on these eight dimensions. Score each an integer 1 (poor) to 5 (excellent); higher is ALWAYS healthier:
- purpose_coherence: reads as one coherent, consistent explanation of the scenario and purpose.
- context_instruction_harmony: the instructions follow from and are reconciled with the described context, not bolted on.
- even_signal: signal intensity is consistent — not "spiky" (some points shouted, others whispered).
- calm_tone: it builds its case rather than shouting (avoids MUST, NEVER, ALL CAPS, "!!!").
- non_contradictory: free of internal contradictions; doesn't needlessly fight the model's or vendor's baseline policies.
- positive_framing: says what to do, affirmatively and with reasons, rather than a pile of "don't".
- escape_hatch: gives the model a graceful way out of tricky or conflicting situations.
- stakes_clarity: explains how the output will be used downstream, which sharpens focus.

Also identify the GAPS — the pieces of information that only the author can supply and that would most improve the prompt if filled in (e.g. the true purpose when it reads as vague, missing domain context, who the audience is, how the output is consumed downstream, hard constraints, the desired tone). Ask each as a direct question the author can answer in a sentence or two. Give 2 to 5 gaps, ordered by how much they'd help; skip anything the prompt already answers well.

Return ONLY JSON: {"scores": {<each dimension>: integer 1-5}, "issues": [{"headline": string, "description": string}], "gaps": [{"id": string, "question": string, "why": string}], "summary": string}. Provide 3 to 8 issues, each a short headline (<= 8 words) and a 1-2 sentence description that names the problem and how to fix it. For each gap: "id" is a short slug (e.g. "purpose"), "question" is the direct question to the author, "why" is <= 12 words on what filling it fixes. Quote short fragments of the author's prompt where it helps. "summary" is one sentence. Judge THIS prompt specifically; if it is very short or empty, score what you can and say so.`

const IMPROVE_SYSTEM = `You are an expert LLM prompt engineer. You are given an author's original system prompt and their answers to clarifying questions about its gaps. Rewrite the prompt into a stronger version that keeps the author's intent but applies the principles of a healthy prompt: one coherent explanation of the scenario and its purpose; instructions reconciled with that context rather than bolted on; even, calm signal (no shouting, no ALL CAPS, no piles of "NEVER"); affirmative framing with reasons; a graceful escape hatch for tricky cases; and clear downstream stakes. Fold the author's answers into the prose naturally — do not append them as a Q&A list. Do not invent facts the author did not give; if an answer was left blank, leave that aspect as the original had it rather than guessing. Keep it as concise as the material allows.

Return ONLY JSON: {"improved": string, "notes": string}. "improved" is the full rewritten prompt, ready to paste. "notes" is one sentence naming the biggest change you made.`

const REFINE_SYSTEM = `You are an expert LLM prompt engineer doing a second-pass review. You are given the author's ORIGINAL system prompt and a CANDIDATE rewrite of it. Review the candidate hard against the principles of a healthy prompt: one coherent explanation of the scenario and its purpose; instructions reconciled with that context rather than bolted on; even, calm signal (no shouting, no ALL CAPS, no piles of "NEVER"); affirmative framing with reasons; a graceful escape hatch; and clear downstream stakes. A rewrite has FAILED if it is weaker than the original on any of these, drops information the original carried, invents facts the author never gave, or drifts from the author's intent. Produce a FINAL version that is at least as strong as the original on every dimension and stronger overall — repair any regression in the candidate, restoring from the original where the candidate lost something; if the candidate is already solid, refine it only lightly. Never return something worse than the original.

Return ONLY JSON: {"improved": string, "notes": string}. "improved" is the full final prompt, ready to paste. "notes" is one sentence naming the biggest improvement over the original.`

function cors(req, res) {
  const origin = (req.headers && req.headers.origin) || ''
  const ok = /^https:\/\/([a-z0-9-]+\.)?built-in-saudi\.com$/.test(origin)
  res.set('Access-Control-Allow-Origin', ok ? origin : SITE)
  res.set('Vary', 'Origin')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}
async function verifyGoogle(idToken) {
  if (!idToken) return null
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
    if (!r.ok) return null
    const p = await r.json()
    if (p.aud !== CLIENT_ID) return null
    if (p.exp && Date.now() / 1000 > Number(p.exp)) return null
    return { sub: p.sub, email: p.email }
  } catch { return null }
}

function clampScores(raw) {
  const out = {}
  for (const k of DIMENSIONS) { const n = Math.round(Number(raw && raw[k])); out[k] = Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 3 }
  return out
}

// Rolling-window rate limit against one field of the usage doc. The owner
// bypasses (ref null). Returns { over } when the limit is hit, else the ref +
// the pruned recent-run list + now so the caller can record its own run.
async function meter(user, field, limit) {
  if (user.email === OWNER_EMAIL) return { ref: null, recent: [], now: Date.now() }
  const ref = db.collection(USAGE).doc(user.sub)
  const now = Date.now()
  const d = (await ref.get()).data() || {}
  const recent = (Array.isArray(d[field]) ? d[field] : []).filter((t) => now - Number(t) < WINDOW_MS)
  if (recent.length >= limit) {
    const wait = Math.ceil((Number(recent[0]) + WINDOW_MS - now) / 3600000)
    return { over: `Three per 24 hours — try again in about ${wait} hour${wait === 1 ? '' : 's'}.` }
  }
  return { ref, recent, now }
}

// `soft`: when true, a failure returns null WITHOUT writing an error to res, so
// the caller can fall back (used by the optional refine pass).
async function callOpenAI(system, user, res, soft) {
  const ai = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL, temperature: 0.2, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  })
  if (!ai.ok) { const b = await ai.text(); console.error('openai', ai.status, b.slice(0, 300)); if (!soft) res.status(502).json({ error: `AI service error (${ai.status})` }); return null }
  const data = await ai.json()
  try { return JSON.parse(data.choices[0].message.content) } catch { if (!soft) res.status(502).json({ error: 'AI returned malformed JSON' }); return null }
}

// POST { idToken, prompt } → { ok, scores, issues, gaps, summary }
http('analyzePrompt', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, prompt } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user) return res.status(401).json({ error: 'sign in with Google first' })
    const text = String(prompt || '').trim()
    // A longer prompt is recommended (the client says so), but not required — a
    // short prompt is scored for what it is (#246). Only truly empty is rejected.
    if (!text) return res.status(400).json({ error: 'Paste a prompt to analyse.' })
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'analysis not configured' })

    const m = await meter(user, 'runs', ANALYZE_LIMIT)
    if (m.over) return res.status(429).json({ error: m.over })

    const parsed = await callOpenAI(SYSTEM, text.slice(0, 24000), res)
    if (!parsed) return

    const scores = clampScores(parsed.scores)
    const issues = (Array.isArray(parsed.issues) ? parsed.issues : []).slice(0, 8).map((i) => ({
      headline: String((i && i.headline) || '').slice(0, 80), description: String((i && i.description) || '').slice(0, 400),
    })).filter((i) => i.headline)
    const gaps = (Array.isArray(parsed.gaps) ? parsed.gaps : []).slice(0, 5).map((g, n) => ({
      id: String((g && g.id) || `gap${n}`).slice(0, 40), question: String((g && g.question) || '').slice(0, 200), why: String((g && g.why) || '').slice(0, 120),
    })).filter((g) => g.question)
    const summary = String(parsed.summary || '').slice(0, 300)

    if (m.ref) await m.ref.set({ runs: [...m.recent, m.now], email: user.email, updatedAt: new Date() }, { merge: true })
    res.json({ ok: true, scores, issues, gaps, summary })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})

// POST { idToken, prompt, answers:[{question,answer}] } → { ok, improved, notes }
http('improvePrompt', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, prompt, answers } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user) return res.status(401).json({ error: 'sign in with Google first' })
    const text = String(prompt || '').trim()
    if (!text) return res.status(400).json({ error: 'Paste a prompt first.' })
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'rewrite not configured' })

    const m = await meter(user, 'improveRuns', IMPROVE_LIMIT)
    if (m.over) return res.status(429).json({ error: m.over })

    const filled = (Array.isArray(answers) ? answers : [])
      .map((a) => ({ question: String((a && a.question) || '').slice(0, 200), answer: String((a && a.answer) || '').trim().slice(0, 800) }))
      .filter((a) => a.question && a.answer)
    const clarifications = filled.length
      ? filled.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')
      : '(The author did not answer any of the clarifying questions.)'
    const userMsg = `ORIGINAL PROMPT:\n${text.slice(0, 20000)}\n\nAUTHOR'S ANSWERS TO THE GAPS:\n${clarifications.slice(0, 6000)}`

    // Pass 1: rewrite the prompt from the answers.
    const parsed = await callOpenAI(IMPROVE_SYSTEM, userMsg, res)
    if (!parsed) return
    const draft = String(parsed.improved || '').slice(0, 24000)
    if (!draft) return res.status(502).json({ error: 'AI returned an empty rewrite' })

    // Pass 2: review the draft against the original and refine it. A single rewrite
    // sometimes scores worse than the original; this catches and repairs that
    // before returning (#245). If the review pass fails, fall back to the draft.
    const refineMsg = `ORIGINAL PROMPT:\n${text.slice(0, 20000)}\n\nCANDIDATE REWRITE:\n${draft.slice(0, 20000)}\n\nAUTHOR'S ANSWERS TO THE GAPS:\n${clarifications.slice(0, 6000)}`
    const refined = await callOpenAI(REFINE_SYSTEM, refineMsg, res, draft)
    const improved = String((refined && refined.improved) || draft).slice(0, 24000)
    const notes = String((refined && refined.notes) || parsed.notes || '').slice(0, 300)

    if (m.ref) await m.ref.set({ improveRuns: [...m.recent, m.now], email: user.email, updatedAt: new Date() }, { merge: true })
    res.json({ ok: true, improved, notes })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})
