import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n'
import { BellIcon } from './icons'

// Bump this id to re-announce something new (a fresh id ignores old dismissals).
const NOTIF_ID = 'launch'
const KEY = `bis-notif-${NOTIF_ID}`

function wasDismissed(): boolean {
  try { return localStorage.getItem(KEY) === 'dismissed' } catch { return false }
}

/**
 * Startpage announcement: shows a banner that auto-minimizes to a bell after a
 * few seconds. Clicking the bell reopens it. Dismissing sets a localStorage flag
 * so we don't nag again (next visit starts minimized as the bell).
 */
export function NotificationBell() {
  const { t } = useLocale()
  const n = t.notif
  const dismissed = useRef(wasDismissed())
  const [open, setOpen] = useState(!dismissed.current)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (open && !dismissed.current) {
      timer.current = window.setTimeout(() => setOpen(false), 6000)
      return () => window.clearTimeout(timer.current)
    }
  }, [open])

  function dismiss() {
    try { localStorage.setItem(KEY, 'dismissed') } catch { /* ignore */ }
    dismissed.current = true
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="notif-bell" data-testid="notif-bell" aria-label={n.open}
        onClick={() => setOpen(true)}>
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
      <div className="notif__actions">
        <button className="notif__btn" aria-label={n.minimize} title={n.minimize}
          data-testid="notif-minimize" onClick={() => setOpen(false)}>–</button>
        <button className="notif__btn" aria-label={n.dismiss} title={n.dismiss}
          data-testid="notif-dismiss" onClick={dismiss}>✕</button>
      </div>
    </div>
  )
}
