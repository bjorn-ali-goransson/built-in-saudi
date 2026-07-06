import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLocale } from '../../i18n'
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
    word: 'Download Word',
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
    word: 'تنزيل Word',
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

  function startOver() {
    setCv(null)
    setText('')
    setFileName('')
    setQueue([])
    setQIndex(0)
    setChanges([])
    setAnswerText('')
    setInstruction('')
    setErr('')
    setStatus('idle')
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
      <div className="wrap py-[clamp(1.6rem,4.5vw,2.4rem)] flex flex-col gap-2">
        <h1 className="font-display rtl:font-ar text-[clamp(1.5rem,4.5vw,2.1rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{s.heroTitle}</h1>
        <p className="text-[0.98rem] leading-relaxed opacity-90 max-w-[46rem]">{s.heroBody}</p>
      </div>
    </div>
  )

  return (
    <Stack data-testid="cv-generator">
      {status !== 'done' && (
        <>
          {hero}

          {/* Upload — before any sign-in */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex">
                <input type="file" accept=".pdf,.docx,.txt,.md,text/plain,application/pdf" className="sr-only" onChange={onFile} data-testid="cv-file" />
                <span className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-4 py-2 text-[0.9rem] font-semibold text-ink-soft hover:border-green-600 hover:text-green-700">
                  {s.choose}
                </span>
              </label>
              {fileName && <span className="text-[0.85rem] text-ink-faint font-mono truncate max-w-[16rem]">{fileName}</span>}
            </div>
            {status === 'extracting' && <p className="text-[0.85rem] text-ink-faint">{s.extracting}</p>}
            {text && status !== 'extracting' && <p className="text-[0.85rem] text-green-700">{s.extracted(text.length)}</p>}
          </div>

          {/* Sign-in appears only once a CV is ready — kept minimal */}
          {text && !idToken && (
            <div className="flex flex-col gap-2">
              <div ref={btnRef} className="[color-scheme:light]" data-testid="google-signin" />
              <p className="text-[0.8rem] text-ink-faint">{s.loginNote}</p>
            </div>
          )}

          {/* Build */}
          {text && idToken && (
            <Button variant="primary" className="self-start" onClick={generate} disabled={status === 'generating'} data-testid="cv-generate">
              {status === 'generating' ? s.building : s.build}
            </Button>
          )}

          {err && <p className="text-[0.85rem] text-gold-500">{err}</p>}
        </>
      )}

      {status === 'done' && cv && (
        <>
          {/* Live preview + export */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]">{s.result}</span>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={exportPdf} data-testid="cv-pdf"><DownloadIcon /> {s.pdf}</Button>
              <Button onClick={exportWord} data-testid="cv-word"><DownloadIcon /> {s.word}</Button>
              <Button onClick={startOver} data-testid="cv-startover">{s.startOver}</Button>
            </div>
          </div>
          <iframe
            title={s.result}
            className="w-full h-[75vh] rounded-md border border-[color:var(--line-soft)] bg-white"
            srcDoc={renderCvHtml(cv)}
          />

          {/* Log of what was changed (question + literal answer collapse to this) */}
          {changes.length > 0 && (
            <div className="flex flex-col gap-1.5" data-testid="cv-changes">
              <span className="text-[0.74rem] font-semibold uppercase tracking-[0.12em] text-ink-faint">{s.changesTitle}</span>
              <ul className="flex flex-col gap-1">
                {changes.map((c, i) => (
                  <li key={i} className="flex gap-2 text-[0.88rem] text-ink-soft"><span className="text-green-600 flex-none">✓</span>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Active section: one question at a time, else the polish box. Full-width bands. */}
          <div ref={activeRef}>
            {currentQ ? (
              <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] bg-[color-mix(in_srgb,var(--green-400)_9%,transparent)] border-y border-[color:var(--line-soft)]" data-testid="cv-question">
                <div className="wrap py-[1.3rem] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.74rem] font-semibold uppercase tracking-[0.12em] text-green-700">{s.qLabel(qIndex + 1, queue.length)}</span>
                    <span className="text-[0.78rem] text-ink-faint">{s.answersLeftL(answersLeft)}</span>
                  </div>
                  <p className="font-display rtl:font-ar text-[1.1rem] text-ink leading-snug">{currentQ}</p>
                  <ChatInput value={answerText} setValue={setAnswerText} onSend={answer} placeholder={s.answerPh}
                    busy={busy === 'answer'} sendLabel={busy === 'answer' ? s.sending : s.send} testid="cv-answer" locale={locale} />
                  <button type="button" className="self-start text-[0.8rem] text-ink-faint underline bg-transparent border-0 cursor-pointer p-0" onClick={skip} data-testid="cv-skip">{s.skip}</button>
                </div>
              </div>
            ) : (
              <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] bg-[color-mix(in_srgb,var(--sand-100)_55%,transparent)] border-y border-[color:var(--line-soft)]" data-testid="cv-polish">
                <div className="wrap py-[1.3rem] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.82rem] font-semibold text-ink-soft">{s.polishTitle}</span>
                    {polishLeft > 0 && <span className="text-[0.78rem] text-ink-faint">{s.polishLeftL(polishLeft)}</span>}
                  </div>
                  {polishLeft > 0 ? (
                    <ChatInput value={instruction} setValue={setInstruction} onSend={polish} placeholder={s.polishPh}
                      busy={busy === 'polish'} sendLabel={busy === 'polish' ? s.applying : s.apply} testid="cv-instruction" locale={locale} />
                  ) : (
                    <p className="text-[0.82rem] text-ink-faint">{s.noPolish}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {err && <p className="text-[0.85rem] text-gold-500">{err}</p>}
        </>
      )}
    </Stack>
  )
}
