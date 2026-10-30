// The ribbon all three editors build from, so Excel, Word and PowerPoint look
// like one suite. Tabs mean something: Home is what you reach for while typing,
// Insert is what you add, and a contextual tab appears only when its object is
// selected.
//
// Every control carries a CAPTION under its icon. A phone has no hover, so a
// ribbon of bare glyphs was a ribbon of guesses there; the full label (with its
// shortcut) stays the accessible name and the desktop tooltip.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface RibbonTab { id: string; label: string; contextual?: boolean }

export function Ribbon({ tabs, active, onTab, children, end }: { tabs: RibbonTab[]; active: string; onTab: (id: string) => void; children: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex-none border-b border-[color:var(--line-soft)] bg-[var(--surface)]" data-testid="ribbon" data-ribbon="">
      <div role="tablist" className="flex items-end gap-0.5 px-2 pt-1 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => onTab(t.id)}
            className={`flex-none px-3 py-1.5 text-[0.85rem] rounded-t-md border-0 cursor-pointer ${
              active === t.id
                ? 'bg-[color-mix(in_srgb,var(--color-green-600)_10%,transparent)] text-green-700 font-semibold'
                : t.contextual ? 'bg-transparent text-gold-500 hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]' : 'bg-transparent text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]'
            }`}
          >{t.label}</button>
        ))}
        <div className="flex-1" />
        {end}
      </div>
      <div role="tabpanel" className="flex items-stretch gap-1 px-2 py-1 overflow-x-auto [scrollbar-width:thin] min-h-[58px]">{children}</div>
    </div>
  )
}

export function RGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex-none flex flex-col items-center gap-0.5 pe-2 me-1 border-e border-[color:var(--line-soft)] last:border-e-0" role="group" aria-label={label}>
      <div className="flex items-center gap-0.5">{children}</div>
      <span className="text-[0.6rem] uppercase tracking-[0.04em] text-ink-faint leading-none mt-0.5 max-[640px]:hidden">{label}</span>
    </div>
  )
}

/** "Bold (Ctrl+B)" → "Bold": the shortcut belongs in the tooltip, not under the icon. */
export const caption = (label: string) => label.replace(/\s*\([^)]*\)\s*$/, '')

/** The caption under a control. Truncated, never wrapped: the ribbon is one row tall. */
export function Cap({ children }: { children: ReactNode }) {
  return <span aria-hidden className="block max-w-[76px] truncate text-[0.64rem] leading-[1.1] text-ink-soft font-normal">{children}</span>
}

export function rbtn(active?: boolean): string {
  return `inline-flex flex-col items-center justify-center gap-0.5 min-w-10 min-h-11 px-1.5 py-0.5 rounded-sm border-0 cursor-pointer text-[0.85rem] whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
    active ? 'bg-[color-mix(in_srgb,var(--color-green-600)_16%,transparent)] text-green-700' : 'bg-transparent text-ink hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]'
  }`
}

export function RBtn({ label, short, icon, active, onClick, testid, disabled, wide, children }: { label: string; short?: string; icon?: ReactNode; active?: boolean; onClick?: () => void; testid?: string; disabled?: boolean; wide?: boolean; children?: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      data-testid={testid}
      disabled={disabled}
      // Keep the document's selection: a ribbon click must not steal focus from the text.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={rbtn(active) + (wide ? ' px-2' : '')}
    >
      <span className="flex h-[18px] items-center [&_svg]:size-[17px]">{icon ?? children ?? null}</span>
      {(short ?? caption(label)) && <Cap>{short ?? caption(label)}</Cap>}
    </button>
  )
}

export function RSelect({ label, short, value, options, onChange, testid, width = 110 }: { label: string; short?: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void; testid?: string; width?: number }) {
  return (
    <span className="inline-flex flex-col items-center justify-center gap-0.5 min-h-11">
    <select
      aria-label={label}
      title={label}
      data-testid={testid}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width }}
      className="h-7 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink text-[0.82rem] px-1"
    >
      {!options.some((o) => o.v === value) && <option value={value}>{value}</option>}
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
    <Cap>{short ?? caption(label)}</Cap>
    </span>
  )
}

export const SWATCHES = ['#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff', '#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#0b6e4f', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc']

/** A colour button with a swatch strip under its glyph and a palette popover. */
export function RColor({ label, short, value, onPick, glyph, testid, allowNone }: { label: string; short?: string; value?: string; onPick: (c: string | null) => void; glyph: ReactNode; testid: string; allowNone?: boolean }) {
  return (
    <RPopover label={label} short={short} testid={testid} trigger={<span className="flex flex-col items-center leading-none">{glyph}<span className="block w-4 h-[3px] mt-0.5 rounded-sm" style={{ background: value || 'transparent', outline: value ? undefined : '1px solid var(--line)' }} /></span>}>
      {(close) => (
        <div className="p-2 w-[208px]">
          <div className="grid grid-cols-6 gap-1">
            {SWATCHES.map((c) => (
              <button key={c} type="button" aria-label={c} data-testid={`${testid}-${c.slice(1)}`} onClick={() => { onPick(c); close() }} className="size-7 rounded-sm border border-[color:var(--line)] cursor-pointer" style={{ background: c }} />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="color" aria-label={label} defaultValue={value || '#000000'} onChange={(e) => onPick(e.target.value)} className="h-7 w-10 border-0 bg-transparent p-0 cursor-pointer" />
            {allowNone && <button type="button" onClick={() => { onPick(null); close() }} className="text-[0.8rem] border-0 bg-transparent text-ink-soft underline cursor-pointer" data-testid={`${testid}-none`}>∅</button>}
          </div>
        </div>
      )}
    </RPopover>
  )
}

/** A ribbon button that opens a panel. Portaled so a scrolling ribbon cannot clip it. */
export function RPopover({ label, short, trigger, testid, children, wide }: { label: string; short?: string; trigger: ReactNode; testid: string; children: (close: () => void) => ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey) }
  }, [open])
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect()
    if (r) {
      const w = wide ? 320 : 224
      const rtl = getComputedStyle(btn.current!).direction === 'rtl'
      setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(rtl ? r.right - w : r.left, window.innerWidth - w - 8)) })
    }
    setOpen((o) => !o)
  }
  return (
    <>
      <button ref={btn} type="button" title={label} aria-label={label} aria-haspopup="dialog" aria-expanded={open} data-testid={testid} onMouseDown={(e) => e.preventDefault()} onClick={toggle} className={rbtn(open)}>
        <span className="flex h-[18px] items-center gap-1 [&_svg]:size-[17px]">{trigger}</span>
        {(short ?? caption(label)) && <Cap>{short ?? caption(label)}</Cap>}
      </button>
      {open && createPortal(
        <div ref={panel} data-ribbon="" data-testid={`${testid}-panel`} style={{ top: pos.top, left: pos.left }} className="fixed z-[90] max-h-[70dvh] overflow-auto rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[0_10px_30px_rgba(18,33,27,0.18)]">
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </>
  )
}

/** A menu item inside an RPopover. */
export function RItem({ children, onClick, testid, danger, disabled, hint }: { children: ReactNode; onClick: () => void; testid?: string; danger?: boolean; disabled?: boolean; hint?: string }) {
  return (
    <button type="button" data-testid={testid} disabled={disabled} onClick={onClick} className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-[0.88rem] border-0 bg-transparent cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] disabled:opacity-40 ${danger ? 'text-[color:var(--danger)]' : 'text-ink'}`}>
      <span>{children}</span>{hint && <kbd className="text-[0.72rem] text-ink-faint font-sans">{hint}</kbd>}
    </button>
  )
}
