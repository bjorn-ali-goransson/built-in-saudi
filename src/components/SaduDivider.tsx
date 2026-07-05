/**
 * A Sadu-weave triangle strip — the recurring Najdi motif used as a section
 * divider. Pure SVG, tiles horizontally, inherits color via currentColor.
 */
export function SaduDivider({ className }: { className?: string }) {
  return (
    <div className={`leading-[0] overflow-hidden ${className ?? 'text-green-500 opacity-[0.55]'}`} aria-hidden="true">
      <svg width="100%" height="16" viewBox="0 0 120 16" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="sadu-tri" width="24" height="16" patternUnits="userSpaceOnUse">
            <path d="M12 1 L23 15 L1 15 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M12 6 L17.5 15 L6.5 15 Z" fill="currentColor" opacity="0.28" />
          </pattern>
        </defs>
        <rect width="120" height="16" fill="url(#sadu-tri)" />
      </svg>
    </div>
  )
}
