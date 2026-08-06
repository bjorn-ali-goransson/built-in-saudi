import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Select, Field, Check, Stack, Panel, Seg, SegButton, FileError, Spinner } from '../../components/ui'
import { CopyIcon, DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { readWorkbook, toCsv, toJson, type Workbook } from './xlsx'

const WIP = 'xlsx-convert'

const STR = {
  en: {
    pick: 'Choose a spreadsheet',
    intro: 'Open an .xlsx and get the data out as CSV, TSV or JSON — without uploading it anywhere. Values only: dates come out as dates, and formulas come out as the value the spreadsheet last calculated.',
    reading: 'Reading…',
    sheet: 'Sheet', format: 'Format',
    header: 'First row is a header',
    delim: 'Separator', comma: 'Comma', semi: 'Semicolon', tab: 'Tab',
    copy: 'Copy', copied: 'Copied!', download: 'Download',
    preview: 'Preview', more: (n: number) => `+${n.toLocaleString('en')} more rows`,
    size: (r: number, c: number) => `${r.toLocaleString('en')} rows × ${c} columns`,
    empty: 'That sheet is empty.',
    again: 'Choose another file',
    errors: {
      'not-xlsx': 'That is not an .xlsx workbook. The old .xls format and Apple Numbers files are different formats this cannot read — re-save as .xlsx first.',
      'not-a-zip': 'That file could not be opened as an .xlsx (an .xlsx is a zip archive, and this is not one).',
      'no-sheets': 'No sheets were found in that workbook.',
      generic: 'That file could not be read.',
    } as Record<string, string>,
    valuesNote: 'Formulas are not recalculated — you get the value the spreadsheet stored last time it was saved. Cell formatting, colours, merged cells and charts are not carried across, because CSV and JSON have nowhere to put them.',
    dateNote: 'A date in a spreadsheet is just a number wearing a date format, so the format is read too and the number turned back into a date. Without that step every date here would be a five-digit integer.',
  },
  ar: {
    pick: 'اختر جدول بيانات',
    intro: 'افتح ملف ‎.xlsx‎ واستخرج بياناته بصيغة CSV أو TSV أو JSON — دون رفعه إلى أي مكان. القيم فقط: تخرج التواريخ تواريخَ، وتخرج المعادلات بالقيمة التي حسبها الجدول آخر مرة.',
    reading: 'جارٍ القراءة…',
    sheet: 'الورقة', format: 'الصيغة',
    header: 'الصف الأول عناوين',
    delim: 'الفاصل', comma: 'فاصلة', semi: 'فاصلة منقوطة', tab: 'مسافة جدولة',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'نزّل',
    preview: 'معاينة', more: (n: number) => `+${n.toLocaleString('ar')} صفًا آخر`,
    size: (r: number, c: number) => `${r.toLocaleString('ar')} صفًا × ${c} عمودًا`,
    empty: 'هذه الورقة فارغة.',
    again: 'اختر ملفًا آخر',
    errors: {
      'not-xlsx': 'هذا ليس مصنّف ‎.xlsx‎. أما صيغة ‎.xls‎ القديمة وملفات Apple Numbers فصيغ أخرى لا تقرأها هذه الأداة — احفظ الملف بصيغة ‎.xlsx‎ أولًا.',
      'not-a-zip': 'تعذّر فتح هذا الملف بوصفه ‎.xlsx‎ (فملف ‎.xlsx‎ أرشيف مضغوط، وهذا ليس كذلك).',
      'no-sheets': 'لم يُعثر على أوراق في هذا المصنّف.',
      generic: 'تعذّرت قراءة هذا الملف.',
    } as Record<string, string>,
    valuesNote: 'لا يُعاد حساب المعادلات — بل تحصل على القيمة التي خزّنها الجدول عند آخر حفظ. ولا تُنقل التنسيقات والألوان والخلايا المدمجة والرسوم البيانية، لأن CSV وJSON لا مكان فيهما لها.',
    dateNote: 'التاريخ في الجدول ليس إلا رقمًا يرتدي تنسيق تاريخ، ولذلك يُقرأ التنسيق أيضًا ويُعاد الرقم تاريخًا. ولولا هذه الخطوة لخرج كل تاريخ هنا عددًا من خمس خانات.',
  },
}

type Format = 'csv' | 'tsv' | 'json'

export default function XlsxConvertTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [wb, setWb] = useState<Workbook | null>(null)
  const [name, setName] = useState('')
  const [sheet, setSheet] = useState(0)
  const [format, setFormat] = useState<Format>('csv')
  const [delim, setDelim] = useState(',')
  const [header, setHeader] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])
  useEffect(() => { setWorkInProgress(WIP, !!wb) }, [wb])

  async function pick(f: File | undefined | null) {
    if (!f) return
    setError('')
    setBusy(true)
    setWb(null)
    try {
      const book = await readWorkbook(await f.arrayBuffer())
      setWb(book)
      setName(f.name.replace(/\.[^.]+$/, ''))
      setSheet(0)
    } catch (e) {
      const key = e instanceof Error ? e.message : ''
      setError(s.errors[key] ?? s.errors.generic)
    } finally { setBusy(false) }
  }

  const rows = wb?.sheets[sheet]?.rows ?? []
  const cols = rows.reduce((n, r) => Math.max(n, r.length), 0)

  const output = useMemo(() => {
    if (!rows.length) return ''
    if (format === 'json') return toJson(rows, header)
    return toCsv(rows, format === 'tsv' ? '\t' : delim)
  }, [rows, format, delim, header])

  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  function download() {
    const ext = format === 'json' ? 'json' : format === 'tsv' ? 'tsv' : 'csv'
    const type = format === 'json' ? 'application/json' : 'text/csv'
    const blob = new Blob([output], { type: `${type};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name || 'sheet'}-${wb?.sheets[sheet]?.name || ''}.${ext}`.replace(/\s+/g, '-')
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Stack data-testid="xlsx-convert">
      {!wb && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="xl-file"
              onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {busy && <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="xl-reading"><Spinner /> {s.reading}</p>}
      {error && <FileError message={error} />}

      {wb && (
        <>
          <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
            <Field label={s.sheet}>
              <Select value={sheet} data-testid="xl-sheet" onChange={(e) => setSheet(Number(e.target.value))}>
                {wb.sheets.map((sh, i) => <option key={i} value={i}>{sh.name}</option>)}
              </Select>
            </Field>
            <Field label={s.format}>
              <Seg data-testid="xl-format">
                {(['csv', 'tsv', 'json'] as Format[]).map((f) => (
                  <SegButton key={f} active={format === f} onClick={() => setFormat(f)} data-testid={`xl-format-${f}`}>
                    {f.toUpperCase()}
                  </SegButton>
                ))}
              </Seg>
            </Field>
            {format === 'csv' && (
              <Field label={s.delim}>
                <Select value={delim} data-testid="xl-delim" onChange={(e) => setDelim(e.target.value)}>
                  <option value=",">{s.comma}</option>
                  <option value=";">{s.semi}</option>
                </Select>
              </Field>
            )}
            <div className="flex items-end">
              <Check><input type="checkbox" checked={header} data-testid="xl-header"
                onChange={(e) => setHeader(e.target.checked)} /> {s.header}</Check>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={download} disabled={!output} data-testid="xl-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={copy} disabled={!output} data-testid="xl-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <span className="text-[0.85rem] text-ink-faint font-mono" data-testid="xl-size">{s.size(rows.length, cols)}</span>
          </div>

          {!rows.length && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="xl-empty">{s.empty}</p>}

          {rows.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</h2>
              <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]">
                <table className="text-[0.82rem] border-collapse" data-testid="xl-preview">
                  <tbody>
                    {rows.slice(0, 12).map((r, i) => (
                      <tr key={i} className={i === 0 && header ? 'font-semibold bg-[color-mix(in_srgb,var(--color-green-400)_8%,transparent)]' : ''}>
                        {Array.from({ length: cols }).map((_, k) => (
                          <td key={k} className="border border-[color:var(--line-soft)] px-2 py-1 whitespace-nowrap max-w-[16rem] overflow-hidden text-ellipsis">
                            {r[k] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 12 && <p className="text-[0.8rem] text-ink-faint">{s.more(rows.length - 12)}</p>}
            </section>
          )}

          <Panel className="gap-1">
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.dateNote}</p>
            <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.valuesNote}</p>
          </Panel>

          <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
            {s.again}
            <input type="file" className="hidden" data-testid="xl-file-again"
              onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </>
      )}
    </Stack>
  )
}
