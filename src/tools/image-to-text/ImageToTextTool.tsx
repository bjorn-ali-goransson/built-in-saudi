import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { setWorkInProgress } from '../../lib/workInProgress'
import { createOcrWorker, type OcrLang } from '../../lib/ocr'
import { UploadIcon, DownloadIcon, CopyIcon, LockIcon } from '../../components/icons'
import { Button, Stack, Field, Textarea, Seg, SegButton, Spinner, FileError } from '../../components/ui'
import { whyUnreadable } from '../../lib/imageInput'
import { decodeImage } from '../../lib/decodeImage'

// The tesseract configuration — our own origin, an explicitly chosen core
// build, plain .traineddata — lives in lib/ocr.ts, shared with pdf-ocr.

type Lang = OcrLang

const STR = {
  en: {
    drop: 'Drop an image, or tap to choose',
    change: 'Choose another image',
    lang: 'Language', english: 'English', arabic: 'Arabic', both: 'Both',
    read: 'Read the text', reading: 'Reading', loading: 'Loading the OCR engine…',
    copy: 'Copy', copied: 'Copied!', download: 'Download .txt',
    empty: 'No text found. A sharper, straighter, higher-contrast picture usually fixes it.',
    failed: 'The OCR engine couldn’t start. Reload the page and try again.',
    result: 'Text found', confidence: 'confidence',
    lowConf: 'Low confidence — check the text against the image before using it.',
    firstRun: 'The engine downloads once (a few MB) and is then cached on your device.',
    privacy: 'Read on your device — the image is never uploaded.',
    pdfHint: 'Got a PDF? Convert it with PDF to Images first, then read the pages here.',
  },
  ar: {
    drop: 'أفلت صورة أو اضغط للاختيار',
    change: 'اختر صورة أخرى',
    lang: 'اللغة', english: 'الإنجليزية', arabic: 'العربية', both: 'كلتاهما',
    read: 'اقرأ النص', reading: 'جارٍ القراءة', loading: 'جارٍ تحميل محرك القراءة…',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'تنزيل .txt',
    empty: 'لم يُعثر على نص. عادةً ما تحل صورة أوضح وأكثر استقامة وتباينًا المشكلة.',
    failed: 'تعذّر تشغيل محرك القراءة. أعد تحميل الصفحة وحاول مجددًا.',
    result: 'النص المستخرج', confidence: 'الثقة',
    lowConf: 'الثقة منخفضة — راجع النص مقابل الصورة قبل استخدامه.',
    firstRun: 'يُنزَّل المحرك مرة واحدة (بضعة ميغابايت) ثم يُحفظ على جهازك.',
    privacy: 'تُقرأ على جهازك — لا تُرفع الصورة أبدًا.',
    pdfHint: 'لديك ملف PDF؟ حوّله عبر «PDF إلى صور» أولًا ثم اقرأ الصفحات هنا.',
  },
}

export default function ImageToTextTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [lang, setLang] = useState<Lang>(locale === 'ar' ? 'ara' : 'eng')
  const [text, setText] = useState('')
  const [conf, setConf] = useState<number | null>(null)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'reading'>('idle')
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const runRef = useRef(0)

  useEffect(() => {
    setWorkInProgress('image-to-text', !!file)
    return () => setWorkInProgress('image-to-text', false)
  }, [file])

  useEffect(() => () => { runRef.current++ }, [])

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr(''); setText(''); setConf(null); setPct(0)
    // #225: never gate on f.type — Android hands over HEIC with an empty MIME.
    // Verify by actually decoding, at pick time, so a bad pick explains itself
    // here rather than failing later inside the OCR engine.
    const bmp = await decodeImage(f)
    if (!bmp) { setFile(null); setPreview(''); setErr(await whyUnreadable(f, locale)); return }
    bmp.close()
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
    setFile(f)
  }

  async function read() {
    if (!file || phase !== 'idle') return
    const run = ++runRef.current
    setErr(''); setText(''); setConf(null); setPct(0); setPhase('loading')
    let worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | null = null
    try {
      worker = await createOcrWorker(lang, (m) => {
        if (run !== runRef.current) return
        if (m.status === 'recognizing text') { setPhase('reading'); setPct(Math.round(m.progress * 100)) }
      })
      if (run !== runRef.current) return
      setPhase('reading')
      const { data } = await worker.recognize(file)
      if (run !== runRef.current) return
      setText((data.text || '').trim())
      setConf(typeof data.confidence === 'number' ? Math.round(data.confidence) : null)
    } catch {
      if (run === runRef.current) setErr(s.failed)
    } finally {
      // Free the wasm heap — a held worker keeps tens of MB alive per language.
      try { await worker?.terminate() } catch { /* already gone */ }
      if (run === runRef.current) { setPhase('idle'); setPct(0) }
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked — the textarea is selectable anyway */ }
  }

  const busy = phase !== 'idle'

  return (
    <Stack data-testid="image-to-text">
      {!file ? (
        <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)]" data-testid="ocr-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          {/* No `accept`: an image-only accept makes Android open the gallery, which never lists Downloads (#225). */}
          <input ref={fileRef} type="file" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 items-start">
            <img src={preview} alt="" data-testid="ocr-preview"
              className="max-w-[16rem] w-full h-auto rounded-[var(--r-md)] border border-[color:var(--line-soft)] bg-white" />
            <div className="flex flex-col gap-3 flex-1 min-w-[14rem]">
              <Field label={s.lang}>
                <Seg className="self-start" role="group">
                  {([['eng', s.english], ['ara', s.arabic], ['eng+ara', s.both]] as const).map(([v, label]) => (
                    <SegButton key={v} active={lang === v} data-testid={`ocr-lang-${v}`}
                      onClick={() => { setLang(v); setText(''); setConf(null) }}>{label}</SegButton>
                  ))}
                </Seg>
              </Field>
              <div className="flex gap-2 flex-wrap">
                <Button variant="primary" data-testid="ocr-run" disabled={busy} onClick={read}>
                  {phase === 'loading' ? <><Spinner className="size-4" /> {s.loading}</>
                    : phase === 'reading' ? <><Spinner className="size-4" /> {s.reading} {pct}%</>
                      : s.read}
                </Button>
                <Button onClick={() => { runRef.current++; setFile(null); setPreview((p) => { if (p) URL.revokeObjectURL(p); return '' }); setText(''); setConf(null); setErr(''); setPhase('idle') }}>{s.change}</Button>
              </div>
              <p className="text-[0.8rem] text-ink-faint">{s.firstRun}</p>
            </div>
          </div>

          {text && (
            <>
              <Field label={conf === null ? s.result : `${s.result} · ${conf}% ${s.confidence}`}>
                <Textarea value={text} rows={12} data-testid="ocr-text" onChange={(e) => setText(e.target.value)} dir="auto" className="font-mono text-[0.9rem]" />
              </Field>
              {conf !== null && conf < 70 && <p className="text-[0.8rem] text-ink-faint" data-testid="ocr-lowconf">{s.lowConf}</p>}
              <div className="flex gap-2 flex-wrap">
                <Button onClick={copy} data-testid="ocr-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
                <Button href={URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))}
                  download={`${file.name.replace(/\.[^.]+$/, '')}.txt`} data-testid="ocr-download"><DownloadIcon /> {s.download}</Button>
              </div>
            </>
          )}
          {!text && !busy && conf !== null && <p className="text-ink-soft" data-testid="ocr-empty">{s.empty}</p>}
        </>
      )}

      <FileError message={err} />
      <p className="text-[0.8rem] text-ink-faint">{s.pdfHint}</p>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><LockIcon className="w-3.5 h-3.5 flex-none" /> {s.privacy}</p>
    </Stack>
  )
}
