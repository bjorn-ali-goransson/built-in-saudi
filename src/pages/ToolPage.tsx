import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { getTool } from '../tools'
import type { Tool } from '../tools/types'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localizeTool } from '../i18n'
import { NotFoundPage } from './NotFoundPage'
import { recordRecent } from '../lib/recentTools'
import { StatusBadge } from '../components/ui'
import { relatedTools } from '../lib/relatedTools'
import { Link } from 'react-router-dom'
import { localePath } from '../i18n'

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

  const related = useMemo(() => relatedTools(tool), [tool])

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
          related. */}
      {related.length > 0 && (
        <nav className="mt-10 pt-6 border-t border-[color:var(--line-soft)]" data-testid="related-tools"
          aria-label={locale === 'ar' ? 'أدوات ذات صلة' : 'Related tools'}>
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint mb-3">
            {locale === 'ar' ? 'أدوات ذات صلة' : 'Related tools'}
          </h2>
          <div className="grid gap-2 grid-cols-1 min-[560px]:grid-cols-2 min-[900px]:grid-cols-4">
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
