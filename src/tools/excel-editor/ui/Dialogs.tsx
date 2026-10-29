// The small dialogs the ribbon opens. Each takes what it edits and hands back
// what it should become; the editor turns that into an operation.
import { useMemo, useState } from 'react'
import { Sheet, SheetTitle, SheetActions, Button, Input, Textarea, Select } from '../../../components/ui'
import { SWATCHES } from '../../../components/office/Ribbon'
import type { XlStr } from '../strings'
import type { CondRule, DefinedName, ScaleKind, Validation } from '../engine/model'
import { formatCode } from '../engine/fmtcode'
import { SUPPORTED_FUNCTIONS } from '../engine/formula'
import { validName } from '../actions'

const field = 'block text-[0.82rem] text-ink-soft mb-1'

export function LinkDialog({ s, url: url0, text: text0, onSave, onRemove, onClose }: { s: XlStr; url: string; text: string; onSave: (url: string, text: string) => void; onRemove?: () => void; onClose: () => void }) {
  const [url, setUrl] = useState(url0)
  const [text, setText] = useState(text0)
  const ok = /^(https?:\/\/|mailto:|tel:|#)/i.test(url.trim()) || /^[\w.-]+\.[a-z]{2,}/i.test(url.trim())
  return (
    <Sheet onClose={onClose} data-testid="xl-link-dialog">
      <SheetTitle>{s.link}</SheetTitle>
      <label className="block mb-3"><span className={field}>{s.linkUrl}</span><Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} data-testid="xl-link-url" dir="ltr" className="w-full" /></label>
      <label className="block"><span className={field}>{s.linkText}</span><Input value={text} onChange={(e) => setText(e.target.value)} data-testid="xl-link-text" dir="auto" className="w-full" /></label>
      <SheetActions>
        {onRemove && <Button onClick={() => { onRemove(); onClose() }} data-testid="xl-link-remove">{s.removeLink}</Button>}
        <Button variant="primary" disabled={!ok} data-testid="xl-link-save" onClick={() => { const u = url.trim(); onSave(/^[a-z]+:|^#/i.test(u) ? u : 'https://' + u, text); onClose() }}>{s.ok}</Button>
      </SheetActions>
    </Sheet>
  )
}

export function NoteDialog({ s, note, onSave, onClose }: { s: XlStr; note: string; onSave: (n: string | null) => void; onClose: () => void }) {
  const [v, setV] = useState(note)
  return (
    <Sheet onClose={onClose} data-testid="xl-note-dialog">
      <SheetTitle>{s.note}</SheetTitle>
      <Textarea autoFocus value={v} onChange={(e) => setV(e.target.value)} rows={5} data-testid="xl-note-text" dir="auto" className="w-full" />
      <SheetActions>
        {note && <Button onClick={() => { onSave(null); onClose() }} data-testid="xl-note-remove">{s.removeNote}</Button>}
        <Button variant="primary" data-testid="xl-note-save" onClick={() => { onSave(v.trim() ? v : null); onClose() }}>{s.ok}</Button>
      </SheetActions>
    </Sheet>
  )
}

export function ValidationDialog({ s, current, onSave, onClose }: { s: XlStr; current: Validation | null; onSave: (v: { list?: string[]; source?: string } | null) => void; onClose: () => void }) {
  const [text, setText] = useState(current?.list?.join('\n') || current?.source || '')
  const isRange = text.trim().startsWith('=')
  return (
    <Sheet onClose={onClose} data-testid="xl-validation-dialog">
      <SheetTitle>{s.validation}</SheetTitle>
      <label className="block"><span className={field}>{s.listOptions}</span>
        <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={6} data-testid="xl-validation-options" dir="auto" className="w-full" />
      </label>
      <p className="text-[0.8rem] text-ink-faint mt-1">{s.listFromRange}</p>
      <SheetActions>
        {current && <Button onClick={() => { onSave(null); onClose() }} data-testid="xl-validation-remove">{s.removeValidation}</Button>}
        <Button variant="primary" data-testid="xl-validation-save" disabled={!text.trim()} onClick={() => {
          onSave(isRange ? { source: text.trim() } : { list: text.split('\n').map((x) => x.trim()).filter(Boolean) })
          onClose()
        }}>{s.ok}</Button>
      </SheetActions>
    </Sheet>
  )
}

export function NamesDialog({ s, names, selectionRef, onSave, onClose }: { s: XlStr; names: DefinedName[]; selectionRef: string; onSave: (n: DefinedName[]) => void; onClose: () => void }) {
  const [list, setList] = useState<DefinedName[]>(names)
  const [name, setName] = useState('')
  const [ref, setRef] = useState(selectionRef)
  const bad = !!name && (!validName(name) || list.some((n) => n.name.toLowerCase() === name.toLowerCase()))
  return (
    <Sheet onClose={onClose} data-testid="xl-names-dialog">
      <SheetTitle>{s.names}</SheetTitle>
      <ul className="divide-y divide-[color:var(--line-soft)] mb-3" data-testid="xl-names-list">
        {list.map((n, i) => (
          <li key={n.name} className="flex items-center gap-2 py-1.5 text-[0.88rem]" data-testid="xl-name-row">
            <b className="flex-1 font-mono" dir="auto">{n.name}</b><span className="font-mono text-ink-soft" dir="ltr">{n.ref}</span>
            <button type="button" onClick={() => setList(list.filter((_, j) => j !== i))} className="border-0 bg-transparent text-[color:var(--danger)] cursor-pointer text-[0.8rem]">{s.remove}</button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 items-end">
        <label className="flex-1"><span className={field}>{s.name}</span><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="xl-name-new" dir="auto" className="w-full" /></label>
        <label className="flex-1"><span className={field}>{s.refersTo}</span><Input value={ref} onChange={(e) => setRef(e.target.value)} data-testid="xl-name-ref" dir="ltr" className="w-full font-mono" /></label>
        <Button disabled={!name || bad || !ref} data-testid="xl-name-add" onClick={() => { setList([...list, { name, ref: ref.replace(/^=/, '') }]); setName('') }}>{s.add}</Button>
      </div>
      {bad && <p className="text-[0.8rem] text-[color:var(--danger)] mt-1">{s.emptyName}</p>}
      <SheetActions><Button variant="primary" data-testid="xl-names-save" onClick={() => { onSave(list); onClose() }}>{s.done}</Button></SheetActions>
    </Sheet>
  )
}

export function CondDialog({ s, rules, scales, onSave, onScale, onClear, onClose }: {
  s: XlStr; rules: CondRule[]; scales: number
  onSave: (r: CondRule) => void; onScale: (k: ScaleKind) => void; onClear: () => void; onClose: () => void
}) {
  const [op, setOp] = useState<CondRule['op']>('>')
  const [value, setValue] = useState('')
  const [bg, setBg] = useState('#f8d7da')
  return (
    <Sheet onClose={onClose} data-testid="xl-cond-dialog">
      <SheetTitle>{s.condFormat}</SheetTitle>
      <p className="text-[0.86rem] mb-2">{s.condWhen}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={op} onChange={(e) => setOp(e.target.value as CondRule['op'])} data-testid="xl-cond-op">
          <option value=">">{s.condGt}</option><option value="<">{s.condLt}</option><option value="=">{s.condEq}</option>
          <option value="contains">{s.condContains}</option><option value="eqText">{s.condText}</option>
        </Select>
        <Input value={value} onChange={(e) => setValue(e.target.value)} data-testid="xl-cond-value" className="w-[120px]" dir="auto" />
        <span className="text-[0.86rem]">{s.condColour}</span>
        <div className="flex gap-1">{SWATCHES.slice(14).map((c) => <button key={c} type="button" aria-label={c} onClick={() => setBg(c)} className="size-6 rounded-sm cursor-pointer" style={{ background: c, outline: bg === c ? '2px solid var(--ink)' : '1px solid var(--line)' }} />)}</div>
      </div>
      <Button className="mt-3" data-testid="xl-cond-add" disabled={!value.trim()} onClick={() => {
        const numeric = op === '>' || op === '<' || op === '='
        onSave({ op, value: numeric ? Number(value) : value, bg })
        setValue('')
      }}>{s.add}</Button>
      {rules.length > 0 && <p className="text-[0.8rem] text-ink-faint mt-2" data-testid="xl-cond-count">{rules.length} ✓</p>}
      <h4 className="text-[0.84rem] font-semibold mt-4 mb-2">{s.scales}</h4>
      <div className="flex flex-wrap gap-2">
        <Button data-testid="xl-scale3" onClick={() => { onScale('scale3'); onClose() }}>{s.scale3}</Button>
        <Button data-testid="xl-scale2" onClick={() => { onScale('scale2'); onClose() }}>{s.scale2}</Button>
        <Button data-testid="xl-databar" onClick={() => { onScale('databar'); onClose() }}>{s.dataBar}</Button>
      </div>
      <SheetActions>
        {(rules.length > 0 || scales > 0) && <Button data-testid="xl-cond-clear" onClick={() => { onClear(); onClose() }}>{s.clearRules}</Button>}
        <Button variant="primary" onClick={onClose} data-testid="xl-cond-done">{s.done}</Button>
      </SheetActions>
    </Sheet>
  )
}

const CODES = ['0', '0.00', '#,##0', '#,##0.00', '0%', '0.0%', '#,##0.00 "ر.س"', '"SAR" #,##0.00', 'yyyy-mm-dd', 'dd/mm/yyyy', 'd mmm yyyy', 'dddd', 'hh:mm', 'h:mm AM/PM', '0.00E+00', '# ?/?', '#,##0;[Red]-#,##0', '@']

export function FormatDialog({ s, code, sample, onSave, onClose }: { s: XlStr; code: string; sample: number | string; onSave: (c: string | null) => void; onClose: () => void }) {
  const [v, setV] = useState(code || '#,##0.00')
  const preview = useMemo(() => { try { return formatCode(typeof sample === 'number' ? sample : 1234.5, v) } catch { return '—' } }, [v, sample])
  return (
    <Sheet onClose={onClose} data-testid="xl-format-dialog">
      <SheetTitle>{s.customFmt.replace('…', '')}</SheetTitle>
      <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} data-testid="xl-format-code" dir="ltr" className="w-full font-mono" />
      <p className="mt-2 text-[0.9rem]">→ <b data-testid="xl-format-preview" dir="ltr">{preview}</b></p>
      <div className="flex flex-wrap gap-1.5 mt-3">{CODES.map((c) => <button key={c} type="button" onClick={() => setV(c)} className="px-2 py-1 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] font-mono text-[0.76rem] cursor-pointer" dir="ltr">{c}</button>)}</div>
      <SheetActions>
        <Button onClick={() => { onSave(null); onClose() }}>{s.general}</Button>
        <Button variant="primary" data-testid="xl-format-save" onClick={() => { onSave(v); onClose() }}>{s.ok}</Button>
      </SheetActions>
    </Sheet>
  )
}

export function SizeDialog({ s, label, value, onSave, onClose }: { s: XlStr; label: string; value: number; onSave: (n: number) => void; onClose: () => void }) {
  const [v, setV] = useState(String(value))
  return (
    <Sheet onClose={onClose} data-testid="xl-size-dialog">
      <SheetTitle>{label}</SheetTitle>
      <Input autoFocus type="number" min={4} max={1000} value={v} onChange={(e) => setV(e.target.value)} data-testid="xl-size-value" className="w-[140px]" />
      <SheetActions><Button variant="primary" data-testid="xl-size-save" disabled={!(+v >= 4)} onClick={() => { onSave(Math.min(1000, +v)); onClose() }}>{s.ok}</Button></SheetActions>
    </Sheet>
  )
}

const FN_GROUPS: Record<string, string[]> = {
  Math: ['SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'ABS', 'MOD', 'POWER', 'SQRT', 'INT', 'CEILING', 'FLOOR', 'PRODUCT'],
  Statistics: ['AVERAGE', 'AVERAGEIF', 'COUNT', 'COUNTA', 'COUNTIF', 'COUNTIFS', 'COUNTBLANK', 'MAX', 'MIN', 'MEDIAN', 'MODE', 'STDEV', 'LARGE', 'SMALL', 'RANK'],
  Logic: ['IF', 'IFS', 'AND', 'OR', 'NOT', 'IFERROR', 'SWITCH', 'XOR'],
  Lookup: ['VLOOKUP', 'HLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH', 'CHOOSE', 'LOOKUP'],
  Text: ['CONCAT', 'TEXTJOIN', 'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM', 'UPPER', 'LOWER', 'PROPER', 'SUBSTITUTE', 'FIND', 'SEARCH', 'TEXT', 'VALUE'],
  Date: ['TODAY', 'NOW', 'DATE', 'YEAR', 'MONTH', 'DAY', 'WEEKDAY', 'EDATE', 'EOMONTH', 'DATEDIF', 'NETWORKDAYS', 'WORKDAY'],
}

export function FunctionDialog({ s, onPick, onClose }: { s: XlStr; onPick: (name: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const all = useMemo(() => [...SUPPORTED_FUNCTIONS].sort(), [])
  const hits = q ? all.filter((f) => f.includes(q.toUpperCase())) : []
  return (
    <Sheet onClose={onClose} data-testid="xl-fn-picker">
      <SheetTitle>{s.func}</SheetTitle>
      <p className="text-[0.84rem] text-ink-soft mb-2">{s.insertFnHint}</p>
      <Input autoFocus placeholder={s.searchFns} value={q} onChange={(e) => setQ(e.target.value)} data-testid="xl-fn-search" dir="ltr" className="w-full mb-3" />
      {q ? (
        <div className="flex flex-wrap gap-1.5" data-testid="xl-fn-results">{hits.slice(0, 80).map((f) => <FnChip key={f} f={f} onPick={onPick} />)}</div>
      ) : Object.entries(FN_GROUPS).map(([g, list]) => (
        <div key={g} className="mb-3"><h4 className="text-[0.78rem] font-semibold text-ink-soft mb-1">{g}</h4>
          <div className="flex flex-wrap gap-1.5">{list.filter((f) => all.includes(f)).map((f) => <FnChip key={f} f={f} onPick={onPick} />)}</div>
        </div>
      ))}
    </Sheet>
  )
}
function FnChip({ f, onPick }: { f: string; onPick: (f: string) => void }) {
  return <button type="button" data-testid={`xl-fn-pick-${f}`} onClick={() => onPick(f)} className="px-2 py-1 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] font-mono text-[0.78rem] cursor-pointer hover:border-green-600" dir="ltr">{f}</button>
}

export function SplitDialog({ s, onSplit, onClose }: { s: XlStr; onSplit: (d: string) => void; onClose: () => void }) {
  const [d, setD] = useState(',')
  const [other, setOther] = useState('')
  const opts: [string, string][] = [[',', s.comma], [';', s.semicolon], ['\t', s.tab], [' ', s.space], ['other', s.other]]
  return (
    <Sheet onClose={onClose} data-testid="xl-split-dialog">
      <SheetTitle>{s.textToCols}</SheetTitle>
      <p className="text-[0.86rem] mb-2">{s.splitBy}</p>
      <div className="flex flex-wrap gap-3">{opts.map(([v, l]) => <label key={v} className="flex items-center gap-1 text-[0.88rem]"><input type="radio" name="d" checked={d === v} onChange={() => setD(v)} data-testid={`xl-split-${v === '\t' ? 'tab' : v === ' ' ? 'space' : v}`} />{l}</label>)}</div>
      {d === 'other' && <Input value={other} onChange={(e) => setOther(e.target.value)} className="mt-2 w-[80px]" data-testid="xl-split-other" />}
      <SheetActions><Button variant="primary" data-testid="xl-split-go" onClick={() => { onSplit(d === 'other' ? other : d); onClose() }}>{s.apply}</Button></SheetActions>
    </Sheet>
  )
}

export function RenameSheetDialog({ s, name, taken, onSave, onClose }: { s: XlStr; name: string; taken: string[]; onSave: (n: string) => void; onClose: () => void }) {
  const [v, setV] = useState(name)
  const clash = taken.some((t) => t.toLowerCase() === v.trim().toLowerCase() && t !== name)
  const bad = !v.trim() || v.length > 31 || /[[\]:*?/\\]/.test(v)
  return (
    <Sheet onClose={onClose} data-testid="xl-rename-sheet">
      <SheetTitle>{s.renameSheet}</SheetTitle>
      <form id="xl-rename-sheet-form" onSubmit={(e) => { e.preventDefault(); if (!bad && !clash) { onSave(v.trim()); onClose() } }}>
        <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} data-testid="xl-rename-sheet-input" dir="auto" className="w-full" maxLength={31} />
      </form>
      {clash && <p className="text-[0.8rem] text-[color:var(--danger)] mt-1">{s.sheetExists}</p>}
      <SheetActions><Button variant="primary" type="submit" form="xl-rename-sheet-form" disabled={bad || clash} data-testid="xl-rename-sheet-save">{s.ok}</Button></SheetActions>
    </Sheet>
  )
}

/** The drop-down on a filtered column: tick the values to keep, or sort. */
export function FilterMenu({ s, values, keep, x, y, onApply, onSort, onClose }: {
  s: XlStr; values: string[]; keep: string[]; x: number; y: number
  onApply: (keep: string[] | null) => void; onSort: (d: 'asc' | 'desc') => void; onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [on, setOn] = useState<Set<string>>(() => new Set(keep.length ? keep : values))
  const shown = values.filter((v) => v.toLowerCase().includes(q.toLowerCase()))
  const all = shown.every((v) => on.has(v))
  return (
    <div className="fixed inset-0 z-[85]" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div data-testid="xl-filter-menu" className="absolute w-[240px] rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)] p-2" style={{ top: Math.min(y, window.innerHeight - 380), left: Math.max(8, Math.min(x, window.innerWidth - 248)) }}>
        <button type="button" data-testid="xl-filter-sort-asc" onClick={() => { onSort('asc'); onClose() }} className="block w-full text-start px-2 py-1.5 text-[0.86rem] border-0 bg-transparent cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]">{s.sortAsc}</button>
        <button type="button" data-testid="xl-filter-sort-desc" onClick={() => { onSort('desc'); onClose() }} className="block w-full text-start px-2 py-1.5 text-[0.86rem] border-0 bg-transparent cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]">{s.sortDesc}</button>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.filterSearch} className="w-full my-2 text-[0.85rem]" dir="auto" data-testid="xl-filter-search" />
        <div className="max-h-[200px] overflow-auto">
          <label className="flex items-center gap-2 text-[0.85rem] py-0.5"><input type="checkbox" checked={all} onChange={() => { const n = new Set(on); for (const v of shown) all ? n.delete(v) : n.add(v); setOn(n) }} data-testid="xl-filter-all" />{s.selectAll}</label>
          {shown.map((v) => (
            <label key={v} className="flex items-center gap-2 text-[0.85rem] py-0.5"><input type="checkbox" checked={on.has(v)} data-testid="xl-filter-value" data-value={v} onChange={() => { const n = new Set(on); n.has(v) ? n.delete(v) : n.add(v); setOn(n) }} /><span dir="auto" className="truncate">{v === '' ? s.blanks : v}</span></label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button onClick={onClose} className="!py-1 !px-3 text-[0.82rem]">{s.cancel}</Button>
          <Button variant="primary" data-testid="xl-filter-apply" className="!py-1 !px-3 text-[0.82rem]" onClick={() => { onApply(on.size === values.length ? null : [...on]); onClose() }}>{s.ok}</Button>
        </div>
      </div>
    </div>
  )
}
