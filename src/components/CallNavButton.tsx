// Nav shortcut to Calls, shown only to someone who has published a personal "call
// me" link — for them Calls is a place they get reached, not just a tool they might
// open, so it earns a permanent spot (#220). Badged with unseen missed calls.
import { Link } from 'react-router-dom'
import { useLocale, localePath } from '../i18n'
import { PhoneIcon } from './icons'
import { getMyCallLink } from '../lib/callLink'
import { useMissedCalls } from '../lib/missedCalls'

export function CallNavButton() {
  const { locale } = useLocale()
  // Cheap synchronous read — no link, no button, no cost for everyone else.
  const has = (() => { try { return !!getMyCallLink() } catch { return false } })()
  const { missed } = useMissedCalls()
  if (!has) return null
  const n = missed.length
  const label = locale === 'ar'
    ? (n ? `المكالمات — ${n} مكالمة فائتة` : 'المكالمات')
    : (n ? `Calls — ${n} missed` : 'Calls')
  return (
    <Link
      to={localePath(locale, '/apps/calls')}
      aria-label={label} title={label} data-testid="nav-calls"
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-full border border-[color:var(--line)] text-ink-soft no-underline hover:text-green-700 hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] [&_svg]:w-[18px] [&_svg]:h-[18px]"
    >
      <PhoneIcon />
      {n > 0 && (
        <span
          data-testid="nav-calls-badge"
          className="absolute -top-1 -end-1 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full bg-[var(--danger)] text-white font-body text-[0.62rem] font-bold leading-none ring-2 ring-[var(--sand-50)]"
        >{n > 9 ? '9+' : n}</span>
      )}
    </Link>
  )
}
