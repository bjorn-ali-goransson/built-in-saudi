import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Check, Stack, Panel, FileError, Textarea } from '../../components/ui'
import { CopyIcon, DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { readPptx, type Deck, type PptxError } from '../../lib/pptx'

const WIP = 'pptx-to-text'

const STR = {
  en: {
    pick: 'Choose a PowerPoint file',
    intro: 'Get the words out of a .pptx — every slide in order, with the speaker notes if you want them. Useful when you have the deck but not PowerPoint, or when what you actually need is the text to quote, translate or search. The file is read in your browser and never uploaded.',
    notes: 'Include speaker notes',
    notesHint: 'Notes are what the presenter saw, not the audience — so they are left out by default.',
    numbers: 'Number the slides',
    slides: (n: number) => `${n} slide${n === 1 ? '' : 's'}`,
    withNotes: (n: number) => `${n} with notes`,
    blank: (n: number) => `${n} with no text — pictures only, most likely`,
    slide: 'Slide',
    notesLabel: 'Notes',
    copy: 'Copy', copied: 'Copied!', download: 'Download',
    again: 'Choose another file',
    err: {
      'not-zip': 'That file is not a .pptx. A .ppt saved before 2007 is a different format entirely, and will not open here.',
      'not-pptx': 'That is a ZIP, but there are no slides inside it — so it is not a PowerPoint file.',
    } as Record<PptxError, string>,
  },
  ar: {
    pick: 'اختر ملف بوربوينت',
    intro: 'استخرج نص ملف ‎.pptx‎ — كل شريحة بترتيبها، ومعها ملاحظات المُقدِّم إن أردتها. مفيد حين يكون لديك العرض دون بوربوينت، أو حين يكون ما تريده حقًا هو النص لتقتبسه أو تترجمه أو تبحث فيه. ويُقرأ الملف في متصفحك ولا يُرفع أبدًا.',
    notes: 'أدرِج ملاحظات المُقدِّم',
    notesHint: 'الملاحظات ما يراه المُقدِّم لا الحضور، لذا تُستثنى افتراضيًا.',
    numbers: 'رقّم الشرائح',
    slides: (n: number) => `${n} شريحة`,
    withNotes: (n: number) => `${n} فيها ملاحظات`,
    blank: (n: number) => `${n} بلا نص — على الأرجح صور فقط`,
    slide: 'شريحة',
    notesLabel: 'ملاحظات',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'نزّل',
    again: 'اختر ملفًا آخر',
    err: {
      'not-zip': 'هذا الملف ليس ‎.pptx‎. وملف ‎.ppt‎ المحفوظ قبل 2007 صيغة أخرى تمامًا، ولن يُفتح هنا.',
      'not-pptx': 'هذا ملف ZIP لكن لا شرائح بداخله — فهو ليس ملف بوربوينت.',
    } as Record<PptxError, string>,
  },
}

export default function PptxToTextTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [name, setName] = useState('')
  const [deck, setDeck] = useState<Deck | null>(null)
  const [withNotes, setWithNotes] = useState(false)
  const [numbered, setNumbered] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])

  async function pick(f: File | undefined | null) {
    if (!f) return
    setError('')
    setDeck(null)
    try {
      const result = await readPptx(f)
      if (typeof result === 'string') { setError(s.err[result]); return }
      setDeck(result)
      setName(f.name)
      setWorkInProgress(WIP, true)
    } catch {
      setError(s.err['not-zip'])
    }
  }

  const out = !deck ? '' : deck.slides.map((sl) => {
    const head = numbered ? `--- ${s.slide} ${sl.number} ---` : ''
    const body = [sl.text, withNotes && sl.notes ? `[${s.notesLabel}] ${sl.notes}` : '']
      .filter(Boolean).join('\n')
    return [head, body].filter(Boolean).join('\n')
  }).filter(Boolean).join('\n\n')

  const notesCount = deck ? deck.slides.filter((sl) => sl.notes).length : 0

  async function copy() {
    try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  function download() {
    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name.replace(/\.pptx$/i, '') + '.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Stack data-testid="pptx-to-text">
      {!deck && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="pt-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {error && <FileError message={error} />}

      {deck && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[0.85rem] text-ink-faint" data-testid="pt-count">{s.slides(deck.slides.length)}</span>
            {notesCount > 0 && <span className="text-[0.85rem] text-ink-faint" data-testid="pt-notes-count">{s.withNotes(notesCount)}</span>}
            {deck.empty > 0 && <span className="text-[0.85rem] text-gold-500" data-testid="pt-empty">{s.blank(deck.empty)}</span>}
            <Button className="px-3 py-1" onClick={copy} disabled={!out} data-testid="pt-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <Button className="px-3 py-1" onClick={download} disabled={!out} data-testid="pt-download"><DownloadIcon /> {s.download}</Button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Check>
              <input type="checkbox" checked={withNotes} data-testid="pt-notes" onChange={(e) => setWithNotes(e.target.checked)} />
              {s.notes}
            </Check>
            <Check>
              <input type="checkbox" checked={numbered} data-testid="pt-numbers" onChange={(e) => setNumbered(e.target.checked)} />
              {s.numbers}
            </Check>
          </div>
          <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.notesHint}</p>

          <Textarea readOnly rows={18} value={out} data-testid="pt-output" dir="auto" className="font-mono text-[0.85rem]" />

          <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
            {s.again}
            <input type="file" className="hidden" data-testid="pt-file-again" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </>
      )}
    </Stack>
  )
}
