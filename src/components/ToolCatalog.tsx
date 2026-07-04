import type { MouseEvent } from 'react'
import type { Tool } from '../tools/types'
import type { ToolSection } from '../lib/toolSections'
import { ToolCard } from './ToolCard'

export const TOOL_GRID = 'tool-grid grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-[1.1rem]'

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

/** The default catalog view: category headings + separator, then a card grid. */
export function CategorySections({ sections, indexOf, onNavigate }: { sections: ToolSection[]; indexOf: (id: string) => number; onNavigate?: () => void }) {
  return (
    <>
      {sections.map((sec) => (
        <div key={sec.key} className="mb-[clamp(3.4rem,10vw,4.6rem)]">
          <div className="flex items-center gap-3 mb-[1.1rem]">
            <h2 className="font-body text-[0.8rem] font-medium tracking-[0.02em] text-ink-faint whitespace-nowrap rtl:tracking-normal">{sec.title}</h2>
            <span className="flex-1 h-px bg-[color:var(--line-soft)]" aria-hidden="true" />
          </div>
          <ToolGrid tools={sec.tools} indexOf={indexOf} onNavigate={onNavigate} />
        </div>
      ))}
    </>
  )
}
