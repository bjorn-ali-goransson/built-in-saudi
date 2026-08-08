import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, CopyIcon } from '../../components/icons'
import { Button, Select, Textarea, Stack, Seg, SegButton, Panel, Check, FileError } from '../../components/ui'
import { parseCsv, toCsv, sniffDelimiter, type Delimiter } from '../../lib/csv'
import { readTableFile, isSpreadsheetName } from '../../lib/tableFile'

type Mode = 'join' | 'append'

const STR = {
  en: {
    left: 'First file', right: 'Second file',
    pick: 'Choose a CSV or Excel file', paste: 'or paste it here…',
    errors: {
      'old-format': 'The old .xls format and Apple Numbers files cannot be read — re-save as .xlsx or CSV.',
      'not-xlsx': 'That file could not be opened as a spreadsheet.',
      generic: 'That file could not be read.',
    } as Record<string, string>,

    mode: 'What to do', join: 'Match rows on a column', append: 'Stack one under the other',
    joinKeyLeft: 'Match this column', joinKeyRight: 'against this one',
    keepUnmatched: 'Keep rows that found no match',
    dedupe: 'Drop exact duplicate rows',
    result: 'Result', rows: (n: number) => `${n.toLocaleString('en')} rows`,
    matched: (n: number) => `${n} matched`,
    unmatchedLeft: (n: number) => `${n} from the first file had no match`,
    unmatchedRight: (n: number) => `${n} from the second were never used`,
    copy: 'Copy', copied: 'Copied!', download: 'Download CSV',
    both: 'Load both files to begin.',
    headerMismatch: 'The two files have different columns. Stacking them will leave gaps where a column exists in one and not the other — those cells come out empty rather than shifted, which is the failure people do not notice until later.',
    dupCols: 'Both files have a column called',
    dupColsEnd: '— the second file’s is suffixed so neither is lost.',
    hint: 'Join two exports on a shared column — an id, an email, an order number — or stack two files with the same shape into one.',
  },
  ar: {
    left: 'الملف الأول', right: 'الملف الثاني',
    pick: 'اختر ملف CSV أو إكسل', paste: 'أو الصقه هنا…',
    errors: {
      'old-format': 'لا يمكن قراءة صيغة ‎.xls‎ القديمة ولا ملفات Numbers — احفظ الملف بصيغة ‎.xlsx‎ أو CSV.',
      'not-xlsx': 'تعذّر فتح هذا الملف بوصفه جدولًا.',
      generic: 'تعذّرت قراءة هذا الملف.',
    } as Record<string, string>,

    mode: 'ما المطلوب', join: 'اربط الصفوف بعمود مشترك', append: 'ضع أحدهما تحت الآخر',
    joinKeyLeft: 'اربط هذا العمود', joinKeyRight: 'بهذا العمود',
    keepUnmatched: 'أبقِ الصفوف التي لم تجد مطابقًا',
    dedupe: 'احذف الصفوف المكرّرة تمامًا',
    result: 'الناتج', rows: (n: number) => `${n.toLocaleString('ar')} صفًا`,
    matched: (n: number) => `${n.toLocaleString('ar')} صفًا مطابقًا`,
    unmatchedLeft: (n: number) => `${n.toLocaleString('ar')} من الملف الأول بلا مطابق`,
    unmatchedRight: (n: number) => `${n.toLocaleString('ar')} من الثاني لم تُستخدم`,
    copy: 'نسخ', copied: 'تم النسخ!', download: 'نزّل CSV',
    both: 'حمّل الملفين للبدء.',
    headerMismatch: 'للملفين أعمدة مختلفة. ودمجهما رأسيًا سيترك فجوات حيث يوجد عمود في أحدهما دون الآخر — وتخرج تلك الخلايا فارغة لا مزاحة، وهو الخلل الذي لا يُلاحَظ إلا لاحقًا.',
    dupCols: 'يوجد في الملفين عمود باسم',
    dupColsEnd: '— وأُضيفت لاحقة لعمود الملف الثاني حتى لا يضيع أحدهما.',
    hint: 'اربط تصديرين بعمود مشترك — معرّف أو بريد أو رقم طلب — أو ضع ملفين متطابقي الشكل في ملف واحد.',
  },
}

function useCsv() {
  const [text, setText] = useState('')
  const delimiter = useMemo(() => sniffDelimiter(text), [text])
  const rows = useMemo(() => (text.trim() ? parseCsv(text, delimiter) : []), [text, delimiter])
  return { text, setText, rows, delimiter }
}

export default function CsvMergeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const a = useCsv()
  const b = useCsv()
  const [mode, setMode] = useState<Mode>('join')
  const [keyA, setKeyA] = useState(0)
  const [keyB, setKeyB] = useState(0)
  const [keepUnmatched, setKeepUnmatched] = useState(true)
  const [dedupe, setDedupe] = useState(false)
  const [copied, setCopied] = useState(false)
  const refA = useRef<HTMLInputElement>(null)
  const refB = useRef<HTMLInputElement>(null)

  const headA = a.rows[0] ?? []
  const headB = b.rows[0] ?? []
  const ready = a.rows.length > 1 && b.rows.length > 1

  const merged = useMemo(() => {
    if (!ready) return { rows: [] as string[][], matched: 0, unmatchedLeft: 0, unmatchedRight: 0, dupCols: [] as string[] }

    if (mode === 'append') {
      // Union of columns, matched BY NAME. Positional stacking is what silently
      // shifts a phone number into the city column when the exports differ.
      const cols = [...headA]
      for (const h of headB) if (!cols.includes(h)) cols.push(h)
      const row = (head: string[], r: string[]) =>
        cols.map((c) => { const i = head.indexOf(c); return i >= 0 ? (r[i] ?? '') : '' })
      let body = [...a.rows.slice(1).map((r) => row(headA, r)), ...b.rows.slice(1).map((r) => row(headB, r))]
      if (dedupe) {
        const seen = new Set<string>()
        body = body.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true })
      }
      return { rows: [cols, ...body], matched: 0, unmatchedLeft: 0, unmatchedRight: 0, dupCols: [] }
    }

    // Join. Duplicate column names get a suffix so the second file's value is
    // not silently dropped or, worse, written over the first file's.
    const dupCols = headB.filter((h, i) => i !== keyB && headA.includes(h))
    const rightCols = headB.map((h, i) => (i === keyB ? null : dupCols.includes(h) ? `${h}_2` : h)).filter(Boolean) as string[]
    const cols = [...headA, ...rightCols]

    const index = new Map<string, string[]>()
    for (const r of b.rows.slice(1)) {
      const k = (r[keyB] ?? '').trim().toLowerCase()
      if (k && !index.has(k)) index.set(k, r)
    }
    const used = new Set<string>()
    const body: string[][] = []
    let matched = 0
    let unmatchedLeft = 0
    for (const r of a.rows.slice(1)) {
      const k = (r[keyA] ?? '').trim().toLowerCase()
      const hit = k ? index.get(k) : undefined
      if (hit) { matched++; used.add(k) }
      else {
        unmatchedLeft++
        if (!keepUnmatched) continue
      }
      const right = headB.map((_, i) => (i === keyB ? null : (hit?.[i] ?? ''))).filter((x) => x !== null) as string[]
      body.push([...r, ...right])
    }
    return { rows: [cols, ...body], matched, unmatchedLeft, unmatchedRight: index.size - used.size, dupCols }
  }, [ready, mode, a.rows, b.rows, headA, headB, keyA, keyB, keepUnmatched, dedupe])

  const [fileError, setFileError] = useState('')
  const output = useMemo(() => (merged.rows.length ? toCsv(merged.rows, ',' as Delimiter) : ''), [merged])
  const headerMismatch = mode === 'append' && ready && headA.join('|') !== headB.join('|')

  // A spreadsheet is read through the shared reader and written into the box as
  // CSV, so everything downstream is unchanged and you can SEE what was read.
  // A text file is passed through byte for byte rather than round-tripped
  // through the parser — a paste box should show you what you gave it, and
  // re-serialising would quietly renormalise the user's quoting.
  async function pick(f: File | undefined, set: (v: string) => void) {
    if (!f) return
    setFileError('')
    try {
      if (isSpreadsheetName(f.name)) set(toCsv((await readTableFile(f)).rows, ',' as Delimiter))
      else set(await f.text())
    } catch (e) {
      setFileError(s.errors[e instanceof Error ? e.message : ''] ?? s.errors.generic)
    }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  function download() {
    // BOM, so Excel opens Arabic correctly rather than as mojibake.
    const blob = new Blob(['﻿', output], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url; el.download = 'merged.csv'; el.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Stack data-testid="csv-merge">
      {fileError && <FileError message={fileError} />}
      <div className="grid gap-3 grid-cols-1 min-[760px]:grid-cols-2">
        {[{ side: a, label: s.left, ref: refA, id: 'a' }, { side: b, label: s.right, ref: refB, id: 'b' }].map((x) => (
          <div key={x.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[0.8rem] text-ink-faint flex-1">{x.label}</span>
              <input ref={x.ref} type="file" className="hidden" data-testid={`cm-file-${x.id}`}
                onChange={(e) => pick(e.target.files?.[0], x.side.setText)} />
              <Button className="px-3 py-1" onClick={() => x.ref.current?.click()} data-testid={`cm-pick-${x.id}`}>
                <UploadIcon /> {s.pick}
              </Button>
            </div>
            <Textarea className="min-h-[8rem] font-mono text-[0.8rem]" dir="ltr" data-testid={`cm-text-${x.id}`}
              placeholder={s.paste} value={x.side.text} onChange={(e) => x.side.setText(e.target.value)} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[0.8rem] text-ink-faint">{s.mode}</span>
          <Seg>
            <SegButton active={mode === 'join'} data-testid="cm-mode-join" onClick={() => setMode('join')}>{s.join}</SegButton>
            <SegButton active={mode === 'append'} data-testid="cm-mode-append" onClick={() => setMode('append')}>{s.append}</SegButton>
          </Seg>
        </div>
        {mode === 'join' && ready && (
          <>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.joinKeyLeft}
              <Select className="min-w-[9rem]" data-testid="cm-key-a" value={keyA} onChange={(e) => setKeyA(+e.target.value)}>
                {headA.map((h, i) => <option key={i} value={i}>{h || `#${i + 1}`}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.joinKeyRight}
              <Select className="min-w-[9rem]" data-testid="cm-key-b" value={keyB} onChange={(e) => setKeyB(+e.target.value)}>
                {headB.map((h, i) => <option key={i} value={i}>{h || `#${i + 1}`}</option>)}
              </Select>
            </label>
            <Check>
              <input type="checkbox" checked={keepUnmatched} data-testid="cm-keep" onChange={(e) => setKeepUnmatched(e.target.checked)} /> {s.keepUnmatched}
            </Check>
          </>
        )}
        {mode === 'append' && (
          <Check>
            <input type="checkbox" checked={dedupe} data-testid="cm-dedupe" onChange={(e) => setDedupe(e.target.checked)} /> {s.dedupe}
          </Check>
        )}
      </div>

      {!ready ? (
        <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{a.text || b.text ? s.both : s.hint}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9rem]">
            <span className="font-semibold text-ink" data-testid="cm-rows">{s.rows(Math.max(0, merged.rows.length - 1))}</span>
            {mode === 'join' && (
              <>
                <span className="text-green-700" data-testid="cm-matched">{s.matched(merged.matched)}</span>
                {merged.unmatchedLeft > 0 && <span className="text-gold-500" data-testid="cm-unmatched">{s.unmatchedLeft(merged.unmatchedLeft)}</span>}
                {merged.unmatchedRight > 0 && <span className="text-ink-faint">{s.unmatchedRight(merged.unmatchedRight)}</span>}
              </>
            )}
          </div>

          {merged.dupCols.length > 0 && (
            <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="cm-dupcols">
              {s.dupCols} <b className="font-mono">{merged.dupCols.join(', ')}</b> {s.dupColsEnd}
            </p>
          )}
          {headerMismatch && (
            <Panel><p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="cm-mismatch">{s.headerMismatch}</p></Panel>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.result}</span>
            <Button className="px-3 py-1" onClick={copy} data-testid="cm-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <Button variant="primary" className="px-3 py-1" onClick={download} data-testid="cm-download"><DownloadIcon /> {s.download}</Button>
          </div>
          <Textarea readOnly dir="ltr" className="min-h-[10rem] font-mono text-[0.8rem]"
            data-testid="cm-output" value={output} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
    </Stack>
  )
}
