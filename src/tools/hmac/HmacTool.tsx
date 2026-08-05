import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Textarea, Select, Stack, Seg, SegButton, CodeOut } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
type KeyEnc = 'utf8' | 'hex' | 'base64'
type OutEnc = 'hex' | 'base64'

const ALGOS: Algo[] = ['SHA-256', 'SHA-1', 'SHA-384', 'SHA-512']

const STR = {
  en: {
    message: 'Message', key: 'Secret key', keyEnc: 'Key is', out: 'Output as',
    algo: 'Algorithm', result: 'HMAC', copy: 'Copy', copied: 'Copied!',
    msgPh: 'The exact bytes you want to sign…',
    keyPh: 'The shared secret',
    verify: 'Compare against a value', verifyPh: 'Paste the HMAC you were given',
    match: 'Matches', noMatch: 'Does not match',
    empty: 'Enter a message and a key.',
    badKey: 'That key is not valid for the chosen encoding.',
    note: 'HMAC is not a hash of your key plus your message — it is a keyed construction that resists the length-extension attacks a plain hash is vulnerable to. Use it when you need to prove a message came from someone holding the secret.',
    constant: 'The comparison is done character by character in your browser. Nothing is sent anywhere.',
  },
  ar: {
    message: 'الرسالة', key: 'المفتاح السري', keyEnc: 'ترميز المفتاح', out: 'صيغة الناتج',
    algo: 'الخوارزمية', result: 'HMAC', copy: 'نسخ', copied: 'تم النسخ!',
    msgPh: 'البايتات التي تريد توقيعها بالضبط…',
    keyPh: 'السر المشترك',
    verify: 'قارن بقيمة', verifyPh: 'الصق قيمة HMAC التي وصلتك',
    match: 'مطابق', noMatch: 'غير مطابق',
    empty: 'أدخل رسالة ومفتاحًا.',
    badKey: 'هذا المفتاح غير صالح للترميز المختار.',
    note: 'HMAC ليس تجزئة لمفتاحك مع رسالتك — بل بناء بمفتاح يقاوم هجمات تمديد الطول التي تتعرّض لها التجزئة العادية. استخدمه حين تحتاج إثبات أن رسالة صدرت ممن يملك السر.',
    constant: 'تجري المقارنة محرفًا بمحرف داخل متصفحك. لا يُرسل شيء إلى أي مكان.',
  },
}

function decodeKey(value: string, enc: KeyEnc): Uint8Array | null {
  try {
    if (enc === 'utf8') return new TextEncoder().encode(value)
    if (enc === 'hex') {
      const clean = value.replace(/[\s:]/g, '')
      if (clean.length % 2 || /[^0-9a-fA-F]/.test(clean)) return null
      const out = new Uint8Array(clean.length / 2)
      for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
      return out
    }
    const bin = atob(value.replace(/\s/g, ''))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch { return null }
}

const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))

export default function HmacTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [message, setMessage] = useState('')
  const [key, setKey] = useState('')
  const [keyEnc, setKeyEnc] = useState<KeyEnc>('utf8')
  const [outEnc, setOutEnc] = useState<OutEnc>('hex')
  const [algo, setAlgo] = useState<Algo>('SHA-256')
  const [expected, setExpected] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!message || !key) { setResult(''); setError(''); return }
    const bytes = decodeKey(key, keyEnc)
    if (!bytes) { setResult(''); setError(s.badKey); return }
    setError('')
    ;(async () => {
      const ck = await crypto.subtle.importKey(
        'raw', bytes as unknown as BufferSource, { name: 'HMAC', hash: algo }, false, ['sign'],
      )
      const sig = new Uint8Array(await crypto.subtle.sign('HMAC', ck, new TextEncoder().encode(message)))
      if (!cancelled) setResult(outEnc === 'hex' ? toHex(sig) : toB64(sig))
    })().catch(() => { if (!cancelled) setError(s.badKey) })
    return () => { cancelled = true }
  }, [message, key, keyEnc, outEnc, algo, s.badKey])

  const compared = expected.trim()
    ? expected.trim().toLowerCase() === result.toLowerCase() ? 'match' : 'no'
    : ''

  async function copy() {
    if (!result) return
    try { await navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="hmac">
      <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
        {s.message}
        <Textarea className="min-h-[6rem]" dir="auto" data-testid="hm-message" placeholder={s.msgPh}
          value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint flex-1 min-w-[14rem]">
          {s.key}
          <Input dir="ltr" className="font-mono" data-testid="hm-key" placeholder={s.keyPh}
            value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.keyEnc}
          <Select className="w-28" data-testid="hm-keyenc" value={keyEnc} onChange={(e) => setKeyEnc(e.target.value as KeyEnc)}>
            <option value="utf8">Text</option><option value="hex">Hex</option><option value="base64">Base64</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.algo}
          <Select className="w-32" data-testid="hm-algo" value={algo} onChange={(e) => setAlgo(e.target.value as Algo)}>
            {ALGOS.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[0.8rem] text-ink-faint">{s.out}</span>
          <Seg>
            <SegButton active={outEnc === 'hex'} data-testid="hm-hex" onClick={() => setOutEnc('hex')}>Hex</SegButton>
            <SegButton active={outEnc === 'base64'} data-testid="hm-b64" onClick={() => setOutEnc('base64')}>Base64</SegButton>
          </Seg>
        </div>
      </div>

      {error && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="hm-error">{error}</p>}

      {result ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.result}</span>
            <Button className="px-3 py-1" onClick={copy} data-testid="hm-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
          <CodeOut data-testid="hm-result">{result}</CodeOut>
        </div>
      ) : (
        !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.empty}</p>
      )}

      {result && (
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.verify}
          <Input dir="ltr" className="font-mono" data-testid="hm-expected" placeholder={s.verifyPh}
            value={expected} onChange={(e) => setExpected(e.target.value)} />
          {compared && (
            <span className={`text-[0.95rem] font-semibold ${compared === 'match' ? 'text-green-700' : 'text-gold-500'}`} data-testid="hm-compare">
              {compared === 'match' ? s.match : s.noMatch}
            </span>
          )}
        </label>
      )}

      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.note}</p>
      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.constant}</p>
    </Stack>
  )
}
