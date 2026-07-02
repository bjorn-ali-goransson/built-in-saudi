import { Link } from 'react-router-dom'
import type { Tool } from '../tools/types'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localePath, localizeTool } from '../i18n'

interface Props {
  kind?: 'not-found' | 'coming-soon'
  tool?: Tool
}

export function NotFoundPage({ kind = 'not-found', tool }: Props) {
  const { locale, t } = useLocale()
  const soon = kind === 'coming-soon'
  const toolName = tool ? localizeTool(tool, locale).name : ''
  useDocumentMeta(locale, '', soon ? t.notFound.soonTitle(toolName) : t.notFound.title)

  return (
    <div className="wrap message-page">
      <p className="message-page__code">{soon ? t.notFound.soonCode : t.notFound.code}</p>
      <h1 className="message-page__title">
        {soon ? t.notFound.soonTitle(toolName) : t.notFound.title}
      </h1>
      <p className="message-page__body">{soon ? t.notFound.soonBody : t.notFound.body}</p>
      <Link to={localePath(locale)} className="btn btn--primary">{t.notFound.back}</Link>
    </div>
  )
}
