import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { tools, liveTools } from '../tools'
import { useLocale, localizeTool } from '../i18n'
import { scoreTool } from '../lib/fuzzy'
import { buildToolSections } from '../lib/toolSections'
import { CategorySections, ToolGrid } from './ToolCatalog'
import { GridIcon, SearchIcon } from './icons'

/** 9-dot launcher → a full-screen, searchable app drawer that mirrors the home
 *  catalog exactly (same category sections + tool cards). The close ✕ sits at the
 *  start (same spot as the launcher) so the thumb stays put. */
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

  const indexOf = useMemo(() => new Map(tools.map((tl, i) => [tl.id, i])), [])
  const idx = (id: string) => indexOf.get(id) ?? 0
  const sections = useMemo(() => buildToolSections(locale), [locale])

  const results = useMemo(() => {
    if (!query.trim()) return []
    return liveTools
      .map((tool) => {
        const l = localizeTool(tool, locale)
        // Fields stay separate rather than being concatenated: joining them let a
        // subsequence run off the end of one and into the start of the next, which
        // is a match nobody meant, and it destroyed the "starts at the beginning"
        // bonus that makes an exact name win.
        return {
          tool,
          score: scoreTool(query, {
            name: tool.name,
            nameAr: l.name,
            tagline: `${l.tagline} ${tool.tagline}`,
            category: `${l.category} ${tool.category}`,
            keywords: tool.keywords,
          }),
        }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.tool)
  }, [query, locale])

  const close = () => setOpen(false)

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
            <button className="grid place-items-center flex-none w-10 h-10 rounded-[5px] text-ink-soft text-[1.25rem] leading-none hover:bg-sand-100" aria-label="Close" data-testid="launcher-close" onClick={close}>✕</button>
            <div className="flex-1 min-w-0 flex items-center gap-2 py-[0.1rem] px-3 bg-[var(--surface)] border border-[color:var(--line)] rounded-full transition-[border-color,box-shadow] duration-150 focus-within:border-green-500 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--green-500)_18%,transparent)]">
              <SearchIcon className="w-5 h-5 text-ink-faint flex-none" />
              <input
                type="search" autoFocus data-testid="launcher-search"
                className="tool-search__input flex-1 min-w-0 border-none bg-transparent outline-none appearance-none font-body text-[1rem] text-ink py-[0.5rem] placeholder:text-ink-faint truncate [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                placeholder={t.catalog.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t.catalog.searchAria}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto wrap py-5">
            {query.trim() ? (
              results.length > 0 ? (
                <ToolGrid tools={results} indexOf={idx} onNavigate={close} />
              ) : (
                <p className="py-10 text-ink-soft text-[1.05rem]">{t.catalog.empty(query)}</p>
              )
            ) : (
              <CategorySections sections={sections} indexOf={idx} onNavigate={close} />
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
