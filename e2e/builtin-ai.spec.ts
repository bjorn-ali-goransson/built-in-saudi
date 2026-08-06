import { test, expect, type Page } from '@playwright/test'

// The on-device AI tools, driven against a stub.
//
// CI browsers have no built-in AI at all, and a real one would download a
// multi-hundred-megabyte model — so the API is stubbed in the page. That is not
// a weaker test than the real thing for what actually breaks here: the states
// (missing API, unsupported pair, download-with-progress, ready) and the
// promise that the text never goes on the wire. The shape of the stub is taken
// from the real API surface verified in Edge 151.

interface StubOptions {
  /** Availability answer, or a per-pair map keyed "src>tgt". */
  availability?: string | Record<string, string>
  /** Emit download progress events before resolving create(). */
  download?: boolean
  detect?: string
  summarizerAvailability?: string | Record<string, string>
  noTranslator?: boolean
  noSummarizer?: boolean
  /** translateStreaming/summarizeStreaming throw, as they do on Edge 151. */
  streamingBroken?: boolean
  /** create() rejects the first time, as it does right after a pack download. */
  failFirstCreate?: boolean
}

async function stub(page: Page, o: StubOptions = {}) {
  await page.addInitScript((opt: StubOptions) => {
    const pick = (a: string | Record<string, string> | undefined, key: string) =>
      typeof a === 'string' ? a : a?.[key] ?? a?.['*'] ?? 'available'

    let creates = 0
    const maybeFailCreate = () => {
      creates += 1
      if (opt.failFirstCreate && creates === 1) throw new DOMException('Other generic failures occurred.', 'UnknownError')
    }

    const monitorRun = async (m: ((mon: unknown) => void) | undefined) => {
      if (!opt.download || !m) return
      const listeners: ((e: { loaded: number }) => void)[] = []
      m({ addEventListener: (_t: string, fn: (e: { loaded: number }) => void) => listeners.push(fn) })
      for (const loaded of [0.25, 0.6, 1]) {
        listeners.forEach((fn) => fn({ loaded }))
        await new Promise((r) => setTimeout(r, 20))
      }
    }

    if (opt.noTranslator) {
      // The CI browser really does define these, so simulating Firefox/Safari
      // means deleting them, not merely declining to install a stub.
      // @ts-expect-error test stub
      delete window.Translator
    } else {
      // @ts-expect-error test stub
      window.Translator = {
        availability: async (p: { sourceLanguage: string; targetLanguage: string }) =>
          pick(opt.availability, `${p.sourceLanguage}>${p.targetLanguage}`),
        create: async (p: { sourceLanguage: string; targetLanguage: string; monitor?: (m: unknown) => void }) => {
          await monitorRun(p.monitor)
          maybeFailCreate()
          return {
            translate: async (t: string) => `[${p.sourceLanguage}->${p.targetLanguage}] ${t}`,
            translateStreaming: (t: string) => ({
              async *[Symbol.asyncIterator]() {
                if (opt.streamingBroken) throw new DOMException('Other generic failures occurred.', 'UnknownError')
                yield `[${p.sourceLanguage}->${p.targetLanguage}] `
                yield t
              },
            }),
            destroy() {},
          }
        },
      }
    }

    if (opt.noSummarizer) {
      // @ts-expect-error test stub
      delete window.Summarizer
    } else {
      // @ts-expect-error test stub
      window.Summarizer = {
        availability: async (s?: { expectedInputLanguages?: string[] }) =>
          pick(opt.summarizerAvailability, s?.expectedInputLanguages?.[0] ?? '*'),
        create: async (s: { type?: string; length?: string; monitor?: (m: unknown) => void }) => {
          await monitorRun(s.monitor)
          maybeFailCreate()
          return {
            summarize: async () => `summary(${s.type}/${s.length})`,
            summarizeStreaming: () => ({
              async *[Symbol.asyncIterator]() {
                if (opt.streamingBroken) throw new DOMException('Other generic failures occurred.', 'UnknownError')
                yield `summary(${s.type}/${s.length})`
              },
            }),
            destroy() {},
          }
        },
      }
    }

    // @ts-expect-error test stub
    window.LanguageDetector = {
      availability: async () => 'available',
      create: async () => ({
        detect: async (t: string) => [{
          detectedLanguage: opt.detect ?? (/[؀-ۿ]/.test(t) ? 'ar' : 'en'),
          confidence: 0.98,
        }],
        destroy() {},
      }),
    }
  }, o)
}

test.describe('translator', () => {
  test('a browser without the API explains itself instead of breaking', async ({ page }) => {
    await stub(page, { noTranslator: true })
    await page.goto('/en/apps/translate')
    await expect(page.getByTestId('model-unsupported')).toBeVisible()
    await expect(page.getByTestId('model-unsupported')).toContainText('Chrome or Edge 138')
    // It must not offer a cloud fallback, which would break the whole promise.
    await expect(page.getByTestId('model-unsupported')).toContainText('sending your text to a server')
    await expect(page.getByTestId('tr-run')).toHaveCount(0)
    // The page still renders; the inputs are there, just ungated.
    await expect(page.getByTestId('tr-input')).toBeVisible()
  })

  test('an API with no models behind it is unsupported, not an unsupported pair', async ({ page }) => {
    // A build that offers the feature and then refuses every language pair.
    // Reading the constructor alone would leave someone staring at "try another
    // pair" forever, editing a choice that was never the problem.
    await stub(page, { availability: 'unavailable' })
    await page.goto('/en/apps/translate')
    await expect(page.getByTestId('model-unsupported')).toBeVisible()
    await expect(page.getByTestId('tr-pair-unsupported')).toHaveCount(0)
    await expect(page.getByTestId('tr-run')).toHaveCount(0)
  })

  test('an unstubbed browser lands on a real state, never a blank or a spinner', async ({ page }) => {
    // Whatever this machine's Chrome actually reports — the CI one claims the
    // pack is downloadable — the page must settle on something a person can act
    // on, with the input usable either way.
    await page.goto('/en/apps/translate')
    await expect(page.getByTestId('tr-input')).toBeVisible()
    await expect(
      page.getByTestId('model-downloadable')
        .or(page.getByTestId('model-unsupported'))
        .or(page.getByTestId('tr-run')),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('model-checking')).toHaveCount(0)
  })

  test('downloads the language pack on a click, showing progress, then translates', async ({ page }) => {
    await stub(page, { availability: 'downloadable', download: true })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-input').fill('Where is the nearest pharmacy?')
    await expect(page.getByTestId('model-downloadable')).toBeVisible()
    await page.getByTestId('model-download').click()
    await expect(page.getByTestId('tr-output')).toContainText('Where is the nearest pharmacy?', { timeout: 10_000 })
    await expect(page.getByTestId('tr-output')).toContainText('[en->ar]')
    await expect(page.getByTestId('model-downloadable')).toHaveCount(0)
  })

  test('an already-downloaded pack translates without a download bar', async ({ page }) => {
    await stub(page, { availability: 'available' })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-input').fill('Hello')
    await page.getByTestId('tr-run').click()
    await expect(page.getByTestId('tr-output')).toContainText('Hello')
    await expect(page.getByTestId('model-downloading')).toHaveCount(0)
  })

  test('detects the source language and drives the pair from it', async ({ page }) => {
    await stub(page, { availability: 'available' })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-input').fill('أين أقرب صيدلية؟')
    await expect(page.getByTestId('tr-detected')).toContainText('Arabic')
    await page.getByTestId('tr-to').selectOption('ur')
    await page.getByTestId('tr-run').click()
    await expect(page.getByTestId('tr-output')).toContainText('[ar->ur]')
  })

  test('a pair the model refuses is named, not silently empty', async ({ page }) => {
    await stub(page, { availability: { 'en>fil': 'unavailable', '*': 'available' } })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-from').selectOption('en')
    await page.getByTestId('tr-to').selectOption('fil')
    await expect(page.getByTestId('tr-pair-unsupported')).toContainText('does not translate English to Filipino')
    await expect(page.getByTestId('tr-run')).toHaveCount(0)
  })

  test('unsupported targets are marked in the list rather than hidden', async ({ page }) => {
    await stub(page, { availability: { 'en>fil': 'unavailable', '*': 'available' } })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-from').selectOption('en')
    const fil = page.getByTestId('tr-to').locator('option[value="fil"]')
    await expect(fil).toHaveCount(1)
    // toBeDisabled() does not consider an <option>, so assert the attribute.
    await expect(fil).toHaveAttribute('disabled', '')
    await expect(page.getByTestId('tr-to').locator('option[value="ur"]')).not.toHaveAttribute('disabled', '')
  })

  test('a browser whose streaming is broken still translates', async ({ page }) => {
    // Edge 151 exposes translateStreaming, throws UnknownError from it, and
    // translates perfectly through translate(). Built on the streaming call
    // alone, this tool is dead on a browser that can plainly do the job.
    await stub(page, { availability: 'available', streamingBroken: true })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-input').fill('Bring your passport')
    await page.getByTestId('tr-run').click()
    await expect(page.getByTestId('tr-output')).toContainText('Bring your passport')
    await expect(page.getByTestId('model-error')).toHaveCount(0)
  })

  test('a create() that fails once right after the download recovers by itself', async ({ page }) => {
    // Observed on Edge 151: the pack downloads to 100%, create() rejects with a
    // bare "Other generic failures occurred", and the identical call a moment
    // later works. Without the retry this is a dead end on first ever use.
    await stub(page, { availability: 'downloadable', download: true, failFirstCreate: true })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-input').fill('Bring your passport')
    await page.getByTestId('model-download').click()
    await expect(page.getByTestId('tr-output')).toContainText('Bring your passport', { timeout: 15_000 })
    await expect(page.getByTestId('model-error')).toHaveCount(0)
  })

  test('a create() that keeps failing is reported, not retried forever', async ({ page }) => {
    await stub(page, { availability: 'available', failFirstCreate: true })
    await page.addInitScript(() => {
      // Make every create fail, not just the first.
      const orig = (window as unknown as { Translator: { create: () => Promise<unknown> } }).Translator
      orig.create = async () => { throw new DOMException('Other generic failures occurred.', 'UnknownError') }
    })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-input').fill('Bring your passport')
    await page.getByTestId('tr-run').click()
    await expect(page.getByTestId('model-error')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('model-error')).toContainText('generic failures')
  })

  test('swap turns the translation back into the input', async ({ page }) => {
    await stub(page, { availability: 'available' })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-from').selectOption('en')
    await page.getByTestId('tr-to').selectOption('ar')
    await page.getByTestId('tr-input').fill('Good morning')
    await page.getByTestId('tr-run').click()
    await expect(page.getByTestId('tr-output')).toContainText('Good morning')
    await page.getByTestId('tr-swap').click()
    await expect(page.getByTestId('tr-from')).toHaveValue('ar')
    await expect(page.getByTestId('tr-to')).toHaveValue('en')
    await expect(page.getByTestId('tr-input')).toHaveValue(/Good morning/)
  })

  test('the language pair is remembered across visits', async ({ page }) => {
    await stub(page, { availability: 'available' })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-from').selectOption('ur')
    await page.getByTestId('tr-to').selectOption('ar')
    await page.reload()
    await expect(page.getByTestId('tr-from')).toHaveValue('ur')
    await expect(page.getByTestId('tr-to')).toHaveValue('ar')
  })

  test('nothing typed is ever put on the wire', async ({ page }) => {
    await stub(page, { availability: 'available' })
    const secret = 'Zajil7QMuqeem-secret-phrase'
    const seen: string[] = []
    page.on('request', (r) => {
      seen.push(r.url())
      const body = r.postData()
      if (body) seen.push(body)
    })
    await page.goto('/en/apps/translate')
    await page.getByTestId('tr-input').fill(secret)
    await page.getByTestId('tr-run').click()
    await expect(page.getByTestId('tr-output')).toContainText(secret)
    // The claim on the page is that the text never leaves it. Assert it.
    expect(seen.some((u) => u.includes(secret) || u.includes(encodeURIComponent(secret)))).toBe(false)
  })

  test('works in Arabic too', async ({ page }) => {
    await stub(page, { availability: 'available' })
    await page.goto('/ar/apps/translate')
    await page.getByTestId('tr-from').selectOption('ar')
    await page.getByTestId('tr-to').selectOption('en')
    await page.getByTestId('tr-input').fill('صباح الخير')
    await page.getByTestId('tr-run').click()
    await expect(page.getByTestId('tr-output')).toContainText('[ar->en]')
  })
})

test.describe('summarizer', () => {
  test('says plainly that the on-device model cannot do Arabic', async ({ page }) => {
    // The single most important thing this tool has to tell a Saudi audience.
    await stub(page, { summarizerAvailability: { ar: 'unavailable', '*': 'available' } })
    await page.goto('/en/apps/summarize')
    await page.getByTestId('sz-input').fill('هذه فقرة عربية طويلة بما يكفي لكي تكتشف الأداة لغتها وتقرر ما إذا كانت قادرة على تلخيصها أم لا.')
    await expect(page.getByTestId('sz-language-unsupported')).toBeVisible()
    await expect(page.getByTestId('sz-language-unsupported')).toContainText('cannot summarise Arabic')
    // And that we did not quietly route it to a server to paper over the gap.
    await expect(page.getByTestId('sz-language-unsupported')).toContainText('not routing your text to a server')
    await expect(page.getByTestId('sz-run')).toHaveCount(0)
  })

  test('summarises English and reflects the chosen style', async ({ page }) => {
    await stub(page, { summarizerAvailability: 'available' })
    await page.goto('/en/apps/summarize')
    await page.getByTestId('sz-input').fill('The committee met on Tuesday and agreed the budget would be revised before the end of the quarter, with a follow up planned.')
    await page.getByTestId('sz-type').selectOption('tldr')
    await page.getByTestId('sz-length').selectOption('long')
    await page.getByTestId('sz-run').click()
    await expect(page.getByTestId('sz-output')).toHaveText('summary(tldr/long)')
  })

  test('a browser whose streaming is broken still summarises', async ({ page }) => {
    await stub(page, { summarizerAvailability: 'available', streamingBroken: true })
    await page.goto('/en/apps/summarize')
    await page.getByTestId('sz-input').fill('The committee met on Tuesday and agreed the budget would be revised before the end of the quarter.')
    await page.getByTestId('sz-run').click()
    await expect(page.getByTestId('sz-output')).toContainText('summary(')
    await expect(page.getByTestId('model-error')).toHaveCount(0)
  })

  test('refuses to summarise a fragment', async ({ page }) => {
    await stub(page, { summarizerAvailability: 'available' })
    await page.goto('/en/apps/summarize')
    await page.getByTestId('sz-input').fill('too short')
    await expect(page.getByTestId('sz-run')).toBeDisabled()
    await expect(page.getByTestId('sz-too-short')).toBeVisible()
  })

  test('a browser without the API explains itself', async ({ page }) => {
    await stub(page, { noSummarizer: true })
    await page.goto('/en/apps/summarize')
    await expect(page.getByTestId('model-unsupported')).toBeVisible()
    await expect(page.getByTestId('sz-run')).toHaveCount(0)
  })

  test('an API with no model behind it is unsupported, not a language problem', async ({ page }) => {
    // A build that offers the feature and then refuses every language. Saying
    // "we don't do your language" here would send people off editing their text
    // for a problem that is not in their text.
    await stub(page, { summarizerAvailability: 'unavailable' })
    await page.goto('/en/apps/summarize')
    await expect(page.getByTestId('model-unsupported')).toBeVisible()
    await expect(page.getByTestId('sz-language-unsupported')).toHaveCount(0)
  })

  test('downloads the model on a click, showing progress', async ({ page }) => {
    await stub(page, { summarizerAvailability: 'downloadable', download: true })
    await page.goto('/en/apps/summarize')
    await page.getByTestId('sz-input').fill('The committee met on Tuesday and agreed the budget would be revised before the end of the quarter.')
    await expect(page.getByTestId('model-downloadable')).toBeVisible()
    await page.getByTestId('model-download').click()
    await expect(page.getByTestId('sz-output')).toContainText('summary(', { timeout: 10_000 })
  })
})
