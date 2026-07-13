import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Tool } from '../tools/types'
import type { ToolSection } from '../lib/toolSections'
import { ToolCard } from './ToolCard'
import { useLocale, localePath, localizeTool } from '../i18n'

export const TOOL_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-[1.1rem] max-[560px]:grid-cols-4 max-[560px]:gap-[0.9rem_0.5rem]'
// Denser grid for non-recommended sections: small row tiles on desktop, the
// same 4-up icon grid on mobile.
export const COMPACT_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-[0.5rem] max-[560px]:grid-cols-4 max-[560px]:gap-[0.9rem_0.5rem]'

// Close the launcher (or run any nav side-effect) once a card link is followed.
function linkClick(onNavigate?: () => void) {
  if (!onNavigate) return undefined
  return (e: MouseEvent) => { if ((e.target as Element).closest('a')) onNavigate() }
}

/** A flat grid of tool cards — used for search results on both surfaces. */
export function ToolGrid({ tools, indexOf, onNavigate }: { tools: Tool[]; indexOf: (id: string) => number; onNavigate?: () => void }) {
  return (
    <div className={TOOL_GRID} onClick={linkClick(onNavigate)}>
      {tools.map((tool) => <ToolCard key={tool.id} tool={tool} index={indexOf(tool.id)} />)}
    </div>
  )
}

/** Compact tile: icon + name only. Row on desktop, centred icon on mobile. */
function CompactToolCard({ tool }: { tool: Tool }) {
  const { locale } = useLocale()
  const l = localizeTool(tool, locale)
  const comingSoon = tool.status === 'coming-soon'
  const Icon = tool.Icon

  const inner = (
    <>
      <span
        className={`relative grid place-items-center w-9 h-9 rounded-lg shrink-0 transition-[background,color] duration-200 [&_svg]:size-[19px] max-[560px]:w-[52px] max-[560px]:h-[52px] max-[560px]:rounded-2xl max-[560px]:[&_svg]:size-6 max-[560px]:shadow-[var(--shadow-sm)] ${
          comingSoon
            ? 'bg-[color-mix(in_srgb,var(--color-ink)_6%,transparent)] text-ink-faint'
            : 'bg-[color-mix(in_srgb,var(--green-400)_12%,transparent)] text-green-600 group-hover:bg-green-600 group-hover:text-sand-100 max-[560px]:bg-green-600 max-[560px]:text-sand-100'
        }`}
        aria-hidden="true"
      >
        <Icon />
        {tool.status !== 'stable' && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--gold-500)] ring-2 ring-[var(--surface)] max-[560px]:ring-[var(--sand-50)] max-[560px]:right-0 max-[560px]:top-0" />
        )}
      </span>
      <span className={`min-w-0 flex-1 text-[0.9rem] font-medium leading-tight truncate max-[560px]:flex-none max-[560px]:text-center max-[560px]:text-[0.72rem] max-[560px]:leading-[1.2] max-[560px]:whitespace-normal ${comingSoon ? 'text-ink-faint' : 'text-ink'}`}>{l.name}</span>
    </>
  )

  const base = 'group flex items-center gap-[0.6rem] rounded-md p-[0.45rem_0.6rem] no-underline max-[560px]:flex-col max-[560px]:gap-[0.45rem] max-[560px]:p-[0.4rem_0.2rem] max-[560px]:bg-transparent max-[560px]:border-none max-[560px]:shadow-none'

  if (comingSoon) {
    return (
      <div className={`${base} border border-dashed border-[color:var(--line)] bg-[color-mix(in_srgb,var(--sand-100)_60%,var(--surface))] cursor-default max-[560px]:opacity-55`} aria-disabled="true" data-testid={`tool-${tool.id}`}>
        {inner}
      </div>
    )
  }

  const live = `${base} text-ink bg-[var(--surface)] border border-[color:var(--line-soft)] shadow-[var(--shadow-sm)] transition-[box-shadow,border-color] duration-200 hover:shadow-[var(--shadow-md)] hover:border-[color-mix(in_srgb,var(--green-500)_28%,transparent)] max-[560px]:hover:shadow-none max-[560px]:hover:border-none`

  if (tool.href) {
    return <a className={live} href={tool.href} target="_blank" rel="noreferrer noopener" data-testid={`tool-${tool.id}`}>{inner}</a>
  }
  return <Link className={live} to={localePath(locale, `/apps/${tool.id}`)} data-testid={`tool-${tool.id}`}>{inner}</Link>
}

/** Compact grid of tiles for non-recommended sections. */
function CompactToolGrid({ tools, onNavigate }: { tools: Tool[]; onNavigate?: () => void }) {
  return (
    <div className={COMPACT_GRID} onClick={linkClick(onNavigate)}>
      {tools.map((tool) => <CompactToolCard key={tool.id} tool={tool} />)}
    </div>
  )
}

/** The default catalog view: the Recommended section keeps full cards; every
 *  other section renders as a denser grid of compact tiles. */
export function CategorySections({ sections, indexOf, onNavigate }: { sections: ToolSection[]; indexOf: (id: string) => number; onNavigate?: () => void }) {
  return (
    <>
      {sections.map((sec) => (
        <div key={sec.key} className="mb-7 max-[560px]:mb-6">
          <div className="flex items-center gap-3 mb-[1.1rem]">
            {/* A div (not <h2>) so the unlayered base h1–h4 rule in theme.css
                doesn't override these utility classes — cascade layers mean
                unlayered element styles beat @layer utilities. */}
            <div role="heading" aria-level={2}
              className="font-body text-[0.8rem] font-medium tracking-[0.02em] text-ink-faint whitespace-nowrap rtl:tracking-normal">{sec.title}</div>
            <span className="flex-1 h-px bg-[color:var(--line-soft)]" aria-hidden="true" />
          </div>
          {sec.key === '__rec'
            ? <ToolGrid tools={sec.tools} indexOf={indexOf} onNavigate={onNavigate} />
            : <CompactToolGrid tools={sec.tools} onNavigate={onNavigate} />}
        </div>
      ))}
    </>
  )
}
