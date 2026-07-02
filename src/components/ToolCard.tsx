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
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.8rem] font-bold text-[color-mix(in_srgb,var(--color-ink)_30%,transparent)] tracking-[0.05em]">{num}</span>
        {tool.status !== 'stable' && (
          <span className={`pill pill--${tool.status}`}>
            {comingSoon ? t.card.comingSoon : t.card.beta}
          </span>
        )}
      </div>

      <span
        className={`grid place-items-center w-[46px] h-[46px] rounded-[12px] mt-1 transition-[background,color] duration-200 [&_svg]:size-6 ${
          comingSoon
            ? 'bg-[color-mix(in_srgb,var(--color-ink)_6%,transparent)] text-ink-faint'
            : 'bg-[color-mix(in_srgb,var(--green-400)_12%,transparent)] text-green-600 group-hover:bg-green-600 group-hover:text-sand-100'
        }`}
        aria-hidden="true"
      >
        <Icon />
      </span>

      <h3 className={`text-[1.18rem] font-semibold mt-[0.35rem] ${comingSoon ? 'text-ink-faint' : ''}`}>{l.name}</h3>
      <p className="text-[0.92rem] text-ink-soft leading-[1.45] flex-1">{l.tagline}</p>

      <div className="flex items-center justify-between mt-[0.7rem] pt-[0.7rem] border-t border-[color:var(--line-soft)]">
        <span className="font-body text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{l.category}</span>
        {!comingSoon && (
          <span className="inline-flex items-center gap-[0.35rem] font-semibold text-[0.86rem] text-green-600">
            {t.card.open} <ArrowIcon className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-[3px] rtl:-scale-x-100" />
          </span>
        )}
      </div>
    </>
  )

  const base =
    'group tool-card relative flex flex-col gap-[0.55rem] pt-[1.35rem] px-[1.35rem] pb-[1.15rem] no-underline rounded-lg overflow-hidden isolate'

  if (comingSoon) {
    return (
      <div className={`${base} tool-card--soon bg-[color-mix(in_srgb,var(--sand-100)_60%,var(--surface))] border border-dashed border-[color:var(--line)] cursor-default`} aria-disabled="true">
        {inner}
      </div>
    )
  }

  const live =
    `${base} text-ink bg-[var(--surface)] border border-[color:var(--line-soft)] shadow-[var(--shadow-sm)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] hover:border-[color-mix(in_srgb,var(--green-500)_30%,transparent)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gold-400 before:origin-left before:scale-x-0 before:z-[2] before:transition-transform before:duration-300 hover:before:scale-x-100`

  if (tool.href) {
    return (
      <a className={live} href={tool.href} target="_blank" rel="noreferrer noopener">
        {inner}
      </a>
    )
  }

  return (
    <Link className={live} to={localePath(locale, `/tools/${tool.id}`)}>
      {inner}
    </Link>
  )
}
