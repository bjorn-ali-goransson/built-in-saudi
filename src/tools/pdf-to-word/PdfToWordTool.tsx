import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, FileError, PdfPassword } from '../../components/ui'
import { DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { inlineText, type Block } from '../../lib/markdown'
import { blocksToDocx } from '../../lib/writeDocx'
import { extractRuns } from './extractRuns'
import { pdfToBlocks } from './pdfBlocks'

const WIP = 'pdf-to-word'

const STR = {
  en: {
    intro: 'Turn a PDF into an editable Word document — headings, bold and lists recovered, not one flat block of text. It runs entirely in your browser: the file is never uploaded, which is the whole point on a contract, a payslip or a medical letter.',
    pick: 'Choose a PDF',
    drop: 'or drop one here',
    reading: 'Reading…',
    download: 'Download .docx',
    outline: 'What Word will get',
    counts: (b: number, w: number, p: number) => `${b} blocks · ${w} words · ${p} page${p === 1 ? '' : 's'}`,
    kinds: {
      heading: 'Heading', para: 'Paragraph', list: 'List', quote: 'Quote', code: 'Code', rule: 'Divider', table: 'Table',
    } as Record<Block['t'], string>,
    notPdf: 'That file could not be read as a PDF.',
    empty: 'No text came out of that PDF.',
    scannedTitle: 'This looks like a scan',
    scannedBody: 'There is almost no text in this PDF, which means the pages are pictures. A Word file made from it would be empty. Read it with OCR first — that also runs on your device.',
    ocr: 'Scanned PDF to Text (OCR)',
    limitTitle: 'What survives, and what does not',
    limitBody: 'A PDF has no paragraphs, headings or lists — it has characters at coordinates in fonts. So this infers the structure: a line larger than the body text becomes a heading, a line ending mid-sentence joins the one before it, and a bullet or a number starts a real Word list. What it does NOT carry over is images, the exact page layout, and a table as a table. The upload sites promise a faithful reproduction and need a server to half-manage it; this gives you the text and its shape, to edit.',
    inverse: 'The other direction: Markdown to Word',
    text: 'Just the plain text: PDF to Text',
  },
  ar: {
    intro: 'حوّل ملف PDF إلى مستند وورد قابل للتحرير — تُستعاد العناوين والخط العريض والقوائم، لا كتلة نصّ واحدة. يعمل بالكامل داخل متصفحك: ولا يُرفع الملف أبدًا، وهذا هو المقصود كله في عقد أو قسيمة راتب أو تقرير طبي.',
    pick: 'اختر ملف PDF',
    drop: 'أو أفلته هنا',
    reading: 'جارٍ القراءة…',
    download: 'نزّل ‎.docx‎',
    outline: 'ما سيصل إلى وورد',
    counts: (b: number, w: number, p: number) => `${b} كتلة · ${w} كلمة · ${p} صفحة`,
    kinds: {
      heading: 'عنوان', para: 'فقرة', list: 'قائمة', quote: 'اقتباس', code: 'شيفرة', rule: 'فاصل', table: 'جدول',
    } as Record<Block['t'], string>,
    notPdf: 'تعذّرت قراءة هذا الملف كملف PDF.',
    empty: 'لم يخرج أي نصّ من هذا الملف.',
    scannedTitle: 'يبدو أن هذا ملف ممسوح ضوئيًا',
    scannedBody: 'لا يكاد يوجد نصّ في هذا الملف، أي أن صفحاته صور. ومستند وورد المصنوع منه سيكون فارغًا. اقرأه أولًا بالتعرّف الضوئي على الحروف — وهو أيضًا يعمل على جهازك.',
    ocr: 'استخراج نص من PDF ممسوح',
    limitTitle: 'ما يبقى وما لا يبقى',
    limitBody: 'ملف PDF لا يحوي فقرات ولا عناوين ولا قوائم — بل حروفًا في إحداثيات بخطوط. فهذه الأداة تستنتج البنية: السطر الأكبر من نصّ المتن يصير عنوانًا، والسطر المنتهي في وسط الجملة ينضمّ إلى ما قبله، والنقطة أو الرقم في أول السطر يبدأ قائمة وورد حقيقية. أما ما لا ينتقل فهو الصور وتخطيط الصفحة الدقيق والجدول بوصفه جدولًا. مواقع الرفع تَعِد بنسخة طبق الأصل وتحتاج خادمًا لتدبير نصفها؛ وهذه تعطيك النصّ وشكله، لتحرّره.',
    inverse: 'الاتجاه الآخر: ماركداون إلى وورد',
    text: 'النصّ المجرّد فقط: PDF إلى نص',
  },
}

export default function PdfToWordTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [name, setName] = useState('')
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [pages, setPages] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scanned, setScanned] = useState(false)
  const [locked, setLocked] = useState(false)
  const [wrong, setWrong] = useState(false)
  const fileRef = useRef<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => setWorkInProgress(WIP, false), [])

  const run = useCallback(async (file: File, password?: string) => {
    setBusy(true)
    setError('')
    try {
      const r = await extractRuns(file, password)
      if (r.encrypted) {
        // The two cases are different things to be told: repeating "this is
        // locked" after a wrong attempt makes a correct retry look futile.
        setLocked(true)
        setWrong(!!r.wrongPassword)
        setBlocks(null)
        return
      }
      setLocked(false)
      setWrong(false)
      setScanned(r.looksScanned)
      const b = r.looksScanned ? [] : pdfToBlocks(r.pages)
      setBlocks(b)
      setPages(r.pages.length)
      setWorkInProgress(WIP, b.length > 0)
    } catch {
      setError(s.notPdf)
      setBlocks(null)
    } finally {
      setBusy(false)
    }
  }, [s.notPdf])

  // No `accept` and no MIME gate: Android hands over files with an empty type,
  // and the library is the authority on whether this is a PDF.
  const pick = (file?: File | null) => {
    if (!file) return
    fileRef.current = file
    setName(file.name)
    setLocked(false)
    setWrong(false)
    void run(file)
  }

  const save = () => {
    if (!blocks?.length) return
    const blob = blocksToDocx(blocks)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name.replace(/\.pdf$/i, '') || 'document'}.docx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const words = blocks
    ? blocks.reduce((n, b) => {
      const text = b.t === 'code' ? b.text
        : b.t === 'list' ? b.items.map((i) => inlineText(i.inline)).join(' ')
          : b.t === 'table' ? b.rows.flat().map(inlineText).join(' ')
            : b.t === 'rule' ? '' : inlineText(b.inline)
      return n + (text.trim() ? text.trim().split(/\s+/).length : 0)
    }, 0)
    : 0

  return (
    <Stack data-testid="pdf-to-word">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div
        data-testid="ptw-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]) }}
        className="flex flex-col items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[color:var(--line)] bg-[var(--surface)] px-4 py-8"
      >
        <input ref={inputRef} type="file" className="hidden" data-testid="ptw-file"
          onChange={(e) => pick(e.target.files?.[0])} />
        <Button className="px-3 py-1" onClick={() => inputRef.current?.click()}>
          <UploadIcon /> {s.pick}
        </Button>
        <span className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.drop}</span>
        {name && <span className="font-mono text-[0.82rem] text-ink-soft" data-testid="ptw-name">{name}</span>}
      </div>

      {busy && <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="ptw-busy">{s.reading}</p>}
      {error && <FileError message={error} />}

      {locked && (
        <PdfPassword
          locale={locale}
          wrong={wrong}
          busy={busy}
          testid="ptw-password"
          onSubmit={(pw) => { if (fileRef.current) void run(fileRef.current, pw) }}
        />
      )}

      {scanned && (
        <Panel className="gap-1 border-gold-500">
          <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.scannedTitle}</div>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ptw-scanned">{s.scannedBody}</p>
          <Button className="self-start px-3 py-1 mt-1" to={localePath(locale, '/apps/pdf-ocr')} data-testid="ptw-ocr">{s.ocr}</Button>
        </Panel>
      )}

      {blocks && !scanned && (
        blocks.length ? (
          <>
            <Button className="self-start px-3 py-1" onClick={save} data-testid="ptw-download">
              <DownloadIcon /> {s.download}
            </Button>
            {/* The outline, so what was inferred can be checked before it is
                downloaded — the structure is a guess and the reader should be
                able to see the guess. */}
            <Panel className="gap-2">
              <div role="heading" aria-level={2} className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.outline}</div>
              <div className="font-mono text-[0.82rem] text-ink-faint" data-testid="ptw-counts">{s.counts(blocks.length, words, pages)}</div>
              <ul className="flex flex-col gap-[0.15rem] max-h-[18rem] overflow-y-auto text-[0.85rem]" data-testid="ptw-outline">
                {blocks.slice(0, 200).map((b, i) => (
                  <li key={i} className="flex gap-3" data-testid={`ptw-block-${b.t}`}>
                    <span className="w-[5.5rem] shrink-0 text-[0.72rem] uppercase tracking-[0.04em] text-green-700 rtl:font-ar">
                      {s.kinds[b.t]}{b.t === 'heading' ? ` ${b.level}` : ''}
                    </span>
                    <span className="truncate text-ink-soft">
                      {b.t === 'rule' ? '—'
                        : b.t === 'code' ? b.text
                          : b.t === 'list' ? b.items.map((it) => inlineText(it.inline)).join(' · ')
                            : b.t === 'table' ? b.rows[0]?.map(inlineText).join(' | ')
                              : inlineText(b.inline)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        ) : <FileError message={s.empty} />
      )}

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.limitTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ptw-limits">{s.limitBody}</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button className="px-3 py-1" to={localePath(locale, '/apps/markdown-docx')} data-testid="ptw-inverse">{s.inverse}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/pdf-to-text')} data-testid="ptw-text">{s.text}</Button>
      </div>
    </Stack>
  )
}
