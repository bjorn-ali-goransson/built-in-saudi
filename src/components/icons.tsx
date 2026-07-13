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

export function MicIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
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

// Calendar with a crescent-moon badge in the bottom-left, on a bg-filled disc.
export function IslamicCalendarIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
      <circle cx="7.8" cy="16" r="5" fill="var(--bg)" />
      <circle cx="7.8" cy="16" r="5" />
      <path d="M9.2 13.1a3.1 3.1 0 1 0 0 5.8 3.9 3.9 0 0 1 0-5.8Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ExternalLinkIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M14 5h5v5M19 5l-8 8M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5" />
    </svg>
  )
}

export function EditIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function ClockIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function GripIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true" fill="currentColor" stroke="none">
      <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
    </svg>
  )
}

export function BookmarkIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

export function CloudIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7 18a4 4 0 0 1-.5-7.97 5.5 5.5 0 0 1 10.6-1.06A4.5 4.5 0 0 1 17 18H7Z" />
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

export function SignatureIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 17c2.5 0 3-9 4.5-9S9 15 10.5 15 12 9 13.5 9 15 13 16.5 13c1 0 1.6-1 2.5-2" />
      <path d="M3 21h18" />
    </svg>
  )
}

export function RadarIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z" />
      <path d="M12 8l3.7 2.2v4.6L12 17l-3.7-2.2v-4.6z" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function VideoCallIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
    </svg>
  )
}

export function CompressIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 3v6M9 6l3 3 3-3" />
      <path d="M12 21v-6M9 18l3-3 3 3" />
    </svg>
  )
}

export function TrashIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 7h16M9 7V5.2a1.2 1.2 0 0 1 1.2-1.2h3.6A1.2 1.2 0 0 1 15 5.2V7M6.5 7l.8 12.1a1.2 1.2 0 0 0 1.2 1.1h7a1.2 1.2 0 0 0 1.2-1.1L18 7M10 11v6M14 11v6" />
    </svg>
  )
}

export function FormIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

export function RegexIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 4v8M8.5 6l7 4M15.5 6l-7 4" />
      <rect x="4" y="15" width="4" height="4" rx="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TokenIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3v18M7 6l10 12M17 6 7 18" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function DiffIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 3v6M3 6h6M15 18h6" />
      <path d="M4.5 15.5 9 20l10.5-10.5" />
    </svg>
  )
}

export function EpochIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function BinaryIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="3" width="6" height="8" rx="1" />
      <rect x="14" y="13" width="6" height="8" rx="1" />
      <path d="M6 21h4M6 17v4M16 3v8M14 11h4" />
    </svg>
  )
}

export function TableIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
    </svg>
  )
}

export function ListIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  )
}

export function ContrastIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CalcIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8M8 11h.01M12 11h.01M16 11v6M8 15h.01M12 15h.01M8 18h4" />
    </svg>
  )
}

export function SplitIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3v18M7 8 3 12l4 4M17 8l4 4-4 4" />
    </svg>
  )
}

export function AspectIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10v4M17 10v4M9 12h6" />
    </svg>
  )
}

export function TimerIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9 2h6" />
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V9M18 6l1.5-1.5" />
    </svg>
  )
}

export function BriefcaseIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18M12 12v2" />
    </svg>
  )
}

export function CoinsIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.4-1.9-2.6-4.5-2.9" />
    </svg>
  )
}

export function CakeIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 20h16M5 20v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M4 15c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0" />
      <path d="M12 8V5M9 8V6M15 8V6" />
    </svg>
  )
}

export function CurveIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 21C3 21 4 5 21 3" />
      <circle cx="3" cy="21" r="1.6" /><circle cx="21" cy="3" r="1.6" />
    </svg>
  )
}

export function ShadowIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="3" width="13" height="13" rx="2" />
      <path d="M20 8v10a2 2 0 0 1-2 2H8" opacity="0.5" />
    </svg>
  )
}

export function GradientIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 15l18-8M3 20l18-8" opacity="0.5" />
    </svg>
  )
}

export function NetworkIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="9" y="2" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="16" y="16" width="6" height="6" rx="1" />
      <path d="M12 8v4M12 12H5v4M12 12h7v4" />
    </svg>
  )
}

export function DeviceIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2" y="4" width="14" height="11" rx="2" /><rect x="17" y="8" width="5" height="12" rx="1.5" />
      <path d="M2 18h9M6 15v3" />
    </svg>
  )
}

export function WheelIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
    </svg>
  )
}

export function DiceIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" />
    </svg>
  )
}

export function KeyboardIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 16h8" />
    </svg>
  )
}

export function AsciiIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8v8M7 8h2v3H7M13 8l2 8M13 8l-1 4h3M18 8v8" />
    </svg>
  )
}

export function MemeIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 9h.01M16 9h.01M8 15c1.2 1.3 2.6 2 4 2s2.8-.7 4-2" />
    </svg>
  )
}

export function FaviconIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8.2l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function StegoIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7a11 11 0 0 1-4-.8" />
      <circle cx="12" cy="12" r="3" /><path d="M3 3l18 18" />
    </svg>
  )
}

export function RecordIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <circle cx="12" cy="11" r="3.5" fill="currentColor" stroke="none" />
      <path d="M8 22h8" />
    </svg>
  )
}

export function CameraIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h1.5l1-1.5h5l1 1.5H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  )
}

export function RedactIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="7" y="9" width="10" height="3.2" rx="0.6" fill="currentColor" stroke="none" />
      <path d="M7 15.5h6" opacity="0.5" />
    </svg>
  )
}

export function TagIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 11V5a2 2 0 0 1 2-2h6l9 9a2 2 0 0 1 0 2.8l-5.2 5.2a2 2 0 0 1-2.8 0z" />
      <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function RobotIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M12 4v4M9 13h.01M15 13h.01M9 16h6" /><circle cx="12" cy="3" r="1" />
    </svg>
  )
}

export function GitIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="9" r="2.5" />
      <path d="M6 8.5v7M18 11.5c0 3-3 3.5-6 3.5" />
    </svg>
  )
}
