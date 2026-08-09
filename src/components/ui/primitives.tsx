import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react'

// Small structural primitives migrated off theme.css (.field/.check/.stack/.seg/
// .panel/.code-out/.pill--coming-soon/.pill--beta). All styling is inline Tailwind.

/** .field — a label + control stacked vertically. */
export function Field({ label, className = '', children, ...props }: { label?: ReactNode } & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`flex flex-col gap-[0.4rem]${className ? ` ${className}` : ''}`} {...props}>
      {label != null && <FieldLabel>{label}</FieldLabel>}
      {children}
    </label>
  )
}

/** .field__label */
export function FieldLabel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]${className ? ` ${className}` : ''}`}>{children}</span>
}

/** .check — a checkbox row label. */
export function Check({ className = '', children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`inline-flex items-center gap-[0.55rem] text-[0.9rem] font-medium text-ink-soft cursor-pointer [&_input]:size-[1.05rem] [&_input]:accent-green-600${className ? ` ${className}` : ''}`} {...props}>
      {children}
    </label>
  )
}

/** .stack — vertical flow. */
export function Stack({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex flex-col gap-[1.1rem]${className ? ` ${className}` : ''}`} {...props}>{children}</div>
}

/** .stack__actions — a horizontal wrap of buttons. */
export function StackActions({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex gap-[0.6rem] flex-wrap${className ? ` ${className}` : ''}`} {...props}>{children}</div>
}

/** .panel — a padded surface card. */
export function Panel({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-lg shadow-[var(--shadow-sm)] p-[1.3rem] grid gap-[1.1rem]${className ? ` ${className}` : ''}`} {...props}>{children}</div>
}

/** .code-out — monospace output. */
export function CodeOut({ className = '', children, ...props }: HTMLAttributes<HTMLElement>) {
  return <code className={`font-mono text-[0.9rem]${className ? ` ${className}` : ''}`} {...props}>{children}</code>
}

// .seg — segmented control. Container + button; is-active → filled green.
export function Seg({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`inline-flex border border-[color:var(--line)] rounded-sm overflow-hidden w-fit${className ? ` ${className}` : ''}`} {...props}>{children}</div>
}

export function SegButton({ active = false, className = '', children, ...props }: { active?: boolean } & HTMLAttributes<HTMLButtonElement>) {
  const state = active ? 'bg-green-600 text-sand-100' : 'bg-[var(--surface)] text-ink-soft'
  return (
    // `aria-pressed` because colour was the ONLY thing saying which segment is
    // selected: a screen reader could not tell, on every segmented control on
    // the site. Before the spread, so a caller can still override it.
    <button aria-pressed={active} className={`px-[0.85rem] py-[0.4rem] font-body font-semibold text-[0.85rem] border-r border-[color:var(--line)] last:border-r-0 ${state}${className ? ` ${className}` : ''}`} {...props}>
      {children}
    </button>
  )
}

/** Card status badge — was .pill.pill--coming-soon / .pill.pill--beta. */
export function StatusBadge({ status, children }: { status: 'coming-soon' | 'beta'; children: ReactNode }) {
  const tone = status === 'coming-soon'
    ? 'bg-[color-mix(in_srgb,var(--color-gold-400)_22%,transparent)] text-gold-500'
    : 'bg-[color-mix(in_srgb,var(--color-green-400)_20%,transparent)] text-green-600'
  return <span className={`font-mono text-[0.66rem] font-semibold tracking-[0.06em] uppercase px-[0.5rem] py-[0.2rem] rounded-full ${tone}`}>{children}</span>
}
