// The word processor's small dialogs and its find bar.
import { useEffect, useRef, useState } from 'react'
import { Sheet, SheetTitle, SheetActions, Button, Input, Textarea } from '../../../components/ui'
import { CloseIcon } from '../../../components/icons'
import type { WdStr } from '../strings'

const field = 'block text-[0.8rem] text-ink-soft mb-1'

export function LinkDialog({ s, url: url0, text: text0, onSave, onRemove, onClose }: { s: WdStr; url: string; text: string; onSave: (url: string, text: string) => void; onRemove?: () => void; onClose: () => void }) {
  const [url, setUrl] = useState(url0)
  const [text, setText] = useState(text0)
  const u = url.trim()
  const ok = /^(https?:\/\/|mailto:|tel:|#)/i.test(u) || /^[\w.-]+\.[a-z]{2,}/i.test(u)
  const save = () => { if (!ok) return; onSave(/^[a-z]+:|^#/i.test(u) ? u : 'https://' + u, text); onClose() }
  return (
    <Sheet onClose={onClose} data-testid="wd-link-dialog">
      <SheetTitle>{s.link}</SheetTitle>
      <label className="block mb-3"><span className={field}>{s.linkUrl}</span><Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save() }} data-testid="wd-link-url" dir="ltr" className="w-full" /></label>
      <label className="block"><span className={field}>{s.linkText}</span><Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save() }} data-testid="wd-link-text" dir="auto" className="w-full" /></label>
      <SheetActions>
        {onRemove && <Button onClick={() => { onRemove(); onClose() }} data-testid="wd-link-remove">{s.removeLink}</Button>}
        <Button onClick={onClose}>{s.cancel}</Button>
        <Button variant="primary" disabled={!ok} data-testid="wd-link-save" onClick={save}>{s.ok}</Button>
      </SheetActions>
    </Sheet>
  )
}

export function FootnoteDialog({ s, text: t0, onSave, onClose }: { s: WdStr; text: string; onSave: (t: string) => void; onClose: () => void }) {
  const [t, setT] = useState(t0)
  return (
    <Sheet onClose={onClose} data-testid="wd-footnote-dialog">
      <SheetTitle>{s.footnote}</SheetTitle>
      <label className="block"><span className={field}>{s.footnoteText}</span><Textarea autoFocus rows={3} value={t} onChange={(e) => setT(e.target.value)} data-testid="wd-footnote-text" dir="auto" className="w-full" /></label>
      <SheetActions>
        <Button onClick={onClose}>{s.cancel}</Button>
        <Button variant="primary" disabled={!t.trim()} data-testid="wd-footnote-save" onClick={() => { onSave(t.trim()); onClose() }}>{s.ok}</Button>
      </SheetActions>
    </Sheet>
  )
}

export interface FindState { q: string; r: string; matchCase: boolean; whole: boolean }

export function FindBar({ s, replace, count, index, readOnly, message, onSearch, onStep, onReplace, onReplaceAll, onClose }: {
  s: WdStr; replace: boolean; count: number; index: number; readOnly: boolean; message?: string
  onSearch: (f: FindState) => void; onStep: (d: 1 | -1) => void; onReplace: (with_: string) => void; onReplaceAll: (with_: string) => void; onClose: () => void
}) {
  const [f, setF] = useState<FindState>({ q: '', r: '', matchCase: false, whole: false })
  const [showReplace, setShowReplace] = useState(replace)
  const box = useRef<HTMLInputElement>(null)
  useEffect(() => { setShowReplace((x) => x || replace); box.current?.focus(); box.current?.select() }, [replace])
  const set = (p: Partial<FindState>) => { const n = { ...f, ...p }; setF(n); onSearch(n) }
  const btn = 'h-8 px-2.5 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink text-[0.82rem] cursor-pointer disabled:opacity-40'
  return (
    <div className="flex-none flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-[color:var(--line-soft)] bg-[var(--surface)]" data-testid="wd-findbar" role="search">
      <input ref={box} dir="auto" value={f.q} placeholder={s.findPh} aria-label={s.findPh} data-testid="wd-find-input" className="w-[220px] h-8 px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink text-[0.86rem] focus:outline-none focus:border-green-500"
        onChange={(e) => set({ q: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onStep(e.shiftKey ? -1 : 1) } if (e.key === 'Escape') onClose() }} />
      <span className="text-[0.8rem] text-ink-faint min-w-[70px]" data-testid="wd-find-count">{message || (f.q ? (count ? s.nOfM(index + 1, count) : s.noMatch) : '')}</span>
      <button type="button" className={btn} aria-label="Previous" data-testid="wd-find-prev" disabled={!count} onClick={() => onStep(-1)}>↑</button>
      <button type="button" className={btn} aria-label="Next" data-testid="wd-find-next" disabled={!count} onClick={() => onStep(1)}>↓</button>
      <label className="inline-flex items-center gap-1 text-[0.8rem]"><input type="checkbox" checked={f.matchCase} onChange={(e) => set({ matchCase: e.target.checked })} data-testid="wd-find-case" />{s.matchCase}</label>
      <label className="inline-flex items-center gap-1 text-[0.8rem]"><input type="checkbox" checked={f.whole} onChange={(e) => set({ whole: e.target.checked })} data-testid="wd-find-whole" />{s.wholeWord}</label>
      {!showReplace && !readOnly && <button type="button" className={btn} data-testid="wd-find-show-replace" onClick={() => setShowReplace(true)}>{s.replace}</button>}
      {showReplace && !readOnly && (
        <>
          <input dir="auto" value={f.r} placeholder={s.replacePh} aria-label={s.replacePh} data-testid="wd-replace-input" className="w-[200px] h-8 px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink text-[0.86rem] focus:outline-none focus:border-green-500" onChange={(e) => setF({ ...f, r: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onReplace(f.r) } if (e.key === 'Escape') onClose() }} />
          <button type="button" className={btn} data-testid="wd-replace-one" disabled={!count} onClick={() => onReplace(f.r)}>{s.replaceOne}</button>
          <button type="button" className={btn} data-testid="wd-replace-all" disabled={!count} onClick={() => onReplaceAll(f.r)}>{s.replaceAll}</button>
        </>
      )}
      <div className="flex-1" />
      <button type="button" aria-label={s.close} data-testid="wd-find-close" onClick={onClose} className="grid place-items-center size-8 rounded-sm border-0 bg-transparent cursor-pointer [&_svg]:size-4"><CloseIcon /></button>
    </div>
  )
}
