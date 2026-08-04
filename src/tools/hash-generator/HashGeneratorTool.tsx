import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, UploadIcon, LockIcon } from '../../components/icons'
import { Button, Textarea, Stack, Seg, SegButton, Input, Field } from '../../components/ui'
import type { HashRequest, HashResponse } from './hash.worker'

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
    verify: 'Compare with a published hash', verifyPh: 'Paste the checksum you were given…',
    match: 'Matches — the file is intact and unaltered.',
    noMatch: 'Does NOT match. The file is not the one this checksum describes.',
    algoHint: (a: string) => `That looks like a ${a} checksum — switching to it.`,
  },
  ar: {
    text: 'نص', file: 'ملف',
    placeholder: 'اكتب أو الصق نصًا لحسابه…',
    drop: 'أفلت ملفًا أو اضغط للاختيار — لا يغادر جهازك.',
    hex: 'ست عشري', base64: 'Base64', copy: 'نسخ', copied: 'تم النسخ!',
    empty: 'أدخل نصًا أو اختر ملفًا.', hashing: 'جارٍ الحساب…',
    bytes: (n: number) => `${n.toLocaleString('ar')} بايت`, privacy: 'يعمل بالكامل داخل متصفحك — لا يُرفع أي شيء.',
    verify: 'قارن مع بصمة منشورة', verifyPh: 'الصق البصمة التي حصلت عليها…',
    match: 'مطابقة — الملف سليم ولم يُعدَّل.',
    noMatch: 'غير مطابقة. هذا الملف ليس ما تصفه هذه البصمة.',
    algoHint: (a: string) => `يبدو أن هذه بصمة ${a} — تم التبديل إليها.`,
  },
}

export default function HashGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [mode, setMode] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [algo, setAlgo] = useState<Algo>('SHA-256')
  const [hex, setHex] = useState('')
  const [b64, setB64] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')
  const [expected, setExpected] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const reqRef = useRef(0)

  useEffect(() => () => { workerRef.current?.terminate() }, [])

  useEffect(() => {
    const data: File | string | null = mode === 'file' ? file : (text || null)
    if (!data) { setHex(''); setB64(''); return }
    workerRef.current ??= new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' })
    const worker = workerRef.current
    const id = ++reqRef.current
    setBusy(true)
    const onMessage = (e: MessageEvent<HashResponse>) => {
      if (e.data.id !== reqRef.current) return // stale response — a newer request is in flight
      setHex(e.data.hex); setB64(e.data.b64); setBusy(false)
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage({ id, algo, data } satisfies HashRequest)
    return () => worker.removeEventListener('message', onMessage)
  }, [mode, text, file, algo])

  function onFile(f: File | undefined) {
    if (f) setFile(f)
  }

  // Someone pasting a checksum usually doesn't know (or say) which algorithm it
  // is — but the hex length gives it away, so switch rather than make them pick.
  const BY_LEN: Record<number, Algo> = { 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' }
  function onExpected(v: string) {
    setExpected(v)
    const guess = BY_LEN[v.trim().replace(/^0x/i, '').length]
    if (guess && guess !== algo) setAlgo(guess)
  }


  async function copy(value: string, which: string) {
    if (!value) return
    try { await navigator.clipboard.writeText(value); setCopied(which); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }

  const has = hex && !busy
  // Compare case- and whitespace-insensitively, and tolerate the "<hash>  <filename>"
  // shape that sha256sum output is usually pasted in.
  const wanted = expected.trim().split(/\s+/)[0].replace(/^0x/i, '').toLowerCase()
  const verdict: 'match' | 'no' | null = !wanted || !has ? null
    : wanted === hex.toLowerCase() || wanted === b64.toLowerCase() ? 'match' : 'no'

  return (
    <Stack data-testid="hash-generator">
      <div className="flex flex-wrap items-center gap-[0.6rem] justify-between">
        <Seg role="group" aria-label="source">
          {(['text', 'file'] as const).map((m) => (
            <SegButton key={m} active={mode === m} aria-pressed={mode === m}
              data-testid={`hash-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</SegButton>
          ))}
        </Seg>
        <Seg role="group" aria-label="algorithm">
          {ALGOS.map((a) => (
            <SegButton key={a} active={algo === a} aria-pressed={algo === a}
              data-testid={`hash-algo-${a}`} onClick={() => setAlgo(a)}>{a.replace('SHA-', '')}</SegButton>
          ))}
        </Seg>
      </div>

      {mode === 'text' ? (
        <Textarea className="min-h-[7rem]" data-testid="hash-text"
          placeholder={s.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      ) : (
        <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] [&_small]:text-[color:var(--ink-faint)] [&_small]:text-[0.82rem]" onClick={() => fileRef.current?.click()} data-testid="hash-drop"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon />
          <span>{file ? file.name : s.drop}</span>
          {file && <small>{s.bytes(file.size)}</small>}
          <input ref={fileRef} type="file" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
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
                <Button className="flex-none px-3" onClick={() => copy(val, key)} aria-label={s.copy}><CopyIcon /> {copied === key ? s.copied : s.copy}</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ink-faint text-[0.95rem]">{s.empty}</p>
      )}

      <Field label={s.verify}>
        <Input className="font-mono text-[0.85rem]" data-testid="hash-expected" dir="ltr"
          placeholder={s.verifyPh} value={expected} onChange={(e) => onExpected(e.target.value)} />
      </Field>
      {verdict && (
        <p data-testid={`hash-verdict-${verdict}`}
          className={`m-0 text-[0.9rem] font-semibold ${verdict === 'match' ? 'text-green-700' : 'text-[color:var(--danger)]'}`}>
          {verdict === 'match' ? s.match : s.noMatch}
        </p>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><LockIcon className="w-3.5 h-3.5 flex-none" /> {s.privacy}</p>
    </Stack>
  )
}
