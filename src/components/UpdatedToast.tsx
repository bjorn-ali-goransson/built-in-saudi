import { useEffect, useState } from 'react'
import { useLocale } from '../i18n'

const MSG = {
  en: 'Reloaded to load the new version.',
  ar: 'أُعيد التحميل لتحميل الإصدار الجديد.',
}

/** Shows a brief toast after an auto-reload triggered by a new deploy / stale chunk. */
export function UpdatedToast() {
  const { locale } = useLocale()
  const [show, setShow] = useState(() => {
    try { return sessionStorage.getItem('bis-reloaded') != null } catch { return false }
  })

  useEffect(() => {
    if (!show) return
    try {
      sessionStorage.removeItem('bis-reloaded')
      sessionStorage.removeItem('bis-chunk-reload')
    } catch { /* ignore */ }
    const id = window.setTimeout(() => setShow(false), 5000)
    return () => window.clearTimeout(id)
  }, [show])

  if (!show) return null
  return <div className="updated-toast" role="status" data-testid="updated-toast">{MSG[locale]}</div>
}
