import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, CopyIcon, ScanTextIcon } from '../../components/icons'
import { Button, Textarea, Stack, Spinner, Check, FileError, Panel, Field, Input } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import type { Extracted } from './extract'

const STR = {
  en: {
    drop: 'Choose a PDF', another: 'Choose another',
    working: 'Reading the text…',
    pages: (n: number) => `${n} page${n === 1 ? '' : 's'}`,
    words: (n: number) => `${n.toLocaleString('en')} words`,
    separators: 'Mark where each page begins',
    copy: 'Copy', copied: 'Copied!', download: 'Download .txt',
    scanned: 'This PDF has almost no text in it — it is a scan, a picture of a page. There is nothing to extract, but the OCR tool can read the words off the image.',
    toOcr: 'Open Image to Text',
    locked: 'This PDF is password-protected. Type the password and the text will be read here, on your device — the password is passed to the PDF engine in this tab and is neither stored nor sent.',
    wrongPassword: 'That password did not open it. Check it and try again.',
    passwordLabel: 'Password',
    unlock: 'Unlock and read',
    failed: 'That file could not be read as a PDF.',
    hint: 'The text comes straight out of the PDF, exactly as it was written into it — no upload, no conversion service.',
    empty: 'No text on this page.',
  },
  ar: {
    drop: 'اختر ملف PDF', another: 'اختر ملفًا آخر',
    working: 'جارٍ قراءة النص…',
    pages: (n: number) => `${n.toLocaleString('ar')} صفحة`,
    words: (n: number) => `${n.toLocaleString('ar')} كلمة`,
    separators: 'أشِر إلى بداية كل صفحة',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'نزّل ملف ‎.txt',
    scanned: 'لا يكاد هذا الملف يحتوي على نص — إنه صورة ممسوحة للصفحة. لا يوجد ما يُستخرج، لكن أداة التعرّف الضوئي تستطيع قراءة الكلمات من الصورة.',
    toOcr: 'افتح أداة الصورة إلى نص',
    locked: 'هذا الملف محمي بكلمة مرور. اكتب كلمة المرور ليُقرأ النص هنا على جهازك — فكلمة المرور تُمرَّر إلى محرّك PDF في هذه الصفحة ولا تُحفظ ولا تُرسل.',
    wrongPassword: 'لم تفتحه كلمة المرور هذه. تأكّد منها وأعد المحاولة.',
    passwordLabel: 'كلمة المرور',
    unlock: 'افتح واقرأ',
    failed: 'تعذّرت قراءة هذا الملف كـPDF.',
    hint: 'يخرج النص من ملف PDF مباشرةً كما كُتب فيه — بلا رفع، وبلا خدمة تحويل.',
    empty: 'لا نص في هذه الصفحة.',
  },
}

export default function PdfToTextTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Extracted | null>(null)
  const [name, setName] = useState('document')
  const [error, setError] = useState('')
  const [separators, setSeparators] = useState(true)
  const [copied, setCopied] = useState(false)
  // The picked file is kept so the password can be applied to it without
  // asking the person to choose it a second time.
  const [locked, setLocked] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [wrongPassword, setWrongPassword] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => setWorkInProgress('pdf-to-text', false), [])

  async function pick(f: File | undefined, pw = '') {
    if (!f) return
    setBusy(true); setError(''); setResult(null); setWrongPassword(false)
    setName(f.name.replace(/\.pdf$/i, '') || 'document')
    try {
      // pdf.js is heavy; it loads only once a PDF is actually chosen.
      const { extractPdf } = await import('./extract')
      const r = await extractPdf(f, pw || undefined)
      if (r.encrypted) {
        // Not an error any more — an ASK. pdf.js decrypts given the password
        // the reader already has, so the old dead end was saying the text could
        // not be read when it could.
        setLocked(f)
        setWrongPassword(!!r.wrongPassword)
        return
      }
      setLocked(null)
      setResult(r)
      setWorkInProgress('pdf-to-text', true)
    } catch {
      setError(s.failed)
    } finally {
      setBusy(false)
    }
  }

  const text = useMemo(() => {
    if (!result) return ''
    if (!separators) return result.pages.map((p) => p.text).join('\n\n')
    const label = locale === 'ar' ? 'صفحة' : 'Page'
    return result.pages.map((p) => `--- ${label} ${p.n} ---\n${p.text}`).join('\n\n')
  }, [result, separators, locale])

  const words = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text])

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  function download() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${name}.txt`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Stack data-testid="pdf-to-text">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's gallery picker hides files it hasn't indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="p2t-file"
          onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="p2t-pick">
          <UploadIcon /> {result ? s.another : s.drop}
        </Button>
        {busy && <Spinner className="size-5" />}
        {busy && <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{s.working}</span>}
      </div>

      {error && <FileError message={error} />}

      {locked && (
        <Panel className="gap-2 border-gold-500" data-testid="p2t-locked">
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.locked}</p>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => { e.preventDefault(); void pick(locked, password) }}
          >
            <Field label={s.passwordLabel} className="flex-1 min-w-[12rem]">
              <Input
                type="password"
                value={password}
                data-testid="p2t-password"
                autoComplete="off"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button variant="primary" type="submit" disabled={busy || !password} data-testid="p2t-unlock">
              {s.unlock}
            </Button>
          </form>
          {wrongPassword && (
            <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="p2t-wrong-password">
              {s.wrongPassword}
            </p>
          )}
        </Panel>
      )}
      {!result && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {result?.looksScanned && (
        <Panel className="flex flex-col gap-2 items-start" data-testid="p2t-scanned">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.scanned}</p>
          <Button to={`/${locale}/apps/image-to-text`}><ScanTextIcon /> {s.toOcr}</Button>
        </Panel>
      )}

      {result && !result.looksScanned && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[0.9rem] font-semibold text-ink" data-testid="p2t-pages">{s.pages(result.pages.length)}</span>
            <span className="text-[0.9rem] text-ink-faint" data-testid="p2t-words">{s.words(words)}</span>
            <Check>
              <input type="checkbox" checked={separators} data-testid="p2t-separators"
                onChange={(e) => setSeparators(e.target.checked)} /> {s.separators}
            </Check>
            <Button className="px-3" onClick={copy} data-testid="p2t-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <Button variant="primary" className="px-3" onClick={download} data-testid="p2t-download"><DownloadIcon /> {s.download}</Button>
          </div>
          <Textarea readOnly dir="auto" className="min-h-[24rem] font-mono text-[0.85rem]"
            data-testid="p2t-output" value={text} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
    </Stack>
  )
}
