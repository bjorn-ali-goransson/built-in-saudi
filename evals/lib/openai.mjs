// Minimal OpenAI chat client for the evals — mirrors functions/cv.js's call
// (json_object response format, same temperature) plus retries and a running
// token/cost tally so a sweep can't quietly burn the budget.
import { OPENAI_KEY } from './env.mjs'

export const usage = { calls: 0, in: 0, out: 0 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function chatJSON(system, user, { model, temperature = 0.3, retries = 4, maxTokens } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const body = {
        model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }
      if (maxTokens) body.max_tokens = maxTokens
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const text = await r.text()
        // 429/5xx are worth retrying; a 400 is our bug and never will be.
        if (r.status === 400 || r.status === 401) throw new Error(`OpenAI ${r.status}: ${text.slice(0, 400)}`)
        throw Object.assign(new Error(`OpenAI ${r.status}: ${text.slice(0, 200)}`), { retryable: true })
      }
      const data = await r.json()
      usage.calls++
      usage.in += data.usage?.prompt_tokens || 0
      usage.out += data.usage?.completion_tokens || 0
      const content = data.choices?.[0]?.message?.content || ''
      const finish = data.choices?.[0]?.finish_reason
      if (finish === 'length') throw Object.assign(new Error('truncated response (hit max tokens)'), { retryable: true })
      return JSON.parse(content)
    } catch (e) {
      lastErr = e
      if (!e.retryable && !(e instanceof SyntaxError)) throw e
      if (attempt === retries) break
      await sleep(1000 * 2 ** attempt)
    }
  }
  throw lastErr
}

/** Run tasks with bounded concurrency (OpenAI rate limits, and the harness is
 *  chatty — one CV fans out into a generate plus several judge samples). */
export async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const n = i++
      out[n] = await fn(items[n], n)
    }
  })
  await Promise.all(workers)
  return out
}
