import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    input: 'JSON Web Token', header: 'Header', payload: 'Payload', invalid: 'Not a valid JWT — expected three dot-separated parts.',
    placeholder: 'Paste a token (eyJ…) here', expired: 'expired', expiresIn: 'expires in', issued: 'issued',
    note: 'The signature is not verified — this only decodes the token locally.', privacy: 'Decoded in your browser — the token is never uploaded.',
  },
  ar: {
    input: 'رمز JSON Web Token', header: 'الترويسة', payload: 'الحمولة', invalid: 'رمز JWT غير صالح — يُتوقَّع ثلاثة أجزاء مفصولة بنقاط.',
    placeholder: 'الصق الرمز (eyJ…) هنا', expired: 'منتهٍ', expiresIn: 'ينتهي بعد', issued: 'صدر',
    note: 'لا يُتحقَّق من التوقيع — تُفكّ الأداة الرمز محليًا فقط.', privacy: 'يُفكّ في متصفحك — لا يُرفع الرمز أبدًا.',
  },
}

function b64urlDecode(part: string): string {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(part.length + (4 - (part.length % 4)) % 4, '=')
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const rel = (secs: number) => {
  const abs = Math.abs(secs)
  if (abs < 90) return `${Math.round(abs)}s`
  if (abs < 5400) return `${Math.round(abs / 60)}m`
  if (abs < 129600) return `${Math.round(abs / 3600)}h`
  return `${Math.round(abs / 86400)}d`
}

export default function JwtDecoderTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [token, setToken] = useState('')

  const decoded = useMemo(() => {
    const t = token.trim().replace(/^Bearer\s+/i, '')
    if (!t) return null
    const parts = t.split('.')
    if (parts.length < 2 || parts.length > 3) return { error: true as const }
    try {
      const header = JSON.parse(b64urlDecode(parts[0]))
      const payload = JSON.parse(b64urlDecode(parts[1]))
      return { error: false as const, header, payload }
    } catch { return { error: true as const } }
  }, [token])

  const now = Math.floor(Date.now() / 1000)
  const p = decoded && !decoded.error ? decoded.payload as Record<string, unknown> : null
  const claim = (k: string) => (typeof p?.[k] === 'number' ? (p[k] as number) : null)
  const exp = claim('exp'), iat = claim('iat')

  return (
    <Stack data-testid="jwt-decoder">
      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input}</FieldLabel>
        <Textarea value={token} onChange={(e) => setToken(e.target.value)} rows={4} dir="ltr" className="font-mono text-[0.85rem] break-all" placeholder={s.placeholder} data-testid="jwt-input" /></label>

      {decoded?.error && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="jwt-error">{s.invalid}</p>}

      {decoded && !decoded.error && (
        <>
          {(exp != null || iat != null) && (
            <div className="flex flex-wrap gap-2 text-[0.8rem]">
              {exp != null && (
                <span className={`px-2 py-1 rounded-md font-medium ${exp < now ? 'bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[color:var(--danger)]' : 'bg-[color-mix(in_srgb,var(--color-green-400)_18%,transparent)] text-green-700'}`}>
                  {exp < now ? `${s.expired} · ${rel(now - exp)}` : `${s.expiresIn} ${rel(exp - now)}`}
                </span>
              )}
              {iat != null && <span className="px-2 py-1 rounded-md bg-[var(--surface)] border border-[color:var(--line-soft)] text-ink-soft">{s.issued} {rel(now - iat)}</span>}
            </div>
          )}
          <div className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.header}</FieldLabel>
            <pre className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3 font-mono text-[0.85rem] overflow-x-auto" dir="ltr" data-testid="jwt-header">{JSON.stringify(decoded.header, null, 2)}</pre></div>
          <div className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.payload}</FieldLabel>
            <pre className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3 font-mono text-[0.85rem] overflow-x-auto" dir="ltr" data-testid="jwt-payload">{JSON.stringify(decoded.payload, null, 2)}</pre></div>
          <p className="text-[0.8rem] text-ink-faint">{s.note}</p>
        </>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
