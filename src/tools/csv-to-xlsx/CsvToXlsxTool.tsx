import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Check, Stack, Panel, FileError, Seg, SegButton } from '../../components/ui'
import { DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { parseCsv, sniffDelimiter } from '../../lib/csv'
import { buildXlsx, looksNumeric, safeSheetName } from '../../lib/writeXlsx'

const WIP = 'csv-to-xlsx'
type ColKind = 'auto' | 'text' | 'number'

const STR = {
  en: {
    pick: 'Choose a CSV file',
    intro: 'Turn a CSV into a real Excel file, so opening it does not damage it. A CSV carries no types, so Excel guesses — and its guesses eat the leading zero off every phone number and national ID, and round a 16-digit IBAN into scientific notation. Here each column says what it is, and the file is UTF-8 by definition, so Arabic arrives as Arabic.',
    header: 'First row is a header',
    columns: 'Columns',
    auto: 'Auto', text: 'Text', number: 'Number',
    kept: 'kept as text',
    save: 'Download the Excel file',
    rows: (r: number, c: number) => `${r} rows × ${c} columns`,
    protected: (n: number) => n === 1
      ? '1 value would have been damaged by opening the CSV directly, and is kept as text here.'
      : `${n} values would have been damaged by opening the CSV directly, and are kept as text here.`,
    none: 'Nothing in this file is at risk from Excel — but the .xlsx is still the safer thing to send.',
    preview: 'First rows',
    empty: 'That file has no rows in it.',
    error: 'That file could not be read as a CSV.',
    again: 'Choose another file',
    note: 'The whole conversion happens in your browser; the file is not uploaded.',
  },
  ar: {
    pick: 'اختر ملف CSV',
    intro: 'حوّل ملف CSV إلى ملف إكسل حقيقي، حتى لا يفسده مجرد فتحه. فملف CSV لا يحمل أنواعًا، فيخمّن إكسل — وتخمينه يأكل الصفر الأول من كل رقم جوال وهوية، ويقرّب رقم آيبان من ستة عشر رقمًا إلى صيغة أُسّية. أما هنا فيعلن كل عمود عن نوعه، والملف بترميز UTF-8 أصلًا، فتصل العربية عربيةً.',
    header: 'الصف الأول رؤوس أعمدة',
    columns: 'الأعمدة',
    auto: 'تلقائي', text: 'نص', number: 'رقم',
    kept: 'يُحفَظ نصًا',
    save: 'نزّل ملف إكسل',
    rows: (r: number, c: number) => `${r} صف × ${c} عمود`,
    protected: (n: number) => `${n} قيمة كانت ستتلف بفتح ملف CSV مباشرةً، وتُحفظ هنا نصًا.`,
    none: 'لا شيء في هذا الملف معرّض لعبث إكسل — ومع ذلك يبقى ملف ‎.xlsx‎ أسلم ما تُرسله.',
    preview: 'الصفوف الأولى',
    empty: 'لا صفوف في هذا الملف.',
    error: 'تعذّر قراءة هذا الملف كملف CSV.',
    again: 'اختر ملفًا آخر',
    note: 'تجري العملية كاملةً في متصفحك؛ ولا يُرفع الملف.',
  },
}

/** A value Excel would silently damage if it read it out of a CSV. */
function atRisk(v: string): boolean {
  if (!/^[+-]?\d[\d.]*$/.test(v)) return false
  // A leading zero is lost; 16+ digits go to scientific notation and round.
  return /^0\d/.test(v) || v.replace(/\D/g, '').length > 15 || v.startsWith('+')
}

export default function CsvToXlsxTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [name, setName] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [header, setHeader] = useState(true)
  const [kinds, setKinds] = useState<ColKind[]>([])
  const [error, setError] = useState('')

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])

  async function pick(f: File | undefined | null) {
    if (!f) return
    setError('')
    try {
      const text = await f.text()
      const parsed = parseCsv(text, sniffDelimiter(text)).filter((r) => r.some((c) => (c ?? '').trim()))
      if (!parsed.length) { setError(s.empty); setRows([]); return }
      const width = Math.max(...parsed.map((r) => r.length))
      setRows(parsed.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')))
      setKinds(Array.from({ length: width }, () => 'auto' as ColKind))
      setName(f.name)
      setWorkInProgress(WIP, true)
    } catch {
      setError(s.error)
    }
  }

  const body = header ? rows.slice(1) : rows
  const risky = useMemo(
    () => body.reduce((n, r) => n + r.filter(atRisk).length, 0),
    [body],
  )

  function save() {
    const blob = buildXlsx([{
      name: safeSheetName(name.replace(/\.(csv|tsv|txt)$/i, '')),
      rows,
      header,
      isText: (v, c, r) => {
        if (header && r === 0) return true
        const kind = kinds[c] ?? 'auto'
        if (kind === 'text') return true
        if (kind === 'number') return !looksNumeric(v)
        return !looksNumeric(v)
      },
    }])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name.replace(/\.(csv|tsv|txt)$/i, '') + '.xlsx'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const headings = header ? rows[0] : rows[0]?.map((_, i) => String.fromCharCode(65 + (i % 26)))

  return (
    <Stack data-testid="csv-to-xlsx">
      {!rows.length && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="cx-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {error && <FileError message={error} />}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={save} data-testid="cx-save"><DownloadIcon /> {s.save}</Button>
            <span className="text-[0.85rem] text-ink-faint" data-testid="cx-size">{s.rows(body.length, rows[0].length)}</span>
            <Check>
              <input type="checkbox" checked={header} data-testid="cx-header" onChange={(e) => setHeader(e.target.checked)} />
              {s.header}
            </Check>
          </div>

          <p className="text-[0.9rem] rtl:font-ar" data-testid="cx-protected">
            {risky > 0 ? <span className="text-gold-500">{s.protected(risky)}</span> : <span className="text-ink-faint">{s.none}</span>}
          </p>

          <div className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.columns}</h2>
            <div className="grid gap-2 grid-cols-1 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3">
              {kinds.map((kind, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 py-1.5">
                  <span className="truncate text-[0.85rem] text-ink" title={headings?.[i]} data-testid={`cx-col-${i}`}>{headings?.[i] || '—'}</span>
                  <Seg>
                    {(['auto', 'text', 'number'] as ColKind[]).map((k) => (
                      <SegButton key={k} data-testid={`cx-kind-${i}-${k}`} active={kind === k}
                        onClick={() => setKinds((p) => p.map((x, j) => (j === i ? k : x)))}>
                        {s[k]}
                      </SegButton>
                    ))}
                  </Seg>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</h2>
            <div className="overflow-x-auto">
              <table className="border-collapse text-[0.82rem]" data-testid="cx-preview">
                <tbody>
                  {rows.slice(0, 8).map((r, ri) => (
                    <tr key={ri}>
                      {r.map((c, ci) => (
                        <td key={ci} dir="auto"
                          className={`border border-[color:var(--line)] px-2 py-1 whitespace-nowrap ${header && ri === 0 ? 'font-semibold text-ink' : 'text-ink-soft'} ${atRisk(c) && !(header && ri === 0) ? 'text-gold-500' : ''}`}>
                          {c || ' '}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.note}</p></Panel>

          <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
            {s.again}
            <input type="file" className="hidden" data-testid="cx-file-again" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </>
      )}
    </Stack>
  )
}
