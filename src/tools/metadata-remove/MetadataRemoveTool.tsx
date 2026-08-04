import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { setWorkInProgress } from '../../lib/workInProgress'
import { UploadIcon, DownloadIcon, LockIcon } from '../../components/icons'
import { Button, Stack, Panel, FileError, Spinner } from '../../components/ui'
import { whyUnreadable } from '../../lib/imageInput'
import { decodeImage } from '../../lib/decodeImage'
import { stripMetadata, type StripResult } from './strip'

const STR = {
  en: {
    drop: 'Drop a photo, or tap to choose',
    working: 'Cleaning…', another: 'Clean another photo',
    removed: 'Removed', nothing: 'This photo carried no metadata — nothing to remove.',
    download: 'Download the clean photo',
    saved: 'saved', size: 'Size', from: 'was',
    lossless: 'Pixels untouched — the image was not re-compressed.',
    lossy: 'This format had to be re-encoded, so the image was recompressed once.',
    why: 'A photo from a phone usually records the exact spot it was taken, the device, and the moment — all of which travel with the file when you send it.',
    privacy: 'Cleaned on your device — the photo is never uploaded.',
  },
  ar: {
    drop: 'أفلت صورة أو اضغط للاختيار',
    working: 'جارٍ التنظيف…', another: 'نظّف صورة أخرى',
    removed: 'أُزيل', nothing: 'لا تحتوي هذه الصورة على بيانات وصفية — لا شيء لإزالته.',
    download: 'تنزيل الصورة النظيفة',
    saved: 'وُفِّر', size: 'الحجم', from: 'كان',
    lossless: 'لم تُمسّ البكسلات — لم يُعد ضغط الصورة.',
    lossy: 'تطلّبت هذه الصيغة إعادة ترميز، لذا أُعيد ضغط الصورة مرة واحدة.',
    why: 'تسجّل صور الهاتف عادةً المكان الدقيق للالتقاط والجهاز واللحظة — وكلها تنتقل مع الملف عند إرساله.',
    privacy: 'تُنظَّف على جهازك — لا تُرفع الصورة أبدًا.',
  },
}

const kb = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`)

export default function MetadataRemoveTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [out, setOut] = useState<(StripResult & { url: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    setWorkInProgress('metadata-remove', !!file)
    return () => setWorkInProgress('metadata-remove', false)
  }, [file])

  function reset() {
    setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return null })
  }

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr(''); reset(); setBusy(true)
    try {
      // #225: verify by decoding, never by MIME — Android sends HEIC with none.
      const bmp = await decodeImage(f)
      if (!bmp) { setFile(null); setErr(await whyUnreadable(f, locale)); return }
      const res = await stripMetadata(f, bmp)
      bmp.close()
      setFile(f)
      setOut({ ...res, url: URL.createObjectURL(res.blob) })
    } finally {
      setBusy(false)
    }
  }

  const cleanName = file ? file.name.replace(/(\.[^.]+)?$/, (e) => (out?.reencoded ? '.png' : e || '')) : ''

  return (
    <Stack data-testid="metadata-remove">
      {!file ? (
        <>
          <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)]" data-testid="mr-drop" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
            {busy ? <Spinner className="size-6" /> : <UploadIcon />}
            <span>{busy ? s.working : s.drop}</span>
            {/* No `accept`: an image-only accept hides Downloads on Android (#225). */}
            <input ref={fileRef} type="file" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
          </button>
          <p className="text-[0.85rem] text-ink-soft max-w-[42rem]">{s.why}</p>
        </>
      ) : out && (
        <>
          <div className="flex flex-wrap gap-4 items-start">
            <img src={out.url} alt="" data-testid="mr-preview"
              className="max-w-[16rem] w-full h-auto rounded-[var(--r-md)] border border-[color:var(--line-soft)] bg-white" />
            <Panel className="flex-1 min-w-[15rem]">
              <Stack>
                {out.removed.length > 0 ? (
                  <div data-testid="mr-removed">
                    <p className="text-[0.8rem] uppercase tracking-wide text-ink-faint m-0 mb-1">{s.removed}</p>
                    <ul className="m-0 ps-4 text-[0.9rem] flex flex-col gap-0.5">
                      {out.removed.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                ) : <p className="m-0 text-ink-soft" data-testid="mr-nothing">{s.nothing}</p>}

                <p className="m-0 text-[0.9rem] text-ink-soft" data-testid="mr-size">
                  {s.size}: <span className="font-semibold">{kb(out.blob.size)}</span>
                  {file.size > out.blob.size && <> · {s.from} {kb(file.size)} · {kb(file.size - out.blob.size)} {s.saved}</>}
                </p>
                <p className="m-0 text-[0.8rem] text-ink-faint" data-testid="mr-mode">{out.reencoded ? s.lossy : s.lossless}</p>
              </Stack>
            </Panel>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="primary" href={out.url} download={cleanName} data-testid="mr-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={() => { reset(); setFile(null); setErr('') }} data-testid="mr-again">{s.another}</Button>
          </div>
        </>
      )}

      <FileError message={err} />
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><LockIcon className="w-3.5 h-3.5 flex-none" /> {s.privacy}</p>
    </Stack>
  )
}
