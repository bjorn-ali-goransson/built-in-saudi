import { Link, useParams } from 'react-router-dom'
import { getTool } from '../tools'
import type { Tool } from '../tools/types'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localePath, localizeTool } from '../i18n'
import { NotFoundPage } from './NotFoundPage'

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

  return (
    <div className="tool-page wrap">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to={localePath(locale)}>{t.toolPage.breadcrumb}</Link>
        <span className="crumbs__sep">/</span>
        <span className="crumbs__here">{l.name}</span>
      </nav>

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

      <ToolComponent />
    </div>
  )
}
