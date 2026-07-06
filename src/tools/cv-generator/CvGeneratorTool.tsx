import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLocale, localePath } from '../../i18n'
import { Button, Input, Stack } from '../../components/ui'
import { DownloadIcon, MicIcon } from '../../components/icons'
import { loadGis, GOOGLE_CLIENT_ID, decodeJwt, generateCv, refineCv } from '../../lib/cvApi'
import { renderCvHtml, renderCvWordBlob } from './template'
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
    dataNote: 'How we use your data:',
    privacyLink: 'Privacy',
    termsLink: 'Terms',
    choose: 'Upload your CV',
    extracting: 'Reading your CV…',
    extracted: (n: number) => `Got it — read ${n.toLocaleString()} characters.`,
    tooShort: 'Couldn’t read enough text. Try a text-based PDF or a .docx.',
    extractErr: 'Couldn’t read that file. Try a PDF, .docx or .txt.',
    loginNote: 'Quick sign-in to build it — free, just to keep bots out.',
    build: 'Build my CV',
    building: 'Building your CV…',
    genErr: 'Something went wrong. Please try again.',
    result: 'Your CV',
    pdf: 'Save as PDF',
    word: 'Save as Word',
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
    loginNote: 'تسجيل دخول سريع للبناء — مجاني، فقط لمنع الروبوتات.',
    build: 'ابنِ سيرتي',
    building: 'جارٍ بناء سيرتك…',
    genErr: 'حدث خطأ ما. حاول مرة أخرى.',
    result: 'سيرتك',
    pdf: 'حفظ PDF',
    word: 'حفظ Word',
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

export default function CvGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [idToken, setIdToken] = useState<string | null>(null)
  const [gisReady, setGisReady] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [fileName, setFileName] = useState('')
  const [text, setText] = useState('')
  const [cv, setCv] = useState<Cv | null>(null)
  const [err, setErr] = useState('')
  const [answersLeft, setAnswersLeft] = useState(0)
  const [polishLeft, setPolishLeft] = useState(0)
  const [queue, setQueue] = useState<string[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [changes, setChanges] = useState<string[]>([])
  const [answerText, setAnswerText] = useState('')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState<'' | 'answer' | 'polish'>('')
  const [saveMenu, setSaveMenu] = useState(false)
  const btnRef = useRef<HTMLDivElement>(null)
  const gisRef = useRef<{ renderButton: (el: HTMLElement, o: Record<string, unknown>) => void } | null>(null)
  const activeRef = useRef<HTMLDivElement>(null)

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

  // Generate automatically as soon as we have both the CV text and a signed-in
  // user — no explicit "Build" button needed.
  useEffect(() => {
    if (status === 'ready' && idToken && text) generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, idToken])

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFileName(f.name)
    setErr('')
    setCv(null)
    setStatus('extracting')
    try {
      const { extractText } = await import('./extract')
      const t = await extractText(f)
      if (!t || t.length < 60) { setErr(s.tooShort); setStatus('idle'); return }
      setText(t)
      setStatus('ready')
    } catch {
      setErr(s.extractErr)
      setStatus('idle')
    }
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
      setChanges([])
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
      const r = await refineCv(idToken, cv, `Question: ${currentQ}\nAnswer: ${answerText.trim()}`, 'answer')
      setCv(r.cv)
      setAnswersLeft(r.answersLeft)
      if (r.summary) setChanges((c) => [...c, r.summary])
      setAnswerText('')
      setQIndex((i) => i + 1)
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
      const r = await refineCv(idToken, cv, instruction.trim(), 'polish')
      setCv(r.cv)
      setPolishLeft(r.polishLeft)
      if (r.summary) setChanges((c) => [...c, r.summary])
      setInstruction('')
    } catch (e) {
      setErr((e as Error).message || s.genErr)
    } finally {
      setBusy('')
    }
  }

  function exportPdf() {
    if (!cv) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(renderCvHtml(cv))
    w.document.title = cvFilename(cv)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 500)
  }

  function exportWord() {
    if (!cv) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(renderCvWordBlob(cv))
    a.download = `${cvFilename(cv)}.doc`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  // Full-bleed green intro, docked flush to the navbar (cancels the page's top padding).
  const hero = (
    <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] bg-green-600 text-sand-100">
      <div className="wrap py-[clamp(1.6rem,4.5vw,2.4rem)] flex flex-col gap-3">
        <h1 className="font-display rtl:font-ar text-[clamp(1.5rem,4.5vw,2.1rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{s.heroTitle}</h1>
        <p className="text-[0.98rem] leading-relaxed opacity-90 max-w-[46rem]">{s.heroBody}</p>
        {status === 'idle' && (
          <label className="inline-flex self-start mt-1">
            <input type="file" accept=".pdf,.docx,.txt,.md,text/plain,application/pdf" className="sr-only" onChange={onFile} data-testid="cv-file" />
            <span className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-white text-green-700 px-4 py-2 text-[0.9rem] font-semibold hover:bg-sand-100">
              {s.choose}
            </span>
          </label>
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
          {hero}

          {/* Status (the upload button now lives inside the hero) */}
          {status !== 'idle' && (
            <div className="flex flex-col gap-2">
              {fileName && <span className="text-[0.85rem] text-ink-faint font-mono truncate max-w-[22rem]">{fileName}</span>}
              {status === 'extracting' && <p className="text-[0.85rem] text-ink-faint">{s.extracting}</p>}
              {status === 'generating' && <p className="text-[0.85rem] text-ink-faint">{s.building}</p>}
              {status === 'ready' && text && <p className="text-[0.85rem] text-green-700">{s.extracted(text.length)}</p>}
            </div>
          )}

          {/* Sign-in appears once a CV is ready; generation then starts automatically */}
          {text && !idToken && status !== 'generating' && (
            <div className="flex flex-col gap-2">
              <div ref={btnRef} className="[color-scheme:light]" data-testid="google-signin" />
              <p className="text-[0.8rem] text-ink-faint">{s.loginNote}</p>
            </div>
          )}

          {err && <p className="text-[0.85rem] text-gold-500">{err}</p>}
        </>
      )}

      {status === 'done' && cv && (
        <>
          {/* Immersive full-bleed preview, docked flush to the navbar, scaled to fit */}
          <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)]">
            <iframe
              title={cvFilename(cv)}
              className="block w-full h-[calc(100dvh-11rem)] min-h-[22rem] border-0 bg-[#e9ebef]"
              srcDoc={renderCvHtml(cv, { preview: true })}
            />
          </div>

          {/* Floating Save split-button — bottom-right (bottom-left in RTL), above the dock */}
          <div className="fixed end-4 bottom-[7rem] z-50 flex items-stretch rounded-md shadow-[var(--shadow-md)]">
            <button type="button" onClick={exportPdf} data-testid="cv-pdf"
              className="inline-flex items-center gap-2 rounded-s-md bg-green-600 text-sand-100 px-4 py-2.5 text-[0.9rem] font-semibold hover:bg-green-700 border-0 cursor-pointer">
              <DownloadIcon /> {s.pdf}
            </button>
            <button type="button" aria-label={s.word} aria-expanded={saveMenu} onClick={() => setSaveMenu((v) => !v)}
              className="inline-flex items-center rounded-e-md bg-green-700 text-sand-100 px-2.5 text-base border-0 border-s border-[color:color-mix(in_srgb,var(--sand-100)_30%,transparent)] hover:bg-green-600 cursor-pointer">▾</button>
            {saveMenu && (
              <div className="absolute bottom-full end-0 mb-1.5 bg-[var(--surface)] border border-[color:var(--line)] rounded-md shadow-[var(--shadow-md)] overflow-hidden">
                <button type="button" data-testid="cv-word" onClick={() => { exportWord(); setSaveMenu(false) }}
                  className="flex items-center gap-2 w-full text-start px-4 py-2.5 text-[0.88rem] text-ink-soft hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] border-0 bg-transparent cursor-pointer whitespace-nowrap">
                  <DownloadIcon /> {s.word}
                </button>
              </div>
            )}
          </div>

          {/* Docked interaction bar — one question at a time, else the polish input */}
          <div ref={activeRef} className="fixed inset-x-0 bottom-0 z-40 bg-[var(--surface)] border-t border-[color:var(--line)] shadow-[0_-6px_20px_rgba(20,30,50,0.09)]">
            <div className="wrap py-2.5 flex flex-col gap-2">
              {changes.length > 0 && (
                <p className="flex items-center gap-1.5 text-[0.76rem] text-green-700 truncate" data-testid="cv-changes">
                  <span aria-hidden="true">✓</span>{changes[changes.length - 1]}
                </p>
              )}
              {currentQ ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-green-700">{s.qLabel(qIndex + 1, queue.length)}</span>
                    <button type="button" className="text-[0.78rem] text-ink-faint underline bg-transparent border-0 cursor-pointer p-0" onClick={skip} data-testid="cv-skip">{s.skip}</button>
                  </div>
                  <p className="text-[0.95rem] text-ink leading-snug">{currentQ}</p>
                  <ChatInput value={answerText} setValue={setAnswerText} onSend={answer} placeholder={s.answerPh}
                    busy={busy === 'answer'} sendLabel={busy === 'answer' ? s.sending : s.send} testid="cv-answer" locale={locale} />
                </>
              ) : (
                <>
                  <span className="text-[0.8rem] font-semibold text-ink-soft">{s.polishTitle}</span>
                  {polishLeft > 0 ? (
                    <ChatInput value={instruction} setValue={setInstruction} onSend={polish} placeholder={s.polishPh}
                      busy={busy === 'polish'} sendLabel={busy === 'polish' ? s.applying : s.apply} testid="cv-instruction" locale={locale} />
                  ) : (
                    <p className="text-[0.8rem] text-ink-faint">{s.noPolish}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {err && <p className="fixed inset-x-0 bottom-1 text-center text-[0.8rem] text-gold-500 z-50">{err}</p>}
        </>
      )}

      {status !== 'done' && dataLinks}
    </Stack>
  )
}
