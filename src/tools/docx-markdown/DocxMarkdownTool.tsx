import { useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Textarea, FileError, Spinner, Check } from '../../components/ui'
import { CopyIcon, DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { elementToMd, parseClean } from '../../lib/htmlToMd'

const WIP = 'docx-markdown'

const STR = {
  en: {
    intro: 'Turn a Word document into Markdown — headings, bold, lists, tables, quotes and links all survive as Markdown, not as flattened prose. Read in your browser; the document is never uploaded, which matters when it is a contract or a draft nobody else should see.',
    pick: 'Choose a .docx',
    reading: 'Reading the document…',
    another: 'Choose another',
    copy: 'Copy', copied: 'Copied!', download: 'Download .md',
    words: (n: number) => `${n.toLocaleString('en')} words`,
    keepImages: 'Keep image placeholders',
    imagesNote: 'A picture cannot be written into a Markdown file, so an image becomes a placeholder naming its alt text — dropping it silently would lose the fact that something was there.',
    inverse: 'Go the other way: Markdown to Word',
    errors: {
      'not-docx': 'That is not a Word document. A .doc from before 2007 is a different format entirely — save it as .docx in Word first.',
      generic: 'That document could not be read.',
    } as Record<string, string>,
    old: 'That looks like an old .doc file (pre-2007), which is a completely different format — it is not a zip of XML. Open it in Word and save it as .docx.',
  },
  ar: {
    intro: 'حوّل مستند وورد إلى ماركداون — فتبقى العناوين والخط العريض والقوائم والجداول والاقتباسات والروابط ماركداون، لا نصًّا مسطَّحًا. تجري القراءة في متصفحك؛ ولا يُرفع المستند أبدًا، وهذا ما يهم حين يكون عقدًا أو مسودةً لا ينبغي أن يراها أحد.',
    pick: 'اختر ملف ‎.docx‎',
    reading: 'جارٍ قراءة المستند…',
    another: 'اختر آخر',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'نزّل ‎.md‎',
    words: (n: number) => `${n.toLocaleString('ar')} كلمة`,
    keepImages: 'أبقِ إشارات الصور',
    imagesNote: 'لا يمكن كتابة صورة داخل ملف ماركداون، فتتحوّل الصورة إلى إشارة تحمل نصّها البديل — وحذفها بصمت يُفقد المستند أن شيئًا كان هناك.',
    inverse: 'الاتجاه الآخر: ماركداون إلى وورد',
    errors: {
      'not-docx': 'هذا ليس مستند وورد. وملف ‎.doc‎ لما قبل ٢٠٠٧ صيغة مختلفة تمامًا — احفظه أولًا بصيغة ‎.docx‎ من وورد.',
      generic: 'تعذّرت قراءة هذا المستند.',
    } as Record<string, string>,
    old: 'يبدو هذا ملف ‎.doc‎ قديمًا (ما قبل ٢٠٠٧)، وهو صيغة مختلفة تمامًا — فليس أرشيف XML مضغوطًا. افتحه في وورد واحفظه بصيغة ‎.docx‎.',
  },
}

export default function DocxMarkdownTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [md, setMd] = useState('')
  const [name, setName] = useState('document')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [keepImages, setKeepImages] = useState(true)
  const [copied, setCopied] = useState(false)

  async function pick(f: File | undefined) {
    if (!f) return
    setError(''); setMd(''); setBusy(true)
    try {
      const buf = await f.arrayBuffer()
      // A .doc is an OLE compound file, not a zip — it starts D0CF11E0. Saying
      // so beats "could not be read", which sends people back to try the same
      // file again. Same check `lib/docx.ts` makes.
      const head = new Uint8Array(buf.slice(0, 4))
      if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) {
        setError(s.old); return
      }
      // Heavy, so it is only fetched once a document is actually picked — the
      // same arrangement the CV tool uses.
      // @ts-expect-error - the browser build ships no types, as in cv-generator
      const mammoth = (await import('mammoth/mammoth.browser')).default
      // convertToHtml, NOT mammoth's own convertToMarkdown: ours keeps tables,
      // which mammoth's writer does not, and it is the converter this site
      // already tests. Measured on a round trip, not assumed — see the spec.
      const res = await mammoth.convertToHtml({ arrayBuffer: buf })
      const body = parseClean(res.value)
      if (!keepImages) body.querySelectorAll('img').forEach((n) => n.remove())
      setMd(elementToMd(body))
      setName(f.name.replace(/\.[^.]+$/, '') || 'document')
      setWorkInProgress(WIP, true)
    } catch {
      setError(s.errors['not-docx'])
    } finally { setBusy(false) }
  }

  const words = md.trim() ? md.trim().split(/\s+/).length : 0

  async function copy() {
    try { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  function download() {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.md`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Stack data-testid="docx-markdown">
      <Panel className="gap-3">
        <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {md ? s.another : s.pick}
            {/* No accept filter — Android's picker hides files it has not indexed. */}
            <input type="file" className="hidden" data-testid="dm-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
          <Check><input type="checkbox" checked={keepImages} data-testid="dm-images" onChange={(e) => setKeepImages(e.target.checked)} /> {s.keepImages}</Check>
        </div>
      </Panel>

      {busy && <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="dm-reading"><Spinner /> {s.reading}</p>}
      {error && <FileError message={error} />}

      {md && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[0.85rem] text-ink-faint" data-testid="dm-words">{s.words(words)}</span>
            <Button className="px-3 py-1" onClick={copy} data-testid="dm-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <Button className="px-3 py-1" onClick={download} data-testid="dm-download"><DownloadIcon /> {s.download}</Button>
          </div>
          <Textarea readOnly rows={18} value={md} data-testid="dm-output" dir="auto" className="font-mono text-[0.85rem]" />
          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="dm-images-note">{s.imagesNote}</p></Panel>
        </>
      )}

      <Button className="self-start px-3 py-1" to={localePath(locale, '/apps/markdown-docx')} data-testid="dm-inverse">{s.inverse}</Button>
    </Stack>
  )
}
