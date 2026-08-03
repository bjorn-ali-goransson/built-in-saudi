import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../i18n'
import { Button, Stack, Spinner } from '../../components/ui'
import { DownloadIcon } from '../../components/icons'
import { loadGis, GOOGLE_CLIENT_ID, decodeJwt, generateCv, improveCv, type CvIssue, type CvGap, type CvAts } from '../../lib/cvApi'
import { hideFooterStore } from '../../lib/hideFooter'
import { cvHeaderStore } from '../../lib/cvHeader'
import { inAppBrowser } from '../../lib/inAppBrowser'
import { renderCvHtml } from './template'
import { cvToDocxBlob } from './docx'
import { cvFilename, type Cv } from './schema'

const STR = {
  en: {
    heroTitle: 'Optimize your CV for ATS',
    heroBody: 'This tool rewrites the CV you already have, scores it for ATS (the software that screens résumés), and flags anything only you can fix before a recruiter sees it.',
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
    readyTitle: 'Your CV is ready to optimize',
    readyBody: 'We’ll rewrite it clean and ATS-ready, score it for the 10-second recruiter scan, and flag what only you can fix.',
    readyNote: 'Free — signing in just keeps bots out.',
    build: 'Sign in and optimize your CV for ATS',
    building: 'Optimizing your CV…',
    steps: ['Reading your CV…', 'Highlighting your impact…', 'Trimming the noise…', 'Tuning it for the 10-second scan…', 'Formatting your new CV…'],
    genErr: 'Something went wrong. Please try again.',
    result: 'Your CV',
    pdf: 'Save as PDF',
    word: 'Save as Word',
    optimized: 'Optimized',
    original: 'Original',
    fullscreen: 'Fullscreen',
    exitFs: 'Exit fullscreen',
    saveOptions: 'Save options',
    issuesTitle: 'Before you look',
    issuesLead: (n: number) => `We rebuilt your CV, but ${n === 1 ? 'one thing needs' : `${n} things need`} you — we can’t invent facts. Fix these and it will land much harder.`,
    issuesOk: 'Show my CV',
    sevHigh: 'Critical',
    sevMedium: 'Important',
    sevLow: 'Minor',
    cancel: 'Cancel',
    save: 'Save',
    dlPdf: 'Download PDF',
    dlWord: 'Download Word',
    shortenTitle: 'Make it shorter',
    shortenLead: 'A tighter CV lands better — recruiters skim in seconds. Condense to:',
    pagesWord: (n: number) => `${n} page${n > 1 ? 's' : ''}`,
    shortenBtn: 'Shorten',
    shortening: 'Shortening…',
    changesTitle: 'Improvements made',
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
    atsTitle: 'Your ATS score',
    atsLead: 'How your rebuilt CV scores for the ATS (Applicant Tracking System) and a recruiter’s 10-second scan.',
    ats: 'ATS',
    overall: 'Overall',
    scale: '1 = weak · 5 = strong',
    heatLow: 'weak',
    heatHigh: 'strong',
    issuesHead: 'What needs you',
    fixCta: 'Answer this',
    questionsHead: 'Answer to raise your ATS score',
    questionsLead: 'Only you can fill these in — add a number where you can (e.g. “cut costs ~15%”). The AI folds your answers in and re-scores. Leave any blank.',
    gapPlaceholder: 'Your answer — a sentence or two',
    pctPlaceholder: 'e.g. 15',
    exportReport: 'Export report (PDF)',
    optional: 'optional',
    improveBtn: 'Improve my CV',
    improving: 'Improving…',
    improveLeftL: (n: number) => `${n} improve round${n === 1 ? '' : 's'} left`,
    noImprove: 'No improve rounds left for this CV — upload again to start fresh.',
    showCv: 'Show my CV',
    improveErr: 'Couldn’t improve the CV. Please try again.',
    answerOne: 'Answer at least one question first.',
    changed: 'CV improved',
  },
  ar: {
    heroTitle: 'حسّن سيرتك لأنظمة ATS',
    heroBody: 'تعيد هذه الأداة كتابة سيرتك الحالية، وتقيّمها لأنظمة تتبّع المتقدّمين (ATS) التي تفحص السير، وتُنبّهك لما لا يمكن إصلاحه إلا منك قبل أن يراها مسؤول التوظيف.',
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
    readyTitle: 'سيرتك جاهزة للتحسين',
    readyBody: 'سنعيد كتابتها نظيفة ومتوافقة مع أنظمة التتبّع، ونقيّمها لمسح المجنِّد في ١٠ ثوانٍ، ونُبرز ما لا يمكن إصلاحه إلا منك.',
    readyNote: 'مجاني — تسجيل الدخول فقط لمنع الروبوتات.',
    build: 'سجّل الدخول وحسّن سيرتك لأنظمة ATS',
    building: 'جارٍ تحسين سيرتك…',
    steps: ['نقرأ سيرتك…', 'نُبرز إنجازاتك…', 'نحذف الحشو…', 'نضبطها لمسحٍ في ١٠ ثوانٍ…', 'ننسّق سيرتك الجديدة…'],
    genErr: 'حدث خطأ ما. حاول مرة أخرى.',
    result: 'سيرتك',
    pdf: 'حفظ PDF',
    word: 'حفظ Word',
    optimized: 'المُحسّنة',
    original: 'الأصلية',
    fullscreen: 'ملء الشاشة',
    exitFs: 'إنهاء ملء الشاشة',
    saveOptions: 'خيارات الحفظ',
    issuesTitle: 'قبل أن تطّلع عليها',
    issuesLead: (n: number) => `أعدنا بناء سيرتك، لكن ${n === 1 ? 'هناك أمرًا يحتاج إليك' : `هناك ${n} أمور تحتاج إليك`} — لا نختلق الحقائق. عالجها وستكون سيرتك أقوى بكثير.`,
    issuesOk: 'اعرض سيرتي',
    sevHigh: 'حرِج',
    sevMedium: 'مهم',
    sevLow: 'بسيط',
    cancel: 'إلغاء',
    save: 'حفظ',
    dlPdf: 'تنزيل PDF',
    dlWord: 'تنزيل Word',
    shortenTitle: 'اجعلها أقصر',
    shortenLead: 'السيرة الأقصر أفضل — يمسح المسؤولون بسرعة. اختصر إلى:',
    pagesWord: (n: number) => `${n} صفحة`,
    shortenBtn: 'اختصار',
    shortening: 'جارٍ الاختصار…',
    changesTitle: 'التحسينات المُطبَّقة',
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
    atsTitle: 'تقييمك في ATS',
    atsLead: 'كيف تُقيَّم سيرتك المُعاد بناؤها في أنظمة تتبّع المتقدّمين (ATS) وفي مسح مسؤول التوظيف خلال ١٠ ثوانٍ.',
    ats: 'ATS',
    overall: 'الإجمالي',
    scale: '١ = ضعيف · ٥ = قوي',
    heatLow: 'ضعيف',
    heatHigh: 'قوي',
    issuesHead: 'ما يحتاج إليك',
    fixCta: 'أجب عن هذا',
    questionsHead: 'أجب لترفع تقييم ATS',
    questionsLead: 'هذه أمور لا يعرفها سواك — أضف رقمًا حيثما أمكن (مثل «خفّضت التكاليف ~١٥٪»). يدمج الذكاء الاصطناعي إجاباتك ويعيد التقييم. اترك ما شئت فارغًا.',
    gapPlaceholder: 'إجابتك — جملة أو جملتان',
    pctPlaceholder: 'مثال ١٥',
    exportReport: 'تصدير التقرير (PDF)',
    optional: 'اختياري',
    improveBtn: 'حسّن سيرتي',
    improving: 'جارٍ التحسين…',
    improveLeftL: (n: number) => `${n === 1 ? 'جولة تحسين واحدة متبقّية' : `${n} جولات تحسين متبقّية`}`,
    noImprove: 'لا جولات تحسين متبقّية لهذه السيرة — ارفع من جديد للبدء من الصفر.',
    showCv: 'اعرض سيرتي',
    improveErr: 'تعذّر تحسين السيرة. حاول مرة أخرى.',
    answerOne: 'أجب عن سؤال واحد على الأقل أولًا.',
    changed: 'تم تحسين السيرة',
  },
}

type Status = 'idle' | 'extracting' | 'ready' | 'generating' | 'done'

// ATS scoring dimensions — must match ATS_DIMENSIONS in functions/cv.js. Rendered
// as a heatmap spider chart (same idea as the Prompt Analyzer's radar).
const ATS_DIMS = [
  { key: 'keywords', en: 'Keywords', ar: 'الكلمات' },
  { key: 'impact', en: 'Impact', ar: 'الأثر' },
  { key: 'clarity', en: 'Clarity', ar: 'الوضوح' },
  { key: 'format', en: 'Format', ar: 'التنسيق' },
  { key: 'completeness', en: 'Complete', ar: 'الاكتمال' },
  { key: 'conciseness', en: 'Concise', ar: 'الإيجاز' },
] as const

// Score → heatmap colour: 1 = red, 3 = amber, 5 = green (hue 0°→120°).
function heat(v: number, sat = 68, light = 45): string {
  const hue = ((Math.max(1, Math.min(5, v || 1)) - 1) / 4) * 120
  return `hsl(${hue} ${sat}% ${light}%)`
}

// A heatmap radar of the six ATS scores. Each sector is coloured by the mean of
// its two adjacent scores, so weak areas glow red at a glance.
function AtsRadar({ scores, ar }: { scores: CvAts; ar: boolean }) {
  const N = ATS_DIMS.length, cx = 200, cy = 200, R = 130
  const ang = (i: number) => ((-90 + (i * 360) / N) * Math.PI) / 180
  const pt = (i: number, r: number): [number, number] => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]
  const ring = (v: number) => ATS_DIMS.map((_, i) => pt(i, (R * v) / 5).join(',')).join(' ')
  const val = (i: number) => scores[ATS_DIMS[i].key] || 0
  const vpt = (i: number) => pt(i, (R * val(i)) / 5)
  const poly = ATS_DIMS.map((_, i) => vpt(i).join(',')).join(' ')
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-[360px] mx-auto" role="img" aria-label="ATS scores" data-testid="cv-ats-radar">
      {[1, 2, 3, 4, 5].map((v) => <polygon key={v} points={ring(v)} fill="none" stroke="color-mix(in srgb, var(--ink) 12%, transparent)" strokeWidth={1} />)}
      {ATS_DIMS.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="color-mix(in srgb, var(--ink) 8%, transparent)" /> })}
      {ATS_DIMS.map((_, i) => {
        const j = (i + 1) % N
        const [x1, y1] = vpt(i), [x2, y2] = vpt(j)
        return <polygon key={`s${i}`} points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`} fill={heat((val(i) + val(j)) / 2)} fillOpacity={0.5} stroke="none" />
      })}
      <polygon points={poly} fill="none" stroke="color-mix(in srgb, var(--ink) 45%, transparent)" strokeWidth={1.5} strokeLinejoin="round" />
      {ATS_DIMS.map((d, i) => { const [x, y] = vpt(i); return <circle key={d.key} cx={x} cy={y} r={3.5} fill={heat(val(i), 70, 38)} stroke="var(--paper)" strokeWidth={1} /> })}
      {ATS_DIMS.map((d, i) => { const [x, y] = pt(i, R + 24); return <text key={d.key} x={x} y={y} fontSize={12} fontWeight={600} textAnchor="middle" dominantBaseline="middle" fill="var(--ink-soft)">{ar ? d.ar : d.en}</text> })}
    </svg>
  )
}

// Severity colours for the issues dialog: danger → brass → neutral ink.
const SEV_BAR: Record<CvIssue['severity'], string> = {
  high: 'border-[color:var(--danger)]',
  medium: 'border-gold-500',
  low: 'border-[color:var(--line)]',
}
const SEV_PILL: Record<CvIssue['severity'], string> = {
  high: 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-[color:var(--danger)]',
  medium: 'bg-[color-mix(in_srgb,var(--color-gold-500)_18%,transparent)] text-gold-500',
  low: 'bg-[color-mix(in_srgb,var(--color-ink)_8%,transparent)] text-ink-faint',
}


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

// A blurred teaser of the ATS panel shown behind the sign-in / scanning states —
// a real-looking spider chart (placeholder scores) plus skeleton feedback rows,
// so users see what they're about to get. Purely decorative; never interactive.
const TEASER_SCORES: CvAts = { keywords: 3, impact: 2, clarity: 4, format: 4, completeness: 3, conciseness: 4 }
function AtsTeaser({ ar, lead }: { ar: boolean; lead: string }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 blur-[5px] opacity-90 pointer-events-none select-none">
      <p className="text-[0.9rem] text-ink-soft leading-relaxed">{lead}</p>
      <AtsRadar scores={TEASER_SCORES} ar={ar} />
      <div className="h-3.5 w-32 rounded bg-[color-mix(in_srgb,var(--ink)_14%,transparent)]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5 ps-3 border-s-[3px] border-[color:var(--line)]">
          <div className="h-3 w-2/3 rounded bg-[color-mix(in_srgb,var(--ink)_13%,transparent)]" />
          <div className="h-2.5 w-full rounded bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]" />
          <div className="h-2.5 w-4/5 rounded bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]" />
        </div>
      ))}
    </div>
  )
}

// A small percentage stepper for gaps whose answer is a single figure. Empty by
// default (a helpful placeholder, not a pre-filled answer); the first "+" starts
// at 5% and it steps by 5. Stores the value as e.g. "15%".
function PercentInput({ value, onChange, placeholder, testId }: { value: string; onChange: (v: string) => void; placeholder: string; testId: string }) {
  const digits = value.replace(/[^\d]/g, '')
  const set = (raw: string) => { const d = raw.replace(/[^\d]/g, '').slice(0, 4); onChange(d ? `${d}%` : '') }
  const bump = (dir: number) => {
    const cur = parseInt(digits || '0', 10) || 0
    const next = digits === '' && dir > 0 ? 5 : Math.max(0, cur + dir * 5)
    onChange(`${next}%`)
  }
  const btn = 'grid place-items-center w-9 self-stretch text-ink-soft hover:bg-sand-100 border-0 bg-transparent cursor-pointer text-[1.15rem] leading-none disabled:opacity-40 disabled:cursor-default'
  return (
    <div className="inline-flex items-stretch h-9 rounded-sm border border-[color:var(--line)] overflow-hidden bg-[var(--surface)] focus-within:border-green-500 self-start">
      <button type="button" aria-label="decrease" className={`${btn} border-e border-[color:var(--line)]`} onClick={() => bump(-1)} disabled={!digits || digits === '0'}>−</button>
      <div className="flex items-center px-1">
        <input inputMode="numeric" value={digits} placeholder={placeholder} onChange={(e) => set(e.target.value)} data-testid={testId}
          className="w-14 text-center [font:inherit] text-[0.9rem] text-ink bg-transparent border-0 outline-none placeholder:text-ink-faint" />
        <span className="text-ink-faint pe-1.5">%</span>
      </div>
      <button type="button" aria-label="increase" className={`${btn} border-s border-[color:var(--line)]`} onClick={() => bump(1)}>+</button>
    </div>
  )
}

export default function CvGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const ar = locale === 'ar'
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
  const [saveMenu, setSaveMenu] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [signinFallback, setSigninFallback] = useState(false) // show the Google button when One-Tap can't display
  const [showAlt, setShowAlt] = useState(false) // preview shows the uploaded original instead
  const [fs, setFs] = useState(false) // preview is in browser fullscreen
  const [origPages, setOrigPages] = useState<string[]>([]) // uploaded PDF rendered to page images (for loading + the "Original" flip)
  // Problems only the candidate can fix. Shown in the review dialog OVER the
  // (blurred) result, before they read the CV itself (#213).
  const [issues, setIssues] = useState<CvIssue[]>([])
  // ATS score + follow-up questions + iteration (the "similar to Prompt Analyzer"
  // pass): the review sheet shows the heatmap radar, the issues, and the gaps as
  // an answerable form that a second AI pass folds in to raise the score.
  const [ats, setAts] = useState<CvAts>({})
  const [gaps, setGaps] = useState<CvGap[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [improving, setImproving] = useState(false)
  const [improveErr, setImproveErr] = useState('')
  const [improveLeft, setImproveLeft] = useState(0)
  const [changeNote, setChangeNote] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportErr, setReportErr] = useState('')
  const questionsRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLDivElement>(null)
  const gisRef = useRef<Awaited<ReturnType<typeof loadGis>> | null>(null)
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

  // The full-screen ATS review: Esc closes it, and background scroll is locked.
  useEffect(() => {
    if (!reviewOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setReviewOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [reviewOpen])
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

  // Guard against a silent hang: on some iOS/in-app WebViews pdf.js's getDocument
  // never settles (worker/stream quirks), leaving the upload spinner stuck forever
  // with no error. Time it out so it drops into the recoverable browser-fallback
  // path (which shows diagnostics) instead of freezing. (#182)
  function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(Object.assign(new Error(`timed out after ${ms / 1000}s reading the file`), { name: 'TimeoutError' })), ms)
      p.then((v) => { clearTimeout(id); resolve(v) }, (e) => { clearTimeout(id); reject(e) })
    })
  }

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
    setIssues([])
    setReviewOpen(false)
    setGaps([]); setAnswers({}); setChangeNote(''); setImproveErr('')
    setSigninFallback(false)
    setOrigPages([])
    setStatus('extracting')
    let pdfver = '?'
    try {
      const ex = await import('./extract')
      pdfver = ex.pdfVersion
      const t = await withTimeout(ex.extractText(f), 30000)
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
      setShowAlt(false)
      setToast('')
      lastChangeRef.current = ''
      // Show the ATS score, the issues and the follow-up questions BEFORE they
      // read the CV — the review sheet sits over a blurred preview (#213, #248).
      setIssues(r.issues)
      setAts(r.ats)
      setGaps(r.gaps)
      setAnswers({})
      setChangeNote('')
      setImproveErr('')
      setImproveLeft(r.improveLeft)
      setReviewOpen(true)
      setStatus('done')
    } catch (e) {
      setErr((e as Error).message || s.genErr)
      setStatus('ready')
    }
  }

  // Second pass: fold the candidate's answers to the follow-up questions into the
  // CV to raise its ATS score, then re-score. Stays in the review sheet so the
  // radar visibly moves.
  async function improveNow() {
    if (!idToken || !cv || improving) return
    const payload = gaps.map((g) => ({ question: g.question, answer: (answers[g.id] || '').trim() })).filter((a) => a.answer)
    if (!payload.length) { setImproveErr(s.answerOne); return }
    setImproving(true); setImproveErr('')
    try {
      const r = await improveCv(idToken, cv, payload, text)
      setCv(r.cv)
      setIssues(r.issues)
      setAts(r.ats)
      setGaps(r.gaps)
      setAnswers({})
      setImproveLeft(r.improveLeft)
      setChangeNote(r.summary || s.changed)
    } catch (e) {
      setImproveErr((e as Error).message || s.improveErr)
    } finally {
      setImproving(false)
    }
  }

  const overall = Math.round((ATS_DIMS.reduce((a, d) => a + (ats[d.key] || 0), 0) / ATS_DIMS.length) * 10) / 10

  // Solution-oriented issues: jump from an issue to the questions form and focus
  // the first answer box, so "fix this" has somewhere to go.
  function focusQuestions() {
    const el = questionsRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const ta = el.querySelector('textarea, input') as HTMLElement | null
    setTimeout(() => ta?.focus(), 320)
  }

  // Export the ATS review — score, issues, and the questions as fill-in gaps — as a PDF.
  async function exportReport() {
    if (!cv || reportBusy) return
    setReportBusy(true); setReportErr('')
    try {
      const { atsReportToPdfBlob } = await import('./AtsReport')
      const blob = await atsReportToPdfBlob(cv, ats, issues, gaps)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${cvFilename(cv)} — ATS report.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e) {
      setReportErr((e as Error).message || 'PDF export failed')
    } finally {
      setReportBusy(false)
    }
  }

  // The generated CV is what downloads act on (the "Original" flip only shows
  // the uploaded pages — there's nothing to export from those).
  const activeCv = cv
  // The preview switch only exists when there's an uploaded original to flip to.
  const hasOriginal = origPages.length > 0

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
    <Stack data-testid="ats-cv-optimizer">
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

          {/* The "ready / scanning" teaser: a two-column takeover (desktop) that
              previews the result — the uploaded CV on the left, a BLURRED ATS
              panel (spider chart + skeleton feedback) on the right — so users see
              what they're about to get. The sign-in card overlays ONLY when not
              already signed in; once signed in it flows straight into the scan.
              FIXED + portaled to <body> (fills the screen, flows into the done
              preview); one stable container so the card never remounts when the
              PDF pages finish loading (was causing a flash). */}
          {(status === 'generating' || status === 'ready') && createPortal(
            <div className="fixed inset-x-0 bottom-0 top-[68px] max-[560px]:top-[60px] z-30 overflow-hidden bg-[#e9ebef] flex" data-testid="cv-loading">
              {/* Left: the uploaded CV (blurred), or a neutral panel for text uploads. */}
              <div className="relative flex-1 min-w-0 overflow-hidden bg-[#e9ebef]">
                {origPages.length > 0 && (
                  <PdfPages pages={origPages} cover className={`absolute inset-0 transition-[filter,transform] duration-500 ${status === 'generating' ? 'blur-[7px] scale-[1.03]' : 'blur-[3px] scale-[1.01]'}`} />
                )}
                <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[color-mix(in_srgb,var(--sand-50)_30%,transparent)]" />
                {status === 'generating' && (
                  <>
                    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-24 pointer-events-none blur-[2px] bg-[linear-gradient(to_bottom,transparent,color-mix(in_srgb,var(--green-500)_45%,transparent),color-mix(in_srgb,var(--green-300)_60%,transparent),color-mix(in_srgb,var(--green-500)_45%,transparent),transparent)] animate-[cvscan_2.4s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
                    <div className="absolute inset-x-0 bottom-6 flex justify-center px-4 pointer-events-none">
                      <span className="inline-flex items-center gap-2.5 rounded-full bg-[var(--ink)] text-sand-100 px-4 py-2 text-[0.92rem] font-semibold shadow-[var(--shadow-md)]">
                        <Spinner className="size-[1.1rem]" label={s.building} />
                        <span key={loadingStep} className="animate-[fadeUp_0.4s_ease]">{s.steps[loadingStep]}</span>
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Right: a blurred teaser of the ATS panel (desktop only). */}
              <div className="hidden md:block md:w-[25rem] lg:w-[29rem] shrink-0 overflow-hidden border-s border-[color:var(--line-soft)] bg-[var(--surface)] px-4 py-4">
                <AtsTeaser ar={ar} lead={s.atsLead} />
              </div>

              {/* Sign-in card — only when not already signed in. */}
              {!idToken && readyCard}
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
              srcDoc={renderCvHtml(cv, { preview: true })}
            />
            {showAlt && hasOriginal && (
              <PdfPages pages={origPages} className="absolute inset-0 h-full" />
            )}

            {/* Controls live INSIDE the preview. Constrained to the content column
                (max --wrap, centred) so on a wide desktop they align to the page,
                not the far screen edges. pointer-events pass through to the iframe. */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="relative h-full mx-auto max-w-[var(--wrap)] [&>*]:pointer-events-auto">
            {/* View switch (top-left): optimized↔original for a fresh upload.
                Hidden when there's no uploaded original to compare against. */}
            {hasOriginal && (
              <div className="absolute start-3 top-3 z-10 flex items-stretch rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)] overflow-hidden text-[0.82rem] font-semibold">
                <button type="button" data-testid="cv-view-optimized" onClick={() => setShowAlt(false)} className={`px-3 py-1.5 border-0 cursor-pointer ${!showAlt ? 'bg-green-600 text-sand-100' : 'bg-transparent text-ink-soft hover:bg-sand-100'}`}>{s.optimized}</button>
                <button type="button" data-testid="cv-view-original" onClick={() => setShowAlt(true)} className={`px-3 py-1.5 border-0 border-s border-[color:var(--line)] cursor-pointer ${showAlt ? 'bg-green-600 text-sand-100' : 'bg-transparent text-ink-soft hover:bg-sand-100'}`}>{s.original}</button>
              </div>
            )}

            {/* Save (bottom-left): a green CTA opening the download options. */}
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
                </div>
              )}
              <button type="button" onClick={() => setSaveMenu((v) => !v)} aria-expanded={saveMenu} data-testid="cv-save-menu"
                className="inline-flex items-center gap-1.5 h-9 rounded-md bg-green-600 text-sand-100 px-3.5 text-[0.88rem] font-semibold shadow-[var(--shadow-md)] hover:bg-green-700 border-0 cursor-pointer">
                <DownloadIcon className="size-4" /> {s.save}
              </button>
            </div>

            {/* ATS score badge (bottom-centre): reopens the review with the radar + questions. */}
            <button type="button" onClick={() => setReviewOpen(true)} data-testid="cv-ats-badge"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 h-9 rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 text-[0.85rem] font-semibold shadow-[var(--shadow-md)] cursor-pointer hover:border-green-500">
              <span style={{ color: heat(overall, 70, 38) }}>{overall}</span>
              <span className="text-ink-faint font-normal">/ 5 · {s.ats}</span>
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

          {/* The review — read BEFORE the CV: a full-screen takeover with the CV
              itself in a left column on desktop, and the ATS score + issues +
              questions in the right panel (#248). Portaled so ToolPage's
              transform can't clip the fixed layer. */}
          {reviewOpen && cv && createPortal(
            <div className="fixed inset-0 z-[80] flex flex-col bg-[var(--surface)] animate-[fadeUp_0.2s_ease_both]" role="dialog" aria-modal="true" data-testid="cv-review">
              <div className="flex-none flex items-center justify-between gap-3 ps-4 pe-2 py-2.5 border-b border-[color:var(--line-soft)]">
                <h3 className="font-display rtl:font-ar text-[1.15rem] font-semibold text-ink truncate">{s.atsTitle}</h3>
                <button type="button" aria-label={s.showCv} data-testid="cv-review-close" onClick={() => setReviewOpen(false)}
                  className="flex-none grid place-items-center size-9 rounded-md text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] border-0 bg-transparent cursor-pointer text-[1.05rem] leading-none">✕</button>
              </div>

              <div className="flex-1 min-h-0 flex">
                {/* Left column: the CV preview (desktop only). */}
                <div className="hidden md:block flex-1 min-w-0 bg-[#e9ebef] border-e border-[color:var(--line-soft)]">
                  <iframe title={cvFilename(cv)} className="block w-full h-full border-0 bg-[#e9ebef]" srcDoc={renderCvHtml(cv, { preview: true })} />
                </div>

                {/* Right column: the ATS panel (the only column on mobile). */}
                <div className="flex-1 md:flex-none md:w-[25rem] lg:w-[29rem] min-h-0 overflow-y-auto overscroll-contain">
                  <div className="px-4 py-4 flex flex-col gap-4">
                    <p className="text-[0.9rem] text-ink-soft leading-relaxed">{s.atsLead}</p>

                    {changeNote && (
                      <p className="text-[0.88rem] text-ink leading-relaxed border-s-[3px] border-green-500 ps-3" data-testid="cv-change-note">{changeNote}</p>
                    )}

                    <div className="flex flex-col items-center gap-2">
                      <AtsRadar scores={ats} ar={ar} />
                      <div className="flex items-center justify-center gap-2 text-[0.72rem] text-ink-faint">
                        <span>{s.heatLow}</span>
                        <span className="h-2.5 w-24 rounded-[2px]" style={{ background: `linear-gradient(to right, ${heat(1)}, ${heat(3)}, ${heat(5)})` }} aria-hidden="true" />
                        <span>{s.heatHigh}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[2.4rem] font-display font-bold leading-none" data-testid="cv-ats-overall" style={{ color: heat(overall, 70, 38) }}>{overall}</span>
                      <div className="flex flex-col">
                        <span className="text-ink-faint text-[0.9rem]">/ 5 · {s.overall}</span>
                        <span className="text-[0.72rem] text-ink-faint">{s.scale}</span>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-1 list-none p-0 m-0">
                      {ATS_DIMS.map((d) => { const v = ats[d.key] || 0; return (
                        <li key={d.key} className="flex items-center gap-2 text-[0.82rem]">
                          <span className="flex-1 text-ink-soft truncate">{ar ? d.ar : d.en}</span>
                          <span className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <span key={n} className="w-1.5 h-3.5 rounded-[1px]" style={{ background: n <= v ? heat(v) : 'color-mix(in srgb, var(--ink) 10%, transparent)' }} />)}</span>
                        </li>) })}
                    </ul>

                    {issues.length > 0 && (
                      <div className="flex flex-col gap-2.5 border-t border-[color:var(--line-soft)] pt-3">
                        <h4 className="text-[0.95rem] font-semibold text-ink m-0">{s.issuesHead}</h4>
                        <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
                          {issues.map((i, n) => (
                            <li key={n} className={`flex flex-col gap-1.5 ps-3 border-s-[3px] ${SEV_BAR[i.severity]}`} data-testid="cv-issue">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-[0.94rem] font-semibold text-ink leading-snug">{i.title}</span>
                                <span className={`text-[0.66rem] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full ${SEV_PILL[i.severity]}`} data-testid={`cv-issue-${i.severity}`}>
                                  {i.severity === 'high' ? s.sevHigh : i.severity === 'medium' ? s.sevMedium : s.sevLow}
                                </span>
                              </div>
                              {i.detail && <p className="text-[0.86rem] text-ink-soft leading-relaxed m-0">{i.detail}</p>}
                              {gaps.length > 0 && improveLeft > 0 && (
                                <button type="button" onClick={focusQuestions} data-testid="cv-issue-fix"
                                  className="self-start text-[0.8rem] font-semibold text-green-700 hover:text-green-600 border-0 bg-transparent p-0 cursor-pointer">{s.fixCta} →</button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {gaps.length > 0 && (
                      <div ref={questionsRef} className="flex flex-col gap-2.5 border-t border-[color:var(--line-soft)] pt-3 scroll-mt-3" data-testid="cv-questions">
                        <div>
                          <h4 className="text-[0.95rem] font-semibold text-ink m-0">{s.questionsHead}</h4>
                          <p className="text-[0.86rem] text-ink-soft leading-relaxed mt-0.5">{s.questionsLead}</p>
                        </div>
                        {improveLeft > 0 ? (
                          <>
                            {gaps.map((g) => (
                              <label key={g.id} className="flex flex-col gap-1">
                                <span className="text-[0.86rem] font-medium text-ink leading-snug">{g.question} {g.why && <span className="text-ink-faint font-normal">· {g.why}</span>} <span className="text-ink-faint font-normal">({s.optional})</span></span>
                                {g.expects === 'percent'
                                  ? <PercentInput value={answers[g.id] || ''} onChange={(v) => setAnswers((a) => ({ ...a, [g.id]: v }))} placeholder={s.pctPlaceholder} testId={`cv-gap-${g.id}`} />
                                  : <textarea value={answers[g.id] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [g.id]: e.target.value }))} rows={2} placeholder={s.gapPlaceholder} data-testid={`cv-gap-${g.id}`}
                                      className="w-full px-[0.7rem] py-[0.5rem] [font:inherit] text-[0.9rem] text-ink bg-[var(--surface)] border border-[color:var(--line)] rounded-sm resize-y focus:outline-none focus:border-green-500 placeholder:text-ink-faint" />}
                              </label>
                            ))}
                            {improveErr && <p className="text-[color:var(--danger)] text-[0.88rem]" data-testid="cv-improve-err">{improveErr}</p>}
                            <div className="flex items-center gap-3 flex-wrap">
                              <Button variant="primary" className="!h-9" disabled={improving} onClick={improveNow} data-testid="cv-improve">{improving ? s.improving : s.improveBtn}</Button>
                              <span className="text-[0.78rem] text-ink-faint">{s.improveLeftL(improveLeft)}</span>
                            </div>
                          </>
                        ) : (
                          <p className="text-[0.86rem] text-ink-faint" data-testid="cv-no-improve">{s.noImprove}</p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 border-t border-[color:var(--line-soft)] pt-3">
                      <Button className="!h-9 self-start" disabled={reportBusy} onClick={exportReport} data-testid="cv-report">
                        {reportBusy ? <Spinner className="size-4" /> : <DownloadIcon />} {s.exportReport}
                      </Button>
                      {reportErr && <p className="text-[color:var(--danger)] text-[0.82rem]">{reportErr}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-none px-4 py-2.5 border-t border-[color:var(--line-soft)] pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))]">
                <Button variant="primary" className="w-full sm:w-auto" onClick={() => setReviewOpen(false)} data-testid="cv-review-ok">{s.showCv}</Button>
              </div>
            </div>,
            document.body,
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
