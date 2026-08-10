import { useMemo, useRef, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Seg, SegButton, Check, Textarea, FileError } from '../../components/ui'
import { DownloadIcon, UploadIcon, CopyIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { parseMarkdown, inlineText } from '../../lib/markdown'
import { blocksToHtml, htmlDocument } from '../../lib/blocksToHtml'

const WIP = 'markdown-html'

const SAMPLE = `# The road to Najd

The desert began at the edge of the city, and ended **nowhere** anyone had
walked. See [the survey](https://example.com/wells) for the count.

## What we carried

- Water
- Shade
- A *good* camel

1. Leave before dawn
2. Rest at noon

> Water is the only wealth.

| Well | Depth |
| --- | --- |
| Umm Salim | 14 m |
| Al-Hazm | 31 m |

\`\`\`js
const wells = load('najd.json')
\`\`\`
`

const STR = {
  en: {
    intro: 'Turn Markdown into HTML — a fragment to paste into a page, or a standalone file you can open. It runs in your browser, so a draft you have not published yet is not uploaded anywhere.',
    input: 'Markdown', open: 'Open a .md file',
    mode: 'Output', fragment: 'Fragment', standalone: 'Standalone file',
    anchors: 'Give headings an id, so sections can be linked to',
    styles: 'Include a small stylesheet',
    title: 'Title', lang: 'Language', rtl: 'Right to left',
    copy: 'Copy', copied: 'Copied', download: 'Download .html',
    preview: 'Preview', code: 'HTML',
    empty: 'Nothing to convert yet.',
    counts: (b: number, w: number) => `${b} blocks · ${w} words`,
    safeTitle: 'Raw HTML does not pass through, and that is deliberate here',
    safeBody: 'A <script> tag in your Markdown comes out as visible text, not as a script — the parser has no HTML node, so anything that looks like a tag is treated as words and escaped. Most converters pass raw HTML straight through, which is fine in your own editor and an injection vector the moment the Markdown came from somebody else. It is a limitation as much as a safeguard: if you need raw HTML to survive, this is not the tool.',
    linkTitle: 'A link’s address is checked, not just its text',
    linkBody: 'Escaping the text of a document and then writing whatever it said into an href has escaped nothing: javascript: and data:text/html in a link are the other half of the same problem. Anything that is not plainly http, https, mailto, tel or a relative path is dropped, and the label is kept — losing that as well would lose something the document had.',
    rtlTitle: 'Arabic needs both dir and lang',
    rtlBody: 'Setting the language alone gives a document that reads correctly to a screen reader and runs its text the wrong way; setting the direction alone gives the reverse. Both are written when you choose a right-to-left language.',
    inverse: 'The other direction: Paste to Markdown',
    docx: 'Markdown to Word',
    tooBig: 'That file is larger than 2 MB. Paste the part you need instead.',
    notText: 'That file could not be read as text.',
  },
  ar: {
    intro: 'حوّل ماركداون إلى HTML — مقطعًا تلصقه في صفحة، أو ملفًا مستقلًا تفتحه. يعمل في متصفحك، فمسودّة لم تنشرها بعد لا تُرفع إلى أي مكان.',
    input: 'ماركداون', open: 'افتح ملف ‎.md‎',
    mode: 'المخرجات', fragment: 'مقطع', standalone: 'ملف مستقل',
    anchors: 'أعطِ العناوين معرّفات ليمكن الربط بالأقسام',
    styles: 'أدرج تنسيقًا بسيطًا',
    title: 'العنوان', lang: 'اللغة', rtl: 'من اليمين إلى اليسار',
    copy: 'نسخ', copied: 'نُسخ', download: 'نزّل ‎.html‎',
    preview: 'معاينة', code: 'HTML',
    empty: 'لا شيء لتحويله بعد.',
    counts: (b: number, w: number) => `${b} كتلة · ${w} كلمة`,
    safeTitle: 'الوسوم الخام لا تمرّ، وهذا مقصود هنا',
    safeBody: 'وسم <script> في ماركداون يخرج نصًّا ظاهرًا لا شيفرة تعمل — فالمحلّل لا يعرف عقدة HTML، وكل ما يشبه الوسم يُعامل كلماتٍ ويُهرَّب. وأكثر المحوّلات تمرّر الوسوم الخام كما هي، وهذا مقبول في محرّرك الخاص وثغرة حقن ما إن يأتي النص من غيرك. وهو قيد بقدر ما هو حماية: فإن احتجت بقاء الوسوم الخام فليست هذه الأداة.',
    linkTitle: 'عنوان الرابط يُفحص لا نصّه فقط',
    linkBody: 'تهريب نصّ المستند ثم كتابة ما قاله في خانة href لم يهرّب شيئًا: فـjavascript: وdata:text/html في الرابط هما النصف الآخر من المشكلة نفسها. وكل ما ليس http أو https أو mailto أو tel أو مسارًا نسبيًا يُسقط مع إبقاء النص — فإسقاطه أيضًا يضيّع ما كان في المستند.',
    rtlTitle: 'العربية تحتاج dir وlang معًا',
    rtlBody: 'ضبط اللغة وحدها يعطي مستندًا يُقرأ صحيحًا لقارئ الشاشة ويجري نصّه في الاتجاه الخطأ؛ وضبط الاتجاه وحده يعطي العكس. ويُكتب الاثنان حين تختار لغة تُكتب من اليمين.',
    inverse: 'الاتجاه الآخر: ألصق كـماركداون',
    docx: 'ماركداون إلى وورد',
    tooBig: 'هذا الملف أكبر من ٢ ميغابايت. ألصق الجزء الذي تحتاجه بدلًا منه.',
    notText: 'تعذّرت قراءة هذا الملف كنص.',
  },
}

const RTL_LANGS = new Set(['ar', 'fa', 'ur', 'he'])
const LANGS = [
  ['en', 'English'], ['ar', 'العربية'], ['fr', 'Français'], ['es', 'Español'],
  ['de', 'Deutsch'], ['tr', 'Türkçe'], ['ur', 'اردو'], ['fa', 'فارسی'],
] as const

export default function MarkdownHtmlTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [src, setSrc] = useState(SAMPLE)
  const [standalone, setStandalone] = useState(false)
  const [anchors, setAnchors] = useState(true)
  const [styles, setStyles] = useState(true)
  const [title, setTitle] = useState('')
  const [lang, setLang] = useState('en')
  const [view, setView] = useState<'code' | 'preview'>('code')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const blocks = useMemo(() => parseMarkdown(src), [src])
  const rtl = RTL_LANGS.has(lang)

  const body = useMemo(() => blocksToHtml(blocks, { anchors }), [blocks, anchors])
  // The document's own first heading is the obvious title, so it does not have
  // to be typed twice.
  const firstHeading = useMemo(() => {
    const h = blocks.find((b) => b.t === 'heading')
    return h && h.t === 'heading' ? inlineText(h.inline) : ''
  }, [blocks])

  const out = useMemo(
    () => (standalone
      ? htmlDocument(body, { title: title || firstHeading, lang, rtl, styles })
      : body),
    [body, standalone, title, firstHeading, lang, rtl, styles],
  )

  const words = useMemo(() => {
    const t = src.trim()
    return t ? t.split(/\s+/).length : 0
  }, [src])

  async function pick(file?: File | null) {
    if (!file) return
    setError('')
    if (file.size > 2 * 1024 * 1024) { setError(s.tooBig); return }
    try {
      setSrc(await file.text())
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
      setWorkInProgress(WIP, true)
    } catch { setError(s.notText) }
  }

  function save() {
    const blob = new Blob([out], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(title || 'document').replace(/[^\w؀-ۿ -]+/g, '') || 'document'}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Stack data-testid="markdown-html">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Field label={s.input}>
        <Textarea rows={10} value={src} data-testid="mh-input" className="font-mono text-[0.85rem]"
          onChange={(e) => { setSrc(e.target.value); setWorkInProgress(WIP, !!e.target.value.trim()) }} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" className="hidden" data-testid="mh-file"
          onChange={(e) => void pick(e.target.files?.[0])} />
        <Button className="px-3 py-1" onClick={() => inputRef.current?.click()}><UploadIcon /> {s.open}</Button>
        <Seg>
          <SegButton active={!standalone} data-testid="mh-fragment" onClick={() => setStandalone(false)}>{s.fragment}</SegButton>
          <SegButton active={standalone} data-testid="mh-standalone" onClick={() => setStandalone(true)}>{s.standalone}</SegButton>
        </Seg>
        <Check><input type="checkbox" checked={anchors} data-testid="mh-anchors" onChange={(e) => setAnchors(e.target.checked)} /> {s.anchors}</Check>
      </div>

      {error && <FileError message={error} />}

      {standalone && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={s.title}>
            <Input className="w-[12rem]" value={title} data-testid="mh-title" onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={s.lang}>
            <select className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 py-[0.45rem] text-[0.9rem] text-ink"
              value={lang} data-testid="mh-lang" onChange={(e) => setLang(e.target.value)}>
              {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Check><input type="checkbox" checked={styles} data-testid="mh-styles" onChange={(e) => setStyles(e.target.checked)} /> {s.styles}</Check>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Seg>
          <SegButton active={view === 'code'} data-testid="mh-view-code" onClick={() => setView('code')}>{s.code}</SegButton>
          <SegButton active={view === 'preview'} data-testid="mh-view-preview" onClick={() => setView('preview')}>{s.preview}</SegButton>
        </Seg>
        <Button className="px-3 py-1" data-testid="mh-copy"
          onClick={() => { void navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
          <CopyIcon /> {copied ? s.copied : s.copy}
        </Button>
        <Button variant="primary" className="px-3 py-1" onClick={save} data-testid="mh-download">
          <DownloadIcon /> {s.download}
        </Button>
        <span className="font-mono text-[0.82rem] text-ink-faint" data-testid="mh-counts">{s.counts(blocks.length, words)}</span>
      </div>

      {view === 'code' ? (
        <Textarea rows={12} readOnly value={out} data-testid="mh-output" className="font-mono text-[0.8rem]" />
      ) : (
        // The preview renders OUR OWN escaped output, which is the only thing
        // that makes this safe to inject: nothing here came from the source
        // document unescaped, by construction.
        <div className="rounded-[var(--r-md)] border border-[color:var(--line)] bg-[var(--surface)] p-4 overflow-x-auto
          [&_h1]:text-[1.5rem] [&_h2]:text-[1.2rem] [&_h3]:text-[1.05rem] [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal
          [&_ul]:ps-6 [&_ol]:ps-6 [&_blockquote]:border-s-2 [&_blockquote]:border-[color:var(--line)] [&_blockquote]:ps-3
          [&_pre]:bg-[var(--bg)] [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_table]:w-full
          [&_th]:border [&_td]:border [&_th]:border-[color:var(--line-soft)] [&_td]:border-[color:var(--line-soft)]
          [&_th]:p-1.5 [&_td]:p-1.5 [&_a]:text-green-700"
          data-testid="mh-preview"
          dangerouslySetInnerHTML={{ __html: body }} />
      )}

      {!blocks.length && <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="mh-empty">{s.empty}</p>}

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.safeTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="mh-safe">{s.safeBody}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.linkTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="mh-links">{s.linkBody}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.rtlTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="mh-rtl-note">{s.rtlBody}</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button className="px-3 py-1" to={localePath(locale, '/apps/paste-to-markdown')} data-testid="mh-inverse">{s.inverse}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/markdown-docx')} data-testid="mh-docx">{s.docx}</Button>
      </div>
    </Stack>
  )
}
