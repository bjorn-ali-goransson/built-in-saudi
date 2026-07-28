// Everything the deploy auto-reload shows the user (#228).
//
// Two blocking states and one non-blocking one:
//  - checking   the version check is slow; stop input so nothing is typed into a
//               page that might be about to reload
//  - reloading  say why the page is going, rather than having it vanish mid-sentence
//  - offered    a new build exists but a tool is holding work — never take it, offer
//               it, and let the user pick the moment
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { useLocale } from '../i18n'
import { Spinner } from './ui'
import type { UpdateState } from '../lib/useVersionCheck'

const T = {
  en: {
    checking: 'Checking for updates…',
    checkingWhy: 'Controls are paused for a moment so nothing is lost if a new version loads.',
    reloading: 'Updating to the latest version…',
    reloadingWhy: 'The page is reloading so you get the new version.',
    offered: 'An update is ready',
    offeredWhy: 'You have unsaved work here, so we haven’t reloaded. Your files and text stay as they are until you choose.',
    reloadNow: 'Reload now',
    later: 'Not now',
  },
  ar: {
    checking: 'جارٍ التحقق من التحديثات…',
    checkingWhy: 'أُوقفت عناصر التحكم للحظة كي لا يضيع شيء إن حُمِّل إصدار جديد.',
    reloading: 'جارٍ التحديث إلى أحدث إصدار…',
    reloadingWhy: 'تُعاد الصفحة لتحصل على الإصدار الجديد.',
    offered: 'يوجد تحديث جاهز',
    offeredWhy: 'لديك عمل غير محفوظ هنا، لذا لم نُعِد التحميل. تبقى ملفاتك ونصوصك كما هي حتى تختار.',
    reloadNow: 'أعد التحميل الآن',
    later: 'ليس الآن',
  },
}

export function UpdateGate({ state }: { state: UpdateState }) {
  const { locale } = useLocale()
  const t = T[locale]
  const blocking = state.phase === 'checking' || state.phase === 'reloading'

  // While blocked, stop the page scrolling underneath — the overlay owns the screen.
  useEffect(() => {
    if (!blocking) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => { document.documentElement.style.overflow = prev }
  }, [blocking])

  if (state.phase === 'idle') return null

  // A new build is waiting but the user has work open. Docked to the bottom edge,
  // deliberately NOT blocking — they keep working until they're ready.
  if (state.phase === 'offered') {
    return createPortal(
      <div
        className="fixed inset-x-0 bottom-0 z-[75] bg-green-700 text-sand-100 px-4 py-3 flex items-center gap-3 flex-wrap shadow-[0_-4px_20px_rgba(18,33,27,0.2)]"
        role="status" data-testid="update-offered"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[0.95rem] font-semibold leading-tight">{t.offered}</p>
          <p className="text-[0.8rem] text-sand-100/80 leading-snug">{state.notes || t.offeredWhy}</p>
        </div>
        <button
          type="button" onClick={state.apply} data-testid="update-reload-now"
          className="h-9 px-3.5 rounded-md bg-sand-100 text-green-800 text-[0.85rem] font-semibold border-0 cursor-pointer hover:bg-white"
        >{t.reloadNow}</button>
      </div>,
      document.body,
    )
  }

  // Blocking. Deliberately DIMS the page rather than covering it: the point is that
  // a user can tell at a glance "the UI is greyed out" and report that — it's a
  // diagnostic signal for the update path, not just a spinner. The page stays
  // readable underneath so they can see WHERE they were.
  return createPortal(
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-[color-mix(in_srgb,var(--ink)_38%,transparent)] cursor-progress"
      role="alertdialog" aria-live="assertive" aria-busy="true"
      // Swallow anything aimed at the page underneath, so no control can be operated.
      onClickCapture={(e) => { e.preventDefault(); e.stopPropagation() }}
      onKeyDownCapture={(e) => { e.preventDefault(); e.stopPropagation() }}
      data-testid={state.phase === 'reloading' ? 'update-reloading' : 'update-checking'}
    >
      <div className="flex flex-col items-center gap-3 text-center px-6 py-5 rounded-lg bg-[var(--surface)] shadow-[var(--shadow-md)] max-w-[24rem] mx-4">
        <Spinner className="size-8" />
        <p className="text-[1.05rem] font-display text-ink leading-snug">
          {state.phase === 'reloading' ? t.reloading : t.checking}
        </p>
        <p className="text-[0.85rem] text-ink-faint leading-relaxed">
          {state.phase === 'reloading' ? t.reloadingWhy : t.checkingWhy}
        </p>
      </div>
    </div>,
    document.body,
  )
}
