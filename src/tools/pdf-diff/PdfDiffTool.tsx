import { useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Stack, Panel, FileError } from '../../components/ui'
import { extractPdf } from '../pdf-to-text/extract'
import { changeShare, diffDocuments, linesFromPages, type Chunk } from '../../lib/wordDiff'

const STR = {
  en: {
    intro: 'Compare two versions of a PDF and see exactly which words changed. Neither file leaves your browser.',
    a: 'The original', b: 'The new version',
    reading: 'Reading…', pick: 'Choose a PDF',
    changed: (n: number) => `${n.toFixed(1)}% of the words differ`,
    identical: 'The text of these two PDFs is identical.',
    onlyChanges: 'Only the changes', withContext: 'With the text around them',
    page: (n: number) => `page ${n}`,
    added: 'added', removed: 'removed',
    scanned: 'One of these is a scan — there is no text in it to compare. Read it with OCR first.',
    ocr: 'Scanned PDF to Text',
    locked: 'One of these is password-protected, so its text cannot be read here.',
    unreadable: 'That file could not be read as a PDF.',
    whyTitle: 'It compares the TEXT, not the pixels',
    whyBody: 'A picture comparison lights up on every re-flow: change one word on page 2 and everything after it moves, so a pixel diff reports the whole rest of the document as different and tells you nothing. This aligns the words instead, which is why a paragraph inserted at the top does not make the rest look rewritten. If it is the LAYOUT you want to check — a stamp, a signature, a logo — compare the pages as images instead.',
    imageDiff: 'Compare Images',
    privTitle: 'The document this is for is the one you must not upload',
    privBody: 'A contract against its previous draft, a payslip against last month, a policy against the version you signed. Every comparison site on the web takes both files onto a server to do this. Both are read here, in the page.',
    related: 'Comparing plain text instead: Text Diff',
  },
  ar: {
    intro: 'قارن نسختين من ملف PDF واعرف الكلمات التي تغيّرت بالضبط. ولا يغادر أي من الملفين متصفحك.',
    a: 'النسخة الأصلية', b: 'النسخة الجديدة',
    reading: 'جارٍ القراءة…', pick: 'اختر ملف PDF',
    changed: (n: number) => `${n.toFixed(1)}٪ من الكلمات مختلفة`,
    identical: 'نصّ الملفين متطابق.',
    onlyChanges: 'التغييرات فقط', withContext: 'مع النص المحيط',
    page: (n: number) => `صفحة ${n}`,
    added: 'مضاف', removed: 'محذوف',
    scanned: 'أحد الملفين ممسوح ضوئيًا ولا نصّ فيه للمقارنة. اقرأه أولًا بالتعرّف الضوئي.',
    ocr: 'استخراج نص من PDF ممسوح',
    locked: 'أحد الملفين محمي بكلمة مرور، فلا يمكن قراءة نصّه هنا.',
    unreadable: 'تعذّرت قراءة هذا الملف كملف PDF.',
    whyTitle: 'يقارن النصّ لا البكسل',
    whyBody: 'مقارنة الصور تشتعل عند أي إعادة تدفّق: غيّر كلمة في الصفحة الثانية فينزاح كل ما بعدها، فتُبلغ مقارنة البكسل أن بقية المستند مختلفة ولا تقول شيئًا. أما هذه فتحاذي الكلمات، ولهذا لا تجعل فقرةٌ مُدرَجة في الأعلى بقيةَ المستند تبدو معادة الكتابة. وإن كان ما يهمّك هو التخطيط — ختم أو توقيع أو شعار — فقارن الصفحات كصور.',
    imageDiff: 'مقارنة الصور',
    privTitle: 'المستند الذي صُنعت له هذه الأداة هو ما يجب ألا تُرفع نسخته',
    privBody: 'عقد مقابل مسوّدته السابقة، كشف راتب مقابل الشهر الماضي، وثيقة مقابل النسخة التي وقّعتها. وكل مواقع المقارنة على الويب تأخذ الملفين إلى خادم لتفعل ذلك. وهنا يُقرأ الاثنان في الصفحة.',
    related: 'لمقارنة نصّ مجرّد: مقارنة النصوص',
  },
}

type Side = 'a' | 'b'

export default function PdfDiffTool() {
  const { locale } = useLocale()
  const s = STR[locale === 'ar' ? 'ar' : 'en']
  const [names, setNames] = useState<{ a: string; b: string }>({ a: '', b: '' })
  const [pages, setPages] = useState<{ a: string[] | null; b: string[] | null }>({ a: null, b: null })
  const [busy, setBusy] = useState<Side | null>(null)
  const [error, setError] = useState('')
  const [scanned, setScanned] = useState(false)
  const [context, setContext] = useState(false)

  async function onPick(side: Side, f: File | undefined) {
    if (!f) return
    setError(''); setScanned(false); setBusy(side)
    setNames((n) => ({ ...n, [side]: f.name }))
    try {
      const r = await extractPdf(f)
      if (r.encrypted) { setError(s.locked); setBusy(null); return }
      if (r.looksScanned) { setScanned(true); setBusy(null); return }
      setPages((p) => ({ ...p, [side]: r.pages.map((x) => x.text) }))
    } catch {
      setError(s.unreadable)
    } finally {
      setBusy(null)
    }
  }

  const chunks: Chunk[] | null = pages.a && pages.b
    ? diffDocuments(linesFromPages(pages.a), linesFromPages(pages.b))
    : null
  const share = chunks ? changeShare(chunks) : 0
  const shown = chunks
    ? (context ? chunks : chunks.filter((c) => c.op !== 'same'))
    : []

  return (
    <Stack data-testid="pdf-diff">
      <p className="text-ink-faint">{s.intro}</p>

      <div className="grid grid-cols-2 max-[560px]:grid-cols-1 gap-4">
        {(['a', 'b'] as const).map((side) => (
          <label key={side} className="flex flex-col gap-1 text-[0.85rem] text-ink-faint"
            data-testid={`pd-drop-${side}`}>
            {side === 'a' ? s.a : s.b}
            <input type="file" onChange={(e) => onPick(side, e.target.files?.[0])}
              data-testid={`pd-file-${side}`} />
            {names[side] ? <span className="font-mono text-[0.78rem]">{names[side]}</span> : null}
          </label>
        ))}
      </div>

      {busy ? <p data-testid="pd-busy">{s.reading}</p> : null}
      {error ? <FileError message={error} /> : null}
      {scanned ? (
        <Panel>
          <p data-testid="pd-scanned">{s.scanned}</p>
          <a href={localePath(locale, '/apps/pdf-ocr')} data-testid="pd-ocr">{s.ocr}</a>
        </Panel>
      ) : null}

      {chunks ? (
        <>
          <Panel>
            <p className="font-display text-[1.3rem]" data-testid="pd-share">
              {share === 0 ? s.identical : s.changed(share)}
            </p>
            <label className="text-[0.85rem] text-ink-faint inline-flex items-center gap-2 mt-1">
              <input type="checkbox" checked={context} data-testid="pd-context"
                onChange={(e) => setContext(e.target.checked)} />
              {context ? s.withContext : s.onlyChanges}
            </label>
          </Panel>

          <div className="flex flex-col gap-1" data-testid="pd-result">
            {shown.map((c, i) => (
              <p key={i} data-testid={`pd-${c.op}`} data-page={c.page}
                className={
                  c.op === 'add' ? 'bg-[color-mix(in_srgb,var(--green-400)_22%,transparent)] px-2 py-1 rounded-sm'
                    : c.op === 'del' ? 'bg-[color-mix(in_srgb,var(--color-gold-400)_22%,transparent)] px-2 py-1 rounded-sm line-through'
                      : 'text-ink-faint px-2'
                }>
                {c.op !== 'same' ? (
                  <span className="text-[0.72rem] uppercase tracking-[0.05em] me-2 rtl:tracking-normal">
                    {s.page(c.page ?? 1)} · {c.op === 'add' ? s.added : s.removed}
                  </span>
                ) : null}
                {c.text}
              </p>
            ))}
          </div>
        </>
      ) : null}

      <Panel>
        <h3 className="font-display text-lg">{s.whyTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="pd-why">{s.whyBody}</p>
        <a href={localePath(locale, '/apps/image-diff')} className="text-sm">{s.imageDiff}</a>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.privTitle}</h3>
        <p className="text-ink-faint text-sm">{s.privBody}</p>
      </Panel>

      <p className="text-sm">
        <a href={localePath(locale, '/apps/text-diff')}>{s.related}</a>
      </p>
    </Stack>
  )
}
