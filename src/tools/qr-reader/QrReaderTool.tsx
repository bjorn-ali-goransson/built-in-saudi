import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { setWorkInProgress } from '../../lib/workInProgress'
import { UploadIcon, CopyIcon, CameraIcon, LockIcon } from '../../components/icons'
import { Button, Stack, Seg, SegButton, Panel, FileError } from '../../components/ui'
import { whyUnreadable } from '../../lib/imageInput'
import { decodeImage } from '../../lib/decodeImage'
import { parsePayload, warnings, type Warning } from './decode'

const STR = {
  en: {
    fromImage: 'From an image', fromCamera: 'Use the camera',
    drop: 'Drop a picture of a QR code, or tap to choose',
    scanning: 'Point the camera at a QR code', start: 'Start the camera', stop: 'Stop',
    noCam: 'No camera available, or permission was refused. You can still read a picture.',
    none: 'No QR code found in that picture. A closer, sharper, straighter shot usually works.',
    contents: 'Contents', copy: 'Copy', copied: 'Copied!', open: 'Open the link', again: 'Read another',
    kind: { url: 'Link', wifi: 'Wi-Fi network', contact: 'Contact card', email: 'Email', phone: 'Phone number', sms: 'Text message', geo: 'Location', text: 'Plain text' },
    checkFirst: 'Check this before you open it',
    w: {
      punycode: 'The address uses punycode (xn--), which is how look-alike domains are usually spelled.',
      userinfo: 'There is a “user@” part before the real address — the text before the @ is not the site you would visit.',
      ip: 'It points at a raw IP address rather than a domain name.',
      'nonstandard-port': 'It uses an unusual port.',
      insecure: 'It is plain http, so the connection is not encrypted.',
      shortener: 'It is a shortened link, so the real destination is hidden until you open it.',
      confusable: 'The address mixes Latin letters with another script that has look-alike characters.',
    } as Record<Warning, string>,
    privacy: 'Read on your device — the picture and the camera feed are never uploaded.',
  },
  ar: {
    fromImage: 'من صورة', fromCamera: 'استخدم الكاميرا',
    drop: 'أفلت صورة الباركود أو اضغط للاختيار',
    scanning: 'وجّه الكاميرا إلى الباركود', start: 'شغّل الكاميرا', stop: 'إيقاف',
    noCam: 'لا توجد كاميرا متاحة أو رُفض الإذن. لا يزال بإمكانك قراءة صورة.',
    none: 'لم يُعثر على باركود في الصورة. عادةً ما تنجح لقطة أقرب وأوضح وأكثر استقامة.',
    contents: 'المحتوى', copy: 'نسخ', copied: 'تم النسخ!', open: 'فتح الرابط', again: 'اقرأ آخر',
    kind: { url: 'رابط', wifi: 'شبكة واي فاي', contact: 'بطاقة اتصال', email: 'بريد إلكتروني', phone: 'رقم هاتف', sms: 'رسالة نصية', geo: 'موقع', text: 'نص عادي' },
    checkFirst: 'تحقّق من هذا قبل الفتح',
    w: {
      punycode: 'يستخدم العنوان ترميز punycode ‏(xn--)، وهو أسلوب شائع في النطاقات المضللة.',
      userinfo: 'يوجد جزء «user@» قبل العنوان الحقيقي — وما قبل @ ليس الموقع الذي ستزوره.',
      ip: 'يشير إلى عنوان IP مباشر بدل اسم نطاق.',
      'nonstandard-port': 'يستخدم منفذًا غير معتاد.',
      insecure: 'الرابط بصيغة http فقط، أي أن الاتصال غير مشفّر.',
      shortener: 'رابط مختصر، لذا تبقى الوجهة الحقيقية مخفية حتى تفتحه.',
      confusable: 'يمزج العنوان حروفًا لاتينية مع نص آخر يحوي رموزًا متشابهة.',
    } as Record<Warning, string>,
    privacy: 'تُقرأ على جهازك — لا تُرفع الصورة ولا بث الكاميرا أبدًا.',
  },
}

/** jsQR wants raw RGBA; both the file and the camera paths funnel through here. */
async function scanBitmap(bmp: ImageBitmap): Promise<string | null> {
  // Very large photos slow jsQR down for no accuracy gain — cap the long edge.
  const max = 1600
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(bmp, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const jsQR = (await import('jsqr')).default
  // Try normal, then inverted — plenty of codes in the wild are light-on-dark.
  return jsQR(data, w, h, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

export default function QrReaderTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const [mode, setMode] = useState<'image' | 'camera'>('image')
  const [result, setResult] = useState<string | null>(null)
  const [noneFound, setNoneFound] = useState(false)
  const [err, setErr] = useState('')
  const [camOn, setCamOn] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setWorkInProgress('qr-reader', !!result)
    return () => setWorkInProgress('qr-reader', false)
  }, [result])

  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamOn(false)
  }
  // A live camera must not outlive the tool — a stopped track is what turns the
  // hardware indicator off (same lesson as Calls).
  useEffect(() => stopCamera, [])

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr(''); setNoneFound(false); setResult(null)
    const bmp = await decodeImage(f)
    if (!bmp) { setErr(await whyUnreadable(f, locale)); return }
    const found = await scanBitmap(bmp)
    bmp.close()
    if (found) setResult(found)
    else setNoneFound(true)
  }

  async function startCamera() {
    setErr(''); setNoneFound(false); setResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      setCamOn(true)
      const v = videoRef.current
      if (!v) return
      v.srcObject = stream
      await v.play()
      const tick = async () => {
        if (!streamRef.current || !v.videoWidth) { rafRef.current = requestAnimationFrame(tick); return }
        try {
          const bmp = await createImageBitmap(v)
          const found = await scanBitmap(bmp)
          bmp.close()
          if (found) { setResult(found); stopCamera(); return }
        } catch { /* a dropped frame is fine, try the next one */ }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setCamOn(false)
      setErr(s.noCam)
    }
  }

  const parsed = result ? parsePayload(result) : null
  const warns = result ? warnings(result) : []

  async function copy() {
    if (!result) return
    try { await navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* blocked */ }
  }

  return (
    <Stack data-testid="qr-reader">
      <Seg className="self-start" role="group">
        {([['image', s.fromImage], ['camera', s.fromCamera]] as const).map(([m, label]) => (
          <SegButton key={m} active={mode === m} data-testid={`qr-mode-${m}`}
            onClick={() => { if (m !== 'camera') stopCamera(); setMode(m); setErr(''); setNoneFound(false) }}>{label}</SegButton>
        ))}
      </Seg>

      {mode === 'image' ? (
        <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)]" data-testid="qr-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          {/* No `accept`: an image-only accept hides Downloads on Android (#225). */}
          <input ref={fileRef} type="file" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <div className="flex flex-col gap-2 items-start">
          <div className="relative w-full max-w-[24rem] aspect-square bg-black rounded-[var(--r-md)] overflow-hidden border border-[color:var(--line-soft)]">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" data-testid="qr-video" />
            {!camOn && <div className="absolute inset-0 grid place-items-center text-sand-100 text-[0.9rem]">{s.scanning}</div>}
          </div>
          {camOn
            ? <Button onClick={stopCamera} data-testid="qr-cam-stop">{s.stop}</Button>
            : <Button variant="primary" onClick={startCamera} data-testid="qr-cam-start"><CameraIcon /> {s.start}</Button>}
        </div>
      )}

      {noneFound && <p className="text-ink-soft" data-testid="qr-none">{s.none}</p>}

      {result && parsed && (
        <Panel data-testid="qr-result">
          <Stack>
            <p className="text-[0.8rem] uppercase tracking-wide text-ink-faint m-0">{s.kind[parsed.kind]}</p>
            <pre className="whitespace-pre-wrap break-all font-mono text-[0.9rem] m-0" data-testid="qr-raw" dir="auto">{result}</pre>

            {parsed.fields.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-[0.9rem]">
                {parsed.fields.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-faint">{k}</dt>
                    <dd className="m-0 break-all" dir="auto">{v}</dd>
                  </div>
                ))}
              </dl>
            )}

            {warns.length > 0 && (
              <div className="border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] ps-3 pe-3 py-2.5 rounded-e-md" data-testid="qr-warn">
                <p className="font-semibold text-[0.88rem] m-0 mb-1">{s.checkFirst}</p>
                <ul className="m-0 ps-4 text-[0.85rem] flex flex-col gap-1">
                  {warns.map((w) => <li key={w}>{s.w[w]}</li>)}
                </ul>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button onClick={copy} data-testid="qr-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
              {parsed.kind === 'url' && (
                <Button href={parsed.url} target="_blank" rel="noopener noreferrer nofollow" data-testid="qr-open">{s.open}</Button>
              )}
              <Button onClick={() => { setResult(null); setNoneFound(false) }} data-testid="qr-again">{s.again}</Button>
            </div>
          </Stack>
        </Panel>
      )}

      <FileError message={err} />
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><LockIcon className="w-3.5 h-3.5 flex-none" /> {s.privacy}</p>
    </Stack>
  )
}
