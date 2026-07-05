import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from './ui'
import {
  useLocale, detectLocale, dicts, isHintDismissed, dismissHint,
  setStoredLocale, swapLocaleInPath,
} from '../i18n'

/**
 * If the visitor landed on one language but their browser prefers the other,
 * gently offer to switch. The popup is written in the *suggested* language.
 */
export function LanguageSuggestion() {
  const { locale } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const target = detectLocale()
  const [visible, setVisible] = useState(() => target !== locale && !isHintDismissed())

  if (!visible || target === locale) return null

  const s = dicts[target].langSuggest
  const dir = dicts[target].dir

  const switchLang = () => {
    setStoredLocale(target)
    dismissHint()
    navigate(swapLocaleInPath(location.pathname, target) + location.search)
  }
  const dismiss = () => {
    dismissHint()
    setVisible(false)
  }

  return (
    <div className="fixed end-5 bottom-5 z-[60] max-w-[min(92vw,340px)] bg-[var(--surface)] border border-[color:var(--line)] rounded-md shadow-lg px-[1.1rem] py-4 animate-[fadeUp_0.4s_ease_both] supports-[padding:env(safe-area-inset-bottom)]:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]" dir={dir} lang={target} role="dialog" aria-live="polite">
      <p className="text-[0.98rem] text-ink mb-[0.8rem]">{s.message}</p>
      <div className="flex gap-[0.6rem] items-center">
        <Button variant="primary" className="text-[0.9rem]" onClick={switchLang}>
          {s.switch}
        </Button>
        <button className="text-ink-faint font-semibold text-[0.88rem] px-[0.5rem] py-[0.4rem] rounded-sm hover:text-ink hover:bg-sand-100" onClick={dismiss}>{s.dismiss}</button>
      </div>
    </div>
  )
}
