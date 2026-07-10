import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocale, localePath } from '../../i18n'
import { Button, Input, Stack, Spinner } from '../../components/ui'
import { LinkIcon } from '../../components/icons'
import { loadGis, GOOGLE_CLIENT_ID } from '../../lib/cvApi'
import { shortenUrl, myLinks, deleteLink, type ShortLink } from '../../lib/shortenApi'

const STR = {
  en: {
    heroTitle: 'Link Shortener',
    heroBody: 'Turn a long URL into a short built-in-saudi.com/s/… link. Kept for 6 months.',
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
    dataNote: 'How we use your data:',
    privacy: 'Privacy',
    terms: 'Terms',
  },
  ar: {
    heroTitle: 'اختصار الروابط',
    heroBody: 'حوّل رابطًا طويلًا إلى رابط قصير على built-in-saudi.com/s/…. يُحفظ لمدة ٦ أشهر.',
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
  const btnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadGis().then((gis) => {
      if (cancelled) return
      gis.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r: { credential: string }) => {
          setIdToken(r.credential)
          setLoadingLinks(true)
          myLinks(r.credential).then((l) => setLinks(l)).catch(() => {}).finally(() => setLoadingLinks(false))
        },
      })
      if (btnRef.current) gis.renderButton(btnRef.current, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill' })
    }).catch(() => setErr(s.signinErr))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  async function copy(text: string, code: string) {
    try { await navigator.clipboard.writeText(text); setCopied(code); setTimeout(() => setCopied((c) => (c === code ? '' : c)), 1500) } catch { /* ignore */ }
  }

  async function shorten() {
    const u = url.trim()
    if (!idToken || !u || busy) return
    setBusy(true); setErr('')
    try {
      const link = await shortenUrl(idToken, u)
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

  function remove(code: string) {
    setLinks((prev) => prev.filter((l) => l.code !== code))
    if (idToken) deleteLink(idToken, code)
  }

  return (
    <Stack data-testid="link-shortener" className="min-h-[60vh]">
      <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] bg-green-600 text-sand-100">
        <div className="wrap py-[clamp(1.4rem,4vw,2rem)] max-w-[46rem] flex flex-col gap-2">
          <h1 className="font-display rtl:font-ar text-[clamp(1.5rem,4vw,2rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{s.heroTitle}</h1>
          <p className="text-[0.98rem] opacity-90 leading-relaxed max-w-[40rem]">{s.heroBody}</p>
        </div>
      </div>

      {!idToken ? (
        <div className="flex flex-col gap-3 items-start">
          <div ref={btnRef} className="[color-scheme:light]" data-testid="link-signin" />
          <p className="text-[0.85rem] text-ink-faint">{s.signinNote}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={s.ph} data-testid="link-url"
              className="flex-1 min-w-[14rem]" onKeyDown={(e) => { if (e.key === 'Enter') shorten() }} inputMode="url" />
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
        </>
      )}

      <p className="text-[0.72rem] text-ink-faint opacity-80 flex items-center gap-2 mt-auto pt-6">
        <span>{s.dataNote}</span>
        <Link to={localePath(locale, '/privacy')} className="underline" style={{ color: 'var(--ink-faint)' }}>{s.privacy}</Link>
        <span aria-hidden="true">·</span>
        <Link to={localePath(locale, '/terms')} className="underline" style={{ color: 'var(--ink-faint)' }}>{s.terms}</Link>
      </p>
    </Stack>
  )
}
