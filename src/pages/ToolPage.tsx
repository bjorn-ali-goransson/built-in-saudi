import { Link, useParams } from 'react-router-dom'
import { getTool, tools } from '../tools'
import type { Tool } from '../tools/types'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localizeTool } from '../i18n'
import { liveToolSeo } from '../i18n/seo'
import { NotFoundPage } from './NotFoundPage'
import { LockIcon, ShieldIcon, BoltIcon } from '../components/icons'

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
  // The tool name now lives in the app-bar (Header); the page goes straight to the tool.
  useDocumentMeta(locale, `/apps/${tool.id}`, l.name, l.description)

  const ToolComponent = tool.component!
  
  const related = tools
    .filter((tl) => tl.id !== tool.id && tl.category === tool.category)
    .slice(0, 6)

  const seoData = liveToolSeo.find((x) => x.id === tool.id)?.[locale]
  const tr = t.toolPage.trust

  return (
    <>
      <div className="wrap py-[clamp(1.5rem,4vw,2.5rem)] animate-[fadeUp_0.5s_ease_both]">
        <h1 className="sr-only">{l.name}</h1>
        <ToolComponent />
      </div>

      {/* Rich SEO Content Section */}
      <section className="wrap max-w-3xl pb-16 pt-8 animate-[fadeUp_0.5s_ease_both_0.1s]">
        {seoData?.howItWorks && seoData.howItWorks.length > 0 && (
          <div className="mb-12">
            <h2 className="font-display font-semibold text-2xl mb-4 text-ink">{t.toolPage.howItWorks}</h2>
            <ol className="list-decimal list-inside space-y-3 text-ink-soft leading-relaxed">
              {seoData.howItWorks.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </div>
        )}

        {seoData?.features && seoData.features.length > 0 && (
          <div className="mb-12">
            <h2 className="font-display font-semibold text-2xl mb-4 text-ink">{t.toolPage.features}</h2>
            <ul className="list-disc list-inside space-y-3 text-ink-soft leading-relaxed">
              {seoData.features.map((feature, i) => <li key={i}>{feature}</li>)}
            </ul>
          </div>
        )}

        {seoData?.faq && seoData.faq.length > 0 && (
          <div className="mb-12">
            <h2 className="font-display font-semibold text-2xl mb-6 text-ink">{t.toolPage.faq}</h2>
            <div className="space-y-6">
              {seoData.faq.map((item, i) => (
                <div key={i}>
                  <h3 className="font-semibold text-lg text-ink mb-2">{item.q}</h3>
                  <p className="text-ink-soft leading-relaxed m-0">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Universal Trust Signals */}
      <section className="bg-[color:var(--surface)] border-t border-b border-[color:var(--line)] py-16 animate-[fadeUp_0.5s_ease_both_0.1s]">
        <div className="wrap">
          <h2 className="font-display font-bold text-2xl mb-10 text-center text-ink">{tr.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4">
                <LockIcon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-ink">{tr.clientSideTitle}</h3>
              <p className="text-ink-soft text-[0.95rem] leading-relaxed">{tr.clientSideDesc}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4">
                <BoltIcon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-ink">{tr.freeTitle}</h3>
              <p className="text-ink-soft text-[0.95rem] leading-relaxed">{tr.freeDesc}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4">
                <ShieldIcon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-ink">{tr.privacyTitle}</h3>
              <p className="text-ink-soft text-[0.95rem] leading-relaxed">{tr.privacyDesc}</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Related Tools */}
      {related.length > 0 && (
        <section className="wrap py-12 animate-[fadeUp_0.5s_ease_both_0.1s]">
          <h2 className="font-display font-semibold text-xl mb-6 text-ink">
            {t.toolPage.moreTools}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {related.map((rt) => {
              const rtl = localizeTool(rt, locale)
              return (
                <Link key={rt.id} to={`/${locale}/apps/${rt.id}`} className="block p-4 rounded-xl border border-[color:var(--line)] bg-[var(--surface)] hover:border-green-500 hover:shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] no-underline">
                  <div className="flex items-center gap-3 mb-2">
                    <rt.Icon className="w-[1.4rem] h-[1.4rem] text-green-600 flex-none" />
                    <h3 className="font-semibold text-[1.05rem] text-ink m-0">{rtl.name}</h3>
                  </div>
                  <p className="text-[0.9rem] text-ink-soft m-0 leading-relaxed">{rtl.tagline}</p>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}
