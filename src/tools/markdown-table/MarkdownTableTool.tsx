import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, Button, Seg, SegButton, FieldLabel, Check } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

const STR = {
  en: { input: 'Paste CSV or TSV', align: 'Alignment', left: 'Left', center: 'Center', right: 'Right', firstHeader: 'First row is a header', output: 'Markdown', copy: 'Copy', copied: 'Copied!', hint: 'Paste some rows above to build a table.', privacy: 'Generated in your browser — nothing is uploaded.' },
  ar: { input: 'الصق CSV أو TSV', align: 'المحاذاة', left: 'يسار', center: 'وسط', right: 'يمين', firstHeader: 'الصف الأول ترويسة', output: 'Markdown', copy: 'نسخ', copied: 'تم النسخ!', hint: 'الصق بعض الصفوف أعلاه لبناء جدول.', privacy: 'يُولَّد في متصفحك — لا يُرفع أي شيء.' },
}

function parseRows(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length)
  const delim = lines[0] && lines[0].includes('\t') ? '\t' : ','
  return lines.map((l) => l.split(delim).map((c) => c.trim()))
}

export default function MarkdownTableTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [input, setInput] = useState('Name, Role, City\nSara, Engineer, Riyadh\nOmar, Designer, Jeddah')
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('left')
  const [header, setHeader] = useState(true)
  const [copied, setCopied] = useState(false)

  const md = useMemo(() => {
    const rows = parseRows(input)
    if (!rows.length) return ''
    const cols = Math.max(...rows.map((r) => r.length))
    const grid = rows.map((r) => Array.from({ length: cols }, (_, i) => (r[i] ?? '').replace(/\|/g, '\\|')))
    const widths = Array.from({ length: cols }, (_, i) => Math.max(3, ...grid.map((r) => r[i].length)))
    const pad = (t: string, w: number) => t + ' '.repeat(w - t.length)
    const head = header ? grid[0] : grid[0].map((_, i) => `Col ${i + 1}`)
    const body = header ? grid.slice(1) : grid
    const sep = widths.map((w) => (align === 'center' ? ':' + '-'.repeat(Math.max(1, w - 2)) + ':' : align === 'right' ? '-'.repeat(w - 1) + ':' : ':' + '-'.repeat(w - 1)))
    const line = (cells: string[]) => `| ${cells.map((c, i) => pad(c, widths[i])).join(' | ')} |`
    return [line(head), `| ${sep.join(' | ')} |`, ...body.map(line)].join('\n')
  }, [input, align, header])

  async function copy() { try { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }

  return (
    <Stack data-testid="markdown-table">
      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input}</FieldLabel>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={6} dir="ltr" className="font-mono text-[0.85rem]" data-testid="mdt-input" /></label>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1"><FieldLabel>{s.align}</FieldLabel>
          <Seg><SegButton active={align === 'left'} onClick={() => setAlign('left')}>{s.left}</SegButton>
            <SegButton active={align === 'center'} onClick={() => setAlign('center')}>{s.center}</SegButton>
            <SegButton active={align === 'right'} onClick={() => setAlign('right')}>{s.right}</SegButton></Seg></div>
        <Check className="pt-5"><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> {s.firstHeader}</Check>
      </div>
      {md ? (
        <>
          <div className="flex items-center justify-between"><FieldLabel>{s.output}</FieldLabel>
            <Button onClick={copy} data-testid="mdt-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button></div>
          <pre className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-3 font-mono text-[0.82rem] overflow-x-auto" dir="ltr" data-testid="mdt-output">{md}</pre>
        </>
      ) : <p className="text-[0.9rem] text-ink-faint">{s.hint}</p>}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
