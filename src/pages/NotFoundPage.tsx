import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Tool } from '../tools/types'
import { liveTools } from '../tools'
import { Button } from '../components/ui'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { rankTools, slugToQuery } from '../lib/searchTools'
import { useLocale, localePath, localizeTool } from '../i18n'

interface Props {
  kind?: 'not-found' | 'coming-soon'
  tool?: Tool
}

export function NotFoundPage({ kind = 'not-found', tool }: Props) {
  const { locale, t } = useLocale()
  const { pathname } = useLocation()
  const soon = kind === 'coming-soon'
  const toolName = tool ? localizeTool(tool, locale).name : ''
  useDocumentMeta(locale, '', soon ? t.notFound.soonTitle(toolName) : t.notFound.title)

  /**
   * A wrong URL was a dead end: "not found", and a button back to a catalogue
   * of 211. The site carries a search scorer that answers exactly this, so the
   * last path segment is put through it.
   *
   * Measured before building it (`node evals/slugprobe.mjs`, 42 slugs a person
   * or a stale link would really produce): **92% correct top hit, 95% within
   * the top three, and 4 of 5 unanswerable slugs correctly silent.** Three are
   * shown rather than one — it buys 3pp, and more importantly a row of three
   * reads as a guess, which it is, where a single confident answer would not.
   *
   * The relevance floor does the withholding. It is the same floor the search
   * box uses, so a slug that means nothing here suggests nothing rather than
   * the best of a bad list.
   */
  const suggestions = useMemo(() => {
    if (soon) return []
    const slug = pathname.replace(/\/+$/, '').split('/').pop() ?? ''
    if (!slug || slug === locale) return []
    return rankTools(slugToQuery(slug), liveTools, locale).slice(0, 3)
  }, [pathname, locale, soon])

  return (
    <div className="mx-auto max-w-[40rem] px-[clamp(1.1rem,4vw,2.5rem)] text-center py-[clamp(4rem,12vw,8rem)]" data-testid="not-found">
      <p className="font-mono font-bold tracking-[0.2em] text-gold-500">{soon ? t.notFound.soonCode : t.notFound.code}</p>
      <h1 className="text-[clamp(2rem,6vw,3rem)] mt-[0.5rem]">
        {soon ? t.notFound.soonTitle(toolName) : t.notFound.title}
      </h1>
      <p className="text-ink-soft mx-auto mt-4 mb-8 text-[1.05rem]">{soon ? t.notFound.soonBody : t.notFound.body}</p>

      {suggestions.length > 0 && (
        <div className="mb-8" data-testid="nf-suggestions">
          <p className="text-[0.8rem] uppercase tracking-[0.06em] text-ink-faint mb-3 rtl:tracking-normal rtl:font-ar">{t.notFound.didYouMean}</p>
          <div className="grid gap-2 grid-cols-1 min-[560px]:grid-cols-3 text-start">
            {suggestions.map((s) => {
              const l = localizeTool(s, locale)
              return (
                <Link key={s.id} to={localePath(locale, `/apps/${s.id}`)} data-testid={`nf-suggest-${s.id}`}
                  className="flex flex-col gap-0.5 rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2 no-underline transition-[border-color] duration-150 hover:border-[color-mix(in_srgb,var(--green-500)_45%,transparent)]">
                  <span className="text-[0.9rem] font-medium text-ink rtl:font-ar">{l.name}</span>
                  <span className="text-[0.78rem] text-ink-faint rtl:font-ar line-clamp-2">{l.tagline}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <Button to={localePath(locale)} variant="primary">{t.notFound.back}</Button>
    </div>
  )
}
