import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useLocale, localePath } from '../../i18n'
import { Button, Input, Stack, Spinner } from '../../components/ui'
import { DownloadIcon, MicIcon, BookmarkIcon } from '../../components/icons'
import { loadGis, GOOGLE_CLIENT_ID, decodeJwt, generateCv, refineCv } from '../../lib/cvApi'
import { hideFooterStore } from '../../lib/hideFooter'
import { inAppBrowser } from '../../lib/inAppBrowser'
import { renderCvHtml } from './template'
import { cvToDocxBlob } from './docx'
import { cvFilename, type Cv } from './schema'

// Minimal Web Speech API surface (optional voice input).
type SR = { lang: string; interimResults: boolean; onresult: ((e: unknown) => void) | null; onend: (() => void) | null; start(): void; stop(): void }
const SpeechRecCtor: (new () => SR) | undefined =
  typeof window !== 'undefined'
    ? ((window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ||
       (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition)
    : undefined

const STR = {
  en: {
    heroTitle: 'Optimize your CV',
    heroBody: 'This tool rewrites the CV you already have and asks a couple of quick questions to fill any gaps.',
    dataNote: 'How we use your data (we don’t):',
    privacyLink: 'Privacy',
    termsLink: 'Terms',
    choose: 'Upload your CV',
    extracting: 'Reading your CV…',
    extracted: (n: number) => `Got it — read ${n.toLocaleString()} characters.`,
    tooShort: 'Couldn’t read enough text. Try a text-based PDF or a .docx.',
    extractErr: 'Couldn’t read that file. Try a PDF, .docx or .txt.',
    inAppWarn: (app: string) => `You’re in ${app}’s in-app browser, which can’t read PDFs here. Open this page in Safari or Chrome — tap ⋯ (or Share) and choose “Open in browser”.`,
    browserErr: 'Something went wrong reading your file. This can happen on an older browser, or an app’s built-in browser (like LinkedIn). Open this page in a full browser and try again.',
    openInBrowser: 'Open in a browser',
    linkCopied: 'Link copied — paste it into Safari or Chrome.',
    loginNote: 'Quick sign-in to build it — free, just to keep bots out.',
    build: 'Build my CV',
    building: 'Building your CV…',
    steps: ['Reading your CV…', 'Highlighting your impact…', 'Trimming the noise…', 'Tuning it for the 10-second scan…', 'Formatting your new CV…'],
    genErr: 'Something went wrong. Please try again.',
    result: 'Your CV',
    pdf: 'Save as PDF',
    word: 'Save as Word',
    optimized: 'Optimized',
    original: 'Original',
    fullscreen: 'Fullscreen',
    exitFs: 'Exit fullscreen',
    saveForLater: 'Save for later',
    savedForLater: 'Saved on this device — resume it anytime.',
    resumeSaved: 'Resume your saved CV',
    changesTitle: 'Improvements made',
    qLabel: (i: number, n: number) => `Question ${i} of ${n}`,
    answerPh: 'Type or speak your answer…',
    send: 'Send',
    sending: 'Sending…',
    skip: 'Skip this',
    answersLeftL: (n: number) => `${n} left`,
    polishTitle: 'Anything else to adjust?',
    polishPh: 'e.g. Make the summary shorter · Emphasise leadership',
    apply: 'Apply',
    applying: 'Applying…',
    polishLeftL: (n: number) => `${n} tweak${n === 1 ? '' : 's'} left`,
    noPolish: 'That’s all your tweaks — upload again to start fresh.',
    makeAdjustments: 'Make adjustments',
    closeAdjust: 'Done',
    startOver: 'Start over',
    signinErr: 'Google sign-in couldn’t load. Disable blockers and retry.',
    voice: 'Voice input',
  },
  ar: {
    heroTitle: 'حسّن سيرتك الذاتية',
    heroBody: 'تعيد هذه الأداة كتابة سيرتك الحالية وتطرح سؤالين سريعين لسدّ أي ثغرات.',
    dataNote: 'كيف نستخدم بياناتك:',
    privacyLink: 'الخصوصية',
    termsLink: 'الشروط',
    choose: 'ارفع سيرتك الذاتية',
    extracting: 'جارٍ قراءة سيرتك…',
    extracted: (n: number) => `تمّ — قُرئ ${n.toLocaleString()} حرفًا.`,
    tooShort: 'تعذّرت قراءة نص كافٍ. جرّب PDF نصيًا أو .docx.',
    extractErr: 'تعذّرت قراءة الملف. جرّب PDF أو .docx أو .txt.',
    inAppWarn: (app: string) => `أنت داخل متصفح ${app}، الذي لا يستطيع قراءة ملفات PDF هنا. افتح الصفحة في Safari أو Chrome — اضغط ⋯ (أو مشاركة) واختر «فتح في المتصفح».`,
    browserErr: 'حدث خطأ أثناء قراءة ملفك. قد يحدث هذا في متصفح قديم أو في متصفح تطبيق مُضمَّن (مثل LinkedIn). افتح الصفحة في متصفح كامل وحاول مجددًا.',
    openInBrowser: 'افتح في متصفح',
    linkCopied: 'نُسخ الرابط — الصقه في Safari أو Chrome.',
    loginNote: 'تسجيل دخول سريع للبناء — مجاني، فقط لمنع الروبوتات.',
    build: 'ابنِ سيرتي',
    building: 'جارٍ بناء سيرتك…',
    steps: ['نقرأ سيرتك…', 'نُبرز إنجازاتك…', 'نحذف الحشو…', 'نضبطها لمسحٍ في ١٠ ثوانٍ…', 'ننسّق سيرتك الجديدة…'],
    genErr: 'حدث خطأ ما. حاول مرة أخرى.',
    result: 'سيرتك',
    pdf: 'حفظ PDF',
    word: 'حفظ Word',
    optimized: 'المُحسّنة',
    original: 'الأصلية',
    fullscreen: 'ملء الشاشة',
    exitFs: 'إنهاء ملء الشاشة',
    saveForLater: 'احفظ للاحقًا',
    savedForLater: 'حُفظت على هذا الجهاز — استأنفها متى شئت.',
    resumeSaved: 'استأنف سيرتك المحفوظة',
    changesTitle: 'التحسينات المُطبَّقة',
    qLabel: (i: number, n: number) => `سؤال ${i} من ${n}`,
    answerPh: 'اكتب أو انطق إجابتك…',
    send: 'إرسال',
    sending: 'جارٍ الإرسال…',
    skip: 'تخطَّ هذا',
    answersLeftL: (n: number) => `${n} متبقٍّ`,
    polishTitle: 'أي شيء آخر لتعديله؟',
    polishPh: 'مثال: اجعل الملخّص أقصر · أبرِز القيادة',
    apply: 'تطبيق',
    applying: 'جارٍ التطبيق…',
    polishLeftL: (n: number) => `${n === 1 ? 'تعديل واحد متبقٍّ' : `${n} تعديلات متبقّية`}`,
    noPolish: 'انتهت تعديلاتك — ارفع من جديد للبدء من الصفر.',
    makeAdjustments: 'أجرِ تعديلات',
    closeAdjust: 'تم',
    startOver: 'ابدأ من جديد',
    signinErr: 'تعذّر تحميل تسجيل دخول جوجل. عطّل المانعات وأعد المحاولة.',
    voice: 'إدخال صوتي',
  },
}

type Status = 'idle' | 'extracting' | 'ready' | 'generating' | 'done'

/** Text field with an optional speech-to-text mic + a send button. */
function ChatInput({
  value, setValue, onSend, placeholder, busy, sendLabel, testid, locale,
}: {
  value: string
  setValue: (v: string) => void
  onSend: () => void
  placeholder: string
  busy: boolean
  sendLabel: string
  testid: string
  locale: 'en' | 'ar'
}) {
  const recRef = useRef<SR | null>(null)
  const [listening, setListening] = useState(false)
  const voiceLabel = STR[locale].voice

  function toggleMic() {
    if (!SpeechRecCtor) return
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const rec = new SpeechRecCtor()
    rec.lang = locale === 'ar' ? 'ar-SA' : 'en-US'
    rec.interimResults = false
    rec.onresult = (e: unknown) => {
      const t = (e as { results?: Array<Array<{ transcript?: string }>> })?.results?.[0]?.[0]?.transcript || ''
      if (t) setValue(value ? `${value} ${t}` : t)
    }
    rec.onend = () => setListening(false)
    try {
      rec.start()
      recRef.current = rec
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative grow min-w-0 flex items-center">
        <Input
          className={SpeechRecCtor ? 'pe-11' : ''}
          value={value}
          placeholder={placeholder}
          data-testid={testid}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
        />
        {SpeechRecCtor && (
          <button
            type="button"
            aria-label={voiceLabel}
            aria-pressed={listening}
            onClick={toggleMic}
            className={`absolute end-1.5 inline-flex items-center justify-center size-8 rounded-full border-0 bg-transparent cursor-pointer ${listening ? 'text-green-600 bg-[color-mix(in_srgb,var(--green-400)_20%,transparent)]' : 'text-ink-faint hover:text-ink-soft'}`}
          >
            <MicIcon className="size-[18px]" />
          </button>
        )}
      </div>
      <Button variant="primary" onClick={onSend} disabled={busy || !value.trim()}>{sendLabel}</Button>
    </div>
  )
}

/** The uploaded PDF rendered as page images (reliable everywhere, unlike an
 *  <iframe> that depends on the browser's native PDF viewer). */
function PdfPages({ pages, className = '' }: { pages: string[]; className?: string }) {
  return (
    <div className={`overflow-y-auto bg-[#e9ebef] ${className}`}>
      <div className="flex flex-col items-center gap-3 py-4 px-2">
        {pages.map((src, i) => (
          <img key={i} src={src} alt="" className="w-full max-w-[210mm] bg-white shadow-[var(--shadow-sm)]" />
        ))}
      </div>
    </div>
  )
}

export default function CvGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const inApp = inAppBrowser() // e.g. "LinkedIn" if in an in-app WebView
  const [idToken, setIdToken] = useState<string | null>(null)
  const [gisReady, setGisReady] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [text, setText] = useState('')
  const [cv, setCv] = useState<Cv | null>(null)
  const [err, setErr] = useState('')
  const [errDetail, setErrDetail] = useState('') // technical diagnostics shown under an upload error
  const [browserFallback, setBrowserFallback] = useState(false) // show the "open in browser" fallback
  const [answersLeft, setAnswersLeft] = useState(0)
  const [polishLeft, setPolishLeft] = useState(0)
  const [queue, setQueue] = useState<string[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [toast, setToast] = useState('')
  const [loadingStep, setLoadingStep] = useState(0)
  // A CV the user saved to this device to finish later.
  const [saved, setSaved] = useState<Cv | null>(() => {
    try { const r = localStorage.getItem('bis-cv-saved'); return r ? (JSON.parse(r).cv as Cv) : null } catch { return null }
  })
  const [answerText, setAnswerText] = useState('')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState<'' | 'answer' | 'polish'>('')
  const [saveMenu, setSaveMenu] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [fs, setFs] = useState(false) // preview is in browser fullscreen
  const [origPages, setOrigPages] = useState<string[]>([]) // uploaded PDF rendered to page images (for loading + the "Original" flip)
  const previewRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLDivElement>(null)
  const gisRef = useRef<{ renderButton: (el: HTMLElement, o: Record<string, unknown>) => void } | null>(null)
  const activeRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Guards the auto-generate effect so a failed generation never re-triggers it
  // (which would hammer the API). Reset only when a new file is uploaded.
  const autoTried = useRef(false)
  // The previous change summary, sent as context so the user can correct it.
  const lastChangeRef = useRef('')

  // Load + init Google Identity Services once (but don't force sign-in yet).
  useEffect(() => {
    let cancelled = false
    loadGis()
      .then((id) => {
        if (cancelled) return
        id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (r) => { setIdToken(r.credential); decodeJwt(r.credential) },
        })
        gisRef.current = id
        setGisReady(true)
      })
      .catch(() => setErr(s.signinErr))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render the Google button whenever the sign-in prompt is on screen.
  useEffect(() => {
    if (gisReady && !idToken && btnRef.current && gisRef.current) {
      btnRef.current.innerHTML = ''
      gisRef.current.renderButton(btnRef.current, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill' })
    }
  }, [gisReady, idToken, text, status])

  // Auto-scroll to the active question / polish section after each step.
  useEffect(() => {
    if (status === 'done' && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [qIndex, status])

  // Hide the site footer while the immersive result preview is on screen.
  useEffect(() => {
    hideFooterStore.set(status === 'done')
    return () => hideFooterStore.set(false)
  }, [status])

  // Track browser fullscreen so the preview iframe fills the screen.
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  function toggleFullscreen() {
    const el = previewRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else el.requestFullscreen?.().catch(() => {})
  }

  // Generate automatically as soon as we have both the CV text and a signed-in
  // user — once per uploaded file. The autoTried guard stops a failed attempt
  // (e.g. rate-limited) from re-firing and hammering the API.
  useEffect(() => {
    if (status === 'ready' && idToken && text && !autoTried.current) {
      autoTried.current = true
      generate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, idToken])

  // Cycle the "building" status messages while generating.
  useEffect(() => {
    if (status !== 'generating') { setLoadingStep(0); return }
    const t = setInterval(() => setLoadingStep((i) => (i + 1) % 5), 2200)
    return () => clearInterval(t)
  }, [status])

  // Auto-dismiss the change toast.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3800)
    return () => clearTimeout(t)
  }, [toast])

  // Technical diagnostics shown under an upload error, so a screenshot is enough
  // to report the real cause (worker blocked, chunk 404, browser, etc.).
  function diag(what: string, f: File, pdfver: string): string {
    const build = document.querySelector('meta[name="build"]')?.getAttribute('content') || '?'
    return [
      what.slice(0, 240),
      `file: ${f.name} · ${f.type || 'no-type'} · ${Math.round(f.size / 1024)}KB`,
      `pdf.js ${pdfver} · build ${build}`,
      navigator.userAgent,
    ].join('\n')
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    autoTried.current = false
    setErr('')
    setErrDetail('')
    setCv(null)
    setShowOriginal(false)
    setOrigPages([])
    setStatus('extracting')
    let pdfver = '?'
    try {
      const ex = await import('./extract')
      pdfver = ex.pdfVersion
      const t = await ex.extractText(f)
      if (!t || t.length < 60) {
        setErr(s.tooShort)
        setBrowserFallback(false)
        setErrDetail(diag(`extracted ${t?.length ?? 0} chars`, f, pdfver))
        setStatus('idle')
        return
      }
      setText(t)
      setStatus('ready')
      // Render the PDF to page images for the reading view + Original flip (best-effort).
      ex.renderPdfPages(f).then(setOrigPages).catch(() => setOrigPages([]))
    } catch (err) {
      // Extraction threw — most often an old/in-app browser missing a JS API.
      setErr(s.browserErr)
      setBrowserFallback(true)
      setErrDetail(diag(`${(err as Error)?.name || 'Error'}: ${(err as Error)?.message || String(err)}`, f, pdfver))
      setStatus('idle')
    }
  }

  // Fallback for old / in-app browsers: copy the link and try to open it fresh.
  async function openInBrowser() {
    const url = window.location.href
    try { await navigator.clipboard.writeText(url); setToast(s.linkCopied) } catch { /* ignore */ }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function generate() {
    if (!idToken || !text) return
    setStatus('generating')
    setErr('')
    try {
      const r = await generateCv(idToken, text)
      setCv(r.cv)
      setAnswersLeft(r.answersLeft)
      setPolishLeft(r.polishLeft)
      setQueue(r.questions)
      setQIndex(0)
      setToast('')
      setAdjustOpen(false)
      lastChangeRef.current = ''
      setAnswerText('')
      setInstruction('')
      setStatus('done')
    } catch (e) {
      setErr((e as Error).message || s.genErr)
      setStatus('ready')
    }
  }

  const currentQ = status === 'done' && qIndex < queue.length && answersLeft > 0 ? queue[qIndex] : null

  async function answer() {
    if (!idToken || !cv || !currentQ || !answerText.trim() || busy) return
    setBusy('answer')
    setErr('')
    try {
      const r = await refineCv(idToken, cv, `Question: ${currentQ}\nAnswer: ${answerText.trim()}`, 'answer', lastChangeRef.current, text)
      setCv(r.cv)
      setAnswersLeft(r.answersLeft)
      if (r.summary) { setToast(r.summary); lastChangeRef.current = r.summary }
      setAnswerText('')
      setQIndex((i) => i + 1)
      setAdjustOpen(false) // back to the Download / Make adjustments bar
    } catch (e) {
      setErr((e as Error).message || s.genErr)
    } finally {
      setBusy('')
    }
  }

  function skip() {
    setAnswerText('')
    setQIndex((i) => i + 1)
  }

  async function polish() {
    if (!idToken || !cv || !instruction.trim() || polishLeft <= 0 || busy) return
    setBusy('polish')
    setErr('')
    try {
      const r = await refineCv(idToken, cv, instruction.trim(), 'polish', lastChangeRef.current, text)
      setCv(r.cv)
      setPolishLeft(r.polishLeft)
      if (r.summary) { setToast(r.summary); lastChangeRef.current = r.summary }
      setInstruction('')
      setAdjustOpen(false) // back to the Download / Make adjustments bar
    } catch (e) {
      setErr((e as Error).message || s.genErr)
    } finally {
      setBusy('')
    }
  }

  // Vector, selectable-text PDF rendered from the Cv JSON via react-pdf (see
  // CvPdf.tsx). Dynamically imported so @react-pdf/renderer + fonts load only on
  // the first download, not with the tool.
  async function exportPdf() {
    if (!cv || pdfBusy) return
    setPdfBusy(true)
    try {
      const { cvToPdfBlob } = await import('./CvPdf')
      const blob = await cvToPdfBlob(cv)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${cvFilename(cv)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e) {
      setErr((e as Error).message || 'PDF export failed')
    } finally {
      setPdfBusy(false)
    }
  }

  function exportWord() {
    if (!cv) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(cvToDocxBlob(cv))
    a.download = `${cvFilename(cv)}.docx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  function saveForLater() {
    if (!cv) return
    try { localStorage.setItem('bis-cv-saved', JSON.stringify({ cv, savedAt: Date.now() })) } catch { /* storage full */ }
    setSaved(cv)
    setSaveMenu(false)
    setToast(s.savedForLater)
  }
  function resumeSaved() {
    if (!saved) return
    setCv(saved)
    setQueue([])
    setQIndex(0)
    setStatus('done')
  }

  // Full-bleed green intro, docked flush to the navbar (cancels the page's top padding).
  const hero = (
    <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] bg-green-600 text-sand-100">
      <div className="wrap py-[clamp(1.6rem,4.5vw,2.4rem)] flex flex-col gap-3">
        <h1 className="font-display rtl:font-ar text-[clamp(1.5rem,4.5vw,2.1rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{s.heroTitle}</h1>
        <p className="text-[0.98rem] leading-relaxed opacity-90 max-w-[46rem]">{s.heroBody}</p>
        {status === 'idle' && (
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <label className="inline-flex self-start">
              <input type="file" accept=".pdf,.docx,.txt,.md,text/plain,application/pdf" className="sr-only" onChange={onFile} data-testid="cv-file" />
              <span className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-white text-green-700 px-4 py-2 text-[0.9rem] font-semibold hover:bg-sand-100">
                {s.choose}
              </span>
            </label>
            {saved && (
              <button type="button" onClick={resumeSaved} data-testid="cv-resume"
                className="inline-flex items-center gap-2 bg-transparent border-0 text-sand-100 underline text-[0.9rem] font-semibold cursor-pointer">
                <BookmarkIcon /> {s.resumeSaved}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // Discreet data-usage line, docked just above the site footer.
  const dataLinks = (
    <p className="text-[0.72rem] text-ink-faint opacity-80 flex items-center gap-2 mt-auto pt-6">
      <span>{s.dataNote}</span>
      <Link to={localePath(locale, '/privacy')} className="underline" style={{ color: 'var(--ink-faint)' }} data-testid="cv-privacy-link">{s.privacyLink}</Link>
      <span aria-hidden="true">·</span>
      <Link to={localePath(locale, '/terms')} className="underline" style={{ color: 'var(--ink-faint)' }} data-testid="cv-terms-link">{s.termsLink}</Link>
    </p>
  )

  return (
    <Stack data-testid="cv-generator" className="min-h-[70vh]">
      {status !== 'done' && (
        <>
          {(status === 'idle' || (status === 'extracting' && origPages.length === 0)) && hero}

          {inApp && status === 'idle' && (
            <div className="flex items-start gap-2 border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] ps-3 pe-3 py-2.5 rounded-e-md" data-testid="inapp-warn">
              <span className="text-[0.85rem] text-ink leading-snug">{s.inAppWarn(inApp)}</span>
            </div>
          )}

          {status === 'extracting' && origPages.length === 0 && (
            <div className="py-24 flex justify-center" data-testid="cv-loading"><Spinner className="size-9" label={s.extracting} /></div>
          )}

          {/* Immediate PDF preview (ready + generating). It blurs while we generate,
              with a scanning beam + status pill on top. */}
          {origPages.length > 0 && (status === 'ready' || status === 'generating') && (
            <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] relative overflow-hidden h-[calc(100dvh-11rem)] min-h-[22rem]" data-testid="cv-loading">
              <PdfPages pages={origPages} className={`absolute inset-0 transition-[filter,transform] duration-500 ${status === 'generating' ? 'blur-[7px] scale-[1.03]' : ''}`} />
              {status === 'generating' && (
                <>
                  <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[color-mix(in_srgb,var(--sand-50)_35%,transparent)]" />
                  <div aria-hidden="true" className="absolute inset-x-0 top-0 h-24 pointer-events-none blur-[2px] bg-[linear-gradient(to_bottom,transparent,color-mix(in_srgb,var(--green-500)_45%,transparent),color-mix(in_srgb,var(--green-300)_60%,transparent),color-mix(in_srgb,var(--green-500)_45%,transparent),transparent)] animate-[cvscan_2.4s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
                  <div className="absolute inset-x-0 top-5 flex justify-center px-4 pointer-events-none">
                    <span className="inline-flex items-center gap-2.5 rounded-full bg-[var(--ink)] text-sand-100 px-4 py-2 text-[0.92rem] font-semibold shadow-[var(--shadow-md)]">
                      <Spinner className="size-[1.1rem]" label={s.building} />
                      <span key={loadingStep} className="animate-[fadeUp_0.4s_ease]">{s.steps[loadingStep]}</span>
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Non-PDF (docx/txt): nothing to preview, so a simple spinner while generating. */}
          {status === 'generating' && origPages.length === 0 && (
            <div className="py-24 flex flex-col items-center gap-4" data-testid="cv-loading">
              <Spinner className="size-9" label={s.building} />
              <span key={loadingStep} className="text-[0.95rem] font-medium text-ink-soft animate-[fadeUp_0.4s_ease]">{s.steps[loadingStep]}</span>
            </div>
          )}

          {err && (
            <div className="flex flex-col gap-2.5 border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] ps-3 pe-3 py-3 rounded-e-md" data-testid="cv-error">
              <p className="text-[0.9rem] text-ink leading-snug">{err}</p>
              {browserFallback && (
                <Button variant="primary" data-testid="open-in-browser" onClick={openInBrowser} className="self-start !h-9">{s.openInBrowser}</Button>
              )}
              {errDetail && (
                <pre data-testid="cv-error-diag" className="whitespace-pre-wrap break-words select-all font-mono text-[0.68rem] leading-snug text-ink-faint bg-[color-mix(in_srgb,var(--color-ink)_5%,transparent)] border border-[color:var(--line-soft)] rounded-md p-2.5 max-w-full">{errDetail}</pre>
              )}
            </div>
          )}
        </>
      )}

      {/* Sticky bottom sign-in — a CV is ready, waiting for a quick Google sign-in. */}
      {text && !idToken && status !== 'done' && createPortal(
        <div className="fixed inset-x-0 bottom-0 z-40 bg-[var(--surface)] border-t border-[color:var(--line)] shadow-[0_-6px_20px_rgba(20,30,50,0.09)] pb-[env(safe-area-inset-bottom,0px)]">
          <div className="wrap py-3 flex items-center gap-3 flex-wrap">
            <div ref={btnRef} className="[color-scheme:light]" data-testid="google-signin" />
            <span className="text-[0.85rem] text-ink-faint flex-1 min-w-[12rem]">{s.loginNote}</span>
          </div>
        </div>,
        document.body,
      )}

      {status === 'done' && cv && (
        <>
          {/* Immersive full-bleed preview, docked flush to the navbar, scaled to fit.
              The optimized iframe stays mounted (keeps inline edits); the original
              PDF is overlaid when flipped. */}
          <div ref={previewRef} className={`mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] relative overflow-hidden bg-[#e9ebef] ${fs ? 'h-[100dvh]' : 'h-[calc(100dvh-8.5rem)] max-[560px]:h-[calc(100dvh-8rem)] min-h-[22rem]'}`}>
            <iframe
              ref={iframeRef}
              title={cvFilename(cv)}
              className="block w-full h-full border-0 bg-[#e9ebef]"
              srcDoc={renderCvHtml(cv, { preview: true })}
            />
            {showOriginal && origPages.length > 0 && (
              <PdfPages pages={origPages} className="absolute inset-0 h-full" />
            )}

            {/* Controls live INSIDE the preview so they stay visible in fullscreen. */}
            {origPages.length > 0 && (
              <div className="absolute start-3 top-3 z-10 flex items-stretch rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)] overflow-hidden text-[0.82rem] font-semibold">
                <button type="button" data-testid="cv-view-optimized" onClick={() => setShowOriginal(false)} className={`px-3 py-1.5 border-0 cursor-pointer ${!showOriginal ? 'bg-green-600 text-sand-100' : 'bg-transparent text-ink-soft hover:bg-sand-100'}`}>{s.optimized}</button>
                <button type="button" data-testid="cv-view-original" onClick={() => setShowOriginal(true)} className={`px-3 py-1.5 border-0 border-s border-[color:var(--line)] cursor-pointer ${showOriginal ? 'bg-green-600 text-sand-100' : 'bg-transparent text-ink-soft hover:bg-sand-100'}`}>{s.original}</button>
              </div>
            )}
            <button type="button" onClick={toggleFullscreen} data-testid="cv-fullscreen" aria-label={fs ? s.exitFs : s.fullscreen} title={fs ? s.exitFs : s.fullscreen}
              className="absolute end-3 top-3 z-10 grid place-items-center size-9 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft shadow-[var(--shadow-md)] hover:text-green-700 cursor-pointer">
              {fs
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[1.15rem]" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[1.15rem]" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>}
            </button>
          </div>

          {/* Bottom bar — portaled to <body> so `fixed inset-x-0` bleeds full-width
              (ToolPage's transform otherwise resolves it against the tool box). The
              inner .wrap keeps the buttons at the page max-width. */}
          {createPortal(
          <div className="fixed inset-x-0 bottom-0 z-40 bg-[var(--surface)] border-t border-[color:var(--line)] shadow-[0_-6px_20px_rgba(20,30,50,0.09)]">
            <div className="wrap py-2.5">
              {adjustOpen ? (
                <div ref={activeRef} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-green-700">
                      {currentQ ? s.qLabel(qIndex + 1, queue.length) : s.polishTitle}
                    </span>
                    <button type="button" className="text-[0.82rem] font-semibold text-ink-soft underline bg-transparent border-0 cursor-pointer p-0" onClick={() => setAdjustOpen(false)} data-testid="cv-adjust-close">{s.closeAdjust}</button>
                  </div>
                  {currentQ ? (
                    <>
                      <p className="text-[0.95rem] text-ink leading-snug">{currentQ}</p>
                      <ChatInput value={answerText} setValue={setAnswerText} onSend={answer} placeholder={s.answerPh}
                        busy={busy === 'answer'} sendLabel={busy === 'answer' ? s.sending : s.send} testid="cv-answer" locale={locale} />
                      <button type="button" className="self-start text-[0.78rem] text-ink-faint underline bg-transparent border-0 cursor-pointer p-0" onClick={skip} data-testid="cv-skip">{s.skip}</button>
                    </>
                  ) : polishLeft > 0 ? (
                    <ChatInput value={instruction} setValue={setInstruction} onSend={polish} placeholder={s.polishPh}
                      busy={busy === 'polish'} sendLabel={busy === 'polish' ? s.applying : s.apply} testid="cv-instruction" locale={locale} />
                  ) : (
                    <p className="text-[0.8rem] text-ink-faint">{s.noPolish}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex items-stretch rounded-md shadow-[var(--shadow-sm)]">
                    <button type="button" onClick={exportPdf} data-testid="cv-pdf" disabled={pdfBusy}
                      className="inline-flex items-center gap-2 rounded-s-md bg-green-600 text-sand-100 px-4 py-2.5 text-[0.9rem] font-semibold hover:bg-green-700 border-0 cursor-pointer disabled:opacity-70 disabled:cursor-wait">
                      {pdfBusy ? <Spinner className="size-4" /> : <DownloadIcon />} {s.pdf}
                    </button>
                    <button type="button" aria-label={s.word} aria-expanded={saveMenu} onClick={() => setSaveMenu((v) => !v)}
                      className="inline-flex items-center rounded-e-md bg-green-700 text-sand-100 px-2.5 text-base border-0 border-s border-[color:color-mix(in_srgb,var(--sand-100)_30%,transparent)] hover:bg-green-600 cursor-pointer">▾</button>
                    {saveMenu && (
                      <div className="absolute bottom-full start-0 mb-1.5 bg-[var(--surface)] border border-[color:var(--line)] rounded-md shadow-[var(--shadow-md)] overflow-hidden min-w-[12rem]">
                        <button type="button" data-testid="cv-word" onClick={() => { exportWord(); setSaveMenu(false) }}
                          className="flex items-center gap-2 w-full text-start px-4 py-2.5 text-[0.88rem] text-ink-soft hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] border-0 bg-transparent cursor-pointer whitespace-nowrap">
                          <DownloadIcon /> {s.word}
                        </button>
                        <button type="button" data-testid="cv-save-later" onClick={saveForLater}
                          className="flex items-center gap-2 w-full text-start px-4 py-2.5 text-[0.88rem] text-ink-soft hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] border-0 border-t border-[color:var(--line-soft)] bg-transparent cursor-pointer whitespace-nowrap">
                          <BookmarkIcon /> {s.saveForLater}
                        </button>
                      </div>
                    )}
                  </div>
                  <Button onClick={() => setAdjustOpen(true)} data-testid="cv-adjust-open"
                    disabled={polishLeft <= 0 && !currentQ}
                    title={polishLeft <= 0 && !currentQ ? s.noPolish : undefined}>
                    {s.makeAdjustments}{currentQ ? ` · ${queue.length - qIndex}` : ''}
                  </Button>
                </div>
              )}
            </div>
          </div>,
          document.body,
          )}

          {err && <p className="fixed inset-x-0 bottom-1 text-center text-[0.8rem] text-gold-500 z-50">{err}</p>}
        </>
      )}

      {toast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[min(90vw,32rem)] flex items-start gap-2.5 bg-green-600 text-sand-100 px-5 py-3.5 rounded-lg shadow-[var(--shadow-md)] text-[0.92rem] leading-snug animate-[fadeUp_0.3s_ease]" role="status" data-testid="cv-toast">
          <span aria-hidden="true" className="mt-0.5">✓</span><span>{toast}</span>
        </div>
      )}

      {status !== 'done' && dataLinks}
    </Stack>
  )
}
