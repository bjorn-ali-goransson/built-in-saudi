import { useEffect, useMemo, useRef, useState } from 'react'
import { LinkIcon, TextIcon, WifiIcon, MailIcon, PhoneIcon, DownloadIcon, ShareIcon } from '../../components/icons'
import { useLocale } from '../../i18n'
import { type QrContentType, type WifiFields, type EmailFields, normalizeUrl, buildWifi, buildEmail, buildPhone } from './build'
import { renderQR, type DotStyle, type Frame, DOT_STYLES } from './qrRender'
import { Input, Textarea, Select, Field, FieldLabel, Check, Seg, SegButton } from '../../components/ui'

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
const EMOJIS = ['⭐', '❤️', '🔥', '🌙', '🕌', '🐫', '🌴', '☕', '⚡', '💎', '🌟', '🍀', '🎁', '🚀', '🌸', '👍', '✨', '🧡', '🐍', '🎯']

function hslHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

// A small non-interactive QR preview rendered to its own canvas.
function MiniQR({ dot, fg, bg, frame, px, emoji, label }: { dot: DotStyle; fg: string; bg: string; frame: Frame; px: number; emoji?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) renderQR(ref.current, { value: SAMPLE, size: 120, margin: 1, fg, bg, dot, emoji, ecLevel: 'M', frame, frameColor: fg, label: label ?? '' })
  }, [dot, fg, bg, frame, emoji, label])
  return <canvas ref={ref} className="rounded-[4px]" style={{ width: px, height: 'auto' }} aria-hidden="true" />
}

export default function QrCodeTool() {
  const { t, locale } = useLocale()
  const q = t.qr
  const L = locale === 'ar'
    ? { title: 'أنشئ رمز باركود', body: 'الصق رابطًا واحصل على باركود أنيق ومخصّص — بألوان وأنماط وإطارات. لا يُرفع أي شيء.', surprise: 'تنسيق مفاجئ', appearance: 'المظهر', settings: 'الإعدادات' }
    : { title: 'Make a QR code', body: 'Paste a link and get a crisp, custom QR — colours, styles and frames. Nothing is uploaded.', surprise: 'Surprise styling', appearance: 'Appearance', settings: 'Settings' }

  const [type, setType] = useState<QrContentType>('link')
  const [link, setLink] = useState('https://built-in-saudi.com')
  const [text, setText] = useState('')
  const [wifi, setWifi] = useState<WifiFields>({ ssid: '', password: '', encryption: 'WPA', hidden: false })
  const [email, setEmail] = useState<EmailFields>({ to: '', subject: '', body: '' })
  const [phone, setPhone] = useState('')

  const [dot, setDot] = useState<DotStyle>('square')
  const [emoji, setEmoji] = useState('⭐')
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
    renderQR(c, { value, size: sizePx, margin, fg, bg, dot, emoji, ecLevel: logo ? 'H' : 'M', logo, frame, frameColor: fg, label })
  }, [value, sizePx, margin, fg, bg, dot, emoji, logo, frame, label])

  function applyPreset(p: Preset) { setDot(p.dot); setFg(p.fg); setBg(p.bg); setFrame(p.frame) }
  function randomTheme() { const h = Math.floor(Math.random() * 360); setFg(hslHex(h, 70, 26)); setBg(hslHex((h + 8) % 360, 55, 96)) }
  function surprise() {
    const dots = DOT_STYLES.filter((d) => d !== 'emoji')
    setDot(dots[Math.floor(Math.random() * dots.length)])
    const frames: Frame[] = ['none', 'none', 'card', 'circle']
    setFrame(frames[Math.floor(Math.random() * frames.length)])
    randomTheme()
  }

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

  const iconBtn = 'inline-flex items-center justify-center size-11 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft cursor-pointer hover:border-green-500 hover:text-green-700 disabled:opacity-40 disabled:cursor-default [&_svg]:size-5'
  const sectionHead = 'text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-green-700 mt-1'

  return (
    <div className="flex flex-col gap-5" data-testid="qr-code">
      {/* Green intro hero with the URL + surprise-styling */}
      <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] bg-green-600 text-sand-100">
        <div className="wrap py-[clamp(1.3rem,4vw,1.9rem)] flex flex-col gap-3 max-w-[40rem]">
          <div className="flex flex-col gap-1">
            <h1 className="font-display rtl:font-ar text-[clamp(1.4rem,4vw,1.9rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{L.title}</h1>
            <p className="text-[0.95rem] leading-relaxed opacity-90">{L.body}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="url" inputMode="url" placeholder={q.placeholderUrl} data-testid="qr-url" value={link} autoComplete="off"
              onChange={(e) => { setLink(e.target.value); setType('link') }}
              className="grow min-w-0 rounded-md border-0 bg-white text-ink px-3.5 py-2.5 text-[0.95rem] outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-[color-mix(in_srgb,var(--sand-100)_60%,transparent)]"
            />
            <button type="button" onClick={surprise} data-testid="qr-surprise"
              className="flex-none rounded-md bg-[color-mix(in_srgb,var(--sand-100)_18%,transparent)] border border-[color-mix(in_srgb,var(--sand-100)_45%,transparent)] text-sand-100 px-4 py-2.5 text-[0.9rem] font-semibold cursor-pointer hover:bg-[color-mix(in_srgb,var(--sand-100)_28%,transparent)]">
              {L.surprise}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto w-full flex flex-col gap-5">
        {/* QR preview (no well) + icon actions beside it */}
        <div className="flex items-center justify-center gap-4 min-h-[180px]">
          {hasCode ? (
            <>
              <canvas ref={canvasRef} data-testid="qr-canvas" className="w-full max-w-[240px] h-auto" />
              <div className="flex flex-col gap-2 flex-none">
                <button type="button" className={iconBtn} data-testid="qr-share" onClick={share} disabled={!hasCode} aria-label={copied ? q.copied : q.share} title={copied ? q.copied : q.share}>
                  {copied ? <span className="text-green-700 font-bold" aria-hidden="true">✓</span> : <ShareIcon />}
                </button>
                <button type="button" className={iconBtn} onClick={downloadPng} disabled={!hasCode} aria-label={q.download} title={q.download}>
                  <DownloadIcon />
                </button>
              </div>
            </>
          ) : (
            <span className="text-ink-faint text-[0.92rem]">{q.empty}</span>
          )}
        </div>

        {/* ── Appearance ─────────────────────────────── */}
        <span className={sectionHead}>{L.appearance}</span>

        <div className="flex flex-col gap-2">
          <FieldLabel>{q.style}</FieldLabel>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {PRESETS.map((p, i) => (
              <button key={i} className="flex-none rounded-md border-2 border-[color:var(--line-soft)] hover:border-green-500 aria-[current=true]:border-green-600 p-1 bg-white"
                aria-current={dot === p.dot && fg === p.fg && frame === p.frame} data-testid={`qr-preset-${i}`} onClick={() => applyPreset(p)}>
                <MiniQR dot={p.dot} fg={p.fg} bg={p.bg} frame={p.frame} px={56} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>{q.dotStyle}</FieldLabel>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {DOT_STYLES.map((d) => (
              <button key={d} className={`flex flex-col items-center gap-1 rounded-md border-2 p-1.5 ${dot === d ? 'border-green-600 bg-[color-mix(in_srgb,var(--green-400)_12%,transparent)]' : 'border-[color:var(--line-soft)] hover:border-green-500'}`}
                data-testid={`qr-dot-${d}`} onClick={() => setDot(d)}>
                <MiniQR dot={d} fg={fg} bg={bg} frame="none" px={44} emoji={emoji} />
                <span className="text-[0.66rem] text-ink-soft leading-tight text-center">{q.dots[d]}</span>
              </button>
            ))}
          </div>
          {dot === 'emoji' && (
            <div className="flex flex-wrap items-center gap-2">
              <Input className="w-16 text-center text-[1.2rem]" value={emoji} maxLength={4} data-testid="qr-emoji" onChange={(e) => setEmoji(e.target.value || '⭐')} aria-label={q.dots.emoji} />
              <div className="flex flex-wrap gap-1">
                {EMOJIS.slice(0, 12).map((em) => (
                  <button key={em} className="w-8 h-8 rounded-md border border-[color:var(--line-soft)] hover:border-green-500 text-[1.1rem] leading-none" onClick={() => setEmoji(em)} aria-label={em}>{em}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>{q.theme}</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            {THEMES.map(([f, b], i) => (
              <button key={i} className="w-8 h-8 rounded-full border border-[color:var(--line)] grid place-items-center aria-[current=true]:ring-2 aria-[current=true]:ring-green-600 aria-[current=true]:ring-offset-1"
                style={{ background: b }} aria-current={fg === f && bg === b} aria-label={`theme ${i + 1}`} data-testid={`qr-theme-${i}`} onClick={() => { setFg(f); setBg(b) }}>
                <span className="w-4 h-4 rounded-full" style={{ background: f }} />
              </button>
            ))}
            <button type="button" className="px-3 py-1.5 rounded-md border border-[color:var(--line)] text-[0.82rem] font-semibold text-ink-soft hover:border-green-500 hover:text-green-700 cursor-pointer" data-testid="qr-random" onClick={randomTheme}>{q.randomTheme}</button>
            <label className="inline-flex items-center gap-1 ms-1"><input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="w-8 h-8 rounded border border-[color:var(--line)] p-0 bg-transparent cursor-pointer" aria-label={q.foreground} /></label>
            <label className="inline-flex items-center gap-1"><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-8 h-8 rounded border border-[color:var(--line)] p-0 bg-transparent cursor-pointer" aria-label={q.background} /></label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>{q.frame}</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            {(['none', 'card', 'circle'] as Frame[]).map((f) => (
              <button key={f} className={`flex-none rounded-md border-2 p-1 bg-white ${frame === f ? 'border-green-600' : 'border-[color:var(--line-soft)] hover:border-green-500'}`}
                data-testid={`qr-frame-${f}`} onClick={() => setFrame(f)} aria-current={frame === f}>
                <MiniQR dot={dot === 'emoji' ? 'square' : dot} fg={fg} bg={bg} frame={f} px={54} label={f !== 'none' ? (label || 'SCAN') : ''} />
              </button>
            ))}
            {frame !== 'none' && (
              <Input className="flex-1 min-w-[8rem] max-w-[12rem]" value={label} maxLength={16} placeholder="SCAN ME" data-testid="qr-label" onChange={(e) => setLabel(e.target.value)} />
            )}
            {logo
              ? <button type="button" className="px-3 py-1.5 rounded-md border border-[color:var(--line)] text-[0.82rem] font-semibold text-ink-soft hover:border-green-500 cursor-pointer" onClick={() => { setLogo(null); setLogoName('') }}>✕ {q.removeLogo} · {logoName.slice(0, 10)}</button>
              : <button type="button" className="px-3 py-1.5 rounded-md border border-[color:var(--line)] text-[0.82rem] font-semibold text-ink-soft hover:border-green-500 cursor-pointer" data-testid="qr-add-logo" onClick={() => logoInput.current?.click()}>＋ {q.addLogo}</button>}
            <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = '' }} />
          </div>
        </div>

        {/* ── Settings ───────────────────────────────── */}
        <span className={sectionHead}>{L.settings}</span>

        <div className="flex flex-col gap-[0.4rem]">
          <FieldLabel>{q.type}</FieldLabel>
          <Seg className="flex-wrap" role="group">
            {TYPE_DEFS.map((d) => (
              <SegButton key={d.id} active={type === d.id} className="[&_svg]:size-[15px] inline-flex items-center gap-1" onClick={() => setType(d.id)}><d.Icon /> {q.types[d.id]}</SegButton>
            ))}
          </Seg>
        </div>

        {type === 'text' && <Field label={q.fieldText}><Textarea rows={3} value={text} placeholder={q.placeholderText} onChange={(e) => setText(e.target.value)} /></Field>}
        {type === 'wifi' && (
          <div className="grid gap-3">
            <Field label={q.fieldSsid}><Input value={wifi.ssid} placeholder={q.placeholderSsid} onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })} /></Field>
            <Field label={q.fieldPassword}><Input value={wifi.password} disabled={wifi.encryption === 'nopass'} onChange={(e) => setWifi({ ...wifi, password: e.target.value })} /></Field>
            <Field label={q.fieldSecurity}>
              <Select value={wifi.encryption} onChange={(e) => setWifi({ ...wifi, encryption: e.target.value as WifiFields['encryption'] })}>
                <option value="WPA">{q.secWpa}</option><option value="WEP">{q.secWep}</option><option value="nopass">{q.secNone}</option>
              </Select></Field>
            <Check><input type="checkbox" checked={wifi.hidden} onChange={(e) => setWifi({ ...wifi, hidden: e.target.checked })} />{q.hidden}</Check>
          </div>
        )}
        {type === 'email' && (
          <div className="grid gap-3">
            <Field label={q.fieldTo}><Input type="email" value={email.to} placeholder={q.placeholderEmail} onChange={(e) => setEmail({ ...email, to: e.target.value })} /></Field>
            <Field label={q.fieldSubject}><Input value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} /></Field>
            <Field label={q.fieldMessage}><Textarea rows={2} value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} /></Field>
          </div>
        )}
        {type === 'phone' && <Field label={q.fieldPhone}><Input type="tel" inputMode="tel" value={phone} placeholder={q.placeholderPhone} onChange={(e) => setPhone(e.target.value)} /></Field>}

        <div className="flex flex-col gap-[0.4rem]">
          <FieldLabel>{q.size}</FieldLabel>
          <Seg className="flex-wrap" role="group">
            {SIZES.map((s) => <SegButton key={s.key} active={sizePx === s.px} onClick={() => setSizePx(s.px)}>{q[s.key]}</SegButton>)}
            <SegButton active={!SIZES.some((s) => s.px === sizePx)} onClick={() => setSizePx(640)}>{q.sizeCustom}</SegButton>
          </Seg>
          {!SIZES.some((s) => s.px === sizePx) && (
            <input className="mt-2" type="range" min={128} max={2048} step={64} value={sizePx} onChange={(e) => setSizePx(Number(e.target.value))} aria-label={`${q.size} ${sizePx}px`} />
          )}
        </div>
        <Field label={<>{q.quietZone} · {margin}</>}>
          <input type="range" min={0} max={6} step={1} value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></Field>

        <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {q.privacy}</p>
      </div>
    </div>
  )
}
