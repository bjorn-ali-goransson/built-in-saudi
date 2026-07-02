import { useMemo, useRef, useState } from 'react'
import { tools } from '../tools'
import { ToolCard } from '../components/ToolCard'
import { SearchIcon } from '../components/icons'
import { scoreTool } from '../lib/fuzzy'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localizeTool } from '../i18n'

export function HomePage() {
  const { locale, t } = useLocale()
  useDocumentMeta(locale, '/')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep each tool's original catalog number stable while filtering.
  // Search matches both the localized and English fields so either language works.
  const results = useMemo(() => {
    const indexed = tools.map((tool, i) => {
      const l = localizeTool(tool, locale)
      const searchable = {
        name: `${l.name} ${tool.name}`,
        tagline: `${l.tagline} ${tool.tagline}`,
        category: `${l.category} ${tool.category}`,
        keywords: tool.keywords,
      }
      return { tool, i, searchable }
    })
    if (!query.trim()) return indexed
    return indexed
      .map((r) => ({ ...r, score: scoreTool(query, r.searchable) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [query, locale])

  return (
    <>
      <section className="wrap pt-[clamp(1.2rem,4vw,2rem)] pb-[clamp(3rem,8vw,5.5rem)]" aria-labelledby="catalog-title">
        <h1 id="catalog-title" className="sr-only">{t.hero.title1} {t.hero.title2}</h1>

        <div className="tool-search relative flex items-center gap-[0.6rem] mb-[1.5rem] py-[0.15rem] px-[0.9rem] bg-[var(--surface)] border border-[color:var(--line)] rounded-full shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-150 focus-within:border-green-500 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--green-500)_18%,transparent)]" role="search">
          <SearchIcon className="w-5 h-5 text-ink-faint flex-none" />
          <input
            ref={inputRef}
            type="search"
            className="tool-search__input flex-1 border-none bg-transparent outline-none font-body text-[1rem] text-ink py-[0.7rem] placeholder:text-ink-faint [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
            placeholder={t.catalog.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t.catalog.searchAria}
            autoComplete="off"
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

        {results.length > 0 ? (
          <div className="tool-grid grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-[1.1rem]">
            {results.map(({ tool, i }) => (
              <ToolCard key={tool.id} tool={tool} index={i} />
            ))}
          </div>
        ) : (
          <p className="py-10 text-ink-soft text-[1.05rem]">{t.catalog.empty(query)}</p>
        )}
      </section>
    </>
  )
}
