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

export function CalendarIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
      <path d="M7.5 13h3M13.5 13h3M7.5 16.5h3" />
    </svg>
  )
}

export function CvIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 3h7l5 5v13a0 0 0 0 1 0 0H6a0 0 0 0 1 0 0V3Z" />
      <path d="M13 3v5h5" />
      <path d="M8.5 12.5h4M8.5 15.5h7M8.5 18.5h5" />
      <path d="M16.5 4.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3Z" />
    </svg>
  )
}

export function CalendarCheckIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
      <path d="M8.5 14.5l2.5 2.5 4.5-4.5" />
    </svg>
  )
}

export function GridIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      {[5, 12, 19].flatMap((cy) => [5, 12, 19].map((cx) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="currentColor" stroke="none" />
      )))}
    </svg>
  )
}

export function ReceiptIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5 3.5v17l2-1.3 2 1.3 2-1.3 2 1.3 2-1.3 2 1.3v-17z" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </svg>
  )
}

export function FileIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" /><path d="M14 2.5V7.5h5" />
    </svg>
  )
}

export function CardIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19M6 15h4" />
    </svg>
  )
}

export function PercentIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M19 5L5 19" /><circle cx="7.5" cy="7.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" />
    </svg>
  )
}

export function UploadIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      <path d="M12 4v11" /><path d="M8 8l4-4 4 4" />
    </svg>
  )
}

export function SunHorizonIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 18h18" /><path d="M6.5 18a5.5 5.5 0 0 1 11 0" />
      <path d="M12 5v2M5 9l1.4 1.4M19 9l-1.4 1.4M2.5 14h1.5M20 14h1.5" />
    </svg>
  )
}

export function CompassStarIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5l1.6 3.2 3.4.4-2.5 2.3.7 3.4-3.2-1.7-3.2 1.7.7-3.4-2.5-2.3 3.4-.4z" />
    </svg>
  )
}

export function ParagraphIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" />
    </svg>
  )
}

export function GlobeIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
    </svg>
  )
}

export function InfoIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5" /><path d="M12 8h.01" />
    </svg>
  )
}

export function ArchiveIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  )
}

export function CompassIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88z" fill="currentColor" stroke="none" opacity="0.85" />
    </svg>
  )
}

export function RefreshIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function CogIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

export function MosqueIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3c2 1.6 3 3 3 4.5H9C9 6 10 4.6 12 3z" /><path d="M6 21V10h12v11" />
      <path d="M10.5 21v-3a1.5 1.5 0 0 1 3 0v3" /><path d="M4 21h16M5 21V9M19 21V9" />
    </svg>
  )
}

export function FeatherIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M20.2 12.2a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><path d="M16 8 2 22M17.5 15H9" />
    </svg>
  )
}

export function TallyIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 5v14M10 5v14M14 5v14M18 5v14M3.5 17.5 20 11" />
    </svg>
  )
}

export function CropIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  )
}

export function PhotoDocIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="9" cy="9" r="1.4" />
      <path d="M4 16.5 8.5 13l3 2 4-3.5L20 16" />
    </svg>
  )
}

export function MergeIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7 4v3a5 5 0 0 0 5 5 5 5 0 0 0 5-5V4" /><path d="M12 12v8" /><path d="m8 16 4 4 4-4" />
    </svg>
  )
}

export function ScissorsIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
    </svg>
  )
}

export function ShareIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" />
    </svg>
  )
}

export function ExpandIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  )
}
