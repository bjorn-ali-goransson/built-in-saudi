import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Select, Check, Stack, Panel, Seg, SegButton, FileError } from '../../components/ui'
import { DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { readTableFile, type Table } from '../../lib/tableFile'
import { diffTables, diffToCsv, type DiffOptions } from './diff'

const WIP = 'sheet-diff'

const STR = {
  en: {
    intro: 'Compare two versions of the same spreadsheet — CSV or Excel — and see exactly which rows were added, removed or changed, and which cell changed in each. Nothing is uploaded.',
    old: 'The older file', neu: 'The newer file', choose: 'Choose a file',
    match: 'Match rows by', key: 'A column', position: 'Their position',
    keyCol: 'Key column',
    positionNote: 'Matching by position only tells the truth if nobody sorted, inserted or deleted anything — which is usually what happened, or you would not be comparing. A key column is almost always the right answer.',
    header: 'First row is a header',
    ignoreCase: 'Ignore case', ignoreSpace: 'Ignore extra spaces',
    added: 'Added', removed: 'Removed', changed: 'Changed', same: 'Unchanged',
    summary: 'Summary', changes: 'Changes',
    colsAdded: (c: string[]) => `New columns: ${c.join(', ')}`,
    colsRemoved: (c: string[]) => `Columns no longer there: ${c.join(', ')}`,
    dupes: (n: number) => `${n} duplicate key${n === 1 ? '' : 's'} — with the same key on more than one row there is no single row to compare, so only the first was used. Pick a column that is unique, or match by position.`,
    none: 'No differences.',
    download: 'Download the changes as CSV',
    colKey: 'Key', colChange: 'Change', colColumn: 'Column', colBefore: 'Before', colAfter: 'After',
    errors: {
      'old-format': 'The old .xls format and Apple Numbers files are different formats this cannot read — re-save as .xlsx or CSV.',
      'not-xlsx': 'That file could not be opened as a spreadsheet.',
      'no-sheets': 'No sheets were found in that workbook.',
      generic: 'That file could not be read.',
    } as Record<string, string>,
    bothNeeded: 'Choose both files.',
  },
  ar: {
    intro: 'قارن نسختين من الجدول نفسه — CSV أو إكسل — وشاهد بالضبط أي الصفوف أُضيفت وأيها حُذفت وأيها تغيّرت، وأي خلية تغيّرت في كل منها. ولا يُرفع شيء.',
    old: 'الملف الأقدم', neu: 'الملف الأحدث', choose: 'اختر ملفًا',
    match: 'مطابقة الصفوف بـ', key: 'عمود', position: 'موضعها',
    keyCol: 'عمود المفتاح',
    positionNote: 'المطابقة بالموضع لا تصدق إلا إن لم يفرز أحد أو يضف أو يحذف — وهو غالبًا ما حدث، وإلا لما قارنت. وعمود المفتاح هو الجواب الصحيح في الغالب.',
    header: 'الصف الأول عناوين',
    ignoreCase: 'تجاهل حالة الأحرف', ignoreSpace: 'تجاهل المسافات الزائدة',
    added: 'مضافة', removed: 'محذوفة', changed: 'متغيّرة', same: 'دون تغيير',
    summary: 'الخلاصة', changes: 'التغييرات',
    colsAdded: (c: string[]) => `أعمدة جديدة: ${c.join('، ')}`,
    colsRemoved: (c: string[]) => `أعمدة لم تعد موجودة: ${c.join('، ')}`,
    dupes: (n: number) => `${n} مفتاحًا مكرّرًا — فحين يتكرر المفتاح في أكثر من صف لا يوجد صف واحد للمقارنة، ولم يُستخدم إلا الأول. اختر عمودًا فريدًا أو طابِق بالموضع.`,
    none: 'لا فروق.',
    download: 'نزّل التغييرات بصيغة CSV',
    colKey: 'المفتاح', colChange: 'التغيير', colColumn: 'العمود', colBefore: 'قبل', colAfter: 'بعد',
    errors: {
      'old-format': 'صيغة ‎.xls‎ القديمة وملفات Numbers صيغ أخرى لا تقرأها الأداة — احفظ الملف بصيغة ‎.xlsx‎ أو CSV.',
      'not-xlsx': 'تعذّر فتح هذا الملف بوصفه جدولًا.',
      'no-sheets': 'لم يُعثر على أوراق في هذا المصنّف.',
      generic: 'تعذّرت قراءة هذا الملف.',
    } as Record<string, string>,
    bothNeeded: 'اختر الملفين.',
  },
}

export default function SheetDiffTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [a, setA] = useState<Table | null>(null)
  const [b, setB] = useState<Table | null>(null)
  const [error, setError] = useState('')
  const [o, setO] = useState<DiffOptions>({ keyColumn: 0, mode: 'key', ignoreCase: false, ignoreWhitespace: true, headerRow: true })

  const set = <K extends keyof DiffOptions>(k: K, v: DiffOptions[K]) => setO((p) => ({ ...p, [k]: v }))

  async function pick(which: 'a' | 'b', file: File | undefined | null) {
    if (!file) return
    setError('')
    try {
      const t = await readTableFile(file)
      if (which === 'a') setA(t); else setB(t)
      setWorkInProgress(WIP, true)
    } catch (e) {
      setError(s.errors[e instanceof Error ? e.message : ''] ?? s.errors.generic)
    }
  }

  const result = useMemo(() => (a && b ? diffTables(a.rows, b.rows, o) : null), [a, b, o])
  const headers = (o.headerRow ? (b?.rows[0] ?? a?.rows[0] ?? []) : []).map((h, i) => h || `#${i + 1}`)
  const counts = useMemo(() => ({
    added: result?.rows.filter((r) => r.kind === 'added').length ?? 0,
    removed: result?.rows.filter((r) => r.kind === 'removed').length ?? 0,
    changed: result?.rows.filter((r) => r.kind === 'changed').length ?? 0,
  }), [result])

  function download() {
    if (!result) return
    const blob = new Blob([diffToCsv(result)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = 'changes.csv'
    el.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const picker = (which: 'a' | 'b', table: Table | null, label: string, testid: string) => (
    <div className="flex flex-col gap-1">
      <span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{label}</span>
      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-[0.9rem] cursor-pointer">
        <UploadIcon />
        <span className="truncate max-w-[12rem]" data-testid={`${testid}-name`}>{table ? table.label : s.choose}</span>
        <input type="file" className="hidden" data-testid={testid} onChange={(e) => { void pick(which, e.target.files?.[0]) }} />
      </label>
    </div>
  )

  return (
    <Stack data-testid="sheet-diff">
      <Panel className="gap-3">
        <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
        <div className="flex flex-wrap gap-4">
          {picker('a', a, s.old, 'sd-file-a')}
          {picker('b', b, s.neu, 'sd-file-b')}
        </div>
        {error && <FileError message={error} />}

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.match}</span>
            <Seg data-testid="sd-mode">
              <SegButton active={o.mode === 'key'} onClick={() => set('mode', 'key')} data-testid="sd-mode-key">{s.key}</SegButton>
              <SegButton active={o.mode === 'position'} onClick={() => set('mode', 'position')} data-testid="sd-mode-position">{s.position}</SegButton>
            </Seg>
          </div>
          {o.mode === 'key' && headers.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.keyCol}</span>
              <Select value={o.keyColumn} data-testid="sd-key" onChange={(e) => set('keyColumn', Number(e.target.value))}>
                {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <Check><input type="checkbox" checked={o.headerRow} data-testid="sd-header" onChange={(e) => set('headerRow', e.target.checked)} /> {s.header}</Check>
          <Check><input type="checkbox" checked={o.ignoreCase} data-testid="sd-case" onChange={(e) => set('ignoreCase', e.target.checked)} /> {s.ignoreCase}</Check>
          <Check><input type="checkbox" checked={o.ignoreWhitespace} data-testid="sd-space" onChange={(e) => set('ignoreWhitespace', e.target.checked)} /> {s.ignoreSpace}</Check>
        </div>
        {o.mode === 'position' && <p className="text-[0.82rem] text-gold-500 rtl:font-ar" data-testid="sd-position-note">{s.positionNote}</p>}
      </Panel>

      {!result && <p className="text-ink-faint rtl:font-ar" data-testid="sd-both-needed">{s.bothNeeded}</p>}

      {result && (
        <>
          <div className="flex flex-wrap gap-3" data-testid="sd-summary">
            {([['added', counts.added, 'text-green-700'], ['removed', counts.removed, 'text-gold-500'], ['changed', counts.changed, 'text-ink'], ['same', result.same, 'text-ink-faint']] as const).map(([k, n, tone]) => (
              <div key={k} className="flex flex-col items-center px-4 py-2 rounded-md border border-[color:var(--line)] bg-[var(--surface)]">
                <span className={`font-mono text-[1.4rem] ${tone}`} data-testid={`sd-${k}`}>{n}</span>
                <span className="text-[0.72rem] text-ink-faint rtl:font-ar">{s[k]}</span>
              </div>
            ))}
          </div>

          {result.addedColumns.length > 0 && <p className="text-[0.85rem] text-ink-soft" data-testid="sd-cols-added">{s.colsAdded(result.addedColumns)}</p>}
          {result.removedColumns.length > 0 && <p className="text-[0.85rem] text-ink-soft" data-testid="sd-cols-removed">{s.colsRemoved(result.removedColumns)}</p>}
          {result.duplicateKeys.length > 0 && (
            <p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="sd-dupes">{s.dupes(result.duplicateKeys.length)}</p>
          )}

          {result.rows.length === 0 ? (
            <p className="text-[0.95rem] text-green-700 rtl:font-ar" data-testid="sd-none">{s.none}</p>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.changes}</h2>
                <Button className="px-3 py-1" onClick={download} data-testid="sd-download"><DownloadIcon /> {s.download}</Button>
              </div>
              <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]">
                <table className="w-full text-[0.82rem] border-collapse" data-testid="sd-table">
                  <thead>
                    <tr className="text-ink-faint text-[0.7rem] uppercase tracking-[0.05em]">
                      <th className="text-start px-3 py-2 font-body">{s.colChange}</th>
                      <th className="text-start px-3 py-2 font-body">{s.colKey}</th>
                      <th className="text-start px-3 py-2 font-body">{s.colColumn}</th>
                      <th className="text-start px-3 py-2 font-body">{s.colBefore}</th>
                      <th className="text-start px-3 py-2 font-body">{s.colAfter}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.flatMap((r) =>
                      r.kind === 'changed'
                        ? r.changes.map((c, i) => (
                          <tr key={`${r.key}-${i}`} className="border-t border-[color:var(--line-soft)]" data-testid={`sd-row-${r.kind}`}>
                            <td className="px-3 py-1.5 text-ink-soft">{s.changed}</td>
                            <td className="px-3 py-1.5 font-mono text-ink">{r.key}</td>
                            <td className="px-3 py-1.5 text-ink-soft">{c.column}</td>
                            <td className="px-3 py-1.5 text-gold-500 line-through">{c.before || '—'}</td>
                            <td className="px-3 py-1.5 text-green-700">{c.after || '—'}</td>
                          </tr>
                        ))
                        : [(
                          <tr key={r.key} className="border-t border-[color:var(--line-soft)]" data-testid={`sd-row-${r.kind}`}>
                            <td className={`px-3 py-1.5 ${r.kind === 'added' ? 'text-green-700' : 'text-gold-500'}`}>{r.kind === 'added' ? s.added : s.removed}</td>
                            <td className="px-3 py-1.5 font-mono text-ink">{r.key}</td>
                            <td className="px-3 py-1.5 text-ink-faint">—</td>
                            <td className="px-3 py-1.5 text-ink-soft break-all">{r.before.join(' | ') || '—'}</td>
                            <td className="px-3 py-1.5 text-ink-soft break-all">{r.after.join(' | ') || '—'}</td>
                          </tr>
                        )],
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Stack>
  )
}
