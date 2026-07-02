import { Navigate } from 'react-router-dom'
import { detectLocale, getStoredLocale } from '../i18n'

/**
 * Bare "/" entry point. Sends the visitor to their locale: a previously chosen
 * preference wins; otherwise we detect from the user agent (leaning English).
 */
export function RootRedirect() {
  const target = getStoredLocale() ?? detectLocale()
  return <Navigate to={`/${target}`} replace />
}
