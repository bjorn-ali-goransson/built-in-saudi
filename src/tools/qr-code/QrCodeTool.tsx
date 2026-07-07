import { useEffect, useMemo, useRef, useState } from 'react'
import { LinkIcon, TextIcon, WifiIcon, MailIcon, PhoneIcon, DownloadIcon, ShareIcon } from '../../components/icons'
import { useLocale } from '../../i18n'
import { type QrContentType, type WifiFields, type EmailFields, normalizeUrl, buildWifi, buildEmail, buildPhone } from './build'
import { renderQR, type DotStyle, type Frame, type BorderStyle, DOT_STYLES } from './qrRender'
import { Input, Textarea, Select, Field, FieldLabel, Check, Seg, SegButton } from '../../components/ui'

const TYPE_DEFS: { id: QrContentType; Icon: typeof LinkIcon }[] = [
  { id: 'link', Icon: LinkIcon }, { id: 'text', Icon: TextIcon }, { id: 'wifi', Icon: WifiIcon },
  { id: 'email', Icon: MailIcon }, { id: 'phone', Icon: PhoneIcon },
]
const SIZES: { key: 'sizeSmall' | 'sizeMedium' | 'sizeLarge' | 'sizeHD'; px: number }[] = [
  { key: 'sizeSmall', px: 256 }, { key: 'sizeMedium', px: 512 }, { key: 'sizeLarge', px: 1024 }, { key: 'sizeHD', px: 2048 },
]

const NO_BORDER: BorderStyle = { width: 0, style: 'solid', radius: 0 }

// A theme is a full, reconstructable parameter set (pattern + colours + frame + border).
interface Preset { en: string; ar: string; dot: DotStyle; fg: string; bg: string; frame: Frame; border: BorderStyle }
const PRESETS: Preset[] = [
  { en: 'Classic', ar: 'كلاسيكي', dot: 'square', fg: '#12211b', bg: '#ffffff', frame: 'none', border: NO_BORDER },
  { en: 'Emerald', ar: 'زمرّدي', dot: 'dots', fg: '#0f5132', bg: '#ffffff', frame: 'none', border: NO_BORDER },
  { en: 'Blueprint', ar: 'أزرق', dot: 'rounded', fg: '#1e3a8a', bg: '#eff6ff', frame: 'card', border: NO_BORDER },
  { en: 'Terracotta', ar: 'طيني', dot: 'liquid', fg: '#7c2d12', bg: '#ffffff', frame: 'none', border: { width: 0.022, style: 'solid', radius: 0.16 } },
  { en: 'Carbon', ar: 'كربوني', dot: 'cube', fg: '#111827', bg: '#ffffff', frame: 'none', border: NO_BORDER },
  { en: 'Midnight', ar: 'ليلي', dot: 'dots', fg: '#ffffff', bg: '#12211b', frame: 'circle', border: NO_BORDER },
  { en: 'Rosé', ar: 'وردي', dot: 'liquid', fg: '#831843', bg: '#fdf2f8', frame: 'card', border: NO_BORDER },
  { en: 'Lagoon', ar: 'بحيري', dot: 'rounded', fg: '#0e7490', bg: '#ecfeff', frame: 'none', border: { width: 0.022, style: 'dashed', radius: 0.05 } },
]

// Named colour-pair presets for the palette.
const PALETTES: { en: string; ar: string; fg: string; bg: string }[] = [
  { en: 'Spring', ar: 'الربيع', fg: '#2f6b3a', bg: '#eef7ee' },
  { en: 'Summer', ar: 'الصيف', fg: '#c2820a', bg: '#fffdf2' },
  { en: 'Mountains & rivers', ar: 'جبال وأنهار', fg: '#1f4e5f', bg: '#eef5f6' },
  { en: 'Desert', ar: 'الصحراء', fg: '#9c5a2c', bg: '#fbf2e6' },
  { en: 'Bubbly', ar: 'فقاعات', fg: '#c026a3', bg: '#fdf2fb' },
  { en: 'Midnight', ar: 'منتصف الليل', fg: '#e5e7eb', bg: '#0f172a' },
  { en: 'Ocean', ar: 'المحيط', fg: '#0e7490', bg: '#ecfeff' },
  { en: 'Berry', ar: 'التوت', fg: '#9d174d', bg: '#fff1f5' },
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
const sameBorder = (a: BorderStyle, b: BorderStyle) => a.width === b.width && a.style === b.style && a.radius === b.radius

// A small non-interactive QR preview rendered to its own canvas.
function MiniQR({ dot, fg, bg, frame, px, emoji, label, border }: { dot: DotStyle; fg: string; bg: string; frame: Frame; px: number; emoji?: string; label?: string; border?: BorderStyle }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) renderQR(ref.current, { value: SAMPLE, size: 120, margin: 1, fg, bg, dot, emoji, ecLevel: 'M', frame, frameColor: fg, label: label ?? '', border })
  }, [dot, fg, bg, frame, emoji, label, border])
  return <canvas ref={ref} className="rounded-[4px]" style={{ width: px, height: 'auto' }} aria-hidden="true" />
}

export default function QrCodeTool() {
  const { t, locale } = useLocale()
  const q = t.qr
  const ar = locale === 'ar'
  const L = ar
    ? { title: 'أنشئ رمز باركود', body: 'الصق رابطًا واحصل على باركود أنيق ومخصّص. لا يُرفع أي شيء.', surprise: 'تنسيق مفاجئ', appearance: 'المظهر', settings: 'الإعدادات', theme: 'السمة', palette: 'لوحة الألوان', primary: 'اللون الأساسي', secondary: 'اللون الثانوي', border: 'الإطار', margin: 'الهامش', addCenter: 'شعار في المنتصف', centerOn: 'شعار في المنتصف' }
    : { title: 'Make a QR code', body: '', surprise: 'Surprise styling', appearance: 'Appearance', settings: 'Settings', theme: 'Theme', palette: 'Color palette', primary: 'Primary color', secondary: 'Secondary color', border: 'Border', margin: 'Margin', addCenter: 'Add centre logo', centerOn: 'Centre logo' }

  const BORDERS: { key: string; name: string; b: BorderStyle }[] = [
    { key: 'none', name: ar ? 'بلا' : 'None', b: NO_BORDER },
    { key: 'thin', name: ar ? 'رفيع' : 'Thin', b: { width: 0.012, style: 'solid', radius: 0.05 } },
    { key: 'bold', name: ar ? 'عريض' : 'Bold', b: { width: 0.03, style: 'solid', radius: 0.05 } },
    { key: 'dashed', name: ar ? 'متقطّع' : 'Dashed', b: { width: 0.022, style: 'dashed', radius: 0.05 } },
    { key: 'round', name: ar ? 'دائري' : 'Rounded', b: { width: 0.022, style: 'solid', radius: 0.16 } },
  ]
  const FRAMES: { key: Frame; name: string }[] = [
    { key: 'none', name: ar ? 'بلا' : 'None' },
    { key: 'card', name: ar ? 'بطاقة' : 'Card' },
    { key: 'panel', name: ar ? 'لوحة' : 'Panel' },
    { key: 'bubble', name: ar ? 'فقاعة' : 'Bubble' },
    { key: 'ribbon', name: ar ? 'شريط' : 'Ribbon' },
    { key: 'corner', name: ar ? 'أركان' : 'Corners' },
    { key: 'circle', name: ar ? 'دائرة' : 'Circle' },
  ]

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
  const [border, setBorder] = useState<BorderStyle>(NO_BORDER)
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
    renderQR(c, { value, size: sizePx, margin, fg, bg, dot, emoji, ecLevel: logo ? 'H' : 'M', logo, frame, frameColor: fg, label, border })
  }, [value, sizePx, margin, fg, bg, dot, emoji, logo, frame, label, border])

  function applyPreset(p: Preset) { setDot(p.dot); setFg(p.fg); setBg(p.bg); setFrame(p.frame); setBorder(p.border) }
  // Frame (card/circle) and a standalone border are alternative containers — pick one.
  function chooseFrame(f: Frame) { setFrame(f); if (f !== 'none') setBorder(NO_BORDER) }
  function chooseBorder(b: BorderStyle) { setBorder(b); if (b.width > 0) setFrame('none') }
  function surprise() {
    const dots = DOT_STYLES.filter((d) => d !== 'emoji')
    setDot(dots[Math.floor(Math.random() * dots.length)])
    const frames: Frame[] = ['none', 'none', 'card', 'circle']
    const f = frames[Math.floor(Math.random() * frames.length)]
    setFrame(f)
    setBorder(f === 'none' && Math.random() < 0.5 ? BORDERS[1 + Math.floor(Math.random() * 4)].b : NO_BORDER)
    const h = Math.floor(Math.random() * 360); setFg(hslHex(h, 70, 26)); setBg(hslHex((h + 8) % 360, 55, 96))
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

  const heroIcon = 'inline-flex items-center justify-center size-11 rounded-md bg-[color-mix(in_srgb,var(--sand-100)_16%,transparent)] border border-[color-mix(in_srgb,var(--sand-100)_40%,transparent)] text-sand-100 cursor-pointer hover:bg-[color-mix(in_srgb,var(--sand-100)_28%,transparent)] disabled:opacity-40 disabled:cursor-default [&_svg]:size-5'
  const optCard = (active: boolean) => `flex flex-col items-center gap-1 rounded-md border-2 p-1.5 cursor-pointer ${active ? 'border-green-600 bg-[color-mix(in_srgb,var(--green-400)_12%,transparent)]' : 'border-[color:var(--line-soft)] hover:border-green-500'}`
  const optName = 'text-[0.66rem] text-ink-soft leading-tight text-center'
  const sectionHead = 'text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-green-700 mt-1'

  return (
    <div className="flex flex-col gap-5" data-testid="qr-code">
      {/* Green intro hero: URL + the QR itself with its actions, left-aligned */}
      <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] bg-green-600 text-sand-100">
        <div className="wrap py-[clamp(1.4rem,4vw,2rem)] flex flex-col gap-4 items-start max-w-[44rem]">
          <div className="flex flex-col gap-1">
            <h1 className="font-display rtl:font-ar text-[clamp(1.4rem,4vw,1.9rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{L.title}</h1>
          </div>
          <input
            type="url" inputMode="url" placeholder={q.placeholderUrl} data-testid="qr-url" value={link} autoComplete="off"
            onChange={(e) => { setLink(e.target.value); setType('link') }}
            className="w-full max-w-[26rem] rounded-md border-0 bg-white text-ink px-3.5 py-2.5 text-[0.95rem] outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-[color-mix(in_srgb,var(--sand-100)_60%,transparent)]"
          />
          <div className="flex flex-col items-start gap-3">
            {hasCode
              ? <canvas ref={canvasRef} data-testid="qr-canvas" className="w-full max-w-[220px] h-auto" />
              : <div className="grid place-items-center w-[200px] h-[200px] rounded-md bg-[color-mix(in_srgb,var(--sand-100)_12%,transparent)] text-center px-4 text-[0.9rem] text-[color-mix(in_srgb,var(--sand-100)_85%,transparent)]">{q.empty}</div>}
            <div className="flex flex-row items-center gap-2">
              <button type="button" className={heroIcon} data-testid="qr-share" onClick={share} disabled={!hasCode} aria-label={copied ? q.copied : q.share} title={copied ? q.copied : q.share}>
                {copied ? <span className="font-bold" aria-hidden="true">✓</span> : <ShareIcon />}
              </button>
              <button type="button" className={heroIcon} onClick={downloadPng} disabled={!hasCode} aria-label={q.download} title={q.download}>
                <DownloadIcon />
              </button>
              <button type="button" onClick={surprise} data-testid="qr-surprise"
                className="inline-flex items-center rounded-md bg-[color-mix(in_srgb,var(--sand-100)_16%,transparent)] border border-[color-mix(in_srgb,var(--sand-100)_40%,transparent)] text-sand-100 px-4 h-11 text-[0.9rem] font-semibold cursor-pointer hover:bg-[color-mix(in_srgb,var(--sand-100)_28%,transparent)]">
                {L.surprise}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto w-full flex flex-col gap-5">
        {/* ── Appearance ─────────────────────────────── */}
        <span className={sectionHead}>{L.appearance}</span>

        {/* Theme (was "Style") — named, previewed, fully parameterized */}
        <div className="flex flex-col gap-2">
          <FieldLabel>{L.theme}</FieldLabel>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {PRESETS.map((p, i) => {
              const active = dot === p.dot && fg === p.fg && bg === p.bg && frame === p.frame && sameBorder(border, p.border)
              return (
                <button key={i} className={optCard(active)} aria-current={active} data-testid={`qr-preset-${i}`} onClick={() => applyPreset(p)}>
                  <MiniQR dot={p.dot} fg={p.fg} bg={p.bg} frame={p.frame} border={p.border} px={52} />
                  <span className={optName}>{ar ? p.ar : p.en}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Pattern (dot style) */}
        <div className="flex flex-col gap-2">
          <FieldLabel>{q.dotStyle}</FieldLabel>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {DOT_STYLES.map((d) => (
              <button key={d} className={optCard(dot === d)} data-testid={`qr-dot-${d}`} onClick={() => setDot(d)}>
                <MiniQR dot={d} fg={fg} bg={bg} frame="none" px={44} emoji={emoji} />
                <span className={optName}>{q.dots[d]}</span>
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

        {/* Color palette — named presets + a plain colour square per colour */}
        <div className="flex flex-col gap-2">
          <FieldLabel>{L.palette}</FieldLabel>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {PALETTES.map((p, i) => (
              <button key={i} type="button" className={optCard(fg === p.fg && bg === p.bg)} data-testid={`qr-palette-${i}`} onClick={() => { setFg(p.fg); setBg(p.bg) }}>
                <span className="flex w-full h-8 rounded-[3px] overflow-hidden border border-[color:var(--line-soft)]">
                  <span className="flex-1" style={{ background: p.bg }} /><span className="flex-1" style={{ background: p.fg }} />
                </span>
                <span className={optName}>{ar ? p.ar : p.en}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 mt-1">
            <label className="flex items-center gap-2 text-[0.85rem] text-ink-soft">
              <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="w-9 h-9 p-0 border-0 bg-transparent cursor-pointer appearance-none [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-none [&::-webkit-color-swatch-wrapper]:p-0" aria-label={L.primary} />{L.primary}
            </label>
            <label className="flex items-center gap-2 text-[0.85rem] text-ink-soft">
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-9 h-9 p-0 border-0 bg-transparent cursor-pointer appearance-none [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-none [&::-webkit-color-swatch-wrapper]:p-0" aria-label={L.secondary} />{L.secondary}
            </label>
          </div>
        </div>

        {/* Border — named, previewed, dashed available */}
        <div className="flex flex-col gap-2">
          <FieldLabel>{L.border}</FieldLabel>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {BORDERS.map((bo) => (
              <button key={bo.key} className={optCard(sameBorder(border, bo.b))} data-testid={`qr-border-${bo.key}`} onClick={() => chooseBorder(bo.b)}>
                <MiniQR dot={dot === 'emoji' ? 'square' : dot} fg={fg} bg={bg} frame="none" border={bo.b} px={46} />
                <span className={optName}>{bo.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Frame + label + centre logo */}
        <div className="flex flex-col gap-2">
          <FieldLabel>{q.frame}</FieldLabel>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {FRAMES.map((f) => (
              <button key={f.key} className={optCard(frame === f.key)} data-testid={`qr-frame-${f.key}`} onClick={() => chooseFrame(f.key)}>
                <MiniQR dot={dot === 'emoji' ? 'square' : dot} fg={fg} bg={bg} frame={f.key} label={f.key !== 'none' ? (label || 'SCAN') : ''} px={54} />
                <span className={optName}>{f.name}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {frame !== 'none' && (
              <Input className="flex-1 min-w-[8rem] max-w-[12rem]" value={label} maxLength={16} placeholder="SCAN ME" data-testid="qr-label" onChange={(e) => setLabel(e.target.value)} />
            )}
            {logo
              ? <button type="button" className="px-3 py-1.5 rounded-md border border-[color:var(--line)] text-[0.82rem] font-semibold text-ink-soft hover:border-green-500 cursor-pointer" onClick={() => { setLogo(null); setLogoName('') }}>✕ {L.centerOn} · {logoName.slice(0, 10)}</button>
              : <button type="button" className="px-3 py-1.5 rounded-md border border-[color:var(--line)] text-[0.82rem] font-semibold text-ink-soft hover:border-green-500 cursor-pointer" data-testid="qr-add-logo" onClick={() => logoInput.current?.click()}>＋ {L.addCenter}</button>}
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
        <Field label={<>{L.margin} · {margin}</>}>
          <input type="range" min={0} max={6} step={1} value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></Field>

        <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {q.privacy}</p>
      </div>
    </div>
  )
}
