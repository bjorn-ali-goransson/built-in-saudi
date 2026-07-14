import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Button, Textarea } from '../../components/ui'
import { CopyIcon } from '../../components/icons'
import { loadGis, GOOGLE_CLIENT_ID } from '../../lib/cvApi'

const FN = 'https://us-central1-blitz-ksa.cloudfunctions.net'
const hasArabic = (s: string) => /[ء-ي]/.test(s)

const STR = {
  en: {
    lead: 'Paste Arabic text and one AI pass adds full diacritics (تشكيل) — including the grammatical case endings. Sign in with Google; one run per 24 hours.',
    placeholder: 'Paste Arabic text here…', signin: 'Sign in to add diacritics', run: 'Add diacritics', working: 'Adding diacritics…',
    signinNote: 'Free — signing in just keeps the AI budget fair (one run per 24h).',
    notArabic: 'Please enter Arabic text (no Arabic letters found).', empty: 'Paste some Arabic text first.',
    result: 'Diacritized', copy: 'Copy', copied: 'Copied!', again: 'Do another',
    privacy: 'Your text is sent once to the AI for this pass and not stored.',
  },
  ar: {
    lead: 'الصق نصًّا عربيًّا فيضيف الذكاء الاصطناعي التشكيل الكامل — مع علامات الإعراب — بمرور واحد. سجّل الدخول بحساب Google؛ مرة كل ٢٤ ساعة.',
    placeholder: 'الصق النص العربي هنا…', signin: 'سجّل الدخول للتشكيل', run: 'أضِف التشكيل', working: 'جارٍ التشكيل…',
    signinNote: 'مجاني — تسجيل الدخول فقط لضبط ميزانية الذكاء الاصطناعي (مرة كل ٢٤ ساعة).',
    notArabic: 'الرجاء إدخال نص عربي (لا توجد حروف عربية).', empty: 'الصق نصًّا عربيًّا أولًا.',
    result: 'النص مُشكَّلًا', copy: 'نسخ', copied: 'تم النسخ!', again: 'نصّ آخر',
    privacy: 'يُرسل نصّك مرة واحدة للذكاء الاصطناعي لهذا المرور ولا يُخزَّن.',
  },
}

export default function DiacritizeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [idToken, setIdToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const btnRef = useRef<HTMLDivElement>(null)
  const pending = useRef(false)

  useEffect(() => {
    let stop = false
    loadGis().then((gis) => {
      if (stop) return
      gis.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r: { credential: string }) => { setIdToken(r.credential); if (pending.current) { pending.current = false; run(r.credential) } } })
      if (btnRef.current) gis.renderButton(btnRef.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill' })
    }).catch(() => { /* offline */ })
    return () => { stop = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(token: string) {
    setBusy(true); setErr(''); setResult(null)
    try {
      const r = await fetch(`${FN}/diacritize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token, text }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setResult(d.text)
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }
  function go() {
    if (!text.trim()) { setErr(s.empty); return }
    if (!hasArabic(text)) { setErr(s.notArabic); return } // front-end Arabic validation
    if (idToken) run(idToken)
    else { pending.current = true; loadGis().then((gis) => gis.prompt()).catch(() => { /* use the button */ }) }
  }
  async function copy() {
    if (!result) return
    try { await navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="diacritize">
      {!result && (
        <>
          <p className="text-[0.95rem] text-ink-soft leading-relaxed">{s.lead}</p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={s.placeholder} dir="rtl"
            className="min-h-[32vh] resize-y font-ar text-[1.35rem] leading-loose" data-testid="dc-input" />
          {err && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="dc-err">{err}</p>}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="primary" disabled={busy} onClick={go} data-testid="dc-run">{busy ? s.working : (idToken ? s.run : s.signin)}</Button>
            {!idToken && <div ref={btnRef} className="[color-scheme:light]" />}
          </div>
          {!idToken && <p className="text-[0.8rem] text-ink-faint">{s.signinNote}</p>}
        </>
      )}

      {result && (
        <div className="flex flex-col gap-3" data-testid="dc-result">
          <div className="flex items-center gap-2">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.result}</span>
            <Button className="flex-none px-3" onClick={copy} data-testid="dc-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
          <div dir="rtl" data-testid="dc-output"
            className="rounded-md border border-[color:var(--line-soft)] bg-[var(--surface)] px-4 py-3 font-ar text-[1.5rem] leading-loose text-ink whitespace-pre-wrap break-words select-all">{result}</div>
          <Button className="self-start" onClick={() => { setResult(null); setErr('') }}>{s.again}</Button>
        </div>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
