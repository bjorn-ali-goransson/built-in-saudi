// Missed "call me" calls on the Calls setup screen (#210): who called while you
// didn't pick up, kept on this device only (see src/lib/missedCalls.ts). An entry
// whose caller asked to be called back (#211) gets a Call back button — it opens
// THEIR personal call link, so the roles simply swap.
import { PhoneIcon, TrashIcon } from '../../components/icons'
import { useMissedCalls, type MissedCall } from '../../lib/missedCalls'
import type { Str } from './strings'

/** "3 min ago" / "yesterday" via Intl — no date library. */
function ago(at: number, locale: 'en' | 'ar'): string {
  const mins = Math.round((at - Date.now()) / 60000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(mins) < 60) return rtf.format(Math.min(mins, 0), 'minute')
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}

export function MissedCalls({ locale, s }: { locale: 'en' | 'ar'; s: Str }) {
  const { missed, dismiss, clear } = useMissedCalls()
  if (!missed.length) return null

  // Their own call link (relative, so it works on any origin), with their name so
  // the call page says who we're ringing. We become the caller who waits; they host.
  function callBack(m: MissedCall) {
    if (!m.back) return
    window.location.assign(`/call/?c=${m.back}${m.name ? `&n=${encodeURIComponent(m.name)}` : ''}`)
  }

  return (
    <div className="w-full rounded-md border border-sand-100/25 bg-white/10 p-3 flex flex-col gap-2" data-testid="call-missed">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.82rem] font-semibold text-sand-100 flex items-center gap-1.5">
          <PhoneIcon className="w-4 h-4" /> {s.missedCalls} · {missed.length}
        </p>
        <button type="button" onClick={clear} data-testid="call-missed-clear"
          className="inline-flex items-center gap-1 text-[0.75rem] text-sand-100/65 hover:text-sand-100 bg-transparent border-0 cursor-pointer [&_svg]:w-3.5 [&_svg]:h-3.5">
          <TrashIcon /> {s.clear}
        </button>
      </div>
      <ul className="flex flex-col gap-1 list-none p-0 m-0">
        {missed.map((m) => (
          <li key={m.id} className="flex items-center gap-2 py-1 border-t border-sand-100/10 first:border-t-0" data-testid="call-missed-row">
            <span className="min-w-0 flex-1 flex flex-col">
              <span className="truncate text-[0.85rem] text-sand-100"><bdi>{m.name || '•'}</bdi></span>
              <span className="text-[0.7rem] text-sand-100/55">{ago(m.at, locale)}</span>
            </span>
            {m.back ? (
              <button type="button" onClick={() => callBack(m)} data-testid="call-missed-back"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-sand-100 text-green-900 text-[0.78rem] font-semibold border-0 cursor-pointer hover:bg-white [&_svg]:w-3.5 [&_svg]:h-3.5">
                <PhoneIcon /> {s.callBack}
              </button>
            ) : null}
            <button type="button" onClick={() => dismiss(m.id)} title={s.dismiss} aria-label={s.dismiss} data-testid="call-missed-dismiss"
              className="h-8 w-7 grid place-items-center rounded-md bg-transparent border-0 text-sand-100/50 hover:text-sand-100 cursor-pointer text-[0.95rem] leading-none">✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
