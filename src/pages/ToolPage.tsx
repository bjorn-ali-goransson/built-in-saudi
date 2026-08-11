import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { getTool } from '../tools'
import type { Tool } from '../tools/types'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localizeTool } from '../i18n'
import { NotFoundPage } from './NotFoundPage'
import { recordRecent } from '../lib/recentTools'
import { disposeImageDecoder } from '../lib/decodeImage'
import { StatusBadge } from '../components/ui'
import { relatedTools } from '../lib/relatedTools'
import { Link } from 'react-router-dom'
import { localePath, categoryLabel } from '../i18n'
import { categorySlug } from '../lib/categorySlug'
import { collectionsFor } from '../lib/collections'
import { collectionSeo } from '../i18n/seo'

export function ToolPage() {
  const { toolId } = useParams()
  const tool = getTool(toolId)

  // Unknown id, or a roadmap tool that isn't routable yet.
  if (!tool || !tool.component) {
    return <NotFoundPage kind={tool ? 'coming-soon' : 'not-found'} tool={tool} />
  }

  return <LoadedTool tool={tool} />
}

function LoadedTool({ tool }: { tool: Tool }) {
  const { locale, t } = useLocale()
  const l = localizeTool(tool, locale)
  // The tool name now lives in the app-bar (Header); the page goes straight to the tool.
  useDocumentMeta(locale, `/apps/${tool.id}`, l.name, l.description)

  // Recorded here rather than on the card, so opening a tool by URL, from a
  // search result or from a link all count the same.
  useEffect(() => { recordRecent(tool.id) }, [tool.id])

  // `disposeImageDecoder` was written with the comment "call when a tool
  // unmounts" and NOTHING called it, so the HEIC decoder — a ~1.4MB wasm
  // worker — outlived every tool that had ever decoded one, for the rest of
  // the session. Twenty-two tools use `decodeImage`; putting the release here
  // is one edit rather than twenty-two, and leaving a tool page is exactly the
  // moment it stops being needed. It is lazily recreated on the next decode.
  useEffect(() => () => disposeImageDecoder(), [])

  const related = useMemo(() => relatedTools(tool), [tool])
  const slug = categorySlug(tool.category)
  // The groups the category tree cannot name — a season, an audience, a verb —
  // and therefore the ones nobody can guess the existence of. Measured before
  // this: 0 of 237 tool pages linked to one, while 61 tools are members.
  const collections = useMemo(() => collectionsFor(tool.id), [tool])

  const ToolComponent = tool.component!
  return (
    <div className="wrap py-[clamp(1.5rem,4vw,2.5rem)] animate-[fadeUp_0.5s_ease_both]">
      {/* The catalogue tile shows an unlabelled gold dot for a non-stable tool,
          which nobody can read. The badge belongs HERE, above the tool, because
          this is where a person reads the numbers and decides to act on them.
          On the Saudi rule tools it means: this figure can go stale without the
          code changing — GOSI's pension rate steps every July, tariffs and
          thresholds move, a decree lands — so check it against the authority
          named in the disclaimer below. */}
      {tool.status !== 'stable' && (
        <p className="mb-3" data-testid="tool-status">
          <StatusBadge status={tool.status}>
            {tool.status === 'coming-soon' ? t.card.comingSoon : t.card.beta}
          </StatusBadge>
        </p>
      )}
      <ToolComponent />

      {/* The crawlable "More free tools" block below links to EVERY tool, which
          is right for a crawler and useless for a person. This is the short
          list, and it is empty rather than padded when nothing measured as
          related.

          The category link sits in the same row and is NOT conditional on the
          related list: a tool page could link to four siblings and to all 207
          tools, and to nothing in between — so the one grouping this site
          curates by hand was the one place a visitor could not go from here. */}
      {(related.length > 0 || slug || collections.length > 0) && (
        <nav className="mt-10 pt-6 border-t border-[color:var(--line-soft)]" data-testid="related-tools"
          aria-label={locale === 'ar' ? 'أدوات ذات صلة' : 'Related tools'}>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">
              {locale === 'ar' ? 'أدوات ذات صلة' : 'Related tools'}
            </h2>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 justify-end">
              {slug && (
                <Link to={localePath(locale, `/c/${slug}`)} data-testid="tool-category-link"
                  className="text-[0.82rem] text-green-700 no-underline hover:underline whitespace-nowrap rtl:font-ar">
                  {locale === 'ar'
                    ? `المزيد في ${categoryLabel(tool.category, locale)}`
                    : `More in ${categoryLabel(tool.category, locale)}`}
                </Link>
              )}
              {/* A collection is a group the category tree cannot name, so being
                  on one of its members is the only place its existence can be
                  learned. The category link is where somebody already looks for
                  "more like this", so this sits beside it rather than in a
                  section of its own. */}
              {collections.map((c) => {
                const name = collectionSeo.find((x) => x.slug === c.slug)?.[locale].name
                if (!name) return null
                return (
                  <Link key={c.slug} to={localePath(locale, `/c/${c.slug}`)}
                    data-testid={`tool-collection-${c.slug}`}
                    className="text-[0.82rem] text-ink-faint no-underline hover:text-green-700 hover:underline whitespace-nowrap rtl:font-ar">
                    {name}
                  </Link>
                )
              })}
            </div>
          </div>
          <div className="grid gap-2 grid-cols-1 min-[560px]:grid-cols-2 min-[900px]:grid-cols-4" data-testid="related-grid">
            {related.map((r) => {
              const rl = localizeTool(r, locale)
              return (
                <Link key={r.id} to={localePath(locale, `/apps/${r.id}`)} data-testid={`related-${r.id}`}
                  className="flex flex-col gap-0.5 rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2 no-underline transition-[border-color] duration-150 hover:border-[color-mix(in_srgb,var(--green-500)_45%,transparent)]">
                  <span className="text-[0.9rem] font-medium text-ink rtl:font-ar">{rl.name}</span>
                  <span className="text-[0.78rem] text-ink-faint rtl:font-ar line-clamp-2">{rl.tagline}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
