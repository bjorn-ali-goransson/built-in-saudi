import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { liveTools } from '../tools'
import { useLocale, localePath, localizeTool } from '../i18n'
import { GridIcon } from './icons'

/** A 9-dot app launcher: opens a panel listing the live tools (apps). */
export function AppLauncher() {
  const { locale, t } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        className="grid place-items-center w-10 h-10 rounded-[5px] border border-[color:var(--line)] text-ink-soft bg-[var(--surface)] transition-[border-color,color,background] duration-150 hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:text-green-700 hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] aria-expanded:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] aria-expanded:text-green-700 aria-expanded:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] [&_svg]:size-[22px]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.nav.tools}
        data-testid="app-launcher"
        onClick={() => setOpen((o) => !o)}
      >
        <GridIcon />
      </button>

      {open && (
        <div className="absolute end-0 top-[calc(100%+8px)] w-[min(92vw,320px)] bg-[var(--surface)] border border-[color:var(--line)] rounded-md shadow-[var(--shadow-lg)] p-[0.9rem] z-50 animate-[fadeUp_0.16s_ease_both]" role="menu" data-testid="app-launcher-panel">
          <p className="font-body text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint mb-[0.6rem] rtl:font-ar rtl:tracking-normal">{t.nav.tools}</p>
          <div className="grid grid-cols-3 gap-[0.4rem]">
            {liveTools.map((tool) => {
              const l = localizeTool(tool, locale)
              const Icon = tool.Icon
              return (
                <Link
                  key={tool.id}
                  to={localePath(locale, `/tools/${tool.id}`)}
                  className="flex flex-col items-center gap-[0.4rem] px-[0.4rem] py-[0.7rem] rounded-[5px] no-underline text-ink text-center transition-[background] duration-150 hover:bg-sand-100"
                  role="menuitem"
                  data-testid={`launcher-${tool.id}`}
                  onClick={() => setOpen(false)}
                >
                  <span className="grid place-items-center w-10 h-10 rounded-md bg-[color-mix(in_srgb,var(--green-400)_14%,transparent)] text-green-600 [&_svg]:size-[22px]" aria-hidden="true"><Icon /></span>
                  <span className="text-[0.72rem] leading-[1.2]">{l.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
