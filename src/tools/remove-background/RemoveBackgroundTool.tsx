import { useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { DownloadIcon, ScissorsIcon } from '../../components/icons'
import { Button, Stack } from '../../components/ui'

const STR = {
  en: {
    drop: 'Drop an image, or tap to choose',
    privacy: 'Runs entirely on your device — the image is never uploaded. The AI model (a few MB) downloads once on first use.',
    remove: 'Remove background', loadingModel: 'Loading model…', working: 'Removing background…',
    original: 'Original', result: 'Result', download: 'Download PNG', another: 'Another image',
    failed: 'Couldn’t process this image — try a different one.',
  },
  ar: {
    drop: 'أفلت صورة أو اضغط للاختيار',
    privacy: 'يعمل بالكامل على جهازك — لا تُرفع الصورة. يُنزَّل نموذج الذكاء الاصطناعي (بضعة ميغابايت) مرة واحدة عند أول استخدام.',
    remove: 'إزالة الخلفية', loadingModel: 'تحميل النموذج…', working: 'جارٍ إزالة الخلفية…',
    original: 'الأصل', result: 'النتيجة', download: 'تنزيل PNG', another: 'صورة أخرى',
    failed: 'تعذّرت معالجة هذه الصورة — جرّب صورة أخرى.',
  },
}

// A checkerboard so the transparent result reads as transparent.
const checker: React.CSSProperties = {
  backgroundImage: 'conic-gradient(#e6e1d6 25%, #ffffff 0 50%, #e6e1d6 0 75%, #ffffff 0)',
  backgroundSize: '20px 20px',
}

export default function RemoveBackgroundTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const srcFile = useRef<File | null>(null)
  const [srcUrl, setSrcUrl] = useState('')
  const [srcName, setSrcName] = useState('')
  const [outUrl, setOutUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState(false)

  function onFile(f: File | undefined) {
    if (!f || !f.type.startsWith('image/')) return
    setErr(false); setPct(0)
    setOutUrl((p) => { if (p) URL.revokeObjectURL(p); return '' })
    srcFile.current = f
    setSrcName(f.name.replace(/\.[^.]+$/, ''))
    setSrcUrl((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(f) })
  }

  async function run() {
    const f = srcFile.current; if (!f || busy) return
    setBusy(true); setErr(false); setPct(0)
    try {
      // Loaded on demand (it pulls in the WASM runtime) so the tool stays light until used.
      const { removeBackground } = await import('@imgly/background-removal')
      const blob = await removeBackground(f, {
        output: { format: 'image/png' },
        progress: (_key, current, total) => { if (total > 0) setPct(Math.round((current / total) * 100)) },
      })
      setOutUrl((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(blob) })
    } catch { setErr(true) } finally { setBusy(false) }
  }

  function reset() {
    setSrcUrl((p) => { if (p) URL.revokeObjectURL(p); return '' })
    setOutUrl((p) => { if (p) URL.revokeObjectURL(p); return '' })
    srcFile.current = null; setErr(false); setBusy(false); setPct(0)
  }

  const frame = 'relative grid place-items-center min-h-[12rem] max-h-[52vh] overflow-hidden rounded-md border border-[color:var(--line-soft)] p-2'

  return (
    <Stack data-testid="remove-background">
      {!srcUrl ? (
        <button className="flex flex-col items-center gap-[0.4rem] py-10 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)]"
          data-testid="rmbg-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <ScissorsIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" accept="image/*" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <figure className="flex flex-col gap-1.5 m-0">
              <figcaption className="text-[0.8rem] font-semibold uppercase tracking-wide text-ink-faint">{s.original}</figcaption>
              <div className={`${frame} bg-[var(--surface)]`}><img src={srcUrl} alt={s.original} className="max-w-full max-h-[48vh] object-contain" /></div>
            </figure>
            <figure className="flex flex-col gap-1.5 m-0">
              <figcaption className="text-[0.8rem] font-semibold uppercase tracking-wide text-ink-faint">{s.result}</figcaption>
              <div className={frame} style={checker}>
                {outUrl
                  ? <img src={outUrl} alt={s.result} data-testid="rmbg-result" className="max-w-full max-h-[48vh] object-contain" />
                  : <div className="grid place-items-center gap-2 text-ink-faint text-[0.85rem]">
                      {busy
                        ? <><span className="w-7 h-7 rounded-full border-2 border-[color:var(--line)] border-t-green-600 animate-spin" /><span>{pct > 0 ? `${s.working} ${pct}%` : s.loadingModel}</span></>
                        : <ScissorsIcon className="w-8 h-8 opacity-40" />}
                    </div>}
              </div>
            </figure>
          </div>

          {err && <p className="text-[0.9rem] text-[var(--danger)]" data-testid="rmbg-error">{s.failed}</p>}

          <div className="flex flex-wrap gap-2">
            {outUrl
              ? <Button variant="primary" href={outUrl} download={`${srcName}-nobg.png`} data-testid="rmbg-download"><DownloadIcon /> {s.download}</Button>
              : <Button variant="primary" onClick={run} disabled={busy} data-testid="rmbg-run">{busy ? (pct > 0 ? `${pct}%` : s.loadingModel) : (<><ScissorsIcon /> {s.remove}</>)}</Button>}
            <Button onClick={reset} data-testid="rmbg-reset">{s.another}</Button>
          </div>
        </>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
