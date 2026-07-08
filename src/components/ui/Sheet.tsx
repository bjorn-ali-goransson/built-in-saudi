import { createPortal } from 'react-dom'
import { Children, isValidElement, useEffect, type ReactElement, type ReactNode, type HTMLAttributes } from 'react'

// A single modal dialog used across the app. Desktop: a centred card (max 520px,
// max 85dvh). Mobile (≤560px): a full-screen dialog. Always has a title header
// with an ✕; the body is the ONLY scroll region (flex-1 + min-h-0 so it can
// actually shrink — the usual "scroll breaks" pitfall); the footer (SheetActions)
// is pinned. Esc + click-outside close it, and background scroll is locked.
// Portaled to <body> so ancestor transforms/overflow can't clip or mis-place it.
//
// Usage is unchanged: <Sheet onClose><SheetTitle>…</SheetTitle> …body…
// <SheetActions>…</SheetActions></Sheet>. SheetTitle/SheetActions are markers the
// Sheet lifts into the header/footer; everything else becomes the scrolling body.

type El = ReactElement<{ children?: ReactNode }>

export function SheetTitle({ children }: { children: ReactNode }) { return <>{children}</> }
export function SheetActions({ children }: { children: ReactNode }) { return <>{children}</> }

export function Sheet({ onClose, className = '', children, ...rest }: { onClose?: () => void } & HTMLAttributes<HTMLDivElement>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const arr = Children.toArray(children)
  const titleEl = arr.find((c): c is El => isValidElement(c) && c.type === SheetTitle)
  const actionsEl = arr.find((c): c is El => isValidElement(c) && c.type === SheetActions)
  const body = arr.filter((c) => c !== titleEl && c !== actionsEl)

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 max-[560px]:p-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] animate-[fadeUp_0.15s_ease_both]"
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        {...rest}
        className={`flex flex-col w-full max-w-[520px] max-h-[85dvh] rounded-lg overflow-hidden bg-[var(--surface)] shadow-[0_10px_40px_rgba(18,33,27,0.25)] animate-[fadeUp_0.2s_ease_both] max-[560px]:max-w-none max-[560px]:h-full max-[560px]:max-h-none max-[560px]:rounded-none${className ? ` ${className}` : ''}`}
      >
        <div className="flex-none flex items-center justify-between gap-3 ps-[1.1rem] pe-2 py-2.5 border-b border-[color:var(--line-soft)]">
          <h3 className="font-display rtl:font-ar text-[1.2rem] font-semibold text-ink truncate">{titleEl?.props.children}</h3>
          <button
            type="button" aria-label="Close" data-testid="sheet-close" onClick={onClose}
            className="flex-none grid place-items-center size-9 rounded-md text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] border-0 bg-transparent cursor-pointer text-[1.05rem] leading-none"
          >✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-[1.1rem] py-[1rem] flex flex-col gap-3">
          {body}
        </div>

        {actionsEl && (
          <div className="flex-none flex gap-2 px-[1.1rem] py-2.5 border-t border-[color:var(--line-soft)] pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] [&>*]:flex-1">
            {actionsEl.props.children}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
