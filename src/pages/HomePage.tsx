import { useMemo, useRef, useState } from 'react'
import { tools, liveTools } from '../tools'
import { ToolCard } from '../components/ToolCard'
import { SaduDivider } from '../components/SaduDivider'
import { ShieldIcon, BoltIcon, CodeIcon, SearchIcon } from '../components/icons'
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
      <section className="hero">
        <div className="wrap hero__inner">
          <p className="hero__kicker">{t.hero.kicker}</p>
          <h1 className="hero__title">
            {t.hero.title1}
            <br />
            <em>{t.hero.title2}</em>
          </h1>
          <p className="hero__lede">{t.hero.lede}</p>

          <ul className="hero__badges">
            <li><ShieldIcon /> {t.hero.badgeDevice}</li>
            <li><BoltIcon /> {t.hero.badgeNoAds}</li>
            <li><CodeIcon /> {t.hero.badgeOpen}</li>
          </ul>
        </div>
      </section>

      <SaduDivider className="sadu--hero" />

      <section className="catalog wrap" aria-labelledby="catalog-title">
        <div className="catalog__head">
          <h2 id="catalog-title" className="catalog__title">{t.catalog.title}</h2>
          <p className="catalog__count">
            {t.catalog.count(liveTools.length, tools.length - liveTools.length)}
          </p>
        </div>

        <div className="tool-search" role="search">
          <SearchIcon className="tool-search__icon" />
          <input
            ref={inputRef}
            type="search"
            className="tool-search__input"
            placeholder={t.catalog.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t.catalog.searchAria}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="tool-search__clear"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label={t.catalog.clear}
            >
              ✕
            </button>
          )}
        </div>

        {results.length > 0 ? (
          <div className="tool-grid">
            {results.map(({ tool, i }) => (
              <ToolCard key={tool.id} tool={tool} index={i} />
            ))}
          </div>
        ) : (
          <p className="tool-search__empty">{t.catalog.empty(query)}</p>
        )}
      </section>
    </>
  )
}
