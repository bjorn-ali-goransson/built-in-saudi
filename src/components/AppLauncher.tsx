import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { liveTools } from '../tools'
import { useLocale, localePath, localizeTool } from '../i18n'
import { GridIcon } from './icons'

/** 9-dot launcher → a full-screen app drawer (4-column grid of the live apps). */
export function AppLauncher() {
  const { locale, t } = useLocale()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden' // lock background scroll
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      <button
        className="grid place-items-center w-10 h-10 rounded-[5px] border border-[color:var(--line)] text-ink-soft bg-[var(--surface)] transition-[border-color,color,background] duration-150 hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:text-green-700 hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] aria-expanded:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] aria-expanded:text-green-700 aria-expanded:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] [&_svg]:size-[22px]"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t.nav.tools}
        data-testid="app-launcher"
        onClick={() => setOpen((o) => !o)}
      >
        <GridIcon />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col animate-[fadeUp_0.16s_ease_both]" role="dialog" aria-modal="true" aria-label={t.nav.tools} data-testid="app-launcher-panel">
          <div className="wrap flex items-center justify-between h-[60px] flex-none border-b border-[color:var(--line-soft)]">
            <span className="font-display text-[1.2rem] font-semibold text-green-700 rtl:font-ar">{t.nav.tools}</span>
            <button className="grid place-items-center w-10 h-10 rounded-[5px] text-ink-soft text-[1.25rem] leading-none hover:bg-sand-100" aria-label="Close" data-testid="launcher-close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto wrap py-5">
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
              {liveTools.map((tool) => {
                const l = localizeTool(tool, locale)
                const Icon = tool.Icon
                return (
                  <Link
                    key={tool.id}
                    to={localePath(locale, `/tools/${tool.id}`)}
                    className="flex flex-col items-center gap-2 p-2 rounded-md no-underline text-ink text-center transition-[background] duration-150 hover:bg-sand-100"
                    data-testid={`launcher-${tool.id}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="grid place-items-center w-12 h-12 rounded-[14px] bg-[color-mix(in_srgb,var(--green-400)_14%,transparent)] text-green-600 [&_svg]:size-6" aria-hidden="true"><Icon /></span>
                    <span className="text-[0.72rem] leading-tight break-words w-full">{l.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
