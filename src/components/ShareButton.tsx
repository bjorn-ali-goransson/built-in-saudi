import { useState } from 'react'
import { useLocale } from '../i18n'
import { ShareIcon } from './icons'

/** Navbar share button — native share sheet where available, else copy the link. */
export function ShareButton() {
  const { locale } = useLocale()
  const [copied, setCopied] = useState(false)
  const label = locale === 'ar' ? 'مشاركة' : 'Share'

  async function share() {
    const url = window.location.href
    const title = document.title
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        /* user cancelled the share sheet — nothing to do */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={label}
      title={label}
      data-testid="share-app"
      className="inline-flex items-center justify-center size-9 rounded-full border border-[color:var(--line)] bg-transparent text-ink-soft cursor-pointer hover:text-green-700 hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] [&_svg]:w-[18px] [&_svg]:h-[18px]"
    >
      {copied ? <span className="text-[0.85rem] font-bold text-green-700" aria-hidden="true">✓</span> : <ShareIcon />}
      <span className="sr-only" aria-live="polite">{copied ? (locale === 'ar' ? 'تم النسخ' : 'Link copied') : ''}</span>
    </button>
  )
}
