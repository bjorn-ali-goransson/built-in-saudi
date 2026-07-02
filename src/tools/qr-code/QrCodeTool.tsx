import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  LinkIcon, TextIcon, WifiIcon, MailIcon, PhoneIcon,
  DownloadIcon, CopyIcon,
} from '../../components/icons'
import { useLocale } from '../../i18n'
import {
  type QrContentType, type WifiFields, type EmailFields,
  normalizeUrl, buildWifi, buildEmail, buildPhone,
} from './build'

type EcLevel = 'L' | 'M' | 'Q' | 'H'

const TYPE_DEFS: { id: QrContentType; Icon: typeof LinkIcon }[] = [
  { id: 'link', Icon: LinkIcon },
  { id: 'text', Icon: TextIcon },
  { id: 'wifi', Icon: WifiIcon },
  { id: 'email', Icon: MailIcon },
  { id: 'phone', Icon: PhoneIcon },
]

const EC_LEVELS: EcLevel[] = ['L', 'M', 'Q', 'H']

export default function QrCodeTool() {
  const { t } = useLocale()
  const q = t.qr

  const [type, setType] = useState<QrContentType>('link')
  const [link, setLink] = useState('https://built-in-saudi.com')
  const [text, setText] = useState('')
  const [wifi, setWifi] = useState<WifiFields>({
    ssid: '', password: '', encryption: 'WPA', hidden: false,
  })
  const [email, setEmail] = useState<EmailFields>({ to: '', subject: '', body: '' })
  const [phone, setPhone] = useState('')

  const [size, setSize] = useState(512)
  const [margin, setMargin] = useState(2)
  const [ecLevel, setEcLevel] = useState<EcLevel>('M')
  const [fg, setFg] = useState('#12211b')
  const [bg, setBg] = useState('#ffffff')

  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)

  const value = useMemo(() => {
    switch (type) {
      case 'link': return normalizeUrl(link)
      case 'text': return text.trim()
      case 'wifi': return buildWifi(wifi)
      case 'email': return buildEmail(email)
      case 'phone': return buildPhone(phone)
    }
  }, [type, link, text, wifi, email, phone])

  const opts = useMemo(
    () => ({ errorCorrectionLevel: ecLevel, margin, color: { dark: fg, light: bg } }),
    [ecLevel, margin, fg, bg],
  )

  useEffect(() => {
    let cancelled = false
    if (!value) { setSvg(''); setError(''); return }
    QRCode.toString(value, { type: 'svg', width: size, ...opts })
      .then((markup) => { if (!cancelled) { setSvg(markup); setError('') } })
      .catch((err: unknown) => {
        if (cancelled) return
        setSvg('')
        setError(err instanceof Error ? err.message : 'Could not generate QR code.')
      })
    return () => { cancelled = true }
  }, [value, size, opts])

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  const hasCode = Boolean(svg) && !error

  function flashCopied() {
    setCopied(true)
    window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  function download(href: string, ext: string) {
    const a = document.createElement('a')
    a.href = href
    a.download = `qr-code.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function downloadPng() {
    if (!value) return
    download(await QRCode.toDataURL(value, { width: size, ...opts }), 'png')
  }

  function downloadSvg() {
    if (!svg) return
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    download(url, 'svg')
    URL.revokeObjectURL(url)
  }

  async function copyPng() {
    if (!value) return
    try {
      const url = await QRCode.toDataURL(value, { width: size, ...opts })
      const blob = await (await fetch(url)).blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      flashCopied()
    } catch {
      setError(q.copyUnsupported)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
      {/* Controls */}
      <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-[1.3rem]">
        <div className="flex flex-wrap gap-[0.4rem] pb-[1.1rem] border-b border-[color:var(--line-soft)]" role="group" aria-label={q.style}>
          {TYPE_DEFS.map((d) => (
            <button
              key={d.id}
              aria-pressed={type === d.id}
              className={`inline-flex items-center gap-[0.4rem] px-[0.8rem] py-[0.5rem] border rounded-full font-semibold text-[0.88rem] transition-all duration-150 [&_svg]:size-[17px] ${
                type === d.id
                  ? 'bg-green-600 border-green-700 text-sand-100 shadow-[var(--shadow-sm)]'
                  : 'bg-[var(--surface)] border-[color:var(--line)] text-ink-soft hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:text-green-700'
              }`}
              onClick={() => { setType(d.id); setError('') }}
            >
              <d.Icon /> <span>{q.types[d.id]}</span>
            </button>
          ))}
        </div>

        <div className="py-[1.2rem]">
          {type === 'link' && (
            <Field label={q.fieldUrl}>
              <input className="input" type="url" inputMode="url" placeholder={q.placeholderUrl}
                value={link} onChange={(e) => setLink(e.target.value)} autoComplete="off" />
            </Field>
          )}

          {type === 'text' && (
            <Field label={q.fieldText}>
              <textarea className="input input--area" rows={4} placeholder={q.placeholderText}
                value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
          )}

          {type === 'wifi' && (
            <div className="grid gap-[0.9rem]">
              <Field label={q.fieldSsid}>
                <input className="input" value={wifi.ssid} placeholder={q.placeholderSsid}
                  onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })} />
              </Field>
              <Field label={q.fieldPassword}>
                <input className="input" value={wifi.password} placeholder="••••••••"
                  disabled={wifi.encryption === 'nopass'}
                  onChange={(e) => setWifi({ ...wifi, password: e.target.value })} />
              </Field>
              <Field label={q.fieldSecurity}>
                <select className="input" value={wifi.encryption}
                  onChange={(e) => setWifi({ ...wifi, encryption: e.target.value as WifiFields['encryption'] })}>
                  <option value="WPA">{q.secWpa}</option>
                  <option value="WEP">{q.secWep}</option>
                  <option value="nopass">{q.secNone}</option>
                </select>
              </Field>
              <label className="check">
                <input type="checkbox" checked={wifi.hidden}
                  onChange={(e) => setWifi({ ...wifi, hidden: e.target.checked })} />
                {q.hidden}
              </label>
            </div>
          )}

          {type === 'email' && (
            <div className="grid gap-[0.9rem]">
              <Field label={q.fieldTo}>
                <input className="input" type="email" placeholder={q.placeholderEmail}
                  value={email.to} onChange={(e) => setEmail({ ...email, to: e.target.value })} />
              </Field>
              <Field label={q.fieldSubject}>
                <input className="input" value={email.subject}
                  onChange={(e) => setEmail({ ...email, subject: e.target.value })} />
              </Field>
              <Field label={q.fieldMessage}>
                <textarea className="input input--area" rows={3} value={email.body}
                  onChange={(e) => setEmail({ ...email, body: e.target.value })} />
              </Field>
            </div>
          )}

          {type === 'phone' && (
            <Field label={q.fieldPhone}>
              <input className="input" type="tel" inputMode="tel" placeholder={q.placeholderPhone}
                value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          )}
        </div>

        <fieldset className="border-0 pt-[1.2rem] px-0 pb-0 border-t border-[color:var(--line-soft)] grid gap-[1.1rem]">
          <legend className="font-body text-[0.72rem] tracking-[0.08em] uppercase text-ink-faint p-0">{q.style}</legend>

          <div className="grid gap-[0.5rem] [&>label]:text-[0.82rem] [&>label]:font-semibold [&>label]:text-ink-soft [&>label]:flex [&>label]:justify-between">
            <label>{q.errorCorrection}</label>
            <div className="seg" role="group" aria-label={q.errorCorrection}>
              {EC_LEVELS.map((lvl) => (
                <button key={lvl}
                  className={`seg__btn ${ecLevel === lvl ? 'is-active' : ''}`}
                  onClick={() => setEcLevel(lvl)}>{lvl}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-[0.5rem] [&>label]:text-[0.82rem] [&>label]:font-semibold [&>label]:text-ink-soft [&>label]:flex [&>label]:justify-between">
            <label htmlFor="qr-size">{q.exportSize} <span className="muted">{size}px</span></label>
            <input id="qr-size" type="range" min={128} max={1024} step={32}
              value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </div>

          <div className="grid gap-[0.5rem] [&>label]:text-[0.82rem] [&>label]:font-semibold [&>label]:text-ink-soft [&>label]:flex [&>label]:justify-between">
            <label htmlFor="qr-margin">{q.quietZone} <span className="muted">{margin}</span></label>
            <input id="qr-margin" type="range" min={0} max={8} step={1}
              value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
          </div>

          <div className="flex gap-4">
            <label className="inline-flex items-center gap-[0.55rem] text-[0.85rem] font-semibold text-ink-soft [&_input[type=color]]:w-[34px] [&_input[type=color]]:h-[34px] [&_input[type=color]]:p-0 [&_input[type=color]]:border [&_input[type=color]]:border-[color:var(--line)] [&_input[type=color]]:rounded-lg [&_input[type=color]]:bg-none [&_input[type=color]]:cursor-pointer">
              <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} />
              <span>{q.foreground}</span>
            </label>
            <label className="inline-flex items-center gap-[0.55rem] text-[0.85rem] font-semibold text-ink-soft [&_input[type=color]]:w-[34px] [&_input[type=color]]:h-[34px] [&_input[type=color]]:p-0 [&_input[type=color]]:border [&_input[type=color]]:border-[color:var(--line)] [&_input[type=color]]:rounded-lg [&_input[type=color]]:bg-none [&_input[type=color]]:cursor-pointer">
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
              <span>{q.background}</span>
            </label>
          </div>
        </fieldset>
      </div>

      {/* Preview + export */}
      <div className="sticky top-[88px] flex flex-col gap-[0.9rem]">
        <div className="aspect-square grid place-items-center p-[clamp(1rem,4vw,2rem)] rounded-lg border border-[color:var(--line)] shadow-[var(--shadow-md)] transition-[background] duration-200" style={{ background: bg }} role="img"
          aria-label={hasCode ? `${q.encodes}: ${value}` : q.empty} aria-live="polite">
          {hasCode ? (
            <div className="w-full h-full grid place-items-center animate-[fadeUp_0.3s_ease] [&_svg]:w-full [&_svg]:h-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="text-center text-ink-faint text-[0.92rem] p-6">
              {error ? <span className="text-[color:var(--danger)] font-semibold">{error}</span> : <span>{q.empty}</span>}
            </div>
          )}
        </div>

        <div className="flex gap-[0.6rem] [&>.btn]:flex-1 [&>.btn]:justify-center">
          <button className="btn btn--primary" onClick={downloadPng} disabled={!hasCode}>
            <DownloadIcon /> {q.png}
          </button>
          <button className="btn" onClick={downloadSvg} disabled={!hasCode}>
            <DownloadIcon /> {q.svg}
          </button>
          <button className="btn" onClick={copyPng} disabled={!hasCode}>
            <CopyIcon /> {copied ? q.copied : q.copy}
          </button>
        </div>

        {hasCode && (
          <p className="flex flex-col gap-[0.2rem] text-[0.78rem] bg-sand-100 border border-[color:var(--line-soft)] rounded-[5px] px-[0.75rem] py-[0.6rem] overflow-hidden [&_code]:font-mono [&_code]:text-[0.78rem] [&_code]:text-green-700 [&_code]:break-all">
            <span className="font-body uppercase tracking-[0.06em] text-ink-faint text-[0.66rem]">{q.encodes}</span>
            <code dir="ltr">{value}</code>
          </p>
        )}

        <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {q.privacy}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  )
}
