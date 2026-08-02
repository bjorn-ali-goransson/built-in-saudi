import { useEffect, useMemo, useRef, useState } from 'react'
import { LinkIcon, TextIcon, WifiIcon, MailIcon, PhoneIcon, DownloadIcon, ShareIcon } from '../../components/icons'
import { useLocale } from '../../i18n'
import { whyUnreadable } from '../../lib/imageInput'
import { type WifiFields, normalizeUrl, buildWifi, buildPhone } from './build'
import { renderQR, type DotStyle, type Frame, type BorderStyle, DOT_STYLES } from './qrRender'
import { Input, Select, Field, FieldLabel, Check, Seg, SegButton , FileError } from '../../components/ui'

// What a raw string looks like once we sniff it. Wi-Fi is a structured mode the
// user opts into (it can't be inferred from one field); everything else is
// auto-detected from what they type.
type Detected = 'link' | 'text' | 'email' | 'phone'
const DETECT_ICON: Record<Detected, typeof LinkIcon> = { link: LinkIcon, text: TextIcon, email: MailIcon, phone: PhoneIcon }

// Auto-detect the kind of content from a single field: an "@" makes it an email,
// digits-and-phone-punctuation only makes it a phone, a domain/scheme makes it a
// link, anything else is plain text.
function detectType(raw: string): Detected {
  const v = raw.trim()
  if (!v) return 'link'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'email'
  if (/^[+(]?[\d\s()+.\-]{3,}$/.test(v) && (v.match(/\d/g)?.length ?? 0) >= 3) return 'phone'
  if (/^[a-z][a-z0-9+.\-]*:\/\//i.test(v)) return 'link'
  if (!/\s/.test(v) && /^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return 'link'
  return 'text'
}

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
function MiniQR({ dot, fg, bg, frame, px, emoji, label, border, labelTop }: { dot: DotStyle; fg: string; bg: string; frame: Frame; px: number; emoji?: string; label?: string; border?: BorderStyle; labelTop?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) renderQR(ref.current, { value: SAMPLE, size: 120, margin: 1, fg, bg, dot, emoji, ecLevel: 'M', frame, frameColor: fg, label: label ?? '', labelTop, border })
  }, [dot, fg, bg, frame, emoji, label, border, labelTop])
  return <canvas ref={ref} className="rounded-[4px]" style={{ width: px, height: 'auto' }} aria-hidden="true" />
}

export default function QrCodeTool() {
  const { t, locale } = useLocale()
  const q = t.qr
  const ar = locale === 'ar'
  const L = ar
    ? { title: 'أنشئ رمز باركود', surprise: 'تنسيق مفاجئ', appearance: 'المظهر', settings: 'الإعدادات', theme: 'السمة', palette: 'لوحة الألوان', primary: 'اللون الأساسي', secondary: 'اللون الثانوي', border: 'الإطار', margin: 'الهامش', addCenter: 'شعار في المنتصف', centerOn: 'شعار في المنتصف', text: 'النص', textColor: 'لون النص', white: 'أبيض', primaryC: 'أساسي', placement: 'الموضع', top: 'أعلى', bottom: 'أسفل', auto: 'كشف تلقائي', detected: 'النوع', content: 'المحتوى' }
    : { title: 'Make a QR code', surprise: 'Surprise styling', appearance: 'Appearance', settings: 'Settings', theme: 'Theme', palette: 'Color palette', primary: 'Primary color', secondary: 'Secondary color', border: 'Border', margin: 'Margin', addCenter: 'Add centre logo', centerOn: 'Centre logo', text: 'Text', textColor: 'Text color', white: 'White', primaryC: 'Primary', placement: 'Placement', top: 'Top', bottom: 'Bottom', auto: 'Auto-detect', detected: 'Detected', content: 'Content' }

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

  // 'auto' = a single smart field that sniffs link/text/email/phone; 'wifi' is the
  // one structured mode (it needs SSID + password + security).
  const [mode, setMode] = useState<'auto' | 'wifi'>('auto')
  const [content, setContent] = useState('https://built-in-saudi.com')
  const [wifi, setWifi] = useState<WifiFields>({ ssid: '', password: '', encryption: 'WPA', hidden: false })
  const [logoErr, setLogoErr] = useState('')

  const [dot, setDot] = useState<DotStyle>('square')
  const [emoji, setEmoji] = useState('⭐')
  const [fg, setFg] = useState('#12211b')
  const [bg, setBg] = useState('#ffffff')
  const [frame, setFrame] = useState<Frame>('none')
  const [border, setBorder] = useState<BorderStyle>(NO_BORDER)
  const [label, setLabel] = useState('SCAN ME')
  const [labelColor, setLabelColor] = useState('#ffffff')
  const [labelTop, setLabelTop] = useState(false)
  const [sizePx, setSizePx] = useState(512)
  const [margin, setMargin] = useState(2)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const [logoName, setLogoName] = useState('')
  const [copied, setCopied] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logoInput = useRef<HTMLInputElement>(null)

  const detected = useMemo(() => detectType(content), [content])
  const value = useMemo(() => {
    if (mode === 'wifi') return buildWifi(wifi)
    const v = content.trim()
    if (!v) return ''
    switch (detected) {
      case 'email': return `mailto:${v}`
      case 'phone': return buildPhone(v)
      case 'link': return normalizeUrl(v)
      case 'text': return v
    }
  }, [mode, content, wifi, detected])

  const hasCode = !!value
  // The label only means anything inside a frame — that's the only renderer that draws it.
  const frameUsesLabel = frame !== 'none'

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    if (!value) { c.width = c.height = 0; return }
    renderQR(c, { value, size: sizePx, margin, fg, bg, dot, emoji, ecLevel: logo ? 'H' : 'M', logo, frame, frameColor: fg, label, labelColor, labelTop, border })
  }, [value, sizePx, margin, fg, bg, dot, emoji, logo, frame, label, labelColor, labelTop, border])

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
    if (!f) return
    setLogoErr('')
    // No MIME guard: Android reports HEIC with an empty MIME and this used to drop
    // it silently (#225). Report a load failure instead.
    const img = new Image()
    const url = URL.createObjectURL(f)
    img.onload = () => { setLogo(img); setLogoName(f.name) }
    img.onerror = () => { URL.revokeObjectURL(url); whyUnreadable(f, locale).then(setLogoErr) }
    img.src = url
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

  const actionIcon = 'inline-flex items-center justify-center size-11 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink cursor-pointer hover:border-green-500 hover:bg-sand-100 disabled:opacity-40 disabled:cursor-default [&_svg]:size-5'
  const optCard = (active: boolean) => `flex flex-col items-center gap-1 rounded-md border-2 p-1.5 cursor-pointer ${active ? 'border-green-600 bg-[color-mix(in_srgb,var(--green-400)_12%,transparent)]' : 'border-[color:var(--line-soft)] hover:border-green-500'}`
  const optName = 'text-[0.66rem] text-ink-soft leading-tight text-center'
  const sectionHead = 'text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-green-700 mt-1'
  const DetectIcon = DETECT_ICON[detected]

  return (
    <div className="flex flex-col gap-5 pt-1" data-testid="qr-code">
      <div className="max-w-xl mx-auto w-full flex flex-col gap-5">
        <h1 className="font-display rtl:font-ar text-[clamp(1.4rem,4vw,1.9rem)] font-bold leading-tight">{L.title}</h1>

        {/* Content — one smart field that auto-detects link/text/email/phone; Wi-Fi is opt-in */}
        <div className="flex flex-col gap-2">
          <FieldLabel>{L.content}</FieldLabel>
          <Seg role="group">
            <SegButton active={mode === 'auto'} onClick={() => setMode('auto')}>{L.auto}</SegButton>
            <SegButton active={mode === 'wifi'} className="inline-flex items-center gap-1 [&_svg]:size-[15px]" onClick={() => setMode('wifi')}><WifiIcon /> {q.types.wifi}</SegButton>
          </Seg>
          {mode === 'auto' ? (
            <>
              <Input type="text" inputMode="text" data-testid="qr-url" placeholder={q.placeholderUrl} value={content} autoComplete="off" onChange={(e) => setContent(e.target.value)} />
              {content.trim() && (
                <div className="flex items-center gap-1.5 text-[0.78rem] text-ink-faint">
                  <span>{L.detected}:</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-green-700 [&_svg]:size-[15px]"><DetectIcon /> {q.types[detected]}</span>
                </div>
              )}
            </>
          ) : (
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
        </div>

        {/* The QR itself + its actions */}
        <div className="flex flex-col items-center gap-3">
          {hasCode
            ? <canvas ref={canvasRef} data-testid="qr-canvas" className="w-full max-w-[220px] h-auto rounded-md" />
            : <div className="grid place-items-center w-[200px] h-[200px] rounded-md border border-[color:var(--line-soft)] bg-sand-100 text-center px-4 text-[0.9rem] text-ink-faint">{q.empty}</div>}
          <div className="flex flex-row items-center gap-2">
            <button type="button" className={actionIcon} data-testid="qr-share" onClick={share} disabled={!hasCode} aria-label={copied ? q.copied : q.share} title={copied ? q.copied : q.share}>
              {copied ? <span className="font-bold text-green-700" aria-hidden="true">✓</span> : <ShareIcon />}
            </button>
            <button type="button" className={actionIcon} onClick={downloadPng} disabled={!hasCode} aria-label={q.download} title={q.download}>
              <DownloadIcon />
            </button>
            <button type="button" onClick={surprise} data-testid="qr-surprise"
              className="inline-flex items-center rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] px-4 h-11 text-[0.9rem] font-semibold cursor-pointer hover:bg-green-500">
              {L.surprise}
            </button>
          </div>
        </div>

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

        {/* Frame (the "template") + its text label + centre logo */}
        <div className="flex flex-col gap-2">
          <FieldLabel>{q.frame}</FieldLabel>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {FRAMES.map((f) => (
              <button key={f.key} className={optCard(frame === f.key)} data-testid={`qr-frame-${f.key}`} onClick={() => chooseFrame(f.key)}>
                <MiniQR dot={dot === 'emoji' ? 'square' : dot} fg={fg} bg={bg} frame={f.key} label={f.key !== 'none' ? (label || 'SCAN') : ''} labelTop={labelTop} px={54} />
                <span className={optName}>{f.name}</span>
              </button>
            ))}
          </div>

          {/* The label text only exists inside a frame — surface it right under the frame picker, and only then */}
          {frameUsesLabel && (
            <div className="flex flex-col gap-2 mt-1">
              <FieldLabel>{L.text}</FieldLabel>
              <Input value={label} maxLength={16} placeholder="SCAN ME" data-testid="qr-label" onChange={(e) => setLabel(e.target.value)} />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[0.78rem] text-ink-faint">{L.textColor}</span>
                  <button type="button" data-testid="qr-textcolor-white" onClick={() => setLabelColor('#ffffff')} className={`px-2.5 py-1 rounded-md border text-[0.78rem] font-semibold cursor-pointer ${labelColor === '#ffffff' ? 'border-green-600 text-green-700 bg-[color-mix(in_srgb,var(--green-400)_12%,transparent)]' : 'border-[color:var(--line)] text-ink-soft hover:border-green-500'}`}>{L.white}</button>
                  <button type="button" data-testid="qr-textcolor-primary" onClick={() => setLabelColor(fg)} className={`px-2.5 py-1 rounded-md border text-[0.78rem] font-semibold cursor-pointer ${labelColor === fg ? 'border-green-600 text-green-700 bg-[color-mix(in_srgb,var(--green-400)_12%,transparent)]' : 'border-[color:var(--line)] text-ink-soft hover:border-green-500'}`}>{L.primaryC}</button>
                  <input type="color" value={labelColor} onChange={(e) => setLabelColor(e.target.value)} className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer appearance-none [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-none [&::-webkit-color-swatch-wrapper]:p-0" aria-label={L.textColor} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[0.78rem] text-ink-faint">{L.placement}</span>
                  <Seg role="group">
                    <SegButton active={!labelTop} onClick={() => setLabelTop(false)}>{L.bottom}</SegButton>
                    <SegButton active={labelTop} onClick={() => setLabelTop(true)}>{L.top}</SegButton>
                  </Seg>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-1">
            {logo
              ? <button type="button" className="px-3 py-1.5 rounded-md border border-[color:var(--line)] text-[0.82rem] font-semibold text-ink-soft hover:border-green-500 cursor-pointer" onClick={() => { setLogo(null); setLogoName('') }}>✕ {L.centerOn} · {logoName.slice(0, 10)}</button>
              : <button type="button" className="px-3 py-1.5 rounded-md border border-[color:var(--line)] text-[0.82rem] font-semibold text-ink-soft hover:border-green-500 cursor-pointer" data-testid="qr-add-logo" onClick={() => logoInput.current?.click()}>＋ {L.addCenter}</button>}
            <input ref={logoInput} type="file" className="hidden" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = '' }} />
            <FileError message={logoErr} />
          </div>
        </div>

        {/* ── Settings ───────────────────────────────── */}
        <span className={sectionHead}>{L.settings}</span>

        {/* Margin — a number spinner, kept at the top of Settings */}
        <Field label={L.margin}>
          <Input type="number" min={0} max={6} step={1} value={margin} data-testid="qr-margin"
            className="w-24" onChange={(e) => setMargin(Math.max(0, Math.min(6, Math.round(Number(e.target.value)) || 0)))} />
        </Field>

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

        <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {q.privacy}</p>
      </div>
    </div>
  )
}
