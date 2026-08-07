import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Field, Check, Stack, Panel, Seg, SegButton, FileError, Spinner } from '../../components/ui'
import { DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { zipStore } from '../../lib/zip'
import { readTableFile } from '../../lib/tableFile'
import { DEFAULTS, csvText, splitTable, type Mode, type SplitOptions } from './split'

const WIP = 'csv-split'

const STR = {
  en: {
    pick: 'Choose a CSV or Excel file',
    intro: 'Break one big spreadsheet into several smaller CSVs — by row count, by file size, or one file per value in a column. Every part keeps the header row. Nothing is uploaded.',
    reading: 'Reading…',
    mode: 'Split by', modes: { rows: 'Row count', size: 'File size', column: 'A column' } as Record<Mode, string>,
    rows: 'Rows per file', size: 'Megabytes per file', column: 'Column',
    header: 'First row is a header', bom: 'Add a BOM so Excel reads Arabic correctly',
    bomNote: 'Excel reads a UTF-8 file as the local codepage unless it starts with a byte-order mark, so without this an Arabic column opens as ØªØ¬Ø±ÙŠØ¨ÙŠ. Turn it off only if something downstream is strict about the first bytes.',
    headerNote: 'The header is repeated in every part. Without it, part 2 opens with its first row of data being read as column names — a row goes missing and every column is mislabelled, which looks fine until someone sums the wrong one.',
    parts: 'Parts', download: 'Download all as a zip',
    partCount: (n: number) => `${n} file${n === 1 ? '' : 's'}`,
    rowsIn: (n: number) => `${n.toLocaleString('en')} rows in`,
    preview: 'Preview of', rowsWord: 'rows',
    tooMany: 'That would make more than 500 files. Raise the rows per file, or pick a column with fewer distinct values.',
    again: 'Choose another file',
    errors: {
      'old-format': 'The old .xls format and Apple Numbers files cannot be read — re-save as .xlsx or CSV.',
      'not-xlsx': 'That file could not be opened as a spreadsheet.',
      generic: 'That file could not be read.',
    } as Record<string, string>,
  },
  ar: {
    pick: 'اختر ملف CSV أو إكسل',
    intro: 'قسّم جدولًا كبيرًا إلى ملفات CSV أصغر — بعدد الصفوف أو بحجم الملف أو ملفًا لكل قيمة في عمود. ويحتفظ كل جزء بصف العناوين. ولا يُرفع شيء.',
    reading: 'جارٍ القراءة…',
    mode: 'التقسيم بحسب', modes: { rows: 'عدد الصفوف', size: 'حجم الملف', column: 'عمود' } as Record<Mode, string>,
    rows: 'صفوف لكل ملف', size: 'ميغابايت لكل ملف', column: 'العمود',
    header: 'الصف الأول عناوين', bom: 'أضف BOM ليقرأ إكسل العربية صحيحة',
    bomNote: 'يقرأ إكسل ملف UTF-8 بترميز النظام المحلي ما لم يبدأ بعلامة ترتيب البايتات، فبدونها يُفتح العمود العربي هكذا: ØªØ¬Ø±ÙŠØ¨ÙŠ. لا تعطّلها إلا إن كان ما يستقبل الملف صارمًا في أول بايتاته.',
    headerNote: 'يتكرّر صف العناوين في كل جزء. وبدونه يُفتح الجزء الثاني وأول صفوف بياناته يُقرأ عناوينَ أعمدة — فيضيع صف وتُخطأ تسمية كل عمود، ويبدو كل شيء سليمًا حتى يجمع أحدهم العمود الخطأ.',
    parts: 'الأجزاء', download: 'نزّلها كلها في ملف مضغوط',
    partCount: (n: number) => `${n} ملفًا`,
    rowsIn: (n: number) => `${n.toLocaleString('ar')} صفًا`,
    preview: 'معاينة', rowsWord: 'صفًا',
    tooMany: 'سينتج عن ذلك أكثر من ٥٠٠ ملف. ارفع عدد الصفوف لكل ملف، أو اختر عمودًا بقيم أقل تنوعًا.',
    again: 'اختر ملفًا آخر',
    errors: {
      'old-format': 'لا يمكن قراءة صيغة ‎.xls‎ القديمة ولا ملفات Numbers — احفظ الملف بصيغة ‎.xlsx‎ أو CSV.',
      'not-xlsx': 'تعذّر فتح هذا الملف بوصفه جدولًا.',
      generic: 'تعذّرت قراءة هذا الملف.',
    } as Record<string, string>,
  },
}

export default function CsvSplitTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [rows, setRows] = useState<string[][]>([])
  const [o, setO] = useState<SplitOptions>(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shown, setShown] = useState(0)

  const set = <K extends keyof SplitOptions>(k: K, v: SplitOptions[K]) => setO((p) => ({ ...p, [k]: v }))

  async function pick(file: File | undefined | null) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const t = await readTableFile(file)
      setRows(t.rows)
      set('baseName', file.name.replace(/\.[^.]+$/, '') || 'part')
      setShown(0)
      setWorkInProgress(WIP, true)
    } catch (e) {
      setError(s.errors[e instanceof Error ? e.message : ''] ?? s.errors.generic)
      setRows([])
    } finally { setBusy(false) }
  }

  const parts = useMemo(() => splitTable(rows, o), [rows, o])
  const headers = (o.headerRow ? rows[0] ?? [] : []).map((h, i) => h || `#${i + 1}`)
  const dataRows = Math.max(0, rows.length - (o.headerRow ? 1 : 0))
  const tooMany = parts.length > 500

  function download() {
    const files = parts.map((p) => ({ name: p.name, bytes: new TextEncoder().encode(csvText(p, o)) }))
    const blob = zipStore(files)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${o.baseName || 'split'}.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Stack data-testid="csv-split">
      {!rows.length && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="cs-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {busy && <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="cs-reading"><Spinner /> {s.reading}</p>}
      {error && <FileError message={error} />}

      {rows.length > 0 && (
        <>
          <Panel>
            <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-3">
              <Field label={s.mode}>
                <Seg data-testid="cs-mode">
                  {(['rows', 'size', 'column'] as Mode[]).map((m) => (
                    <SegButton key={m} active={o.mode === m} onClick={() => { set('mode', m); setShown(0) }} data-testid={`cs-mode-${m}`}>{s.modes[m]}</SegButton>
                  ))}
                </Seg>
              </Field>
              {o.mode === 'rows' && (
                <Field label={s.rows}>
                  <Input type="number" min={1} max={1000000} value={o.rowsPerFile} data-testid="cs-rows"
                    onChange={(e) => { set('rowsPerFile', Math.max(1, Number(e.target.value) || 1)); setShown(0) }} />
                </Field>
              )}
              {o.mode === 'size' && (
                <Field label={s.size}>
                  <Input type="number" min={0.01} step={0.1} value={o.megabytes} data-testid="cs-size"
                    onChange={(e) => { set('megabytes', Math.max(0.01, Number(e.target.value) || 1)); setShown(0) }} />
                </Field>
              )}
              {o.mode === 'column' && headers.length > 0 && (
                <Field label={s.column}>
                  <Select value={o.column} data-testid="cs-column" onChange={(e) => { set('column', Number(e.target.value)); setShown(0) }}>
                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </Select>
                </Field>
              )}
              <div className="flex items-end">
                <span className="text-[0.85rem] text-ink-faint" data-testid="cs-input-rows">{s.rowsIn(dataRows)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <Check><input type="checkbox" checked={o.headerRow} data-testid="cs-header" onChange={(e) => set('headerRow', e.target.checked)} /> {s.header}</Check>
              <Check><input type="checkbox" checked={o.bom} data-testid="cs-bom" onChange={(e) => set('bom', e.target.checked)} /> {s.bom}</Check>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={download} disabled={!parts.length || tooMany} data-testid="cs-download">
                <DownloadIcon /> {s.download}
              </Button>
              <span className="text-[0.9rem] text-ink font-mono" data-testid="cs-part-count">{s.partCount(parts.length)}</span>
            </div>
            {tooMany && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="cs-too-many">{s.tooMany}</p>}
            <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.headerNote}</p>
            {o.bom && <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.bomNote}</p>}
          </Panel>

          {parts.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.parts}</h2>
              <div className="flex flex-wrap gap-2" data-testid="cs-parts">
                {parts.slice(0, 60).map((p, i) => (
                  <button key={p.name} onClick={() => setShown(i)} data-testid={`cs-part-${i}`}
                    className={`px-3 py-1.5 rounded-md border text-[0.82rem] font-mono ${shown === i ? 'border-green-700 bg-green-600 text-sand-100' : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft'}`}>
                    {p.name} <span className="opacity-70">· {p.count}</span>
                  </button>
                ))}
              </div>
              {parts[shown] && (
                <>
                  <span className="text-[0.8rem] text-ink-faint">{s.preview} <b className="font-mono">{parts[shown].name}</b> · {parts[shown].count} {s.rowsWord}</span>
                  <pre className="overflow-x-auto max-h-[20rem] overflow-y-auto rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-3 font-mono text-[0.78rem] text-ink" data-testid="cs-preview">
                    {csvText(parts[shown], { ...o, bom: false }).split('\r\n').slice(0, 12).join('\n')}
                  </pre>
                </>
              )}
            </section>
          )}

          <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
            {s.again}
            <input type="file" className="hidden" data-testid="cs-file-again" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </>
      )}
    </Stack>
  )
}
