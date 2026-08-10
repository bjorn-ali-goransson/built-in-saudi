import { useRef, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { CopyIcon, ShareIcon } from '../../components/icons'
import { Button, Textarea, Stack } from '../../components/ui'
import { htmlToMd, elementToMd } from '../../lib/htmlToMd'

const STR = {
  en: {
    editLabel: 'Paste formatted text here',
    hint: 'Copy from a document, email or web page and paste it in the box above — you get clean Markdown out, ready to copy or share. Everything runs in your browser.',
    empty: 'Paste rich text here…',
    outLabel: 'Markdown',
    copy: 'Copy', copied: 'Copied!', share: 'Share', clear: 'Clear',
    done: (n: number) => `Converted to Markdown — ${n.toLocaleString()} characters.`,
    inverse: 'The other direction: Markdown to HTML',
  },
  ar: {
    editLabel: 'الصق النص المنسّق هنا',
    hint: 'انسخ من مستند أو بريد أو صفحة ويب والصقه في الصندوق أعلاه — تحصل على ماركداون نظيف جاهز للنسخ أو المشاركة. كل شيء يعمل داخل متصفحك.',
    empty: 'الصق نصًا منسّقًا هنا…',
    outLabel: 'ماركداون',
    copy: 'نسخ', copied: 'تم النسخ!', share: 'مشاركة', clear: 'مسح',
    done: (n: number) => `حُوِّل إلى ماركداون — ${n.toLocaleString('ar')} حرفًا.`,
    inverse: 'الاتجاه الآخر: ماركداون إلى HTML',
  },
}

export default function PasteToMarkdownTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const editRef = useRef<HTMLDivElement>(null)
  const [output, setOutput] = useState('')
  const [empty, setEmpty] = useState(true)
  const [copied, setCopied] = useState(false)

  function recompute() {
    const el = editRef.current
    if (!el) return
    setOutput(elementToMd(el))
    setEmpty(!el.textContent?.trim())
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const html = e.clipboardData.getData('text/html')
    if (html && editRef.current) {
      e.preventDefault()
      editRef.current.innerHTML = htmlToMd(html).safeHtml // sanitised preview
      recompute()
    }
    // No HTML on the clipboard → let the plain-text paste land, onInput recomputes.
  }

  function clear() { if (editRef.current) editRef.current.innerHTML = ''; setOutput(''); setEmpty(true) }

  async function copy() {
    if (!output) return
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  async function share() {
    if (!output) return
    if (navigator.share) { try { await navigator.share({ text: output }); return } catch { /* cancelled */ } }
    copy()
  }

  return (
    <Stack data-testid="paste-to-markdown">
      <div className="flex items-center gap-2">
        <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.editLabel}</span>
        {!empty && <Button className="flex-none px-3" onClick={clear} data-testid="md-clear">{s.clear}</Button>}
      </div>
      <div className="relative">
        <div
          ref={editRef} contentEditable suppressContentEditableWarning role="textbox" aria-label={s.editLabel}
          data-testid="md-input" onPaste={onPaste} onInput={recompute}
          className="min-h-[9rem] rounded-md border border-[color:var(--line-soft)] bg-[var(--surface)] px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--green-400)_45%,transparent)] overflow-auto [&_h1]:text-[1.4em] [&_h1]:font-bold [&_h2]:text-[1.2em] [&_h2]:font-bold [&_h3]:font-bold [&_a]:text-green-700 [&_a]:underline [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:list-decimal [&_ol]:ps-6 [&_blockquote]:border-s-4 [&_blockquote]:border-[color:var(--line)] [&_blockquote]:ps-3 [&_blockquote]:text-ink-soft [&_pre]:font-mono [&_pre]:text-[0.85em] [&_pre]:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] [&_pre]:p-2 [&_pre]:rounded [&_code]:font-mono [&_table]:border-collapse [&_td]:border [&_td]:border-[color:var(--line-soft)] [&_td]:px-2 [&_th]:border [&_th]:border-[color:var(--line-soft)] [&_th]:px-2 [&_img]:max-w-full [&_*]:my-1"
        />
        {empty && <span className="pointer-events-none absolute top-2.5 start-3.5 text-ink-faint text-[0.95rem]">{s.empty}</span>}
      </div>

      {output ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.outLabel}</span>
            <Button className="flex-none px-3" onClick={share} aria-label={s.share} data-testid="md-share"><ShareIcon /> {s.share}</Button>
            <Button className="flex-none px-3" onClick={copy} aria-label={s.copy} data-testid="md-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
          <Textarea readOnly className="min-h-[9rem] font-mono text-[0.88rem]" data-testid="md-output" value={output} onFocus={(e) => e.currentTarget.select()} />
          <p className="text-[0.9rem] text-green-700 rtl:font-ar" data-testid="md-message">{s.done(output.length)}</p>
        </div>
      ) : (
        <p className="text-ink-faint text-[0.95rem]">{s.hint}</p>
      )}
      {/* A converter and its inverse that do not link are two tools somebody
          has to find twice — and the scorer discards word order, so "html to
          markdown" reaches the wrong one first. The link is the mitigation. */}
      <Button className="self-start px-3 py-1" to={localePath(locale, '/apps/markdown-html')} data-testid="md-inverse">{s.inverse}</Button>
    </Stack>
  )
}
