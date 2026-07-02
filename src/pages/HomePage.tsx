import { useMemo, useRef, useState } from 'react'
import { tools, liveTools } from '../tools'
import { ToolCard } from '../components/ToolCard'
import { SaduDivider } from '../components/SaduDivider'
import { ShieldIcon, BoltIcon, CodeIcon, SearchIcon } from '../components/icons'
import { scoreTool } from '../lib/fuzzy'
import { useDocumentMeta } from '../lib/useDocumentMeta'

export function HomePage() {
  useDocumentMeta()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep each tool's original catalog number stable while filtering.
  const results = useMemo(() => {
    const indexed = tools.map((tool, i) => ({ tool, i }))
    if (!query.trim()) return indexed
    return indexed
      .map((r) => ({ ...r, score: scoreTool(query, r.tool) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [query])

  return (
    <>
      <section className="hero">
        <div className="wrap hero__inner">
          <p className="hero__kicker">
            <span lang="ar">بُنِيَ في السعودية</span>
            <span className="hero__kicker-sep">·</span>
            <span>BUILT IN SAUDI</span>
          </p>
          <h1 className="hero__title">
            Sharp little tools.
            <br />
            <em>No ads. No catch.</em>
          </h1>
          <p className="hero__lede">
            The everyday utilities you keep googling — QR codes, converters,
            generators — gathered into one honest toolbox. Free, fast, and
            private: nothing is uploaded, everything runs in your browser.
          </p>

          <ul className="hero__badges">
            <li><ShieldIcon /> Runs on your device</li>
            <li><BoltIcon /> No sign-up, no ads</li>
            <li><CodeIcon /> Open source</li>
          </ul>
        </div>
      </section>

      <SaduDivider className="sadu--hero" />

      <section className="catalog wrap" aria-labelledby="catalog-title">
        <div className="catalog__head">
          <h2 id="catalog-title" className="catalog__title">The toolbox</h2>
          <p className="catalog__count">
            {liveTools.length} live · {tools.length - liveTools.length} on the way
          </p>
        </div>

        <div className="tool-search" role="search">
          <SearchIcon className="tool-search__icon" />
          <input
            ref={inputRef}
            type="search"
            className="tool-search__input"
            placeholder="Search tools — try “wifi”, “pdf”, “convert”…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tools"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="tool-search__clear"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label="Clear search"
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
          <p className="tool-search__empty">
            No tools match “<strong>{query}</strong>” yet — but the toolbox is growing.
          </p>
        )}
      </section>
    </>
  )
}
