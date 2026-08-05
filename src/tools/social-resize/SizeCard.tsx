import { useEffect, useRef } from 'react'
import { DownloadIcon } from '../../components/icons'
import { renderSize, type Fit, type Size } from './sizes'

/**
 * One preview tile. The thumbnail is drawn at a small fixed width rather than at
 * the true export size — twelve full-resolution canvases (one is 1080×1920)
 * would be ~50MB of backing store for pictures shown 150px wide.
 */
const THUMB_W = 220

export function SizeCard({
  size, image, fit, focusY, background, checked, label, downloadLabel, onToggle, onDownload,
}: {
  size: Size
  image: ImageBitmap
  fit: Fit
  focusY: number
  background: string
  checked: boolean
  label: string
  downloadLabel: string
  onToggle: () => void
  onDownload: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const scale = THUMB_W / size.w
    const preview = renderSize(image, { ...size, w: THUMB_W, h: Math.round(size.h * scale) }, fit, background, focusY)
    preview.className = 'w-full h-auto rounded-sm border border-[color:var(--line)] bg-[color-mix(in_srgb,var(--color-ink)_6%,transparent)]'
    host.replaceChildren(preview)
  }, [image, size, fit, focusY, background])

  return (
    <div className={`flex flex-col gap-2 rounded-md border p-2 ${checked ? 'border-green-600 bg-[color-mix(in_srgb,var(--color-green-400)_10%,transparent)]' : 'border-[color:var(--line)] bg-[var(--surface)]'}`}
      data-testid={`sr-card-${size.id}`}>
      <div ref={hostRef} className="flex justify-center max-h-40 overflow-hidden" />
      <label className="flex items-start gap-2 text-[0.85rem] cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onToggle} data-testid={`sr-check-${size.id}`}
          className="mt-0.5 size-[1rem] accent-green-600" />
        <span className="flex flex-col">
          <span className="text-ink rtl:font-ar">{label}</span>
          <span className="font-mono text-[0.72rem] text-ink-faint">{size.w} × {size.h}</span>
        </span>
      </label>
      <button onClick={onDownload} data-testid={`sr-one-${size.id}`}
        className="inline-flex items-center justify-center gap-1.5 text-[0.8rem] border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft rounded-sm py-1 hover:text-ink [&_svg]:size-4">
        <DownloadIcon /> {downloadLabel}
      </button>
    </div>
  )
}
