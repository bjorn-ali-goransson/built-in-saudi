// Loads the repo-root .env (gitignored) and exposes the OpenAI key.
//
// **The key check is NOT at module scope, and that is load-bearing.** This file
// also exports `ROOT`, a plain path constant, and the API-FREE guards import it
// for exactly that — `pdfguard`, `cvtextcheck` and `docxguard` are the three
// gates whose whole reason for existing is that they check the worst
// regressions this pipeline has ever had WITHOUT an API key. A
// `process.exit(1)` here ran at import time and killed all three, so on any
// machine with no `.env` the guards were not merely unavailable, they reported
// FAIL — the CV pipeline looking broken because the harness was.
//
// A key-needing harness fails fast anyway: `lib/openai.mjs` calls `requireKey()`
// when it loads, and it is imported by every harness that talks to the API.
// Put the demand next to the thing that needs it, not next to a path.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const envFile = path.join(ROOT, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

export const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY || ''

/** Call from anything that actually reaches the API. */
export function requireKey() {
  if (!OPENAI_KEY) {
    console.error('No OPENAI_KEY in .env — this eval calls the API and needs one.')
    console.error('The API-free gates (node evals/check.mjs) run without it.')
    process.exit(1)
  }
  return OPENAI_KEY
}

// Production default (functions/cv.js). Override per-run with OPENAI_MODEL.
export const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
// The judge is deliberately a *different, stronger* model than the one being
// evaluated where possible — a model grading its own output is the exact bias
// we are trying to measure.
export const JUDGE_MODEL = process.env.JUDGE_MODEL || 'gpt-4o'
