import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../i18n'
import { Seg, SegButton } from '../../components/ui'
import { CopyIcon, CheckIcon, RefreshIcon } from '../../components/icons'
import { STEPS, type Rite, type Level, type Step } from './data'

const STR = {
  en: {
    umrah: 'ʿUmrah', hajj: 'Ḥajj',
    obligatory: 'Obligatory', recommended: 'Recommended',
    lede: {
      umrah: 'The rite of ʿUmrah, step by step — each act with its supplication and its fiqh ruling. Tap a step to mark it done; your progress is kept on this device. Switch to “Obligatory” to see only the pillars and duties, or “Recommended” for the full guide with the sunan.',
      hajj: 'The rite of Ḥajj, day by day (following the tamattuʿ many pilgrims perform — do ʿUmrah first). Tap a step to mark it done. Switch to “Obligatory” for just the pillars and duties, or “Recommended” for the full guide with the sunan.',
    },
    dua: 'Supplication', copy: 'Copy', copied: 'Copied',
    reset: 'Reset', progress: 'Progress', count: (d: number, t: number) => `${d} / ${t}`,
    note: 'A study aid, not a fatwā. The rulings (rukn / wājib / sunnah) follow the manāsik of Shaykh Ibn Bāz and the fatwās of the Permanent Committee; the procedure follows the Saudi Ministry of Ḥajj & ʿUmrah. The Arabic supplications are the Qur’ān/Sunnah text; the transliteration and meanings were written for this app. Follow a trustworthy scholar or an official guide for your Ḥajj.',
    sources: 'Sources',
  },
  ar: {
    umrah: 'العمرة', hajj: 'الحج',
    obligatory: 'الأركان والواجبات', recommended: 'مع المستحبات',
    lede: {
      umrah: 'مناسك العمرة خطوةً بخطوة — كل عمل مع دعائه وحكمه الفقهي. اضغط الخطوة لتعليمها كمنجزة؛ ويُحفظ تقدّمك على جهازك. اختر «الأركان والواجبات» لعرض الفرائض فقط، أو «مع المستحبات» للدليل كاملًا مع السنن.',
      hajj: 'مناسك الحج يومًا بيوم (على صفة التمتّع التي يؤدّيها كثير من الحجاج — تُقدَّم العمرة أولًا). اضغط الخطوة لتعليمها كمنجزة. اختر «الأركان والواجبات» للفرائض فقط، أو «مع المستحبات» للدليل كاملًا مع السنن.',
    },
    dua: 'الدعاء', copy: 'نسخ', copied: 'تم النسخ',
    reset: 'تصفير', progress: 'التقدّم', count: (d: number, t: number) => `${d} / ${t}`,
    note: 'هذا دليل للتعلّم لا فتوى. الأحكام (ركن / واجب / سنة) على منسك الشيخ ابن باز وفتاوى اللجنة الدائمة، والصفة العملية على دليل وزارة الحج والعمرة. والنص العربي للأدعية من القرآن والسنة، وكُتبت الترجمة والنطق لهذا التطبيق. اتّبع في حجّك عالِمًا موثوقًا أو مرشدًا رسميًّا.',
    sources: 'المصادر',
  },
}

// KSA-aligned references: the fiqh classifications follow the manāsik of the
// late Grand Mufti Shaykh Ibn Bāz (the rulings the Saudi religious establishment
// distributes); the procedure follows the Ministry of Ḥajj & ʿUmrah.
const SOURCES: { href: string; en: string; ar: string }[] = [
  { href: 'https://binbaz.org.sa/fatwas/14833/', en: 'Ibn Bāz — Pillars & obligations of Ḥajj', ar: 'ابن باز — أركان الحج وواجباته' },
  { href: 'https://binbaz.org.sa/fatwas/11982/', en: 'Ibn Bāz — The description of ʿUmrah', ar: 'ابن باز — صفة العمرة' },
  { href: 'https://binbaz.org.sa/fatwas/15743/', en: 'Ibn Bāz — Saʿy is a pillar of Ḥajj & ʿUmrah', ar: 'ابن باز — السعي ركن من أركان الحج والعمرة' },
  { href: 'https://haj.gov.sa/en/Guides', en: 'Ministry of Ḥajj & ʿUmrah — official pilgrim guides', ar: 'وزارة الحج والعمرة — أدلة المناسك الرسمية' },
]

const storeKey = (rite: Rite) => `bis-hajj-${rite}`
function loadDone(rite: Rite): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(storeKey(rite)) || '{}') } catch { return {} }
}

export default function HajjUmrahTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [rite, setRite] = useState<Rite>('umrah')
  const [level, setLevel] = useState<Level>('recommended')
  const [done, setDone] = useState<Record<string, boolean>>(() => loadDone('umrah'))

  // Obligatory = arkān + wājibāt only; Recommended shows everything (the sunan
  // don't stand alone — they sit between the obligations).
  const list = useMemo(
    () => STEPS.filter((st) => st.rite === rite && (level === 'recommended' || st.level === 'obligatory')),
    [rite, level],
  )
  const doneCount = list.reduce((n, st) => n + (done[st.id] ? 1 : 0), 0)
  const pct = list.length ? Math.round((doneCount / list.length) * 100) : 0
  const anyDone = doneCount > 0

  // Per-phase completion (shown next to each day/phase heading).
  const phaseStats = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>()
    for (const st of list) {
      const key = st.phase ? st.phase[locale] : ''
      if (!key) continue
      const cur = m.get(key) || { done: 0, total: 0 }
      cur.total++
      if (done[st.id]) cur.done++
      m.set(key, cur)
    }
    return m
  }, [list, done, locale])

  function switchRite(r: Rite) { setRite(r); setDone(loadDone(r)) }

  function toggle(id: string) {
    setDone((d) => {
      const nd = { ...d, [id]: !d[id] }
      try { localStorage.setItem(storeKey(rite), JSON.stringify(nd)) } catch { /* ignore */ }
      return nd
    })
  }

  function reset() {
    setDone({})
    try { localStorage.removeItem(storeKey(rite)) } catch { /* ignore */ }
  }

  let lastPhase = ''

  return (
    <div className="flex flex-col gap-5 max-w-[46rem] mx-auto pb-16" data-testid="hajj-umrah">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Seg role="group" aria-label="rite">
          {(['umrah', 'hajj'] as Rite[]).map((r) => (
            <SegButton key={r} active={rite === r} aria-pressed={rite === r}
              data-testid={`rite-${r}`} onClick={() => switchRite(r)}>{s[r]}</SegButton>
          ))}
        </Seg>
        <Seg role="group" aria-label="level">
          {(['obligatory', 'recommended'] as Level[]).map((l) => (
            <SegButton key={l} active={level === l} aria-pressed={level === l}
              data-testid={`level-${l}`} onClick={() => setLevel(l)}>{s[l]}</SegButton>
          ))}
        </Seg>
      </div>

      <p className="text-[0.9rem] text-ink-soft leading-relaxed">{s.lede[rite]}</p>

      <ol className="list-none ps-0 m-0 flex flex-col gap-3">
        {list.map((st) => {
          const phase = st.phase ? st.phase[locale] : ''
          const showPhase = phase && phase !== lastPhase
          const stat = showPhase ? phaseStats.get(phase) : undefined
          if (phase) lastPhase = phase
          return (
            <li key={st.id} className="flex flex-col gap-3">
              {showPhase && (
                <div className="flex items-baseline justify-between gap-3 mt-2 pb-1.5 border-b border-[color:var(--line-soft)]">
                  <h2 className="font-display text-[0.95rem] text-ink-soft m-0">{phase}</h2>
                  {stat && (
                    <span className="tabular-nums text-[0.72rem] font-semibold text-ink-faint flex-none">{s.count(stat.done, stat.total)}</span>
                  )}
                </div>
              )}
              <StepCard step={st} done={!!done[st.id]} onToggle={() => toggle(st.id)} locale={locale} s={s} />
            </li>
          )
        })}
      </ol>

      <p className="text-[0.78rem] text-ink-faint">{s.note}</p>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink-faint rtl:tracking-normal m-0">{s.sources}</h2>
        <ul className="list-none ps-0 m-0 flex flex-col gap-1">
          {SOURCES.map((src) => (
            <li key={src.href}>
              <a href={src.href} target="_blank" rel="noopener noreferrer"
                className="text-[0.8rem] text-green-600 underline decoration-[color:var(--line)] underline-offset-2 hover:decoration-current">
                {src[locale]}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Persistent, edge-docked completion bar — how many steps you've marked
          done in the current view. Portaled to <body> so it stays viewport-fixed
          (the tool page's fadeUp transform would otherwise capture `fixed`). */}
      {createPortal(
        <div className="fixed inset-x-0 bottom-0 z-40 bg-[var(--surface)] border-t border-[color:var(--line)] shadow-[0_-2px_10px_color-mix(in_srgb,var(--ink)_8%,transparent)]"
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          role="progressbar" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={doneCount}
          aria-label={s.progress} data-testid="hajj-overall">
          <div className="max-w-[46rem] mx-auto px-4 py-2.5 flex items-center gap-3">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-faint rtl:tracking-normal flex-none">{s.progress}</span>
            <div className="flex-1 h-2 rounded-full bg-sand-200 overflow-hidden">
              <div className="h-full bg-green-600 rounded-full transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular-nums text-[0.82rem] font-semibold text-ink-soft flex-none">{s.count(doneCount, list.length)}</span>
            <button type="button" onClick={reset} disabled={!anyDone} data-testid="hajj-reset"
              aria-label={s.reset} title={s.reset}
              className="flex-none flex items-center justify-center w-8 h-8 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft disabled:opacity-40 disabled:cursor-default enabled:hover:text-ink">
              <RefreshIcon />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function StepCard({ step, done, onToggle, locale, s }: {
  step: Step; done: boolean; onToggle: () => void; locale: 'en' | 'ar'; s: typeof STR['en']
}) {
  const obligatory = step.level === 'obligatory'
  const [copied, setCopied] = useState(false)

  async function copyDua(e: React.MouseEvent) {
    e.stopPropagation()
    if (!step.dua) return
    try { await navigator.clipboard.writeText(step.dua.ar); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* ignore */ }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`step-${step.id}`}
      aria-pressed={done}
      aria-label={step.title[locale]}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      className={`rounded-md bg-[var(--surface)] p-4 flex flex-col gap-3 cursor-pointer select-none border-2 transition-[border-color,opacity] duration-150 ${done ? 'border-[color:var(--line-soft)] opacity-60' : 'border-green-600'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Tick box mirrors the done state at a glance. */}
          <span aria-hidden="true" className={`w-5 h-5 rounded-sm border flex-none flex items-center justify-center ${done ? 'bg-green-600 border-green-600 text-sand-100' : 'border-[color:var(--line)]'}`}>
            {done && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            )}
          </span>
          <h3 className="font-display text-[1.05rem] text-ink m-0 truncate">{step.title[locale]}</h3>
        </div>
        <span className={`font-mono text-[0.62rem] font-semibold tracking-[0.06em] uppercase px-[0.5rem] py-[0.2rem] rounded-full flex-none rtl:tracking-normal ${obligatory ? 'bg-[color-mix(in_srgb,var(--color-green-400)_20%,transparent)] text-green-600' : 'bg-[color-mix(in_srgb,var(--color-gold-400)_22%,transparent)] text-gold-500'}`}>
          {step.tag[locale]}
        </span>
      </div>

      <p className="text-[0.92rem] text-ink-soft leading-relaxed m-0">{step.body[locale]}</p>

      {step.dua && (
        <div className="rounded-sm bg-[color-mix(in_srgb,var(--color-green-400)_8%,transparent)] border border-[color:var(--line-soft)] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-ink-faint rtl:tracking-normal">{s.dua}</span>
            <button type="button" onClick={copyDua} data-testid={`dua-copy-${step.id}`}
              aria-label={s.copy} className="flex items-center gap-1 text-[0.72rem] font-semibold text-ink-faint hover:text-ink">
              {copied ? <CheckIcon /> : <CopyIcon />} {copied ? s.copied : s.copy}
            </button>
          </div>
          <p dir="rtl" lang="ar" className="font-ar text-[1.3rem] leading-[2] text-ink m-0">{step.dua.ar}</p>
          {locale !== 'ar' && <p className="text-[0.85rem] text-ink-soft italic leading-relaxed m-0">{step.dua.translit}</p>}
          {locale !== 'ar' && <p className="text-[0.85rem] text-ink leading-relaxed m-0">{step.dua.en}</p>}
        </div>
      )}
    </div>
  )
}
