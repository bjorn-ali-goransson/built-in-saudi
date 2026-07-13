import { useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Stack, Seg, SegButton, Input, Field } from '../../components/ui'

const STR = {
  en: {
    encrypt: 'Encrypt', decrypt: 'Decrypt', drop: 'Drop a file, or tap to choose', dropEnc: 'Drop a .enc file to decrypt',
    password: 'Password', run: 'Encrypt & download', runDec: 'Decrypt & download', working: 'Working…',
    needPass: 'Enter a password.', badPass: 'Wrong password, or the file is not a valid encrypted file.',
    note: 'AES-256-GCM with a PBKDF2 key (200,000 iterations). There is no recovery — if you forget the password, the file cannot be decrypted.',
    change: 'Choose another file', privacy: 'Encrypted in your browser — the file and password never leave your device.',
  },
  ar: {
    encrypt: 'تشفير', decrypt: 'فكّ التشفير', drop: 'أفلت ملفًا أو اضغط للاختيار', dropEnc: 'أفلت ملف .enc لفكّ تشفيره',
    password: 'كلمة المرور', run: 'شفّر ونزّل', runDec: 'فُكّ ونزّل', working: 'جارٍ العمل…',
    needPass: 'أدخل كلمة مرور.', badPass: 'كلمة مرور خاطئة أو الملف ليس ملفًا مشفّرًا صالحًا.',
    note: 'AES-256-GCM بمفتاح PBKDF2 (200,000 تكرار). لا توجد استعادة — إن نسيت كلمة المرور فلن يمكن فكّ تشفير الملف.',
    change: 'اختر ملفًا آخر', privacy: 'يُشفّر في متصفحك — لا يغادر الملف ولا كلمة المرور جهازك.',
  },
}

async function deriveKey(password: string, salt: BufferSource) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password) as BufferSource, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export default function FileEncryptTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function save(bytes: BlobPart, name: string) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes])); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  async function run() {
    if (!file) return
    if (!password) { setError(s.needPass); return }
    setError(''); setBusy(true)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      if (mode === 'encrypt') {
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const key = await deriveKey(password, salt)
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf))
        const out = new Uint8Array(16 + 12 + ct.length)
        out.set(salt, 0); out.set(iv, 16); out.set(ct, 28)
        save(out, `${file.name}.enc`)
      } else {
        const salt = buf.slice(0, 16), iv = buf.slice(16, 28), ct = buf.slice(28)
        const key = await deriveKey(password, salt)
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
        save(pt, file.name.replace(/\.enc$/, '') || 'decrypted')
      }
    } catch { setError(s.badPass) }
    finally { setBusy(false) }
  }

  return (
    <Stack data-testid="file-encrypt">
      <Seg className="self-start">
        <SegButton active={mode === 'encrypt'} onClick={() => { setMode('encrypt'); setError('') }} data-testid="fe-encrypt">{s.encrypt}</SegButton>
        <SegButton active={mode === 'decrypt'} onClick={() => { setMode('decrypt'); setError('') }} data-testid="fe-decrypt">{s.decrypt}</SegButton>
      </Seg>

      {!file ? (
        <button className="relative flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)]" data-testid="fe-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0] || null) }}>
          <UploadIcon /><span>{mode === 'encrypt' ? s.drop : s.dropEnc}</span>
          <input ref={fileRef} type="file" className="absolute w-px h-px opacity-0" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </button>
      ) : (
        <>
          <p className="text-[0.9rem] text-ink-soft font-mono break-all">{file.name}</p>
          <Field label={s.password}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" data-testid="fe-password" />
          </Field>
          {error && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="fe-error">{error}</p>}
          <div className="flex gap-2">
            <Button variant="primary" onClick={run} disabled={busy} data-testid="fe-run"><DownloadIcon /> {busy ? s.working : mode === 'encrypt' ? s.run : s.runDec}</Button>
            <Button onClick={() => { setFile(null); setError('') }}>{s.change}</Button>
          </div>
          <p className="text-[0.78rem] text-ink-faint leading-relaxed">{s.note}</p>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
