import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../i18n'
import { pushSupported, enablePush } from '../../lib/push'
import { savedPrayerLocation, geolocate, FALLBACK_LOC } from '../../lib/prayerLocation'
import { BellIcon, CogIcon } from '../../components/icons'
import { ADHKAR, type When } from './data'

const STR = {
  en: {
    morning: 'Morning', evening: 'Evening',
    lede: 'The core morning and evening remembrances from the Qur’an and authentic Sunnah. Tap the count button to track your repetitions — your progress is kept for today on this device.',
    times: (n: number) => `×${n}`, done: 'Done', reset: 'Reset', count: 'Count', overall: 'Progress',
    note: 'Arabic is the Qur’an/Sunnah text; transliteration and meaning were written for this app — verify before relying on them.',
    progress: (d: number, t: number) => `${d} / ${t}`,
    remind: 'Enable alerts', remindOn: 'Alerts on',
    remindErr: 'Couldn’t enable — allow notifications (and location).',
    remindTitle: 'Adhkār reminders',
    remindMorning: 'Morning adhkār', remindMorningHint: 'At sunrise',
    remindEvening: 'Evening adhkār', remindEveningHint: 'After Maghrib',
    turnOff: 'Turn off',
  },
  ar: {
    morning: 'الصباح', evening: 'المساء',
    lede: 'أذكار الصباح والمساء الأساسية من القرآن والسنة الصحيحة. اضغط زر العدّ لتتبّع التكرار — يُحفظ تقدّمك لهذا اليوم على جهازك.',
    times: (n: number) => `×${n}`, done: 'تمّ', reset: 'إعادة', count: 'عدّ', overall: 'التقدّم',
    note: 'النص العربي من القرآن والسنة؛ وكُتب النطق والمعنى الإنجليزي لهذا التطبيق — تحقّق قبل الاعتماد عليهما.',
    progress: (d: number, t: number) => `${d} / ${t}`,
    remind: 'تفعيل التنبيهات', remindOn: 'التنبيهات مفعّلة',
    remindErr: 'تعذّر التفعيل — اسمح بالإشعارات (والموقع).',
    remindTitle: 'تذكيرات الأذكار',
    remindMorning: 'أذكار الصباح', remindMorningHint: 'عند الشروق',
    remindEvening: 'أذكار المساء', remindEveningHint: 'بعد المغرب',
    turnOff: 'إيقاف',
  },
}

interface RemindPrefs { morning: boolean; evening: boolean }
function readRemind(): RemindPrefs {
  try {
    const raw = localStorage.getItem(REMIND_KEY)
    if (raw === '1') return { morning: true, evening: true } // legacy value
    if (raw) { const p = JSON.parse(raw); return { morning: !!p.morning, evening: !!p.evening } }
  } catch { /* ignore */ }
  return { morning: false, evening: false }
}
function saveRemind(p: RemindPrefs) { try { localStorage.setItem(REMIND_KEY, JSON.stringify(p)) } catch { /* ignore */ } }

const todayKey = () => new Date().toISOString().slice(0, 10)
const storeKey = (when: When) => `bis-adhkar-${todayKey()}-${when}`
const REMIND_KEY = 'bis-adhkar-remind'

function loadProgress(when: When): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(storeKey(when)) || '{}') } catch { return {} }
}

export default function AdhkarTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [when, setWhen] = useState<When>(() => (new Date().getHours() < 12 ? 'morning' : 'evening'))
  const [progress, setProgress] = useState<Record<string, number>>(() => loadProgress(when))

  const list = useMemo(() => ADHKAR.filter((d) => d.when === 'both' || d.when === when), [when])

  // Bottom bar is a scroll-spy: reflects how far through the list you've scrolled
  // (position), not how many you've completed.
  const [scrollPct, setScrollPct] = useState(0)
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = document.scrollingElement || document.documentElement
        const max = el.scrollHeight - el.clientHeight
        setScrollPct(max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [when, list.length])
  const spyPos = list.length ? Math.min(list.length, Math.max(1, Math.round((scrollPct / 100) * list.length))) : 0

  // Morning/evening adhkār reminders (a device push, shared with the prayer sub).
  const [remind, setRemind] = useState<RemindPrefs>(() => readRemind())
  const [remindBusy, setRemindBusy] = useState(false)
  const [remindErr, setRemindErr] = useState('')
  const [remindSettings, setRemindSettings] = useState(false)
  const remindOn = remind.morning || remind.evening

  // Subscribe with the given morning/evening flags (merge preserves prayer/Ḍuḥā
  // alerts). Optimistic; reverts if enabling fails (permission/location denied).
  async function applyRemind(p: RemindPrefs) {
    if (!pushSupported()) { setRemindErr(s.remindErr); return }
    const prev = remind
    setRemind(p); setRemindBusy(true); setRemindErr('')
    try {
      const loc = savedPrayerLocation() || await geolocate() || FALLBACK_LOC
      const r = await enablePush({ lat: loc.lat, lng: loc.lng, tz: loc.tz }, locale, { morningAdhkar: p.morning, eveningAdhkar: p.evening })
      if (r.status === 'ok' || (!p.morning && !p.evening)) saveRemind(p)
      else { setRemind(prev); setRemindErr(s.remindErr) }
    } catch { setRemind(prev); setRemindErr(s.remindErr) } finally { setRemindBusy(false) }
  }

  function switchWhen(w: When) { setWhen(w); setProgress(loadProgress(w)) }

  function tap(id: string, target: number) {
    setProgress((p) => {
      const cur = p[id] || 0
      const next = cur >= target ? 0 : cur + 1 // tapping a completed dhikr resets it
      const np = { ...p, [id]: next }
      try { localStorage.setItem(storeKey(when), JSON.stringify(np)) } catch { /* ignore */ }
      return np
    })
  }

  function resetAll() {
    setProgress({})
    try { localStorage.removeItem(storeKey(when)) } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-5 max-w-[46rem] mx-auto pb-16" data-testid="adhkar">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="seg" role="group" aria-label="time">
          {(['morning', 'evening'] as ('morning' | 'evening')[]).map((w) => (
            <button key={w} className={`seg__btn ${when === w ? 'is-active' : ''}`} aria-pressed={when === w}
              data-testid={`adhkar-${w}`} onClick={() => switchWhen(w)}>{s[w]}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {pushSupported() && (
            <button className={`pill ${remindOn ? 'pill--accent' : ''}`} data-testid="adhkar-remind"
              disabled={remindBusy} aria-pressed={remindOn}
              onClick={() => (remindOn ? setRemindSettings(true) : applyRemind({ morning: true, evening: true }))}>
              {remindOn ? <CogIcon /> : <BellIcon />} {remindOn ? s.remindOn : s.remind}
            </button>
          )}
          <button className="pill" data-testid="adhkar-reset" onClick={resetAll}>{s.reset}</button>
        </div>
      </div>
      {remindErr && <p className="text-[0.8rem] text-[color:var(--danger)]">{remindErr}</p>}

      <ol className="list-none ps-0 m-0 flex flex-col gap-3">
        {list.map((d) => {
          const cur = progress[d.id] || 0
          const done = cur >= d.count
          const pct = Math.min(100, Math.round((cur / d.count) * 100))
          return (
            <li key={d.id}>
              <div
                className={`border rounded-md bg-[var(--surface)] p-4 flex flex-col gap-3 transition-[border-color,opacity] duration-150 ${done ? 'border-green-600 opacity-70' : 'border-[color:var(--line-soft)]'}`}
              >
                <div className="flex items-center justify-end">
                  <span className="text-[0.75rem] font-semibold text-ink-faint tabular-nums">{s.times(d.count)}</span>
                </div>
                <p dir="rtl" lang="ar" className="font-ar text-[1.4rem] leading-[2] text-ink">{d.ar}</p>

                {d.count > 1 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-sand-200 overflow-hidden">
                      <div className="h-full bg-green-600 rounded-full transition-[width] duration-200" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="tabular-nums text-[0.8rem] font-semibold text-ink-soft flex-none">{s.progress(cur, d.count)}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {locale !== 'ar' && <p className="text-[0.9rem] text-ink-soft italic leading-relaxed">{d.translit}</p>}
                  {locale !== 'ar' && <p className="text-[0.9rem] text-ink leading-relaxed">{d.en}</p>}
                  <p className="text-[0.78rem] text-ink-faint">{d.ref}</p>
                </div>

                <button
                  onClick={() => tap(d.id, d.count)}
                  data-testid={`dhikr-${d.id}`}
                  aria-label={`${s.count} — ${s.progress(cur, d.count)}`}
                  className={`self-center px-8 py-2.5 mt-1 rounded-full text-[1rem] font-semibold border transition-[background,color,border-color] duration-150 ${done
                    ? 'bg-sand-100 text-ink-faint border-[color:var(--line-soft)]'
                    : 'bg-[color-mix(in_srgb,var(--green-400)_14%,transparent)] text-green-700 border-[color-mix(in_srgb,var(--green-500)_35%,transparent)] hover:bg-green-600 hover:text-sand-100'}`}
                >
                  {done ? s.done : s.count}
                </button>
              </div>
            </li>
          )
        })}
      </ol>

      {locale !== 'ar' && <p className="text-[0.78rem] text-ink-faint">{s.note}</p>}

      {/* Reminder settings — same bottom-sheet as Prayer Times, opened by the cog. */}
      {remindSettings && createPortal(
        <div className="sheet-overlay" role="dialog" aria-modal="true" data-testid="adhkar-remind-settings" onClick={() => setRemindSettings(false)}>
          <div className="sheet" dir={locale === 'ar' ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
            <span className="sheet__grip" aria-hidden="true" />
            <h3 className="sheet__title">{s.remindTitle}</h3>

            <label className="pray__set-row">
              <span className="pray__set-label">{s.remindMorning}<small>{s.remindMorningHint}</small></span>
              <input type="checkbox" className="pray__check" checked={remind.morning} disabled={remindBusy} data-testid="adhkar-set-morning"
                onChange={(e) => applyRemind({ ...remind, morning: e.target.checked })} />
            </label>

            <label className="pray__set-row">
              <span className="pray__set-label">{s.remindEvening}<small>{s.remindEveningHint}</small></span>
              <input type="checkbox" className="pray__check" checked={remind.evening} disabled={remindBusy} data-testid="adhkar-set-evening"
                onChange={(e) => applyRemind({ ...remind, evening: e.target.checked })} />
            </label>

            {remindErr && <p className="text-[0.8rem] text-[color:var(--danger)]">{remindErr}</p>}

            <div className="sheet__actions">
              <button className="btn" data-testid="adhkar-set-off" disabled={remindBusy}
                onClick={() => { applyRemind({ morning: false, evening: false }); setRemindSettings(false) }}>{s.turnOff}</button>
              <button className="btn btn--primary" data-testid="adhkar-set-done" onClick={() => setRemindSettings(false)}>{s.done}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Persistent, edge-docked scroll-spy — how far through the list you are.
          Portaled to <body> so it stays viewport-fixed (the tool page's fadeUp
          animation leaves a transform that would otherwise capture `fixed`). */}
      {createPortal(
        <div className="fixed inset-x-0 bottom-0 z-40 bg-[var(--surface)] border-t border-[color:var(--line)] shadow-[0_-2px_10px_color-mix(in_srgb,var(--ink)_8%,transparent)]"
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          role="progressbar" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={spyPos}
          aria-label={s.overall} data-testid="adhkar-overall">
          <div className="max-w-[46rem] mx-auto px-4 py-2.5 flex items-center gap-3">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-faint rtl:tracking-normal flex-none">{s.overall}</span>
            <div className="flex-1 h-2 rounded-full bg-sand-200 overflow-hidden">
              <div className="h-full bg-green-600 rounded-full transition-[width] duration-150" style={{ width: `${scrollPct}%` }} />
            </div>
            <span className="tabular-nums text-[0.82rem] font-semibold text-ink-soft flex-none">{s.progress(spyPos, list.length)}</span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
