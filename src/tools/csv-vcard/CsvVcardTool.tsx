import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Select, Check, Stack, Panel, FileError, Spinner } from '../../components/ui'
import { CopyIcon, DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { readTableFile } from '../../lib/tableFile'
import { FIELDS, buildAll, guessMapping, isUsable, rowToContact, type Field } from './vcard'

const WIP = 'csv-vcard'

const STR = {
  en: {
    pick: 'Choose a CSV or Excel file',
    intro: 'Turn a spreadsheet of people into a .vcf your phone will import — names, numbers, emails, companies. Nothing is uploaded. Saudi numbers are rewritten in international form, because 0512345678 stops meaning anything the moment the phone leaves the country.',
    reading: 'Reading…',
    header: 'First row is a header',
    mapping: 'What each column is',
    fields: {
      ignore: '— skip —', fullName: 'Full name', firstName: 'First name', lastName: 'Last name',
      phone: 'Phone', phone2: 'Second phone', email: 'Email', org: 'Company',
      title: 'Job title', address: 'Address', url: 'Website', note: 'Note',
    } as Record<Field, string>,
    guessed: 'Columns were matched by their headings — check them.',
    download: 'Download .vcf', copy: 'Copy', copied: 'Copied!',
    count: (n: number) => `${n} contact${n === 1 ? '' : 's'}`,
    skipped: (n: number) => `${n} row${n === 1 ? '' : 's'} had no name at all and were left out — a contact with no name cannot be imported.`,
    needName: 'Point at least one column at a name before anything can be exported.',
    preview: 'First contact',
    again: 'Choose another file',
    errors: {
      empty: 'That file had no rows in it.',
      'old-format': 'The old .xls format and Apple Numbers files cannot be read — re-save as .xlsx or CSV.',
      generic: 'That file could not be read. A CSV or an .xlsx works.',
    } as Record<string, string>,
    phoneNote: 'Numbers that look Saudi become +966…; anything already international is kept as it is, and anything else is passed through untouched rather than guessed at.',
    nameNote: 'Each card carries both FN (what you see) and N (family and given name separately). Address books sort and merge on N, so a file with only FN imports as a heap of contacts with no surnames.',
  },
  ar: {
    pick: 'اختر ملف CSV أو إكسل',
    intro: 'حوّل جدول أشخاص إلى ملف ‎.vcf‎ يستورده هاتفك — أسماء وأرقام وبُرد إلكترونية وشركات. ولا يُرفع شيء. وتُعاد كتابة الأرقام السعودية بالصيغة الدولية، لأن 0512345678 يفقد معناه لحظة خروج الهاتف من البلد.',
    reading: 'جارٍ القراءة…',
    header: 'الصف الأول عناوين',
    mapping: 'ما الذي يمثّله كل عمود',
    fields: {
      ignore: '— تخطَّ —', fullName: 'الاسم الكامل', firstName: 'الاسم الأول', lastName: 'اسم العائلة',
      phone: 'الجوال', phone2: 'جوال آخر', email: 'البريد', org: 'الشركة',
      title: 'المسمى الوظيفي', address: 'العنوان', url: 'الموقع', note: 'ملاحظة',
    } as Record<Field, string>,
    guessed: 'طوبِقت الأعمدة من عناوينها — راجعها.',
    download: 'نزّل ملف ‎.vcf‎', copy: 'نسخ', copied: 'تم النسخ!',
    count: (n: number) => `${n} جهة اتصال`,
    skipped: (n: number) => `${n} صفًا بلا اسم البتة استُبعدت — فجهة اتصال بلا اسم لا يمكن استيرادها.`,
    needName: 'وجّه عمودًا واحدًا على الأقل إلى اسم قبل التصدير.',
    preview: 'أول جهة اتصال',
    again: 'اختر ملفًا آخر',
    errors: {
      empty: 'لا صفوف في هذا الملف.',
      'old-format': 'لا يمكن قراءة صيغة ‎.xls‎ القديمة ولا ملفات Numbers — احفظ الملف بصيغة ‎.xlsx‎ أو CSV.',
      generic: 'تعذّرت قراءة هذا الملف. ملفات CSV و‎.xlsx‎ تعمل.',
    } as Record<string, string>,
    phoneNote: 'الأرقام التي تبدو سعودية تصير ‎+966…‎؛ وما كان دوليًا يبقى كما هو، وما عدا ذلك يمرّ كما كُتب دون تخمين.',
    nameNote: 'تحمل كل بطاقة الحقلين FN (ما تراه) وN (اسم العائلة والاسم الأول منفصلين). ودفاتر العناوين ترتّب وتدمج على N، فالملف الذي لا يحمل إلا FN يُستورد كومةً من جهات بلا ألقاب.',
  },
}

export default function CsvVcardTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Field[]>([])
  const [header, setHeader] = useState(true)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const set = (i: number, f: Field) => setMapping((m) => m.map((x, k) => (k === i ? f : x)))

  async function pick(file: File | undefined | null) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      // The shared reader, not a copy of it. The copy that used to be here fell
      // through to file.text() for anything not ending .xlsx — so a legacy .xls
      // (an OLE compound file) was decoded as text and parsed as a table, and
      // the tool showed a grid of mojibake with no error at all. Its own copy
      // already SAID .xls does not work; nothing implemented that.
      const t = await readTableFile(file)
      const table = t.rows
      if (!table.length) { setError(s.errors.empty); setRows([]); return }
      setRows(table)
      setMapping(guessMapping(table[0]))
      setName(file.name.replace(/\.[^.]+$/, ''))
      setWorkInProgress(WIP, true)
    } catch (e) {
      setError(s.errors[e instanceof Error ? e.message : ''] ?? s.errors.generic)
      setRows([])
    } finally { setBusy(false) }
  }

  const body = useMemo(() => (header ? rows.slice(1) : rows), [rows, header])
  const contacts = useMemo(() => body.map((r) => rowToContact(r, mapping)), [body, mapping])
  const usable = useMemo(() => contacts.filter(isUsable), [contacts])
  const skipped = contacts.length - usable.length
  const hasName = mapping.some((f) => f === 'fullName' || f === 'firstName' || f === 'lastName')
  const vcf = useMemo(() => (usable.length ? buildAll(usable) : ''), [usable])

  function download() {
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name || 'contacts'}.vcf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  async function copy() {
    try { await navigator.clipboard.writeText(vcf); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="csv-vcard">
      {!rows.length && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="cv-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {busy && <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="cv-reading"><Spinner /> {s.reading}</p>}
      {error && <FileError message={error} />}

      {rows.length > 0 && (
        <>
          <Panel className="gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <Check><input type="checkbox" checked={header} data-testid="cv-header" onChange={(e) => setHeader(e.target.checked)} /> {s.header}</Check>
              <span className="text-[0.85rem] text-ink-faint" data-testid="cv-count">{s.count(usable.length)}</span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[0.82rem] font-semibold text-ink-soft">{s.mapping}</span>
              <div className="grid gap-2 grid-cols-1 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3">
                {rows[0].map((h, i) => (
                  <label key={i} className="flex items-center gap-2 text-[0.82rem]">
                    <span className="text-ink-faint truncate max-w-[9rem]" title={h}>{header ? h || `#${i + 1}` : `#${i + 1}`}</span>
                    <Select value={mapping[i] ?? 'ignore'} data-testid={`cv-map-${i}`} className="flex-1"
                      onChange={(e) => set(i, e.target.value as Field)}>
                      {FIELDS.map((f) => <option key={f} value={f}>{s.fields[f]}</option>)}
                    </Select>
                  </label>
                ))}
              </div>
              <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.guessed}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={download} disabled={!vcf} data-testid="cv-download"><DownloadIcon /> {s.download}</Button>
              <Button onClick={copy} disabled={!vcf} data-testid="cv-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            </div>
            {!hasName && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="cv-need-name">{s.needName}</p>}
            {skipped > 0 && <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="cv-skipped">{s.skipped(skipped)}</p>}
          </Panel>

          {vcf && (
            <section className="flex flex-col gap-2">
              <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</h2>
              <pre className="overflow-x-auto rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-3 font-mono text-[0.78rem] text-ink" data-testid="cv-preview">
                {vcf.split('END:VCARD')[0] + 'END:VCARD'}
              </pre>
            </section>
          )}

          <Panel className="gap-1">
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.phoneNote}</p>
            <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.nameNote}</p>
          </Panel>

          <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
            {s.again}
            <input type="file" className="hidden" data-testid="cv-file-again" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </>
      )}
    </Stack>
  )
}
