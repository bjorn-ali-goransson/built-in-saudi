import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
    <div className="lang-hint" dir={dir} lang={target} role="dialog" aria-live="polite">
      <p className="lang-hint__msg">{s.message}</p>
      <div className="lang-hint__actions">
        <button className="btn btn--primary lang-hint__switch" onClick={switchLang}>
          {s.switch}
        </button>
        <button className="lang-hint__dismiss" onClick={dismiss}>{s.dismiss}</button>
      </div>
    </div>
  )
}
