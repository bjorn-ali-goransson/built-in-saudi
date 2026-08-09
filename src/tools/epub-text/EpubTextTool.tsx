import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Check, Stack, Panel, Seg, SegButton, FileError, Spinner } from '../../components/ui'
import { CopyIcon, DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { bookToMarkdown, bookToText, chapterToMarkdown, readEpub, type Book } from './epub'

const WIP = 'epub-text'

const STR = {
  en: {
    pick: 'Choose an EPUB',
    intro: 'Open an ebook you own and take the text out of it — the whole book, or one chapter at a time — as plain text or real Markdown that keeps its headings, lists, quotes and links. Read in your browser; the file is never uploaded.',
    reading: 'Reading the book…',
    title: 'Title', authors: 'By', publisher: 'Publisher', language: 'Language', identifier: 'Identifier', date: 'Published',
    chapters: 'Chapters', words: (n: number) => `${n.toLocaleString('en')} words`,
    total: (c: number, w: number) => `${c} chapter${c === 1 ? '' : 's'} · ${w.toLocaleString('en')} words`,
    format: 'As', plain: 'Plain text', markdown: 'Markdown',
    mdNote: 'Markdown keeps the book’s headings, lists, quotes, links and bold. Pictures are referenced by their path inside the book but are not extracted — this tool returns text.',
    titles: 'Include chapter titles',
    copy: 'Copy', copied: 'Copied!', download: 'Download',
    preview: 'Preview', whole: 'Whole book',
    again: 'Choose another book',
    errors: {
      'not-a-zip': 'That file is not an EPUB. An EPUB is a zip archive, and this is not one.',
      'not-epub': 'That zip is not an EPUB — it has no META-INF/container.xml pointing at a package file.',
      'no-text': 'No readable text was found in that book. A comic or a scanned book holds images, not text, and there is nothing here to extract.',
      generic: 'That file could not be read.',
    } as Record<string, string>,
    drmNote: 'A book bought from a shop that applies DRM is encrypted, and will either fail to open here or produce nothing readable. This reads books you already have in the clear; it does not remove protection from anything.',
    orderNote: 'Chapters are listed in the order the book says to read them, which is not the order the files are named in — chapter 10 sorts before chapter 2 on a filename.',
  },
  ar: {
    pick: 'اختر كتاب EPUB',
    intro: 'افتح كتابًا تملكه واستخرج نصّه — الكتاب كله أو فصلًا فصلًا — نصًّا عاديًا أو ماركداون حقيقية تحفظ العناوين والقوائم والاقتباسات والروابط. تجري القراءة في متصفحك؛ ولا يُرفع الملف أبدًا.',
    reading: 'جارٍ قراءة الكتاب…',
    title: 'العنوان', authors: 'تأليف', publisher: 'الناشر', language: 'اللغة', identifier: 'المعرّف', date: 'النشر',
    chapters: 'الفصول', words: (n: number) => `${n.toLocaleString('ar')} كلمة`,
    total: (c: number, w: number) => `${c} فصلًا · ${w.toLocaleString('ar')} كلمة`,
    format: 'الصيغة', plain: 'نص عادي', markdown: 'ماركداون',
    mdNote: 'تحفظ صيغة ماركداون عناوين الكتاب وقوائمه واقتباساته وروابطه والخط العريض. أما الصور فيُشار إليها بمسارها داخل الكتاب ولا تُستخرج — فهذه أداة نصّ.',
    titles: 'أضف عناوين الفصول',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'نزّل',
    preview: 'معاينة', whole: 'الكتاب كاملًا',
    again: 'اختر كتابًا آخر',
    errors: {
      'not-a-zip': 'هذا الملف ليس EPUB. فملف EPUB أرشيف مضغوط، وهذا ليس كذلك.',
      'not-epub': 'هذا الأرشيف ليس EPUB — إذ لا يحوي ‎META-INF/container.xml‎ يشير إلى ملف الحزمة.',
      'no-text': 'لم يُعثر على نص مقروء في هذا الكتاب. فالكتاب المصوَّر أو الممسوح ضوئيًا صورٌ لا نص، ولا شيء هنا لاستخراجه.',
      generic: 'تعذّرت قراءة هذا الملف.',
    } as Record<string, string>,
    drmNote: 'الكتاب المشترى من متجر يطبّق الحماية الرقمية مشفَّر، وسيتعذّر فتحه هنا أو لن يخرج منه شيء مقروء. تقرأ هذه الأداة الكتب التي لديك غير مشفَّرة؛ ولا تزيل الحماية عن شيء.',
    orderNote: 'تُعرض الفصول بالترتيب الذي يقول الكتاب أن يُقرأ به، لا بترتيب أسماء الملفات — فالفصل العاشر يسبق الثاني في ترتيب الأسماء.',
  },
}

export default function EpubTextTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [book, setBook] = useState<Book | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(-1) // -1 = whole book
  const [format, setFormat] = useState<'plain' | 'markdown'>('plain')
  const [withTitles, setWithTitles] = useState(true)
  const [copied, setCopied] = useState(false)

  async function pick(file: File | undefined | null) {
    if (!file) return
    setError('')
    setBusy(true)
    setBook(null)
    try {
      const b = await readEpub(await file.arrayBuffer())
      setBook(b)
      setName(file.name.replace(/\.[^.]+$/, ''))
      setSelected(-1)
      setWorkInProgress(WIP, true)
    } catch (e) {
      setError(s.errors[e instanceof Error ? e.message : ''] ?? s.errors.generic)
    } finally { setBusy(false) }
  }

  const output = useMemo(() => {
    if (!book) return ''
    if (selected >= 0) {
      const c = book.chapters[selected]
      if (!c) return ''
      return format === 'markdown' ? chapterToMarkdown(c) : (withTitles ? `${c.title}\n\n${c.text}` : c.text)
    }
    return format === 'markdown' ? bookToMarkdown(book) : bookToText(book, withTitles)
  }, [book, selected, format, withTitles])

  const totalWords = useMemo(() => book?.chapters.reduce((n, c) => n + c.words, 0) ?? 0, [book])

  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  function download() {
    const ext = format === 'markdown' ? 'md' : 'txt'
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name || 'book'}.${ext}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Stack data-testid="epub-text">
      {!book && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="ep-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {busy && <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="ep-reading"><Spinner /> {s.reading}</p>}
      {error && <FileError message={error} />}

      {book && (
        <>
          <Panel className="gap-2" data-testid="ep-meta">
            <h2 className="font-display text-[1.3rem] text-ink" data-testid="ep-title">{book.meta.title || '—'}</h2>
            {book.meta.authors.length > 0 && (
              <p className="text-[0.92rem] text-ink-soft" data-testid="ep-authors">{s.authors} {book.meta.authors.join(', ')}</p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-ink-faint">
              {book.meta.publisher && <span data-testid="ep-publisher">{s.publisher}: {book.meta.publisher}</span>}
              {book.meta.language && <span data-testid="ep-language">{s.language}: {book.meta.language}</span>}
              {book.meta.date && <span>{s.date}: {book.meta.date}</span>}
              {book.meta.identifier && <span className="font-mono" data-testid="ep-identifier">{book.meta.identifier}</span>}
            </div>
            <p className="text-[0.85rem] text-ink" data-testid="ep-total">{s.total(book.chapters.length, totalWords)}</p>
          </Panel>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.chapters}</h2>
            <div className="flex flex-wrap gap-2" data-testid="ep-chapters">
              <button onClick={() => setSelected(-1)} data-testid="ep-chapter-all"
                className={`px-3 py-1.5 rounded-md border text-[0.85rem] ${selected === -1 ? 'border-green-700 bg-green-600 text-sand-100' : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft'}`}>
                {s.whole}
              </button>
              {book.chapters.map((c, i) => (
                <button key={i} onClick={() => setSelected(i)} data-testid={`ep-chapter-${i}`}
                  className={`px-3 py-1.5 rounded-md border text-[0.85rem] ${selected === i ? 'border-green-700 bg-green-600 text-sand-100' : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft'}`}>
                  {c.title} <span className="opacity-70">· {c.words}</span>
                </button>
              ))}
            </div>
            <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.orderNote}</p>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Seg data-testid="ep-format">
              <SegButton active={format === 'plain'} onClick={() => setFormat('plain')} data-testid="ep-format-plain">{s.plain}</SegButton>
              <SegButton active={format === 'markdown'} onClick={() => setFormat('markdown')} data-testid="ep-format-markdown">{s.markdown}</SegButton>
            </Seg>
            {format === 'plain' && (
              <Check><input type="checkbox" checked={withTitles} data-testid="ep-titles" onChange={(e) => setWithTitles(e.target.checked)} /> {s.titles}</Check>
            )}
            <Button variant="primary" onClick={download} disabled={!output} data-testid="ep-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={copy} disabled={!output} data-testid="ep-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
          {format === 'markdown' && (
            <p className="text-[0.8rem] text-ink-faint rtl:font-ar" data-testid="ep-md-note">{s.mdNote}</p>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</h2>
            <pre className="overflow-x-auto max-h-[26rem] overflow-y-auto rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-3 text-[0.85rem] text-ink whitespace-pre-wrap" data-testid="ep-output">{output}</pre>
          </section>

          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.drmNote}</p></Panel>

          <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
            {s.again}
            <input type="file" className="hidden" data-testid="ep-file-again" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </>
      )}
    </Stack>
  )
}
