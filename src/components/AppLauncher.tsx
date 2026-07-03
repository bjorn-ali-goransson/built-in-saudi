import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { liveTools } from '../tools'
import { useLocale, localePath, localizeTool } from '../i18n'
import { scoreTool } from '../lib/fuzzy'
import { GridIcon, SearchIcon } from './icons'

/** 9-dot launcher → a full-screen, searchable app drawer (4-column grid). The
 *  close ✕ sits at the start (same spot as the launcher) so the thumb stays put. */
export function AppLauncher() {
  const { locale, t } = useLocale()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) { setQuery(''); return }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])

  const results = useMemo(() => {
    const indexed = liveTools.map((tool) => {
      const l = localizeTool(tool, locale)
      return { tool, s: { name: `${l.name} ${tool.name}`, tagline: `${l.tagline} ${tool.tagline}`, category: `${l.category} ${tool.category}`, keywords: tool.keywords } }
    })
    if (!query.trim()) return indexed.map((r) => r.tool)
    return indexed.map((r) => ({ ...r, score: scoreTool(query, r.s) })).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).map((r) => r.tool)
  }, [query, locale])

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
          <div className="wrap flex items-center gap-3 h-[60px] flex-none border-b border-[color:var(--line-soft)]">
            <button className="grid place-items-center flex-none w-10 h-10 rounded-[5px] text-ink-soft text-[1.25rem] leading-none hover:bg-sand-100" aria-label="Close" data-testid="launcher-close" onClick={() => setOpen(false)}>✕</button>
            <div className="flex-1 min-w-0 flex items-center gap-2 py-[0.1rem] px-3 bg-[var(--surface)] border border-[color:var(--line)] rounded-full focus-within:border-green-500">
              <SearchIcon className="w-5 h-5 text-ink-faint flex-none" />
              <input
                type="search" autoFocus data-testid="launcher-search"
                className="flex-1 min-w-0 border-none bg-transparent outline-none appearance-none font-body text-[1rem] text-ink py-[0.5rem] placeholder:text-ink-faint truncate [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                placeholder={t.catalog.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t.catalog.searchAria}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto wrap py-5">
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
              {results.map((tool) => {
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
                    <span className="grid place-items-center w-[58px] h-[58px] rounded-2xl bg-green-600 text-sand-100 shadow-[var(--shadow-sm)] [&_svg]:size-7" aria-hidden="true"><Icon /></span>
                    <span className="text-[0.72rem] font-medium leading-tight break-words w-full">{l.name}</span>
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
