import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tools } from '../tools'
import { SearchIcon } from '../components/icons'
import { CategorySections, ToolGrid } from '../components/ToolCatalog'
import { SectionNav } from '../components/SectionNav'
import { buildToolSections } from '../lib/toolSections'
import { useRecentTools } from '../lib/recentTools'
import { rankToolsWithCorrection } from '../lib/searchTools'
import { useResultKeys } from '../lib/useResultKeys'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localePath } from '../i18n'

export function HomePage() {
  const { locale, t } = useLocale()
  useDocumentMeta(locale, '/')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // The 9-dot launcher is deliberately not rendered here — home IS the
  // catalogue — so Ctrl/Cmd+K would have been dead on the most visited page.
  // It focuses the search that is already on screen instead of opening an
  // overlay listing what is already listed underneath it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'k' && e.key !== 'K') || (!e.metaKey && !e.ctrlKey)) return
      if ((e.target as HTMLElement | null)?.isContentEditable) return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const indexOf = useMemo(() => new Map(tools.map((tl, i) => [tl.id, i])), [])
  const idx = (id: string) => indexOf.get(id) ?? 0

  // Search matches both the localized and English fields so either language works.
  // The ranking itself lives in `lib/searchTools.ts`, shared with the launcher
  // and the 404 suggestions — the two catalogue surfaces are documented as
  // having to stay identical, and a copy is how they stop being.
  const ranked = useMemo(() => rankToolsWithCorrection(query, tools, locale), [query, locale])
  const results = ranked.tools

  // Type, arrow, Enter — the whole of a command palette. Neither half needs
  // advertising: every search box on earth behaves this way.
  const { active, onKeyDown } = useResultKeys(results, (tool) => {
    if (tool.href) window.open(tool.href, '_blank', 'noreferrer noopener')
    else navigate(localePath(locale, `/apps/${tool.id}`))
  })

  const recent = useRecentTools()
  const sections = useMemo(() => buildToolSections(locale, recent), [locale, recent])

  return (
    <section className="wrap pt-[clamp(1.2rem,4vw,2rem)] pb-[clamp(3rem,8vw,5.5rem)]" aria-labelledby="catalog-title">
      <h1 id="catalog-title" className="sr-only">{t.hero.title1} {t.hero.title2}</h1>

      <div className="tool-search relative flex items-center gap-[0.6rem] mb-8 py-[0.15rem] px-[0.9rem] bg-[var(--surface)] border border-[color:var(--line)] rounded-full shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-150 focus-within:border-green-500 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--green-500)_18%,transparent)]" role="search">
        <SearchIcon className="w-5 h-5 text-ink-faint flex-none" />
        <input
          ref={inputRef}
          type="search"
          className="tool-search__input flex-1 min-w-0 border-none bg-transparent outline-none appearance-none font-body text-[1rem] text-ink py-[0.7rem] placeholder:text-ink-faint truncate [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
          placeholder={t.catalog.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.catalog.searchAria}
          autoComplete="off"
          onKeyDown={onKeyDown}
        />
        {query && (
          <button
            type="button"
            className="flex-none w-6 h-6 rounded-full text-[0.8rem] text-ink-faint grid place-items-center transition-[background,color] duration-150 hover:bg-sand-200 hover:text-ink"
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            aria-label={t.catalog.clear}
          >
            ✕
          </button>
        )}
      </div>

      {query.trim() ? (
        results.length > 0 ? (
          <>
            {/* Only ever shown when what was typed found nothing and a spelling
                correction did — never over results for the literal query. */}
            {ranked.correctedTo && (
              <p className="mb-4 text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="search-corrected">
                {t.search.correctedTo(ranked.correctedTo)}
              </p>
            )}
            <ToolGrid tools={results} indexOf={idx} active={active} />
          </>
        ) : (
          <p className="py-10 text-ink-soft text-[1.05rem]">{t.catalog.empty(query)}</p>
        )
      ) : (
        <>
          {/* Not rendered over search results: those are one flat grid, so
              there is nothing to jump between. */}
          <SectionNav sections={sections} />
          <CategorySections sections={sections} indexOf={idx} />
        </>
      )}
    </section>
  )
}
