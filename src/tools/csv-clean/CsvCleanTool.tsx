import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Textarea, Stack, Check, Select, Panel } from '../../components/ui'
import { UploadIcon, DownloadIcon, CopyIcon } from '../../components/icons'
import { parseCsv, toCsv, sniffDelimiter, clean, type Delimiter, type CleanOptions } from '../../lib/csv'

const DELIMS: { id: Delimiter; label: string }[] = [
  { id: ',', label: 'Comma ,' }, { id: ';', label: 'Semicolon ;' },
  { id: '\t', label: 'Tab' }, { id: '|', label: 'Pipe |' },
]

const STR = {
  en: {
    pick: 'Choose a CSV', paste: 'or paste it here…',
    hint: 'Paste a messy CSV and get a clean one — stray spaces gone, blank rows and columns dropped, duplicates removed. Nothing is uploaded.',
    delimiter: 'Separator', detected: 'detected',
    header: 'First row is a header',
    trim: 'Trim spaces around every value',
    collapse: 'Collapse runs of spaces inside values',
    dropRows: 'Drop blank rows',
    dropCols: 'Drop columns that are entirely empty',
    dedupe: 'Remove duplicate rows',
    rows: (n: number) => `${n.toLocaleString('en')} rows`,
    cols: (n: number) => `${n} columns`,
    removed: 'Removed',
    dupes: (n: number) => `${n} duplicate row${n === 1 ? '' : 's'}`,
    emptyRows: (n: number) => `${n} blank row${n === 1 ? '' : 's'}`,
    emptyCols: (n: number) => `${n} empty column${n === 1 ? '' : 's'}`,
    trimmedN: (n: number) => `${n} value${n === 1 ? '' : 's'} trimmed`,
    ragged: (n: number) => `${n} row${n === 1 ? '' : 's'} have a different number of fields than the header — that is what usually breaks an import.`,
    nothing: 'Nothing to clean — this file is already tidy.',
    copy: 'Copy', copied: 'Copied!', download: 'Download CSV',
    preview: 'Preview',
  },
  ar: {
    pick: 'اختر ملف CSV', paste: 'أو الصقه هنا…',
    hint: 'الصق ملف CSV فوضويًا لتحصل على نظيف — بلا مسافات زائدة، وبلا صفوف وأعمدة فارغة، وبلا تكرار. لا يُرفع شيء.',
    delimiter: 'الفاصل', detected: 'مكتشف',
    header: 'الصف الأول عناوين',
    trim: 'أزل المسافات حول كل قيمة',
    collapse: 'ادمج المسافات المتتالية داخل القيم',
    dropRows: 'احذف الصفوف الفارغة',
    dropCols: 'احذف الأعمدة الفارغة تمامًا',
    dedupe: 'احذف الصفوف المكرّرة',
    rows: (n: number) => `${n.toLocaleString('ar')} صفًا`,
    cols: (n: number) => `${n.toLocaleString('ar')} عمودًا`,
    removed: 'أُزيل',
    dupes: (n: number) => `${n.toLocaleString('ar')} صفًا مكرّرًا`,
    emptyRows: (n: number) => `${n.toLocaleString('ar')} صفًا فارغًا`,
    emptyCols: (n: number) => `${n.toLocaleString('ar')} عمودًا فارغًا`,
    trimmedN: (n: number) => `${n.toLocaleString('ar')} قيمة مشذّبة`,
    ragged: (n: number) => `${n.toLocaleString('ar')} صفًا يختلف عدد حقولها عن العناوين — وهذا ما يُفسد الاستيراد عادةً.`,
    nothing: 'لا شيء لتنظيفه — هذا الملف مرتّب أصلًا.',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'نزّل CSV',
    preview: 'معاينة',
  },
}

export default function CsvCleanTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [manualDelim, setManualDelim] = useState<Delimiter | ''>('')
  const [o, setO] = useState<CleanOptions>({
    trim: true, collapseSpaces: false, dropEmptyRows: true,
    dropEmptyCols: true, dedupe: true, hasHeader: true,
  })
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const detected = useMemo(() => sniffDelimiter(text), [text])
  const delimiter = (manualDelim || detected) as Delimiter
  const parsed = useMemo(() => (text.trim() ? parseCsv(text, delimiter) : []), [text, delimiter])
  const result = useMemo(() => clean(parsed, o), [parsed, o])
  const output = useMemo(() => (result.rows.length ? toCsv(result.rows, delimiter) : ''), [result, delimiter])

  const changed = result.duplicates + result.removedRows + result.removedCols + result.trimmed

  async function pick(f: File | undefined) {
    if (!f) return
    setText(await f.text())
  }
  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  function download() {
    // The BOM is deliberate: without it Excel opens a UTF-8 CSV as the system
    // codepage and Arabic comes out as mojibake, which is the single most common
    // complaint about any CSV export.
    const blob = new Blob(['﻿', output], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'cleaned.csv'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const set = (patch: Partial<CleanOptions>) => setO((p) => ({ ...p, ...patch }))

  return (
    <Stack data-testid="csv-clean">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" className="hidden" data-testid="cc-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="cc-pick"><UploadIcon /> {s.pick}</Button>
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.delimiter}
          <Select className="w-36" data-testid="cc-delim" value={manualDelim} onChange={(e) => setManualDelim(e.target.value as Delimiter | '')}>
            <option value="">{DELIMS.find((d) => d.id === detected)?.label} ({s.detected})</option>
            {DELIMS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Select>
        </label>
      </div>

      <Textarea className="min-h-[8rem] font-mono text-[0.85rem]" dir="ltr" data-testid="cc-input"
        placeholder={s.paste} value={text} onChange={(e) => setText(e.target.value)} />

      <div className="grid gap-x-5 gap-y-2 grid-cols-1 min-[640px]:grid-cols-2">
        <Check><input type="checkbox" checked={o.hasHeader} data-testid="cc-header" onChange={(e) => set({ hasHeader: e.target.checked })} /> {s.header}</Check>
        <Check><input type="checkbox" checked={o.trim} data-testid="cc-trim" onChange={(e) => set({ trim: e.target.checked })} /> {s.trim}</Check>
        <Check><input type="checkbox" checked={o.collapseSpaces} data-testid="cc-collapse" onChange={(e) => set({ collapseSpaces: e.target.checked })} /> {s.collapse}</Check>
        <Check><input type="checkbox" checked={o.dropEmptyRows} data-testid="cc-droprows" onChange={(e) => set({ dropEmptyRows: e.target.checked })} /> {s.dropRows}</Check>
        <Check><input type="checkbox" checked={o.dropEmptyCols} data-testid="cc-dropcols" onChange={(e) => set({ dropEmptyCols: e.target.checked })} /> {s.dropCols}</Check>
        <Check><input type="checkbox" checked={o.dedupe} data-testid="cc-dedupe" onChange={(e) => set({ dedupe: e.target.checked })} /> {s.dedupe}</Check>
      </div>

      {parsed.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9rem]">
            <span className="font-semibold text-ink" data-testid="cc-rows">{s.rows(result.rows.length)}</span>
            <span className="text-ink-faint" data-testid="cc-cols">{s.cols(result.rows[0]?.length ?? 0)}</span>
            {changed > 0 && (
              <span className="text-green-700 rtl:font-ar" data-testid="cc-removed">
                {s.removed}: {[
                  result.duplicates && s.dupes(result.duplicates),
                  result.removedRows && s.emptyRows(result.removedRows),
                  result.removedCols && s.emptyCols(result.removedCols),
                  result.trimmed && s.trimmedN(result.trimmed),
                ].filter(Boolean).join(' · ')}
              </span>
            )}
            {changed === 0 && <span className="text-ink-faint rtl:font-ar" data-testid="cc-nothing">{s.nothing}</span>}
          </div>

          {result.ragged > 0 && (
            <Panel><p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="cc-ragged">{s.ragged(result.ragged)}</p></Panel>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.preview}</span>
            <Button className="px-3 py-1" onClick={copy} data-testid="cc-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <Button variant="primary" className="px-3 py-1" onClick={download} data-testid="cc-download"><DownloadIcon /> {s.download}</Button>
          </div>
          <Textarea readOnly dir="ltr" className="min-h-[10rem] font-mono text-[0.85rem]"
            data-testid="cc-output" value={output} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}

      {!text.trim() && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}
    </Stack>
  )
}
