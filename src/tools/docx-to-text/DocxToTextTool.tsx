import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Check, Stack, Panel, FileError, Textarea } from '../../components/ui'
import { CopyIcon, DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { readDocx, type DocxText, type DocxError } from '../../lib/docx'

const WIP = 'docx-to-text'

const STR = {
  en: {
    pick: 'Choose a Word file',
    intro: 'Get the words out of a .docx as plain text — paragraphs kept, tables kept apart, ready to paste anywhere. The file is read in your browser and never uploaded.',
    result: 'Text',
    paragraphs: (n: number) => `${n} paragraph${n === 1 ? '' : 's'}`,
    extras: 'Also include headers, footers and footnotes',
    extrasNote: 'They repeat on every page, so they are left out of the body by default.',
    copy: 'Copy', copied: 'Copied!', download: 'Download',
    again: 'Choose another file',
    empty: 'The document has no text in it — only pictures or drawings, most likely.',
    err: {
      'not-zip': 'That file is not a .docx. Word files saved before 2007 are a different format entirely.',
      'not-docx': 'That is a ZIP, but not a Word document — there is no word/document.xml inside it.',
      'old-format': 'That is an old .doc file, not a .docx. Open it in Word or Google Docs and save it again as .docx, and it will read here.',
    } as Record<DocxError, string>,
  },
  ar: {
    pick: 'اختر ملف وورد',
    intro: 'استخرج نص ملف ‎.docx‎ نصًا عاديًا — تبقى الفقرات كما هي، وتبقى الجداول متباعدة، جاهزًا للصق في أي مكان. ويُقرأ الملف في متصفحك ولا يُرفع أبدًا.',
    result: 'النص',
    paragraphs: (n: number) => `${n} فقرة`,
    extras: 'أدرِج الرؤوس والتذييلات والحواشي',
    extrasNote: 'تتكرر في كل صفحة، لذا تُستثنى من المتن افتراضيًا.',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'نزّل',
    again: 'اختر ملفًا آخر',
    empty: 'لا نص في هذا المستند — على الأرجح ليس فيه إلا صور أو أشكال.',
    err: {
      'not-zip': 'هذا الملف ليس ‎.docx‎. وملفات وورد المحفوظة قبل 2007 صيغة أخرى تمامًا.',
      'not-docx': 'هذا ملف ZIP لكنه ليس مستند وورد — لا يوجد بداخله word/document.xml.',
      'old-format': 'هذا ملف ‎.doc‎ قديم لا ‎.docx‎. افتحه في وورد أو مستندات جوجل واحفظه من جديد بصيغة ‎.docx‎، وسيُقرأ هنا.',
    } as Record<DocxError, string>,
  },
}

export default function DocxToTextTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [name, setName] = useState('')
  const [doc, setDoc] = useState<DocxText | null>(null)
  const [withExtras, setWithExtras] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])

  async function pick(f: File | undefined | null) {
    if (!f) return
    setError('')
    setDoc(null)
    try {
      const result = await readDocx(f)
      if (typeof result === 'string') { setError(s.err[result]); return }
      setDoc(result)
      setName(f.name)
      setWorkInProgress(WIP, true)
    } catch {
      setError(s.err['not-zip'])
    }
  }

  const out = !doc ? '' : [
    doc.text,
    ...(withExtras ? doc.extras.map((e) => `--- ${e.part} ---\n${e.text}`) : []),
  ].filter(Boolean).join('\n\n')

  async function copy() {
    try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  function download() {
    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name.replace(/\.docx$/i, '') + '.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Stack data-testid="docx-to-text">
      {!doc && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="dx-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {error && <FileError message={error} />}

      {doc && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.result}</h2>
            <span className="text-[0.85rem] text-ink-faint" data-testid="dx-count">{s.paragraphs(doc.paragraphs)}</span>
            <Button className="px-3 py-1" onClick={copy} disabled={!out} data-testid="dx-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <Button className="px-3 py-1" onClick={download} disabled={!out} data-testid="dx-download"><DownloadIcon /> {s.download}</Button>
          </div>

          {doc.extras.length > 0 && (
            <div className="flex flex-col gap-1">
              <Check>
                <input type="checkbox" checked={withExtras} data-testid="dx-extras" onChange={(e) => setWithExtras(e.target.checked)} />
                {s.extras}
              </Check>
              <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.extrasNote}</span>
            </div>
          )}

          {!doc.text && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="dx-empty">{s.empty}</p>}

          {out && <Textarea readOnly rows={18} value={out} data-testid="dx-output" dir="auto" className="font-mono text-[0.85rem]" />}

          <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
            {s.again}
            <input type="file" className="hidden" data-testid="dx-file-again" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </>
      )}
    </Stack>
  )
}
