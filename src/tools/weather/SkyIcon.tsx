import type { Sky } from './codes'

// One icon component switching on the WMO sky class, rather than eight exports
// in the shared icons file that only this tool would ever use.
export function SkyIcon({ sky, day = true, className }: { sky: Sky; day?: boolean; className?: string }) {
  const base = {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
  } as const
  return (
    <svg {...base} className={className} aria-hidden="true">
      {sky === 'clear' && (day
        ? <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></>
        : <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />)}
      {sky !== 'clear' && <path d="M7 18h9.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.2A3.9 3.9 0 0 0 7 18Z" />}
      {sky === 'fog' && <path d="M4 21h9M8 17.5h11" />}
      {sky === 'drizzle' && <path d="M9 21v1M13 20.5v1.5M17 21v1" />}
      {sky === 'rain' && <path d="M9 20l-1 2.5M13 20l-1 2.5M17 20l-1 2.5" />}
      {sky === 'snow' && <path d="M9 21h.01M13 21.5h.01M17 21h.01M11 22.5h.01M15 22.5h.01" />}
      {sky === 'storm' && <path d="M13 19l-2.5 3.5h3L11 25" />}
    </svg>
  )
}
