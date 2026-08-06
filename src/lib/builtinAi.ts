// Chrome's built-in AI: models that run ON the device, exposed as web APIs.
//
// This is the first thing on the site that does language work without a server,
// and it is the only reason we can offer translation and summarising at all —
// every alternative would mean posting the user's text to someone's API, which
// is exactly what the rest of the toolbox exists not to do.
//
// Three things about it shape every tool that uses it:
//
// 1. **It is not everywhere.** Chrome/Edge 138+ on a desktop OS. Firefox and
//    Safari have nothing. So a tool must degrade to a clear explanation, never
//    to a broken page and never to a cloud fallback that quietly breaks the
//    promise.
// 2. **The model is downloaded on first use**, on a user gesture, and it is
//    large. That download goes to Google's servers — it carries none of the
//    user's text, but it IS a third-party request and we say so.
// 3. **Support is per language, and asking is the only way to know.** Verified
//    on Edge 151 in August 2026: Translator does Arabic with 54 other languages
//    (including Urdu, Hindi, Bengali, Malayalam, Tamil, Nepali, Sinhala,
//    Amharic, Tigrinya, Somali, Pashto and Farsi — most of the languages spoken
//    at work in this country) but NOT Filipino; Summarizer does not do Arabic at
//    all. Hard-coding either list would be wrong within a release, so the tools
//    ask the browser and render what it answers.

/** What the browser says about a specific model + language combination. */
export type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

/** Adds the reason a tool cannot run at all, which `Availability` cannot express. */
export type ModelState = Availability | 'unsupported' | 'checking' | 'error'

/**
 * The object handed to `monitor`. Deliberately NOT declared as an EventTarget:
 * the real one is, but narrowing `addEventListener` to the single event we care
 * about is incompatible with the DOM signature, and the wider type buys nothing
 * here — we only ever attach one listener.
 */
interface Monitor {
  addEventListener(type: 'downloadprogress', listener: (e: { loaded: number }) => void): void
}

interface CreateBase { monitor?: (m: Monitor) => void; signal?: AbortSignal }

export interface TranslatorPair { sourceLanguage: string; targetLanguage: string }

export interface TranslatorInstance {
  translate(text: string, options?: { signal?: AbortSignal }): Promise<string>
  translateStreaming(text: string, options?: { signal?: AbortSignal }): AsyncIterable<string>
  destroy?(): void
}

export interface DetectorInstance {
  detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>
  destroy?(): void
}

export type SummaryType = 'key-points' | 'tldr' | 'teaser' | 'headline'
export type SummaryFormat = 'markdown' | 'plain-text'
export type SummaryLength = 'short' | 'medium' | 'long'

export interface SummarizerOptions {
  type?: SummaryType
  format?: SummaryFormat
  length?: SummaryLength
  sharedContext?: string
  expectedInputLanguages?: string[]
  outputLanguage?: string
}

export interface SummarizerInstance {
  summarize(text: string, options?: { context?: string; signal?: AbortSignal }): Promise<string>
  summarizeStreaming(text: string, options?: { context?: string; signal?: AbortSignal }): AsyncIterable<string>
  destroy?(): void
}

interface TranslatorApi {
  availability(pair: TranslatorPair): Promise<Availability>
  create(options: TranslatorPair & CreateBase): Promise<TranslatorInstance>
}
interface DetectorApi {
  availability(): Promise<Availability>
  create(options?: CreateBase): Promise<DetectorInstance>
}
interface SummarizerApi {
  availability(options?: SummarizerOptions): Promise<Availability>
  create(options: SummarizerOptions & CreateBase): Promise<SummarizerInstance>
}

declare global {
  // eslint-disable-next-line no-var
  var Translator: TranslatorApi | undefined
  // eslint-disable-next-line no-var
  var LanguageDetector: DetectorApi | undefined
  // eslint-disable-next-line no-var
  var Summarizer: SummarizerApi | undefined
}

/**
 * Capability queries are supposed to be instant — they read local state. Some
 * builds answer some language pairs by never answering at all, and an awaited
 * promise that never settles leaves the page on "checking…" for good. A browser
 * that will not say whether it can do something cannot do it.
 */
const ANSWER_MS = 4000

function withTimeout<T>(p: Promise<T>, fallback: T, ms = ANSWER_MS): Promise<T> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (v: T) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v) } }
    const timer = setTimeout(() => finish(fallback), ms)
    p.then(finish, () => finish(fallback))
  })
}

export const hasTranslator = () => typeof globalThis.Translator !== 'undefined'
export const hasDetector = () => typeof globalThis.LanguageDetector !== 'undefined'
export const hasSummarizer = () => typeof globalThis.Summarizer !== 'undefined'

/**
 * Ask the browser about one language pair.
 *
 * Anything unexpected — an old surface, a thrown TypeError on a bad code — is
 * reported as `unavailable` rather than propagated: to the user it means the
 * same thing, and a rejected promise here would take the whole page down.
 */
export async function translatorAvailability(pair: TranslatorPair): Promise<ModelState> {
  if (!hasTranslator()) return 'unsupported'
  return withTimeout(globalThis.Translator!.availability(pair), 'unavailable' as ModelState)
}

export async function summarizerAvailability(options?: SummarizerOptions): Promise<ModelState> {
  if (!hasSummarizer()) return 'unsupported'
  return withTimeout(globalThis.Summarizer!.availability(options), 'unavailable' as ModelState)
}

/** Which of `targets` this browser can actually translate `source` into. */
export async function supportedTargets(source: string, targets: string[]): Promise<Set<string>> {
  if (!hasTranslator()) return new Set()
  const out = new Set<string>()
  await Promise.all(targets.map(async (t) => {
    if (t === source) return
    const a = await translatorAvailability({ sourceLanguage: source, targetLanguage: t })
    if (a !== 'unavailable' && a !== 'unsupported') out.add(t)
  }))
  return out
}

export interface DownloadHandlers {
  /** 0–1. Fires only when a download actually happens. */
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

const monitorFor = (h?: DownloadHandlers) => (m: Monitor) => {
  m.addEventListener('downloadprogress', (e) => h?.onProgress?.(e.loaded))
}

/**
 * Create a translator, downloading the language pack if needed.
 *
 * MUST be called from a user gesture — the API requires user activation for the
 * download, and a tool that calls this from an effect will fail on first use and
 * work on second, which is the most confusing possible bug to report.
 */
export function createTranslator(pair: TranslatorPair, h?: DownloadHandlers): Promise<TranslatorInstance> {
  if (!hasTranslator()) return Promise.reject(new Error('unsupported'))
  return globalThis.Translator!.create({ ...pair, monitor: monitorFor(h), signal: h?.signal })
}

export function createSummarizer(options: SummarizerOptions, h?: DownloadHandlers): Promise<SummarizerInstance> {
  if (!hasSummarizer()) return Promise.reject(new Error('unsupported'))
  return globalThis.Summarizer!.create({ ...options, monitor: monitorFor(h), signal: h?.signal })
}

/**
 * Stream if streaming works, otherwise get the whole answer at once.
 *
 * Not defensive programming for its own sake: `translateStreaming` is present
 * and throws `UnknownError: Other generic failures occurred` on Edge 151, on
 * the exact same translator whose `translate()` returns a perfect answer. A
 * tool built on the streaming call alone is broken on a browser that can
 * clearly do the job, and the failure message tells the user nothing.
 *
 * `onChunk` receives the text so far, not the delta, so a mid-stream failure
 * can be recovered by simply replacing it with the batch result.
 */
export async function streamOrBatch(
  stream: () => AsyncIterable<string>,
  batch: () => Promise<string>,
  onChunk: (soFar: string) => void,
): Promise<string> {
  try {
    let acc = ''
    for await (const chunk of stream()) { acc += chunk; onChunk(acc) }
    if (acc) return acc
  } catch { /* fall through to the batch call */ }
  const whole = await batch()
  onChunk(whole)
  return whole
}

let detector: Promise<DetectorInstance> | null = null

/**
 * Detect the language of `text`, or null if the browser cannot or will not.
 *
 * The detector is a singleton: it is cheap, already `available` without a
 * download on every browser that has it, and recreating one per keystroke is
 * wasteful.
 */
export async function detectLanguage(text: string): Promise<{ language: string; confidence: number } | null> {
  if (!hasDetector() || !text.trim()) return null
  try {
    detector ??= globalThis.LanguageDetector!.create()
    const instance = await withTimeout(detector, null)
    if (!instance) { detector = null; return null }
    const results = await withTimeout(instance.detect(text), null)
    const best = results?.[0]
    return best ? { language: best.detectedLanguage, confidence: best.confidence } : null
  } catch {
    detector = null
    return null
  }
}
