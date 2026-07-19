import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Stack, Seg, SegButton, Textarea, Field } from '../../components/ui'
import type { StegoRequest, StegoResponse } from './stego.worker'

const STR = {
  en: {
    hide: 'Hide', reveal: 'Reveal', drop: 'Drop an image (cover), or tap to choose', dropReveal: 'Drop an image with a hidden message',
    message: 'Secret message', embed: 'Hide & download PNG', working: 'Working…', revealed: 'Revealed message', none: 'No hidden message found in this image.',
    tooBig: 'Message is too long for this image. Use a larger image or shorter text.', change: 'Choose another image',
    note: 'This hides text in the pixels (LSB). It obscures a message but is not strong encryption — for real secrecy, encrypt first. Save as PNG; re-compressing to JPEG destroys the hidden data.',
    privacy: 'Everything runs on your device — nothing is uploaded.',
  },
  ar: {
    hide: 'إخفاء', reveal: 'كشف', drop: 'أفلت صورة (غطاء) أو اضغط للاختيار', dropReveal: 'أفلت صورة تحوي رسالة مخفية',
    message: 'الرسالة السرية', embed: 'أخفِ ونزّل PNG', working: 'جارٍ العمل…', revealed: 'الرسالة المكشوفة', none: 'لا رسالة مخفية في هذه الصورة.',
    tooBig: 'الرسالة أطول من سعة هذه الصورة. استخدم صورة أكبر أو نصًّا أقصر.', change: 'اختر صورة أخرى',
    note: 'يُخفي النص في البكسلات (LSB). يُخفي الرسالة لكنه ليس تشفيرًا قويًا — للسرية الحقيقية شفّر أولًا. احفظ كـPNG؛ فإعادة الضغط إلى JPEG تتلف البيانات المخفية.',
    privacy: 'كل شيء يجري على جهازك — لا يُرفع أي شيء.',
  },
}

export default function SteganographyTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'hide' | 'reveal'>('hide')
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [tooBig, setTooBig] = useState(false)
  const [busy, setBusy] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const reqRef = useRef(0)

  useEffect(() => () => { workerRef.current?.terminate() }, [])

  // Pixel loops run in a worker (#154); responses are matched by id so a
  // newly-dropped image cancels whatever the previous one was doing.
  function run(req: { op: 'embed'; file: File; message: string } | { op: 'reveal'; file: File }) {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./stego.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current.onmessage = (e: MessageEvent<StegoResponse>) => {
        if (e.data.id !== reqRef.current) return
        setBusy(false)
        if (e.data.op === 'embed') {
          if (!e.data.blob) { setTooBig(true); return }
          const a = document.createElement('a')
          a.href = URL.createObjectURL(e.data.blob); a.download = 'hidden.png'; a.click()
          setTimeout(() => URL.revokeObjectURL(a.href), 1000)
        } else {
          setRevealed(e.data.message ?? '')
        }
      }
    }
    setBusy(true); setTooBig(false)
    workerRef.current.postMessage({ ...req, id: ++reqRef.current } as StegoRequest)
  }

  function onFile(f: File | undefined) {
    if (!f || !f.type.startsWith('image/')) return
    setTooBig(false); setRevealed(null); setFile(f)
    if (mode === 'reveal') run({ op: 'reveal', file: f })
  }

  function reset() { setFile(null); setRevealed(null); setTooBig(false); setBusy(false); reqRef.current++ }

  const dropLabel = mode === 'hide' ? s.drop : s.dropReveal

  return (
    <Stack data-testid="steganography">
      <Seg className="self-start">
        <SegButton active={mode === 'hide'} onClick={() => { setMode('hide'); reset() }} data-testid="stego-hide">{s.hide}</SegButton>
        <SegButton active={mode === 'reveal'} onClick={() => { setMode('reveal'); reset() }} data-testid="stego-reveal">{s.reveal}</SegButton>
      </Seg>

      {!file ? (
        <button className="relative flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)]" data-testid="stego-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{dropLabel}</span>
          <input ref={fileRef} type="file" accept="image/*" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : mode === 'hide' ? (
        <>
          <Field label={s.message}><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} data-testid="stego-message" /></Field>
          {tooBig && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="stego-error">{s.tooBig}</p>}
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => run({ op: 'embed', file, message })} disabled={!message || busy} data-testid="stego-embed"><DownloadIcon /> {busy ? s.working : s.embed}</Button>
            <Button onClick={reset}>{s.change}</Button>
          </div>
        </>
      ) : (
        <>
          {busy ? <p className="text-ink-faint">{s.working}</p> : revealed
            ? <Field label={s.revealed}><Textarea value={revealed} readOnly rows={4} data-testid="stego-revealed" /></Field>
            : revealed === '' ? <p className="text-ink-soft text-[0.95rem]" data-testid="stego-none">{s.none}</p> : null}
          <Button onClick={reset}>{s.change}</Button>
        </>
      )}

      <p className="text-[0.78rem] text-ink-faint leading-relaxed">{s.note}</p>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
