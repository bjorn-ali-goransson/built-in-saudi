import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useLocale, localePath } from '../../i18n'
import { Button, Textarea, Stack, Spinner, Sheet, SheetTitle, SheetActions, Check } from '../../components/ui'
import { DownloadIcon, BookmarkIcon, CloudIcon } from '../../components/icons'
import { loadGis, GOOGLE_CLIENT_ID, decodeJwt, generateCv, tailorCv, saveCvServer, getSavedCv, deleteCvServer } from '../../lib/cvApi'
import { hideFooterStore } from '../../lib/hideFooter'
import { cvHeaderStore } from '../../lib/cvHeader'
import { inAppBrowser } from '../../lib/inAppBrowser'
import { renderCvHtml } from './template'
import { cvToDocxBlob } from './docx'
import { cvFilename, type Cv } from './schema'

const STR = {
  en: {
    heroTitle: 'Optimize your CV',
    heroBody: 'This tool rewrites the CV you already have and asks a couple of quick questions to fill any gaps.',
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
    readyTitle: 'Your CV is ready to generate',
    readyBody: 'We’ll rewrite it into a clean, recruiter-ready CV. You’ll need to sign in first.',
    readyNote: 'Free — signing in just keeps bots out.',
    build: 'Build my CV',
    building: 'Building your CV…',
    steps: ['Reading your CV…', 'Highlighting your impact…', 'Trimming the noise…', 'Tuning it for the 10-second scan…', 'Formatting your new CV…'],
    genErr: 'Something went wrong. Please try again.',
    result: 'Your CV',
    pdf: 'Save as PDF',
    word: 'Save as Word',
    optimized: 'Optimized',
    original: 'Original',
    generated: 'Generated',
    tailored: 'Tailored',
    fullscreen: 'Fullscreen',
    exitFs: 'Exit fullscreen',
    saveOptions: 'Save options',
    saveForLater: 'Save for later',
    savedForLater: 'Saved on this device — resume it anytime.',
    resumeSaved: 'Resume your saved CV',
    customizeJd: 'Customize for JD',
    jdTitle: 'Customize for a job',
    jdBody: 'Paste the full job description and we’ll tailor this CV to it — reordering and re-emphasising what matters for this role. We never add experience you don’t already have.',
    jdPh: 'Paste the job description here…',
    jdSubmit: 'Tailor my CV',
    jdWorking: 'Tailoring…',
    jdDone: 'Tailored to the job — use the switch to compare with your generated CV.',
    serverSaveTitle: 'Save for later',
    serverSaveBody: 'You’ll be able to open your CV from any device and tailor it to specific job descriptions. It’s kept for 6 months, and you can delete your data anytime on the',
    privacyWord: 'Privacy page',
    serverSaveTail: '.',
    serverSaveBtn: 'Save',
    cancel: 'Cancel',
    serverSaving: 'Saving…',
    serverSavedMsg: 'Saved to your account — resume it on any device.',
    save: 'Save',
    dlPdf: 'Download PDF',
    dlWord: 'Download Word',
    customize: 'Customize',
    targetJd: 'Apply job description',
    jdSaveNote: 'When you customise, your CV is saved to your account so you can reopen it on any device — kept 6 months, and you can delete it anytime on the',
    shortenTitle: 'Make it shorter',
    shortenLead: 'A tighter CV lands better — recruiters skim in seconds. Condense to:',
    pagesWord: (n: number) => `${n} page${n > 1 ? 's' : ''}`,
    shortenBtn: 'Shorten',
    shortening: 'Shortening…',
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
    shortHint: 'Your CV fills less than a page — add more detail?',
    addDetail: 'Add detail',
    adding: 'Adding…',
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
    inAppWarn: (app: string) => `أنت داخل متصفح ${app}، الذي لا يستطيع قراءة ملفات PDF هنا. افتح الصفحة في Safari أو Chrome — اضغط ⋯ (أو مشاركة) واختر «فتح في المتصفح».`,
    browserErr: 'حدث خطأ أثناء قراءة ملفك. قد يحدث هذا في متصفح قديم أو في متصفح تطبيق مُضمَّن (مثل LinkedIn). افتح الصفحة في متصفح كامل وحاول مجددًا.',
    openInBrowser: 'افتح في متصفح',
    linkCopied: 'نُسخ الرابط — الصقه في Safari أو Chrome.',
    loginNote: 'تسجيل دخول سريع للبناء — مجاني، فقط لمنع الروبوتات.',
    readyTitle: 'سيرتك جاهزة للتحويل',
    readyBody: 'سنعيد كتابتها في سيرة أنيقة جاهزة لمسؤول التوظيف. عليك تسجيل الدخول أولًا.',
    readyNote: 'مجاني — تسجيل الدخول فقط لمنع الروبوتات.',
    build: 'ابنِ سيرتي',
    building: 'جارٍ بناء سيرتك…',
    steps: ['نقرأ سيرتك…', 'نُبرز إنجازاتك…', 'نحذف الحشو…', 'نضبطها لمسحٍ في ١٠ ثوانٍ…', 'ننسّق سيرتك الجديدة…'],
    genErr: 'حدث خطأ ما. حاول مرة أخرى.',
    result: 'سيرتك',
    pdf: 'حفظ PDF',
    word: 'حفظ Word',
    optimized: 'المُحسّنة',
    original: 'الأصلية',
    generated: 'المُنشأة',
    tailored: 'المُخصّصة',
    fullscreen: 'ملء الشاشة',
    exitFs: 'إنهاء ملء الشاشة',
    saveOptions: 'خيارات الحفظ',
    saveForLater: 'احفظ للاحقًا',
    savedForLater: 'حُفظت على هذا الجهاز — استأنفها متى شئت.',
    resumeSaved: 'استأنف سيرتك المحفوظة',
    customizeJd: 'خصّص للوظيفة',
    jdTitle: 'خصّص لوظيفة',
    jdBody: 'الصق الوصف الوظيفي كاملًا وسنخصّص هذه السيرة له — بإعادة الترتيب وإبراز ما يهم هذه الوظيفة. لا نضيف أبدًا خبرة لا تملكها.',
    jdPh: 'الصق الوصف الوظيفي هنا…',
    jdSubmit: 'خصّص سيرتي',
    jdWorking: 'جارٍ التخصيص…',
    jdDone: 'خُصّصت للوظيفة — استخدم المُبدّل للمقارنة بسيرتك المُنشأة.',
    serverSaveTitle: 'احفظ للاحقًا',
    serverSaveBody: 'ستتمكن من فتح سيرتك من أي جهاز وتخصيصها لوصف وظيفي محدد. تُحفظ لمدة ٦ أشهر، ويمكنك حذف بياناتك في أي وقت من',
    privacyWord: 'صفحة الخصوصية',
    serverSaveTail: '.',
    serverSaveBtn: 'حفظ',
    cancel: 'إلغاء',
    serverSaving: 'جارٍ الحفظ…',
    serverSavedMsg: 'حُفظت في حسابك — استأنفها على أي جهاز.',
    save: 'حفظ',
    dlPdf: 'تنزيل PDF',
    dlWord: 'تنزيل Word',
    customize: 'تخصيص',
    targetJd: 'طبّق الوصف الوظيفي',
    jdSaveNote: 'عند التخصيص، تُحفظ سيرتك في حسابك لتفتحها من أي جهاز — لمدة ٦ أشهر، ويمكنك حذفها في أي وقت من',
    shortenTitle: 'اجعلها أقصر',
    shortenLead: 'السيرة الأقصر أفضل — يمسح المسؤولون بسرعة. اختصر إلى:',
    pagesWord: (n: number) => `${n} صفحة`,
    shortenBtn: 'اختصار',
    shortening: 'جارٍ الاختصار…',
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
    shortHint: 'سيرتك تملأ أقل من صفحة — أضف مزيدًا من التفاصيل؟',
    addDetail: 'أضف تفاصيل',
    adding: 'جارٍ الإضافة…',
    startOver: 'ابدأ من جديد',
    signinErr: 'تعذّر تحميل تسجيل دخول جوجل. عطّل المانعات وأعد المحاولة.',
    voice: 'إدخال صوتي',
  },
}

type Status = 'idle' | 'extracting' | 'ready' | 'generating' | 'done'


/** The uploaded PDF rendered as page images (reliable everywhere, unlike an
 *  <iframe> that depends on the browser's native PDF viewer). */
function PdfPages({ pages, className = '', cover = false }: { pages: string[]; className?: string; cover?: boolean }) {
  // `cover`: fill the whole area with the first page (used as the blurred
  // backdrop behind the sign-in / generating card, so there's no white gap).
  if (cover) {
    return (
      <div className={`overflow-hidden bg-[#e9ebef] ${className}`}>
        {pages[0] && <img src={pages[0]} alt="" className="w-full h-full object-cover object-top" />}
      </div>
    )
  }
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
  const [toast, setToast] = useState('')
  const [loadingStep, setLoadingStep] = useState(0)
  // A CV the user saved to this device to finish later.
  const [saved, setSaved] = useState<Cv | null>(() => {
    try { const r = localStorage.getItem('bis-cv-saved'); return r ? (JSON.parse(r).cv as Cv) : null } catch { return null }
  })
  const [saveMenu, setSaveMenu] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [signinFallback, setSigninFallback] = useState(false) // show the Google button when One-Tap can't display
  const [showAlt, setShowAlt] = useState(false) // preview shows the alternate view (tailored CV, or the uploaded original)
  const [fs, setFs] = useState(false) // preview is in browser fullscreen
  const [origPages, setOrigPages] = useState<string[]>([]) // uploaded PDF rendered to page images (for loading + the "Original" flip)
  const [tailoredCv, setTailoredCv] = useState<Cv | null>(null) // JD-tailored version (ephemeral; not persisted)
  const [jdOpen, setJdOpen] = useState(false)
  const [jdText, setJdText] = useState('')
  const [jdBusy, setJdBusy] = useState(false)
  const [serverSaving, setServerSaving] = useState(false)
  const [serverSaved, setServerSaved] = useState(false) // this CV is saved to the account
  const previewRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLDivElement>(null)
  const gisRef = useRef<Awaited<ReturnType<typeof loadGis>> | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Guards the auto-generate effect so a failed generation never re-triggers it
  // (which would hammer the API). Reset only when a new file is uploaded.
  const autoTried = useRef(false)
  // The previous change summary, sent as context so the user can correct it.
  const lastChangeRef = useRef('')
  const pendingActionRef = useRef<'' | 'save' | 'tailor'>('') // finish this after a sign-in

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

  // The big green CTA drives sign-in via One-Tap; only if that can't display do
  // we fall back to the rendered Google button.
  function startGenerate() {
    setSigninFallback(false)
    try {
      gisRef.current?.prompt((n: unknown) => {
        const m = n as { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean }
        if (m && (m.isNotDisplayed?.() || m.isSkippedMoment?.())) setSigninFallback(true)
      })
    } catch { setSigninFallback(true) }
  }

  // Render the fallback Google button when One-Tap couldn't show.
  useEffect(() => {
    if (signinFallback && gisReady && !idToken && btnRef.current && gisRef.current) {
      btnRef.current.innerHTML = ''
      gisRef.current.renderButton(btnRef.current, { theme: 'filled_blue', size: 'large', text: 'continue_with', shape: 'pill' })
    }
  }, [signinFallback, gisReady, idToken, status, origPages])

  // Navbar Log in / Log out (rendered by the shared Header via cvHeaderStore).
  const login = useCallback(() => { try { gisRef.current?.prompt() } catch { /* ignore */ } }, [])
  const logout = useCallback(() => { setIdToken(null); try { gisRef.current?.disableAutoSelect() } catch { /* ignore */ } }, [])
  useEffect(() => { cvHeaderStore.set({ active: true, signedIn: !!idToken, login, logout }) }, [idToken, login, logout])
  useEffect(() => () => cvHeaderStore.set({ active: false, signedIn: false, login: () => {}, logout: () => {} }), [])

  // On sign-in, finish whatever the user was doing (save / customise), or pull
  // any server-saved CV to enable Resume + auto-resume from the landing.
  useEffect(() => {
    if (!idToken) return
    if (pendingActionRef.current && cv) {
      const act = pendingActionRef.current
      pendingActionRef.current = ''
      if (act === 'save') doServerSave()
      else if (act === 'tailor') setJdOpen(true)
      return
    }
    let cancelled = false
    getSavedCv(idToken).then((serverCv) => {
      if (cancelled || !serverCv) return
      setSaved(serverCv)
      if (status === 'idle' && !cv && !text) {
        setCv(serverCv); setTailoredCv(null); setShowAlt(false); setOrigPages([])
        setServerSaved(true); setStatus('done')
      }
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken])

  // Hide the site footer while the immersive result preview is on screen, and
  // lock document scroll: the done view is a full-screen preview + a fixed bottom
  // bar, so the page must not scroll (stray padding / dvh quirks below the
  // preview were producing a huge blank scroll area). Lock <html> (modals lock
  // <body>, so the two don't fight).
  useEffect(() => {
    hideFooterStore.set(status === 'done')
    const root = document.documentElement
    const prev = root.style.overflow
    if (status === 'done') root.style.overflow = 'hidden'
    else root.style.overflow = prev
    return () => { hideFooterStore.set(false); root.style.overflow = '' }
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
    setShowAlt(false)
    setTailoredCv(null)
    setServerSaved(false)
    setSigninFallback(false)
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
      setTailoredCv(null)
      setShowAlt(false)
      setServerSaved(false)
      setToast('')
      lastChangeRef.current = ''
      setStatus('done')
    } catch (e) {
      setErr((e as Error).message || s.genErr)
      setStatus('ready')
    }
  }

  // The CV currently on screen — the tailored version when the user is viewing
  // it, else the generated one. Downloads and "save" act on what you see.
  const activeCv = tailoredCv && showAlt ? tailoredCv : cv
  // What the preview switch compares against the generated CV: the tailored
  // version once it exists (it wins over the original), else the uploaded
  // original (only available right after an upload). Null → no switch shown.
  const altKind: 'tailored' | 'original' | null = tailoredCv ? 'tailored' : origPages.length > 0 ? 'original' : null

  async function exportPdf() {
    if (!activeCv || pdfBusy) return
    setPdfBusy(true)
    try {
      const { cvToPdfBlob } = await import('./CvPdf')
      const blob = await cvToPdfBlob(activeCv)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${cvFilename(activeCv)}.pdf`
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
    if (!activeCv) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(cvToDocxBlob(activeCv))
    a.download = `${cvFilename(activeCv)}.docx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  function writeLocal(next: Cv) {
    try { localStorage.setItem('bis-cv-saved', JSON.stringify({ cv: next, savedAt: Date.now() })) } catch { /* storage full */ }
    setSaved(next)
  }

  // "Save for later" checkbox → save to the account (server) so the CV can be
  // resumed on any device. Checking opens the opt-in dialog; unchecking removes
  // the saved copy. Also cached in localStorage so the device Resume works.
  function onSaveForLater(on: boolean) {
    if (!cv) return
    setSaveMenu(false)
    if (on) {
      if (idToken) doServerSave()
      else { pendingActionRef.current = 'save'; login() } // sign in, then save
    } else if (serverSaved) {
      setServerSaved(false)
      if (idToken) deleteCvServer(idToken)
      try { localStorage.removeItem('bis-cv-saved') } catch { /* ignore */ }
      setSaved(null)
    }
  }

  async function doServerSave() {
    if (!idToken || !cv || serverSaving) return
    setServerSaving(true)
    setErr('')
    try {
      await saveCvServer(idToken, cv)
      writeLocal(cv)
      setServerSaved(true)
      setToast(s.serverSavedMsg)
    } catch (e) {
      setErr((e as Error).message || s.genErr)
    } finally {
      setServerSaving(false)
    }
  }

  // Tailor the CV to a pasted job description. Customising also saves the CV to
  // the account (so it can be reopened), which the JD dialog tells the user.
  async function tailor() {
    if (!idToken || !cv || !jdText.trim() || jdBusy) return
    setJdBusy(true)
    setErr('')
    try {
      // Save the base CV to the account as part of customising.
      try { await saveCvServer(idToken, cv); writeLocal(cv); setServerSaved(true) } catch { /* non-fatal */ }
      const r = await tailorCv(idToken, cv, jdText.trim())
      setTailoredCv(r.cv)
      setShowAlt(true)
      setJdOpen(false)
      setToast(s.jdDone)
    } catch (e) {
      setErr((e as Error).message || s.genErr)
    } finally {
      setJdBusy(false)
    }
  }

  function resumeSaved() {
    if (!saved) return
    setCv(saved)
    // A restored CV has no original upload and no tailored version — the preview
    // switch stays hidden until the user customises for a job. It came from a
    // saved copy, so the "Save for later" box shows checked.
    setTailoredCv(null)
    setShowAlt(false)
    setOrigPages([])
    setServerSaved(true)
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

  // Shown over the (softly blurred) uploaded CV once it's read: the CV is ready,
  // sign in to generate it. The Google button (btnRef) is the real CTA — clicking
  // it signs in, which auto-starts generation.
  const readyCard = (
    <div className="absolute inset-0 z-10 grid place-items-center p-4">
      <div className="w-[min(92vw,26rem)] bg-[var(--surface)] rounded-lg shadow-[var(--shadow-md)] border border-[color:var(--line)] p-6 flex flex-col items-center gap-4 text-center animate-[fadeUp_0.25s_ease]">
        <h3 className="font-display rtl:font-ar text-[1.25rem] font-semibold text-ink leading-tight">{s.readyTitle}</h3>
        <p className="text-[0.92rem] text-ink-soft leading-relaxed">{s.readyBody}</p>
        <button type="button" onClick={startGenerate} data-testid="cv-generate-cta"
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-green-600 text-sand-100 px-4 py-3 text-[1rem] font-semibold hover:bg-green-700 border-0 cursor-pointer shadow-[var(--shadow-sm)]">
          {s.build}
        </button>
        {signinFallback && <div ref={btnRef} className="[color-scheme:light]" data-testid="google-signin" />}
        <p className="text-[0.78rem] text-ink-faint">{s.readyNote}</p>
      </div>
    </div>
  )


  return (
    <Stack data-testid="cv-generator">
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

          {/* Blurred PDF backdrop — while generating (scan beam), or during the
              brief signed-in "ready" moment before auto-generate kicks in.
              FIXED + portaled to <body> so it fills the screen and flows straight
              into the done preview (also fixed), with no in-flow 100dvh element
              leaving a scrollable gap. (The mobile zoom-out root cause was a
              separate GIS off-screen element — see overflow-x: clip in theme.css.) */}
          {origPages.length > 0 && (status === 'generating' || (status === 'ready' && !!idToken)) && createPortal(
            <div className="fixed inset-x-0 bottom-0 top-[68px] max-[560px]:top-[60px] z-30 overflow-hidden" data-testid="cv-loading">
              <PdfPages pages={origPages} cover className={`absolute inset-0 transition-[filter,transform] duration-500 ${status === 'generating' ? 'blur-[7px] scale-[1.03]' : ''}`} />
              {status === 'generating' && (
                <>
                  <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[color-mix(in_srgb,var(--sand-50)_35%,transparent)]" />
                  <div aria-hidden="true" className="absolute inset-x-0 top-0 h-24 pointer-events-none blur-[2px] bg-[linear-gradient(to_bottom,transparent,color-mix(in_srgb,var(--green-500)_45%,transparent),color-mix(in_srgb,var(--green-300)_60%,transparent),color-mix(in_srgb,var(--green-500)_45%,transparent),transparent)] animate-[cvscan_2.4s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
                  <div className="absolute inset-x-0 bottom-6 flex justify-center px-4 pointer-events-none">
                    <span className="inline-flex items-center gap-2.5 rounded-full bg-[var(--ink)] text-sand-100 px-4 py-2 text-[0.92rem] font-semibold shadow-[var(--shadow-md)]">
                      <Spinner className="size-[1.1rem]" label={s.building} />
                      <span key={loadingStep} className="animate-[fadeUp_0.4s_ease]">{s.steps[loadingStep]}</span>
                    </span>
                  </div>
                </>
              )}
            </div>,
            document.body,
          )}
          {(status === 'generating' || (status === 'ready' && !!idToken)) && origPages.length === 0 && (
            <div className="py-24 flex flex-col items-center gap-4" data-testid="cv-loading">
              <Spinner className="size-9" label={s.building} />
              <span key={loadingStep} className="text-[0.95rem] font-medium text-ink-soft animate-[fadeUp_0.4s_ease]">{s.steps[loadingStep]}</span>
            </div>
          )}

          {/* Ready + not signed in: the sign-in card, over the softly blurred PDF
              once it's ready. FIXED + portaled (same overflow reason as above).
              One stable container so the card never remounts when the PDF pages
              finish loading (was causing a flash). */}
          {status === 'ready' && !idToken && createPortal(
            <div className="fixed inset-x-0 bottom-0 top-[68px] max-[560px]:top-[60px] z-30 overflow-hidden bg-[#e9ebef]" data-testid="cv-loading">
              {origPages.length > 0 && (
                <>
                  <PdfPages pages={origPages} cover className="absolute inset-0 blur-[3px] scale-[1.01]" />
                  <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[color-mix(in_srgb,var(--sand-50)_30%,transparent)]" />
                </>
              )}
              {readyCard}
            </div>,
            document.body,
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

      {status === 'done' && cv && (
        <>
          {/* Immersive preview as a FIXED layer below the navbar (not in flow), so
              the page has nothing to scroll — mobile `100dvh` + touch-scroll used to
              leave a huge scrollable gray area. Portaled to <body> so ToolPage's
              transform doesn't make `fixed` resolve against the (tiny) tool box. */}
          {createPortal(
          <div ref={previewRef} className={`overflow-hidden bg-[#e9ebef] ${fs ? 'fixed inset-0 z-50' : 'fixed inset-x-0 bottom-0 top-[68px] max-[560px]:top-[60px] z-30'}`}>
            <iframe
              ref={iframeRef}
              title={cvFilename(activeCv || cv)}
              className="block w-full h-full border-0 bg-[#e9ebef]"
              srcDoc={renderCvHtml(tailoredCv && showAlt ? tailoredCv : cv, { preview: true })}
            />
            {showAlt && altKind === 'original' && origPages.length > 0 && (
              <PdfPages pages={origPages} className="absolute inset-0 h-full" />
            )}

            {/* Controls live INSIDE the preview. Constrained to the content column
                (max --wrap, centred) so on a wide desktop they align to the page,
                not the far screen edges. pointer-events pass through to the iframe. */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="relative h-full mx-auto max-w-[var(--wrap)] [&>*]:pointer-events-auto">
            {/* View switch (top-left): generated↔tailored after customising, or
                optimized↔original for a fresh upload. Hidden with nothing to compare. */}
            {altKind && (
              <div className="absolute start-3 top-3 z-10 flex items-stretch rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)] overflow-hidden text-[0.82rem] font-semibold">
                <button type="button" data-testid="cv-view-optimized" onClick={() => setShowAlt(false)} className={`px-3 py-1.5 border-0 cursor-pointer ${!showAlt ? 'bg-green-600 text-sand-100' : 'bg-transparent text-ink-soft hover:bg-sand-100'}`}>{altKind === 'tailored' ? s.generated : s.optimized}</button>
                <button type="button" data-testid="cv-view-original" onClick={() => setShowAlt(true)} className={`px-3 py-1.5 border-0 border-s border-[color:var(--line)] cursor-pointer ${showAlt ? 'bg-green-600 text-sand-100' : 'bg-transparent text-ink-soft hover:bg-sand-100'}`}>{altKind === 'tailored' ? s.tailored : s.original}</button>
              </div>
            )}

            {/* Save (bottom-left): a green CTA opening downloads + Save-for-later. */}
            <div className="absolute start-3 bottom-3 z-10">
              {saveMenu && (
                <div className="absolute bottom-full start-0 mb-1.5 bg-[var(--surface)] border border-[color:var(--line)] rounded-md shadow-[var(--shadow-md)] overflow-hidden min-w-[13rem]">
                  <button type="button" data-testid="cv-pdf" disabled={pdfBusy} onClick={exportPdf}
                    className="flex items-center gap-2 w-full text-start px-4 py-2.5 text-[0.88rem] text-ink-soft hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] border-0 bg-transparent cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-wait">
                    {pdfBusy ? <Spinner className="size-4" /> : <DownloadIcon />} {s.dlPdf}
                  </button>
                  <button type="button" data-testid="cv-word" onClick={() => { exportWord(); setSaveMenu(false) }}
                    className="flex items-center gap-2 w-full text-start px-4 py-2.5 text-[0.88rem] text-ink-soft hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] border-0 bg-transparent cursor-pointer whitespace-nowrap">
                    <DownloadIcon /> {s.dlWord}
                  </button>
                  <Check className="w-full px-4 py-2.5 border-t border-[color:var(--line-soft)] whitespace-nowrap">
                    <input type="checkbox" checked={serverSaved} onChange={(e) => onSaveForLater(e.target.checked)} data-testid="cv-save-later" />
                    <span>{s.saveForLater}</span>
                    {serverSaved && <CloudIcon className="w-4 h-4 text-green-600" />}
                  </Check>
                </div>
              )}
              <button type="button" onClick={() => setSaveMenu((v) => !v)} aria-expanded={saveMenu} data-testid="cv-save-menu"
                className="inline-flex items-center gap-1.5 h-9 rounded-md bg-green-600 text-sand-100 px-3.5 text-[0.88rem] font-semibold shadow-[var(--shadow-md)] hover:bg-green-700 border-0 cursor-pointer">
                <DownloadIcon className="size-4" /> {s.save}
              </button>
            </div>

            {/* Customize (bottom-right): Insert JD / Tell me what to change / Make shorter. */}
            {/* Target job description (bottom-right): tailor the CV to a JD. Requires
                the CV to be saved first (so it can be reopened + tailored later). */}
            <button type="button" data-testid="cv-target-jd" onClick={() => { setSaveMenu(false); setErr(''); if (idToken) setJdOpen(true); else { pendingActionRef.current = 'tailor'; login() } }}
              className="absolute end-3 bottom-3 z-10 inline-flex items-center gap-1.5 h-9 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft px-3.5 text-[0.88rem] font-semibold shadow-[var(--shadow-md)] hover:text-green-700 cursor-pointer">
              {s.targetJd}
            </button>

            <button type="button" onClick={toggleFullscreen} data-testid="cv-fullscreen" aria-label={fs ? s.exitFs : s.fullscreen} title={fs ? s.exitFs : s.fullscreen}
              className="absolute end-3 top-3 z-10 grid place-items-center size-9 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft shadow-[var(--shadow-md)] hover:text-green-700 cursor-pointer">
              {fs
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[1.15rem]" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[1.15rem]" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>}
            </button>
              </div>
            </div>
          </div>,
          document.body,
          )}

          {jdOpen && (
            <Sheet onClose={() => { if (!jdBusy) setJdOpen(false) }}>
              <SheetTitle>{s.jdTitle}</SheetTitle>
              <p className="text-[0.9rem] text-ink-soft leading-relaxed">{s.jdBody}</p>
              <Textarea value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder={s.jdPh}
                data-testid="cv-jd-text" className="min-h-[34vh] resize-y" autoFocus />
              <p className="text-[0.78rem] text-ink-faint leading-relaxed">
                {s.jdSaveNote}{' '}
                <Link to={localePath(locale, '/privacy')} className="underline hover:text-green-600">{s.privacyWord}</Link>{s.serverSaveTail}
              </p>
              {err && <p className="text-[0.85rem] text-gold-500" data-testid="cv-jd-err">{err}</p>}
              <SheetActions>
                <Button variant="primary" onClick={tailor} disabled={jdBusy || jdText.trim().length < 40} data-testid="cv-jd-submit">
                  {jdBusy ? s.jdWorking : s.jdSubmit}
                </Button>
              </SheetActions>
            </Sheet>
          )}
        </>
      )}

      {toast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[min(90vw,32rem)] flex items-start gap-2.5 bg-green-600 text-sand-100 px-5 py-3.5 rounded-lg shadow-[var(--shadow-md)] text-[0.92rem] leading-snug animate-[fadeUp_0.3s_ease]" role="status" data-testid="cv-toast">
          <span aria-hidden="true" className="mt-0.5">✓</span><span>{toast}</span>
        </div>
      )}
    </Stack>
  )
}
