import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { parseCsv, sniffDelimiter } from '../../lib/csv'
import { Stack, Textarea, Seg, SegButton, Button, FieldLabel } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

const STR = {
  en: {
    dir: 'Direction', toJson: 'CSV → JSON', toCsv: 'JSON → CSV', input: 'Input', output: 'Output',
    copy: 'Copy', copied: 'Copied!', errCsv: 'Could not parse the CSV.', errJson: 'Expected a JSON array of objects.',
    privacy: 'Parsed in your browser — nothing is uploaded.',
  },
  ar: {
    dir: 'الاتجاه', toJson: 'CSV ← JSON', toCsv: 'JSON ← CSV', input: 'المدخل', output: 'المخرج',
    copy: 'نسخ', copied: 'تم النسخ!', errCsv: 'تعذّر تحليل CSV.', errJson: 'يُتوقَّع مصفوفة كائنات JSON.',
    privacy: 'يُحلَّل في متصفحك — لا يُرفع أي شيء.',
  },
}

// Uses `lib/csv`, not a private copy. The copy that used to live here was the
// last CSV parser on the site not sharing that module, and it differed in two
// ways that both produced silently wrong output:
//
// 1. **It did not strip the UTF-8 BOM.** Excel writes one, and so do OUR OWN
//    csv tools deliberately — `csv-split` and `csv-clean` prepend it so Excel
//    reads Arabic instead of mojibake. So a file this site produced, converted
//    here, came back with its first JSON key as "﻿name": invisible in any
//    viewer, and `obj.name` undefined for every consumer downstream.
// 2. **It assumed a comma.** A semicolon-separated export — the default in
//    several European and Arabic Excel locales — parsed as one column per row.
//
// `sniffDelimiter` handles the second and `parseCsv` the first.
function readCsv(text: string): string[][] {
  const rows = parseCsv(text, sniffDelimiter(text))
  // The private copy dropped blank rows; keep that, or a trailing newline in a
  // pasted file becomes a null object in the JSON.
  return rows.filter((r) => r.length > 1 || r[0] !== '')
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function CsvJsonTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [dir, setDir] = useState<'toJson' | 'toCsv'>('toJson')
  const [input, setInput] = useState('name,role\nSara,Engineer\nOmar,Designer')
  const [copied, setCopied] = useState(false)

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: '' }
    try {
      if (dir === 'toJson') {
        const rows = readCsv(input)
        if (!rows.length) return { output: '', error: s.errCsv }
        const [head, ...body] = rows
        const objs = body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
        return { output: JSON.stringify(objs, null, 2), error: '' }
      }
      const data = JSON.parse(input)
      if (!Array.isArray(data) || !data.length || typeof data[0] !== 'object') return { output: '', error: s.errJson }
      const keys = [...new Set(data.flatMap((o) => Object.keys(o as object)))]
      const lines = [keys.map(csvCell).join(','), ...data.map((o) => keys.map((k) => csvCell((o as Record<string, unknown>)[k])).join(','))]
      return { output: lines.join('\n'), error: '' }
    } catch { return { output: '', error: dir === 'toJson' ? s.errCsv : s.errJson } }
  }, [input, dir, s])

  async function copy() { try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }

  return (
    <Stack data-testid="csv-json">
      <div className="flex flex-col gap-1"><FieldLabel>{s.dir}</FieldLabel>
        <Seg>
          <SegButton active={dir === 'toJson'} onClick={() => setDir('toJson')} data-testid="cj-tojson">{s.toJson}</SegButton>
          <SegButton active={dir === 'toCsv'} onClick={() => setDir('toCsv')} data-testid="cj-tocsv">{s.toCsv}</SegButton>
        </Seg>
      </div>

      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input}</FieldLabel>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={7} dir="ltr" className="font-mono text-[0.85rem]" data-testid="cj-input" /></label>

      {error && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="cj-error">{error}</p>}
      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.output}</FieldLabel>
        <Textarea value={output} readOnly rows={7} dir="ltr" className="font-mono text-[0.85rem]" data-testid="cj-output" /></label>

      <Button onClick={copy} disabled={!output} className="self-start" data-testid="cj-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
