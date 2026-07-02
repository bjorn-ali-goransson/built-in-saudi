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
    <div className="mx-auto max-w-[40rem] px-[clamp(1.1rem,4vw,2.5rem)] text-center py-[clamp(4rem,12vw,8rem)]">
      <p className="font-mono font-bold tracking-[0.2em] text-gold-500">{soon ? t.notFound.soonCode : t.notFound.code}</p>
      <h1 className="text-[clamp(2rem,6vw,3rem)] mt-[0.5rem]">
        {soon ? t.notFound.soonTitle(toolName) : t.notFound.title}
      </h1>
      <p className="text-ink-soft mx-auto mt-4 mb-8 text-[1.05rem]">{soon ? t.notFound.soonBody : t.notFound.body}</p>
      <Link to={localePath(locale)} className="btn btn--primary">{t.notFound.back}</Link>
    </div>
  )
}
