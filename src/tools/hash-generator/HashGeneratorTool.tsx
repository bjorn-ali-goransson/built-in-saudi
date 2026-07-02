import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, UploadIcon } from '../../components/icons'

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
const ALGOS: Algo[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

const STR = {
  en: {
    text: 'Text', file: 'File',
    placeholder: 'Type or paste text to hash…',
    drop: 'Drop a file, or tap to choose — it never leaves your device.',
    hex: 'Hex', base64: 'Base64', copy: 'Copy', copied: 'Copied!',
    empty: 'Enter text or choose a file.', hashing: 'Hashing…',
    bytes: (n: number) => `${n.toLocaleString()} bytes`, privacy: 'Runs entirely in your browser — nothing is uploaded.',
  },
  ar: {
    text: 'نص', file: 'ملف',
    placeholder: 'اكتب أو الصق نصًا لحسابه…',
    drop: 'أفلت ملفًا أو اضغط للاختيار — لا يغادر جهازك.',
    hex: 'ست عشري', base64: 'Base64', copy: 'نسخ', copied: 'تم النسخ!',
    empty: 'أدخل نصًا أو اختر ملفًا.', hashing: 'جارٍ الحساب…',
    bytes: (n: number) => `${n.toLocaleString('ar')} بايت`, privacy: 'يعمل بالكامل داخل متصفحك — لا يُرفع أي شيء.',
  },
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))

export default function HashGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [mode, setMode] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<{ name: string; buf: ArrayBuffer } | null>(null)
  const [algo, setAlgo] = useState<Algo>('SHA-256')
  const [hex, setHex] = useState('')
  const [b64, setB64] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    const data: BufferSource | null | undefined = mode === 'file' ? file?.buf : (text ? new TextEncoder().encode(text) : null)
    if (!data) { setHex(''); setB64(''); return }
    setBusy(true)
    crypto.subtle.digest(algo, data).then((d) => {
      if (cancelled) return
      setHex(toHex(d)); setB64(toB64(d)); setBusy(false)
    })
    return () => { cancelled = true }
  }, [mode, text, file, algo])

  async function onFile(f: File | undefined) {
    if (!f) return
    setFile({ name: f.name, buf: await f.arrayBuffer() })
  }

  async function copy(value: string, which: string) {
    if (!value) return
    try { await navigator.clipboard.writeText(value); setCopied(which); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }

  const has = hex && !busy

  return (
    <div className="stack" data-testid="hash-generator">
      <div className="flex flex-wrap items-center gap-[0.6rem] justify-between">
        <div className="seg" role="group" aria-label="source">
          {(['text', 'file'] as const).map((m) => (
            <button key={m} className={`seg__btn ${mode === m ? 'is-active' : ''}`} aria-pressed={mode === m}
              data-testid={`hash-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="algorithm">
          {ALGOS.map((a) => (
            <button key={a} className={`seg__btn ${algo === a ? 'is-active' : ''}`} aria-pressed={algo === a}
              data-testid={`hash-algo-${a}`} onClick={() => setAlgo(a)}>{a.replace('SHA-', '')}</button>
          ))}
        </div>
      </div>

      {mode === 'text' ? (
        <textarea className="input input--area min-h-[7rem]" data-testid="hash-text"
          placeholder={s.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      ) : (
        <button className="dropzone" onClick={() => fileRef.current?.click()} data-testid="hash-drop"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon />
          <span>{file ? file.name : s.drop}</span>
          {file && <small>{s.bytes(file.buf.byteLength)}</small>}
          <input ref={fileRef} type="file" className="dropzone__input" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      )}

      {busy ? (
        <p className="text-ink-faint">{s.hashing}</p>
      ) : has ? (
        <div className="flex flex-col gap-3">
          {([['hex', hex, s.hex], ['b64', b64, s.base64]] as const).map(([key, val, label]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="font-body text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{label}</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-[0.85rem] break-all bg-sand-100 border border-[color:var(--line-soft)] rounded-[5px] px-3 py-2 text-green-700" data-testid={`hash-${key}`}>{val}</code>
                <button className="btn flex-none px-3" onClick={() => copy(val, key)} aria-label={s.copy}><CopyIcon /> {copied === key ? s.copied : s.copy}</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ink-faint text-[0.95rem]">{s.empty}</p>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </div>
  )
}
