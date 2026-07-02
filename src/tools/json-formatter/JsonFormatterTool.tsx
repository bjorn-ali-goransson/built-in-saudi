import { useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, DownloadIcon } from '../../components/icons'
import { process, type Fmt } from './formatters'

const FORMATS: { id: Fmt; label: string; ext: string }[] = [
  { id: 'json', label: 'JSON', ext: 'json' },
  { id: 'css', label: 'CSS', ext: 'css' },
  { id: 'xml', label: 'XML', ext: 'xml' },
]

const PLACEHOLDER: Record<Fmt, string> = {
  json: '{"b":1,"a":[2,3]}',
  css: 'a{color:red;font-weight:bold}',
  xml: '<a><b>1</b><b>2</b></a>',
}

const STR = {
  en: {
    format: 'Format', minify: 'Minify', sortKeys: 'Sort keys',
    copy: 'Copy', copied: 'Copied!', download: 'Download',
    indent: 'Indent', chars: (n: number) => `${n.toLocaleString()} chars`,
    errAt: (l: number, c: number) => `Invalid JSON — line ${l}, column ${c}`,
    empty: 'Paste code, then Format or Minify.',
    privacy: 'Runs entirely in your browser — nothing is uploaded.',
  },
  ar: {
    format: 'تنسيق', minify: 'تصغير', sortKeys: 'ترتيب المفاتيح',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'تنزيل',
    indent: 'المسافة', chars: (n: number) => `${n.toLocaleString('ar')} حرف`,
    errAt: (l: number, c: number) => `JSON غير صالح — السطر ${l}، العمود ${c}`,
    empty: 'الصق الكود ثم اضغط تنسيق أو تصغير.',
    privacy: 'يعمل بالكامل داخل متصفحك — لا يُرفع أي شيء.',
  },
}

export default function JsonFormatterTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [fmt, setFmt] = useState<Fmt>('json')
  const [raw, setRaw] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<{ line: number; col: number } | null>(null)
  const [indent, setIndent] = useState(2)
  const [sort, setSort] = useState(false)
  const [copied, setCopied] = useState(false)

  function run(minify: boolean) {
    if (!raw.trim()) { setOutput(''); setError(null); return }
    const r = process(fmt, raw, minify, indent, sort)
    if (r.ok) { setOutput(r.out); setError(null) }
    else { setError({ line: r.line, col: r.col }); setOutput('') }
  }

  async function copy() {
    if (!output) return
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  function download() {
    if (!output) return
    const ext = FORMATS.find((f) => f.id === fmt)!.ext
    const url = URL.createObjectURL(new Blob([output], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url; a.download = `formatted.${ext}`; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack" data-testid="json-formatter">
      <div className="seg self-start" role="group" aria-label="format">
        {FORMATS.map((f) => (
          <button key={f.id} className={`seg__btn ${fmt === f.id ? 'is-active' : ''}`} aria-pressed={fmt === f.id}
            data-testid={`fmt-${f.id}`} onClick={() => { setFmt(f.id); setOutput(''); setError(null) }}>{f.label}</button>
        ))}
      </div>

      <textarea
        className="input input--area font-mono text-[0.9rem] min-h-[9rem]" data-testid="json-input"
        placeholder={PLACEHOLDER[fmt]} value={raw} spellCheck={false} dir="ltr"
        onChange={(e) => setRaw(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-[0.6rem]">
        <button className="btn btn--primary" data-testid="json-format" onClick={() => run(false)}>{s.format}</button>
        <button className="btn" data-testid="json-minify" onClick={() => run(true)}>{s.minify}</button>
        <div className="seg" role="group" aria-label={s.indent}>
          {[2, 4].map((n) => (
            <button key={n} className={`seg__btn ${indent === n ? 'is-active' : ''}`} aria-pressed={indent === n}
              onClick={() => setIndent(n)}>{n}</button>
          ))}
        </div>
        {fmt === 'json' && (
          <label className="check"><input type="checkbox" checked={sort} onChange={(e) => setSort(e.target.checked)} data-testid="json-sort" /> {s.sortKeys}</label>
        )}
      </div>

      {error ? (
        <p className="px-[0.9rem] py-[0.8rem] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] rounded-[5px] text-[color:var(--danger)] font-semibold" data-testid="json-error">
          {s.errAt(error.line, error.col)}
        </p>
      ) : output ? (
        <>
          <pre className="code-out overflow-x-auto p-4 bg-sand-100 border border-[color:var(--line-soft)] rounded-md text-ink whitespace-pre" dir="ltr" data-testid="json-output">{output}</pre>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[0.82rem] text-ink-faint font-mono">{s.chars(output.length)}</span>
            <div className="flex gap-[0.6rem]">
              <button className="btn" data-testid="json-copy" onClick={copy}><CopyIcon /> {copied ? s.copied : s.copy}</button>
              <button className="btn" onClick={download}><DownloadIcon /> {s.download}</button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-ink-faint text-[0.95rem]">{s.empty}</p>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </div>
  )
}
