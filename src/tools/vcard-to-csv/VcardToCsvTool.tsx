import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Stack, Panel, FileError } from '../../components/ui'
import { DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { parseVcf, contactsToRows } from '../../lib/vcardRead'
import { buildXlsx, safeSheetName } from '../../lib/writeXlsx'
import { toCsv } from '../../lib/csv'

const WIP = 'vcard-to-csv'

const STR = {
  en: {
    pick: 'Choose a .vcf file',
    intro: 'Turn the contacts file your phone exports into a table you can actually read. Names encoded the way Android writes them come out as names, an Apple export keeps the numbers it hides behind item groups, and a contact with three phone numbers gets three columns rather than losing two of them.',
    found: (n: number) => `${n} contact${n === 1 ? '' : 's'}`,
    csv: 'Download CSV', excel: 'Download Excel',
    preview: 'First rows',
    empty: 'No contacts were found in that file. A .vcf begins with BEGIN:VCARD — if this one does not, it is not a contacts export.',
    error: 'That file could not be read.',
    again: 'Choose another file',
    note: 'Photos are left out on purpose: they are base64 blobs that would make the spreadsheet unopenable and tell you nothing in a cell. Everything happens in your browser — a contacts file is about as personal as a file gets, and it is not uploaded.',
    excelNote: 'The Excel file keeps phone numbers as text, so the leading zero survives.',
  },
  ar: {
    pick: 'اختر ملف ‎.vcf‎',
    intro: 'حوّل ملف جهات الاتصال الذي يصدّره هاتفك إلى جدول يمكنك قراءته فعلًا. فالأسماء المكتوبة بالطريقة التي يكتبها أندرويد تخرج أسماءً، وتصدير آيفون يحتفظ بالأرقام التي يخفيها خلف المجموعات، ومن له ثلاثة أرقام يحصل على ثلاثة أعمدة بدل أن يضيع منها رقمان.',
    found: (n: number) => `${n} جهة اتصال`,
    csv: 'نزّل CSV', excel: 'نزّل إكسل',
    preview: 'الصفوف الأولى',
    empty: 'لم يُعثر على جهات اتصال في هذا الملف. وملف ‎.vcf‎ يبدأ بـ BEGIN:VCARD — فإن لم يبدأ به فليس تصديرًا لجهات الاتصال.',
    error: 'تعذّرت قراءة هذا الملف.',
    again: 'اختر ملفًا آخر',
    note: 'تُستثنى الصور عمدًا: فهي كتل base64 تجعل الجدول غير قابل للفتح ولا تفيدك في خلية. وكل شيء يجري في متصفحك — فملف جهات الاتصال من أشد الملفات خصوصية، وهو لا يُرفع.',
    excelNote: 'ملف إكسل يحفظ أرقام الجوال نصًا، فيبقى الصفر الأول.',
  },
}

export default function VcardToCsvTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [name, setName] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [count, setCount] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])

  async function pick(f: File | undefined | null) {
    if (!f) return
    setError('')
    try {
      const contacts = parseVcf(await f.text())
      if (!contacts.length) { setError(s.empty); setRows([]); return }
      setRows(contactsToRows(contacts, locale))
      setCount(contacts.length)
      setName(f.name)
      setWorkInProgress(WIP, true)
    } catch {
      setError(s.error)
    }
  }

  const base = useMemo(() => name.replace(/\.vcf$/i, '') || 'contacts', [name])

  async function save(kind: 'csv' | 'xlsx') {
    const blob = kind === 'csv'
      // A BOM, because the most likely next step is opening it in Excel and
      // without one every Arabic name arrives as mojibake.
      ? new Blob(['﻿' + toCsv(rows, ',')], { type: 'text/csv;charset=utf-8' })
      : await buildXlsx([{
        name: safeSheetName(base, 'Contacts'),
        rows,
        header: true,
        // Every cell here is a name, a number that must keep its zero, or an
        // address. None of it is arithmetic.
        isText: () => true,
      }])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${base}.${kind}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Stack data-testid="vcard-to-csv">
      {!rows.length && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="vc-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {error && <FileError message={error} />}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => save('csv')} data-testid="vc-csv"><DownloadIcon /> {s.csv}</Button>
            <Button onClick={() => save('xlsx')} data-testid="vc-xlsx"><DownloadIcon /> {s.excel}</Button>
            <span className="text-[0.85rem] text-ink-faint" data-testid="vc-count">{s.found(count)}</span>
          </div>
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.excelNote}</p>

          <div className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</h2>
            <div className="overflow-x-auto">
              <table className="border-collapse text-[0.82rem]" data-testid="vc-preview">
                <tbody>
                  {rows.slice(0, 9).map((r, ri) => (
                    <tr key={ri}>
                      {r.map((c, ci) => (
                        <td key={ci} dir="auto"
                          className={`border border-[color:var(--line)] px-2 py-1 whitespace-nowrap ${ri === 0 ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
                          {c || ' '}
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
            <input type="file" className="hidden" data-testid="vc-file-again" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </>
      )}
    </Stack>
  )
}
