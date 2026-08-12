import { inAppBrowser } from '../../lib/inAppBrowser'
import type { Locale } from '../../i18n'

/**
 * "You are inside an app's browser, and that is why this will not work."
 *
 * `lib/inAppBrowser.ts` was written for the CV optimizer, where an embedded
 * WebView cannot run pdf.js — and it had exactly ONE caller for its whole life
 * (`node evals/libreach.mjs`). Meanwhile **six surfaces call `loadGis`**: the
 * CV optimizer, the Arabic diacritizer, the link shortener, the prompt
 * analyzer, the to-do lists, and the **Privacy page's "delete my data"**.
 *
 * Google **refuses** OAuth in an embedded WebView — that is its stated
 * `disallowed_useragent` policy, not a capability gap we could work around — so
 * on five of those six the sign-in button was simply dead, with nothing on
 * screen saying why. The worst is the Privacy page: exercising your right to
 * have your data deleted is the one thing that must not fail silently, and a
 * privacy-first site is exactly the kind of link people open from a message.
 *
 * Two reasons, because they are two different facts and the fix differs:
 * `signin` is a refusal by Google, `pdf` is a WebView that cannot run the
 * reader. The escape hatch is the same, so it is written once.
 *
 * Renders NOTHING in an ordinary browser, which is what makes it safe to put on
 * every one of those surfaces.
 */
export function InAppNote({
  locale,
  reason = 'signin',
}: {
  locale: Locale
  reason?: 'signin' | 'pdf'
}) {
  const app = inAppBrowser()
  if (!app) return null

  const why =
    locale === 'ar'
      ? reason === 'pdf'
        ? `أنت داخل متصفح ${app}، الذي لا يستطيع قراءة ملفات PDF هنا.`
        : `أنت داخل متصفح ${app}، وجوجل لا تسمح بتسجيل الدخول داخل متصفحات التطبيقات.`
      : reason === 'pdf'
        ? `You’re in ${app}’s in-app browser, which can’t read PDFs here.`
        : `You’re in ${app}’s in-app browser, and Google does not allow signing in from one.`

  const how =
    locale === 'ar'
      ? 'افتح الصفحة في Safari أو Chrome — اضغط ⋯ (أو مشاركة) واختر «فتح في المتصفح».'
      : 'Open this page in Safari or Chrome — tap ⋯ (or Share) and choose “Open in browser”.'

  return (
    <div
      role="note"
      className="flex items-start gap-2 border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] ps-3 pe-3 py-2.5 rounded-e-md"
      data-testid="inapp-warn"
      data-reason={reason}
    >
      <span className="text-[0.85rem] text-ink leading-snug rtl:font-ar">
        {why} {how}
      </span>
    </div>
  )
}
