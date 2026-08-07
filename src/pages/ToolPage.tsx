import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getTool } from '../tools'
import type { Tool } from '../tools/types'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localizeTool } from '../i18n'
import { NotFoundPage } from './NotFoundPage'
import { recordRecent } from '../lib/recentTools'

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
  const { locale } = useLocale()
  const l = localizeTool(tool, locale)
  // The tool name now lives in the app-bar (Header); the page goes straight to the tool.
  useDocumentMeta(locale, `/apps/${tool.id}`, l.name, l.description)

  // Recorded here rather than on the card, so opening a tool by URL, from a
  // search result or from a link all count the same.
  useEffect(() => { recordRecent(tool.id) }, [tool.id])

  const ToolComponent = tool.component!
  return (
    <div className="wrap py-[clamp(1.5rem,4vw,2.5rem)] animate-[fadeUp_0.5s_ease_both]">
      <ToolComponent />
    </div>
  )
}
