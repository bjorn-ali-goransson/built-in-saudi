import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { tools, liveTools } from '../tools'
import { useLocale, localePath } from '../i18n'
import { rankToolsWithCorrection } from '../lib/searchTools'
import { buildToolSections } from '../lib/toolSections'
import { CategorySections, ToolGrid } from './ToolCatalog'
import { SectionNav } from './SectionNav'
import { GridIcon, SearchIcon } from './icons'
import { useRecentTools } from '../lib/recentTools'

/** 9-dot launcher → a full-screen, searchable app drawer that mirrors the home
 *  catalog exactly (same category sections + tool cards). The close ✕ sits at the
 *  start (same spot as the launcher) so the thumb stays put. */
export function AppLauncher() {
  const { locale, t } = useLocale()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  // Worked out on the client only: the pages are prerendered, so reading the
  // platform during render would put one machine's label in everyone's HTML.
  const [combo, setCombo] = useState('Ctrl K')
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setCombo('⌘ K')
  }, [])

  // Ctrl/Cmd+K from anywhere. At 194 tools the launcher is the fastest route to
  // any of them and it could only be reached by finding and clicking a 9-dot
  // icon in the header — so on a keyboard the slow path was the only path.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'k' && e.key !== 'K') return
      if (!e.metaKey && !e.ctrlKey) return
      // A rich-text surface may bind Cmd+K to "insert link", and taking that
      // key off it would break the tool to speed up leaving it.
      const el = e.target as HTMLElement | null
      if (el?.isContentEditable) return
      e.preventDefault()
      setOpen((o) => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
  const recent = useRecentTools()
  const sections = useMemo(() => buildToolSections(locale, recent), [locale, recent])

  const ranked = useMemo(() => rankToolsWithCorrection(query, liveTools, locale), [query, locale])
  const results = ranked.tools

  const navigate = useNavigate()
  const close = () => setOpen(false)

  /** Enter goes to the top result — the other half of Ctrl+K. */
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !results.length) return
    e.preventDefault()
    const top = results[0]
    close()
    // An external/showcase tool has an href instead of a route.
    if (top.href) window.open(top.href, '_blank', 'noreferrer noopener')
    else navigate(localePath(locale, `/apps/${top.id}`))
  }

  return (
    <>
      <button
        className="grid place-items-center w-10 h-10 rounded-[5px] border border-[color:var(--line)] text-ink-soft bg-[var(--surface)] transition-[border-color,color,background] duration-150 hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:text-green-700 hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] aria-expanded:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] aria-expanded:text-green-700 aria-expanded:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] [&_svg]:size-[22px]"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t.nav.tools}
        title={`${t.nav.tools} (${combo})`}
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
                onKeyDown={onSearchKey}
              />
              {/* Only where there is a keyboard to press it with. */}
              <kbd className="hidden min-[860px]:block flex-none font-mono text-[0.7rem] text-ink-faint border border-[color:var(--line)] rounded-sm px-1.5 py-0.5" data-testid="launcher-combo">{combo}</kbd>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto wrap py-5" ref={scrollRef}>
            {query.trim() ? (
              results.length > 0 ? (
                <>
                  {ranked.correctedTo && (
                    <p className="mb-4 text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="search-corrected">
                      {t.search.correctedTo(ranked.correctedTo)}
                    </p>
                  )}
                  <ToolGrid tools={results} indexOf={idx} onNavigate={close} />
                </>
              ) : (
                <p className="py-10 text-ink-soft text-[1.05rem]">{t.catalog.empty(query)}</p>
              )
            ) : (
              <>
                {/* This overlay scrolls itself, not the window, so the bar is
                    told which element to observe and to scroll. */}
                <SectionNav sections={sections} scrollRef={scrollRef} />
                <CategorySections sections={sections} indexOf={idx} onNavigate={close} />
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
