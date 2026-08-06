import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Select, Textarea, Stack, Panel, Field, ModelGate } from '../../components/ui'
import { CopyIcon } from '../../components/icons'
import {
  createSummarizer, detectLanguage, hasSummarizer, streamOrBatch, summarizerAvailability,
  type ModelState, type SummarizerInstance, type SummaryFormat, type SummaryLength, type SummaryType,
} from '../../lib/builtinAi'

// The summariser's language support is much narrower than the translator's, and
// — verified on Edge 151, August 2026 — **it does not include Arabic**, as input
// or as output. On a bilingual Saudi site that is the single most important
// thing this tool has to say. It detects the input language and refuses clearly,
// because the alternative is a model given Arabic and asked for English, which
// produces something confident and wrong.

const SUPPORTED = ['en', 'es', 'ja', 'de', 'fr']

const STR = {
  en: {
    input: 'Text to summarise', placeholder: 'Paste an article, a thread, a long email, meeting notes…',
    type: 'Style', length: 'Length', format: 'Format',
    types: { 'key-points': 'Key points', tldr: 'TL;DR', teaser: 'Teaser', headline: 'Headline' } as Record<SummaryType, string>,
    lengths: { short: 'Short', medium: 'Medium', long: 'Long' } as Record<SummaryLength, string>,
    formats: { markdown: 'Markdown', 'plain-text': 'Plain text' } as Record<SummaryFormat, string>,
    context: 'Context (optional)', contextHint: 'What is this and who is it for? One line helps a lot.',
    run: 'Summarise', working: 'Summarising…',
    output: 'Summary', copy: 'Copy', copied: 'Copied!',
    words: (a: number, b: number) => `${a.toLocaleString('en')} words in, ${b.toLocaleString('en')} out`,
    tooShort: 'Give it a few sentences — there is nothing to summarise yet.',
    noArabic:
      'The on-device model cannot summarise Arabic. It handles English, Spanish, Japanese, German and French, and nothing else yet.',
    noArabicWhy:
      'This is a limit of the model built into your browser, not a choice we made. We are not routing your text to a server to work around it — that would undo the only reason this tool is worth using. The translator app does support Arabic, if translating is what you need.',
    detected: (n: string) => `Detected language: ${n}`,
    langNames: { en: 'English', es: 'Spanish', ja: 'Japanese', de: 'German', fr: 'French', ar: 'Arabic' } as Record<string, string>,
    privacy: 'The text never leaves this page — the model runs on your device. It also means this works offline once the model is downloaded.',
    quality: 'A small model summarising is a small model guessing what mattered. Read the summary as a pointer to the original, not a replacement for it, and never as the basis for a decision you cannot undo.',
  },
  ar: {
    input: 'النص المراد تلخيصه', placeholder: 'الصق مقالًا أو سلسلة تغريدات أو بريدًا طويلًا أو محضر اجتماع…',
    type: 'الأسلوب', length: 'الطول', format: 'الصيغة',
    types: { 'key-points': 'النقاط الرئيسية', tldr: 'باختصار', teaser: 'تشويق', headline: 'عنوان' } as Record<SummaryType, string>,
    lengths: { short: 'قصير', medium: 'متوسط', long: 'طويل' } as Record<SummaryLength, string>,
    formats: { markdown: 'ماركداون', 'plain-text': 'نص عادي' } as Record<SummaryFormat, string>,
    context: 'سياق (اختياري)', contextHint: 'ما هذا النص ولمن؟ سطر واحد يفيد كثيرًا.',
    run: 'لخّص', working: 'جارٍ التلخيص…',
    output: 'الملخّص', copy: 'نسخ', copied: 'تم النسخ!',
    words: (a: number, b: number) => `${a.toLocaleString('ar')} كلمة دخلت، و${b.toLocaleString('ar')} خرجت`,
    tooShort: 'أعطه بضع جمل — لا يوجد ما يُلخَّص بعد.',
    noArabic:
      'النموذج الذي يعمل على جهازك لا يلخّص العربية. فهو يتعامل مع الإنجليزية والإسبانية واليابانية والألمانية والفرنسية، ولا شيء غيرها حتى الآن.',
    noArabicWhy:
      'هذا قيد في النموذج المدمج في متصفحك، لا اختيار منّا. ولن نمرّر نصك إلى خادم للالتفاف عليه — فذلك يُبطل السبب الوحيد الذي يجعل هذه الأداة تستحق الاستخدام. أما تطبيق الترجمة فيدعم العربية، إن كانت الترجمة هي مرادك.',
    detected: (n: string) => `اللغة المكتشفة: ${n}`,
    langNames: { en: 'الإنجليزية', es: 'الإسبانية', ja: 'اليابانية', de: 'الألمانية', fr: 'الفرنسية', ar: 'العربية' } as Record<string, string>,
    privacy: 'لا يغادر النص هذه الصفحة — فالنموذج يعمل على جهازك. ولهذا تعمل الأداة أيضًا دون اتصال بعد تنزيل النموذج.',
    quality: 'النموذج الصغير حين يلخّص إنما يخمّن ما كان مهمًّا. فاقرأ الملخّص دليلًا إلى الأصل لا بديلًا عنه، ولا تبنِ عليه قرارًا لا يمكن التراجع عنه.',
  },
}

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

export default function SummarizeTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [text, setText] = useState('')
  const [context, setContext] = useState('')
  const [type, setType] = useState<SummaryType>('key-points')
  const [length, setLength] = useState<SummaryLength>('short')
  const [format, setFormat] = useState<SummaryFormat>('plain-text')
  const [output, setOutput] = useState('')
  const [state, setState] = useState<ModelState>('checking')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [lang, setLang] = useState<string | null>(null)

  const ref = useRef<SummarizerInstance | null>(null)
  const madeFor = useRef('')
  const optionKey = `${type}|${length}|${format}`

  useEffect(() => {
    if (text.trim().length < 12) { setLang(null); return }
    let live = true
    const id = setTimeout(async () => {
      const d = await detectLanguage(text)
      if (live) setLang(d?.language ?? null)
    }, 400)
    return () => { live = false; clearTimeout(id) }
  }, [text])

  const unsupportedLang = lang != null && !SUPPORTED.includes(lang)

  const check = useCallback(async () => {
    if (!hasSummarizer()) { setState('unsupported'); return }
    // Ask with no language first. A browser that exposes the API but has no
    // model — Playwright's Chromium, some Linux builds — refuses even this, and
    // that is a different problem from "we don't do your language". Reporting
    // the second when it is the first sends people off editing their text.
    if (await summarizerAvailability() === 'unavailable') { setState('unsupported'); return }
    if (unsupportedLang) { setState('unavailable'); return }
    setState(await summarizerAvailability({ expectedInputLanguages: lang ? [lang] : undefined }))
  }, [lang, unsupportedLang])

  useEffect(() => { void check() }, [check])

  useEffect(() => {
    if (madeFor.current && madeFor.current !== optionKey) {
      ref.current?.destroy?.()
      ref.current = null
      madeFor.current = ''
    }
  }, [optionKey])

  useEffect(() => () => ref.current?.destroy?.(), [])

  async function run() {
    if (words(text) < 10) return
    setBusy(true)
    setError('')
    try {
      let inst = ref.current
      if (!inst || madeFor.current !== optionKey) {
        setProgress(0)
        const make = () => createSummarizer(
          { type, length, format, expectedInputLanguages: lang ? [lang] : undefined, sharedContext: context || undefined },
          { onProgress: (f) => { setState('downloading'); setProgress(f) } },
        )
        // One retry, for the same reason as the translator: the first create()
        // for a model that has to be fetched can reject right after the
        // download finishes, and the very next identical call succeeds.
        inst = await make().catch(async () => {
          await new Promise((r) => setTimeout(r, 1500))
          return make()
        })
        ref.current = inst
        madeFor.current = optionKey
        setState('available')
      }
      setOutput('')
      const opts = context ? { context } : undefined
      await streamOrBatch(
        () => inst.summarizeStreaming(text, opts),
        () => inst.summarize(text, opts),
        setOutput,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setState('error')
    } finally { setBusy(false) }
  }

  async function copy() {
    if (!output) return
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const langLabel = (code: string) => s.langNames[code] ?? code

  return (
    <Stack data-testid="summarize">
      <Field label={s.input}>
        <Textarea rows={10} value={text} placeholder={s.placeholder} data-testid="sz-input"
          dir="auto" onChange={(e) => setText(e.target.value)} />
      </Field>

      {lang && (
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="sz-detected">{s.detected(langLabel(lang))}</p>
      )}

      <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
        <Field label={s.type}>
          <Select value={type} data-testid="sz-type" onChange={(e) => setType(e.target.value as SummaryType)}>
            {(Object.keys(s.types) as SummaryType[]).map((k) => <option key={k} value={k}>{s.types[k]}</option>)}
          </Select>
        </Field>
        <Field label={s.length}>
          <Select value={length} data-testid="sz-length" onChange={(e) => setLength(e.target.value as SummaryLength)}>
            {(Object.keys(s.lengths) as SummaryLength[]).map((k) => <option key={k} value={k}>{s.lengths[k]}</option>)}
          </Select>
        </Field>
        <Field label={s.format}>
          <Select value={format} data-testid="sz-format" onChange={(e) => setFormat(e.target.value as SummaryFormat)}>
            {(Object.keys(s.formats) as SummaryFormat[]).map((k) => <option key={k} value={k}>{s.formats[k]}</option>)}
          </Select>
        </Field>
        <Field label={s.context}>
          <Textarea rows={1} value={context} placeholder={s.contextHint} data-testid="sz-context"
            onChange={(e) => setContext(e.target.value)} />
        </Field>
      </div>

      <ModelGate
        state={state} locale={locale} progress={progress} error={error}
        onDownload={() => { void run() }} onRetry={() => { void run() }}
        unavailable={
          <div className="flex flex-col gap-2" data-testid="sz-language-unsupported">
            <p className="text-[0.95rem] text-ink rtl:font-ar">{s.noArabic}</p>
            <p className="text-[0.88rem] text-ink-faint rtl:font-ar">{s.noArabicWhy}</p>
          </div>
        }
      />

      {state === 'available' && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="primary" onClick={() => { void run() }} disabled={busy || words(text) < 10} data-testid="sz-run">
            {busy ? s.working : s.run}
          </Button>
          {words(text) > 0 && words(text) < 10 && (
            <span className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="sz-too-short">{s.tooShort}</span>
          )}
        </div>
      )}

      {output && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.output}</h2>
            <Button className="px-3 py-1" onClick={copy} data-testid="sz-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <span className="text-[0.78rem] text-ink-faint">{s.words(words(text), words(output))}</span>
          </div>
          <div className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-4 whitespace-pre-wrap text-ink"
            dir="auto" data-testid="sz-output">{output}</div>
        </section>
      )}

      <Panel className="gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.privacy}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.quality}</p>
      </Panel>
    </Stack>
  )
}
