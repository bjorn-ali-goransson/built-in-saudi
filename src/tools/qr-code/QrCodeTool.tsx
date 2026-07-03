import { useEffect, useMemo, useRef, useState } from 'react'
import { LinkIcon, TextIcon, WifiIcon, MailIcon, PhoneIcon, DownloadIcon, ShareIcon } from '../../components/icons'
import { useLocale } from '../../i18n'
import { type QrContentType, type WifiFields, type EmailFields, normalizeUrl, buildWifi, buildEmail, buildPhone } from './build'
import { renderQR, type DotStyle, type Frame, DOT_STYLES } from './qrRender'

const TYPE_DEFS: { id: QrContentType; Icon: typeof LinkIcon }[] = [
  { id: 'link', Icon: LinkIcon }, { id: 'text', Icon: TextIcon }, { id: 'wifi', Icon: WifiIcon },
  { id: 'email', Icon: MailIcon }, { id: 'phone', Icon: PhoneIcon },
]
const SIZES: { key: 'sizeSmall' | 'sizeMedium' | 'sizeLarge' | 'sizeHD'; px: number }[] = [
  { key: 'sizeSmall', px: 256 }, { key: 'sizeMedium', px: 512 }, { key: 'sizeLarge', px: 1024 }, { key: 'sizeHD', px: 2048 },
]
const THEMES: [string, string][] = [
  ['#12211b', '#ffffff'], ['#0f5132', '#e8f3ec'], ['#1e3a8a', '#eff6ff'], ['#7c2d12', '#fff7ed'],
  ['#831843', '#fdf2f8'], ['#0e7490', '#ecfeff'], ['#111827', '#f3f4f6'], ['#ffffff', '#12211b'],
]
interface Preset { dot: DotStyle; fg: string; bg: string; frame: Frame }
const PRESETS: Preset[] = [
  { dot: 'square', fg: '#12211b', bg: '#ffffff', frame: 'none' },
  { dot: 'dots', fg: '#0f5132', bg: '#ffffff', frame: 'none' },
  { dot: 'rounded', fg: '#1e3a8a', bg: '#eff6ff', frame: 'card' },
  { dot: 'liquid', fg: '#7c2d12', bg: '#ffffff', frame: 'none' },
  { dot: 'cube', fg: '#111827', bg: '#ffffff', frame: 'none' },
  { dot: 'dots', fg: '#ffffff', bg: '#12211b', frame: 'circle' },
  { dot: 'liquid', fg: '#831843', bg: '#fdf2f8', frame: 'card' },
  { dot: 'rounded', fg: '#0e7490', bg: '#ecfeff', frame: 'circle' },
]
const SAMPLE = 'https://built-in-saudi.com'

function hslHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

// A small non-interactive QR preview rendered to its own canvas.
function MiniQR({ dot, fg, bg, frame, px }: { dot: DotStyle; fg: string; bg: string; frame: Frame; px: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) renderQR(ref.current, { value: SAMPLE, size: 120, margin: 1, fg, bg, dot, ecLevel: 'M', frame, frameColor: fg, label: '' })
  }, [dot, fg, bg, frame])
  return <canvas ref={ref} className="rounded-[4px]" style={{ width: px, height: 'auto' }} aria-hidden="true" />
}

export default function QrCodeTool() {
  const { t } = useLocale()
  const q = t.qr

  const [type, setType] = useState<QrContentType>('link')
  const [link, setLink] = useState('https://built-in-saudi.com')
  const [text, setText] = useState('')
  const [wifi, setWifi] = useState<WifiFields>({ ssid: '', password: '', encryption: 'WPA', hidden: false })
  const [email, setEmail] = useState<EmailFields>({ to: '', subject: '', body: '' })
  const [phone, setPhone] = useState('')

  const [dot, setDot] = useState<DotStyle>('square')
  const [fg, setFg] = useState('#12211b')
  const [bg, setBg] = useState('#ffffff')
  const [frame, setFrame] = useState<Frame>('none')
  const [label, setLabel] = useState('SCAN ME')
  const [sizePx, setSizePx] = useState(512)
  const [margin, setMargin] = useState(2)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const [logoName, setLogoName] = useState('')
  const [copied, setCopied] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logoInput = useRef<HTMLInputElement>(null)

  const value = useMemo(() => {
    switch (type) {
      case 'link': return normalizeUrl(link)
      case 'text': return text.trim()
      case 'wifi': return buildWifi(wifi)
      case 'email': return buildEmail(email)
      case 'phone': return buildPhone(phone)
    }
  }, [type, link, text, wifi, email, phone])

  const hasCode = !!value

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    if (!value) { c.width = c.height = 0; return }
    renderQR(c, { value, size: sizePx, margin, fg, bg, dot, ecLevel: logo ? 'H' : 'M', logo, frame, frameColor: fg, label })
  }, [value, sizePx, margin, fg, bg, dot, logo, frame, label])

  function applyPreset(p: Preset) { setDot(p.dot); setFg(p.fg); setBg(p.bg); setFrame(p.frame) }
  function randomTheme() { const h = Math.floor(Math.random() * 360); setFg(hslHex(h, 70, 26)); setBg(hslHex((h + 8) % 360, 55, 96)) }

  function onLogo(f: File | undefined) {
    if (!f || !f.type.startsWith('image/')) return
    const img = new Image()
    img.onload = () => { setLogo(img); setLogoName(f.name) }
    img.src = URL.createObjectURL(f)
  }

  function withBlob(cb: (b: Blob) => void) { canvasRef.current?.toBlob((b) => { if (b) cb(b) }, 'image/png') }
  function downloadPng() {
    withBlob((b) => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'qr-code.png'; a.click(); URL.revokeObjectURL(u) })
  }
  function share() {
    withBlob(async (b) => {
      const file = new File([b], 'qr-code.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: label || 'QR' }) } catch { /* cancelled */ } }
      else { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { downloadPng() } }
    })
  }

  const seg = (active: boolean) => `seg__btn ${active ? 'is-active' : ''}`

  return (
    <div className="stack max-w-xl mx-auto" data-testid="qr-code">
      <label className="field">
        <span className="field__label">{q.fieldUrl}</span>
        <input className="input" type="url" inputMode="url" placeholder={q.placeholderUrl} data-testid="qr-url"
          value={link} autoComplete="off" onChange={(e) => { setLink(e.target.value); setType('link') }} />
      </label>

      <div className="grid place-items-center p-4 rounded-md border border-[color:var(--line)] bg-sand-100 min-h-[200px]">
        {hasCode
          ? <canvas ref={canvasRef} data-testid="qr-canvas" className="w-full max-w-[280px] h-auto" />
          : <span className="text-ink-faint text-[0.92rem]">{q.empty}</span>}
      </div>

      <div className="flex gap-2">
        <button className="btn btn--primary flex-1 justify-center" data-testid="qr-share" onClick={share} disabled={!hasCode}><ShareIcon /> {copied ? q.copied : q.share}</button>
        <button className="btn flex-1 justify-center" onClick={downloadPng} disabled={!hasCode}><DownloadIcon /> {q.download}</button>
      </div>

      {/* Preset thumbnail strip */}
      <div className="flex flex-col gap-2">
        <span className="field__label">{q.style}</span>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {PRESETS.map((p, i) => (
            <button key={i} className="flex-none rounded-md border-2 border-[color:var(--line-soft)] hover:border-green-500 aria-[current=true]:border-green-600 p-1 bg-white"
              aria-current={dot === p.dot && fg === p.fg && frame === p.frame} data-testid={`qr-preset-${i}`} onClick={() => applyPreset(p)}>
              <MiniQR dot={p.dot} fg={p.fg} bg={p.bg} frame={p.frame} px={56} />
            </button>
          ))}
        </div>
      </div>

      {/* Pattern (dot style) with live examples */}
      <div className="flex flex-col gap-2">
        <span className="field__label">{q.dotStyle}</span>
        <div className="grid grid-cols-5 gap-2">
          {DOT_STYLES.map((d) => (
            <button key={d} className={`flex flex-col items-center gap-1 rounded-md border-2 p-1.5 ${dot === d ? 'border-green-600 bg-[color-mix(in_srgb,var(--green-400)_12%,transparent)]' : 'border-[color:var(--line-soft)] hover:border-green-500'}`}
              data-testid={`qr-dot-${d}`} onClick={() => setDot(d)}>
              <MiniQR dot={d} fg={fg} bg={bg} frame="none" px={44} />
              <span className="text-[0.66rem] text-ink-soft leading-tight text-center">{q.dots[d]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="flex flex-col gap-2">
        <span className="field__label">{q.theme}</span>
        <div className="flex flex-wrap items-center gap-2">
          {THEMES.map(([f, b], i) => (
            <button key={i} className="w-8 h-8 rounded-full border border-[color:var(--line)] grid place-items-center aria-[current=true]:ring-2 aria-[current=true]:ring-green-600 aria-[current=true]:ring-offset-1"
              style={{ background: b }} aria-current={fg === f && bg === b} aria-label={`theme ${i + 1}`} data-testid={`qr-theme-${i}`} onClick={() => { setFg(f); setBg(b) }}>
              <span className="w-4 h-4 rounded-full" style={{ background: f }} />
            </button>
          ))}
          <button className="btn px-3" data-testid="qr-random" onClick={randomTheme}>🎲 {q.randomTheme}</button>
          <label className="inline-flex items-center gap-1 ms-1"><input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="w-8 h-8 rounded border border-[color:var(--line)] p-0 bg-transparent cursor-pointer" aria-label={q.foreground} /></label>
          <label className="inline-flex items-center gap-1"><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-8 h-8 rounded border border-[color:var(--line)] p-0 bg-transparent cursor-pointer" aria-label={q.background} /></label>
        </div>
      </div>

      {/* Frame + label + logo */}
      <div className="flex flex-col gap-2">
        <span className="field__label">{q.frame}</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="group">
            {(['none', 'card', 'circle'] as Frame[]).map((f) => (
              <button key={f} className={seg(frame === f)} data-testid={`qr-frame-${f}`} onClick={() => setFrame(f)}>{f === 'none' ? '—' : f === 'card' ? '▢' : '◯'}</button>
            ))}
          </div>
          {frame !== 'none' && (
            <input className="input flex-1 min-w-[8rem] max-w-[12rem]" value={label} maxLength={16} placeholder="SCAN ME" data-testid="qr-label" onChange={(e) => setLabel(e.target.value)} />
          )}
          {logo
            ? <button className="btn px-3" onClick={() => { setLogo(null); setLogoName('') }}>✕ {q.removeLogo} · {logoName.slice(0, 10)}</button>
            : <button className="btn px-3" data-testid="qr-add-logo" onClick={() => logoInput.current?.click()}>＋ {q.addLogo}</button>}
          <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </div>

      {/* Advanced */}
      <details className="border-t border-[color:var(--line-soft)] pt-3">
        <summary className="cursor-pointer font-semibold text-ink-soft text-[0.9rem] select-none">{q.advanced}</summary>
        <div className="stack pt-3">
          <div className="field">
            <span className="field__label">{q.type}</span>
            <div className="seg flex-wrap" role="group">
              {TYPE_DEFS.map((d) => (
                <button key={d.id} className={`${seg(type === d.id)} [&_svg]:size-[15px] inline-flex items-center gap-1`} onClick={() => setType(d.id)}><d.Icon /> {q.types[d.id]}</button>
              ))}
            </div>
          </div>

          {type === 'text' && <label className="field"><span className="field__label">{q.fieldText}</span><textarea className="input input--area" rows={3} value={text} placeholder={q.placeholderText} onChange={(e) => setText(e.target.value)} /></label>}
          {type === 'wifi' && (
            <div className="grid gap-3">
              <label className="field"><span className="field__label">{q.fieldSsid}</span><input className="input" value={wifi.ssid} placeholder={q.placeholderSsid} onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })} /></label>
              <label className="field"><span className="field__label">{q.fieldPassword}</span><input className="input" value={wifi.password} disabled={wifi.encryption === 'nopass'} onChange={(e) => setWifi({ ...wifi, password: e.target.value })} /></label>
              <label className="field"><span className="field__label">{q.fieldSecurity}</span>
                <select className="input" value={wifi.encryption} onChange={(e) => setWifi({ ...wifi, encryption: e.target.value as WifiFields['encryption'] })}>
                  <option value="WPA">{q.secWpa}</option><option value="WEP">{q.secWep}</option><option value="nopass">{q.secNone}</option>
                </select></label>
              <label className="check"><input type="checkbox" checked={wifi.hidden} onChange={(e) => setWifi({ ...wifi, hidden: e.target.checked })} />{q.hidden}</label>
            </div>
          )}
          {type === 'email' && (
            <div className="grid gap-3">
              <label className="field"><span className="field__label">{q.fieldTo}</span><input className="input" type="email" value={email.to} placeholder={q.placeholderEmail} onChange={(e) => setEmail({ ...email, to: e.target.value })} /></label>
              <label className="field"><span className="field__label">{q.fieldSubject}</span><input className="input" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} /></label>
              <label className="field"><span className="field__label">{q.fieldMessage}</span><textarea className="input input--area" rows={2} value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} /></label>
            </div>
          )}
          {type === 'phone' && <label className="field"><span className="field__label">{q.fieldPhone}</span><input className="input" type="tel" inputMode="tel" value={phone} placeholder={q.placeholderPhone} onChange={(e) => setPhone(e.target.value)} /></label>}

          <div className="field">
            <span className="field__label">{q.size}</span>
            <div className="seg flex-wrap" role="group">
              {SIZES.map((s) => <button key={s.key} className={seg(sizePx === s.px)} onClick={() => setSizePx(s.px)}>{q[s.key]}</button>)}
              <button className={seg(!SIZES.some((s) => s.px === sizePx))} onClick={() => setSizePx(640)}>{q.sizeCustom}</button>
            </div>
            {!SIZES.some((s) => s.px === sizePx) && (
              <input className="mt-2" type="range" min={128} max={2048} step={64} value={sizePx} onChange={(e) => setSizePx(Number(e.target.value))} aria-label={`${q.size} ${sizePx}px`} />
            )}
          </div>
          <label className="field"><span className="field__label">{q.quietZone} · {margin}</span>
            <input type="range" min={0} max={6} step={1} value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></label>
        </div>
      </details>

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {q.privacy}</p>
    </div>
  )
}
