import { Link, useParams } from 'react-router-dom'
import { getTool } from '../tools'
import { useDocumentMeta } from '../lib/useDocumentMeta'
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

function LoadedTool({ tool }: { tool: NonNullable<ReturnType<typeof getTool>> }) {
  useDocumentMeta(tool.name, tool.description, `/tools/${tool.id}`)
  const ToolComponent = tool.component!
  const Icon = tool.Icon

  return (
    <div className="tool-page wrap">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Tools</Link>
        <span className="crumbs__sep">/</span>
        <span className="crumbs__here">{tool.name}</span>
      </nav>

      <header className="tool-head">
        <span className="tool-head__icon" aria-hidden="true"><Icon /></span>
        <div>
          <h1 className="tool-head__title">
            {tool.name}
            {tool.nameAr && <span className="tool-head__ar" lang="ar">{tool.nameAr}</span>}
          </h1>
          <p className="tool-head__desc">{tool.description}</p>
        </div>
      </header>

      <ToolComponent />
    </div>
  )
}
