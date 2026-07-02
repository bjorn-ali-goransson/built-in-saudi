import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n'
import { BellIcon } from './icons'

// The current announcement. Set to `null` when there's nothing worth telling —
// then NOTHING renders (no banner, no bell). Bump the id + update `t.notif`
// (en.ts / ar.ts) whenever there's real news to re-announce it once.
const ANNOUNCEMENT_ID: string | null = 'launch'
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
      <button className={`notif-bell ${revealed ? 'is-revealed' : 'is-hidden'}`}
        data-testid="notif-bell" aria-label={n.open} onClick={() => setOpen(true)}>
        <BellIcon />
      </button>
    )
  }

  return (
    <div className="notif" role="status" aria-live="polite" data-testid="notif-banner">
      <span className="notif__icon" aria-hidden="true"><BellIcon /></span>
      <div className="notif__body">
        <strong className="notif__title">{n.title}</strong>
        <p className="notif__msg">{n.message}</p>
      </div>
    </div>
  )
}
