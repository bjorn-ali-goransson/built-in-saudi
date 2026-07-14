// Arabic diacritization (التشكيل). One LLM call fully vowelises pasted Arabic
// text and returns it. Google sign-in required; one run per rolling 24h per user.
// Same OpenAI + Firestore usage pattern as the Prompt Analyzer.
import { http } from '@google-cloud/functions-framework'
import firestore from '@google-cloud/firestore'

const { Firestore } = firestore
const db = new Firestore()
const USAGE = 'diacritizeUsage'
const SITE = 'https://built-in-saudi.com'
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const OWNER_EMAIL = 'bjorn.a.goransson@gmail.com'
const WINDOW_MS = 24 * 3600000
const LIMIT = 1 // one diacritization per rolling 24h per user
const MAX_CHARS = 5000

const SYSTEM = `You are an expert in Arabic orthography and grammar (نحو وصرف). Add full, correct diacritics (تشكيل كامل) to the Arabic text the user provides, including case endings (الإعراب) and sukūn where appropriate.

Rules:
- Return ONLY the diacritized text — no explanation, no translation, no quotes, no markdown.
- Preserve the ORIGINAL text exactly: same words, same order, same line breaks, same punctuation and any non-Arabic characters. Only ADD harakāt; never add, drop, reorder or "correct" words.
- Vowel every Arabic letter that takes a harakah, and apply the grammatically correct إعراب for the sentence structure.
- Leave non-Arabic spans (numbers, Latin text, emoji, URLs) untouched.`

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

// POST { idToken, text } → { ok, text }
http('diacritize', async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).send('POST only')
  try {
    const { idToken, text } = req.body || {}
    const user = await verifyGoogle(idToken)
    if (!user) return res.status(401).json({ error: 'sign in with Google first' })
    const input = String(text || '').trim()
    if (!input) return res.status(400).json({ error: 'Paste some Arabic text.' })
    if (!/[ء-ي]/.test(input)) return res.status(400).json({ error: 'This text has no Arabic letters.' })
    if (input.length > MAX_CHARS) return res.status(400).json({ error: `Text is too long (max ${MAX_CHARS} characters).` })
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'diacritization not configured' })

    const ref = db.collection(USAGE).doc(user.sub)
    const now = Date.now()
    const d = (await ref.get()).data() || {}
    const recent = (Array.isArray(d.runs) ? d.runs : []).filter((t) => now - Number(t) < WINDOW_MS)
    if (user.email !== OWNER_EMAIL && recent.length >= LIMIT) {
      const wait = Math.ceil((Number(recent[0]) + WINDOW_MS - now) / 3600000)
      return res.status(429).json({ error: `One diacritization per 24 hours — try again in about ${wait} hour${wait === 1 ? '' : 's'}.` })
    }

    const ai = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL, temperature: 0,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: input }],
      }),
    })
    if (!ai.ok) { const b = await ai.text(); console.error('openai', ai.status, b.slice(0, 300)); return res.status(502).json({ error: `AI service error (${ai.status})` }) }
    const data = await ai.json()
    const out = String((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '').trim()
    if (!out) return res.status(502).json({ error: 'AI returned nothing' })

    await ref.set({ runs: [...recent, now], email: user.email, updatedAt: new Date() }, { merge: true })
    res.json({ ok: true, text: out })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
})
