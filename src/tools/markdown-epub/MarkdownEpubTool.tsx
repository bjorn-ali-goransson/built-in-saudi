import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Select, Textarea, FileError } from '../../components/ui'
import { DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { parseMarkdown, inlineText } from '../../lib/markdown'
import { buildEpub, splitChapters } from '../../lib/writeEpub'

const WIP = 'markdown-epub'

const SAMPLE = `# The road to Najd

The desert began at the edge of the city, and ended nowhere anyone had walked.

- Water
- Shade
- A **good** camel

# The wells

She counted them from memory. Nine were dry, and one was *unnamed*.

> Water is the only wealth.
`

const LANGS = [
  ['en', 'English'], ['ar', 'العربية'], ['fr', 'Français'], ['es', 'Español'],
  ['de', 'Deutsch'], ['tr', 'Türkçe'], ['ur', 'اردو'], ['fa', 'فارسی'],
] as const

const STR = {
  en: {
    intro: 'Turn Markdown into a real EPUB — chapters split at your headings, a working table of contents, and your formatting carried across. Built in your browser, so an unpublished manuscript is never uploaded to anybody.',
    title: 'Title', author: 'Author', language: 'Language',
    text: 'Markdown', open: 'Open a .md file',
    download: 'Download the EPUB',
    chapters: 'Chapters',
    none: 'Nothing to convert yet.',
    rtlNote: 'This book will be written right-to-left — both the text direction and the page-turn direction. Most generators set the first and forget the second, which gives you a book that reads correctly and turns backwards.',
    splitNote: (n: number) => `Split at the shallowest heading level the document uses, which gives ${n} chapter${n === 1 ? '' : 's'}. A document written entirely in ## still becomes a book with chapters.`,
    tooBig: 'That file is larger than 4 MB. Paste the part you need instead.',
    notText: 'That file could not be read as text.',
  },
  ar: {
    intro: 'حوّل ماركداون إلى كتاب EPUB حقيقي — تُقسَّم الفصول عند عناوينك، مع فهرس يعمل، وينتقل تنسيقك كما هو. يُبنى في متصفحك، فلا تُرفع مخطوطة غير منشورة إلى أحد.',
    title: 'العنوان', author: 'المؤلف', language: 'اللغة',
    text: 'ماركداون', open: 'افتح ملف ‎.md‎',
    download: 'نزّل الكتاب',
    chapters: 'الفصول',
    none: 'لا شيء لتحويله بعد.',
    rtlNote: 'سيُكتب هذا الكتاب من اليمين إلى اليسار — اتجاه النص واتجاه تقليب الصفحات معًا. ومعظم المولّدات تضبط الأول وتنسى الثاني، فيخرج كتاب يُقرأ صحيحًا وتُقلَّب صفحاته بالمقلوب.',
    splitNote: (n: number) => `يُقسَّم عند أقل مستوى عنوان يستخدمه المستند، فينتج ${n} فصلًا. والمستند المكتوب كله بـ ## يصير كتابًا بفصول أيضًا.`,
    tooBig: 'هذا الملف أكبر من ٤ ميغابايت. الصق الجزء الذي تحتاجه بدلًا من ذلك.',
    notText: 'تعذّرت قراءة هذا الملف كنص.',
  },
}

export default function MarkdownEpubTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState(SAMPLE)
  const [title, setTitle] = useState(locale === 'ar' ? 'كتابي' : 'My book')
  const [author, setAuthor] = useState('')
  const [lang, setLang] = useState<string>(locale)
  const [error, setError] = useState('')

  const chapters = useMemo(
    () => splitChapters(parseMarkdown(text), title || 'Untitled'),
    [text, title],
  )
  const rtl = /^(ar|he|fa|ur)\b/i.test(lang)

  async function open(f: File | undefined) {
    if (!f) return
    setError('')
    // A bad pick must report why — a bare return turns "wrong file" into a dead
    // UI (#225). No `accept` filter, for the same reason.
    if (f.size > 4 * 1024 * 1024) { setError(s.tooBig); return }
    try {
      const t = await f.text()
      if (/�/.test(t.slice(0, 4096))) { setError(s.notText); return }
      setText(t)
      // The first heading is a better book title than the filename, and it is
      // what the writer would otherwise fall back to anyway.
      const first = parseMarkdown(t).find((b) => b.t === 'heading')
      setTitle(first ? inlineText(first.inline) : f.name.replace(/\.[^.]+$/, ''))
      setWorkInProgress(WIP, true)
    } catch { setError(s.notText) }
  }

  async function download() {
    const blob = await buildEpub({ title: title || 'Untitled', author, language: lang }, chapters)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'book').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) || 'book'}.epub`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Stack data-testid="markdown-epub">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3">
        <Field label={s.title}>
          <Input value={title} data-testid="me-title" onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={s.author}>
          <Input value={author} data-testid="me-author" onChange={(e) => setAuthor(e.target.value)} />
        </Field>
        <Field label={s.language}>
          <Select value={lang} data-testid="me-lang" onChange={(e) => setLang(e.target.value)}>
            {LANGS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 px-[1.15rem] py-[0.7rem] rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink font-semibold text-[0.9rem] cursor-pointer">
          <UploadIcon /> {s.open}
          <input type="file" className="hidden" data-testid="me-file" onChange={(e) => { void open(e.target.files?.[0]) }} />
        </label>
        <Button variant="primary" onClick={download} disabled={!chapters.length} data-testid="me-download">
          <DownloadIcon /> {s.download}
        </Button>
      </div>

      {error && <FileError message={error} />}

      <Textarea
        rows={14}
        value={text}
        data-testid="me-input"
        aria-label={s.text}
        className="font-mono text-[0.88rem]"
        onChange={(e) => { setText(e.target.value); setWorkInProgress(WIP, !!e.target.value) }}
      />

      <Panel className="gap-2">
        <div role="heading" aria-level={2} className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.chapters}</div>
        {chapters.length === 0
          ? <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="me-empty">{s.none}</p>
          : (
            <>
              {/* The chapter list IS the table of contents the reader will get,
                  so showing it here is showing the actual output rather than a
                  reassurance about it. */}
              <ol className="text-[0.9rem] text-ink-soft ps-5 list-decimal" data-testid="me-chapters">
                {chapters.map((c, i) => <li key={i} className="py-[0.1rem] rtl:font-ar">{c.title}</li>)}
              </ol>
              <p className="text-[0.82rem] text-ink-faint rtl:font-ar" data-testid="me-split-note">{s.splitNote(chapters.length)}</p>
            </>
          )}
      </Panel>

      {rtl && (
        <Panel className="border-gold-500">
          <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="me-rtl-note">{s.rtlNote}</p>
        </Panel>
      )}
    </Stack>
  )
}
