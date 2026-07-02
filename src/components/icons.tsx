import type { ToolIconProps } from '../tools/types'

/**
 * Lightweight stroke icons drawn inline — no icon dependency.
 * All share a 24x24 grid and inherit `currentColor`.
 */

type P = ToolIconProps

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function QrIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3M21 14v.01M14 21h.01M21 21v-4M17 21h1" />
    </svg>
  )
}

export function KeyIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3 21 2M17 6l3 3M14 9l2.5 2.5" />
    </svg>
  )
}

export function ImageIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.8" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  )
}

export function PaletteIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2s-.6-2-.6-2.7c0-.8.6-1.3 1.4-1.3H17a4 4 0 0 0 4-4c0-3.9-4-8-9-8Z" />
      <circle cx="7.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function RulerIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2" y="7" width="20" height="10" rx="1.5" transform="rotate(0 12 12)" />
      <path d="M7 7v3M11 7v4M15 7v3M19 7v4" />
    </svg>
  )
}

export function BracesIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M8 3c-2 0-2 1.5-2 3s0 3-2 3c2 0 2 1.5 2 3s0 3 2 3" />
      <path d="M16 3c2 0 2 1.5 2 3s0 3 2 3c-2 0-2 1.5-2 3s0 3-2 3" />
    </svg>
  )
}

export function HashIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9 3 7 21M17 3l-2 18M4 8.5h16M3 15.5h16" />
    </svg>
  )
}

export function TextIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 6V5h16v1M12 5v14M9 19h6" />
    </svg>
  )
}

export function LinkIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </svg>
  )
}

export function WifiIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" />
      <circle cx="12" cy="19" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function MailIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  )
}

export function PhoneIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 3h3l1.5 5-2 1.5a12 12 0 0 0 5 5l1.5-2 5 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3Z" />
    </svg>
  )
}

export function DownloadIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
    </svg>
  )
}

export function CopyIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  )
}

export function ArrowIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  )
}

export function ShieldIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function BoltIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />
    </svg>
  )
}

export function BellIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  )
}

export function MoonIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
      <path d="M18 3.5 18.6 5l1.5.6-1.5.6L18 7.7l-.6-1.5L15.9 5.6 17.4 5Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SearchIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function CodeIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="m8 6-5 6 5 6M16 6l5 6-5 6M13 4l-2 16" />
    </svg>
  )
}
