// Loads the repo-root .env (gitignored) and exposes the OpenAI key.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const envFile = path.join(ROOT, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

export const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY || ''
if (!OPENAI_KEY) {
  console.error('No OPENAI_KEY in .env — evals need it.')
  process.exit(1)
}

// Production default (functions/cv.js). Override per-run with OPENAI_MODEL.
export const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
// The judge is deliberately a *different, stronger* model than the one being
// evaluated where possible — a model grading its own output is the exact bias
// we are trying to measure.
export const JUDGE_MODEL = process.env.JUDGE_MODEL || 'gpt-4o'
