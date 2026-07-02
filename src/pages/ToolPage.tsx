import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTool } from '../tools'
import type { Tool } from '../tools/types'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localePath, localizeTool } from '../i18n'
import { NotFoundPage } from './NotFoundPage'

// Show a tool's big header the first time; collapse it on later visits (app feel).
const SEEN_PREFIX = 'bis-seen-tool-'
function wasSeenTool(id: string): boolean {
  try { return localStorage.getItem(SEEN_PREFIX + id) === '1' } catch { return false }
}

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
  useDocumentMeta(locale, `/tools/${tool.id}`, l.name, l.description)

  const ToolComponent = tool.component!
  const Icon = tool.Icon
  // Show the "other language" name as a subtle accent next to the title.
  const accent = locale === 'ar' ? tool.name : tool.nameAr

  const [collapsed] = useState(() => wasSeenTool(tool.id))
  useEffect(() => {
    try { localStorage.setItem(SEEN_PREFIX + tool.id, '1') } catch { /* ignore */ }
  }, [tool.id])

  return (
    <div className="tool-page wrap">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to={localePath(locale)}>{t.toolPage.breadcrumb}</Link>
        <span className="crumbs__sep">/</span>
        <span className="crumbs__here">{l.name}</span>
      </nav>

      {collapsed ? (
        <header className="tool-head tool-head--compact">
          <span className="tool-head__icon" aria-hidden="true"><Icon /></span>
          <h1 className="tool-head__title">{l.name}</h1>
        </header>
      ) : (
        <header className="tool-head">
          <span className="tool-head__icon" aria-hidden="true"><Icon /></span>
          <div>
            <h1 className="tool-head__title">
              {l.name}
              {accent && (
                <span className="tool-head__ar" lang={locale === 'ar' ? 'en' : 'ar'}>{accent}</span>
              )}
            </h1>
            <p className="tool-head__desc">{l.description}</p>
          </div>
        </header>
      )}

      <ToolComponent />
    </div>
  )
}
