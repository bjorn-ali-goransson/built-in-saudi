import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Select, Field, Stack, Panel, FileError, Spinner } from '../../components/ui'
import { CopyIcon, DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { createOcrWorker, type OcrLang } from '../../lib/ocr'
import { renderPdf } from '../../lib/pdfRender'
import { extractPdf } from '../pdf-to-text/extract'

const WIP = 'pdf-ocr'

const STR = {
  en: {
    pick: 'Choose a scanned PDF',
    intro: 'Read the text out of a PDF that is really a photograph — a scanned contract, a stamped letter, a receipt someone photocopied. The file never leaves your device: the OCR engine runs here, and its models are served from this site rather than anyone else’s.',
    lang: 'Language', english: 'English', arabic: 'Arabic', both: 'Both',
    read: 'Read the text', reading: 'Reading page', loading: 'Loading the OCR engine…',
    rendering: 'Rendering the pages…',
    of: 'of',
    hasText: 'This PDF already contains real text',
    hasTextBody: 'It does not need reading by eye — the text is in the file. OCR would turn a perfect copy into a guess, so use PDF to Text instead: it is instant, exact, and keeps every character.',
    hasTextLink: 'Open PDF to Text',
    someText: 'Some pages already contain text',
    someTextBody: 'Those pages were taken as they are; only the picture-only pages were read by eye. Text taken from the file is exact, so mixing them is better than OCRing the lot.',
    result: 'Text', page: 'Page',
    copy: 'Copy', copied: 'Copied!', download: 'Download',
    empty: 'No text was found. If the scan is faint or skewed, a sharper photo reads far better than a clever setting.',
    firstRun: 'The engine downloads once (a few MB) and is then cached on your device.',
    error: 'That PDF could not be opened. A password-protected file will not open here.',
    failed: 'The OCR engine could not start. Reload the page and try again.',
    again: 'Choose another PDF',
    accuracy: 'OCR is reading letters off a picture, and it makes mistakes — more of them on a faint scan, a skewed page, or a stamp across the words. Read the result against the original before you rely on it, especially for numbers.',
  },
  ar: {
    pick: 'اختر ملف PDF ممسوحًا ضوئيًا',
    intro: 'استخرج النص من ملف PDF هو في الحقيقة صورة — عقد ممسوح، أو خطاب مختوم، أو إيصال صوّره أحدهم. ولا يغادر الملف جهازك: فمحرك التعرّف يعمل هنا، ونماذجه تُقدَّم من هذا الموقع لا من غيره.',
    lang: 'اللغة', english: 'الإنجليزية', arabic: 'العربية', both: 'كلتاهما',
    read: 'استخرج النص', reading: 'جارٍ قراءة الصفحة', loading: 'جارٍ تحميل محرك التعرّف…',
    rendering: 'جارٍ تجهيز الصفحات…',
    of: 'من',
    hasText: 'هذا الملف يحتوي نصًا حقيقيًا أصلًا',
    hasTextBody: 'لا يحتاج قراءةً بالعين — فالنص موجود في الملف. والتعرّف الضوئي يحوّل نسخةً مضبوطة إلى تخمين، فاستخدم أداة «PDF إلى نص»: فورية ودقيقة وتحفظ كل حرف.',
    hasTextLink: 'افتح «PDF إلى نص»',
    someText: 'بعض الصفحات تحتوي نصًا أصلًا',
    someTextBody: 'أُخذت تلك الصفحات كما هي، ولم تُقرأ بالعين إلا الصفحات المصوّرة. فالنص المأخوذ من الملف مضبوط، والمزج بينهما أفضل من التعرّف على الجميع.',
    result: 'النص', page: 'صفحة',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'نزّل',
    empty: 'لم يُعثر على نص. وإن كان المسح باهتًا أو مائلًا، فصورة أوضح تُقرأ أفضل بكثير من أي إعداد ذكي.',
    firstRun: 'يُنزَّل المحرك مرة واحدة (بضعة ميغابايت) ثم يُخزَّن على جهازك.',
    error: 'تعذّر فتح ملف PDF هذا. والملف المحمي بكلمة مرور لن يُفتح هنا.',
    failed: 'تعذّر تشغيل محرك التعرّف. أعد تحميل الصفحة وحاول مجددًا.',
    again: 'اختر ملفًا آخر',
    accuracy: 'التعرّف الضوئي يقرأ الحروف من صورة، وهو يخطئ — ويكثر خطؤه في المسح الباهت أو الصفحة المائلة أو الختم فوق الكلمات. فقابِل الناتج بالأصل قبل الاعتماد عليه، وبخاصة في الأرقام.',
  },
}

interface PageText { index: number; text: string; fromFile: boolean }

export default function PdfOcrTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [file, setFile] = useState<File | null>(null)
  const [lang, setLang] = useState<OcrLang>(locale === 'ar' ? 'ara' : 'eng')
  const [pages, setPages] = useState<PageText[]>([])
  const [embedded, setEmbedded] = useState<string[]>([])
  const [phase, setPhase] = useState<'' | 'render' | 'load' | 'read'>('')
  const [at, setAt] = useState({ page: 0, total: 0 })
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const runRef = useRef(0)

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])

  async function pick(f: File | undefined | null) {
    if (!f) return
    setError('')
    setPages([])
    setPhase('render')
    try {
      // pdf-to-text's extractor already knows how to pull the text layer out and
      // how to recognise an encrypted file — no reason to have a second opinion
      // about either.
      const { pages: extracted, encrypted } = await extractPdf(f)
      if (encrypted) { setError(s.error); setFile(null); return }
      setEmbedded(extracted.map((p) => p.text.trim()))
      setFile(f)
      setWorkInProgress(WIP, true)
    } catch {
      setError(s.error)
      setFile(null)
    } finally { setPhase('') }
  }

  const allHaveText = embedded.length > 0 && embedded.every((t) => t.length > 20)
  const someHaveText = embedded.some((t) => t.length > 20) && !allHaveText

  async function run() {
    if (!file) return
    const id = ++runRef.current
    setError('')
    setPages([])
    setPhase('render')
    let worker: Awaited<ReturnType<typeof createOcrWorker>> | null = null
    try {
      const rendered = await renderPdf(await file.arrayBuffer(), 2)
      if (id !== runRef.current) return
      setAt({ page: 0, total: rendered.length })
      setPhase('load')
      worker = await createOcrWorker(lang)
      if (id !== runRef.current) return

      const out: PageText[] = []
      for (let i = 0; i < rendered.length; i++) {
        if (id !== runRef.current) return
        // A page that already carries text is taken as-is. Running OCR over a
        // perfect copy to produce a guess would be strictly worse, and slower.
        if ((embedded[i] ?? '').length > 20) {
          out.push({ index: i, text: embedded[i], fromFile: true })
        } else {
          setPhase('read')
          setAt({ page: i + 1, total: rendered.length })
          const { data } = await worker.recognize(rendered[i].url)
          out.push({ index: i, text: (data.text || '').trim(), fromFile: false })
        }
        setPages([...out])
      }
    } catch {
      if (id === runRef.current) setError(s.failed)
    } finally {
      await worker?.terminate()
      if (id === runRef.current) setPhase('')
    }
  }

  const combined = pages.map((p) => p.text).filter(Boolean).join('\n\n')

  async function copy() {
    try { await navigator.clipboard.writeText(combined); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  function download() {
    const blob = new Blob([combined], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (file?.name.replace(/\.pdf$/i, '') || 'scan') + '.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Stack data-testid="pdf-ocr">
      {!file && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="pk-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.firstRun}</p>
        </Panel>
      )}

      {error && <FileError message={error} />}

      {file && allHaveText && (
        <Panel className="gap-2" data-testid="pk-has-text">
          <p className="text-[1rem] text-ink font-semibold rtl:font-ar">{s.hasText}</p>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.hasTextBody}</p>
          <Button className="self-start" to={`/${locale}/apps/pdf-to-text`} data-testid="pk-use-extract">{s.hasTextLink}</Button>
        </Panel>
      )}

      {file && someHaveText && (
        <Panel className="gap-1" data-testid="pk-some-text">
          <p className="text-[0.95rem] text-ink rtl:font-ar">{s.someText}</p>
          <p className="text-[0.88rem] text-ink-soft rtl:font-ar">{s.someTextBody}</p>
        </Panel>
      )}

      {file && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={s.lang}>
            <Select value={lang} data-testid="pk-lang" onChange={(e) => setLang(e.target.value as OcrLang)}>
              <option value="eng">{s.english}</option>
              <option value="ara">{s.arabic}</option>
              <option value="eng+ara">{s.both}</option>
            </Select>
          </Field>
          <Button variant="primary" onClick={run} disabled={phase !== ''} data-testid="pk-run">{s.read}</Button>
          {phase === 'render' && <span className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="pk-rendering"><Spinner /> {s.rendering}</span>}
          {phase === 'load' && <span className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="pk-loading"><Spinner /> {s.loading}</span>}
          {phase === 'read' && (
            <span className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="pk-progress">
              <Spinner /> {s.reading} {at.page} {s.of} {at.total}
            </span>
          )}
        </div>
      )}

      {pages.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.result}</h2>
            <Button className="px-3 py-1" onClick={copy} disabled={!combined} data-testid="pk-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <Button className="px-3 py-1" onClick={download} disabled={!combined} data-testid="pk-download"><DownloadIcon /> {s.download}</Button>
          </div>
          {!combined && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="pk-empty">{s.empty}</p>}
          <div className="flex flex-col gap-3" data-testid="pk-pages">
            {pages.map((p) => (
              <div key={p.index} className="flex flex-col gap-1" data-testid={`pk-page-${p.index}`}>
                <span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">
                  {s.page} {p.index + 1}
                  {p.fromFile && <span className="text-green-700"> · {s.hasText}</span>}
                </span>
                <pre className="whitespace-pre-wrap rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-3 text-[0.85rem] text-ink" dir="auto">{p.text || '—'}</pre>
              </div>
            ))}
          </div>
        </>
      )}

      {file && <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.accuracy}</p></Panel>}

      {file && (
        <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
          {s.again}
          <input type="file" className="hidden" data-testid="pk-file-again" onChange={(e) => { void pick(e.target.files?.[0]) }} />
        </label>
      )}
    </Stack>
  )
}
