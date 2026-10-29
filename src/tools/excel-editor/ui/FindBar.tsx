// Find and replace, docked under the ribbon rather than floating over the cells
// it is finding.
import { useEffect, useRef, useState } from 'react'
import type { XlStr } from '../strings'
import type { FindOpts } from '../actions'

export function FindBar({ s, replace: replace0, count, index, onSearch, onStep, onReplace, onReplaceAll, onClose, readOnly, message }: {
  s: XlStr; replace: boolean; count: number; index: number; readOnly?: boolean; message?: string
  onSearch: (q: string, o: FindOpts) => void; onStep: (d: 1 | -1) => void
  onReplace: (w: string) => void; onReplaceAll: (w: string) => void; onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [w, setW] = useState('')
  const [rep, setRep] = useState(replace0)
  const [o, setO] = useState<FindOpts>({})
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  useEffect(() => setRep(replace0), [replace0])
  useEffect(() => { onSearch(q, o) }, [q, o]) // eslint-disable-line react-hooks/exhaustive-deps
  const box = 'h-8 px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-[0.86rem]'
  const btn = 'h-8 px-2.5 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-[0.82rem] cursor-pointer disabled:opacity-40'
  return (
    <div data-testid="xl-findbar" className="flex-none flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-[color:var(--line-soft)] bg-[color-mix(in_srgb,var(--color-gold-400)_10%,var(--surface))]"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && (e.target as HTMLElement).dataset.testid === 'xl-find-input') { e.preventDefault(); onStep(e.shiftKey ? -1 : 1) } }}>
      <input ref={ref} data-testid="xl-find-input" placeholder={s.findPh} value={q} onChange={(e) => setQ(e.target.value)} className={`${box} w-[180px]`} dir="auto" />
      <span className="text-[0.8rem] text-ink-soft min-w-[60px]" data-testid="xl-find-count">{q ? (count ? s.nOfM(index + 1, count) : s.noMatch) : ''}</span>
      <button type="button" className={btn} disabled={!count} onClick={() => onStep(-1)} aria-label="Previous" data-testid="xl-find-prev">↑</button>
      <button type="button" className={btn} disabled={!count} onClick={() => onStep(1)} aria-label="Next" data-testid="xl-find-next">↓</button>
      <label className="flex items-center gap-1 text-[0.8rem]"><input type="checkbox" checked={!!o.matchCase} onChange={(e) => setO({ ...o, matchCase: e.target.checked })} data-testid="xl-find-case" />{s.matchCase}</label>
      <label className="flex items-center gap-1 text-[0.8rem]"><input type="checkbox" checked={!!o.whole} onChange={(e) => setO({ ...o, whole: e.target.checked })} data-testid="xl-find-whole" />{s.wholeCell}</label>
      <label className="flex items-center gap-1 text-[0.8rem]"><input type="checkbox" checked={!!o.allSheets} onChange={(e) => setO({ ...o, allSheets: e.target.checked })} data-testid="xl-find-all-sheets" />{s.allSheets}</label>
      {!readOnly && <button type="button" className={btn} onClick={() => setRep((r) => !r)} data-testid="xl-find-toggle-replace">{s.replace}</button>}
      {rep && !readOnly && (
        <>
          <input data-testid="xl-replace-input" placeholder={s.replacePh} value={w} onChange={(e) => setW(e.target.value)} className={`${box} w-[160px]`} dir="auto" />
          <button type="button" className={btn} disabled={!count} onClick={() => onReplace(w)} data-testid="xl-replace-one">{s.replaceOne}</button>
          <button type="button" className={btn} disabled={!count} onClick={() => onReplaceAll(w)} data-testid="xl-replace-all">{s.replaceAll}</button>
        </>
      )}
      {message && <span className="text-[0.8rem] text-green-700" data-testid="xl-find-message">{message}</span>}
      <div className="flex-1" />
      <button type="button" className={btn} onClick={onClose} aria-label="Close" data-testid="xl-find-close">✕</button>
    </div>
  )
}
