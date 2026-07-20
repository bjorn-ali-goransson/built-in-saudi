// The "call me" personal-link UI for the Calls setup screen (dark green bg), plus
// the incoming-call remove affordance. Anonymous: claiming subscribes this device
// to push and registers a code; the link is built-in-saudi.com/call/<code>. See
// src/lib/callLink.ts + functions/call.js.
import { useState } from 'react'
import { PhoneIcon, CopyIcon, CheckIcon, TrashIcon, ShareIcon } from '../../components/icons'
import { pushSupported } from '../../lib/push'
import { claimCallLink, deleteCallLink, getMyCallLink } from '../../lib/callLink'
import { makeCallLinkImage } from './invite'

const T = {
  en: {
    heading: 'Your personal call link', get: 'Get a link to be called', getting: 'Setting up…',
    blurb: 'Share one link and people can call you right here — your device gets a notification to answer, even when this tab is closed.',
    permNote: 'You’ll be asked to allow notifications — that’s how your device rings when someone calls.',
    denied: 'Notifications are blocked — allow them in your browser settings, then try again.',
    failed: 'Couldn’t set up the link. Try again.',
    copy: 'Copy', copied: 'Copied', share: 'Share', shareText: 'Call me on Built in Saudi',
    includeName: 'include name in call',
    codeTip: 'Your private link code — anyone who has it can call you, so share it only with people you trust.',
    nameTip: 'Your name, shown to whoever opens the link. Untick “include name in call” to leave it out.',
    expires: '(Expires in 6 months)',
    remove: 'Unpublish link', removing: 'Removing…', removed: 'Removed — people can no longer call you on this link.',
    incoming: 'Incoming call', notYou: 'Not you? Stop receiving calls on this link',
  },
  ar: {
    heading: 'رابط اتصالك الشخصي', get: 'احصل على رابط ليتصلوا بك', getting: 'جارٍ الإعداد…',
    blurb: 'شارك رابطًا واحدًا ليتصل بك الناس هنا مباشرةً — يصل جهازك إشعار للرد، حتى عندما تكون هذه النافذة مغلقة.',
    permNote: 'سيُطلب منك السماح بالإشعارات — بها يرنّ جهازك عند اتصال أحد.',
    denied: 'الإشعارات محظورة — فعّلها من إعدادات المتصفح ثم أعد المحاولة.',
    failed: 'تعذّر إعداد الرابط. حاول مرة أخرى.',
    copy: 'نسخ', copied: 'تم النسخ', share: 'مشاركة', shareText: 'اتصل بي عبر Built in Saudi',
    includeName: 'أدرج الاسم في المكالمة',
    codeTip: 'رمز رابطك الخاص — أي شخص يملكه يستطيع الاتصال بك، فشاركه فقط مع من تثق بهم.',
    nameTip: 'اسمك، ويظهر لمن يفتح الرابط. أزل تحديد «أدرج الاسم في المكالمة» لإخفائه.',
    expires: '(تنتهي خلال ٦ أشهر)',
    remove: 'إلغاء نشر الرابط', removing: 'جارٍ الإزالة…', removed: 'تمت الإزالة — لم يعد بإمكان أحد الاتصال بك عبر هذا الرابط.',
    incoming: 'مكالمة واردة', notYou: 'لست أنت؟ أوقف تلقّي المكالمات على هذا الرابط',
  },
}

const box = 'w-full rounded-md border border-sand-100/25 bg-white/10 p-3 flex flex-col gap-2'
const chip = 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-white/10 hover:bg-white/20 border border-sand-100/25 text-sand-100 text-[0.85rem] font-medium cursor-pointer transition-colors [&_svg]:w-4 [&_svg]:h-4 disabled:opacity-60'

/** The setup-screen panel: claim / show / remove your personal call link. Hidden
 *  entirely where Web Push can't work (no point offering it). */
export function CallLinkPanel({ locale, name, site, onLinkChange }: { locale: 'en' | 'ar'; name: string; site: string; onLinkChange?: (has: boolean) => void }) {
  const t = T[locale]
  const [code, setCode] = useState(() => getMyCallLink()?.code || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [withName, setWithName] = useState(true) // include the name in the share image
  if (!pushSupported()) return null
  // /call/?c=<code> (not /call/<code>) so the shared link resolves to the one
  // prerendered /call/ page that carries a readable link preview. When the name is
  // included, it rides in the URL too (&n=) so the caller's join screen greets them
  // by name — and it goes into the QR image the same way.
  const base = code ? `${site}/call/?c=${code}` : ''
  const url = base && withName && name ? `${base}&n=${encodeURIComponent(name)}` : base
  // Display copy: zero-width spaces before "?" and after "&" give clean wrap points.
  // Shown non-selectable so nobody hand-copies the ZWSP-laced text — use Copy.
  const ZWS = String.fromCharCode(0x200b) // zero-width space: an invisible wrap point

  async function claim() {
    setBusy(true); setErr('')
    const c = await claimCallLink(name || 'Me')
    setBusy(false)
    if (!c) { setErr(typeof Notification !== 'undefined' && Notification.permission === 'denied' ? t.denied : t.failed); return }
    setCode(c); onLinkChange?.(true)
  }
  async function remove() {
    const mine = getMyCallLink()
    setBusy(true)
    if (mine) await deleteCallLink(mine.code, mine.endpoint)
    setBusy(false); setCode(''); onLinkChange?.(false)
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ }
  }
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  async function share() {
    // Share a QR image (+ optional name + the URL) so it embeds nicely in chat
    // apps; fall back to a plain URL share where files aren't supported.
    try {
      const blob = await makeCallLinkImage(url, withName ? name : '', locale === 'ar')
      const file = new File([blob], 'call-me.png', { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean }
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: url } as ShareData)
        return
      }
    } catch { /* fall through */ }
    try { await navigator.share({ title: t.shareText, text: t.shareText, url }) } catch { /* cancelled / unsupported */ }
  }

  return (
    <>
      <div className={box} data-testid="call-link-panel">
      {!code ? (
        <>
          <p className="text-[0.82rem] leading-relaxed text-sand-100/80">{t.blurb}</p>
          <button type="button" className={chip} onClick={claim} disabled={busy} data-testid="call-link-get">
            <PhoneIcon /> {busy ? t.getting : t.get}
          </button>
          <p className="text-[0.72rem] text-sand-100/60" data-testid="call-link-perm">{t.permNote}</p>
          {err && <p className="text-[0.78rem] text-[var(--gold-400)]" data-testid="call-link-err">{err}</p>}
        </>
      ) : (
        <>
          {/* URL: non-selectable (invisible wrap points), with the copy icon inset and
              the code + name values highlighted with an explanatory tooltip. */}
          <div className="relative">
            <div className="select-none [overflow-wrap:anywhere] text-[0.82rem] font-mono text-sand-100 bg-black/20 rounded px-2 py-1.5 pe-9" data-testid="call-link-url">
              <span>{site}/call/{ZWS}?c=</span>
              <span className="rounded-[3px] px-0.5 bg-[color-mix(in_srgb,var(--gold-500)_38%,transparent)] cursor-help" title={t.codeTip} data-testid="call-link-seg-code">{code}</span>
              {withName && name && (
                <>
                  <span>&{ZWS}n=</span>
                  <span className="rounded-[3px] px-0.5 bg-[color-mix(in_srgb,var(--gold-500)_38%,transparent)] cursor-help" title={t.nameTip} data-testid="call-link-seg-name">{encodeURIComponent(name)}</span>
                </>
              )}
            </div>
            <button type="button" onClick={copy} title={copied ? t.copied : t.copy} aria-label={copied ? t.copied : t.copy} data-testid="call-link-copy"
              className="absolute bottom-1 end-1 h-7 w-7 grid place-items-center rounded-md bg-transparent border-0 text-sand-100/70 hover:text-sand-100 cursor-pointer [&_svg]:w-4 [&_svg]:h-4">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canShare && (
              <button type="button" onClick={share} data-testid="call-link-share"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-sand-100 text-green-900 text-[0.85rem] font-semibold cursor-pointer hover:bg-white [&_svg]:w-4 [&_svg]:h-4">
                <ShareIcon /> {t.share}
              </button>
            )}
            <label className="flex items-center gap-1.5 text-[0.78rem] text-sand-100/75 cursor-pointer">
              <input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} data-testid="call-link-withname" className="w-4 h-4 accent-green-500 cursor-pointer" />
              {t.includeName}
            </label>
          </div>
        </>
      )}
      </div>
      {/* Unpublish sits below AND outside the box; expiry note right-aligned. */}
      {code && (
        <div className="flex items-center justify-between gap-2 px-1" data-testid="call-link-foot">
          <button type="button" onClick={remove} disabled={busy} data-testid="call-link-remove"
            className="inline-flex items-center gap-1.5 text-[0.8rem] text-sand-100/70 hover:text-sand-100 bg-transparent border-0 cursor-pointer [&_svg]:w-3.5 [&_svg]:h-3.5">
            <TrashIcon /> {busy ? t.removing : t.remove}
          </button>
          <span className="text-[0.72rem] text-sand-100/55" data-testid="call-link-expiry">{t.expires}</span>
        </div>
      )}
    </>
  )
}

/** Shown when this browser opened from a ring push (`?ring=1&link=<code>`): the
 *  user's own "am I still letting people call me?" moment — per the design, the
 *  removal is offered exactly when a call comes in. */
export function IncomingCallNote({ locale, linkCode }: { locale: 'en' | 'ar'; linkCode: string }) {
  const t = T[locale]
  const [removed, setRemoved] = useState(false)
  const [busy, setBusy] = useState(false)
  async function remove() { setBusy(true); await deleteCallLink(linkCode); setBusy(false); setRemoved(true) }
  return (
    <div className="w-full rounded-md border border-sand-100/25 bg-white/10 px-3 py-2 flex flex-col gap-1" data-testid="call-incoming">
      <p className="text-[0.9rem] font-semibold text-sand-100 flex items-center gap-2"><PhoneIcon className="w-4 h-4" /> {t.incoming}</p>
      {removed
        ? <p className="text-[0.78rem] text-sand-100/75" data-testid="call-incoming-removed">{t.removed}</p>
        : <button type="button" onClick={remove} disabled={busy} data-testid="call-incoming-remove"
            className="self-start text-[0.78rem] text-sand-100/70 hover:text-sand-100 underline underline-offset-2 bg-transparent border-0 cursor-pointer">{t.notYou}</button>}
    </div>
  )
}
