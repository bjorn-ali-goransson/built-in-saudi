import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n'
import { BellIcon } from './icons'

// The current announcement. Set to `null` when there's nothing worth telling —
// then NOTHING renders (no banner, no bell). Bump the id + update `t.notif`
// (en.ts / ar.ts) whenever there's real news to re-announce it once.
const ANNOUNCEMENT_ID: string | null = null
const KEY = `bis-notif-${ANNOUNCEMENT_ID}`

function wasSeen(): boolean {
  try { return localStorage.getItem(KEY) === 'seen' } catch { return false }
}

/**
 * Startpage announcement — deliberately minimal: on first visit a banner shows,
 * then auto-closes to a bell after a few seconds and marks itself seen (so it
 * won't nag again). No buttons. Tap the bell to peek at it again.
 */
export function NotificationBell() {
  const { t } = useLocale()
  const n = t.notif
  const [open, setOpen] = useState(!wasSeen())
  const [revealed, setRevealed] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const revealTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    timer.current = window.setTimeout(() => {
      try { localStorage.setItem(KEY, 'seen') } catch { /* ignore */ }
      setOpen(false)
    }, 6000)
    return () => window.clearTimeout(timer.current)
  }, [open])

  // The minimized bell auto-hides; reveal it briefly while the user scrolls.
  useEffect(() => {
    const onScroll = () => {
      setRevealed(true)
      window.clearTimeout(revealTimer.current)
      revealTimer.current = window.setTimeout(() => setRevealed(false), 1800)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(revealTimer.current) }
  }, [])

  if (!ANNOUNCEMENT_ID) return null // nothing worth telling → show nothing at all

  if (!open) {
    return (
      <button className={`fixed bottom-[1.1rem] start-[1.1rem] z-[60] w-12 h-12 rounded-full bg-green-600 text-sand-100 grid place-items-center border border-green-700 shadow-[var(--shadow-md)] [transition:transform_0.28s_ease,opacity_0.28s_ease,box-shadow_0.2s_ease] hover:-translate-y-0.5 hover:shadow-lg pointer-coarse:w-[52px] pointer-coarse:h-[52px] supports-[padding:env(safe-area-inset-bottom)]:bottom-[calc(1.1rem+env(safe-area-inset-bottom))] [&_svg]:w-[22px] [&_svg]:h-[22px] ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[140%] pointer-events-none'}`}
        data-testid="notif-bell" aria-label={n.open} onClick={() => setOpen(true)}>
        <BellIcon />
      </button>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] max-w-none w-auto flex gap-[0.7rem] items-center bg-[var(--surface)] border-t border-[color:var(--line)] rounded-none shadow-[0_-4px_16px_rgba(18,33,27,0.12)] py-[0.7rem] px-[clamp(1rem,4vw,2rem)] pb-[calc(0.7rem+env(safe-area-inset-bottom,0px))] animate-[fadeUp_0.4s_ease_both]" role="status" aria-live="polite" data-testid="notif-banner">
      <span className="flex-none w-[30px] h-[30px] grid place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--green-400)_16%,transparent)] text-green-600 [&_svg]:w-5 [&_svg]:h-5" aria-hidden="true"><BellIcon /></span>
      <div className="flex-1 min-w-0">
        <strong className="block font-display text-green-700 text-base rtl:font-ar">{n.title}</strong>
        <p className="mt-[0.1rem] text-[0.85rem] text-ink-soft leading-[1.45]">{n.message}</p>
      </div>
    </div>
  )
}
