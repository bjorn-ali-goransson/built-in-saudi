import { useEffect, useState } from 'react'
import { useLocale } from '../i18n'

const MSG = {
  en: 'Updated',
  ar: 'تم التحديث',
}

/** Shows a brief toast after an auto-reload triggered by a new deploy / stale chunk. */
export function UpdatedToast() {
  const { locale } = useLocale()
  const [show, setShow] = useState(() => {
    try { return sessionStorage.getItem('bis-reloaded') != null } catch { return false }
  })
  const [notes] = useState(() => {
    try { return sessionStorage.getItem('bis-update-notes') || '' } catch { return '' }
  })

  useEffect(() => {
    if (!show) return
    try {
      sessionStorage.removeItem('bis-reloaded')
      sessionStorage.removeItem('bis-chunk-reload')
      sessionStorage.removeItem('bis-update-notes')
    } catch { /* ignore */ }
    const id = window.setTimeout(() => setShow(false), notes ? 7000 : 4000)
    return () => window.clearTimeout(id)
  }, [show, notes])

  if (!show) return null
  return (
    <div className="fixed top-[84px] inset-x-0 mx-auto z-[70] w-fit max-w-[min(92vw,460px)] bg-green-700 text-sand-100 py-[0.6rem] px-[1.1rem] rounded-md shadow-lg text-[0.9rem] animate-[fadeUp_0.3s_ease_both] flex flex-col items-center gap-[0.15rem] text-center border-[1.5px] border-white/90" role="status" data-testid="updated-toast">
      <strong className="font-body text-[0.66rem] uppercase tracking-[0.09em] opacity-80">{MSG[locale]}</strong>
      {notes && <span className="text-[0.9rem] leading-[1.35]">{notes}</span>}
    </div>
  )
}
