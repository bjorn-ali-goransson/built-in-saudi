import { useMemo, useRef, useState } from 'react'
import { tools } from '../tools'
import type { Tool } from '../tools/types'
import { ToolCard } from '../components/ToolCard'
import { SearchIcon } from '../components/icons'
import { scoreTool } from '../lib/fuzzy'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localizeTool, categoryLabel } from '../i18n'

// Curated home sections. The first two are hand-picked groupings that cut across
// the tools' own `category`; the rest fall back to their category in this order.
const RECOMMENDED = ['qr-code', 'prayer-times', 'islamic-calendar', 'qibla']
const DUA = ['istikhara', 'adhkar', 'hisn-al-muslim']
const CATEGORY_ORDER = ['Saudi / Local', 'Text', 'Converters', 'Calculators', 'Images', 'PDF', 'Files', 'Developer', 'Generators', 'Design', 'Business']

const GRID = 'tool-grid grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-[1.1rem]'

export function HomePage() {
  const { locale, t } = useLocale()
  useDocumentMeta(locale, '/')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const indexOf = useMemo(() => new Map(tools.map((tl, i) => [tl.id, i])), [])

  // Search matches both the localized and English fields so either language works.
  const results = useMemo(() => {
    if (!query.trim()) return []
    return tools
      .map((tool) => {
        const l = localizeTool(tool, locale)
        return { tool, score: scoreTool(query, { name: `${l.name} ${tool.name}`, tagline: `${l.tagline} ${tool.tagline}`, category: `${l.category} ${tool.category}`, keywords: tool.keywords }) }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [query, locale])

  // Ordered, de-duplicated sections for the default (non-search) view.
  const sections = useMemo(() => {
    const live = tools.filter((tl) => tl.status !== 'coming-soon')
    const used = new Set<string>()
    const pick = (ids: string[]) => ids.map((id) => live.find((tl) => tl.id === id)).filter((tl): tl is Tool => !!tl)
    const out: { key: string; title: string; tools: Tool[] }[] = []
    const rec = pick(RECOMMENDED); rec.forEach((tl) => used.add(tl.id))
    const dua = pick(DUA); dua.forEach((tl) => used.add(tl.id))
    out.push({ key: '__rec', title: locale === 'ar' ? 'موصى به' : 'Recommended', tools: rec })
    out.push({ key: '__dua', title: locale === 'ar' ? 'دعاء وذكر' : 'Duʿāʾ & Dhikr', tools: dua })
    const cats = [...CATEGORY_ORDER, ...live.map((tl) => tl.category).filter((c) => !CATEGORY_ORDER.includes(c))]
    const catSections: { key: string; title: string; tools: Tool[] }[] = []
    for (const cat of cats) {
      const inCat = live.filter((tl) => !used.has(tl.id) && tl.category === cat)
      if (!inCat.length) continue
      inCat.forEach((tl) => used.add(tl.id))
      catSections.push({ key: cat, title: categoryLabel(cat, locale), tools: inCat })
    }
    // A category with a single app doesn't earn its own heading — pool them into "Other".
    out.push(...catSections.filter((s) => s.tools.length > 1))
    const singles = catSections.filter((s) => s.tools.length === 1).flatMap((s) => s.tools)
    if (singles.length) out.push({ key: '__other', title: locale === 'ar' ? 'أخرى' : 'Other', tools: singles })
    return out.filter((s) => s.tools.length)
  }, [locale])

  return (
    <section className="wrap pt-[clamp(1.2rem,4vw,2rem)] pb-[clamp(3rem,8vw,5.5rem)]" aria-labelledby="catalog-title">
      <h1 id="catalog-title" className="sr-only">{t.hero.title1} {t.hero.title2}</h1>

      <div className="tool-search relative flex items-center gap-[0.6rem] mb-[clamp(2.2rem,7vw,3.2rem)] py-[0.15rem] px-[0.9rem] bg-[var(--surface)] border border-[color:var(--line)] rounded-full shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-150 focus-within:border-green-500 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--green-500)_18%,transparent)]" role="search">
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
          <div className={GRID}>
            {results.map(({ tool }) => <ToolCard key={tool.id} tool={tool} index={indexOf.get(tool.id) ?? 0} />)}
          </div>
        ) : (
          <p className="py-10 text-ink-soft text-[1.05rem]">{t.catalog.empty(query)}</p>
        )
      ) : (
        sections.map((sec) => (
          <div key={sec.key} className="mb-[2.6rem]">
            <div className="flex items-center gap-3 mb-[1.1rem]">
              <h2 className="text-[0.8rem] font-medium tracking-[0.04em] text-ink-faint whitespace-nowrap rtl:tracking-normal">{sec.title}</h2>
              <span className="flex-1 h-px bg-[color:var(--line-soft)]" aria-hidden="true" />
            </div>
            <div className={GRID}>
              {sec.tools.map((tool) => <ToolCard key={tool.id} tool={tool} index={indexOf.get(tool.id) ?? 0} />)}
            </div>
          </div>
        ))
      )}
    </section>
  )
}
