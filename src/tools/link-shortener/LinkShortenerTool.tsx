import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useLocale, localePath } from '../../i18n'
import { Button, Input, Stack, Spinner, Sheet, SheetTitle } from '../../components/ui'
import { LinkIcon } from '../../components/icons'
import { loadGis, GOOGLE_CLIENT_ID } from '../../lib/cvApi'
import { shortenUrl, myLinks, deleteLink, type ShortLink } from '../../lib/shortenApi'

const STR = {
  en: {
    heroTitle: 'Link Shortener',
    heroPre: 'Turn a long URL into a short ',
    heroLink: 'built-in-saudi.com/s/…',
    heroPost: ' link. Kept for 6 months.',
    signinNote: 'Sign in with Google to create and keep your links.',
    signinErr: 'Google sign-in couldn’t load. Disable blockers and retry.',
    ph: 'Paste a long URL (https://…)',
    shorten: 'Shorten',
    shortening: 'Shortening…',
    copy: 'Copy',
    copied: 'Copied',
    open: 'Open',
    del: 'Delete',
    clicks: (n: number) => `${n} click${n === 1 ? '' : 's'}`,
    expires: (d: string) => `Expires ${d}`,
    empty: 'Your short links will appear here.',
    err: 'Couldn’t shorten that link.',
    rate: (m: string) => `You can create one link per hour — try again in ${m}.`,
    minutes: (n: number) => (n <= 1 ? 'a minute' : `${n} minutes`),
    loginTitle: 'Sign in to shorten',
    loginBody: 'Creating a short link needs a Google sign-in — it ties the link to you so you can manage or delete it later. Your link is shortened as soon as you sign in.',
    dataNote: 'How we use your data:',
    privacy: 'Privacy',
    terms: 'Terms',
  },
  ar: {
    heroTitle: 'اختصار الروابط',
    heroPre: 'حوّل رابطًا طويلًا إلى رابط قصير على ',
    heroLink: 'built-in-saudi.com/s/…',
    heroPost: '. يُحفظ لمدة ٦ أشهر.',
    signinNote: 'سجّل الدخول بحساب Google لإنشاء روابطك وحفظها.',
    signinErr: 'تعذّر تحميل تسجيل دخول جوجل. عطّل المانعات وأعد المحاولة.',
    ph: 'الصق رابطًا طويلًا (https://…)',
    shorten: 'اختصار',
    shortening: 'جارٍ الاختصار…',
    copy: 'نسخ',
    copied: 'نُسخ',
    open: 'فتح',
    del: 'حذف',
    clicks: (n: number) => `${n} نقرة`,
    expires: (d: string) => `تنتهي ${d}`,
    empty: 'ستظهر روابطك القصيرة هنا.',
    err: 'تعذّر اختصار هذا الرابط.',
    rate: (m: string) => `يمكنك إنشاء رابط واحد كل ساعة — حاول مجددًا بعد ${m}.`,
    minutes: (n: number) => (n <= 1 ? 'دقيقة' : `${n} دقيقة`),
    loginTitle: 'سجّل الدخول للاختصار',
    loginBody: 'يتطلب إنشاء رابط قصير تسجيل الدخول بحساب Google — لربط الرابط بك لتتمكن من إدارته أو حذفه لاحقًا. سيُختصر رابطك فور تسجيل دخولك.',
    dataNote: 'كيف نستخدم بياناتك:',
    privacy: 'الخصوصية',
    terms: 'الشروط',
  },
}

export default function LinkShortenerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [idToken, setIdToken] = useState('')
  const [url, setUrl] = useState('')
  const [links, setLinks] = useState<ShortLink[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const btnRef = useRef<HTMLDivElement>(null)
  const modalBtnRef = useRef<HTMLDivElement>(null)
  const gisRef = useRef<Awaited<ReturnType<typeof loadGis>> | null>(null)
  const pendingRef = useRef('') // URL awaiting a shorten once the user signs in
  // Latest doShorten, so the once-registered GIS callback runs the current one.
  const doShortenRef = useRef<(token: string, u: string) => void>(() => {})

  useEffect(() => {
    let cancelled = false
    loadGis().then((gis) => {
      if (cancelled) return
      gisRef.current = gis
      gis.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r: { credential: string }) => {
          setIdToken(r.credential)
          setShowLogin(false)
          setLoadingLinks(true)
          myLinks(r.credential).then((l) => setLinks(l)).catch(() => {}).finally(() => setLoadingLinks(false))
          const p = pendingRef.current
          pendingRef.current = ''
          if (p) doShortenRef.current(r.credential, p)
        },
      })
      if (btnRef.current) gis.renderButton(btnRef.current, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill' })
    }).catch(() => setErr(s.signinErr))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render the Google button inside the login modal when it opens.
  useEffect(() => {
    if (showLogin && gisRef.current && modalBtnRef.current) {
      gisRef.current.renderButton(modalBtnRef.current, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill' })
    }
  }, [showLogin])

  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  async function copy(text: string, code: string) {
    try { await navigator.clipboard.writeText(text); setCopied(code); setTimeout(() => setCopied((c) => (c === code ? '' : c)), 1500) } catch { /* ignore */ }
  }

  async function doShorten(token: string, u: string) {
    if (!token || !u) return
    setBusy(true); setErr('')
    try {
      const link = await shortenUrl(token, u)
      setLinks((prev) => [link, ...prev])
      setUrl('')
      copy(link.short, link.code)
    } catch (e) {
      const err = e as Error & { retryAfter?: number }
      if (err.message === 'rate-limited' && typeof err.retryAfter === 'number') {
        setErr(s.rate(s.minutes(Math.ceil(err.retryAfter / 60000))))
      } else {
        setErr(err.message || s.err)
      }
    } finally {
      setBusy(false)
    }
  }
  doShortenRef.current = doShorten

  function shorten() {
    const u = url.trim()
    if (!u || busy) return
    if (!idToken) { pendingRef.current = u; setErr(''); setShowLogin(true); return }
    doShorten(idToken, u)
  }

  function remove(code: string) {
    setLinks((prev) => prev.filter((l) => l.code !== code))
    if (idToken) deleteLink(idToken, code)
  }

  return (
    <Stack data-testid="link-shortener" className={`min-h-[60vh] ${idToken ? '' : 'pb-24'}`}>
      <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] bg-green-600 text-sand-100">
        <div className="wrap py-[clamp(1.4rem,4vw,2rem)] max-w-[46rem] flex flex-col gap-2">
          <h1 className="font-display rtl:font-ar text-[clamp(1.5rem,4vw,2rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{s.heroTitle}</h1>
          <p className="text-[0.98rem] opacity-90 leading-relaxed max-w-[40rem]">
            {s.heroPre}<span className="whitespace-nowrap">{s.heroLink}</span>{s.heroPost}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={s.ph} data-testid="link-url"
          className="flex-1 min-w-[14rem]" onKeyDown={(e) => { if (e.key === 'Enter') shorten() }}
          inputMode="url" type="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} dir="ltr" />
        <Button variant="primary" onClick={shorten} disabled={busy || !url.trim()} data-testid="link-shorten">
          {busy ? s.shortening : s.shorten}
        </Button>
      </div>
      {err && <p className="text-[0.85rem] text-gold-500">{err}</p>}

      {loadingLinks ? (
        <div className="py-8 flex justify-center"><Spinner className="size-7" /></div>
      ) : links.length === 0 ? (
        <p className="text-[0.9rem] text-ink-faint py-4">{s.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2 list-none ps-0 m-0" data-testid="link-list">
          {links.map((l) => (
            <li key={l.code} className="flex items-center gap-3 flex-wrap border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3">
              <LinkIcon className="w-4 h-4 flex-none text-green-600" />
              <div className="flex flex-col min-w-0 flex-1">
                <a href={l.short} target="_blank" rel="noopener noreferrer" className="text-[0.92rem] font-semibold text-green-700 no-underline hover:underline truncate">{l.short.replace(/^https?:\/\//, '')}</a>
                <span className="text-[0.78rem] text-ink-faint truncate" title={l.url}>{l.url}</span>
                <span className="text-[0.72rem] text-ink-faint mt-0.5">{s.clicks(l.hits)}{l.expiresAt ? ` · ${s.expires(dateFmt.format(new Date(l.expiresAt)))}` : ''}</span>
              </div>
              <div className="flex items-center gap-1 flex-none">
                <button type="button" onClick={() => copy(l.short, l.code)} data-testid={`copy-${l.code}`}
                  className="h-8 px-2.5 rounded-md text-[0.8rem] font-semibold border border-[color:var(--line)] bg-transparent text-ink-soft hover:border-green-500 cursor-pointer">
                  {copied === l.code ? s.copied : s.copy}
                </button>
                <button type="button" onClick={() => remove(l.code)} aria-label={s.del} data-testid={`del-${l.code}`}
                  className="grid place-items-center size-8 rounded-md text-ink-faint hover:text-gold-500 hover:bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] border-0 bg-transparent cursor-pointer">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[0.72rem] text-ink-faint opacity-80 flex items-center gap-2 mt-auto pt-6">
        <span>{s.dataNote}</span>
        <Link to={localePath(locale, '/privacy')} className="underline" style={{ color: 'var(--ink-faint)' }}>{s.privacy}</Link>
        <span aria-hidden="true">·</span>
        <Link to={localePath(locale, '/terms')} className="underline" style={{ color: 'var(--ink-faint)' }}>{s.terms}</Link>
      </p>

      {/* Sticky bottom sign-in — portaled to <body> so `fixed inset-x-0` bleeds
          full-width (ToolPage's transform otherwise resolves it against the tool
          box). Same pattern as the CV generator's sign-in gate. */}
      {!idToken && createPortal(
        <div className="fixed inset-x-0 bottom-0 z-40 bg-[var(--surface)] border-t border-[color:var(--line)] shadow-[0_-6px_20px_rgba(20,30,50,0.09)] pb-[env(safe-area-inset-bottom,0px)]">
          <div className="wrap py-3 flex items-center gap-3 flex-wrap">
            <div ref={btnRef} className="[color-scheme:light]" data-testid="link-signin" />
            <span className="text-[0.85rem] text-ink-faint flex-1 min-w-[12rem]">{s.signinNote}</span>
          </div>
        </div>,
        document.body,
      )}

      {/* Login prompt when a signed-out visitor tries to shorten. Signing in
          here closes the modal and shortens the pending URL automatically. */}
      {showLogin && (
        <Sheet onClose={() => setShowLogin(false)}>
          <SheetTitle>{s.loginTitle}</SheetTitle>
          <p className="text-[0.92rem] text-ink-soft leading-relaxed">{s.loginBody}</p>
          <div ref={modalBtnRef} className="[color-scheme:light] flex justify-center py-1" data-testid="link-login-modal" />
        </Sheet>
      )}
    </Stack>
  )
}
