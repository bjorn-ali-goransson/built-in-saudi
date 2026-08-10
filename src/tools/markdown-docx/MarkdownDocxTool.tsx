import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Stack, Panel, Textarea, FileError } from '../../components/ui'
import { DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { parseMarkdown, inlineText, type Block } from '../../lib/markdown'
import { blocksToDocx } from '../../lib/writeDocx'

const WIP = 'markdown-docx'

const SAMPLE = `# Quarterly report

A short **summary** of the quarter, with a [link](https://example.com) and some \`inline code\`.

## What changed

- Revenue up 12%
- Two new suppliers
  - one in Jeddah
  - one in Dammam

1. Close the books
2. Send the summary

> Nothing here is uploaded anywhere.

| Region | Units |
| --- | --- |
| Riyadh | 1,204 |
| Jeddah | 880 |

---

\`\`\`
npm run build
\`\`\`
`

const STR = {
  en: {
    intro: 'Turn Markdown into a real Word document — headings, bold, lists, tables, quotes and code all survive as Word formatting, not as asterisks. Written in your browser: the text is never uploaded, which matters when the document is a contract or a report.',
    input: 'Markdown',
    open: 'Open a .md file',
    download: 'Download .docx',
    empty: 'Nothing to convert yet.',
    outline: 'What Word will get',
    counts: (b: number, w: number) => `${b} blocks · ${w} words`,
    kinds: {
      heading: 'Heading', para: 'Paragraph', list: 'List', quote: 'Quote', code: 'Code', rule: 'Divider', table: 'Table',
    } as Record<Block['t'], string>,
    tooBig: 'That file is larger than 2 MB. Paste the part you need instead.',
    notText: 'That file could not be read as text.',
    linkNote: 'A link keeps its text and its address, written out beside it — this writer emits no relationship part, and dropping the address would lose something the document had.',
  },
  ar: {
    intro: 'حوّل ماركداون إلى مستند وورد حقيقي — تبقى العناوين والخط العريض والقوائم والجداول والاقتباسات والشيفرة تنسيقًا في وورد، لا نجومًا في النص. تجري الكتابة في متصفحك: ولا يُرفع النص أبدًا، وهذا ما يهم حين يكون المستند عقدًا أو تقريرًا.',
    input: 'ماركداون',
    open: 'افتح ملف ‎.md‎',
    download: 'نزّل ‎.docx‎',
    empty: 'لا شيء لتحويله بعد.',
    outline: 'ما سيصل إلى وورد',
    counts: (b: number, w: number) => `${b} كتلة · ${w} كلمة`,
    kinds: {
      heading: 'عنوان', para: 'فقرة', list: 'قائمة', quote: 'اقتباس', code: 'شيفرة', rule: 'فاصل', table: 'جدول',
    } as Record<Block['t'], string>,
    tooBig: 'هذا الملف أكبر من ٢ ميغابايت. الصق الجزء الذي تحتاجه بدلًا من ذلك.',
    notText: 'تعذّرت قراءة هذا الملف كنص.',
    linkNote: 'يحتفظ الرابط بنصّه وعنوانه مكتوبًا بجانبه — فهذا الكاتب لا يُخرج جزء العلاقات، وحذف العنوان يُفقد المستند شيئًا كان فيه.',
  },
}

export default function MarkdownDocxTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState(SAMPLE)
  const [name, setName] = useState('document')
  const [error, setError] = useState('')

  const blocks = useMemo(() => parseMarkdown(text), [text])
  const words = useMemo(
    () => text.trim() ? text.trim().split(/\s+/).length : 0,
    [text],
  )

  async function open(f: File | undefined) {
    if (!f) return
    setError('')
    // A bad pick must report why — a bare return turns "wrong file" into a
    // dead UI (#225). No `accept` filter, for the same reason.
    if (f.size > 2 * 1024 * 1024) { setError(s.tooBig); return }
    try {
      const t = await f.text()
      // A binary file read as text comes back full of replacement characters
      // rather than throwing, so it is checked rather than assumed.
      if (/�/.test(t.slice(0, 4096))) { setError(s.notText); return }
      setText(t)
      setName(f.name.replace(/\.[^.]+$/, '') || 'document')
      setWorkInProgress(WIP, true)
    } catch { setError(s.notText) }
  }

  async function download() {
    const blob = await blocksToDocx(blocks)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // The first heading names the file when there is one — a downloads folder
    // full of "document.docx" is the thing this saves you from.
    const h = blocks.find((b) => b.t === 'heading')
    a.download = `${(h ? inlineText(h.inline) : name).replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) || 'document'}.docx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Stack data-testid="markdown-docx">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 px-[1.15rem] py-[0.7rem] rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink font-semibold text-[0.9rem] cursor-pointer">
          <UploadIcon /> {s.open}
          <input type="file" className="hidden" data-testid="md-file" onChange={(e) => { void open(e.target.files?.[0]) }} />
        </label>
        <Button variant="primary" onClick={download} disabled={!blocks.length} data-testid="md-download">
          <DownloadIcon /> {s.download}
        </Button>
      </div>

      {error && <FileError message={error} />}

      <Textarea
        rows={16}
        value={text}
        data-testid="md-input"
        aria-label={s.input}
        className="font-mono text-[0.88rem]"
        onChange={(e) => { setText(e.target.value); setWorkInProgress(WIP, !!e.target.value) }}
      />

      <Panel className="gap-2">
        <div role="heading" aria-level={2} className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.outline}</div>
        {blocks.length === 0
          ? <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="md-empty">{s.empty}</p>
          : (
            <>
              <p className="text-[0.85rem] text-ink-faint font-mono" data-testid="md-counts">{s.counts(blocks.length, words)}</p>
              {/* The outline is the honest preview: it shows what the writer
                  understood, which is the thing that can be wrong — a rendered
                  imitation of Word would look right and prove nothing. */}
              <ul className="flex flex-wrap gap-1.5" data-testid="md-outline">
                {blocks.map((b, i) => (
                  <li key={i} data-kind={b.t}
                    className="rounded-sm border border-[color:var(--line-soft)] bg-[color-mix(in_srgb,var(--green-400)_8%,transparent)] px-[0.45rem] py-[0.15rem] text-[0.75rem] text-ink-soft rtl:font-ar">
                    {s.kinds[b.t]}{b.t === 'heading' ? ` ${b.level}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
      </Panel>

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="md-link-note">{s.linkNote}</p></Panel>
    </Stack>
  )
}
