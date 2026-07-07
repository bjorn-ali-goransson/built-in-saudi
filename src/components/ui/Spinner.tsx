/** A small, reusable loading spinner (a spinning ring in the brand green). */
export function Spinner({ className = '', label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block size-6 rounded-full border-[2.5px] border-[color:var(--line)] border-t-green-600 animate-[spin_0.7s_linear_infinite] ${className}`}
    />
  )
}
