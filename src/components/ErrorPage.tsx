import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router-dom'
import { useLocale, localePath } from '../i18n'

const T = {
  en: {
    title: 'Something went wrong',
    body: 'The page hit an unexpected error. Reloading usually fixes it.',
    reload: 'Reload', home: 'Back to the toolbox',
  },
  ar: {
    title: 'حدث خطأ ما',
    body: 'واجهت الصفحة خطأً غير متوقع. عادةً ما تُصلح إعادة التحميل هذا.',
    reload: 'إعادة التحميل', home: 'العودة إلى صندوق الأدوات',
  },
}

// A tool chunk can 404 after a redeploy (its hashed filename changed). Detect
// that and reload once to fetch the fresh build.
function isStaleChunk(msg: string): boolean {
  return /dynamically imported module|Failed to fetch|Loading chunk|ChunkLoadError|error loading dynamically/i.test(msg)
}

export function ErrorPage() {
  const error = useRouteError()
  const { locale } = useLocale()
  const t = T[locale]
  const msg = error instanceof Error ? error.message : String(error ?? '')

  useEffect(() => {
    if (isStaleChunk(msg) && sessionStorage.getItem('bis-chunk-reload') !== '1') {
      sessionStorage.setItem('bis-chunk-reload', '1') // guard against reload loops
      sessionStorage.setItem('bis-reloaded', 'update')
      window.location.reload()
    }
  }, [msg])

  return (
    <div className="wrap message-page" data-testid="error-page">
      <p className="message-page__code">⚠</p>
      <h1 className="message-page__title">{t.title}</h1>
      <p className="message-page__body">{t.body}</p>
      <div className="message-page__actions">
        <button className="btn btn--primary" data-testid="error-reload"
          onClick={() => window.location.reload()}>{t.reload}</button>
        <Link to={localePath(locale)} className="btn">{t.home}</Link>
      </div>
    </div>
  )
}
