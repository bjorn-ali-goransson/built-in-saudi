import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Select, Textarea, Stack, Panel, ModelGate } from '../../components/ui'
import { CopyIcon, ExchangeIcon } from '../../components/icons'
import {
  createTranslator, detectLanguage, hasTranslator, streamOrBatch, supportedTargets, translatorAvailability,
  type ModelState, type TranslatorInstance,
} from '../../lib/builtinAi'
import { LANGUAGES, isRtl, languageName, nativeName } from './languages'

const STORE = 'bis-translate-pair'
const AUTO = 'auto'

const STR = {
  en: {
    from: 'From', to: 'To', auto: 'Detect language',
    detected: (name: string) => `Detected: ${name}`,
    lowConfidence: 'not confident — set it yourself if this is wrong',
    input: 'Text', placeholder: 'Type or paste anything',
    output: 'Translation',
    swap: 'Swap', copy: 'Copy', copied: 'Copied!', clear: 'Clear',
    translate: 'Translate', working: 'Translating…',
    chars: (n: number) => `${n.toLocaleString('en')} characters`,
    pairUnsupported: (a: string, b: string) =>
      `The on-device model does not translate ${a} to ${b}. It is a small model with a fixed set of language pairs — pick another pair, or go through English, which nearly everything supports.`,
    privacy: 'The text never leaves this page. The model runs on your device, which is also why it works with no connection once the language pack is downloaded.',
    quality: 'It is a small on-device model, not a professional translator. It is good for understanding a message, a form or a sign; it is not good enough for a contract you are signing or anything official.',
    sameLang: 'Pick two different languages.',
  },
  ar: {
    from: 'من', to: 'إلى', auto: 'تعرّف على اللغة',
    detected: (name: string) => `اللغة المكتشفة: ${name}`,
    lowConfidence: 'غير مؤكّد — حدّدها بنفسك إن كان هذا خطأً',
    input: 'النص', placeholder: 'اكتب أو الصق أي شيء',
    output: 'الترجمة',
    swap: 'بدّل', copy: 'نسخ', copied: 'تم النسخ!', clear: 'مسح',
    translate: 'ترجم', working: 'جارٍ الترجمة…',
    chars: (n: number) => `${n.toLocaleString('ar')} حرفًا`,
    pairUnsupported: (a: string, b: string) =>
      `النموذج الذي يعمل على جهازك لا يترجم من ${a} إلى ${b}. فهو نموذج صغير بأزواج لغات محدودة — اختر زوجًا آخر، أو مُرّ عبر الإنجليزية التي يدعمها كل شيء تقريبًا.`,
    privacy: 'لا يغادر النص هذه الصفحة. فالنموذج يعمل على جهازك، ولهذا أيضًا تعمل الأداة بلا اتصال بعد تنزيل حزمة اللغة.',
    quality: 'هو نموذج صغير يعمل على الجهاز، وليس مترجمًا محترفًا. يفيدك في فهم رسالة أو نموذج أو لافتة؛ ولا يكفي لعقد توقّعه أو لأي غرض رسمي.',
    sameLang: 'اختر لغتين مختلفتين.',
  },
}

interface Stored { from: string; to: string }

function loadPair(locale: 'en' | 'ar'): Stored {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) {
      const p = JSON.parse(raw) as Stored
      if (p?.from && p?.to) return p
    }
  } catch { /* ignore */ }
  // A sensible default per side of the site rather than a fixed one.
  return locale === 'ar' ? { from: AUTO, to: 'en' } : { from: AUTO, to: 'ar' }
}

export default function TranslateTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [{ from, to }, setPair] = useState<Stored>(() => loadPair(locale))
  const [text, setText] = useState('')
  const [output, setOutput] = useState('')
  const [state, setState] = useState<ModelState>('checking')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [detected, setDetected] = useState<{ language: string; confidence: number } | null>(null)
  const [usable, setUsable] = useState<Set<string> | null>(null)

  const translatorRef = useRef<TranslatorInstance | null>(null)
  const madeFor = useRef('')

  // The resolved source: what the detector said, when the picker says "detect".
  //
  // Before anything is typed there is nothing to detect, and waiting for it
  // would leave the page on "checking…" indefinitely. So it falls back to the
  // language of the site you are on — the overwhelmingly likely answer — which
  // also means the download gate can appear before you type a word. A real
  // detection replaces it a moment later.
  const source = from === AUTO ? (detected?.language ?? locale) : from
  const pairKey = `${source}>${to}`

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify({ from, to })) } catch { /* ignore */ } }, [from, to])

  // Detect as the user types. Cheap, no download, and it drives the source when
  // the picker is on auto.
  useEffect(() => {
    if (from !== AUTO) { setDetected(null); return }
    if (text.trim().length < 4) { setDetected(null); return }
    let live = true
    const id = setTimeout(async () => {
      const d = await detectLanguage(text)
      if (live) setDetected(d)
    }, 400)
    return () => { live = false; clearTimeout(id) }
  }, [text, from])

  // Which targets this browser will actually accept for the current source.
  //
  // Probed from English before a source is known, so the page can answer "this
  // browser cannot do it at all" immediately instead of sitting on "checking…"
  // until the user types something the detector can read.
  const probeSource = source || 'en'
  useEffect(() => {
    if (!hasTranslator()) { setUsable(null); return }
    let live = true
    supportedTargets(probeSource, LANGUAGES.map((l) => l.code)).then((set) => { if (live) setUsable(set) })
    return () => { live = false }
  }, [probeSource])

  const check = useCallback(async () => {
    if (!hasTranslator()) { setState('unsupported'); return }
    // The constructors existing is NOT the same as the models existing —
    // Playwright's Chromium, and some Linux builds, expose the whole API and
    // then refuse every language pair. If nothing at all is translatable, the
    // honest message is "this browser cannot run it", not "try another pair".
    if (usable === null) { setState('checking'); return }
    if (usable.size === 0) { setState('unsupported'); return }
    if (source === to) { setState('unavailable'); return }
    setState(await translatorAvailability({ sourceLanguage: source, targetLanguage: to }))
  }, [source, to, usable])

  useEffect(() => { void check() }, [check])

  // A different pair needs a different translator; drop the old one rather than
  // translating into the language the user just switched away from.
  useEffect(() => {
    if (madeFor.current && madeFor.current !== pairKey) {
      translatorRef.current?.destroy?.()
      translatorRef.current = null
      madeFor.current = ''
      setOutput('')
    }
  }, [pairKey])

  useEffect(() => () => translatorRef.current?.destroy?.(), [])

  async function ensure(): Promise<TranslatorInstance | null> {
    if (translatorRef.current && madeFor.current === pairKey) return translatorRef.current
    if (!source || source === to) return null
    setProgress(0)
    // Two attempts, and the second one is not superstition: on Edge 151 the
    // first create() for a pack that has to be fetched rejects with a bare
    // "Other generic failures occurred" *after* the download progresses to
    // 100%, and an identical call a moment later succeeds. One retry turns a
    // dead end into a pause; failing twice is a real failure and is shown.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const t = await createTranslator(
          { sourceLanguage: source, targetLanguage: to },
          // Only claim to be downloading once the browser says it is. When the
          // pack is already cached, create() resolves without a single progress
          // event, and flashing a download bar at someone who is not downloading
          // anything is a small lie.
          { onProgress: (f) => { setState('downloading'); setProgress(f) } },
        )
        translatorRef.current = t
        madeFor.current = pairKey
        setState('available')
        setError('')
        return t
      } catch (e) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500))
          continue
        }
        setError(e instanceof Error ? e.message : String(e))
        setState('error')
      }
    }
    return null
  }

  async function run() {
    if (!text.trim()) { setOutput(''); return }
    setBusy(true)
    try {
      const t = await ensure()
      if (!t) return
      setOutput('')
      // Streaming so a long paragraph shows something immediately; a small model
      // on a laptop is not instant. Falls back to the batch call, because
      // streaming is present-but-broken on some builds.
      await streamOrBatch(() => t.translateStreaming(text), () => t.translate(text), setOutput)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setState('error')
    } finally { setBusy(false) }
  }

  // Once a translator exists, translate as they type — that is what a
  // translator is expected to feel like.
  //
  // It must NOT create one: `create()` needs user activation even when
  // availability says the pack is present, and calling it from an effect fails
  // with a bare "other generic failures occurred". So live translation only
  // starts after the button has made one, and switching language pairs drops
  // the instance and puts the button back.
  useEffect(() => {
    if (state !== 'available' || busy) return
    if (!translatorRef.current || madeFor.current !== pairKey) return
    if (!text.trim()) { setOutput(''); return }
    const id = setTimeout(() => { void run() }, 500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, state, pairKey])

  function swap() {
    const nextFrom = to
    const nextTo = from === AUTO ? (detected?.language ?? 'en') : from
    setPair({ from: nextFrom, to: nextTo })
    setText(output || text)
    setOutput('')
  }

  async function copy() {
    if (!output) return
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const label = (code: string) => {
    const name = languageName(code, locale)
    const nat = nativeName(code)
    return nat && nat !== name ? `${name} — ${nat}` : name
  }

  const targetOptions = useMemo(() => LANGUAGES.filter((l) => l.code !== source), [source])

  return (
    <Stack data-testid="translate">
      <div className="grid gap-2 grid-cols-[1fr_auto_1fr] items-end">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.from}
          <Select value={from} data-testid="tr-from" onChange={(e) => setPair((p) => ({ ...p, from: e.target.value }))}>
            <option value={AUTO}>{s.auto}</option>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{label(l.code)}</option>)}
          </Select>
        </label>
        <Button className="px-3 mb-0.5" onClick={swap} aria-label={s.swap} data-testid="tr-swap"><ExchangeIcon /></Button>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.to}
          <Select value={to} data-testid="tr-to" onChange={(e) => setPair((p) => ({ ...p, to: e.target.value }))}>
            {targetOptions.map((l) => (
              <option key={l.code} value={l.code} disabled={usable ? !usable.has(l.code) : false}>
                {label(l.code)}{usable && !usable.has(l.code) ? ' ·' : ''}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {from === AUTO && detected && (
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="tr-detected">
          {s.detected(languageName(detected.language, locale))}
          {detected.confidence < 0.5 && <span className="text-gold-500"> · {s.lowConfidence}</span>}
        </p>
      )}

      <div className="grid gap-3 grid-cols-1 min-[760px]:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.input}</span>
          <Textarea rows={8} value={text} placeholder={s.placeholder} data-testid="tr-input"
            dir={source && isRtl(source) ? 'rtl' : 'auto'}
            className={source && isRtl(source) ? 'font-ar' : ''}
            onChange={(e) => setText(e.target.value)} />
          <span className="text-[0.75rem] text-ink-faint">{s.chars(text.length)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.output}</span>
          <div dir={isRtl(to) ? 'rtl' : 'ltr'} data-testid="tr-output"
            className={`min-h-[12rem] rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-3 whitespace-pre-wrap text-ink ${isRtl(to) ? 'font-ar' : ''}`}>
            {output}
          </div>
          <div className="flex gap-2">
            <Button className="px-3 py-1" onClick={copy} disabled={!output} data-testid="tr-copy">
              <CopyIcon /> {copied ? s.copied : s.copy}
            </Button>
          </div>
        </div>
      </div>

      <ModelGate
        state={state}
        locale={locale} progress={progress} error={error}
        // Retry re-runs the whole attempt, not just the capability question —
        // the thing that failed was the translation, so that is what a person
        // pressing "try again" is asking for.
        onDownload={() => { void run() }} onRetry={() => { void run() }}
        unavailable={
          <p className="text-[0.92rem] text-ink-soft rtl:font-ar" data-testid="tr-pair-unsupported">
            {source === to
              ? s.sameLang
              : s.pairUnsupported(languageName(source, locale), languageName(to, locale))}
          </p>
        }
      />

      {state === 'available' && (
        <Button variant="primary" className="self-start" onClick={() => { void run() }} disabled={busy || !text.trim()} data-testid="tr-run">
          {busy ? s.working : s.translate}
        </Button>
      )}

      <Panel className="gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.privacy}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.quality}</p>
      </Panel>
    </Stack>
  )
}
