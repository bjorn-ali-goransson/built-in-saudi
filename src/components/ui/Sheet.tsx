import { createPortal } from 'react-dom'
import type { HTMLAttributes, ReactNode } from 'react'

// Was .sheet-overlay / .sheet / .sheet__grip. A bottom-sheet dialog, portaled to
// <body>. Uses the `fadeUp`/`sheetUp` keyframes that live in theme.css.
export function Sheet({ onClose, className = '', children, ...props }: { onClose?: () => void } & HTMLAttributes<HTMLDivElement>) {
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] animate-[fadeUp_0.15s_ease_both]"
      role="dialog" aria-modal="true" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} {...props}
        className={`w-full max-w-[520px] bg-[var(--surface)] rounded-t-2xl shadow-[0_-10px_40px_rgba(18,33,27,0.25)] px-[1.1rem] pt-[0.6rem] pb-[calc(1.1rem+env(safe-area-inset-bottom,0px))] max-h-[82vh] flex flex-col animate-[sheetUp_0.24s_cubic-bezier(0.2,0.8,0.2,1)_both]${className ? ` ${className}` : ''}`}>
        <span aria-hidden="true" className="block w-[38px] h-1 rounded-full bg-[var(--line)] mx-auto mt-[0.3rem] mb-[0.7rem]" />
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** .sheet__title */
export function SheetTitle({ children }: { children: ReactNode }) {
  return <h3 className="font-display text-[1.25rem] font-semibold mb-[0.9rem] rtl:font-ar">{children}</h3>
}

/** .sheet__actions — full-width row of buttons that each stretch. */
export function SheetActions({ children }: { children: ReactNode }) {
  return <div className="flex gap-[0.6rem] pt-[0.9rem] mt-[0.4rem] border-t border-[color:var(--line-soft)] [&>*]:flex-1">{children}</div>
}
