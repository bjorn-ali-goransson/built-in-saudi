import { useEffect } from 'react'

const ORIGIN = 'https://built-in-saudi.com'
const DEFAULT_TITLE = 'Built in Saudi — Free, honest online tools'
const DEFAULT_DESC =
  'A growing toolbox of fast, free, privacy-first utilities — no ads, no sign-ups, nothing uploaded. Everything runs in your browser. Proudly built in Saudi Arabia.'

function setMeta(selector: string, attr: string, value: string) {
  const el = document.querySelector(selector)
  if (el) el.setAttribute(attr, value)
}

/**
 * Update the document title, meta description and canonical URL for a page/tool.
 * `canonicalPath` should be an absolute path like "/" or "/tools/qr-code".
 */
export function useDocumentMeta(title?: string, description?: string, canonicalPath = '/') {
  useEffect(() => {
    document.title = title ? `${title} — Built in Saudi` : DEFAULT_TITLE
    setMeta('meta[name="description"]', 'content', description ?? DEFAULT_DESC)
    setMeta('link[rel="canonical"]', 'href', `${ORIGIN}${canonicalPath}`)
    setMeta('meta[property="og:url"]', 'content', `${ORIGIN}${canonicalPath}`)
    setMeta('meta[property="og:title"]', 'content', title ? `${title} — Built in Saudi` : DEFAULT_TITLE)

    return () => {
      document.title = DEFAULT_TITLE
      setMeta('meta[name="description"]', 'content', DEFAULT_DESC)
      setMeta('link[rel="canonical"]', 'href', `${ORIGIN}/`)
      setMeta('meta[property="og:url"]', 'content', `${ORIGIN}/`)
      setMeta('meta[property="og:title"]', 'content', DEFAULT_TITLE)
    }
  }, [title, description, canonicalPath])
}
