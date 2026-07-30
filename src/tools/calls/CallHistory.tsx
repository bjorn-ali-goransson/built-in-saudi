// Call history on the Calls start screen (#231): every call saved as its own entry
// alongside DM threads, kept on this device only (see src/lib/callHistory.ts). Clear
// one entry, or clear the lot.
import { PhoneIcon, TrashIcon } from '../../components/icons'
import { useCallHistory, type CallLog } from '../../lib/callHistory'
import type { Str } from './strings'

/** "3 min ago" / "yesterday" via Intl — no date library (mirrors MissedCalls). */
function ago(at: number, locale: 'en' | 'ar'): string {
  const mins = Math.round((at - Date.now()) / 60000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(mins) < 60) return rtf.format(Math.min(mins, 0), 'minute')
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}

/** A call's length as m:ss (or just seconds for a very short one), localised digits. */
function duration(ms: number, locale: 'en' | 'ar'): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const sec = total % 60
  const nf = new Intl.NumberFormat(locale)
  if (m === 0) return `${nf.format(sec)}s`
  return `${nf.format(m)}:${sec.toString().padStart(2, '0')}`
}

export function CallHistory({ locale, s }: { locale: 'en' | 'ar'; s: Str }) {
  const { history, remove, clear } = useCallHistory()
  if (!history.length) return null
  const sep = locale === 'ar' ? '، ' : ', '
  const who = (c: CallLog) => (c.names.length ? c.names.join(sep) : s.soloCall)
  return (
    <div className="w-full rounded-md border border-sand-100/25 bg-white/10 p-3 flex flex-col gap-2" data-testid="call-history">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.82rem] font-semibold text-sand-100 flex items-center gap-1.5">
          <PhoneIcon className="w-4 h-4" /> {s.recentCalls} · {history.length}
        </p>
        <button type="button" onClick={clear} data-testid="call-history-clear"
          className="inline-flex items-center gap-1 text-[0.75rem] text-sand-100/65 hover:text-sand-100 bg-transparent border-0 cursor-pointer [&_svg]:w-3.5 [&_svg]:h-3.5">
          <TrashIcon /> {s.clear}
        </button>
      </div>
      <ul className="flex flex-col gap-1 list-none p-0 m-0">
        {history.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-1 border-t border-sand-100/10 first:border-t-0" data-testid="call-history-row">
            <span className="min-w-0 flex-1 flex flex-col">
              <span className="truncate text-[0.85rem] text-sand-100"><bdi>{who(c)}</bdi></span>
              <span className="text-[0.7rem] text-sand-100/55">{ago(c.at, locale)} · {duration(c.end - c.at, locale)}</span>
            </span>
            <button type="button" onClick={() => remove(c.id)} title={s.dismiss} aria-label={s.dismiss} data-testid="call-history-remove"
              className="h-8 w-7 grid place-items-center rounded-md bg-transparent border-0 text-sand-100/50 hover:text-sand-100 cursor-pointer text-[0.95rem] leading-none">✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
