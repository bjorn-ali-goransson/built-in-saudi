import { Link } from 'react-router-dom'
import type { Tool } from '../tools/types'
import { ArrowIcon } from './icons'
import { useLocale, localePath, localizeTool } from '../i18n'

interface Props {
  tool: Tool
  index: number
}

export function ToolCard({ tool, index }: Props) {
  const { locale, t } = useLocale()
  const l = localizeTool(tool, locale)
  const num = String(index + 1).padStart(2, '0')
  const comingSoon = tool.status === 'coming-soon'
  const Icon = tool.Icon

  const inner = (
    <>
      <div className="tool-card__top">
        <span className="tool-card__num">{num}</span>
        {tool.status !== 'stable' && (
          <span className={`pill pill--${tool.status}`}>
            {comingSoon ? t.card.comingSoon : t.card.beta}
          </span>
        )}
      </div>

      <span className="tool-card__icon" aria-hidden="true">
        <Icon />
      </span>

      <h3 className="tool-card__name">{l.name}</h3>
      <p className="tool-card__tagline">{l.tagline}</p>

      <div className="tool-card__foot">
        <span className="tool-card__cat">{l.category}</span>
        {!comingSoon && (
          <span className="tool-card__go">
            {t.card.open} <ArrowIcon className="tool-card__arrow" />
          </span>
        )}
      </div>
    </>
  )

  if (comingSoon) {
    return (
      <div className="tool-card tool-card--soon" aria-disabled="true">
        {inner}
      </div>
    )
  }

  if (tool.href) {
    return (
      <a className="tool-card" href={tool.href} target="_blank" rel="noreferrer noopener">
        {inner}
      </a>
    )
  }

  return (
    <Link className="tool-card" to={localePath(locale, `/tools/${tool.id}`)}>
      {inner}
    </Link>
  )
}
